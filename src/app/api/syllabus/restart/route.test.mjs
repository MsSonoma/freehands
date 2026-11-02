import assert from 'node:assert/strict'
import test from 'node:test'
import { POST as restart } from './route.js'

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

test('restart saves a new learner-facing occurrence without launching a facilitator session', async () => {
  const operations = []
  const response = await restart(makeRequest(), {
    requestContext, now, randomUUID: () => attempt,
    repository: {}, verifyFacilitatorLessonAccess: async () => ({ ok: true }),
    resolveSyllabusExecution: async () => ({ scope: { lessonKey }, calendar: { today: '2026-11-02' } }),
    createRestartIntent: async (record) => { operations.push({ type: 'save', record }); return { id: record.id } },
    releasePreviousAttempt: async () => { operations.push({ type: 'release' }) },
  })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.occurrenceId, `restart:${attempt}`)
  assert.equal(data.scheduledDate, '2026-11-02')
  assert.equal(data.instructionalTeacher, 'webb')
  assert.equal(operations[0].record.lesson_key, lessonKey)
  assert.equal(operations[0].record.instructional_teacher, 'webb')
  assert.equal(operations[0].record.learner_id, learner)
  assert.deepEqual(operations.map(item => item.type), ['save', 'release'])
  assert.equal(response.cookies.get('syllabus_execution'), undefined)
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
