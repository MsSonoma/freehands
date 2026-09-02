import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { GET } from '../../../api/facilitator/learners/[id]/lesson-history/[occurrenceId]/route.js'
import { loadSyllabusOccurrenceHistory } from '../occurrenceHistory.server.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = '22222222-2222-4222-8222-222222222222'
const OTHER_LEARNER = '33333333-3333-4333-8333-333333333333'
const LESSON = 'generated/multiplying-fractions.json'

function evidenceSession({ id, sessionId, browserSessionId, learnerId = LEARNER, occurrenceId = null }) {
  return {
    id, facilitator_id: FACILITATOR, learner_id: learnerId, session_id: sessionId,
    browser_session_id: browserSessionId, lesson_key: LESSON, stable_lesson_key: LESSON,
    syllabus_occurrence_id: occurrenceId, evidence_status: 'complete',
    mastery_protocol_version: 'independent-mastery-v1', retention_protocol_version: 'retention-v1',
    started_at: '2026-08-10T14:00:00.000Z', ended_at: '2026-08-10T15:00:00.000Z',
  }
}

function masteryEvent({ id, evidenceId, sessionId, masteryCheckId, outcome = 'independent_success', learnerId = LEARNER }) {
  return {
    event_id: id, event_type: 'mastery_check_result', evidence_session_id: evidenceId,
    session_id: sessionId, facilitator_id: FACILITATOR, learner_id: learnerId,
    occurred_at: '2026-08-10T14:45:00.000Z', mastery_protocol_version: 'independent-mastery-v1',
    mastery_check_id: masteryCheckId, mastery_check_role: 'initial', independence_status: 'independent',
    mastery_outcome: outcome, payload: { answer_key: 'never-send-this-answer' },
  }
}

function repository(overrides = {}) {
  const state = {
    historyReads: 0,
    writes: 0,
    authority: {
      syllabusMembership: ['association-1'], activeRevisionId: 'revision-1', completion: ['session-a', 'session-b'],
      sessions: ['session-a', 'session-b'], schedule: [], mastery: ['check-a', 'check-b'], forecastProposals: [],
    },
  }
  const sessions = overrides.sessions ?? [
    { id: 'session-a', session_id: 'browser-a', lesson_id: LESSON, instructional_teacher: 'webb', started_at: '2026-08-10T14:00:00Z', ended_at: '2026-08-10T15:00:00Z' },
    { id: 'session-b', session_id: 'browser-b', lesson_id: LESSON, instructional_teacher: 'sonoma', started_at: '2026-08-17T14:00:00Z', ended_at: '2026-08-17T15:00:00Z' },
  ]
  const sessionEvents = overrides.sessionEvents ?? [
    { id: 'event-a', session_id: 'session-a', lesson_id: LESSON, event_type: 'completed', occurred_at: '2026-08-10T15:00:00Z', metadata: { syllabus_occurrence_id: 'syllabus:repeat-a' } },
    { id: 'event-b', session_id: 'session-b', lesson_id: LESSON, event_type: 'completed', occurred_at: '2026-08-17T15:00:00Z', metadata: { syllabus_occurrence_id: 'syllabus:repeat-b' } },
  ]
  const evidence = overrides.evidence ?? [
    evidenceSession({ id: 'evidence-a', sessionId: 'session-a', browserSessionId: 'browser-a' }),
    evidenceSession({ id: 'evidence-b', sessionId: 'session-b', browserSessionId: 'browser-b' }),
  ]
  const evidenceEvents = overrides.evidenceEvents ?? [
    masteryEvent({ id: 'mastery-a', evidenceId: 'evidence-a', sessionId: 'session-a', masteryCheckId: 'check-a' }),
    masteryEvent({ id: 'mastery-b', evidenceId: 'evidence-b', sessionId: 'session-b', masteryCheckId: 'check-b', outcome: 'needs_recovery' }),
  ]
  return {
    state,
    async findOwnedLearner(learnerId, facilitatorId) {
      return learnerId === LEARNER && facilitatorId === FACILITATOR
        ? { id: LEARNER, name: 'Emma', approved_lessons: {} }
        : null
    },
    async findSyllabus() { return { id: 'syllabus-1', active_revision_id: 'revision-1' } },
    async findRevision() { return { id: 'revision-1', effective_from: '2026-08-01', weekly_pattern: { monday: [{ subject: 'math' }] } } },
    async findFacilitatorTimeZone() { return 'UTC' },
    async listForecastItems() { return overrides.forecastItems || [] },
    async listLessonAssociations() { return [{ id: 'association-1', lesson_key: LESSON, subject: 'math', title: 'Multiplying Fractions', instructional_teacher: 'sonoma', readiness_state: 'available' }] },
    async listLessonSchedule() { return [] },
    async listAllTrackedSessions() { state.historyReads += 1; return sessions },
    async listAllLessonSessionEvents() { return sessionEvents },
    async listLegacyActivityRecords() { return overrides.legacyActivities || [] },
    async listEvidenceSessions(_facilitatorId, _learnerId, sessionIds) { return evidence.filter((row) => sessionIds.includes(row.session_id)) },
    async listAllSlateEvidenceSessions() { return overrides.slateEvidence || [] },
    async listEvidenceEvents(_facilitatorId, _learnerId, evidenceIds) { return evidenceEvents.filter((row) => evidenceIds.includes(row.evidence_session_id)) },
    async listAllLearningReviewRuns() { return overrides.reviewRuns || [] },
    async listLearningReviewItems() { return overrides.reviewItems || [] },
    async listLearningReviewEvents() { return overrides.reviewEvents || [] },
  }
}

