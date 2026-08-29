import assert from 'node:assert/strict'
import test from 'node:test'

import { GET, POST } from '../src/app/api/evidence/route.js'
import {
  MasteryEvidenceClient,
  makeEvidenceIdempotencyKey,
  stableStringify,
} from '../src/app/lib/masteryEvidence/client.js'
import {
  MASTERY_EVIDENCE_SCHEMA_VERSION,
  MASTERY_EVIDENCE_STATUSES,
  STAGE_1_EVIDENCE_EVENT_TYPES,
  STAGE_2_EVIDENCE_EVENT_TYPES,
  STAGE_6_EVIDENCE_EVENT_TYPES,
  STAGE_7_EVIDENCE_EVENT_TYPES,
} from '../src/app/lib/masteryEvidence/constants.js'
import {
  ITEM_IDENTITY_VERSION,
  LESSON_IDENTITY_VERSION,
  MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
  TEACHING_PROTOCOL_VERSION,
} from '../src/app/lib/masteryEvidence/identity.js'
import {
  ASSESSMENT_ISOLATION_STATUSES,
  ASSESSMENT_ISOLATION_VERSION,
  ASSESSMENT_ROLES,
} from '../src/app/lib/masteryEvidence/assessmentIsolation.js'
import {
  BASELINE_EVIDENCE_PURPOSE,
  BASELINE_PROTOCOL_VERSION,
  BASELINE_STATUSES,
} from '../src/app/lib/masteryEvidence/baseline.js'
import {
  INDEPENDENT_MASTERY_PROTOCOL_VERSION,
  INDEPENDENCE_STATUSES,
  MASTERY_CHECK_ROLES,
  MASTERY_OUTCOMES,
} from '../src/app/lib/masteryEvidence/mastery.js'
import {
  RETENTION_OUTCOMES,
  RETENTION_PROTOCOL_VERSION,
  RETENTION_QUALIFICATION_STATUSES,
  RETENTION_REASONS,
} from '../src/app/lib/masteryEvidence/retention.js'
import { createLegacyItemFingerprint } from '../src/app/lib/masteryEvidence/items.js'
import {
  createSyllabusExecutionProof,
  SYLLABUS_EXECUTION_COOKIE,
} from '../src/app/lib/syllabus/executionAuthorization.server.mjs'

const facilitatorId = '11111111-1111-1111-1111-111111111111'
const learnerId = '22222222-2222-2222-2222-222222222222'
const sessionId = 'session-row-1'

function jsonRequest(body, { token = 'valid-token', method = 'POST', url = 'https://mssonoma.app/api/evidence', cookie = '' } = {}) {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  })
}

function makeStore() {
  return {
    learners: [{ id: learnerId, facilitator_id: facilitatorId }],
    lesson_sessions: [{ id: sessionId, learner_id: learnerId, lesson_id: 'math/fractions.json' }],
    learning_evidence_sessions: [],
    learning_evidence_events: [],
  }
}

function matches(row, filters) {
  return filters.every(({ column, value }) => row?.[column] === value)
}

class MockQuery {
  constructor(store, table) {
    this.store = store
    this.table = table
    this.filters = []
    this.pendingInsert = null
    this.pendingUpsert = null
    this.pendingUpdate = null
  }

  select() { return this }
  eq(column, value) { this.filters.push({ column, value }); return this }
  is(column, value) { this.filters.push({ column, value }); return this }
  or() { return this }
  limit() { return this }
  then(resolve, reject) {
    return Promise.resolve({
      data: this.store[this.table].filter((row) => matches(row, this.filters)),
      error: null,
    }).then(resolve, reject)
  }

  upsert(row) {
    this.pendingUpsert = row
    return this
  }

  insert(row) {
    this.pendingInsert = row
    return this
  }

  update(row) {
    this.pendingUpdate = row
    return this
  }

  async single() {
    if (this.pendingUpsert) return this.#finishUpsert()
    if (this.pendingInsert) return this.#finishInsert()
    return this.maybeSingle()
  }

  async maybeSingle() {
    if (this.pendingUpdate) return this.#finishUpdate()
    const rows = this.store[this.table].filter((row) => matches(row, this.filters))
    const row = rows[0] || null
    if (this.table === 'learning_evidence_sessions' && row) {
      return {
        data: {
          ...row,
          learning_evidence_events: this.store.learning_evidence_events.filter((event) => event.evidence_session_id === row.id),
        },
        error: null,
      }
    }
    return { data: row, error: null }
  }

  async #finishUpsert() {
    const row = { ...this.pendingUpsert }
    const existing = this.store[this.table].find((entry) => (
      entry.facilitator_id === row.facilitator_id
      && entry.session_id === row.session_id
      && entry.schema_version === row.schema_version
    ))
    if (existing) {
      Object.assign(existing, row)
      return { data: existing, error: null }
    }
    const inserted = { id: 'evidence-session-1', ...row }
    this.store[this.table].push(inserted)
    return { data: inserted, error: null }
  }

  async #finishInsert() {
    const row = { ...this.pendingInsert }
    const duplicate = this.store[this.table].find((entry) => entry.idempotency_key === row.idempotency_key)
    if (duplicate) return { data: null, error: { code: '23505', message: 'duplicate key' } }
    const inserted = { event_id: `event-${this.store[this.table].length + 1}`, ...row }
    this.store[this.table].push(inserted)
    return { data: inserted, error: null }
  }

  async #finishUpdate() {
    const row = this.store[this.table].find((entry) => matches(entry, this.filters))
    if (!row) return { data: null, error: null }
    Object.assign(row, this.pendingUpdate)
    return { data: row, error: null }
  }
}

function makeCreateClientImpl(store) {
  return (_url, key) => ({
    auth: {
      getUser: async (token) => (
        key === 'anon-key' && token === 'valid-token'
          ? { data: { user: { id: facilitatorId } }, error: null }
          : { data: { user: null }, error: new Error('unauthorized') }
      ),
    },
    from: (table) => new MockQuery(store, table),
  })
}

