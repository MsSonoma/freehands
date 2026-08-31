import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { POST as recoverHistoricalActivity } from '../../../api/syllabus/historical-recovery/route.js'
import {
  recoverVerifiedLegacyEvidence,
  resolveSlateInstructionalDateAnchor,
  SERVER_VERIFIED_LEGACY_EVIDENCE_VERSION,
  SERVER_VERIFIED_LEGACY_OCCURRENCE_PREFIX,
  SERVER_VERIFIED_LEGACY_PROVENANCE,
  verifyLegacyTranscriptLedger,
} from '../legacyEvidenceRecovery.server.mjs'
import { SyllabusError } from '../schema.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MIGRATION_PATH = path.resolve('supabase/migrations/20260830192812_add_server_verified_legacy_evidence.sql')

function webbLedger(overrides = {}) {
  return [{
    startedAt: '2026-08-27T14:22:42.616Z',
    completedAt: '2026-08-27T15:50:27.408Z',
    lines: [{
      role: 'assistant',
      text: "Fantastic work! You've completed Grammar — your essay is something to be really proud of. I'll see you next time!",
    }],
    ...overrides,
  }]
}

function slateLedger(overrides = {}) {
  return [{
    startedAt: '2026-08-24T16:10:32.748Z',
    completedAt: '2026-08-24T16:10:32.749Z',
    lines: [
      { role: 'assistant', text: 'Q1: What is 4.2 + 1.7?' },
      { role: 'user', text: '5.9' },
    ],
    ...overrides,
  }]
}

function recoveryRepository({ sessions = [], events = [], timeZone = 'UTC' } = {}) {
  const rows = new Map()
  return {
    rows,
    async findOwnedLearner(learnerId, facilitatorId) {
      return learnerId === LEARNER && facilitatorId === FACILITATOR
        ? { id: LEARNER, facilitator_id: FACILITATOR }
        : null
    },
    async findFacilitatorTimeZone() { return timeZone },
    async listAllTrackedSessions() { return structuredClone(sessions) },
    async listAllLessonSessionEvents() { return structuredClone(events) },
    async insertLegacyActivityRecord(row) {
      const existing = rows.get(row.source_identity)
      if (existing) return structuredClone(existing)
      const stored = { id: `history-${rows.size + 1}`, ...structuredClone(row) }
      rows.set(row.source_identity, stored)
      return structuredClone(stored)
    },
  }
}

test('old Webb and Slate writer-specific completion signals are required', () => {
  const webb = verifyLegacyTranscriptLedger({ ledger: webbLedger(), teacher: 'webb' })
  const slate = verifyLegacyTranscriptLedger({ ledger: slateLedger(), teacher: 'slate' })
  assert.equal(webb.occurredAt, '2026-08-27T15:50:27.408Z')
  assert.equal(slate.occurredAt, '2026-08-24T16:10:32.749Z')
  assert.match(webb.evidenceDigest, /^[0-9a-f]{64}$/)
  assert.match(slate.evidenceDigest, /^[0-9a-f]{64}$/)

  assert.throws(
    () => verifyLegacyTranscriptLedger({ ledger: webbLedger({ lines: [{ role: 'assistant', text: 'Keep working.' }] }), teacher: 'webb' }),
    (error) => error.code === 'UNVERIFIED_LEGACY_EVIDENCE' && error.status === 422,
  )
  assert.throws(
    () => verifyLegacyTranscriptLedger({ ledger: slateLedger({ lines: [{ role: 'assistant', text: 'Drill opened.' }] }), teacher: 'slate' }),
    (error) => error.code === 'UNVERIFIED_LEGACY_EVIDENCE' && error.status === 422,
  )
})