async function load(occurrenceId, options = {}) {
  return loadSyllabusOccurrenceHistory({
    repository: options.repository || repository(), admin: {}, facilitatorId: options.facilitatorId || FACILITATOR,
    learnerId: options.learnerId || LEARNER, occurrenceId,
    now: new Date('2026-08-31T12:00:00Z'), evidenceEnabled: options.evidenceEnabled ?? true,
    signTranscript: options.signTranscript || (async (_admin, _base, browserSessionId) => ({ kind: 'txt', url: `https://example.test/${browserSessionId || 'legacy'}` })),
  })
}

test('exact repeated occurrence resolves only its own canonical session, evidence, and transcript', async () => {
  const result = await load('actual:session-a')
  assert.equal(result.kind, 'ok')
  assert.equal(result.detail.occurrence.id, 'actual:session-a')
  assert.equal(result.detail.evidence.primary.session.id, 'session-a')
  assert.equal(result.detail.evidence.primary.independent_evidence.label, 'Demonstrated independently')
  assert.equal(result.detail.sessionRecords[0].transcript.url, 'https://example.test/browser-a')
  assert.doesNotMatch(JSON.stringify(result), /session-b|browser-b|check-b|never-send-this-answer|answer_key/)
})

test('same-title and same-lesson occurrences never cross-resolve', async () => {
  const first = await load('actual:session-a')
  const second = await load('actual:session-b')
  assert.equal(first.detail.occurrence.lessonTitle, second.detail.occurrence.lessonTitle)
  assert.equal(first.detail.evidence.primary.session.id, 'session-a')
  assert.equal(second.detail.evidence.primary.session.id, 'session-b')
  assert.notEqual(first.detail.evidence.primary.independent_evidence.state, second.detail.evidence.primary.independent_evidence.state)
})

test('learner isolation fails closed before history records are queried', async () => {
  const repo = repository()
  const result = await load('actual:session-a', { repository: repo, learnerId: OTHER_LEARNER })
  assert.deepEqual(result, { kind: 'not_found' })
  assert.equal(repo.state.historyReads, 0)
})

test('facilitator isolation fails closed before history records are queried', async () => {
  const repo = repository()
  const result = await load('actual:session-a', { repository: repo, facilitatorId: '44444444-4444-4444-8444-444444444444' })
  assert.deepEqual(result, { kind: 'not_found' })
  assert.equal(repo.state.historyReads, 0)
})

test('route returns the same non-disclosing 404 for unauthorized learner and unknown occurrence', async () => {
  const makeContext = (learnerId, occurrenceId, repo) => ({
    params: Promise.resolve({ id: learnerId, occurrenceId }),
    deps: { requestContext: { user: { id: FACILITATOR }, admin: {} }, repository: repo, evidenceEnabled: true, now: new Date('2026-08-31T12:00:00Z'), signTranscript: async () => null },
  })
  const request = new Request('https://example.test/api', { headers: { Authorization: 'Bearer test' } })
  const unauthorized = await GET(request, makeContext(OTHER_LEARNER, 'actual:session-a', repository()))
  const unknown = await GET(request, makeContext(LEARNER, 'actual:unknown', repository()))
  assert.equal(unauthorized.status, 404)
  assert.equal(unknown.status, 404)
  assert.deepEqual(await unauthorized.json(), await unknown.json())
})