function withEvidenceEnv(callback) {
  const previous = {
    NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED: process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SONOMA_PROVIDER: process.env.SONOMA_PROVIDER,
    SONOMA_OPENAI_MODEL: process.env.SONOMA_OPENAI_MODEL,
    WEBB_OPENAI_MODEL: process.env.WEBB_OPENAI_MODEL,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
  }
  process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED = 'true'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.SONOMA_PROVIDER = 'openai'
  process.env.SONOMA_OPENAI_MODEL = 'gpt-test'
  process.env.WEBB_OPENAI_MODEL = 'gpt-webb-test'
  process.env.VERCEL_GIT_COMMIT_SHA = 'build-test'
  return Promise.resolve(callback()).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  })
}

async function createEvidenceSession(store) {
  const response = await POST(jsonRequest({
    action: 'create_session',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    identity_schema_version: MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
    session_id: sessionId,
    learner_id: learnerId,
    lesson_key: 'generated/fractions.json',
    stable_lesson_key: 'generated/fractions',
    lesson_id: 'fractions.json',
    lesson_source: 'generated',
    lesson_identity_version: LESSON_IDENTITY_VERSION,
    lesson_version_id: '33333333-3333-5333-9333-333333333333',
    lesson_content_hash: 'lesson-content-hash',
    teaching_protocol_version: TEACHING_PROTOCOL_VERSION,
    teaching_protocol_hash: 'protocol-hash',
    assessment_isolation_version: ASSESSMENT_ISOLATION_VERSION,
    assessment_isolation_status: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
    reserved_assessment_count: 2,
    baseline_protocol_version: BASELINE_PROTOCOL_VERSION,
    baseline_status: BASELINE_STATUSES.UNAVAILABLE,
    baseline_item_count: 0,
    baseline_unavailable_reason: 'no_baseline_pool',
    retention_protocol_version: RETENTION_PROTOCOL_VERSION,
    started_at: '2026-08-09T12:00:00.000Z',
  }), { createClientImpl: makeCreateClientImpl(store) })
  return response.json()
}

async function recordEvidenceEvent(store, evidenceSessionId, idempotencyKey, provenance = {}) {
  const response = await POST(jsonRequest({
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: evidenceSessionId,
    event_type: STAGE_1_EVIDENCE_EVENT_TYPES.PHASE_TRANSITION,
    idempotency_key: idempotencyKey,
    occurred_at: '2026-08-29T12:01:00.000Z',
    phase: 'teaching',
    payload: { previous_phase: 'discussion', phase: 'teaching' },
    provenance,
  }), { createClientImpl: makeCreateClientImpl(store) })
  return response.json()
}

test('mastery evidence route is feature gated', async () => {
  const previous = process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED
  delete process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED
  try {
    const response = await POST(jsonRequest({ action: 'create_session' }))
    assert.equal(response.status, 404)
  } finally {
    if (previous == null) delete process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED
    else process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED = previous
  }
})

test('mastery evidence route creates an owned partial evidence session', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const result = await createEvidenceSession(store)
  assert.equal(result.ok, true)
  assert.equal(result.evidence_session.facilitator_id, facilitatorId)
  assert.equal(result.evidence_session.learner_id, learnerId)
  assert.equal(result.evidence_session.session_id, sessionId)
  assert.equal(result.evidence_session.evidence_status, MASTERY_EVIDENCE_STATUSES.PARTIAL)
  assert.equal(result.evidence_session.identity_schema_version, MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION)
  assert.equal(result.evidence_session.stable_lesson_key, 'generated/fractions')
  assert.equal(result.evidence_session.lesson_identity_version, LESSON_IDENTITY_VERSION)
  assert.equal(result.evidence_session.lesson_version_id, '33333333-3333-5333-9333-333333333333')
  assert.equal(result.evidence_session.lesson_content_hash, 'lesson-content-hash')
  assert.equal(result.evidence_session.teaching_protocol_version, TEACHING_PROTOCOL_VERSION)
  assert.equal(result.evidence_session.teaching_protocol_hash, 'protocol-hash')
  assert.equal(result.evidence_session.assessment_isolation_version, ASSESSMENT_ISOLATION_VERSION)
  assert.equal(result.evidence_session.assessment_isolation_status, ASSESSMENT_ISOLATION_STATUSES.ISOLATED)
  assert.equal(result.evidence_session.reserved_assessment_count, 2)
  assert.equal(result.evidence_session.baseline_protocol_version, BASELINE_PROTOCOL_VERSION)
  assert.equal(result.evidence_session.baseline_status, BASELINE_STATUSES.UNAVAILABLE)
  assert.equal(result.evidence_session.baseline_item_count, 0)
  assert.equal(result.evidence_session.baseline_unavailable_reason, 'no_baseline_pool')
  assert.equal(result.evidence_session.retention_protocol_version, RETENTION_PROTOCOL_VERSION)
  assert.equal(result.evidence_session.provider, 'openai')
  assert.equal(result.evidence_session.model, 'gpt-test')
  assert.equal(store.learning_evidence_sessions.length, 1)
}))

test('Slate activity evidence is authorized without creating an instructional lesson session', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const deps = { createClientImpl: makeCreateClientImpl(store) }
  const slateBody = {
    action: 'create_session', schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    identity_schema_version: MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
    session_id: 'slate:activity-1', learner_id: learnerId,
    lesson_key: 'math/fractions.json', stable_lesson_key: 'math/fractions.json',
    authorized_occurrence_id: 'syllabus:slate-practice',
    teaching_protocol_version: 'slate-mastery-retention-v1',
    assessment_isolation_version: ASSESSMENT_ISOLATION_VERSION,
    assessment_isolation_status: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
    mastery_protocol_version: INDEPENDENT_MASTERY_PROTOCOL_VERSION,
    retention_protocol_version: RETENTION_PROTOCOL_VERSION,
  }
  const proof = createSyllabusExecutionProof({
    facilitatorId, learnerId, lessonKey: 'math/fractions.json',
    occurrenceId: 'syllabus:slate-practice', today: '2026-08-29',
  }, 'service-key', new Date('2026-08-29T12:00:00Z'))
  const cookie = `${SYLLABUS_EXECUTION_COOKIE}=${encodeURIComponent(proof)}`
  const accepted = await POST(jsonRequest(slateBody, { cookie }), {
    ...deps, now: new Date('2026-08-29T12:00:30Z'), proofSecret: 'service-key',
  })
  assert.equal(accepted.status, 200)
  assert.equal(store.lesson_sessions.length, 1)
  assert.equal(store.learning_evidence_sessions[0].session_id, 'slate:activity-1')
  assert.equal(store.learning_evidence_sessions[0].provider, 'deterministic_app')
  assert.equal(store.learning_evidence_sessions[0].syllabus_occurrence_id, 'syllabus:slate-practice')

  const rejected = await POST(jsonRequest({
    ...slateBody, session_id: 'slate:spoofed', teaching_protocol_version: TEACHING_PROTOCOL_VERSION,
  }), deps)
  assert.equal(rejected.status, 403)

  const prefixOnly = await POST(jsonRequest({ ...slateBody, session_id: 'slate:prefix-only' }), deps)
  assert.equal(prefixOnly.status, 403)

  const wrongProtocol = await POST(jsonRequest({
    ...slateBody, session_id: 'slate:wrong-protocol', teaching_protocol_version: 'slate-fabricated-v1',
  }, { cookie }), { ...deps, now: new Date('2026-08-29T12:00:30Z'), proofSecret: 'service-key' })
  assert.equal(wrongProtocol.status, 403)

  const wrongOccurrence = await POST(jsonRequest({
    ...slateBody, session_id: 'slate:wrong-occurrence', authorized_occurrence_id: 'syllabus:other',
  }, { cookie }), { ...deps, now: new Date('2026-08-29T12:00:30Z'), proofSecret: 'service-key' })
  assert.equal(wrongOccurrence.status, 403)
  assert.equal(store.learning_evidence_sessions.length, 1)
}))

