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

function tierForPercent(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return null;
  if (n >= 90) return 'gold';
  if (n >= 80) return 'silver';
  if (n >= 70) return 'bronze';
  return null;
}

const TIER_RANK = { none: 0, bronze: 1, silver: 2, gold: 3 };

function isUndefinedColumnOrTable(error) {
  const msg = error?.message || '';
  return (
    error?.code === '42703' || // undefined_column
    error?.code === '42P01' || // undefined_table
    error?.status === 404 ||
    /column .* does not exist/i.test(msg) ||
    /relation .* does not exist/i.test(msg) ||
    /not found/i.test(msg)
  );
}

async function dbGetMedalsForLearner(db, userId, learnerId) {
  const { data, error } = await db
    .from('learner_medals')
    .select('lesson_key, best_percent, medal_tier, updated_at')
    .eq('user_id', userId)
    .eq('learner_id', learnerId);
  if (error) return { data: null, error };
  const out = {};
  for (const r of data || []) {
    out[r.lesson_key] = {
      bestPercent: Number(r.best_percent) || 0,
      medalTier: r.medal_tier || tierForPercent(r.best_percent) || null,
      earnedAt: r.updated_at || null,
    };
  }
  return { data: out, error: null };
}

async function dbUpsertMedal(db, userId, learnerId, lessonKey, percent) {
  // Read current row
  const { data: row, error: readErr } = await db
    .from('learner_medals')
    .select('best_percent, medal_tier')
    .eq('user_id', userId)
    .eq('learner_id', learnerId)
    .eq('lesson_key', lessonKey)
    .maybeSingle();
  if (readErr && readErr.code && readErr.code !== 'PGRST116') return { ok: false, error: readErr };
  const currentTier = row?.medal_tier || (row?.best_percent != null ? tierForPercent(row.best_percent) : null) || null;
  const currentRank = TIER_RANK[currentTier || 'none'] || 0;
  const newTier = tierForPercent(percent);
  const newRank = TIER_RANK[newTier || 'none'] || 0;
  const bestPercent = Math.max(Number(row?.best_percent) || 0, Number(percent) || 0);
  const nextTier = newRank > currentRank ? newTier : currentTier;
  const payload = { user_id: userId, learner_id: learnerId, lesson_key: lessonKey, best_percent: bestPercent, medal_tier: nextTier, updated_at: new Date().toISOString() };
  const { error: upErr } = await db
    .from('learner_medals')
    .upsert(payload, { onConflict: 'user_id,learner_id,lesson_key' });
  if (upErr) return { ok: false, error: upErr };
  return { ok: true };
}

async function ensureBucket(svc, name) {
  try {
    const { data: buckets } = await svc.storage.listBuckets();
    if (!buckets?.some(b => b.name === name)) {
      await svc.storage.createBucket(name, { public: false });
    }
  } catch {}
}

async function storageReadUserMedals(svc, bucket, userId) {
  await ensureBucket(svc, bucket);
  const path = `u/${userId}.json`;
  const { data, error } = await svc.storage.from(bucket).download(path);
  if (error) return {};
  try {
    const text = await data.text();
    const json = JSON.parse(text);
    return json && typeof json === 'object' ? json : {};
  } catch {
    return {};
  }
}

async function storageWriteUserMedals(svc, bucket, userId, payload) {
  await ensureBucket(svc, bucket);
  const path = `u/${userId}.json`;
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  // Try update, then upload with upsert
  const { error: updErr } = await svc.storage.from(bucket).update(path, blob, { contentType: 'application/json', upsert: true });
  if (updErr) {
    await svc.storage.from(bucket).upload(path, blob, { contentType: 'application/json', upsert: true });
  }
}

