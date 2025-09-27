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

async function storageReadAssessmentsForLearner(svc, bucket, userId, learnerId) {
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

async function storageWriteAssessmentsForLearner(svc, bucket, userId, learnerId, payload) {
  await ensureBucket(svc, bucket);
  const path = `u/${userId}/l/${learnerId}.json`;
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const { error: updErr } = await svc.storage.from(bucket).update(path, blob, { contentType: 'application/json', upsert: true });
  if (updErr) {
    await svc.storage.from(bucket).upload(path, blob, { contentType: 'application/json', upsert: true });
  }
}

async function dbGetAssessments(db, userId, learnerId, lessonKey) {
  const { data, error } = await db
    .from('learner_assessments')
    .select('data')
    .eq('user_id', userId)
    .eq('learner_id', learnerId)
    .eq('lesson_key', lessonKey)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data: data?.data || null, error: null };
}

async function dbUpsertAssessments(db, userId, learnerId, lessonKey, payload) {
  const row = { user_id: userId, learner_id: learnerId, lesson_key: lessonKey, data: payload, updated_at: new Date().toISOString() };
  const { error } = await db
    .from('learner_assessments')
    .upsert(row, { onConflict: 'user_id,learner_id,lesson_key' });
  if (error) return { ok: false, error };
  return { ok: true };
}

async function dbDeleteAssessments(db, userId, learnerId, lessonKey) {
  const { error } = await db
    .from('learner_assessments')
    .delete()
    .eq('user_id', userId)
    .eq('learner_id', learnerId)
    .eq('lesson_key', lessonKey);
  if (error) return { ok: false, error };
  return { ok: true };
}

export async function GET(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    const db = getUserScopedClient(token);
    if (!db) return NextResponse.json({ assessments: null });
    const url = new URL(req.url);
    const learnerId = url.searchParams.get('learner_id') || url.searchParams.get('learnerId');
    const lessonKey = url.searchParams.get('lesson_key') || url.searchParams.get('lessonKey');
    if (!learnerId || !lessonKey) return NextResponse.json({ assessments: null });

    // Try DB first
    const res = await dbGetAssessments(db, user.id, learnerId, lessonKey);
    if (!res.error) return NextResponse.json({ assessments: res.data || null });
    if (!isUndefinedColumnOrTable(res.error)) {
      return NextResponse.json({ assessments: null, hint: res.error?.message || 'DB query error' });
    }

    // Fallback: per-user storage JSON keyed by learnerId then lessonKey
    const { svc } = getClients() || {};
    if (!svc) return NextResponse.json({ assessments: null });
    const allForLearner = await storageReadAssessmentsForLearner(svc, 'learner-assessments', user.id, learnerId);
    const byLesson = (allForLearner && typeof allForLearner === 'object') ? allForLearner : {};
    const payload = byLesson[lessonKey] || null;
    return NextResponse.json({ assessments: payload, fallback: 'storage' });
  } catch (e) {
    return NextResponse.json({ assessments: null, hint: e?.message || 'Unexpected error' });
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
    // Enforce shape and timestamp server-side
    const payload = {
      worksheet: Array.isArray(data.worksheet) ? data.worksheet : [],
      test: Array.isArray(data.test) ? data.test : [],
      comprehension: Array.isArray(data.comprehension) ? data.comprehension : [],
      exercise: Array.isArray(data.exercise) ? data.exercise : [],
      savedAt: new Date().toISOString()
    };

    const up = await dbUpsertAssessments(db, user.id, learner_id, lesson_key, payload);
    if (up.ok) return NextResponse.json({ ok: true });
    if (!isUndefinedColumnOrTable(up.error)) {
      return NextResponse.json({ ok: true, hint: up.error?.message || 'Upsert error (soft)' });
    }

    // Fallback to storage
    const { svc } = getClients() || {};
    if (!svc) return NextResponse.json({ ok: true, fallback: 'client-local' });
    const allForLearner = await storageReadAssessmentsForLearner(svc, 'learner-assessments', user.id, learner_id);
    const byLesson = (allForLearner && typeof allForLearner === 'object') ? allForLearner : {};
    byLesson[lesson_key] = payload;
    await storageWriteAssessmentsForLearner(svc, 'learner-assessments', user.id, learner_id, byLesson);
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

    const del = await dbDeleteAssessments(db, user.id, learnerId, lessonKey);
    if (del.ok) return NextResponse.json({ ok: true });
    if (!isUndefinedColumnOrTable(del.error)) {
      return NextResponse.json({ ok: true, hint: del.error?.message || 'Delete error (soft)' });
    }

    // Fallback storage delete
    const { svc } = getClients() || {};
    if (!svc) return NextResponse.json({ ok: true });
    const allForLearner = await storageReadAssessmentsForLearner(svc, 'learner-assessments', user.id, learnerId);
    if (allForLearner && typeof allForLearner === 'object') {
      delete allForLearner[lessonKey];
      await storageWriteAssessmentsForLearner(svc, 'learner-assessments', user.id, learnerId, allForLearner);
    }
    return NextResponse.json({ ok: true, fallback: 'storage' });
  } catch (e) {
    return NextResponse.json({ ok: true, hint: e?.message || 'Unexpected error (soft)' });
  }
}