test('missing evidence preserves legitimate session and transcript history', async () => {
  const result = await load('actual:session-a', { repository: repository({ evidence: [], evidenceEvents: [] }) })
  assert.equal(result.kind, 'ok')
  assert.equal(result.detail.evidence.primary, null)
  assert.equal(result.detail.sessionRecords.length, 1)
  assert.equal(result.detail.transcriptStatus, 'available')
})

test('missing transcript preserves deterministic evidence', async () => {
  const result = await load('actual:session-a', { signTranscript: async () => null })
  assert.equal(result.kind, 'ok')
  assert.equal(result.detail.evidence.primary.independent_evidence.label, 'Demonstrated independently')
  assert.equal(result.detail.sessionRecords.length, 0)
  assert.equal(result.detail.transcriptStatus, 'unavailable')
})

test('historical teacher comes from immutable canonical session authority', async () => {
  const result = await load('actual:session-a')
  assert.deepEqual(result.detail.occurrence.actualInstructionalTeacher, { id: 'webb', label: 'Mrs. Webb' })
})

test('Daily and Weekly reviews attach only through evidence mastery-check anchors', async () => {
  const reviewBase = { facilitator_id: FACILITATOR, learner_id: LEARNER, status: 'completed', protocol_version: 'v1', started_at: '2026-08-20T10:00:00Z' }
  const repo = repository({
    reviewRuns: [
      { ...reviewBase, id: 'daily', review_type: 'daily_followup' },
      { ...reviewBase, id: 'weekly', review_type: 'weekly_review' },
      { ...reviewBase, id: 'other', review_type: 'daily_followup' },
    ],
    reviewItems: [
      { id: 'daily-item', run_id: 'daily', lesson_key: LESSON, anchor_mastery_check_id: 'check-a' },
      { id: 'weekly-item', run_id: 'weekly', lesson_key: LESSON, anchor_mastery_check_id: 'check-a' },
      { id: 'other-item', run_id: 'other', lesson_key: LESSON, anchor_mastery_check_id: 'check-b' },
    ],
  })
  const result = await load('actual:session-a', { repository: repo })
  assert.deepEqual(result.detail.reviews.daily.map((report) => report.review.id), ['daily'])
  assert.deepEqual(result.detail.reviews.weekly.map((report) => report.review.id), ['weekly'])
})

test('Mr. Slate evidence remains separate and requires an exact occurrence anchor', async () => {
  const slateA = evidenceSession({ id: 'slate-a', sessionId: 'slate:one', browserSessionId: 'slate-browser-a', occurrenceId: 'syllabus:repeat-a' })
  const slateB = evidenceSession({ id: 'slate-b', sessionId: 'slate:two', browserSessionId: 'slate-browser-b', occurrenceId: 'syllabus:repeat-b' })
  const repo = repository({
    slateEvidence: [slateA, slateB],
    evidenceEvents: [
      masteryEvent({ id: 'mastery-a', evidenceId: 'evidence-a', sessionId: 'session-a', masteryCheckId: 'check-a' }),
      masteryEvent({ id: 'slate-event-a', evidenceId: 'slate-a', sessionId: 'slate:one', masteryCheckId: 'slate-check-a' }),
      masteryEvent({ id: 'slate-event-b', evidenceId: 'slate-b', sessionId: 'slate:two', masteryCheckId: 'slate-check-b' }),
    ],
  })
  const result = await load('actual:session-a', { repository: repo })
  assert.deepEqual(result.detail.evidence.slate.map((report) => report.session.id), ['slate:one'])
  assert.doesNotMatch(JSON.stringify(result), /slate:two|slate-browser-b|slate-check-b/)
})

test('legacy instructional occurrence resolves by exact historical id without a canonical session', async () => {
  const repo = repository({
    sessions: [], sessionEvents: [], evidence: [], evidenceEvents: [],
    legacyActivities: [{
      id: 'legacy-a', source_identity: 'source-a', facilitator_id: FACILITATOR, learner_id: LEARNER,
      lesson_key: LESSON, syllabus_occurrence_id: 'legacy-evidence:a', activity_type: 'instructional_completion',
      instructional_teacher: 'webb', occurred_at: '2026-07-10T15:00:00Z',
      provenance: 'server_verified_legacy_transcript_v1', evidence_reference: 'v1/f/l/webb/multiplying-fractions/ledger.json',
    }],
  })
  const result = await load('historical:legacy-a', { repository: repo })
  assert.equal(result.kind, 'ok')
  assert.equal(result.detail.occurrence.id, 'historical:legacy-a')
  assert.deepEqual(result.detail.occurrence.actualInstructionalTeacher, { id: 'webb', label: 'Mrs. Webb' })
})

