import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handoffFallbackReady, isStrictlyNewerSnapshot, newestSnapshot, rehomeSnapshotForTakeover, snapshotLessonMatchesExecution, snapshotMatchesScope, snapshotUpdatedAtMs } from '../../lib/snapshotTakeoverHandoff.mjs';

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
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data: data?.data || null, error: null };
}

async function dbUpsertSnapshot(db, userId, learnerId, lessonKey, payload) {
  const row = { user_id: userId, learner_id: learnerId, lesson_key: lessonKey, data: payload, updated_at: new Date().toISOString() };
  const { error } = await db
    .from('learner_snapshots')
    .upsert(row, { onConflict: 'user_id,learner_id,lesson_key', ignoreDuplicates: false });
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

function normalizeUuid(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null;
}

async function verifySnapshotExecutionOwner(svc, { learnerId, executionSessionId, browserSessionId, allowCompleted = false } = {}) {
  const rowId = normalizeUuid(executionSessionId);
  const browserId = normalizeUuid(browserSessionId);
  if (!svc || !learnerId || !rowId || !browserId) {
    return { ok: false, state: 'identity_invalid', endedReason: null, session: null };
  }
  const { data, error } = await svc
    .from('lesson_sessions')
    .select('id, learner_id, session_id, ended_at, ended_reason')
    .eq('id', rowId)
    .eq('learner_id', learnerId)
    .maybeSingle();
  if (error || !data) return { ok: false, state: 'session_missing', endedReason: null, session: null };
  if (data.session_id !== browserId) {
    return { ok: false, state: 'ownership_mismatch', endedReason: data.ended_reason || null, session: data };
  }
  if (data.ended_at == null) return { ok: true, state: 'active', endedReason: null, session: data };
  if (allowCompleted && data.ended_reason === 'completed') {
    return { ok: true, state: 'completed', endedReason: 'completed', session: data };
  }
  return { ok: false, state: 'ended', endedReason: data.ended_reason || 'ended', session: data };
}

function snapshotOwnershipLost(result) {
  return NextResponse.json({
    ok: false,
    code: 'SNAPSHOT_OWNERSHIP_LOST',
    state: result?.state || 'ownership_lost',
    endedReason: result?.endedReason || null,
  }, { status: 409 });
}
function normalizeSnapshotShape(obj) {
  const out = obj && typeof obj === 'object' ? { ...obj } : {};
  out.savedAt = new Date().toISOString();
  return out;
}

async function readDurableSnapshot({ db, svc, userId, learnerId, lessonKey }) {
  const current = await dbGetSnapshot(db, userId, learnerId, lessonKey);
  if (!current.error) return current.data || null;
  if (!isUndefinedColumnOrTable(current.error) || !svc) return null;
  const allForLearner = await storageReadSnapshotsForLearner(svc, 'learner-snapshots', userId, learnerId);
  return allForLearner?.[lessonKey] || null;
}

async function writeDurableSnapshot({ db, svc, userId, learnerId, lessonKey, snapshot }) {
  const payload = normalizeSnapshotShape(snapshot);
  const up = await dbUpsertSnapshot(db, userId, learnerId, lessonKey, payload);
  if (up.ok) return { ok: true, snapshot: payload, storage: 'db' };
  if (!isUndefinedColumnOrTable(up.error) || !svc) return { ok: false, error: up.error || new Error('Snapshot persistence unavailable') };
  const allForLearner = await storageReadSnapshotsForLearner(svc, 'learner-snapshots', userId, learnerId);
  const byLesson = allForLearner && typeof allForLearner === 'object' ? allForLearner : {};
  byLesson[lessonKey] = payload;
  await storageWriteSnapshotsForLearner(svc, 'learner-snapshots', userId, learnerId, byLesson);
  return { ok: true, snapshot: payload, storage: 'storage' };
}

async function userOwnsSnapshotLearner(db, learnerId) {
  try {
    const { data, error } = await db.from('learners').select('id').eq('id', learnerId).maybeSingle();
    return !error && String(data?.id || '') === String(learnerId || '');
  } catch {
    return false;
  }
}

async function loadSnapshotHandoffBySource(svc, { sourceExecutionSessionId, sourceBrowserSessionId }) {
  if (!svc) return null;
  const sourceId = normalizeUuid(sourceExecutionSessionId);
  const browserId = normalizeUuid(sourceBrowserSessionId);
  if (!sourceId || !browserId) return null;
  const { data, error } = await svc.from('lesson_snapshot_handoffs')
    .select('*')
    .eq('source_execution_session_id', sourceId)
    .eq('source_browser_session_id', browserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return error ? null : data;
}

async function loadSnapshotHandoffById(svc, handoffId) {
  const id = normalizeUuid(handoffId);
  if (!svc || !id) return null;
  const { data, error } = await svc.from('lesson_snapshot_handoffs').select('*').eq('id', id).maybeSingle();
  return error ? null : data;
}

async function verifySnapshotHandoffSessions(svc, handoff) {
  if (!svc || !handoff) return { ok: false, state: 'handoff_missing' };
  const [{ data: source, error: sourceError }, { data: target, error: targetError }] = await Promise.all([
    svc.from('lesson_sessions').select('id, learner_id, lesson_id, session_id, instructional_teacher, ended_at, ended_reason').eq('id', handoff.source_execution_session_id).maybeSingle(),
    svc.from('lesson_sessions').select('id, learner_id, lesson_id, session_id, instructional_teacher, ended_at, ended_reason').eq('id', handoff.target_execution_session_id).maybeSingle(),
  ]);
  if (sourceError || targetError || !source || !target) return { ok: false, state: 'session_missing' };
  const scopeMatches = String(source.learner_id) === String(handoff.learner_id)
    && String(target.learner_id) === String(handoff.learner_id)
    && String(source.lesson_id) === String(handoff.lesson_id)
    && String(target.lesson_id) === String(handoff.lesson_id)
    && String(source.session_id) === String(handoff.source_browser_session_id)
    && String(target.session_id) === String(handoff.target_browser_session_id)
    && source.instructional_teacher === handoff.instructional_teacher
    && target.instructional_teacher === handoff.instructional_teacher;
  if (!scopeMatches) return { ok: false, state: 'scope_mismatch' };
  if (source.ended_at == null || source.ended_reason !== 'taken_over') return { ok: false, state: 'source_not_taken_over' };
  if (target.ended_at != null) return { ok: false, state: 'target_no_longer_active', endedReason: target.ended_reason || 'ended' };
  return { ok: true, source, target };
}

async function handleSnapshotHandoff({ body, user, db, svc }) {
  const action = String(body?.handoff_action || '').trim();
  const learnerId = typeof body?.learner_id === 'string' ? body.learner_id : '';
  const lessonKey = typeof body?.lesson_key === 'string' ? body.lesson_key : '';
  if (!learnerId || !lessonKey || !svc) {
    return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_UNAVAILABLE' }, { status: 503 });
  }
  if (!await userOwnsSnapshotLearner(db, learnerId)) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 });
  }

  if (action === 'source_offer') {
    const sourceExecutionSessionId = normalizeUuid(body?.source_execution_session_id);
    const sourceBrowserSessionId = normalizeUuid(body?.source_browser_session_id);
    const candidate = body?.data && typeof body.data === 'object' ? body.data : null;
    const handoff = await loadSnapshotHandoffBySource(svc, { sourceExecutionSessionId, sourceBrowserSessionId });
    if (!handoff || String(handoff.learner_id) !== learnerId || !snapshotLessonMatchesExecution(lessonKey, handoff.lesson_id)) {
      return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_NOT_FOUND' }, { status: 404 });
    }
    if (['claimed', 'fallback_claimed'].includes(handoff.state)) {
      return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_ALREADY_CLAIMED', state: handoff.state }, { status: 409 });
    }
    const ownership = await verifySnapshotHandoffSessions(svc, handoff);
    if (!ownership.ok) return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_OWNERSHIP_LOST', state: ownership.state }, { status: 409 });
    if (!snapshotMatchesScope(candidate, { learnerId, lessonKey, browserSessionId: handoff.source_browser_session_id })) {
      return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_SOURCE_INVALID' }, { status: 400 });
    }
    const durable = await readDurableSnapshot({ db, svc, userId: user.id, learnerId, lessonKey });
    const durableSource = snapshotMatchesScope(durable, { learnerId, lessonKey, browserSessionId: handoff.source_browser_session_id }) ? durable : null;
    const freshest = newestSnapshot(candidate, durableSource);
    const { error } = await svc.from('lesson_snapshot_handoffs').update({
      state: 'source_ready',
      source_snapshot: freshest,
      source_snapshot_updated_at: new Date(snapshotUpdatedAtMs(freshest) || Date.now()).toISOString(),
      source_ready_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', handoff.id).in('state', ['pending', 'source_ready']);
    if (error) return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_STORE_FAILED' }, { status: 500 });
    return NextResponse.json({ ok: true, state: 'source_ready', handoffId: handoff.id });
  }

  if (action === 'target_claim') {
    const handoff = await loadSnapshotHandoffById(svc, body?.handoff_id);
    const targetExecutionSessionId = normalizeUuid(body?.target_execution_session_id);
    const targetBrowserSessionId = normalizeUuid(body?.target_browser_session_id);
    if (!handoff || String(handoff.learner_id) !== learnerId || !snapshotLessonMatchesExecution(lessonKey, handoff.lesson_id)) {
      return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_NOT_FOUND' }, { status: 404 });
    }
    if (handoff.target_execution_session_id !== targetExecutionSessionId || handoff.target_browser_session_id !== targetBrowserSessionId) {
      return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_TARGET_MISMATCH' }, { status: 409 });
    }
    const ownership = await verifySnapshotHandoffSessions(svc, handoff);
    if (!ownership.ok) return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_OWNERSHIP_LOST', state: ownership.state }, { status: 409 });

    const existing = await readDurableSnapshot({ db, svc, userId: user.id, learnerId, lessonKey });
    if (['claimed', 'fallback_claimed'].includes(handoff.state)
      && snapshotMatchesScope(existing, { learnerId, lessonKey, browserSessionId: targetBrowserSessionId })) {
      return NextResponse.json({ ok: true, state: handoff.state, snapshot: existing, handoffId: handoff.id });
    }

    const durableSource = snapshotMatchesScope(existing, {
      learnerId,
      lessonKey,
      browserSessionId: handoff.source_browser_session_id,
    }) ? existing : null;
    const sharedLocalCandidate = body?.data && snapshotMatchesScope(body.data, {
      learnerId,
      lessonKey,
      browserSessionId: handoff.source_browser_session_id,
    }) ? body.data : null;
    const sharedLocal = sharedLocalCandidate && isStrictlyNewerSnapshot(sharedLocalCandidate, durableSource)
      ? sharedLocalCandidate
      : null;
    let source = handoff.state === 'source_ready' && snapshotMatchesScope(handoff.source_snapshot, {
      learnerId,
      lessonKey,
      browserSessionId: handoff.source_browser_session_id,
    }) ? handoff.source_snapshot : null;
    let claimSource = source ? 'source_device' : null;
    if (!source && sharedLocal) {
      source = sharedLocal;
      claimSource = 'shared_local_cache';
    }
    if (!source && body?.allow_fallback === true && handoffFallbackReady(handoff.created_at)) {
      if (durableSource) {
        source = durableSource;
        claimSource = 'durable_fallback';
      }
    }
    if (!source) {
      return NextResponse.json({ ok: true, state: 'pending', handoffId: handoff.id });
    }

    const rehomed = rehomeSnapshotForTakeover(source, {
      targetBrowserSessionId,
      sourceExecutionSessionId: handoff.source_execution_session_id,
      targetExecutionSessionId: handoff.target_execution_session_id,
      claimSource,
    });
    const persisted = await writeDurableSnapshot({ db, svc, userId: user.id, learnerId, lessonKey, snapshot: rehomed });
    if (!persisted.ok) return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_PERSIST_FAILED' }, { status: 500 });
    const terminalState = claimSource === 'durable_fallback' ? 'fallback_claimed' : 'claimed';
    const { error } = await svc.from('lesson_snapshot_handoffs').update({
      state: terminalState,
      source_snapshot: null,
      claim_source: claimSource,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', handoff.id).in('state', ['pending', 'source_ready']);
    if (error) return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_FINALIZE_FAILED' }, { status: 500 });
    return NextResponse.json({ ok: true, state: terminalState, snapshot: persisted.snapshot, handoffId: handoff.id, claimSource });
  }

  return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_ACTION_INVALID' }, { status: 400 });
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
    const body = await req.json().catch(() => ({}));
    if (!db) {
      if (body?.handoff_action) {
        return NextResponse.json({ ok: false, code: 'SNAPSHOT_HANDOFF_UNAVAILABLE' }, { status: 503 });
      }
      return NextResponse.json({ ok: true, hint: 'Supabase env not configured (soft)' });
    }
    const { svc: handoffService } = getClients() || {};
    if (body?.handoff_action) {
      try {
        return await handleSnapshotHandoff({ body, user, db, svc: handoffService });
      } catch (handoffError) {
        return NextResponse.json({
          ok: false,
          code: 'SNAPSHOT_HANDOFF_FAILED',
          error: handoffError?.message || 'Snapshot handoff failed',
        }, { status: 500 });
      }
    }
    const learner_id = typeof body?.learner_id === 'string' && body.learner_id ? body.learner_id : null;
    const lesson_key = typeof body?.lesson_key === 'string' && body.lesson_key ? body.lesson_key : null;
    const data = body?.data && typeof body.data === 'object' ? body.data : null;
    const requireExecutionOwner = body?.require_execution_owner === true;
    const executionSessionId = body?.execution_session_id;
    const browserSessionId = body?.browser_session_id;
    if (!learner_id || !lesson_key || !data) {
      return NextResponse.json({ error: 'learner_id, lesson_key, data required' }, { status: 400 });
    }
    if (requireExecutionOwner) {
      const { svc } = getClients() || {};
      if (!svc) {
        return NextResponse.json({ ok: false, code: 'SNAPSHOT_OWNERSHIP_UNAVAILABLE' }, { status: 503 });
      }
      const ownership = await verifySnapshotExecutionOwner(svc, {
        learnerId: learner_id,
        executionSessionId,
        browserSessionId,
      });
      if (!ownership.ok) return snapshotOwnershipLost(ownership);
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
    const requireExecutionOwner = url.searchParams.get('require_execution_owner') === '1';
    const executionSessionId = url.searchParams.get('execution_session_id');
    const browserSessionId = url.searchParams.get('browser_session_id');
    if (!learnerId || !lessonKey) return NextResponse.json({ ok: true });

    if (requireExecutionOwner) {
      const { svc } = getClients() || {};
      if (!svc) {
        return NextResponse.json({ ok: false, code: 'SNAPSHOT_OWNERSHIP_UNAVAILABLE' }, { status: 503 });
      }
      const ownership = await verifySnapshotExecutionOwner(svc, {
        learnerId,
        executionSessionId,
        browserSessionId,
        allowCompleted: true,
      });
      if (!ownership.ok) return snapshotOwnershipLost(ownership);

      // A completed execution may delete only the snapshot it actually produced.
      // If a newer execution already saved progress under the lesson-scoped key,
      // preserve that newer snapshot instead of letting completion cleanup erase it.
      if (ownership.state === 'completed') {
        const current = await dbGetSnapshot(db, user.id, learnerId, lessonKey);
        const currentBrowserId = current?.data?.sessionId || null;
        if (!current.error && currentBrowserId && currentBrowserId !== normalizeUuid(browserSessionId)) {
          return snapshotOwnershipLost({ state: 'newer_snapshot_present', endedReason: 'completed' });
        }
      }
    }
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