test('mastery evidence events are append-only and idempotent by key', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const session = await createEvidenceSession(store)
  const body = {
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    event_type: STAGE_1_EVIDENCE_EVENT_TYPES.PHASE_TRANSITION,
    idempotency_key: 'key-1',
    occurred_at: '2026-08-09T12:01:00.000Z',
    phase: 'teaching',
    payload: { previous_phase: 'discussion', phase: 'teaching' },
    result: null,
    provenance: { client: 'test' },
  }

  const first = await (await POST(jsonRequest(body), { createClientImpl: makeCreateClientImpl(store) })).json()
  const second = await (await POST(jsonRequest(body), { createClientImpl: makeCreateClientImpl(store) })).json()

  assert.equal(first.ok, true)
  assert.equal(first.duplicate, false)
  assert.equal(second.ok, true)
  assert.equal(second.duplicate, true)
  assert.equal(store.learning_evidence_events.length, 1)
  assert.equal(store.learning_evidence_events[0].event_type, STAGE_1_EVIDENCE_EVENT_TYPES.PHASE_TRANSITION)
  assert.equal(store.learning_evidence_events[0].concept_id, null)
  assert.equal(store.learning_evidence_events[0].item_id, null)
}))

test('evidence event provenance follows the authoritative session and resists client rewrites', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const base = {
    facilitator_id: facilitatorId,
    learner_id: learnerId,
    browser_session_id: 'browser-1',
    lesson_key: 'math/fractions.json',
    lesson_id: 'fractions.json',
  }
  store.learning_evidence_sessions.push(
    { id: 'evidence-slate', ...base, session_id: 'slate:proof-bound', lesson_source: 'generated' },
    {
      id: 'evidence-webb', ...base, session_id: 'webb-session', lesson_source: 'webb',
      teaching_protocol_version: 'webb-conversation-v1',
    },
    { id: 'evidence-sonoma', ...base, session_id: 'sonoma-session', lesson_source: 'generated' },
    {
      id: 'evidence-stored', ...base, session_id: 'stored-session', lesson_source: 'generated',
      provider: 'anthropic', model: 'stored-model', app_build_id: 'stored-build',
      teaching_protocol_version: 'session-v2', teaching_protocol_hash: 'stored-hash',
    },
  )

  await recordEvidenceEvent(store, 'evidence-slate', 'provenance-slate')
  await recordEvidenceEvent(store, 'evidence-webb', 'provenance-webb')
  await recordEvidenceEvent(store, 'evidence-sonoma', 'provenance-sonoma')
  const stored = await recordEvidenceEvent(store, 'evidence-stored', 'provenance-stored', {
    provider: 'client-provider',
    model: 'client-model',
    app_build_id: 'client-build',
    teaching_protocol_version: 'client-protocol',
    teaching_protocol_hash: 'client-hash',
    client: 'legitimate-enrichment',
  })

  const [slateEvent, webbEvent, sonomaEvent] = store.learning_evidence_events
  assert.equal(slateEvent.provenance.provider, 'deterministic_app')
  assert.equal(slateEvent.provenance.teaching_protocol_version, 'slate-mastery-retention-v1')
  assert.equal(webbEvent.provenance.provider, 'openai')
  assert.equal(webbEvent.provenance.model, 'gpt-webb-test')
  assert.equal(webbEvent.provenance.teaching_protocol_version, 'webb-conversation-v1')
  assert.equal(sonomaEvent.provenance.provider, 'openai')
  assert.equal(sonomaEvent.provenance.model, 'gpt-test')
  assert.equal(sonomaEvent.provenance.teaching_protocol_version, 'session-v2')
  assert.deepEqual(stored.event.provenance, {
    provider: 'anthropic',
    model: 'stored-model',
    app_build_id: 'stored-build',
    teaching_protocol_version: 'session-v2',
    teaching_protocol_hash: 'stored-hash',
    client: 'legitimate-enrichment',
  })
}))