test('standalone historical Slate-only activity cannot become instructional Review History', async () => {
  const repo = repository({
    sessions: [], sessionEvents: [], evidence: [], evidenceEvents: [],
    legacyActivities: [{
      id: 'slate-only', source_identity: 'slate-source', facilitator_id: FACILITATOR, learner_id: LEARNER,
      lesson_key: LESSON, syllabus_occurrence_id: 'slate:standalone', activity_type: 'slate_drill_completion',
      instructional_teacher: null, occurred_at: '2026-07-11T15:00:00Z',
      provenance: 'server_verified_legacy_transcript_v1', evidence_reference: 'v1/f/l/slate/multiplying-fractions/ledger.json',
    }],
  })
  assert.deepEqual(await load('historical:slate-only', { repository: repo }), { kind: 'not_found' })
})

test('future unmaterialized intent cannot fabricate occurrence history', async () => {
  const repo = repository({
    sessions: [], sessionEvents: [], evidence: [], evidenceEvents: [],
    forecastItems: [{ id: 'future-a', lineage_id: 'lineage-a', subject: 'math', title: 'Future fractions', planned_date: '2026-09-07', sort_order: 0, origin: 'learning_forecast' }],
  })
  assert.deepEqual(await load('syllabus:future-a', { repository: repo }), { kind: 'not_found' })
})

test('evidence failure is isolated from authorized occurrence and transcript history', async () => {
  const repo = repository()
  repo.listEvidenceSessions = async () => { throw new Error('evidence unavailable') }
  const result = await load('actual:session-a', { repository: repo })
  assert.equal(result.kind, 'ok')
  assert.equal(result.detail.evidence.status, 'unavailable')
  assert.equal(result.detail.sessionRecords.length, 1)
})

test('Review History reads leave every educational authority domain unchanged', async () => {
  const repo = repository()
  const before = structuredClone(repo.state.authority)
  const result = await load('actual:session-a', { repository: repo })
  assert.equal(result.kind, 'ok')
  assert.deepEqual(repo.state.authority, before)
  assert.equal(repo.state.writes, 0)
})

test('Review History integration is read-only, local, exact-identity, and race guarded', () => {
  const documentSource = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
  const pageSource = fs.readFileSync(path.resolve('src/app/facilitator/syllabus/page.js'), 'utf8')
  const overlaySource = fs.readFileSync(path.resolve('src/app/components/syllabus/LessonHistoryOverlay.js'), 'utf8')
  const routeSource = fs.readFileSync(path.resolve('src/app/api/facilitator/learners/[id]/lesson-history/[occurrenceId]/route.js'), 'utf8')
  assert.doesNotMatch(documentSource, /transcripts\?lessonKey/)
  assert.match(documentSource, /onReviewHistory\?\.\(item\)/)
  assert.match(documentSource, /\[learnerId, today\]/)
  assert.match(pageSource, /setHistoryOccurrenceId\(''\)/)
  assert.match(pageSource, /setPlanAheadOpen\(false\)[\s\S]*setHistoryOccurrenceId\(occurrenceId\)/)
  assert.match(overlaySource, /requestSequence\.current/)
  assert.match(overlaySource, /AbortController/)
  assert.match(overlaySource, /pageIdentity.*learnerId.*occurrenceId/)
  assert.match(overlaySource, /controller\.abort\(\)/)
  assert.match(overlaySource, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(overlaySource, /event\.key === 'Escape'/)
  assert.match(overlaySource, /role="dialog"/)
  assert.match(routeSource, /export async function GET/)
  assert.doesNotMatch(routeSource, /export async function (POST|PUT|PATCH|DELETE)/)
  assert.doesNotMatch(overlaySource, /mastery.*percent|transcript.*mastery|lessonKey=.*history/i)
  assert.match(pageSource, /planningRequest\.current/)
  assert.match(pageSource, /forecastAttempt\.current/)
})
