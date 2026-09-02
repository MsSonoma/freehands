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
  ITEM_IDENTITY_VERSION,
  LESSON_IDENTITY_VERSION,
  MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
} from '../../lib/masteryEvidence/identity.js';
import {
  ASSESSMENT_ISOLATION_STATUSES,
  ASSESSMENT_ISOLATION_VERSION,
  ASSESSMENT_ROLES,
} from '../../lib/masteryEvidence/assessmentIsolation.js';
import {
  BASELINE_PROTOCOL_VERSION,
  BASELINE_STATUSES,
} from '../../lib/masteryEvidence/baseline.js';
import {
  INDEPENDENT_MASTERY_PROTOCOL_VERSION,
  INDEPENDENCE_STATUSES,
  MASTERY_CHECK_ROLES,
  MASTERY_OUTCOMES,
} from '../../lib/masteryEvidence/mastery.js';
import {
  RETENTION_PROTOCOL_VERSION,
  RETENTION_OUTCOMES,
  RETENTION_QUALIFICATION_STATUSES,
  RETENTION_REASONS,
  RETENTION_MIN_DELAY_SECONDS,
  isRetentionDelayEligible,
  isValidRetentionAnchor,
} from '../../lib/masteryEvidence/retention.js';
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
import {
  mergeProvenance,
  resolveEvidenceSessionProvenance,
  resolveSlateProviderProvenance,
  resolveSonomaProviderProvenance,
  resolveWebbProviderProvenance,
  SERVER_OWNED_PROVENANCE_FIELDS,
} from '../../lib/masteryEvidence/provenance.js';
import { normalizeLessonKey } from '../../lib/lessonKeyNormalization.js';
import {
  readSyllabusExecutionProof,
  SYLLABUS_EXECUTION_COOKIE,
} from '../../lib/syllabus/executionAuthorization.server.mjs';

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

function cookieValue(request, name) {
  const prefix = `${name}=`;
  const row = String(request?.headers?.get?.('cookie') || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return row ? decodeURIComponent(row.slice(prefix.length)) : '';
}

function verifySlateActivityProof({ request, userId, session, authorizedOccurrenceId, now, secret }) {
  if (!session.session_id.startsWith('slate:') || session.teaching_protocol_version !== 'slate-mastery-retention-v1') return false;
  if (!authorizedOccurrenceId) return false;
  const proof = readSyllabusExecutionProof(
    cookieValue(request, SYLLABUS_EXECUTION_COOKIE),
    secret,
    now || new Date(),
  );
  return Boolean(proof
    && proof.facilitatorId === userId
    && proof.learnerId === session.learner_id
    && normalizeLessonKey(proof.lessonKey) === normalizeLessonKey(session.lesson_key)
    && proof.occurrenceId === authorizedOccurrenceId);
}

function assertOptionalIdentityVersion(value, expected, fieldName) {
  const normalized = normalizeOptionalText(value);
  if (normalized && normalized !== expected) {
    throw new Error(`${fieldName} must be ${expected}`);
  }
  return normalized;
}

function assertOptionalAssessmentIsolationStatus(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized && !Object.values(ASSESSMENT_ISOLATION_STATUSES).includes(normalized)) {
    throw new Error('Unsupported assessment isolation status');
  }
  return normalized;
}

function assertOptionalAssessmentRole(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized && !Object.values(ASSESSMENT_ROLES).includes(normalized)) {
    throw new Error('Unsupported assessment role');
  }
  return normalized;
}

function assertOptionalBaselineStatus(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized && !Object.values(BASELINE_STATUSES).includes(normalized)) {
    throw new Error('Unsupported baseline status');
  }
  return normalized;
}

function assertOptionalEvidencePurpose(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized && !['baseline', 'independent_mastery', 'retention'].includes(normalized)) {
    throw new Error('Unsupported evidence purpose');
  }
  return normalized;
}

