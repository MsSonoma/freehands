import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'transcripts';
const VROOT = 'v1';

// Known teacher sub-folders. Anything at the top level that is NOT one of these
// is treated as a legacy Ms. Sonoma lesson entry.
const TEACHER_FOLDERS = ['sonoma', 'webb', 'slate'];
const TEACHER_DISPLAY = { sonoma: 'Ms. Sonoma', webb: 'Mrs. Webb', slate: 'Mr. Slate' };

async function listAll(store, path, pageSize = 200) {
  const items = [];
  let offset = 0;
  while (true) {
    const { data, error } = await store.list(path, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      if (error?.status === 404 || /not found/i.test(error?.message || '')) break;
      throw error;
    }
    if (!data || data.length === 0) break;
    items.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return items;
}

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getClients() {
  const { url, anon, service } = getEnv();
  if (!url || !anon) return null;
  return {
    pub: createClient(url, anon, { auth: { persistSession: false } }),
    svc: service ? createClient(url, service, { auth: { persistSession: false } }) : null,
  };
}

async function getUserFromAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  const clients = getClients();
  if (!clients) return null;
  const { pub } = clients;
  const { data } = await pub.auth.getUser(token);
  return data?.user || null;
}

export async function GET(req, { params }) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ items: [] }, { status: 401 });
    const { svc } = getClients() || {};
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    const client = svc
      || (token
        ? createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
              auth: { persistSession: false },
              global: { headers: { Authorization: `Bearer ${token}` } },
            },
          )
        : null);
    if (!client) return NextResponse.json({ items: [] });
    const learnerId = (await params)?.id;
    if (!learnerId) return NextResponse.json({ items: [] });
    const store = client.storage.from(BUCKET);
    const base = `${VROOT}/${user.id}/${learnerId}`;

    // Probe for a transcript file by creating a signed URL — no download needed.
    // Supabase returns an error for non-existent paths, so this doubles as an
    // existence check. Avoids downloading (potentially large) PDF/TXT files just
    // to verify they exist, which was the main cause of 504 timeouts.
    async function tryGetTranscript(basePath, fileName, kind) {
      const path = `${basePath}/${fileName}`;
      const { data: signed, error } = await store.createSignedUrl(path, 600);
      if (error || !signed?.signedUrl) return null;
      return { path, url: signed.signedUrl, kind };
    }

    // Collect transcripts for one lesson folder. Prefer TXT; fall back to PDF.
    // RTF is omitted: transcriptsClient.js removes RTF files on every write,
    // so probing for them just adds unnecessary round trips.
    async function collectLessonTranscripts(lessonBase, lessonId, teacher) {
      const tag = { lessonId, teacher, teacherName: TEACHER_DISPLAY[teacher] || teacher };
      const collected = [];

      // Lesson-level consolidated file (TXT preferred; PDF fallback)
      const txt = await tryGetTranscript(lessonBase, 'transcript.txt', 'txt');
      if (txt) {
        collected.push({ ...tag, ...txt });
      } else {
        const pdf = await tryGetTranscript(lessonBase, 'transcript.pdf', 'pdf');
        if (pdf) collected.push({ ...tag, ...pdf });
      }

      // Per-session transcripts — parallelize across all sessions
      const sessions = await listAll(store, `${lessonBase}/sessions`);
      const sessionItems = await Promise.all(
        (sessions || [])
          .filter((ses) => ses && typeof ses.name === 'string')
          .map(async (ses) => {
            const sessionBase = `${lessonBase}/sessions/${ses.name}`;
            const sessionTag = { ...tag, lessonId: `${lessonId} \u2014 ${ses.name}` };
            const stxt = await tryGetTranscript(sessionBase, 'transcript.txt', 'txt');
            if (stxt) return { ...sessionTag, ...stxt };
            const spdf = await tryGetTranscript(sessionBase, 'transcript.pdf', 'pdf');
            if (spdf) return { ...sessionTag, ...spdf };
            return null;
          }),
      );
      collected.push(...sessionItems.filter(Boolean));
      return collected;
    }

    const topLevel = await listAll(store, base);

    // Separate teacher sub-folders from legacy flat entries, then process in parallel
    const teacherEntries = [];
    const legacyEntries = [];
    for (const entry of topLevel || []) {
      if (!entry || typeof entry.name !== 'string') continue;
      if (TEACHER_FOLDERS.includes(entry.name)) {
        teacherEntries.push(entry);
      } else {
        legacyEntries.push(entry);
      }
    }

    const allGroups = await Promise.all([
      // Teacher sub-folders (sonoma / webb / slate) — list their lessons in parallel
      ...teacherEntries.map(async (entry) => {
        const teacher = entry.name;
        const teacherBase = `${base}/${teacher}`;
        const lessons = await listAll(store, teacherBase);
        const lessonItems = await Promise.all(
          (lessons || [])
            .filter((le) => le && typeof le.name === 'string')
            .map((le) =>
              collectLessonTranscripts(`${teacherBase}/${le.name}`, le.name, teacher),
            ),
        );
        return lessonItems.flat();
      }),
      // Legacy flat entries (old Sonoma path without teacher sub-folder)
      ...legacyEntries.map((entry) =>
        collectLessonTranscripts(`${base}/${entry.name}`, entry.name, 'sonoma'),
      ),
    ]);

    const out = allGroups.flat();

    // Sort: teacher display order, then newest-first within each teacher
    const teacherOrder = { sonoma: 0, webb: 1, slate: 2 };
    out.sort((a, b) => {
      const tA = teacherOrder[a.teacher] ?? 99;
      const tB = teacherOrder[b.teacher] ?? 99;
      if (tA !== tB) return tA - tB;
      // Within a teacher, newer session IDs first
      const timeA = a.path.match(/sessions\/r-(\d+)/)?.[1] || a.lessonId;
      const timeB = b.path.match(/sessions\/r-(\d+)/)?.[1] || b.lessonId;
      return timeB.localeCompare(timeA);
    });

    return NextResponse.json({ items: out });
  } catch (e) {
    return NextResponse.json({ items: [], hint: e?.message || 'Unexpected' }, { status: 200 });
  }
}
