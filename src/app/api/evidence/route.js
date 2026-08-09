import { NextResponse } from 'next/server.js';
import { createClient } from '@supabase/supabase-js';
import {
  MASTERY_EVIDENCE_SCHEMA_VERSION,
  MASTERY_EVIDENCE_STATUSES,
  STAGE_1_EVIDENCE_EVENT_TYPES,
  MASTERY_EVIDENCE_EVENT_TYPES,
  isMasteryEvidenceEnabled,
} from '../../lib/masteryEvidence/constants.js';
import {
  assertEvidenceStatus,
  assertSchemaVersion,
  assertStage1EventType,
  assertStage1Phase,
  isUuid,
  normalizeIsoTimestamp,
  normalizeJsonObject,
  normalizeOptionalText,
  normalizeOptionalBoolean,
  normalizeOptionalPositiveInteger,
  normalizeRequiredText,
} from '../../lib/masteryEvidence/schema.js';
import { mergeProvenance, resolveSonomaProviderProvenance } from '../../lib/masteryEvidence/provenance.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getClients(deps = {}) {
  const { url, anon, service } = getEnv();
  const createClientImpl = deps.createClientImpl || createClient;
  if (!url || !anon || !service) return null;
  return {
    pub: createClientImpl(url, anon, { auth: { persistSession: false } }),
    admin: createClientImpl(url, service, { auth: { persistSession: false } }),
  };
}

