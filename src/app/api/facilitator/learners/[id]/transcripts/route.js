import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'transcripts';
const VROOT = 'v1';

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
      // Treat missing folders as empty; surface other errors to the caller.
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
    // If no service role, fall back to a user-scoped client seeded with the bearer token.
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
    const lessons = await listAll(store, base);
    function isHeaderOnlyTranscript(text) {
      if (!text) return false;
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (!lines.length) return false;
      const headerMatchers = [
        /^learner\s*:/i,
        /^lesson\s*id\s*:/i,
        /^session\s+\d+/i,
        /transcript/i,
        /^\d{4}-\d{2}-\d{2}/,
      ];
      return lines.every((line) => headerMatchers.some((matcher) => matcher.test(line)));
    }

    async function tryGetTranscript(basePath, fileName, kind) {
      const path = `${basePath}/${fileName}`;
      const { data: file, error: downloadErr } = await store.download(path);
      if (downloadErr || !file) return null;
      try {
        const text = await file.text();
        if (isHeaderOnlyTranscript(text)) return null;
      } catch {
        return null;
      }
      const { data: signed, error } = await store.createSignedUrl(path, 600);
      if (error || !signed?.signedUrl) return null;
      return { path, url: signed.signedUrl, kind };
    }

    const out = [];
    for (const entry of lessons || []) {
      if (!entry || typeof entry.name !== 'string') continue;
      const lessonBase = `${base}/${entry.name}`;
      
      // Prefer TXT, then RTF, fallback to PDF (only if size >= MIN)
      const txt = await tryGetTranscript(lessonBase, 'transcript.txt', 'txt');
      if (txt) {
        out.push({ lessonId: entry.name, ...txt });
      } else {
        const rtf = await tryGetTranscript(lessonBase, 'transcript.rtf', 'rtf');
        if (rtf) {
          out.push({ lessonId: entry.name, ...rtf });
        } else {
          const pdf = await tryGetTranscript(lessonBase, 'transcript.pdf', 'pdf');
          if (pdf) {
            out.push({ lessonId: entry.name, ...pdf });
          }
        }
      }

      // Sessions
      const sessions = await listAll(store, `${lessonBase}/sessions`);
      for (const ses of sessions || []) {
        if (!ses || typeof ses.name !== 'string') continue;
        const sessionBase = `${lessonBase}/sessions/${ses.name}`;
        const stxt = await tryGetTranscript(sessionBase, 'transcript.txt', 'txt');
        if (stxt) {
          out.push({ lessonId: `${entry.name} — ${ses.name}`, ...stxt });
          continue;
        }
        const srtf = await tryGetTranscript(sessionBase, 'transcript.rtf', 'rtf');
        if (srtf) {
          out.push({ lessonId: `${entry.name} — ${ses.name}`, ...srtf });
          continue;
        }
        const spdf = await tryGetTranscript(sessionBase, 'transcript.pdf', 'pdf');
        if (spdf) {
          out.push({ lessonId: `${entry.name} — ${ses.name}`, ...spdf });
        }
      }
    }
    
    // Sort by last session timestamp (newest first)
    out.sort((a, b) => {
      const timeA = a.path.match(/sessions\/r-(\d+)/)?.[1] || '0';
      const timeB = b.path.match(/sessions\/r-(\d+)/)?.[1] || '0';
      return timeB.localeCompare(timeA);
    });
    
    return NextResponse.json({ items: out });
  } catch (e) {
    return NextResponse.json({ items: [], hint: e?.message || 'Unexpected' }, { status: 200 });
  }
}
