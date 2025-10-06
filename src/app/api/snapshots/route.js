import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

// --- Transcript helpers (server-side, service role) ---
const TRANSCRIPTS_BUCKET = 'transcripts';
const TRANSCRIPTS_VERSION = 'v1';

function captionsToPlainText({ lessonKey, learnerId, captionSentences }) {
  const lines = [];
  lines.push(`${lessonKey} — Transcript`);
  lines.push(`Learner ID: ${learnerId}`);
  lines.push('');
  const seg = Array.isArray(captionSentences) ? captionSentences : [];
  for (const ln of seg) {
    const role = (ln?.role || '').toLowerCase() === 'user' ? 'Learner' : 'Ms. Sonoma';
    const text = typeof ln?.text === 'string' ? ln.text : (typeof ln === 'string' ? ln : '');
    if (text) lines.push(`${role}: ${text}`);
  }
  return lines.join('\n');
}

function escapeRtf(text = '') {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\r?\n/g, '\\par ');
}

function captionsToRtf({ lessonKey, learnerId, captionSentences }) {
  const header = '{\\rtf1\\ansi\\deff0\n';
  const parts = [];
  parts.push(escapeRtf(`${lessonKey} — Transcript`));
  parts.push('\\par ');
  parts.push(escapeRtf(`Learner ID: ${learnerId}`));
  parts.push('\\par \\par ');
  const seg = Array.isArray(captionSentences) ? captionSentences : [];
  for (const ln of seg) {
    const role = (ln?.role || '').toLowerCase() === 'user' ? 'Learner' : 'Ms. Sonoma';
    const text = typeof ln?.text === 'string' ? ln.text : (typeof ln === 'string' ? ln : '');
    if (text) {
      parts.push(escapeRtf(`${role}: ${text}`));
      parts.push('\\par ');
    }
  }
  return `${header}${parts.join('')}}`;
}

async function writeTranscriptArtifacts({ client, ensure, ownerId, learnerId, lessonKey, payload }) {
  if (!client || !ownerId || !learnerId || !lessonKey) return;
  try {
    if (ensure) {
      try { await ensureBucket(ensure, TRANSCRIPTS_BUCKET); } catch {}
    }
    const base = `${TRANSCRIPTS_VERSION}/${ownerId}/${learnerId}/${lessonKey}`;
    const txtPath = `${base}/transcript.txt`;
    const rtfPath = `${base}/transcript.rtf`;
    const txt = captionsToPlainText({ lessonKey, learnerId, captionSentences: payload?.captionSentences });
    const rtf = captionsToRtf({ lessonKey, learnerId, captionSentences: payload?.captionSentences });
    // Prefer update; fall back to upload
    const txtBlob = new Blob([txt], { type: 'text/plain; charset=utf-8' });
    const rtfBlob = new Blob([rtf], { type: 'application/rtf' });
    const store = client.storage.from(TRANSCRIPTS_BUCKET);
    await store.update(txtPath, txtBlob, { contentType: 'text/plain; charset=utf-8', upsert: true }).catch(async () => {
      await store.upload(txtPath, txtBlob, { contentType: 'text/plain; charset=utf-8', upsert: true });
    });
    await store.update(rtfPath, rtfBlob, { contentType: 'application/rtf', upsert: true }).catch(async () => {
      await store.upload(rtfPath, rtfBlob, { contentType: 'application/rtf', upsert: true });
    });
  } catch {
    // soft-fail; transcripts are best-effort
  }
}

