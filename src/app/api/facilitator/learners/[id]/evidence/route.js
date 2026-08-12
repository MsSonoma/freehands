import { NextResponse } from 'next/server.js';
import { createClient } from '@supabase/supabase-js';
import { isMasteryEvidenceEnabled } from '../../../../../lib/masteryEvidence/constants.js';
import { isUuid } from '../../../../../lib/masteryEvidence/schema.js';
import {
  aggregateFacilitatorEvidenceSession,
  decodeReportCursor,
  encodeReportCursor,
} from '../../../../../lib/masteryEvidence/reporting.js';
import { buildReviewRunSummary } from '../../../../../lib/masteryEvidence/followUps.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

const EVIDENCE_SESSION_FIELDS = [
  'id',
  'schema_version',
  'session_id',
  'browser_session_id',
  'facilitator_id',
  'learner_id',
  'lesson_key',
  'stable_lesson_key',
  'lesson_id',
  'lesson_source',
  'lesson_identity_version',
  'lesson_version_id',
  'teaching_protocol_version',
  'assessment_isolation_version',
  'assessment_isolation_status',
  'baseline_protocol_version',
  'baseline_status',
  'baseline_item_count',
  'baseline_unavailable_reason',
  'mastery_protocol_version',
  'retention_protocol_version',
  'evidence_status',
  'started_at',
  'ended_at',
].join(',');

const EVIDENCE_EVENT_FIELDS = [
  'event_id',
  'event_type',
  'occurred_at',
  'created_at',
  'event_sequence',
  'evidence_session_id',
  'session_id',
  'facilitator_id',
  'learner_id',
  'phase',
  'concept_id',
  'item_id',
  'stable_item_id',
  'item_content_hash',
  'item_exposure_id',
  'assessment_role',
  'evidence_purpose',
  'assistance_level',
  'attempt_number',
  'is_first_response',
  'mastery_protocol_version',
  'mastery_cycle_id',
  'mastery_check_id',
  'mastery_check_role',
  'independence_status',
  'independence_reason',
  'mastery_outcome',
  'retention_protocol_version',
  'retention_check_id',
  'retention_anchor_mastery_check_id',
  'retention_delay_seconds',
  'retention_qualification_status',
  'retention_qualification_reason',
  'retention_outcome',
  'result',
  'payload',
].join(',');

function getBearerToken(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}
function getClients(deps = {}) {
  if (deps.clients) return deps.clients;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const createClientImpl = deps.createClientImpl || createClient;
  if (!url || !anon || !service) return null;
  return {
    pub: createClientImpl(url, anon, { auth: { persistSession: false } }),
    admin: createClientImpl(url, service, { auth: { persistSession: false } }),
  };
}

async function authenticateRequest(request, deps = {}) {
  if (deps.authenticate) return deps.authenticate(request);
  const token = getBearerToken(request);
  if (!token) return { user: null, error: 'Missing authorization', status: 401 };
  const clients = getClients(deps);
  if (!clients) return { user: null, error: 'Evidence reporting is not configured', status: 503 };
  const { data, error } = await clients.pub.auth.getUser(token);
  if (error || !data?.user?.id) return { user: null, error: 'Unauthorized', status: 401 };
  return { user: data.user, admin: clients.admin };
}

