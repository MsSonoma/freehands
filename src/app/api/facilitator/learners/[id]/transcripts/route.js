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

    // Only filter transcripts that contain stale auth-error payloads (InvalidJWT etc.).
    // The old "header-only" heuristic incorrectly filtered V2 Sonoma transcripts that
    // legitimately contain only learner-answer lines (all starting with "Learner: …").
    function isInvalidTranscript(text) {
      if (!text || !text.trim()) return true;
      return (
        /\{"statusCode"\s*:\s*"400"\s*,\s*"error"\s*:\s*"InvalidJWT"/i.test(text) ||
        /"exp"\s*claim\s*timestamp\s*check\s*failed/i.test(text)
      );
    }

    async function tryGetTranscript(basePath, fileName, kind) {
      const path = `${basePath}/${fileName}`;
      const { data: file, error: downloadErr } = await store.download(path);
      if (downloadErr || !file) return null;
      try {
        const text = await file.text();
        if (isInvalidTranscript(text)) return null;
      } catch {
        return null;
      }
      const { data: signed, error } = await store.createSignedUrl(path, 600);
      if (error || !signed?.signedUrl) return null;
      return { path, url: signed.signedUrl, kind };
    }

    // Collect transcripts for one lesson folder (teacher-tagged)
    async function collectLessonTranscripts(lessonBase, lessonId, teacher) {
      const collected = [];
      const txt = await tryGetTranscript(lessonBase, 'transcript.txt', 'txt');
      if (txt) {
        collected.push({ lessonId, teacher, teacherName: TEACHER_DISPLAY[teacher] || teacher, ...txt });
      } else {
        const rtf = await tryGetTranscript(lessonBase, 'transcript.rtf', 'rtf');
        if (rtf) {
          collected.push({ lessonId, teacher, teacherName: TEACHER_DISPLAY[teacher] || teacher, ...rtf });
        } else {
          const pdf = await tryGetTranscript(lessonBase, 'transcript.pdf', 'pdf');
          if (pdf) {
            collected.push({ lessonId, teacher, teacherName: TEACHER_DISPLAY[teacher] || teacher, ...pdf });
          }
        }
      }
      // Per-session transcripts
      const sessions = await listAll(store, `${lessonBase}/sessions`);
      for (const ses of sessions || []) {
        if (!ses || typeof ses.name !== 'string') continue;
        const sessionBase = `${lessonBase}/sessions/${ses.name}`;
        const stxt = await tryGetTranscript(sessionBase, 'transcript.txt', 'txt');
        if (stxt) {
          collected.push({ lessonId: `${lessonId} — ${ses.name}`, teacher, teacherName: TEACHER_DISPLAY[teacher] || teacher, ...stxt });
          continue;
        }
        const srtf = await tryGetTranscript(sessionBase, 'transcript.rtf', 'rtf');
        if (srtf) {
          collected.push({ lessonId: `${lessonId} — ${ses.name}`, teacher, teacherName: TEACHER_DISPLAY[teacher] || teacher, ...srtf });
          continue;
        }
        const spdf = await tryGetTranscript(sessionBase, 'transcript.pdf', 'pdf');
        if (spdf) {
          collected.push({ lessonId: `${lessonId} — ${ses.name}`, teacher, teacherName: TEACHER_DISPLAY[teacher] || teacher, ...spdf });
        }
      }
      return collected;
    }

    const out = [];
    const topLevel = await listAll(store, base);

    for (const entry of topLevel || []) {
      if (!entry || typeof entry.name !== 'string') continue;

      if (TEACHER_FOLDERS.includes(entry.name)) {
        // Teacher sub-folder: list lessons inside it
        const teacher = entry.name;
        const teacherBase = `${base}/${teacher}`;
        const lessons = await listAll(store, teacherBase);
        for (const lessonEntry of lessons || []) {
          if (!lessonEntry || typeof lessonEntry.name !== 'string') continue;
          const lessonBase = `${teacherBase}/${lessonEntry.name}`;
          const items = await collectLessonTranscripts(lessonBase, lessonEntry.name, teacher);
          out.push(...items);
        }
      } else {
        // Legacy flat entry — Ms. Sonoma (old path without teacher folder)
        const lessonBase = `${base}/${entry.name}`;
        const items = await collectLessonTranscripts(lessonBase, entry.name, 'sonoma');
        out.push(...items);
      }
    }

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