test('stage 2 evidence events persist item, exposure, attempt, and sequence fields', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const session = await createEvidenceSession(store)
  const body = {
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    event_type: STAGE_2_EVIDENCE_EVENT_TYPES.LEARNER_RESPONSE,
    idempotency_key: 'stage2-response-key-1',
    event_sequence: 4,
    occurred_at: '2026-08-09T12:02:00.000Z',
    phase: 'worksheet',
    concept_id: 'concept:item-identity-v1:fractions',
    item_id: 'legacy:abc123',
    stable_item_id: 'item:item-identity-v1:stable-abc123',
    item_content_hash: 'item-content-hash',
    item_identity_version: ITEM_IDENTITY_VERSION,
    assessment_role: ASSESSMENT_ROLES.INSTRUCTIONAL,
    pre_assessment_exposed: false,
    evidence_purpose: BASELINE_EVIDENCE_PURPOSE,
    item_purpose: 'worksheet',
    item_exposure_id: 'worksheet-run1-q1-abc123',
    assistance_level: 'independent',
    attempt_number: 1,
    is_first_response: true,
    payload: {
      legacy_item_fingerprint: 'legacy:abc123',
      response_type: 'text',
      response_value: '42',
    },
    result: { correct: false, evaluation_mode: 'worksheet_current_app_judgment' },
    provenance: { client: 'test' },
  }

  const first = await (await POST(jsonRequest(body), { createClientImpl: makeCreateClientImpl(store) })).json()
  const second = await (await POST(jsonRequest(body), { createClientImpl: makeCreateClientImpl(store) })).json()

  assert.equal(first.ok, true)
  assert.equal(first.duplicate, false)
  assert.equal(second.ok, true)
  assert.equal(second.duplicate, true)
  assert.equal(store.learning_evidence_events.length, 1)
  assert.equal(store.learning_evidence_events[0].event_type, STAGE_2_EVIDENCE_EVENT_TYPES.LEARNER_RESPONSE)
  assert.equal(store.learning_evidence_events[0].event_sequence, 4)
  assert.equal(store.learning_evidence_events[0].concept_id, 'concept:item-identity-v1:fractions')
  assert.equal(store.learning_evidence_events[0].stable_item_id, 'item:item-identity-v1:stable-abc123')
  assert.equal(store.learning_evidence_events[0].item_content_hash, 'item-content-hash')
  assert.equal(store.learning_evidence_events[0].item_identity_version, ITEM_IDENTITY_VERSION)
  assert.equal(store.learning_evidence_events[0].assessment_role, ASSESSMENT_ROLES.INSTRUCTIONAL)
  assert.equal(store.learning_evidence_events[0].pre_assessment_exposed, false)
  assert.equal(store.learning_evidence_events[0].evidence_purpose, BASELINE_EVIDENCE_PURPOSE)
  assert.equal(store.learning_evidence_events[0].item_exposure_id, 'worksheet-run1-q1-abc123')
  assert.equal(store.learning_evidence_events[0].attempt_number, 1)
  assert.equal(store.learning_evidence_events[0].is_first_response, true)
  assert.equal(store.learning_evidence_events[0].payload.response_value, '42')
}))

test('stage 2 evidence route rejects future event semantics and malformed attempts', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const session = await createEvidenceSession(store)
  const base = {
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    idempotency_key: 'bad-stage2-key',
    occurred_at: '2026-08-09T12:02:00.000Z',
    phase: 'worksheet',
  }

  const future = await POST(jsonRequest({
    ...base,
    event_type: 'baseline_result',
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(future.status, 400)

  const malformed = await POST(jsonRequest({
    ...base,
    event_type: STAGE_2_EVIDENCE_EVENT_TYPES.LEARNER_RESPONSE,
    attempt_number: 0,
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(malformed.status, 400)
}))

test('mastery evidence route finalizes and reads back a complete session', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const session = await createEvidenceSession(store)
  const finalize = await (await POST(jsonRequest({
    action: 'finalize_session',
    evidence_session_id: session.evidence_session.id,
    evidence_status: MASTERY_EVIDENCE_STATUSES.COMPLETE,
    ended_at: '2026-08-09T12:30:00.000Z',
  }), { createClientImpl: makeCreateClientImpl(store) })).json()
  assert.equal(finalize.ok, true)
  assert.equal(finalize.evidence_session.evidence_status, MASTERY_EVIDENCE_STATUSES.COMPLETE)

  const readback = await (await GET(jsonRequest(null, {
    method: 'GET',
    url: `https://mssonoma.app/api/evidence?session_id=${sessionId}`,
  }), { createClientImpl: makeCreateClientImpl(store) })).json()
  assert.equal(readback.ok, true)
  assert.equal(readback.evidence_session.ended_at, '2026-08-09T12:30:00.000Z')
}))

test('client idempotency keys are deterministic and payload hashes are stable', () => {
  assert.equal(
    makeEvidenceIdempotencyKey({ sessionId: 'abc', eventType: 'session_started' }),
    'mastery-evidence-v1:abc:session_started',
  )
  assert.equal(
    makeEvidenceIdempotencyKey({ sessionId: 'abc', eventType: 'phase_transition', suffix: '1:idle:discussion' }),
    'mastery-evidence-v1:abc:phase_transition:1-idle-discussion',
  )
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }))
})

