import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'transcripts';
const VROOT = 'v1';

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
  // If no service role, try user-scoped client
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.split(' ')[1] : null;
  const client = svc || (token ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } }) : null);
  if (!client) return NextResponse.json({ items: [] });
    const learnerId = (await params)?.id;
    if (!learnerId) return NextResponse.json({ items: [] });
  const store = client.storage.from(BUCKET);
    const base = `${VROOT}/${user.id}/${learnerId}`;
    const { data: lessons } = await store.list(base, { limit: 200, offset: 0 });
    const out = [];
    for (const entry of lessons || []) {
      if (!entry || typeof entry.name !== 'string') continue;
      const lessonBase = `${base}/${entry.name}`;
      // Prefer TXT, then RTF, fallback to PDF
      const txtPath = `${lessonBase}/transcript.txt`;
      const { data: stxt, error: etxt } = await store.createSignedUrl(txtPath, 600);
      if (!etxt && stxt?.signedUrl) {
        out.push({ lessonId: entry.name, path: txtPath, url: stxt.signedUrl, kind: 'txt' });
      } else {
        const rtfPath = `${lessonBase}/transcript.rtf`;
        const { data: srtf, error: ertf } = await store.createSignedUrl(rtfPath, 600);
        if (!ertf && srtf?.signedUrl) {
          out.push({ lessonId: entry.name, path: rtfPath, url: srtf.signedUrl, kind: 'rtf' });
        } else {
          const pdfPath = `${lessonBase}/transcript.pdf`;
          const { data: spdf, error: epdf } = await store.createSignedUrl(pdfPath, 600);
          if (!epdf && spdf?.signedUrl) {
            out.push({ lessonId: entry.name, path: pdfPath, url: spdf.signedUrl, kind: 'pdf' });
          }
        }
      }
      // Sessions
      const { data: sessions } = await store.list(`${lessonBase}/sessions`, { limit: 200, offset: 0 });
      for (const ses of sessions || []) {
        if (!ses || typeof ses.name !== 'string') continue;
        const stxtPath = `${lessonBase}/sessions/${ses.name}/transcript.txt`;
        const { data: s1, error: e1 } = await store.createSignedUrl(stxtPath, 600);
        if (!e1 && s1?.signedUrl) {
          out.push({ lessonId: `${entry.name} — ${ses.name}`, path: stxtPath, url: s1.signedUrl, kind: 'txt' });
          continue;
        }
        const srtfPath = `${lessonBase}/sessions/${ses.name}/transcript.rtf`;
        const { data: s2, error: e2 } = await store.createSignedUrl(srtfPath, 600);
        if (!e2 && s2?.signedUrl) {
          out.push({ lessonId: `${entry.name} — ${ses.name}`, path: srtfPath, url: s2.signedUrl, kind: 'rtf' });
          continue;
        }
        const spdfPath = `${lessonBase}/sessions/${ses.name}/transcript.pdf`;
        const { data: s3, error: e3 } = await store.createSignedUrl(spdfPath, 600);
        if (!e3 && s3?.signedUrl) {
          out.push({ lessonId: `${entry.name} — ${ses.name}`, path: spdfPath, url: s3.signedUrl, kind: 'pdf' });
        }
      }
    }
    out.sort((a, b) => a.lessonId.localeCompare(b.lessonId));
    return NextResponse.json({ items: out });
  } catch (e) {
    return NextResponse.json({ items: [], hint: e?.message || 'Unexpected' }, { status: 200 });
  }
}