function getUserScopedClient(token) {
  const { url, anon } = getEnv();
  if (!url || !anon || !token) return null;
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
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

function isUndefinedColumnOrTable(error) {
  const msg = error?.message || '';
  return (
    error?.code === '42703' || // undefined_column
    error?.code === '42P01' || // undefined_table
    error?.status === 404 ||
    /column .* does not exist/i.test(msg) ||
    /relation .* does not exist/i.test(msg) ||
    /not found/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

async function ensureBucket(svc, name) {
  try {
    const { data: buckets } = await svc.storage.listBuckets();
    if (!buckets?.some(b => b.name === name)) {
      await svc.storage.createBucket(name, { public: false });
    }
  } catch {}
}

async function storageReadSnapshotsForLearner(svc, bucket, userId, learnerId) {
  await ensureBucket(svc, bucket);
  const path = `u/${userId}/l/${learnerId}.json`;
  const { data, error } = await svc.storage.from(bucket).download(path);
  if (error) return {};
  try {
    const text = await data.text();
    const json = JSON.parse(text);
    return json && typeof json === 'object' ? json : {};
  } catch { return {}; }
}

async function storageWriteSnapshotsForLearner(svc, bucket, userId, learnerId, payload) {
  await ensureBucket(svc, bucket);
  const path = `u/${userId}/l/${learnerId}.json`;
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const { error: updErr } = await svc.storage.from(bucket).update(path, blob, { contentType: 'application/json', upsert: true });
  if (updErr) {
    await svc.storage.from(bucket).upload(path, blob, { contentType: 'application/json', upsert: true });
  }
}

async function dbGetSnapshot(db, userId, learnerId, lessonKey) {
  const { data, error } = await db
    .from('learner_snapshots')
    .select('data')
    .eq('user_id', userId)
    .eq('learner_id', learnerId)
    .eq('lesson_key', lessonKey)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data: data?.data || null, error: null };
}

async function dbUpsertSnapshot(db, userId, learnerId, lessonKey, payload) {
  const row = { user_id: userId, learner_id: learnerId, lesson_key: lessonKey, data: payload, updated_at: new Date().toISOString() };
  const { error } = await db
    .from('learner_snapshots')
    .upsert(row, { onConflict: 'user_id,learner_id,lesson_key' });
  if (error) return { ok: false, error };
  return { ok: true };
}

async function dbDeleteSnapshot(db, userId, learnerId, lessonKey) {
  const { error } = await db
    .from('learner_snapshots')
    .delete()
    .eq('user_id', userId)
    .eq('learner_id', learnerId)
    .eq('lesson_key', lessonKey);
  if (error) return { ok: false, error };
  return { ok: true };
}

function normalizeSnapshotShape(obj) {
  const out = obj && typeof obj === 'object' ? { ...obj } : {};
  out.savedAt = new Date().toISOString();
  return out;
}

export async function GET(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    const db = getUserScopedClient(token);
    if (!db) return NextResponse.json({ snapshot: null });
    const url = new URL(req.url);
    const learnerId = url.searchParams.get('learner_id') || url.searchParams.get('learnerId');
    const lessonKey = url.searchParams.get('lesson_key') || url.searchParams.get('lessonKey');
    if (!learnerId || !lessonKey) return NextResponse.json({ snapshot: null });

    // Try DB
    const res = await dbGetSnapshot(db, user.id, learnerId, lessonKey);
    if (!res.error) return NextResponse.json({ snapshot: res.data || null });
    if (!isUndefinedColumnOrTable(res.error)) {
      return NextResponse.json({ snapshot: null, hint: res.error?.message || 'DB query error' });
    }

    // Fallback: storage
    const { svc } = getClients() || {};
    if (!svc) return NextResponse.json({ snapshot: null });
    const allForLearner = await storageReadSnapshotsForLearner(svc, 'learner-snapshots', user.id, learnerId);
    const byLesson = (allForLearner && typeof allForLearner === 'object') ? allForLearner : {};
    const payload = byLesson[lessonKey] || null;
    return NextResponse.json({ snapshot: payload, fallback: 'storage' });
  } catch (e) {
    return NextResponse.json({ snapshot: null, hint: e?.message || 'Unexpected error' });
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    const db = getUserScopedClient(token);
    if (!db) return NextResponse.json({ ok: true, hint: 'Supabase env not configured (soft)' });
    const body = await req.json().catch(() => ({}));
    const learner_id = typeof body?.learner_id === 'string' && body.learner_id ? body.learner_id : null;
    const lesson_key = typeof body?.lesson_key === 'string' && body.lesson_key ? body.lesson_key : null;
    const data = body?.data && typeof body.data === 'object' ? body.data : null;
    if (!learner_id || !lesson_key || !data) {
      return NextResponse.json({ error: 'learner_id, lesson_key, data required' }, { status: 400 });
    }
    const payload = normalizeSnapshotShape(data);

    const up = await dbUpsertSnapshot(db, user.id, learner_id, lesson_key, payload);
    if (up.ok) {
      const { svc } = getClients() || {};
      if (svc) {
        await writeTranscriptArtifacts({ client: svc, ensure: svc, ownerId: user.id, learnerId: learner_id, lessonKey: lesson_key, payload });
      } else if (token) {
        const scoped = getUserScopedClient(token);
        if (scoped) await writeTranscriptArtifacts({ client: scoped, ensure: null, ownerId: user.id, learnerId: learner_id, lessonKey: lesson_key, payload });
      }
      return NextResponse.json({ ok: true });
    }
    if (!isUndefinedColumnOrTable(up.error)) {
      return NextResponse.json({ ok: true, hint: up.error?.message || 'Upsert error (soft)' });
    }

    // Fallback to storage
    const { svc } = getClients() || {};
    if (!svc) {
      // No service: cannot write storage fallback snapshot; skip to best-effort transcript write with user token
      if (token) {
        const scoped = getUserScopedClient(token);
        if (scoped) await writeTranscriptArtifacts({ client: scoped, ensure: null, ownerId: user.id, learnerId: learner_id, lessonKey: lesson_key, payload });
      }
      return NextResponse.json({ ok: true, fallback: 'client-local' });
    }
    const allForLearner = await storageReadSnapshotsForLearner(svc, 'learner-snapshots', user.id, learner_id);
    const byLesson = (allForLearner && typeof allForLearner === 'object') ? allForLearner : {};
    byLesson[lesson_key] = payload;
    await storageWriteSnapshotsForLearner(svc, 'learner-snapshots', user.id, learner_id, byLesson);
    // Also write transcript artifacts best-effort
    await writeTranscriptArtifacts({ client: svc, ensure: svc, ownerId: user.id, learnerId: learner_id, lessonKey: lesson_key, payload });
    return NextResponse.json({ ok: true, fallback: 'storage' });
  } catch (e) {
    return NextResponse.json({ ok: true, hint: e?.message || 'Unexpected error (soft)' });
  }
}

export async function DELETE(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    const db = getUserScopedClient(token);
    if (!db) return NextResponse.json({ ok: true });
    const url = new URL(req.url);
    const learnerId = url.searchParams.get('learner_id') || url.searchParams.get('learnerId');
    const lessonKey = url.searchParams.get('lesson_key') || url.searchParams.get('lessonKey');
    if (!learnerId || !lessonKey) return NextResponse.json({ ok: true });

    const del = await dbDeleteSnapshot(db, user.id, learnerId, lessonKey);
    if (del.ok) return NextResponse.json({ ok: true });
    if (!isUndefinedColumnOrTable(del.error)) {
      return NextResponse.json({ ok: true, hint: del.error?.message || 'Delete error (soft)' });
    }

    const { svc } = getClients() || {};
    if (!svc) return NextResponse.json({ ok: true });
    const allForLearner = await storageReadSnapshotsForLearner(svc, 'learner-snapshots', user.id, learnerId);
    if (allForLearner && typeof allForLearner === 'object') {
      delete allForLearner[lessonKey];
      await storageWriteSnapshotsForLearner(svc, 'learner-snapshots', user.id, learnerId, allForLearner);
    }
    return NextResponse.json({ ok: true, fallback: 'storage' });
  } catch (e) {
    return NextResponse.json({ ok: true, hint: e?.message || 'Unexpected error (soft)' });
  }
}