function normalizeOptionalFilter(value, fieldName, maxLength = 500) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text || text.length > maxLength || /[\u0000-\u001f]/.test(text)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return text;
}

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function createSupabaseReportingRepository(admin) {
  return {
    async findOwnedLearner({ userId, learnerId }) {
      const { data, error } = await admin
        .from('learners')
        .select('id')
        .eq('id', learnerId)
        .or(`facilitator_id.eq.${userId},owner_id.eq.${userId},user_id.eq.${userId}`)
        .maybeSingle();
      if (error) throw new Error('Learner ownership check failed');
      return data || null;
    },

    async listTrackedSessions({ learnerId, sessionId, lessonKey, cursor, limit }) {
      let query = admin
        .from('lesson_sessions')
        .select('id,session_id,learner_id,lesson_id,started_at,ended_at')
        .eq('learner_id', learnerId);
      if (sessionId) query = query.eq('id', sessionId);
      if (lessonKey) query = query.eq('lesson_id', lessonKey);
      if (cursor) {
        query = query.or(
          `started_at.lt.${cursor.started_at},and(started_at.eq.${cursor.started_at},id.lt.${cursor.id})`,
        );
      }
      const { data, error } = await query
        .order('started_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
      if (error) throw new Error('Lesson session history query failed');
      return Array.isArray(data) ? data : [];
    },

    async listEvidenceSessions({ userId, learnerId, sessionIds }) {
      if (!sessionIds.length) return [];
      const { data, error } = await admin
        .from('learning_evidence_sessions')
        .select(EVIDENCE_SESSION_FIELDS)
        .eq('facilitator_id', userId)
        .eq('learner_id', learnerId)
        .in('session_id', sessionIds);
      if (error) throw new Error('Evidence session history query failed');
      return Array.isArray(data) ? data : [];
    },

    async listEvidenceEvents({ userId, learnerId, evidenceSessionIds }) {
      if (!evidenceSessionIds.length) return [];
      const { data, error } = await admin
        .from('learning_evidence_events')
        .select(EVIDENCE_EVENT_FIELDS)
        .eq('facilitator_id', userId)
        .eq('learner_id', learnerId)
        .in('evidence_session_id', evidenceSessionIds)
        .order('occurred_at', { ascending: true })
        .order('event_sequence', { ascending: true, nullsFirst: false });
      if (error) throw new Error('Evidence event history query failed');
      return Array.isArray(data) ? data : [];
    },

    async listReviewRuns({ userId, learnerId }) {
      const { data, error } = await admin
        .from('learning_review_runs')
        .select('*')
        .eq('facilitator_id', userId)
        .eq('learner_id', learnerId)
        .order('started_at', { ascending: false })
        .limit(50);
      if (error?.code === '42P01') return [];
      if (error) throw new Error('Review history query failed');
      return Array.isArray(data) ? data : [];
    },

    async listReviewItems({ userId, learnerId, runIds }) {
      if (!runIds.length) return [];
      const { data, error } = await admin
        .from('learning_review_items')
        .select('*')
        .eq('facilitator_id', userId)
        .eq('learner_id', learnerId)
        .in('run_id', runIds)
        .order('ordinal', { ascending: true });
      if (error) throw new Error('Review item history query failed');
      return Array.isArray(data) ? data : [];
    },

    async listReviewEvents({ userId, learnerId, runIds }) {
      if (!runIds.length) return [];
      const { data, error } = await admin
        .from('learning_review_events')
        .select('*')
        .eq('facilitator_id', userId)
        .eq('learner_id', learnerId)
        .in('run_id', runIds)
        .order('occurred_at', { ascending: true });
      if (error) throw new Error('Review event history query failed');
      return Array.isArray(data) ? data : [];
    },
  };
}

export async function loadFacilitatorReviewHistory({ repository, userId, learnerId, lessonKey = null } = {}) {
  if (typeof repository.listReviewRuns !== 'function') return [];
  const runs = await repository.listReviewRuns({ userId, learnerId });
  const authorizedRuns = runs.filter((run) => (
    String(run?.facilitator_id) === String(userId)
      && String(run?.learner_id) === String(learnerId)
  ));
  const runIds = authorizedRuns.map((run) => run.id);
  const [items, events] = await Promise.all([
    repository.listReviewItems({ userId, learnerId, runIds }),
    repository.listReviewEvents({ userId, learnerId, runIds }),
  ]);
  const itemsByRun = new Map();
  const eventsByRun = new Map();
  for (const item of items) {
    if (!runIds.some((id) => String(id) === String(item?.run_id))) continue;
    const key = String(item.run_id);
    if (!itemsByRun.has(key)) itemsByRun.set(key, []);
    itemsByRun.get(key).push(item);
  }
  for (const event of events) {
    if (!runIds.some((id) => String(id) === String(event?.run_id))) continue;
    const key = String(event.run_id);
    if (!eventsByRun.has(key)) eventsByRun.set(key, []);
    eventsByRun.get(key).push(event);
  }
  return authorizedRuns
    .map((run) => buildReviewRunSummary({
      run,
      items: itemsByRun.get(String(run.id)) || [],
      events: eventsByRun.get(String(run.id)) || [],
    }))
    .filter((report) => !lessonKey || report.items.some((item) => item.lesson_key === lessonKey));
}

export async function loadFacilitatorEvidenceHistory({
  repository,
  userId,
  learnerId,
  sessionId = null,
  lessonKey = null,
  cursor = null,
  limit = DEFAULT_LIMIT,
} = {}) {
  const learner = await repository.findOwnedLearner({ userId, learnerId });
  if (!learner?.id) return { kind: 'forbidden' };

  const requestedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  const trackedRows = await repository.listTrackedSessions({
    learnerId,
    sessionId,
    lessonKey,
    cursor,
    limit: requestedLimit + 1,
  });
  const authorizedTrackedRows = trackedRows.filter((row) => String(row?.learner_id) === String(learnerId));
  if (sessionId && authorizedTrackedRows.length === 0) return { kind: 'not_found' };

  const hasMore = authorizedTrackedRows.length > requestedLimit;
  const pageRows = authorizedTrackedRows.slice(0, requestedLimit);
  const trackedIds = new Set(pageRows.map((row) => String(row.id)));
  const evidenceRows = await repository.listEvidenceSessions({
    userId,
    learnerId,
    sessionIds: Array.from(trackedIds),
  });
  const authorizedEvidenceRows = evidenceRows.filter((row) => (
    String(row?.facilitator_id) === String(userId)
      && String(row?.learner_id) === String(learnerId)
      && trackedIds.has(String(row?.session_id))
  ));
  const evidenceSessionIds = new Set(authorizedEvidenceRows.map((row) => String(row.id)));
  const eventRows = await repository.listEvidenceEvents({
    userId,
    learnerId,
    evidenceSessionIds: Array.from(evidenceSessionIds),
  });
  const authorizedEventRows = eventRows.filter((row) => (
    String(row?.facilitator_id) === String(userId)
      && String(row?.learner_id) === String(learnerId)
      && evidenceSessionIds.has(String(row?.evidence_session_id))
  ));

  const evidenceByTrackedSession = new Map();
  for (const row of authorizedEvidenceRows) {
    evidenceByTrackedSession.set(String(row.session_id), row);
  }
  const eventsByEvidenceSession = new Map();
  for (const row of authorizedEventRows) {
    const key = String(row.evidence_session_id);
    if (!eventsByEvidenceSession.has(key)) eventsByEvidenceSession.set(key, []);
    eventsByEvidenceSession.get(key).push(row);
  }

  const items = pageRows.map((trackedSession) => {
    const evidenceSession = evidenceByTrackedSession.get(String(trackedSession.id)) || null;
    const events = evidenceSession
      ? (eventsByEvidenceSession.get(String(evidenceSession.id)) || [])
      : [];
    return aggregateFacilitatorEvidenceSession({ trackedSession, evidenceSession, events });
  });
  const lastRow = pageRows.at(-1) || null;

  return {
    kind: 'ok',
    items,
    pagination: {
      limit: requestedLimit,
      has_more: hasMore,
      next_cursor: hasMore && lastRow ? encodeReportCursor(lastRow) : null,
    },
  };
}

export async function GET(request, context = {}) {
  try {
    const deps = context.deps || context;
    const enabled = typeof deps.enabled === 'boolean'
      ? deps.enabled
      : isMasteryEvidenceEnabled(process.env);
    if (!enabled) {
      return NextResponse.json({
        ok: true,
        enabled: false,
        learner: null,
        items: [],
        reviews: [],
        pagination: { limit: DEFAULT_LIMIT, has_more: false, next_cursor: null },
      });
    }

    const auth = await authenticateRequest(request, deps);
    if (!auth?.user?.id) {
      return NextResponse.json(
        { ok: false, error: auth?.error || 'Unauthorized' },
        { status: auth?.status || 401 },
      );
    }

    const learnerId = String((await context.params)?.id || '').trim();
    if (!isUuid(learnerId)) {
      return NextResponse.json({ ok: false, error: 'Invalid learner id' }, { status: 400 });
    }
    const url = new URL(request.url);
    const sessionId = normalizeOptionalFilter(url.searchParams.get('session_id'), 'session id', 200);
    const lessonKey = normalizeOptionalFilter(url.searchParams.get('lesson_key'), 'lesson key');
    const limit = parseLimit(url.searchParams.get('limit'));
    const cursor = decodeReportCursor(url.searchParams.get('cursor'));
    const repository = deps.repository || createSupabaseReportingRepository(auth.admin);
    const result = await loadFacilitatorEvidenceHistory({
      repository,
      userId: auth.user.id,
      learnerId,
      sessionId,
      lessonKey,
      cursor,
      limit,
    });

    if (result.kind === 'forbidden') {
      return NextResponse.json({ ok: false, error: 'Learner not found or unauthorized' }, { status: 403 });
    }
    if (result.kind === 'not_found') {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
    }
    const reviews = !cursor && !sessionId
      ? await loadFacilitatorReviewHistory({ repository, userId: auth.user.id, learnerId, lessonKey })
      : [];
    return NextResponse.json({
      ok: true,
      enabled: true,
      learner: { id: learnerId },
      items: result.items,
      reviews,
      pagination: result.pagination,
    });
  } catch (error) {
    const message = error?.message || 'Evidence reporting failed';
    const isInvalid = message.startsWith('Invalid ');
    return NextResponse.json(
      { ok: false, error: isInvalid ? message : 'Evidence reporting is temporarily unavailable' },
      { status: isInvalid ? 400 : 500 },
    );
  }
}