function getBearerToken(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

async function readAuthenticatedUser(request, deps = {}) {
  const token = getBearerToken(request);
  if (!token) return { user: null, token: null, error: 'Missing authorization' };
  const clients = getClients(deps);
  if (!clients) return { user: null, token, error: 'Evidence persistence is not configured' };
  const { data, error } = await clients.pub.auth.getUser(token);
  if (error || !data?.user?.id) return { user: null, token, error: 'Unauthorized' };
  return { user: data.user, token, clients };
}

async function verifyLearnerOwnership(admin, userId, learnerId) {
  if (!isUuid(learnerId)) return false;
  const { data, error } = await admin
    .from('learners')
    .select('id')
    .eq('id', learnerId)
    .or(`facilitator_id.eq.${userId},owner_id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();
  return !error && !!data?.id;
}

async function verifyLessonSession(admin, { sessionId, learnerId }) {
  const { data, error } = await admin
    .from('lesson_sessions')
    .select('id, learner_id')
    .eq('id', sessionId)
    .eq('learner_id', learnerId)
    .maybeSingle();
  return !error && !!data?.id;
}

function badRequest(message) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function forbidden(message = 'Forbidden') {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function normalizeSessionBody(body) {
  assertSchemaVersion(body?.schema_version);
  const sessionId = normalizeRequiredText(body?.session_id, 'session_id');
  const learnerId = normalizeRequiredText(body?.learner_id, 'learner_id');
  if (!isUuid(learnerId)) throw new Error('learner_id must be a UUID');

  return {
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    session_id: sessionId,
    browser_session_id: normalizeOptionalText(body?.browser_session_id),
    learner_id: learnerId,
    lesson_key: normalizeRequiredText(body?.lesson_key, 'lesson_key'),
    lesson_id: normalizeOptionalText(body?.lesson_id),
    lesson_source: normalizeOptionalText(body?.lesson_source),
    lesson_version: normalizeOptionalText(body?.lesson_version),
    lesson_version_id: isUuid(body?.lesson_version_id) ? body.lesson_version_id : null,
    lesson_content_hash: normalizeOptionalText(body?.lesson_content_hash),
    teaching_protocol_version: normalizeOptionalText(body?.teaching_protocol_version),
    teaching_protocol_hash: normalizeOptionalText(body?.teaching_protocol_hash),
    started_at: normalizeIsoTimestamp(body?.started_at, new Date().toISOString()),
    evidence_status: MASTERY_EVIDENCE_STATUSES.PARTIAL,
  };
}

function normalizeEventBody(body) {
  assertSchemaVersion(body?.schema_version);
  assertStage1EventType(body?.event_type);

  return {
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: normalizeRequiredText(body?.evidence_session_id, 'evidence_session_id'),
    event_type: body.event_type,
    idempotency_key: normalizeRequiredText(body?.idempotency_key, 'idempotency_key'),
    event_sequence: normalizeOptionalPositiveInteger(body?.event_sequence, 'event_sequence'),
    occurred_at: normalizeIsoTimestamp(body?.occurred_at, new Date().toISOString()),
    phase: assertStage1Phase(body?.phase, { allowNull: true }),
    concept_id: null,
    item_id: normalizeOptionalText(body?.item_id),
    item_purpose: normalizeOptionalText(body?.item_purpose),
    item_exposure_id: normalizeOptionalText(body?.item_exposure_id),
    assistance_level: normalizeOptionalText(body?.assistance_level),
    attempt_number: normalizeOptionalPositiveInteger(body?.attempt_number, 'attempt_number'),
    is_first_response: normalizeOptionalBoolean(body?.is_first_response),
    result: normalizeJsonObject(body?.result, 'result'),
    payload: normalizeJsonObject(body?.payload, 'payload'),
    provenance: normalizeJsonObject(body?.provenance, 'provenance'),
  };
}

function normalizeFinalizeBody(body) {
  const evidenceSessionId = normalizeRequiredText(body?.evidence_session_id, 'evidence_session_id');
  const status = normalizeRequiredText(body?.evidence_status, 'evidence_status');
  assertEvidenceStatus(status);
  return {
    evidenceSessionId,
    evidenceStatus: status,
    endedAt: normalizeIsoTimestamp(body?.ended_at, new Date().toISOString()),
  };
}

async function handleCreateSession({ body, user, admin }) {
  const session = normalizeSessionBody(body);

  const ownsLearner = await verifyLearnerOwnership(admin, user.id, session.learner_id);
  if (!ownsLearner) return forbidden('Learner not found or unauthorized');

  const hasTrackedSession = await verifyLessonSession(admin, {
    sessionId: session.session_id,
    learnerId: session.learner_id,
  });
  if (!hasTrackedSession) return forbidden('Lesson session not found or unauthorized');

  const provider = resolveSonomaProviderProvenance();
  const row = {
    ...session,
    facilitator_id: user.id,
    provider: provider.provider,
    model: provider.model,
    app_build_id: provider.app_build_id,
    teaching_protocol_version: session.teaching_protocol_version || provider.teaching_protocol_version,
    teaching_protocol_hash: session.teaching_protocol_hash || provider.teaching_protocol_hash,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('learning_evidence_sessions')
    .upsert(row, {
      onConflict: 'facilitator_id,session_id,schema_version',
      ignoreDuplicates: false,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Evidence session write failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    evidence_session: data,
    server_provenance: {
      provider: data.provider || null,
      model: data.model || null,
      app_build_id: data.app_build_id || null,
      teaching_protocol_version: data.teaching_protocol_version || null,
      teaching_protocol_hash: data.teaching_protocol_hash || null,
    },
  });
}

async function handleRecordEvent({ body, user, admin }) {
  const event = normalizeEventBody(body);

  const { data: evidenceSession, error: sessionError } = await admin
    .from('learning_evidence_sessions')
    .select('*')
    .eq('id', event.evidence_session_id)
    .eq('facilitator_id', user.id)
    .maybeSingle();

  if (sessionError || !evidenceSession) return forbidden('Evidence session not found or unauthorized');

  const provider = resolveSonomaProviderProvenance();
  const payload = {
    schema_version: event.schema_version,
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    event_sequence: event.event_sequence,
    idempotency_key: event.idempotency_key,
    evidence_session_id: evidenceSession.id,
    session_id: evidenceSession.session_id,
    browser_session_id: evidenceSession.browser_session_id,
    learner_id: evidenceSession.learner_id,
    facilitator_id: evidenceSession.facilitator_id,
    lesson_key: evidenceSession.lesson_key,
    lesson_id: evidenceSession.lesson_id,
    phase: event.phase,
    concept_id: event.concept_id,
    item_id: event.item_id,
    item_purpose: event.item_purpose,
    item_exposure_id: event.item_exposure_id,
    assistance_level: event.assistance_level,
    attempt_number: event.attempt_number,
    is_first_response: event.is_first_response,
    result: event.result,
    payload: event.payload,
    provenance: mergeProvenance({
      provider: provider.provider,
      model: provider.model,
      app_build_id: provider.app_build_id,
      teaching_protocol_version: evidenceSession.teaching_protocol_version || provider.teaching_protocol_version,
      teaching_protocol_hash: evidenceSession.teaching_protocol_hash || provider.teaching_protocol_hash,
    }, event.provenance),
  };

  const { data, error } = await admin
    .from('learning_evidence_events')
    .insert(payload)
    .select('*')
    .single();

  if (error?.code === '23505') {
    const { data: existing, error: existingError } = await admin
      .from('learning_evidence_events')
      .select('*')
      .eq('idempotency_key', event.idempotency_key)
      .eq('facilitator_id', user.id)
      .maybeSingle();
    if (!existingError && existing) {
      return NextResponse.json({ ok: true, duplicate: true, event: existing });
    }
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Evidence event write failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, duplicate: false, event: data });
}

async function handleFinalizeSession({ body, user, admin }) {
  const finalization = normalizeFinalizeBody(body);
  const { data, error } = await admin
    .from('learning_evidence_sessions')
    .update({
      evidence_status: finalization.evidenceStatus,
      ended_at: finalization.endedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', finalization.evidenceSessionId)
    .eq('facilitator_id', user.id)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Evidence session finalize failed' }, { status: 500 });
  }
  if (!data) return forbidden('Evidence session not found or unauthorized');

  return NextResponse.json({ ok: true, evidence_session: data });
}

async function handleGetSession({ request, user, admin }) {
  const url = new URL(request.url);
  const evidenceSessionId = normalizeOptionalText(url.searchParams.get('evidence_session_id'));
  const sessionId = normalizeOptionalText(url.searchParams.get('session_id'));

  let query = admin
    .from('learning_evidence_sessions')
    .select('*, learning_evidence_events(*)')
    .eq('facilitator_id', user.id);

  if (evidenceSessionId) query = query.eq('id', evidenceSessionId);
  else if (sessionId) query = query.eq('session_id', sessionId);
  else return badRequest('evidence_session_id or session_id required');

  const { data, error } = await query.maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Evidence read failed' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ ok: false, error: 'Evidence session not found' }, { status: 404 });
  return NextResponse.json({ ok: true, evidence_session: data });
}

export async function POST(request, deps = {}) {
  try {
    if (!isMasteryEvidenceEnabled(process.env)) {
      return NextResponse.json({ ok: false, error: 'Evidence disabled' }, { status: 404 });
    }

    const auth = await readAuthenticatedUser(request, deps);
    if (!auth.user) {
      return NextResponse.json({ ok: false, error: auth.error || 'Unauthorized' }, { status: auth.error === 'Unauthorized' ? 401 : 503 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');
    const action = normalizeRequiredText(body.action, 'action');

    if (action === 'create_session') {
      return await handleCreateSession({ body, user: auth.user, admin: auth.clients.admin });
    }
    if (action === 'record_event') {
      return await handleRecordEvent({ body, user: auth.user, admin: auth.clients.admin });
    }
    if (action === 'finalize_session') {
      return await handleFinalizeSession({ body, user: auth.user, admin: auth.clients.admin });
    }

    return badRequest('Unsupported evidence action');
  } catch (error) {
    return badRequest(error?.message || 'Invalid evidence request');
  }
}

export async function GET(request, deps = {}) {
  try {
    if (!isMasteryEvidenceEnabled(process.env)) {
      return NextResponse.json({ ok: false, error: 'Evidence disabled' }, { status: 404 });
    }
    const auth = await readAuthenticatedUser(request, deps);
    if (!auth.user) {
      return NextResponse.json({ ok: false, error: auth.error || 'Unauthorized' }, { status: auth.error === 'Unauthorized' ? 401 : 503 });
    }
    return await handleGetSession({ request, user: auth.user, admin: auth.clients.admin });
  } catch (error) {
    return badRequest(error?.message || 'Invalid evidence request');
  }
}

export { STAGE_1_EVIDENCE_EVENT_TYPES, MASTERY_EVIDENCE_EVENT_TYPES };
