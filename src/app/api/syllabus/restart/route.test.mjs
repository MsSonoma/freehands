import assert from 'node:assert/strict'
import test from 'node:test'
import { POST as restart } from './route.js'
import { POST as authorize } from '../execution/route.js'
import { POST as start } from '../execution/start/route.js'
import { readSyllabusExecutionProof, executionProofMatches } from '../../../lib/syllabus/executionAuthorization.server.mjs'

const owner = '11111111-1111-4111-8111-111111111111'
const learner = '22222222-2222-4222-8222-222222222222'
const attempt = '33333333-3333-4333-8333-333333333333'
const lessonKey = 'generated/lesson.json'
const now = new Date('2026-11-02T15:00:00.000Z')
const proofSecret = 'test-only-restart-proof'
const requestContext = { user: { id: owner }, admin: {} }

function makeRequest(teacher = 'webb') {
  return new Request('https://example.invalid/api/syllabus/restart', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ learnerId: learner, lessonKey, occurrenceId: 'syllabus:existing', instructionalTeacher: teacher }),
  })
}

test('restart grants a distinct signed attempt and preserves the original lesson key', async () => {
  const operations = []
  const response = await restart(makeRequest(), {
    requestContext, now, proofSecret, randomUUID: () => attempt,
    repository: {},
    verifyFacilitatorLessonAccess: async () => ({ ok: true }),
    resolveSyllabusExecution: async ({ learnerId, lessonKey: requested, occurrenceId }) => {
      assert.equal(learnerId, learner)
      assert.equal(requested, lessonKey)
      assert.equal(occurrenceId, 'syllabus:existing')
      return { scope: { lessonKey }, calendar: { today: '2026-11-02' } }
    },
    releasePreviousAttempt: async (_admin, learnerId, previousKey) => {
      operations.push([learnerId, previousKey])
    },
  })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.lessonKey, lessonKey)
  assert.equal(data.occurrenceId, `restart:${attempt}`)
  assert.equal(data.instructionalTeacher, 'webb')
  assert.deepEqual(operations, [[learner, lessonKey]])
  const cookie = response.cookies.get('syllabus_execution')?.value
  const proof = readSyllabusExecutionProof(cookie, proofSecret, now)
  assert.equal(proof?.restart, true)
  assert.equal(executionProofMatches(proof, {
    facilitatorId: owner, learnerId: learner, lessonKey,
    occurrenceId: data.occurrenceId, instructionalTeacher: 'webb', today: '2026-11-02',
  }), true)

  const authorizeResponse = await authorize(new Request('https://example.invalid/api/syllabus/execution', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `syllabus_execution=${cookie}` },
    body: JSON.stringify({ learnerId: learner, lessonKey, occurrenceId: data.occurrenceId, instructionalTeacher: 'webb' }),
  }), { requestContext, now, proofSecret, repository: {} })
  assert.equal(authorizeResponse.status, 200)
  assert.equal((await authorizeResponse.json()).resumeBrowserSessionId, null)
  const freshBrowserSessionId = '44444444-4444-4444-8444-444444444444'
  let startedWith = null
  const started = await start(new Request('https://example.invalid/api/syllabus/execution/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `syllabus_execution=${cookie}` },
    body: JSON.stringify({ learnerId: learner, lessonId: lessonKey,
      browserSessionId: freshBrowserSessionId, occurrenceId: data.occurrenceId, instructionalTeacher: 'webb' }),
  }), { requestContext, now, proofSecret,
    repository: { findOwnedLearner: async () => ({ id: learner }) },
    startSessionTransaction: async (_admin, values) => {
      startedWith = values
      return { id: '55555555-5555-4555-8555-555555555555', conflict: false }
    },
  })
  assert.equal(started.status, 200)
  assert.equal(startedWith.p_browser_session_id, freshBrowserSessionId)
  assert.equal(startedWith.p_syllabus_occurrence_id, data.occurrenceId)
  assert.equal(startedWith.p_instructional_teacher, 'webb')
})

test('invalid teacher does not release existing progress', async () => {
  let changed = false
  const response = await restart(makeRequest('other'), {
    requestContext, now, proofSecret, repository: {},
    resolveSyllabusExecution: async () => { throw new Error('should not resolve') },
    releasePreviousAttempt: async () => { changed = true },
  })
  assert.equal(response.status, 400)
  assert.equal(changed, false)
})

test('restart fails without issuing a new attempt when evidence release fails', async () => {
  const response = await restart(makeRequest(), {
    requestContext, now, proofSecret, randomUUID: () => attempt, repository: {},
    verifyFacilitatorLessonAccess: async () => ({ ok: true }),
    resolveSyllabusExecution: async () => ({ scope: { lessonKey }, calendar: { today: '2026-11-02' } }),
    releasePreviousAttempt: async () => { throw new Error('Save unavailable') },
  })
  assert.equal(response.status, 500)
  assert.equal(response.cookies.get('syllabus_execution'), undefined)
})

test('a lesson requiring educator review is not restarted or released', async () => {
  let releaseCalls = 0
  const response = await restart(makeRequest(), {
    requestContext, now, proofSecret, repository: {},
    resolveSyllabusExecution: async () => ({ scope: { lessonKey }, calendar: { today: '2026-11-02' } }),
    verifyFacilitatorLessonAccess: async () => ({ ok: false, error: 'Review and approve this lesson before starting a new attempt.' }),
    releasePreviousAttempt: async () => { releaseCalls += 1 },
  })
  assert.equal(response.status, 409)
  assert.equal((await response.json()).code, 'LESSON_REVIEW_REQUIRED')
  assert.equal(releaseCalls, 0)
})

test('the database release and historical interruption event are one restricted transaction', async () => {
  const fs = await import('node:fs')
  const sql = fs.readFileSync(new URL('../../../../../supabase/migrations/20261102104500_facilitator_restart_session_transaction.sql', import.meta.url), 'utf8')
  assert.match(sql, /create or replace function public\.release_lesson_sessions_for_facilitator_restart/)
  assert.match(sql, /update public\.lesson_sessions[\s\S]*?ended_reason = 'released'/)
  assert.match(sql, /insert into public\.lesson_session_events[\s\S]*?'restarted'/)
  assert.match(sql, /grant execute on function public\.release_lesson_sessions_for_facilitator_restart\(uuid, text\)[\s\S]*?to service_role/)
})