test('stage 3 evidence route rejects unsupported identity algorithm versions', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const badSession = await POST(jsonRequest({
    action: 'create_session',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    identity_schema_version: 'future-identity-v9',
    session_id: sessionId,
    learner_id: learnerId,
    lesson_key: 'generated/fractions.json',
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(badSession.status, 400)

  const badAssessmentSession = await POST(jsonRequest({
    action: 'create_session',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    session_id: sessionId,
    learner_id: learnerId,
    lesson_key: 'generated/fractions.json',
    assessment_isolation_status: 'future_isolation_status',
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(badAssessmentSession.status, 400)

  const badBaselineSession = await POST(jsonRequest({
    action: 'create_session',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    session_id: sessionId,
    learner_id: learnerId,
    lesson_key: 'generated/fractions.json',
    baseline_status: 'future_baseline_status',
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(badBaselineSession.status, 400)

  const session = await createEvidenceSession(store)
  const badEvent = await POST(jsonRequest({
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    event_type: STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED,
    idempotency_key: 'bad-identity-version-key',
    occurred_at: '2026-08-09T12:02:00.000Z',
    phase: 'worksheet',
    item_identity_version: 'future-item-identity-v9',
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(badEvent.status, 400)

  const badAssessmentRoleEvent = await POST(jsonRequest({
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    event_type: STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED,
    idempotency_key: 'bad-assessment-role-key',
    occurred_at: '2026-08-09T12:02:00.000Z',
    phase: 'worksheet',
    assessment_role: 'future_assessment_role',
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(badAssessmentRoleEvent.status, 400)

  const badEvidencePurposeEvent = await POST(jsonRequest({
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    event_type: STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED,
    idempotency_key: 'bad-evidence-purpose-key',
    occurred_at: '2026-08-09T12:02:00.000Z',
    phase: 'worksheet',
    evidence_purpose: 'future_purpose',
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(badEvidencePurposeEvent.status, 400)
}))

test('stage 5 evidence route updates baseline status and checks prior exposure by learner', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const session = await createEvidenceSession(store)
  const update = await (await POST(jsonRequest({
    action: 'update_baseline_status',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    baseline_protocol_version: BASELINE_PROTOCOL_VERSION,
    baseline_status: BASELINE_STATUSES.COMPLETE,
    baseline_item_count: 2,
  }), { createClientImpl: makeCreateClientImpl(store) })).json()
  assert.equal(update.ok, true)
  assert.equal(update.evidence_session.baseline_status, BASELINE_STATUSES.COMPLETE)
  assert.equal(update.evidence_session.baseline_item_count, 2)

  store.learning_evidence_events.push({
    event_id: 'prior-event-1',
    facilitator_id: facilitatorId,
    learner_id: learnerId,
    event_type: STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED,
    stable_item_id: 'item:item-identity-v1:baseline-a',
    item_content_hash: 'hash-baseline-a',
    occurred_at: '2026-08-09T11:00:00.000Z',
  })
  store.learning_evidence_events.push({
    event_id: 'other-learner-event',
    facilitator_id: facilitatorId,
    learner_id: '99999999-9999-9999-9999-999999999999',
    event_type: STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED,
    stable_item_id: 'item:item-identity-v1:baseline-other',
    item_content_hash: 'hash-other',
    occurred_at: '2026-08-09T11:00:00.000Z',
  })

  const prior = await (await POST(jsonRequest({
    action: 'check_prior_exposure',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    learner_id: learnerId,
    item_identities: [
      { stable_item_id: 'item:item-identity-v1:baseline-a', item_content_hash: 'hash-baseline-a' },
    ],
  }), { createClientImpl: makeCreateClientImpl(store) })).json()
  assert.equal(prior.ok, true)
  assert.deepEqual(prior.exposed_keys.sort(), [
    'content:hash-baseline-a',
    'stable:item:item-identity-v1:baseline-a',
  ])
}))

test('stage 6 evidence route persists independent mastery result metadata', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const session = await createEvidenceSession(store)
  const result = await (await POST(jsonRequest({
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    event_type: STAGE_6_EVIDENCE_EVENT_TYPES.MASTERY_CHECK_RESULT,
    idempotency_key: 'stage6-mastery-check-result',
    event_sequence: 9,
    occurred_at: '2026-08-09T12:09:00.000Z',
    phase: 'test',
    stable_item_id: 'item:item-identity-v1:reserved-a',
    item_content_hash: 'hash-reserved-a',
    item_identity_version: ITEM_IDENTITY_VERSION,
    assessment_role: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
    evidence_purpose: 'independent_mastery',
    item_exposure_id: 'test-run1-q1',
    mastery_protocol_version: INDEPENDENT_MASTERY_PROTOCOL_VERSION,
    mastery_cycle_id: 'mastery-cycle:independent-mastery-v1:abc',
    mastery_check_id: 'mastery-check:independent-mastery-v1:def',
    mastery_check_role: MASTERY_CHECK_ROLES.INITIAL,
    independence_status: INDEPENDENCE_STATUSES.INDEPENDENT,
    independence_reason: 'eligible',
    mastery_outcome: MASTERY_OUTCOMES.INDEPENDENT_SUCCESS,
    attempt_number: 1,
    is_first_response: true,
    result: { correct: true, mastery_outcome: MASTERY_OUTCOMES.INDEPENDENT_SUCCESS },
  }), { createClientImpl: makeCreateClientImpl(store) })).json()
  assert.equal(result.ok, true)
  assert.equal(store.learning_evidence_events[0].event_type, STAGE_6_EVIDENCE_EVENT_TYPES.MASTERY_CHECK_RESULT)
  assert.equal(store.learning_evidence_events[0].mastery_protocol_version, INDEPENDENT_MASTERY_PROTOCOL_VERSION)
  assert.equal(store.learning_evidence_events[0].mastery_check_role, MASTERY_CHECK_ROLES.INITIAL)
  assert.equal(store.learning_evidence_events[0].independence_status, INDEPENDENCE_STATUSES.INDEPENDENT)
  assert.equal(store.learning_evidence_events[0].mastery_outcome, MASTERY_OUTCOMES.INDEPENDENT_SUCCESS)

  const bad = await POST(jsonRequest({
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    event_type: STAGE_6_EVIDENCE_EVENT_TYPES.MASTERY_CHECK_RESULT,
    idempotency_key: 'bad-stage6-role',
    occurred_at: '2026-08-09T12:10:00.000Z',
    phase: 'test',
    mastery_check_role: 'future_role',
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(bad.status, 400)
}))

test('stage 7 evidence route persists retention result metadata and validates retention fields', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  const session = await createEvidenceSession(store)
  const result = await (await POST(jsonRequest({
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    event_type: STAGE_7_EVIDENCE_EVENT_TYPES.RETENTION_CHECK_RESULT,
    idempotency_key: 'stage7-retention-check-result',
    event_sequence: 10,
    occurred_at: '2026-08-10T12:09:00.000Z',
    phase: 'idle',
    stable_item_id: 'item:item-identity-v1:retention-a',
    item_content_hash: 'hash-retention-a',
    item_identity_version: ITEM_IDENTITY_VERSION,
    assessment_role: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
    evidence_purpose: 'retention',
    item_exposure_id: 'retention-run1-q1',
    retention_protocol_version: RETENTION_PROTOCOL_VERSION,
    retention_check_id: 'retention-check:retention-v1:abc',
    retention_anchor_mastery_check_id: 'mastery-check:independent-mastery-v1:def',
    retention_delay_seconds: 90000,
    retention_qualification_status: RETENTION_QUALIFICATION_STATUSES.ELIGIBLE,
    retention_qualification_reason: RETENTION_REASONS.ELIGIBLE,
    retention_outcome: RETENTION_OUTCOMES.RETAINED,
    independence_status: INDEPENDENCE_STATUSES.INDEPENDENT,
    independence_reason: 'eligible',
    attempt_number: 1,
    is_first_response: true,
    result: { correct: true, retention_outcome: RETENTION_OUTCOMES.RETAINED },
  }), { createClientImpl: makeCreateClientImpl(store) })).json()
  assert.equal(result.ok, true)
  assert.equal(store.learning_evidence_events[0].event_type, STAGE_7_EVIDENCE_EVENT_TYPES.RETENTION_CHECK_RESULT)
  assert.equal(store.learning_evidence_events[0].retention_protocol_version, RETENTION_PROTOCOL_VERSION)
  assert.equal(store.learning_evidence_events[0].retention_check_id, 'retention-check:retention-v1:abc')
  assert.equal(store.learning_evidence_events[0].retention_anchor_mastery_check_id, 'mastery-check:independent-mastery-v1:def')
  assert.equal(store.learning_evidence_events[0].retention_delay_seconds, 90000)
  assert.equal(store.learning_evidence_events[0].retention_qualification_status, RETENTION_QUALIFICATION_STATUSES.ELIGIBLE)
  assert.equal(store.learning_evidence_events[0].retention_outcome, RETENTION_OUTCOMES.RETAINED)

  const badOutcome = await POST(jsonRequest({
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    event_type: STAGE_7_EVIDENCE_EVENT_TYPES.RETENTION_CHECK_RESULT,
    idempotency_key: 'bad-stage7-outcome',
    occurred_at: '2026-08-10T12:10:00.000Z',
    phase: 'idle',
    retention_outcome: 'future_outcome',
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(badOutcome.status, 400)

  const badQualification = await POST(jsonRequest({
    action: 'record_event',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    evidence_session_id: session.evidence_session.id,
    event_type: STAGE_7_EVIDENCE_EVENT_TYPES.RETENTION_CHECK_RESULT,
    idempotency_key: 'bad-stage7-qualification',
    occurred_at: '2026-08-10T12:10:00.000Z',
    phase: 'idle',
    retention_qualification_status: 'future_status',
  }), { createClientImpl: makeCreateClientImpl(store) })
  assert.equal(badQualification.status, 400)
}))

test('stage 7 eligibility readback uses Stage 6 anchors, exact delay, session boundary, and consumed anchors', async () => withEvidenceEnv(async () => {
  const store = makeStore()
  await createEvidenceSession(store)
  store.learning_evidence_events.push({
    event_id: 'anchor-event-1',
    facilitator_id: facilitatorId,
    learner_id: learnerId,
    session_id: 'prior-session',
    lesson_key: 'generated/fractions.json',
    event_type: STAGE_6_EVIDENCE_EVENT_TYPES.MASTERY_CHECK_RESULT,
    mastery_check_id: 'mastery-check:independent-mastery-v1:anchor',
    mastery_cycle_id: 'mastery-cycle:independent-mastery-v1:cycle',
    mastery_outcome: MASTERY_OUTCOMES.INDEPENDENT_SUCCESS,
    concept_id: 'concept:item-identity-v1:half',
    occurred_at: '2026-08-09T12:00:00.000Z',
  })

  const eligible = await (await POST(jsonRequest({
    action: 'check_retention_eligibility',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    learner_id: learnerId,
    lesson_key: 'generated/fractions.json',
    current_session_id: sessionId,
    now: '2026-08-10T12:00:30.000Z',
    item_identities: [
      { stable_item_id: 'item:item-identity-v1:retention-a', item_content_hash: 'hash-retention-a' },
    ],
  }), { createClientImpl: makeCreateClientImpl(store) })).json()
  assert.equal(eligible.ok, true)
  assert.equal(eligible.eligible, true)
  assert.equal(eligible.anchor.mastery_check_id, 'mastery-check:independent-mastery-v1:anchor')
  assert.equal(eligible.retention_delay_seconds, 86430)

  store.learning_evidence_events.push({
    event_id: 'retention-consumed-1',
    facilitator_id: facilitatorId,
    learner_id: learnerId,
    session_id: sessionId,
    lesson_key: 'generated/fractions.json',
    event_type: STAGE_7_EVIDENCE_EVENT_TYPES.RETENTION_CHECK_RESULT,
    retention_anchor_mastery_check_id: 'mastery-check:independent-mastery-v1:anchor',
    occurred_at: '2026-08-10T12:01:00.000Z',
  })
  const consumed = await (await POST(jsonRequest({
    action: 'check_retention_eligibility',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    learner_id: learnerId,
    lesson_key: 'generated/fractions.json',
    current_session_id: sessionId,
    now: '2026-08-10T12:02:00.000Z',
  }), { createClientImpl: makeCreateClientImpl(store) })).json()
  assert.equal(consumed.ok, true)
  assert.equal(consumed.eligible, false)
  assert.equal(consumed.reason, RETENTION_REASONS.ANCHOR_ALREADY_CONSUMED)

  const sameSessionStore = makeStore()
  await createEvidenceSession(sameSessionStore)
  sameSessionStore.learning_evidence_events.push({
    event_id: 'anchor-event-same-session',
    facilitator_id: facilitatorId,
    learner_id: learnerId,
    session_id: sessionId,
    lesson_key: 'generated/fractions.json',
    event_type: STAGE_6_EVIDENCE_EVENT_TYPES.MASTERY_CHECK_RESULT,
    mastery_check_id: 'mastery-check:independent-mastery-v1:same-session',
    mastery_outcome: MASTERY_OUTCOMES.INDEPENDENT_SUCCESS,
    occurred_at: '2026-08-09T12:00:00.000Z',
  })
  const sameSession = await (await POST(jsonRequest({
    action: 'check_retention_eligibility',
    schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
    learner_id: learnerId,
    lesson_key: 'generated/fractions.json',
    current_session_id: sessionId,
    now: '2026-08-10T12:02:00.000Z',
  }), { createClientImpl: makeCreateClientImpl(sameSessionStore) })).json()
  assert.equal(sameSession.ok, true)
  assert.equal(sameSession.eligible, false)
  assert.equal(sameSession.reason, RETENTION_REASONS.NOT_NEW_SESSION)
}))

test('client writer no-ops when disabled and suppresses duplicate local event writes', async () => {
  const disabled = new MasteryEvidenceClient({ enabled: false })
  const disabledResult = await disabled.recordSessionStarted()
  assert.equal(disabledResult.ok, false)
  assert.equal(disabled.status, MASTERY_EVIDENCE_STATUSES.UNAVAILABLE)

  const posted = []
  const client = new MasteryEvidenceClient({
    enabled: true,
    getAuthToken: async () => 'valid-token',
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      posted.push(body.action === 'record_event' ? body.idempotency_key : body.action)
      if (body.action === 'create_session') {
        return Response.json({
          ok: true,
          evidence_session: { id: 'evidence-session-1', evidence_status: MASTERY_EVIDENCE_STATUSES.PARTIAL },
          server_provenance: { provider: 'openai', model: 'gpt-test' },
        })
      }
      if (body.action === 'record_event') return Response.json({ ok: true, duplicate: false })
      return Response.json({ ok: true, evidence_session: { evidence_status: body.evidence_status } })
    },
  })

  client.initialize({
    sessionId,
    learnerId,
    lessonKey: 'generated/fractions.json',
    lessonData: { title: 'Fractions' },
    assessmentIsolation: {
      version: ASSESSMENT_ISOLATION_VERSION,
      status: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
      reservedAssessmentCount: 1,
    },
    baseline: {
      protocolVersion: BASELINE_PROTOCOL_VERSION,
      status: BASELINE_STATUSES.UNAVAILABLE,
      baselineItemCount: 0,
      reason: 'no_baseline_pool',
    },
    retention: {
      protocolVersion: RETENTION_PROTOCOL_VERSION,
    },
    startedAt: '2026-08-09T12:00:00.000Z',
  })
  await client.recordSessionStarted({ initialPhase: 'discussion' })
  await client.recordSessionStarted({ initialPhase: 'discussion' })

  assert.deepEqual(posted, [
    'create_session',
    'mastery-evidence-v1:session-row-1:session_started:session_started',
  ])
})

test('client writer records ordered stage 2 item and response evidence', async () => {
  const posted = []
  const client = new MasteryEvidenceClient({
    enabled: true,
    getAuthToken: async () => 'valid-token',
    now: () => '2026-08-09T12:00:00.000Z',
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      posted.push(body)
      if (body.action === 'create_session') {
        return Response.json({
          ok: true,
          evidence_session: { id: 'evidence-session-1', evidence_status: MASTERY_EVIDENCE_STATUSES.PARTIAL },
          server_provenance: { provider: 'openai', model: 'gpt-test' },
        })
      }
      if (body.action === 'record_event') return Response.json({ ok: true, duplicate: false })
      return Response.json({ ok: true, evidence_session: { evidence_status: body.evidence_status } })
    },
  })
  const question = { id: 'q1', type: 'fib', question: '2 + 2 = ___', answer: '4' }
  const fingerprint = createLegacyItemFingerprint({
    lessonKey: 'generated/fractions.json',
    phase: 'worksheet',
    item: question,
    questionIndex: 0,
  })

  client.initialize({
    sessionId,
    learnerId,
    lessonKey: 'generated/fractions.json',
    lessonData: { title: 'Fractions' },
    assessmentIsolation: {
      version: ASSESSMENT_ISOLATION_VERSION,
      status: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
      reservedAssessmentCount: 1,
    },
    baseline: {
      protocolVersion: BASELINE_PROTOCOL_VERSION,
      status: BASELINE_STATUSES.UNAVAILABLE,
      baselineItemCount: 0,
      reason: 'no_baseline_pool',
    },
    startedAt: '2026-08-09T12:00:00.000Z',
  })
  await client.recordItemPresented({
    phase: 'worksheet',
    itemId: fingerprint,
    itemPurpose: 'worksheet',
    itemExposureId: 'worksheet-run1-q1',
    identityItem: question,
    assessmentRole: ASSESSMENT_ROLES.INSTRUCTIONAL,
    evidencePurpose: BASELINE_EVIDENCE_PURPOSE,
    legacyItemFingerprint: fingerprint,
    questionIndex: 0,
    totalQuestions: 1,
  })
  await client.recordLearnerResponse({
    phase: 'worksheet',
    itemId: fingerprint,
    itemPurpose: 'worksheet',
    itemExposureId: 'worksheet-run1-q1',
    identityItem: question,
    assessmentRole: ASSESSMENT_ROLES.INSTRUCTIONAL,
    evidencePurpose: BASELINE_EVIDENCE_PURPOSE,
    legacyItemFingerprint: fingerprint,
    attemptNumber: 1,
    isFirstResponse: true,
    response: 'five',
  })
  await client.recordAnswerEvaluated({
    phase: 'worksheet',
    itemId: fingerprint,
    itemPurpose: 'worksheet',
    itemExposureId: 'worksheet-run1-q1',
    identityItem: question,
    assessmentRole: ASSESSMENT_ROLES.INSTRUCTIONAL,
    evidencePurpose: BASELINE_EVIDENCE_PURPOSE,
    legacyItemFingerprint: fingerprint,
    attemptNumber: 1,
    isFirstResponse: true,
    isCorrect: false,
    response: 'five',
    correctAnswer: '4',
  })
  await client.recordMasteryCheckResult({
    phase: 'test',
    itemPurpose: 'test',
    itemExposureId: 'test-run1-q1',
    identityItem: question,
    assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
    attemptNumber: 1,
    isFirstResponse: true,
    isCorrect: true,
    masteryCheckRole: MASTERY_CHECK_ROLES.INITIAL,
    independenceStatus: INDEPENDENCE_STATUSES.INDEPENDENT,
    independenceReason: 'eligible',
    masteryOutcome: MASTERY_OUTCOMES.INDEPENDENT_SUCCESS,
    response: '4',
    correctAnswer: '4',
  })
  await client.recordRetentionCheckResult({
    phase: 'idle',
    itemPurpose: 'retention',
    itemExposureId: 'retention-run1-q1',
    identityItem: question,
    assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
    attemptNumber: 1,
    isFirstResponse: true,
    isCorrect: true,
    retentionAnchorMasteryCheckId: 'mastery-check:independent-mastery-v1:def',
    retentionDelaySeconds: 90000,
    retentionQualificationStatus: RETENTION_QUALIFICATION_STATUSES.ELIGIBLE,
    retentionQualificationReason: RETENTION_REASONS.ELIGIBLE,
    retentionOutcome: RETENTION_OUTCOMES.RETAINED,
    independenceStatus: INDEPENDENCE_STATUSES.INDEPENDENT,
    independenceReason: 'eligible',
    response: '4',
    correctAnswer: '4',
  })

  const events = posted.filter((body) => body.action === 'record_event')
  const createSession = posted.find((body) => body.action === 'create_session')
  assert.equal(createSession.lesson_key, 'generated/fractions.json')
  assert.equal(createSession.stable_lesson_key, 'generated/fractions')
  assert.equal(createSession.identity_schema_version, MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION)
  assert.equal(createSession.lesson_identity_version, LESSON_IDENTITY_VERSION)
  assert.equal(createSession.teaching_protocol_version, TEACHING_PROTOCOL_VERSION)
  assert.equal(createSession.assessment_isolation_version, ASSESSMENT_ISOLATION_VERSION)
  assert.equal(createSession.assessment_isolation_status, ASSESSMENT_ISOLATION_STATUSES.ISOLATED)
  assert.equal(createSession.reserved_assessment_count, 1)
  assert.equal(createSession.baseline_protocol_version, BASELINE_PROTOCOL_VERSION)
  assert.equal(createSession.baseline_status, BASELINE_STATUSES.UNAVAILABLE)
  assert.equal(createSession.mastery_protocol_version, INDEPENDENT_MASTERY_PROTOCOL_VERSION)
  assert.equal(createSession.retention_protocol_version, RETENTION_PROTOCOL_VERSION)
  assert.deepEqual(events.map((event) => event.event_type), [
    STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED,
    STAGE_2_EVIDENCE_EVENT_TYPES.LEARNER_RESPONSE,
    STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_EVALUATED,
    STAGE_6_EVIDENCE_EVENT_TYPES.MASTERY_CHECK_RESULT,
    STAGE_7_EVIDENCE_EVENT_TYPES.RETENTION_CHECK_RESULT,
  ])
  assert.deepEqual(events.map((event) => event.event_sequence), [1, 2, 3, 4, 5])
  assert.ok(events.every((event) => event.stable_item_id?.startsWith('item:item-identity-v1:')))
  assert.ok(events.every((event) => event.item_content_hash))
  assert.ok(events.every((event) => event.item_identity_version === ITEM_IDENTITY_VERSION))
  assert.ok(events.slice(0, 3).every((event) => event.assessment_role === ASSESSMENT_ROLES.INSTRUCTIONAL))
  assert.ok(events.slice(0, 3).every((event) => event.evidence_purpose === BASELINE_EVIDENCE_PURPOSE))
  assert.equal(events[3].assessment_role, ASSESSMENT_ROLES.ASSESSMENT_RESERVED)
  assert.equal(events[3].evidence_purpose, 'independent_mastery')
  assert.equal(events[3].mastery_protocol_version, INDEPENDENT_MASTERY_PROTOCOL_VERSION)
  assert.equal(events[3].mastery_check_role, MASTERY_CHECK_ROLES.INITIAL)
  assert.equal(events[3].independence_status, INDEPENDENCE_STATUSES.INDEPENDENT)
  assert.equal(events[3].mastery_outcome, MASTERY_OUTCOMES.INDEPENDENT_SUCCESS)
  assert.equal(events[4].assessment_role, ASSESSMENT_ROLES.ASSESSMENT_RESERVED)
  assert.equal(events[4].evidence_purpose, 'retention')
  assert.equal(events[4].retention_protocol_version, RETENTION_PROTOCOL_VERSION)
  assert.equal(events[4].retention_anchor_mastery_check_id, 'mastery-check:independent-mastery-v1:def')
  assert.equal(events[4].retention_delay_seconds, 90000)
  assert.equal(events[4].retention_qualification_status, RETENTION_QUALIFICATION_STATUSES.ELIGIBLE)
  assert.equal(events[4].retention_outcome, RETENTION_OUTCOMES.RETAINED)
  assert.equal(events[1].attempt_number, 1)
  assert.equal(events[1].is_first_response, true)
  assert.equal(events[2].result.correct, false)
})

test('client writer marks repeated reserved assessment item presentation as pre-exposed', async () => {
  const posted = []
  const client = new MasteryEvidenceClient({
    enabled: true,
    getAuthToken: async () => 'valid-token',
    now: () => '2026-08-09T12:00:00.000Z',
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      posted.push(body)
      if (body.action === 'create_session') {
        return Response.json({
          ok: true,
          evidence_session: { id: 'evidence-session-1', evidence_status: MASTERY_EVIDENCE_STATUSES.PARTIAL },
          server_provenance: { provider: 'openai', model: 'gpt-test' },
        })
      }
      if (body.action === 'record_event') return Response.json({ ok: true, duplicate: false })
      return Response.json({ ok: true, evidence_session: { evidence_status: body.evidence_status } })
    },
  })
  const reservedQuestion = {
    id: 'test-q1',
    type: 'short',
    question: 'Explain the reserved assessment idea.',
    answer: 'reserved answer',
  }
  const fingerprint = createLegacyItemFingerprint({
    lessonKey: 'generated/fractions.json',
    phase: 'test',
    item: reservedQuestion,
    questionIndex: 0,
  })

  client.initialize({
    sessionId,
    learnerId,
    lessonKey: 'generated/fractions.json',
    lessonData: { title: 'Fractions' },
    assessmentIsolation: {
      version: ASSESSMENT_ISOLATION_VERSION,
      status: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
      reservedAssessmentCount: 1,
    },
    startedAt: '2026-08-09T12:00:00.000Z',
  })
  await client.recordItemPresented({
    phase: 'test',
    itemId: fingerprint,
    itemPurpose: 'test',
    itemExposureId: 'test-run1-q1',
    identityItem: reservedQuestion,
    assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
    legacyItemFingerprint: fingerprint,
    questionIndex: 0,
    totalQuestions: 1,
  })
  await client.recordItemPresented({
    phase: 'test',
    itemId: fingerprint,
    itemPurpose: 'test',
    itemExposureId: 'test-run2-q1',
    identityItem: reservedQuestion,
    assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
    legacyItemFingerprint: fingerprint,
    questionIndex: 0,
    totalQuestions: 1,
  })

  const events = posted.filter((body) => body.action === 'record_event')
  assert.equal(events.length, 2)
  assert.equal(events[0].assessment_role, ASSESSMENT_ROLES.ASSESSMENT_RESERVED)
  assert.equal(events[0].pre_assessment_exposed, false)
  assert.equal(events[1].assessment_role, ASSESSMENT_ROLES.ASSESSMENT_RESERVED)
  assert.equal(events[1].pre_assessment_exposed, true)
})
