import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { POST as completeExecution } from '../../../api/syllabus/execution/complete/route.js'
import { composeSyllabusLessonTimeline } from '../lessonTimeline.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SESSION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function request(body) {
  return new Request('http://localhost/api/syllabus/execution/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })
}

function deps(transaction, owned = true) {
  return {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository: { async findOwnedLearner() { return owned ? { id: LEARNER } : null } },
    completeSessionTransaction: transaction,
  }
}

const validBody = {
  sessionId: SESSION,
  learnerId: LEARNER,
  lessonId: 'language-arts/grammar.json',
  occurrenceId: 'syllabus:thursday-grammar',
  source: 'webb',
}

test('completion route owns, scopes, and forwards the exact canonical identities', async () => {
  const calls = []
  const response = await completeExecution(request(validBody), deps(async (_admin, values) => {
    calls.push(values)
    return { ok: true, state: 'completed', id: SESSION, eventId: 'event-1' }
  }))
  assert.equal(response.status, 200)
  assert.deepEqual(calls, [{
    p_session_id: SESSION,
    p_learner_id: LEARNER,
    p_lesson_id: 'language-arts/grammar.json',
    p_syllabus_occurrence_id: 'syllabus:thursday-grammar',
    p_source: 'webb',
    p_test_percentage: null,
  }])
})

test('completion route fails closed for ownership, missing occurrence, and transaction conflicts', async () => {
  const unauthorized = await completeExecution(request(validBody), deps(async () => ({ ok: true }), false))
  assert.equal(unauthorized.status, 403)
  const missing = await completeExecution(request({ ...validBody, occurrenceId: '' }), deps(async () => ({ ok: true })))
  assert.equal(missing.status, 400)
  const mismatch = await completeExecution(request(validBody), deps(async () => ({ ok: false, state: 'occurrence_mismatch' })))
  assert.equal(mismatch.status, 409)
})

test('transactional completion contract is idempotent and rolls back partial completion', () => {
  const migration = fs.readFileSync(path.resolve('supabase/migrations/20260828130000_transactional_lesson_session_completion.sql'), 'utf8')
  assert.match(migration, /from public\.lesson_sessions[\s\S]*for update/i)
  assert.match(migration, /new\.ended_at is distinct from old\.ended_at[\s\S]*current_user not in \('service_role', 'postgres'\)/i)
  assert.match(migration, /metadata ->> 'syllabus_occurrence_id' = btrim\(p_syllabus_occurrence_id\)/i)
  assert.match(migration, /if found then[\s\S]*'already_completed'/i)
  assert.match(migration, /update public\.lesson_sessions[\s\S]*insert into public\.lesson_session_events/i)
  assert.match(migration, /set search_path = ''/i)
  assert.match(migration, /revoke all on function public\.complete_lesson_session_transactional[\s\S]*public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.complete_lesson_session_transactional[\s\S]*to service_role/i)
  assert.match(migration, /revoke insert on table public\.lesson_session_events from authenticated/i)
})

test('Webb completion waits for canonical success while Slate never creates instructional completion', () => {
  const webb = fs.readFileSync(path.resolve('src/app/session/webb/page.jsx'), 'utf8')
  const completion = webb.slice(webb.indexOf('async function handleCompleteLesson'), webb.indexOf('// ── Article passage'))
  assert.ok(completion.indexOf('await endLessonSession') < completion.indexOf('saveWebbCompletion'))
  assert.match(completion, /if \(!completed\)[\s\S]*setCompletionState\('failed'\)[\s\S]*return/)
  assert.match(webb, /startProtectedInstructionalSession/)
  assert.match(webb, /canonicalSessionRef\.current = \{ id: tracked\.id,[^\n]*occurrenceId: tracked\.occurrenceId \}/)
  assert.match(webb, /Retry completion/)

  const slate = fs.readFileSync(path.resolve('src/app/session/slate/page.jsx'), 'utf8')
  assert.match(slate, /authorizeProtectedOccurrence/)
  assert.match(slate, /authorizedOccurrenceRef\.current = authorization\.occurrenceId/)
  assert.doesNotMatch(slate, /startProtectedInstructionalSession|startLessonSession|endLessonSession|complete_lesson_session/)
  assert.match(slate, /saveMastery/)
})

test('Sonoma success cleanup is downstream of canonical completion and exposes retry', () => {
  const sonoma = fs.readFileSync(path.resolve('src/app/session/v2/SessionPageV2.jsx'), 'utf8')
  const handler = sonoma.slice(sonoma.indexOf("orchestrator.on('sessionComplete'"), sonoma.indexOf("orchestrator.on('sessionComplete'") + 1600)
  assert.ok(handler.indexOf("await endTrackedSession('completed'") < handler.indexOf("setCurrentPhase('complete')"))
  assert.match(handler, /if \(!canonicalCompletion\)[\s\S]*setCompletionCommitState\('failed'\)[\s\S]*return/)
  assert.match(sonoma, /Retry completion/)
})

test('Webb canonical event creates one actual completion independent of browser cache', () => {
  const items = composeSyllabusLessonTimeline({
    learnerId: LEARNER,
    syllabus: { id: 'syllabus-1' },
    activeRevision: { id: 'revision-1', effective_from: '2026-08-01', weekly_pattern: {} },
    forecastItems: [{ id: 'forecast-1', lineage_id: 'lineage-1', lesson_key: 'language-arts/grammar.json', subject: 'language arts', title: "Grammar: Their, They're, There", planned_date: '2026-08-27', sort_order: 0 }],
    sessions: [{ id: SESSION, learner_id: LEARNER, lesson_id: 'language-arts/grammar.json', started_at: '2026-08-27T14:22:42.616Z', ended_at: '2026-08-27T15:50:27.408Z' }],
    sessionEvents: [{ id: 'event-1', session_id: SESSION, learner_id: LEARNER, lesson_id: 'language-arts/grammar.json', event_type: 'completed', occurred_at: '2026-08-27T15:50:27.408Z', metadata: { source: 'webb', syllabus_occurrence_id: 'syllabus:thursday-grammar' } }],
    lessonAssociations: [{ lesson_key: 'language-arts/grammar.json', subject: 'language arts', title: "Grammar: Their, They're, There", readiness_state: 'available' }],
    lessonSchedule: [],
    today: '2026-08-28',
  })
  const actual = items.filter((item) => item.occurrence_id === `actual:${SESSION}`)
  assert.equal(actual.length, 1)
  assert.equal(actual[0].actual_kind, 'completed')
  assert.equal(actual[0].planned_date, '2026-08-27')
})
