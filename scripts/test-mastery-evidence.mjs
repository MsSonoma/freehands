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
} from '../src/app/lib/masteryEvidence/constants.js'
import { createLegacyItemFingerprint } from '../src/app/lib/masteryEvidence/items.js'

const facilitatorId = '11111111-1111-1111-1111-111111111111'
const learnerId = '22222222-2222-2222-2222-222222222222'
const sessionId = 'session-row-1'

function jsonRequest(body, { token = 'valid-token', method = 'POST', url = 'https://mssonoma.app/api/evidence' } = {}) {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
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
  }
  process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED = 'true'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.SONOMA_PROVIDER = 'openai'
  process.env.SONOMA_OPENAI_MODEL = 'gpt-test'
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
    session_id: sessionId,
    learner_id: learnerId,
    lesson_key: 'generated/fractions.json',
    lesson_id: 'fractions.json',
    lesson_source: 'generated',
    teaching_protocol_version: 'session-v2',
    started_at: '2026-08-09T12:00:00.000Z',
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
  assert.equal(result.evidence_session.provider, 'openai')
  assert.equal(result.evidence_session.model, 'gpt-test')
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
    item_id: 'legacy:abc123',
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
    startedAt: '2026-08-09T12:00:00.000Z',
  })
  await client.recordItemPresented({
    phase: 'worksheet',
    itemId: fingerprint,
    itemPurpose: 'worksheet',
    itemExposureId: 'worksheet-run1-q1',
    legacyItemFingerprint: fingerprint,
    questionIndex: 0,
    totalQuestions: 1,
  })
  await client.recordLearnerResponse({
    phase: 'worksheet',
    itemId: fingerprint,
    itemPurpose: 'worksheet',
    itemExposureId: 'worksheet-run1-q1',
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
    legacyItemFingerprint: fingerprint,
    attemptNumber: 1,
    isFirstResponse: true,
    isCorrect: false,
    response: 'five',
    correctAnswer: '4',
  })

  const events = posted.filter((body) => body.action === 'record_event')
  assert.deepEqual(events.map((event) => event.event_type), [
    STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED,
    STAGE_2_EVIDENCE_EVENT_TYPES.LEARNER_RESPONSE,
    STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_EVALUATED,
  ])
  assert.deepEqual(events.map((event) => event.event_sequence), [1, 2, 3])
  assert.equal(events[1].attempt_number, 1)
  assert.equal(events[1].is_first_response, true)
  assert.equal(events[2].result.correct, false)
})