export async function GET(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    const db = getUserScopedClient(token);
    if (!db) return NextResponse.json({ medals: {} });
    const url = new URL(req.url);
    const learnerId = url.searchParams.get('learner_id') || url.searchParams.get('learnerId');
    if (!learnerId) return NextResponse.json({ medals: {} });

    // Try DB first
    const dbRes = await dbGetMedalsForLearner(db, user.id, learnerId);
    if (!dbRes.error) return NextResponse.json({ medals: dbRes.data || {} });
    if (!isUndefinedColumnOrTable(dbRes.error)) {
      // Soft-fail with empty medals; surface hint for diagnostics
      return NextResponse.json({ medals: {}, hint: dbRes.error?.message || 'DB query error' });
    }

    // Fallback: Supabase Storage per-user JSON
    const { svc } = getClients() || {};
    if (!svc) {
      // Without service role, just return empty so client can fall back locally without errors.
      return NextResponse.json({ medals: {} });
    }
    const all = await storageReadUserMedals(svc, 'learner-medals', user.id);
    const byLearner = (all && typeof all === 'object' ? all[learnerId] : null) || {};
    const normalized = {};
    for (const [lessonKey, medal] of Object.entries(byLearner)) {
      normalized[lessonKey] = {
        bestPercent: Number(medal?.bestPercent) || 0,
        medalTier: medal?.medalTier || null,
        earnedAt: medal?.earnedAt || medal?.updatedAt || null,
      };
    }
    return NextResponse.json({ medals: normalized, fallback: 'storage' });
  } catch (e) {
    // Soft-fail: provide empty medals and a hint; avoids console 500s
    return NextResponse.json({ medals: {}, hint: e?.message || 'Unexpected error' });
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    const db = getUserScopedClient(token);
    if (!db) return NextResponse.json({ error: 'Supabase env not configured' }, { status: 503 });
    const body = await req.json().catch(() => ({}));
    const learner_id = typeof body?.learner_id === 'string' && body.learner_id ? body.learner_id : null;
    const lesson_key = typeof body?.lesson_key === 'string' && body.lesson_key ? body.lesson_key : null;
    const percent = Number(body?.percent ?? body?.best_percent);
    if (!learner_id || !lesson_key || !Number.isFinite(percent)) {
      return NextResponse.json({ error: 'learner_id, lesson_key, percent required' }, { status: 400 });
    }

    // Try DB first
    const res = await dbUpsertMedal(db, user.id, learner_id, lesson_key, percent);
    if (res.ok) return NextResponse.json({ ok: true });
    if (!isUndefinedColumnOrTable(res.error)) {
      // Soft-fail so client can persist locally without surfacing errors in UI
      return NextResponse.json({ ok: true, hint: res.error?.message || 'Upsert error (soft)' });
    }

    // Fallback storage
    const { svc } = getClients() || {};
    if (!svc) {
      // Without service role, signal success so client can rely on local fallback without errors.
      return NextResponse.json({ ok: true, fallback: 'client-local' });
    }
    const all = await storageReadUserMedals(svc, 'learner-medals', user.id);
    const byLearner = (all && typeof all === 'object' ? all[learner_id] : null) || {};
    const current = byLearner[lesson_key] || { bestPercent: 0, medalTier: null, earnedAt: null };
    const newTier = tierForPercent(percent);
    const currentRank = TIER_RANK[current.medalTier || 'none'] || 0;
    const newRank = TIER_RANK[newTier || 'none'] || 0;
    const nextTier = newRank > currentRank ? newTier : current.medalTier;
    const bestPercent = Math.max(Number(current.bestPercent) || 0, Number(percent) || 0);
    let earnedAt = current?.earnedAt || null;
    if (bestPercent > (Number(current.bestPercent) || 0) || nextTier !== current.medalTier) {
      earnedAt = new Date().toISOString();
    }
    byLearner[lesson_key] = { bestPercent, medalTier: nextTier || null, earnedAt };
    all[learner_id] = byLearner;
    await storageWriteUserMedals(svc, 'learner-medals', user.id, all);
    return NextResponse.json({ ok: true, fallback: 'storage' });
  } catch (e) {
    // Soft-fail; let client store locally
    return NextResponse.json({ ok: true, hint: e?.message || 'Unexpected error (soft)' });
  }
}