function assertOptionalMasteryCheckRole(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized && !Object.values(MASTERY_CHECK_ROLES).includes(normalized)) {
    throw new Error('Unsupported mastery check role');
  }
  return normalized;
}

function assertOptionalIndependenceStatus(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized && !Object.values(INDEPENDENCE_STATUSES).includes(normalized)) {
    throw new Error('Unsupported independence status');
  }
  return normalized;
}

function assertOptionalMasteryOutcome(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized && !Object.values(MASTERY_OUTCOMES).includes(normalized)) {
    throw new Error('Unsupported mastery outcome');
  }
  return normalized;
}

function assertOptionalRetentionQualificationStatus(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized && !Object.values(RETENTION_QUALIFICATION_STATUSES).includes(normalized)) {
    throw new Error('Unsupported retention qualification status');
  }
  return normalized;
}

function assertOptionalRetentionOutcome(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized && !Object.values(RETENTION_OUTCOMES).includes(normalized)) {
    throw new Error('Unsupported retention outcome');
  }
  return normalized;
}

function normalizeOptionalNonnegativeInteger(value, fieldName) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName} must be a nonnegative integer`);
  }
  return number;
}

function normalizeSessionBody(body) {
  assertSchemaVersion(body?.schema_version);
  const sessionId = normalizeRequiredText(body?.session_id, 'session_id');
  const learnerId = normalizeRequiredText(body?.learner_id, 'learner_id');
  if (!isUuid(learnerId)) throw new Error('learner_id must be a UUID');

  return {
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    identity_schema_version: assertOptionalIdentityVersion(
      body?.identity_schema_version,
      MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
      'identity_schema_version',
    ),
    session_id: sessionId,
    browser_session_id: normalizeOptionalText(body?.browser_session_id),
    learner_id: learnerId,
    lesson_key: normalizeRequiredText(body?.lesson_key, 'lesson_key'),
    stable_lesson_key: normalizeOptionalText(body?.stable_lesson_key),
    lesson_id: normalizeOptionalText(body?.lesson_id),
    lesson_source: normalizeOptionalText(body?.lesson_source),
    lesson_version: normalizeOptionalText(body?.lesson_version),
    lesson_identity_version: assertOptionalIdentityVersion(
      body?.lesson_identity_version,
      LESSON_IDENTITY_VERSION,
      'lesson_identity_version',
    ),
    lesson_version_id: isUuid(body?.lesson_version_id) ? body.lesson_version_id : null,
    lesson_content_hash: normalizeOptionalText(body?.lesson_content_hash),
    teaching_protocol_version: normalizeOptionalText(body?.teaching_protocol_version),
    teaching_protocol_hash: normalizeOptionalText(body?.teaching_protocol_hash),
    assessment_isolation_version: assertOptionalIdentityVersion(
      body?.assessment_isolation_version,
      ASSESSMENT_ISOLATION_VERSION,
      'assessment_isolation_version',
    ),
    assessment_isolation_status: assertOptionalAssessmentIsolationStatus(body?.assessment_isolation_status),
    reserved_assessment_count: normalizeOptionalNonnegativeInteger(
      body?.reserved_assessment_count,
      'reserved_assessment_count',
    ),
    baseline_protocol_version: assertOptionalIdentityVersion(
      body?.baseline_protocol_version,
      BASELINE_PROTOCOL_VERSION,
      'baseline_protocol_version',
    ),
    baseline_status: assertOptionalBaselineStatus(body?.baseline_status),
    baseline_item_count: normalizeOptionalNonnegativeInteger(
      body?.baseline_item_count,
      'baseline_item_count',
    ),
    baseline_unavailable_reason: normalizeOptionalText(body?.baseline_unavailable_reason),
    mastery_protocol_version: assertOptionalIdentityVersion(
      body?.mastery_protocol_version,
      INDEPENDENT_MASTERY_PROTOCOL_VERSION,
      'mastery_protocol_version',
    ),
    retention_protocol_version: assertOptionalIdentityVersion(
      body?.retention_protocol_version,
      RETENTION_PROTOCOL_VERSION,
      'retention_protocol_version',
    ),
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
    concept_id: normalizeOptionalText(body?.concept_id),
    item_id: normalizeOptionalText(body?.item_id),
    stable_item_id: normalizeOptionalText(body?.stable_item_id),
    item_content_hash: normalizeOptionalText(body?.item_content_hash),
    item_identity_version: assertOptionalIdentityVersion(
      body?.item_identity_version,
      ITEM_IDENTITY_VERSION,
      'item_identity_version',
    ),
    assessment_role: assertOptionalAssessmentRole(body?.assessment_role),
    pre_assessment_exposed: normalizeOptionalBoolean(body?.pre_assessment_exposed),
    evidence_purpose: assertOptionalEvidencePurpose(body?.evidence_purpose),
    item_purpose: normalizeOptionalText(body?.item_purpose),
    item_exposure_id: normalizeOptionalText(body?.item_exposure_id),
    mastery_protocol_version: assertOptionalIdentityVersion(
      body?.mastery_protocol_version,
      INDEPENDENT_MASTERY_PROTOCOL_VERSION,
      'mastery_protocol_version',
    ),
    mastery_cycle_id: normalizeOptionalText(body?.mastery_cycle_id),
    mastery_check_id: normalizeOptionalText(body?.mastery_check_id),
    mastery_check_role: assertOptionalMasteryCheckRole(body?.mastery_check_role),
    independence_status: assertOptionalIndependenceStatus(body?.independence_status),
    independence_reason: normalizeOptionalText(body?.independence_reason),
    mastery_outcome: assertOptionalMasteryOutcome(body?.mastery_outcome),
    retention_protocol_version: assertOptionalIdentityVersion(
      body?.retention_protocol_version,
      RETENTION_PROTOCOL_VERSION,
      'retention_protocol_version',
    ),
    retention_check_id: normalizeOptionalText(body?.retention_check_id),
    retention_anchor_mastery_check_id: normalizeOptionalText(body?.retention_anchor_mastery_check_id),
    retention_delay_seconds: normalizeOptionalNonnegativeInteger(body?.retention_delay_seconds, 'retention_delay_seconds'),
    retention_qualification_status: assertOptionalRetentionQualificationStatus(body?.retention_qualification_status),
    retention_qualification_reason: normalizeOptionalText(body?.retention_qualification_reason),
    retention_outcome: assertOptionalRetentionOutcome(body?.retention_outcome),
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

async function handleCreateSession({ request, body, user, admin, now, proofSecret }) {
  const session = normalizeSessionBody(body);
  const authorizedOccurrenceId = normalizeOptionalText(body?.authorized_occurrence_id);

  const ownsLearner = await verifyLearnerOwnership(admin, user.id, session.learner_id);
  if (!ownsLearner) return forbidden('Learner not found or unauthorized');

  const hasTrackedSession = await verifyLessonSession(admin, {
    sessionId: session.session_id,
    learnerId: session.learner_id,
  });
  const isSlateActivity = verifySlateActivityProof({
    request,
    userId: user.id,
    session,
    authorizedOccurrenceId,
    now: now || new Date(),
    secret: proofSecret || process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!hasTrackedSession && !isSlateActivity) return forbidden('Lesson session not found or unauthorized');

  const provider = String(session.teaching_protocol_version || '').startsWith('webb-')
    ? resolveWebbProviderProvenance()
    : (isSlateActivity ? resolveSlateProviderProvenance() : resolveSonomaProviderProvenance());
  const row = {
    ...session,
    facilitator_id: user.id,
    syllabus_occurrence_id: isSlateActivity ? authorizedOccurrenceId : null,
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
      syllabus_occurrence_id: data.syllabus_occurrence_id || null,
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

  const provider = resolveEvidenceSessionProvenance(evidenceSession);
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
    stable_item_id: event.stable_item_id,
    item_content_hash: event.item_content_hash,
    item_identity_version: event.item_identity_version,
    assessment_role: event.assessment_role,
    pre_assessment_exposed: event.pre_assessment_exposed,
    evidence_purpose: event.evidence_purpose,
    item_purpose: event.item_purpose,
    item_exposure_id: event.item_exposure_id,
    mastery_protocol_version: event.mastery_protocol_version,
    mastery_cycle_id: event.mastery_cycle_id,
    mastery_check_id: event.mastery_check_id,
    mastery_check_role: event.mastery_check_role,
    independence_status: event.independence_status,
    independence_reason: event.independence_reason,
    mastery_outcome: event.mastery_outcome,
    retention_protocol_version: event.retention_protocol_version,
    retention_check_id: event.retention_check_id,
    retention_anchor_mastery_check_id: event.retention_anchor_mastery_check_id,
    retention_delay_seconds: event.retention_delay_seconds,
    retention_qualification_status: event.retention_qualification_status,
    retention_qualification_reason: event.retention_qualification_reason,
    retention_outcome: event.retention_outcome,
    assistance_level: event.assistance_level,
    attempt_number: event.attempt_number,
    is_first_response: event.is_first_response,
    result: event.result,
    payload: event.payload,
    provenance: mergeProvenance({
      provider: provider.provider,
      model: provider.model,
      app_build_id: provider.app_build_id,
      teaching_protocol_version: provider.teaching_protocol_version,
      teaching_protocol_hash: provider.teaching_protocol_hash,
    }, event.provenance, { protectedFields: SERVER_OWNED_PROVENANCE_FIELDS }),
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

async function handleUpdateBaselineStatus({ body, user, admin }) {
  const evidenceSessionId = normalizeRequiredText(body?.evidence_session_id, 'evidence_session_id');
  const baselineStatus = assertOptionalBaselineStatus(body?.baseline_status);
  if (!baselineStatus) throw new Error('baseline_status required');
  const updates = {
    baseline_protocol_version: assertOptionalIdentityVersion(
      body?.baseline_protocol_version,
      BASELINE_PROTOCOL_VERSION,
      'baseline_protocol_version',
    ) || BASELINE_PROTOCOL_VERSION,
    baseline_status: baselineStatus,
    baseline_item_count: normalizeOptionalNonnegativeInteger(body?.baseline_item_count, 'baseline_item_count'),
    baseline_unavailable_reason: normalizeOptionalText(body?.baseline_unavailable_reason),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin
    .from('learning_evidence_sessions')
    .update(updates)
    .eq('id', evidenceSessionId)
    .eq('facilitator_id', user.id)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Baseline status update failed' }, { status: 500 });
  }
  if (!data) return forbidden('Evidence session not found or unauthorized');
  return NextResponse.json({ ok: true, evidence_session: data });
}

async function handleCheckPriorExposure({ body, user, admin }) {
  const learnerId = normalizeRequiredText(body?.learner_id, 'learner_id');
  if (!isUuid(learnerId)) throw new Error('learner_id must be a UUID');
  const ownsLearner = await verifyLearnerOwnership(admin, user.id, learnerId);
  if (!ownsLearner) return forbidden('Learner not found or unauthorized');

  const identities = Array.isArray(body?.item_identities) ? body.item_identities : [];
  const stableIds = identities
    .map((identity) => normalizeOptionalText(identity?.stable_item_id || identity?.stableItemId))
    .filter(Boolean);
  const contentHashes = identities
    .map((identity) => normalizeOptionalText(identity?.item_content_hash || identity?.itemContentHash))
    .filter(Boolean);

  if (!stableIds.length && !contentHashes.length) {
    return NextResponse.json({ ok: true, exposed: [], exposed_keys: [] });
  }

  let query = admin
    .from('learning_evidence_events')
    .select('stable_item_id,item_content_hash,occurred_at')
    .eq('facilitator_id', user.id)
    .eq('learner_id', learnerId)
    .eq('event_type', MASTERY_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED);

  const clauses = [];
  if (stableIds.length) clauses.push(`stable_item_id.in.(${stableIds.map((id) => `"${id}"`).join(',')})`);
  if (contentHashes.length) clauses.push(`item_content_hash.in.(${contentHashes.map((hash) => `"${hash}"`).join(',')})`);
  query = query.or(clauses.join(','));

  const { data, error } = await query.limit(1000);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Prior exposure read failed' }, { status: 500 });
  }

  const exposedKeys = new Set();
  for (const row of data || []) {
    if (row.stable_item_id) exposedKeys.add(`stable:${row.stable_item_id}`);
    if (row.item_content_hash) exposedKeys.add(`content:${row.item_content_hash}`);
  }

  return NextResponse.json({
    ok: true,
    exposed: data || [],
    exposed_keys: Array.from(exposedKeys),
  });
}

async function handleCheckRetentionEligibility({ body, user, admin }) {
  const learnerId = normalizeRequiredText(body?.learner_id, 'learner_id');
  if (!isUuid(learnerId)) throw new Error('learner_id must be a UUID');
  const ownsLearner = await verifyLearnerOwnership(admin, user.id, learnerId);
  if (!ownsLearner) return forbidden('Learner not found or unauthorized');

  const lessonKey = normalizeRequiredText(body?.lesson_key, 'lesson_key');
  const currentSessionId = normalizeOptionalText(body?.current_session_id);
  const now = normalizeIsoTimestamp(body?.now, new Date().toISOString());
  const minDelaySeconds = normalizeOptionalNonnegativeInteger(body?.min_delay_seconds, 'min_delay_seconds')
    || RETENTION_MIN_DELAY_SECONDS;
  const identities = Array.isArray(body?.item_identities) ? body.item_identities : [];

  const { data: rows, error } = await admin
    .from('learning_evidence_events')
    .select('*')
    .eq('facilitator_id', user.id)
    .eq('learner_id', learnerId)
    .eq('lesson_key', lessonKey)
    .limit(5000);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Retention history read failed' }, { status: 500 });
  }

  const events = Array.isArray(rows) ? rows : [];
  const consumedAnchorIds = new Set(events
    .filter((event) => event.event_type === MASTERY_EVIDENCE_EVENT_TYPES.RETENTION_CHECK_RESULT)
    .map((event) => event.retention_anchor_mastery_check_id)
    .filter(Boolean));

  const anchors = events
    .filter((event) => event.event_type === MASTERY_EVIDENCE_EVENT_TYPES.MASTERY_CHECK_RESULT)
    .filter(isValidRetentionAnchor)
    .filter((event) => event.mastery_check_id && !consumedAnchorIds.has(event.mastery_check_id))
    .filter((event) => !currentSessionId || event.session_id !== currentSessionId)
    .map((event) => ({
      event,
      delay: isRetentionDelayEligible({
        anchorOccurredAt: event.occurred_at,
        now,
        minDelaySeconds,
      }),
    }))
    .filter((entry) => entry.delay.eligible)
    .sort((a, b) => Date.parse(b.event.occurred_at || 0) - Date.parse(a.event.occurred_at || 0));

  const exposedKeys = new Set();
  const stableIds = identities
    .map((identity) => normalizeOptionalText(identity?.stable_item_id || identity?.stableItemId))
    .filter(Boolean);
  const contentHashes = identities
    .map((identity) => normalizeOptionalText(identity?.item_content_hash || identity?.itemContentHash))
    .filter(Boolean);
  for (const event of events) {
    if (event.event_type !== MASTERY_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED) continue;
    if (event.stable_item_id && stableIds.includes(event.stable_item_id)) exposedKeys.add(`stable:${event.stable_item_id}`);
    if (event.item_content_hash && contentHashes.includes(event.item_content_hash)) exposedKeys.add(`content:${event.item_content_hash}`);
  }

  for (const entry of anchors) {
    const anchor = entry.event;
    const anchorTime = Date.parse(anchor.occurred_at || '');
    const anchorConcept = normalizeOptionalText(anchor.concept_id);
    const interveningSameTargetInstruction = events.some((event) => {
      const occurred = Date.parse(event.occurred_at || '');
      if (!Number.isFinite(occurred) || !Number.isFinite(anchorTime) || occurred <= anchorTime) return false;
      if (occurred > Date.parse(now)) return false;
      if (event.event_type === MASTERY_EVIDENCE_EVENT_TYPES.RETENTION_CHECK_RESULT) return false;
      if (event.event_id === anchor.event_id) return false;
      const isInstructional = event.assessment_role === ASSESSMENT_ROLES.INSTRUCTIONAL
        || ['discussion', 'comprehension', 'exercise', 'worksheet'].includes(event.phase);
      if (!isInstructional) return false;
      if (anchorConcept) return event.concept_id === anchorConcept;
      return true;
    });
    if (interveningSameTargetInstruction) continue;

    return NextResponse.json({
      ok: true,
      eligible: true,
      anchor: {
        event_id: anchor.event_id,
        session_id: anchor.session_id,
        mastery_cycle_id: anchor.mastery_cycle_id,
        mastery_check_id: anchor.mastery_check_id,
        mastery_outcome: anchor.mastery_outcome,
        concept_id: anchor.concept_id,
        stable_item_id: anchor.stable_item_id,
        item_content_hash: anchor.item_content_hash,
        occurred_at: anchor.occurred_at,
      },
      retention_delay_seconds: entry.delay.delaySeconds,
      exposed_keys: Array.from(exposedKeys),
    });
  }

  const validAnchors = events
    .filter((event) => event.event_type === MASTERY_EVIDENCE_EVENT_TYPES.MASTERY_CHECK_RESULT)
    .filter(isValidRetentionAnchor)
    .sort((a, b) => Date.parse(b.occurred_at || 0) - Date.parse(a.occurred_at || 0));
  const latestRejectedAnchor = validAnchors[0] || null;
  const delay = latestRejectedAnchor
    ? isRetentionDelayEligible({ anchorOccurredAt: latestRejectedAnchor.occurred_at, now, minDelaySeconds })
    : null;
  let reason = RETENTION_REASONS.NO_VALID_ANCHOR;
  if (validAnchors.length) {
    const allConsumed = validAnchors.every((event) => event.mastery_check_id && consumedAnchorIds.has(event.mastery_check_id));
    const allCurrentSession = currentSessionId
      ? validAnchors.every((event) => event.session_id === currentSessionId)
      : false;
    if (allConsumed) reason = RETENTION_REASONS.ANCHOR_ALREADY_CONSUMED;
    else if (allCurrentSession) reason = RETENTION_REASONS.NOT_NEW_SESSION;
    else if (delay && !delay.eligible) reason = delay.reason;
    else reason = RETENTION_REASONS.INTERVENING_SAME_TARGET_INSTRUCTION;
  }

  return NextResponse.json({
    ok: true,
    eligible: false,
    reason,
    retention_delay_seconds: delay?.delaySeconds ?? null,
    exposed_keys: Array.from(exposedKeys),
  });
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
      return await handleCreateSession({
        request,
        body,
        user: auth.user,
        admin: auth.clients.admin,
        now: deps.now,
        proofSecret: deps.proofSecret,
      });
    }
    if (action === 'record_event') {
      return await handleRecordEvent({ body, user: auth.user, admin: auth.clients.admin });
    }
    if (action === 'finalize_session') {
      return await handleFinalizeSession({ body, user: auth.user, admin: auth.clients.admin });
    }
    if (action === 'update_baseline_status') {
      return await handleUpdateBaselineStatus({ body, user: auth.user, admin: auth.clients.admin });
    }
    if (action === 'check_prior_exposure') {
      return await handleCheckPriorExposure({ body, user: auth.user, admin: auth.clients.admin });
    }
    if (action === 'check_retention_eligibility') {
      return await handleCheckRetentionEligibility({ body, user: auth.user, admin: auth.clients.admin });
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