test('multiple verified ledger segments fail closed instead of cross-binding a repeated lesson', () => {
  assert.throws(
    () => verifyLegacyTranscriptLedger({ ledger: [...slateLedger(), ...slateLedger({ startedAt: '2026-08-25T12:00:00Z', completedAt: '2026-08-25T12:30:00Z' })], teacher: 'slate' }),
    (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE' && error.status === 409,
  )
})

test('production-shaped repeated canonical history intersects the ambiguous Slate ledger only on Aug. 17', async () => {
  const lessonKey = 'generated/5_Multiplying_Fractions_intermediate.json'
  const ledger = [
    ...slateLedger({ startedAt: '2026-08-13T16:30:00Z', completedAt: '2026-08-13T16:56:25.756Z' }),
    ...slateLedger({ startedAt: '2026-08-13T16:58:00Z', completedAt: '2026-08-13T17:02:56.944Z' }),
    ...slateLedger({ startedAt: '2026-08-17T20:00:00Z', completedAt: '2026-08-17T20:26:39.243Z' }),
  ]
  assert.throws(
    () => verifyLegacyTranscriptLedger({ ledger, teacher: 'slate' }),
    (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE',
  )

  const repository = recoveryRepository({
    sessions: [
      { id: 'session-jul-14', lesson_id: lessonKey, started_at: '2026-07-14T19:00:00Z' },
      { id: 'session-jul-31', lesson_id: lessonKey, started_at: '2026-07-31T18:00:00Z' },
      { id: 'session-aug-1', lesson_id: lessonKey, started_at: '2026-08-01T18:00:00Z' },
      { id: 'session-aug-17', lesson_id: lessonKey, started_at: '2026-08-17T19:00:00Z' },
    ],
    events: [
      { session_id: 'session-jul-14', lesson_id: lessonKey, event_type: 'incomplete', occurred_at: '2026-07-14T20:00:00Z' },
      { session_id: 'session-jul-31', lesson_id: lessonKey, event_type: 'completed', occurred_at: '2026-07-31T19:15:10.210Z' },
      { session_id: 'session-aug-1', lesson_id: lessonKey, event_type: 'incomplete', occurred_at: '2026-08-01T19:00:00Z' },
      { session_id: 'session-aug-17', lesson_id: lessonKey, event_type: 'completed', occurred_at: '2026-08-17T21:54:41.372Z' },
    ],
  })
  const recovered = await recoverVerifiedLegacyEvidence({
    admin: {}, repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey, teacher: 'slate',
    loadLedger: async () => ledger,
  })
  assert.equal(recovered.occurred_at, '2026-08-17T20:26:39.243Z')
  assert.notEqual(recovered.occurred_at, '2026-08-13T16:56:25.756Z')
  assert.notEqual(recovered.occurred_at, '2026-08-13T17:02:56.944Z')
})

test('repeated canonical history resolves only a unique one-session one-segment date intersection', async () => {
  const lessonKey = 'generated/repeated-intersection.json'
  const session = (id, date) => ({ id, lesson_id: lessonKey, started_at: `${date}T09:00:00Z` })
  const completion = (id, sessionId, date) => ({
    id, session_id: sessionId, lesson_id: lessonKey, event_type: 'completed', occurred_at: `${date}T12:00:00Z`,
  })
  const canonicalSessions = [session('session-jul-31', '2026-07-31'), session('session-aug-17', '2026-08-17')]
  const canonicalEvents = [
    completion('event-jul-31', 'session-jul-31', '2026-07-31'),
    completion('event-aug-17', 'session-aug-17', '2026-08-17'),
  ]
  const resolve = (sessions, events, slate) => resolveSlateInstructionalDateAnchor({
    admin: {},
    repository: recoveryRepository({ sessions, events }),
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    lessonKey,
    slateLedger: slate,
    loadLedger: async () => [],
  })
  const slateSegment = (date, suffix = '10:30:00Z') => slateLedger({
    startedAt: `${date}T10:00:00Z`,
    completedAt: `${date}T${suffix}`,
  })

  assert.deepEqual(await resolve(canonicalSessions, canonicalEvents, [
    ...slateSegment('2026-08-13'),
    ...slateSegment('2026-08-17'),
  ]), {
    date: '2026-08-17',
    sources: ['canonical_slate_date_intersection'],
    timeZone: 'UTC',
  })

  await assert.rejects(resolve(canonicalSessions, canonicalEvents, [
    ...slateSegment('2026-07-31'),
    ...slateSegment('2026-08-17'),
  ]), (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR')

  await assert.rejects(resolve(canonicalSessions, canonicalEvents, [
    ...slateSegment('2026-08-13'),
    ...slateSegment('2026-08-19'),
  ]), (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR')

  await assert.rejects(resolve(canonicalSessions, canonicalEvents, [
    ...slateSegment('2026-08-13'),
    ...slateSegment('2026-08-17'),
    ...slateSegment('2026-08-17', '11:30:00Z'),
  ]), (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR')

  await assert.rejects(resolve([
    ...canonicalSessions,
    session('session-aug-17-b', '2026-08-17'),
  ], [
    ...canonicalEvents,
    completion('event-aug-17-b', 'session-aug-17-b', '2026-08-17'),
  ], [
    ...slateSegment('2026-08-13'),
    ...slateSegment('2026-08-17'),
  ]), (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR')
})

test('canonical Slate anchors require one explicitly completed terminal lifecycle', async () => {
  const lessonKey = 'generated/lifecycle-anchor.json'
  const resolve = (sessions, events) => resolveSlateInstructionalDateAnchor({
    admin: {},
    repository: recoveryRepository({ sessions, events }),
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    lessonKey,
    loadLedger: async () => [],
  })
  const session = { id: 'session-1', lesson_id: lessonKey, started_at: '2026-08-17T09:00:00Z' }
  const completed = { id: 'event-1', session_id: 'session-1', lesson_id: lessonKey, event_type: 'completed', occurred_at: '2026-08-17T12:00:00Z' }

  assert.deepEqual(await resolve([session], [completed]), {
    date: '2026-08-17',
    sources: ['canonical_instructional_completion'],
    timeZone: 'UTC',
  })
  assert.equal(await resolve([{ ...session, ended_at: '2026-08-17T12:00:00Z' }], []), null)
  assert.equal(await resolve([session], [
    completed,
    { id: 'event-2', session_id: 'session-1', lesson_id: lessonKey, event_type: 'incomplete', occurred_at: '2026-08-17T12:30:00Z' },
  ]), null)

  await assert.rejects(resolve([
    session,
    { ...session, id: 'session-2', started_at: '2026-08-18T09:00:00Z' },
  ], [
    completed,
    { id: 'event-2', session_id: 'session-2', lesson_id: lessonKey, event_type: 'completed', occurred_at: '2026-08-18T12:00:00Z' },
  ]), (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR' && error.status === 409)
})

test('canonical and verified Webb date anchors must form one complete agreeing date set', async () => {
  const lessonKey = 'generated/competing-anchor.json'
  const canonicalRepository = (date = '2026-08-17T12:00:00Z') => recoveryRepository({
    sessions: [{ id: 'session-1', lesson_id: lessonKey, started_at: '2026-08-17T09:00:00Z' }],
    events: [{ id: 'event-1', session_id: 'session-1', lesson_id: lessonKey, event_type: 'completed', occurred_at: date }],
  })
  const resolve = (repository, webb) => resolveSlateInstructionalDateAnchor({
    admin: {}, repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey,
    loadLedger: async () => webb || [],
  })

  assert.equal((await resolve(canonicalRepository(), null)).date, '2026-08-17')
  assert.equal((await resolve(recoveryRepository(), webbLedger({ startedAt: '2026-08-19T17:00:00Z', completedAt: '2026-08-19T17:46:05.427Z' }))).date, '2026-08-19')
  assert.deepEqual(await resolve(canonicalRepository(), webbLedger({ startedAt: '2026-08-17T17:00:00Z', completedAt: '2026-08-17T17:46:05.427Z' })), {
    date: '2026-08-17',
    sources: ['canonical_instructional_completion', 'verified_webb_instructional_completion'],
    timeZone: 'UTC',
  })
  await assert.rejects(
    resolve(canonicalRepository(), webbLedger({ startedAt: '2026-08-19T17:00:00Z', completedAt: '2026-08-19T17:46:05.427Z' })),
    (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR' && error.status === 409,
  )
})

test('ambiguous Webb instruction fails Slate anchoring closed while missing or unverified Webb remains unavailable', async () => {
  const lessonKey = 'generated/webb-anchor-authority.json'
  const canonicalRepository = recoveryRepository({
    sessions: [{ id: 'session-1', lesson_id: lessonKey, started_at: '2026-08-17T09:00:00Z' }],
    events: [{ id: 'event-1', session_id: 'session-1', lesson_id: lessonKey, event_type: 'completed', occurred_at: '2026-08-17T12:00:00Z' }],
  })
  const ambiguousWebb = [
    ...webbLedger({ startedAt: '2026-08-17T10:00:00Z', completedAt: '2026-08-17T10:30:00Z' }),
    ...webbLedger({ startedAt: '2026-08-19T10:00:00Z', completedAt: '2026-08-19T10:30:00Z' }),
  ]
  const resolve = (repository, loadLedger) => resolveSlateInstructionalDateAnchor({
    admin: {}, repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey, loadLedger,
  })

  await assert.rejects(
    resolve(canonicalRepository, async () => ambiguousWebb),
    (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR' && error.status === 409,
  )
  await assert.rejects(
    resolve(recoveryRepository(), async () => ambiguousWebb),
    (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR' && error.status === 409,
  )

  const canonicalWithMissingWebb = await resolve(canonicalRepository, async () => {
    throw new SyllabusError('Not found', 404, 'LEGACY_EVIDENCE_NOT_FOUND')
  })
  assert.equal(canonicalWithMissingWebb.date, '2026-08-17')
  assert.deepEqual(canonicalWithMissingWebb.sources, ['canonical_instructional_completion'])

  assert.equal(await resolve(recoveryRepository(), async () => webbLedger({
    lines: [{ role: 'assistant', text: 'Keep working.' }],
  })), null)
})

test('two completed Slate segments on the canonical instructional date remain ambiguous', async () => {
  const lessonKey = 'generated/repeated.json'
  const ledger = [
    ...slateLedger({ startedAt: '2026-08-17T10:00:00Z', completedAt: '2026-08-17T10:30:00Z' }),
    ...slateLedger({ startedAt: '2026-08-17T11:00:00Z', completedAt: '2026-08-17T11:30:00Z' }),
  ]
  const repository = recoveryRepository({
    sessions: [{ id: 'session-1', lesson_id: lessonKey, started_at: '2026-08-17T09:00:00Z' }],
    events: [{ session_id: 'session-1', lesson_id: lessonKey, event_type: 'completed', occurred_at: '2026-08-17T12:00:00Z' }],
  })
  await assert.rejects(recoverVerifiedLegacyEvidence({
    admin: {}, repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey, teacher: 'slate',
    loadLedger: async () => ledger,
  }), (error) => error.code === 'AMBIGUOUS_LEGACY_EVIDENCE')
  assert.equal(repository.rows.size, 0)
})

test('a uniquely verified historical Webb completion can anchor ambiguous Slate history', async () => {
  const lessonKey = 'generated/language-review.json'
  const slate = [
    ...slateLedger({ startedAt: '2026-08-18T10:00:00Z', completedAt: '2026-08-18T10:30:00Z' }),
    ...slateLedger({ startedAt: '2026-08-19T20:00:00Z', completedAt: '2026-08-19T20:10:02.770Z' }),
  ]
  const repository = recoveryRepository()
  const loadLedger = async (_admin, reference) => reference.includes('/webb/')
    ? webbLedger({ startedAt: '2026-08-19T17:00:00Z', completedAt: '2026-08-19T17:46:05.427Z' })
    : slate
  const anchor = await resolveSlateInstructionalDateAnchor({
    admin: {}, repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey, loadLedger,
  })
  assert.deepEqual(anchor, { date: '2026-08-19', sources: ['verified_webb_instructional_completion'], timeZone: 'UTC' })
  const recovered = await recoverVerifiedLegacyEvidence({
    admin: {}, repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey, teacher: 'slate', loadLedger,
  })
  assert.equal(recovered.occurred_at, '2026-08-19T20:10:02.770Z')
})

test('verified Webb recovery rejects canonical completion but not incomplete or in-progress instruction', async () => {
  const lessonKey = 'generated/webb-duplicate.json'
  const session = { id: 'session-1', lesson_id: lessonKey, started_at: '2026-08-17T09:00:00Z' }
  const recover = (repository) => recoverVerifiedLegacyEvidence({
    admin: {}, repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey, teacher: 'webb',
    loadLedger: async () => webbLedger(),
  })
  const completedEvent = {
    id: 'event-1', session_id: 'session-1', lesson_id: lessonKey, event_type: 'completed', occurred_at: '2026-08-17T12:00:00Z',
  }
  const completedRepository = recoveryRepository({ sessions: [session], events: [completedEvent] })
  const originalSession = structuredClone(session)
  const originalEvent = structuredClone(completedEvent)
  await assert.rejects(
    recover(completedRepository),
    (error) => error.code === 'CANONICAL_INSTRUCTION_ALREADY_COMPLETED' && error.status === 409,
  )
  assert.equal(completedRepository.rows.size, 0)
  assert.deepEqual(session, originalSession)
  assert.deepEqual(completedEvent, originalEvent)

  const incompleteRepository = recoveryRepository({
    sessions: [session],
    events: [{ ...completedEvent, event_type: 'incomplete' }],
  })
  assert.equal((await recover(incompleteRepository)).activity_type, 'instructional_completion')
  assert.equal(incompleteRepository.rows.size, 1)

  const inProgressRepository = recoveryRepository({ sessions: [session], events: [] })
  assert.equal((await recover(inProgressRepository)).instructional_teacher, 'webb')
  assert.equal(inProgressRepository.rows.size, 1)
})

test('server recovery derives deterministic evidence identity and is idempotent', async () => {
  const repository = recoveryRepository()
  const references = []
  const input = {
    admin: {},
    repository,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    lessonKey: 'generated/5_Grammar_Their_Theyre_There_intermediate.json',
    teacher: 'webb',
    loadLedger: async (_admin, reference) => {
      references.push(reference)
      return webbLedger()
    },
  }
  const first = await recoverVerifiedLegacyEvidence(input)
  const second = await recoverVerifiedLegacyEvidence(input)

  assert.equal(repository.rows.size, 1)
  assert.deepEqual(second, first)
  assert.match(first.syllabus_occurrence_id, new RegExp(`^${SERVER_VERIFIED_LEGACY_OCCURRENCE_PREFIX}[0-9a-f]{64}$`))
  assert.equal(first.provenance, SERVER_VERIFIED_LEGACY_PROVENANCE)
  assert.equal(first.evidence_version, SERVER_VERIFIED_LEGACY_EVIDENCE_VERSION)
  assert.equal(first.activity_type, 'instructional_completion')
  assert.equal(first.instructional_teacher, 'webb')
  assert.deepEqual(references, [
    `v1/${FACILITATOR}/${LEARNER}/webb/5_Grammar_Their_Theyre_There_intermediate/ledger.json`,
    `v1/${FACILITATOR}/${LEARNER}/webb/5_Grammar_Their_Theyre_There_intermediate/ledger.json`,
  ])
})

test('recovery route is ownership-bound and does not expose its private evidence reference', async () => {
  const repository = recoveryRepository()
  const response = await recoverHistoricalActivity(new Request('http://localhost/api/syllabus/historical-recovery', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      learnerId: LEARNER,
      lessonKey: 'generated/decimal.json',
      teacher: 'slate',
      occurrenceId: 'forged',
      provenance: 'forged',
      occurredAt: '2020-01-01T00:00:00Z',
      evidenceDigest: 'forged',
      evidenceReference: 'private/forged/ledger.json',
    }),
  }), {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository,
    loadLedger: async () => slateLedger(),
  })
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.historical_activity.activity_type, 'slate_drill_completion')
  assert.equal(payload.historical_activity.instructional_teacher, null)
  assert.equal(payload.historical_activity.occurred_at, '2026-08-24T16:10:32.749Z')
  assert.match(payload.historical_activity.syllabus_occurrence_id, /^legacy-evidence:/)
  assert.equal('evidence_reference' in payload.historical_activity, false)
  assert.notEqual(payload.historical_activity.syllabus_occurrence_id, 'forged')
  assert.equal(payload.historical_activity.provenance, SERVER_VERIFIED_LEGACY_PROVENANCE)

  const denied = await recoverHistoricalActivity(new Request('http://localhost/api/syllabus/historical-recovery', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ learnerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', lessonKey: 'generated/decimal.json', teacher: 'slate' }),
  }), {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository,
    loadLedger: async () => slateLedger(),
  })
  assert.equal(denied.status, 404)
  assert.equal((await denied.json()).code, 'LEARNER_NOT_FOUND')
})

test('recovery path cannot create membership, canonical instruction, mastery, retention, or execution authority', () => {
  const recovery = fs.readFileSync(path.resolve('src/app/lib/syllabus/legacyEvidenceRecovery.server.mjs'), 'utf8')
  const route = fs.readFileSync(path.resolve('src/app/api/syllabus/historical-recovery/route.js'), 'utf8')
  const execution = fs.readFileSync(path.resolve('src/app/lib/syllabus/executionAuthorization.server.mjs'), 'utf8')
  const manual = fs.readFileSync(path.resolve('src/app/api/syllabus/historical-activities/route.js'), 'utf8')

  assert.match(recovery, /insertLegacyActivityRecord/)
  assert.doesNotMatch(recovery, /syllabus_lesson_associations|lesson_sessions|lesson_session_events|learning_evidence|insertForecast|lesson_schedule/)
  assert.doesNotMatch(route, /requireHistoricalSyllabusOccurrence|occurrenceId: body/)
  assert.match(manual, /requireHistoricalSyllabusOccurrence/)
  assert.doesNotMatch(execution, /legacyActivities|listLegacyActivityRecords/)
  const document = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
  const learnerPage = fs.readFileSync(path.resolve('src/app/learn/LearnerHome.js'), 'utf8')
  assert.doesNotMatch(document, /historical-recovery/)
  assert.doesNotMatch(learnerPage, /historical-recovery/)
})

test('additive migration constrains verified evidence and contains no backfill or canonical DML', () => {
  const bytes = fs.readFileSync(MIGRATION_PATH)
  const sql = bytes.toString('utf8')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '2fc6a9411475483f53fd86572fa8408522a8b41f73417adea79e8f29f13d36d7')
  assert.match(sql, /add column evidence_reference text/i)
  assert.match(sql, /provenance = 'server_verified_legacy_transcript_v1'/i)
  assert.match(sql, /activity_type = 'instructional_completion' and instructional_teacher = 'webb'/i)
  assert.match(sql, /activity_type = 'slate_drill_completion' and instructional_teacher is null/i)
  assert.match(sql, /evidence_version = 'pre_occurrence_transcript_ledger_v1'/i)
  assert.match(sql, /evidence_digest ~ '\^\[0-9a-f\]\{64\}\$'/i)
  assert.match(sql, /syllabus_occurrence_id ~ '\^legacy-evidence:\[0-9a-f\]\{64\}\$'/i)
  assert.doesNotMatch(sql, /\b(insert into|update|delete from)\b/i)
  assert.doesNotMatch(sql, /learning_evidence|lesson_sessions|lesson_session_events|syllabus_lesson_associations/i)
})
