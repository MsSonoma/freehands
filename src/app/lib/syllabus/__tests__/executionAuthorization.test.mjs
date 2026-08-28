import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { POST as authorizeExecution } from '../../../api/syllabus/execution/route.js'
import { POST as startExecution } from '../../../api/syllabus/execution/start/route.js'
import { requireProtectedSessionCreation } from '../../../session/v2/protectedSessionBoundary.mjs'
import { createSyllabusExecutionProof, resolveSyllabusExecution } from '../executionAuthorization.server.mjs'
import { getActiveSyllabus } from '../revisions.server.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function repository({ forecast = [], sessions = [], events = [], timezone = 'America/New_York' } = {}) {
  return {
    async findOwnedLearner(learnerId, facilitatorId) {
      return learnerId === LEARNER && facilitatorId === FACILITATOR ? { id: LEARNER, approved_lessons: {} } : null
    },
    async findFacilitatorTimeZone() { return timezone },
    async findSyllabus() { return { id: 'syllabus-1', active_revision_id: 'revision-1' } },
    async findRevision() {
      return { id: 'revision-1', effective_from: '2026-08-01', weekly_pattern: {
        sunday: [{ subject: 'math' }], monday: [{ subject: 'math' }], tuesday: [{ subject: 'math' }],
      } }
    },
    async listForecastItems() { return structuredClone(forecast) },
    async listLessonAssociations() { return forecast.map((item, index) => ({ id: index + 1, lesson_key: item.lesson_key, subject: item.subject, title: item.title, readiness_state: 'available' })) },
    async listLessonSchedule() { return [] },
    async listAllTrackedSessions() { return structuredClone(sessions) },
    async listAllLessonSessionEvents() { return structuredClone(events) },
  }
}

function forecast(id, lessonKey, date) {
  return { id, lineage_id: `${id}-lineage`, lesson_key: lessonKey, subject: 'math', title: id, planned_date: date, sort_order: 0, created_at: '2026-08-20T10:00:00Z' }
}

function request(body, cookie = '') {
  return new Request('http://localhost/api/syllabus/execution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
}

function executionCookie(scope, now = new Date('2026-08-23T16:00:00Z'), secret = 'test-secret') {
  return `syllabus_execution=${createSyllabusExecutionProof(scope, secret, now)}`
}

function fakeTransactionalStarter(active = [], options = {}) {
  const state = { active: structuredClone(active), created: [], ended: [], touched: [], calls: [] }
  let nextId = 1
  return {
    state,
    async start(_admin, values) {
      state.calls.push(structuredClone(values))
      if (options.beforeDecision) await options.beforeDecision(state, values)
      const current = state.active.find((row) => row.lesson_id === values.p_lesson_id && !row.ended_at)
      if (current?.session_id === values.p_browser_session_id) {
        for (const row of state.active.filter((item) => !item.ended_at && item.id !== current.id)) {
          row.ended_at = '2026-08-23T16:00:00.000Z'
          state.ended.push(row.id)
        }
        state.touched.push(current.id)
        return { state: 'reused', id: current.id, conflict: false, takeover: false }
      }
      if (current && !values.p_allow_takeover) {
        return { state: 'conflict', id: null, conflict: true, takeover: false, staleConflict: false, existingSession: structuredClone(current) }
      }
      if (current && values.p_expected_conflicting_session_id !== current.id) {
        return { state: 'conflict', id: null, conflict: true, takeover: false, staleConflict: true, existingSession: structuredClone(current) }
      }
      if (!current && values.p_allow_takeover && values.p_expected_conflicting_session_id) {
        return { state: 'conflict', id: null, conflict: true, takeover: false, staleConflict: true, existingSession: null }
      }

      const pendingEnded = state.active.filter((row) => !row.ended_at).map((row) => row.id)
      if (options.failInsert) throw new Error('insert failed')
      for (const id of pendingEnded) {
        const row = state.active.find((item) => item.id === id)
        row.ended_at = '2026-08-23T16:00:00.000Z'
        state.ended.push(id)
      }
      const row = {
        id: `dddddddd-dddd-4ddd-8ddd-${String(nextId++).padStart(12, '0')}`,
        learner_id: values.p_learner_id,
        lesson_id: values.p_lesson_id,
        session_id: values.p_browser_session_id,
      }
      state.active.push(row)
      state.created.push(row)
      return { state: current ? 'taken_over' : 'started', id: row.id, conflict: false, takeover: Boolean(current), replacedSessionId: current?.id || null }
    },
  }
}

function startDeps(transactionalStarter = fakeTransactionalStarter(), overrides = {}) {
  return {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
    repository: { async findOwnedLearner() { return { id: LEARNER } } },
    startSessionTransaction: transactionalStarter.start,
    now: new Date('2026-08-23T16:00:00Z'),
    proofSecret: 'test-secret',
    verifyFacilitatorPinForUser: async (_admin, _user, pin) => pin === '2468',
    ...overrides,
  }
}

test('today Syllabus occurrence is authorized without legacy availability or Calendar scheduling', async () => {
  const decision = await resolveSyllabusExecution({
    repository: repository({ forecast: [forecast('today', 'math/today.json', '2026-08-23')] }),
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    lessonKey: 'math/today.json',
    occurrenceId: 'syllabus:today',
    now: new Date('2026-08-23T16:00:00Z'),
  })
  assert.equal(decision.allowedWithoutPin, true)
  assert.equal(decision.reason, 'today')
})

test('local-calendar midnight authorization uses the profile timezone rather than UTC', async () => {
  const decision = await resolveSyllabusExecution({
    repository: repository({ forecast: [forecast('late-sunday', 'math/late.json', '2026-08-23')] }),
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    lessonKey: 'math/late.json',
    occurrenceId: 'syllabus:late-sunday',
    now: new Date('2026-08-24T02:30:00Z'),
  })
  assert.equal(decision.calendar.today, '2026-08-23')
  assert.equal(decision.allowedWithoutPin, true)
})

test('active read and execution resolution share stored metadata enrichment for actual history', async () => {
  const historyRepository = repository({
    sessions: [{ id: 'generated-history', lesson_id: 'generated/ocean-life.json', started_at: '2026-08-23T14:00:00Z' }],
  })
  const verifyLessonAccess = async ({ lessonKey, requireApproved }) => {
    assert.equal(lessonKey, 'generated/ocean-life.json')
    assert.equal(requireApproved, false)
    return { ok: true, lesson: { subject: 'marine biology', title: 'Life in a Tide Pool' } }
  }
  const active = await getActiveSyllabus({
    repository: historyRepository,
    admin: {},
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    now: new Date('2026-08-23T16:00:00Z'),
    verifyLessonAccess,
  })
  const decision = await resolveSyllabusExecution({
    repository: historyRepository,
    admin: {},
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    lessonKey: 'generated/ocean-life.json',
    occurrenceId: 'actual:generated-history',
    now: new Date('2026-08-23T16:00:00Z'),
    verifyLessonAccess,
  })
  assert.equal(active.timeline_items[0].subject, 'marine biology')
  assert.equal(active.timeline_items[0].title, 'Life in a Tide Pool')
  assert.equal(decision.occurrence.lesson_key, active.timeline_items[0].lesson_key)
  assert.equal(decision.occurrence.subject, active.timeline_items[0].subject)
  assert.equal(decision.occurrence.title, active.timeline_items[0].title)
  assert.equal(decision.occurrence.planned_date, active.timeline_items[0].planned_date)
  assert.equal(decision.occurrence.occurrence_id, active.timeline_items[0].occurrence_id)
})

test('historical artifact resolution failure leaves active reads on safe fallback metadata', async () => {
  const historyRepository = repository({
    sessions: [{ id: 'missing-history', lesson_id: 'generated/missing.json', started_at: '2026-08-23T14:00:00Z' }],
  })
  const active = await getActiveSyllabus({
    repository: historyRepository,
    admin: {},
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    now: new Date('2026-08-23T16:00:00Z'),
    verifyLessonAccess: async () => { throw new Error('missing artifact') },
  })
  assert.equal(active.timeline_items.length, 1)
  assert.equal(active.timeline_items[0].lesson_key, 'generated/missing.json')
  assert.equal(active.timeline_items[0].subject, 'general')
  assert.equal(active.timeline_items[0].occurrence_id, 'actual:missing-history')
})

test('no-active-Syllabus execution compatibility does not require artifact enrichment', async () => {
  let resolverCalls = 0
  const legacyRepository = {
    ...repository(),
    async findOwnedLearner() { return { id: LEARNER, approved_lessons: { 'generated/legacy.json': true } } },
    async findSyllabus() { return null },
  }
  const decision = await resolveSyllabusExecution({
    repository: legacyRepository,
    admin: {},
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    lessonKey: 'generated/legacy.json',
    now: new Date('2026-08-23T16:00:00Z'),
    verifyLessonAccess: async () => { resolverCalls += 1; return { ok: false } },
  })
  assert.equal(decision.reason, 'legacy_available')
  assert.equal(decision.allowedWithoutPin, true)
  assert.equal(resolverCalls, 0)
})

test('direct session authorization PIN-gates future and completed historical occurrences', async () => {
  const futureRepo = repository({ forecast: [forecast('future', 'math/future.json', '2026-08-25')] })
  const baseDeps = { requestContext: { user: { id: FACILITATOR }, admin: {} }, repository: futureRepo, now: new Date('2026-08-23T16:00:00Z'), proofSecret: 'test-secret', verifyFacilitatorPinForUser: async (_admin, _user, pin) => pin === '2468' }
  const body = { learnerId: LEARNER, lessonKey: 'math/future.json', occurrenceId: 'syllabus:future' }
  const missing = await authorizeExecution(request(body), baseDeps)
  assert.equal(missing.status, 409)
  assert.equal((await missing.json()).code, 'SYLLABUS_EXECUTION_PIN_REQUIRED')
  const invalid = await authorizeExecution(request({ ...body, exceptionPin: '0000', facilitatorSectionActive: true }), baseDeps)
  assert.equal(invalid.status, 403)
  assert.equal((await invalid.json()).code, 'INVALID_FACILITATOR_PIN')
  const allowed = await authorizeExecution(request({ ...body, exceptionPin: '2468' }), baseDeps)
  assert.equal(allowed.status, 200)
  const setCookie = allowed.headers.get('set-cookie') || ''
  assert.match(setCookie, /syllabus_execution=/i)
  assert.match(setCookie, /HttpOnly/i)
  assert.match(setCookie, /Path=\//i)

  const completedRepo = repository({
    sessions: [{ id: 'done', lesson_id: 'math/done.json', started_at: '2026-08-20T10:00:00Z', ended_at: '2026-08-20T11:00:00Z' }],
  })
  const completed = await authorizeExecution(request({ learnerId: LEARNER, lessonKey: 'math/done.json', occurrenceId: 'actual:done' }), { ...baseDeps, repository: completedRepo })
  assert.equal(completed.status, 409)
  assert.equal((await completed.json()).reason, 'completed_repeat')
})

test('protected start rejects raw takeover PIN and expired or missing scoped authorization', async () => {
  for (const [cookie, body] of [
    ['', { takeoverPin: '2468' }],
    ['', {}],
    [executionCookie({ facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today', today: '2026-08-23' }, new Date('2026-08-23T15:00:00Z')), {}],
  ]) {
    const sessions = fakeTransactionalStarter()
    const response = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ...body, occurrenceId: 'syllabus:today' }, cookie), startDeps(sessions))
    assert.equal(response.status, 403)
    assert.equal((await response.json()).code, 'SYLLABUS_EXECUTION_DENIED')
    assert.equal(sessions.state.calls.length, 0)
  }
})

test('no active session starts transactionally and a non-today authorization starts only through its scoped proof', async () => {
  const todayScope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today', today: '2026-08-23' }
  const todaySessions = fakeTransactionalStarter()
  const today = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', occurrenceId: 'syllabus:today' }, executionCookie(todayScope)), startDeps(todaySessions))
  assert.equal(today.status, 200)
  assert.ok((await today.json()).id)
  assert.equal(todaySessions.state.created.length, 1)
  assert.equal(todaySessions.state.calls[0].p_allow_takeover, false)
  assert.equal(todaySessions.state.calls[0].p_syllabus_occurrence_id, 'syllabus:today')

  const futureRepo = repository({ forecast: [forecast('future-proof', 'math/future.json', '2026-08-25')] })
  const authorize = await authorizeExecution(request({ learnerId: LEARNER, lessonKey: 'math/future.json', occurrenceId: 'syllabus:future-proof', exceptionPin: '2468' }), {
    ...startDeps(fakeTransactionalStarter()), repository: futureRepo,
  })
  assert.equal(authorize.status, 200)
  const scopedCookie = (authorize.headers.get('set-cookie') || '').split(';')[0]
  const futureSessions = fakeTransactionalStarter()
  const future = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/future.json', browserSessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', occurrenceId: 'syllabus:future-proof' }, scopedCookie), startDeps(futureSessions))
  assert.equal(future.status, 200)
  assert.equal(futureSessions.state.created.length, 1)
})

test('protected start binds the signed proof and started-event metadata to the requested occurrence', async () => {
  const occurrenceA = 'syllabus:today-a'
  const scopeA = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: occurrenceA, today: '2026-08-23' }
  const sessions = fakeTransactionalStarter()
  const allowed = await startExecution(request({
    learnerId: LEARNER,
    lessonId: 'math/today.json',
    browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    occurrenceId: occurrenceA,
  }, executionCookie(scopeA)), startDeps(sessions))
  assert.equal(allowed.status, 200)
  assert.equal(sessions.state.calls[0].p_syllabus_occurrence_id, occurrenceA)

  const mismatchStore = fakeTransactionalStarter()
  const mismatch = await startExecution(request({
    learnerId: LEARNER,
    lessonId: 'math/today.json',
    browserSessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    occurrenceId: 'syllabus:today-b',
  }, executionCookie(scopeA)), startDeps(mismatchStore))
  assert.equal(mismatch.status, 403)
  assert.equal((await mismatch.json()).code, 'SYLLABUS_EXECUTION_DENIED')
  assert.equal(mismatchStore.state.calls.length, 0)
})

test('a different tab proof cannot start or take over the current page occurrence', async () => {
  const pageOccurrence = 'syllabus:today-a'
  const overwrittenScope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today-b', today: '2026-08-23' }
  const activeId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  for (const takeover of [false, true]) {
    const sessions = fakeTransactionalStarter([{ id: activeId, session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', lesson_id: 'math/today.json' }])
    let pinChecks = 0
    const response = await startExecution(request({
      learnerId: LEARNER,
      lessonId: 'math/today.json',
      browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      occurrenceId: pageOccurrence,
      ...(takeover ? { takeoverPin: '2468', expectedConflictingSessionId: activeId } : {}),
    }, executionCookie(overwrittenScope)), startDeps(sessions, {
      verifyFacilitatorPinForUser: async () => { pinChecks += 1; return true },
    }))
    assert.equal(response.status, 403)
    assert.equal((await response.json()).code, 'SYLLABUS_EXECUTION_DENIED')
    assert.equal(pinChecks, 0)
    assert.equal(sessions.state.calls.length, 0)
    assert.equal(sessions.state.active[0].ended_at, undefined)
  }
})

test('starting a new lesson atomically replaces every prior active learner lesson without takeover', async () => {
  const scope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'science/lesson-b.json', occurrenceId: 'syllabus:lesson-b', today: '2026-08-23' }
  const prior = [
    { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', session_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', lesson_id: 'math/lesson-a.json' },
    { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', lesson_id: 'reading/legacy-race.json' },
  ]
  const sessions = fakeTransactionalStarter(prior)
  const response = await startExecution(request({
    learnerId: LEARNER,
    lessonId: 'science/lesson-b.json',
    browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    occurrenceId: 'syllabus:lesson-b',
  }, executionCookie(scope)), startDeps(sessions))
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.takeover, false)
  assert.deepEqual(sessions.state.ended.sort(), prior.map((row) => row.id).sort())
  const active = sessions.state.active.filter((row) => !row.ended_at)
  assert.equal(active.length, 1)
  assert.equal(active[0].lesson_id, 'science/lesson-b.json')
})

test('failed new-lesson creation restores every prior active learner lesson', async () => {
  const scope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'science/lesson-b.json', occurrenceId: 'syllabus:lesson-b', today: '2026-08-23' }
  const prior = [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', session_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', lesson_id: 'math/lesson-a.json' }]
  const sessions = fakeTransactionalStarter(prior, { failInsert: true })
  const response = await startExecution(request({
    learnerId: LEARNER,
    lessonId: 'science/lesson-b.json',
    browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    occurrenceId: 'syllabus:lesson-b',
  }, executionCookie(scope)), startDeps(sessions))
  assert.equal(response.status, 500)
  assert.deepEqual(sessions.state.active, prior)
  assert.deepEqual(sessions.state.ended, [])
})

test('same browser reuses and touches its active session', async () => {
  const scope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today', today: '2026-08-23' }
  const activeId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const sessions = fakeTransactionalStarter([{ id: activeId, session_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', lesson_id: 'math/today.json', device_name: 'This device' }])
  const response = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', occurrenceId: 'syllabus:today' }, executionCookie(scope)), startDeps(sessions))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).id, activeId)
  assert.deepEqual(sessions.state.touched, [activeId])
  assert.equal(sessions.state.created.length, 0)
})

test('different browser conflicts without takeover authorization and does not mutate', async () => {
  const scope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today', today: '2026-08-23' }
  const activeId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const active = [{ id: activeId, session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', lesson_id: 'math/today.json', device_name: 'Other device' }]

  const missingPinStore = fakeTransactionalStarter(active)
  const conflict = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', occurrenceId: 'syllabus:today' }, executionCookie(scope)), startDeps(missingPinStore))
  assert.equal(conflict.status, 200)
  assert.equal((await conflict.json()).conflict, true)
  assert.deepEqual(missingPinStore.state.active, active)
  assert.deepEqual(missingPinStore.state.created, [])
})

test('different browser takeover requires valid scoped proof, fresh PIN, and expected conflict identity', async () => {
  const scope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today', today: '2026-08-23' }
  const activeId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const active = [{ id: activeId, session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', lesson_id: 'math/today.json', device_name: 'Other device' }]
  const invalidPinStore = fakeTransactionalStarter(active)
  const invalid = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', occurrenceId: 'syllabus:today', takeoverPin: '0000', expectedConflictingSessionId: activeId }, executionCookie(scope)), startDeps(invalidPinStore))
  assert.equal(invalid.status, 403)
  assert.equal((await invalid.json()).code, 'INVALID_FACILITATOR_PIN')
  assert.equal(invalidPinStore.state.calls.length, 0)

  const successStore = fakeTransactionalStarter(active)
  const success = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', occurrenceId: 'syllabus:today', takeoverPin: '2468', expectedConflictingSessionId: activeId }, executionCookie(scope)), startDeps(successStore))
  assert.equal(success.status, 200)
  assert.equal((await success.json()).takeover, true)
  assert.equal(successStore.state.created.length, 1)
  assert.deepEqual(successStore.state.ended, [activeId])
  assert.equal(successStore.state.calls[0].p_allow_takeover, true)
  assert.equal(successStore.state.calls[0].p_expected_conflicting_session_id, activeId)
})

test('a competing session appearing before the transactional decision cannot be silently replaced', async () => {
  const scope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today', today: '2026-08-23' }
  const competitor = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', lesson_id: 'math/today.json' }
  const sessions = fakeTransactionalStarter([], { beforeDecision(state) { state.active.push(structuredClone(competitor)) } })
  const response = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', occurrenceId: 'syllabus:today' }, executionCookie(scope)), startDeps(sessions))
  assert.equal((await response.json()).conflict, true)
  assert.deepEqual(sessions.state.active, [competitor])
  assert.equal(sessions.state.created.length, 0)
})

test('stale expected conflict identity cannot replace a newer active session', async () => {
  const scope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today', today: '2026-08-23' }
  const newer = { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', lesson_id: 'math/today.json' }
  const sessions = fakeTransactionalStarter([newer])
  const response = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', occurrenceId: 'syllabus:today', takeoverPin: '2468', expectedConflictingSessionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }, executionCookie(scope)), startDeps(sessions))
  const result = await response.json()
  assert.equal(result.conflict, true)
  assert.equal(result.staleConflict, true)
  assert.deepEqual(sessions.state.active, [newer])
})

test('failed transactional replacement preserves the existing active session', async () => {
  const scope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today', today: '2026-08-23' }
  const activeId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const active = [{ id: activeId, session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', lesson_id: 'math/today.json' }]
  const sessions = fakeTransactionalStarter(active, { failInsert: true })
  const response = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', occurrenceId: 'syllabus:today', takeoverPin: '2468', expectedConflictingSessionId: activeId }, executionCookie(scope)), startDeps(sessions))
  assert.equal(response.status, 500)
  assert.deepEqual(sessions.state.active, active)
  assert.deepEqual(sessions.state.ended, [])
})

test('protected start rejects a missing browser session identity before mutation', async () => {
  const scope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today', today: '2026-08-23' }
  const sessions = fakeTransactionalStarter()
  const response = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', occurrenceId: 'syllabus:today' }, executionCookie(scope)), startDeps(sessions))
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'BROWSER_SESSION_ID_REQUIRED')
  assert.equal(sessions.state.calls.length, 0)
})

test('protected start rejects a missing requested occurrence before mutation', async () => {
  const scope = { facilitatorId: FACILITATOR, learnerId: LEARNER, lessonKey: 'math/today.json', occurrenceId: 'syllabus:today', today: '2026-08-23' }
  const sessions = fakeTransactionalStarter()
  const response = await startExecution(request({ learnerId: LEARNER, lessonId: 'math/today.json', browserSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, executionCookie(scope)), startDeps(sessions))
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'SYLLABUS_OCCURRENCE_REQUIRED')
  assert.equal(sessions.state.calls.length, 0)
})

test('protected session creation failure prevents the instruction continuation', async () => {
  let orchestratorStarted = false
  await assert.rejects(async () => {
    await requireProtectedSessionCreation(async () => null)
    orchestratorStarted = true
  }, /Unable to confirm this lesson session/)
  assert.equal(orchestratorStarted, false)

  await assert.rejects(async () => {
    await requireProtectedSessionCreation(async () => { throw new Error('Secure lesson start timed out') })
    orchestratorStarted = true
  }, /timed out/)
  assert.equal(orchestratorStarted, false)

  const result = await requireProtectedSessionCreation(async () => ({ id: 'authorized-session' }))
  assert.equal(result.id, 'authorized-session')
})

test('session boundary uses server authorization and does not accept cached facilitator state or raw PIN persistence', () => {
  const session = fs.readFileSync(path.resolve('src/app/session/v2/SessionPageV2.jsx'), 'utf8')
  const route = fs.readFileSync(path.resolve('src/app/api/syllabus/execution/route.js'), 'utf8')
  const startRoute = fs.readFileSync(path.resolve('src/app/api/syllabus/execution/start/route.js'), 'utf8')
  const tracking = fs.readFileSync(path.resolve('src/app/lib/sessionTracking.js'), 'utf8')
  assert.match(session, /fetch\('\/api\/syllabus\/execution'/)
  assert.match(session, /executionAuthorization !== 'allowed'/)
  assert.doesNotMatch(session, /facilitator_section_active/)
  assert.match(route, /verifyFacilitatorPinForUser/)
  assert.match(route, /httpOnly: true/)
  assert.doesNotMatch(route, /ensurePinAllowed/)
  assert.match(startRoute, /readSyllabusExecutionProof/)
  assert.match(startRoute, /SYLLABUS_EXECUTION_DENIED/)
  assert.match(startRoute, /lessonKey,\s+occurrenceId,\s+today: proof\.today/)
  assert.doesNotMatch(startRoute, /occurrenceId:\s*proof\.occurrenceId/)
  assert.match(session, /startTrackedSession\(browserSessionId, deviceName, null, null, authorizedOccurrenceId\)/)
  assert.match(session, /startTrackedSession\(browserSessionId, deviceName, pinCode, conflictingSession\?\.id, authorizedOccurrenceId\)/)
  assert.match(startRoute, /start_lesson_session_transactional/)
  assert.doesNotMatch(startRoute, /from\('lesson_sessions'\)/)
  assert.doesNotMatch(startRoute, /createSessionStore|listActiveForLesson|listActiveForLearner/)
  assert.match(tracking, /fetch\('\/api\/syllabus\/execution\/start'/)
  assert.doesNotMatch(tracking, /from\('lesson_sessions'\)[\s\S]{0,400}insert\(insertPayload\)/)
  assert.doesNotMatch(session, /localStorage\.setItem\([^\n]*exceptionPin|sessionStorage\.setItem\([^\n]*exceptionPin/)
})

test('transactional session-start migration locks, checks, replaces, and restricts execution in PostgreSQL', () => {
  const migration = fs.readFileSync(path.resolve('supabase/migrations/20260827174540_transactional_lesson_session_start.sql'), 'utf8')
  assert.match(migration, /from public\.learners[\s\S]*for update/i)
  assert.match(migration, /from public\.lesson_sessions[\s\S]*ended_at is null[\s\S]*for update/i)
  assert.match(migration, /where learner_id = p_learner_id\s+and ended_at is null\s+for update/i)
  assert.match(migration, /p_browser_session_id is null[\s\S]*raise exception/i)
  assert.match(migration, /v_requested_active\.session_id = p_browser_session_id[\s\S]*last_activity_at = v_now/i)
  assert.match(migration, /not coalesce\(p_allow_takeover, false\)[\s\S]*'conflict', true/i)
  assert.match(migration, /p_expected_conflicting_session_id <> v_requested_active\.id[\s\S]*'staleConflict', true/i)
  assert.match(migration, /update public\.lesson_sessions\s+set ended_at = v_now\s+where learner_id = p_learner_id\s+and ended_at is null[\s\S]*insert into public\.lesson_sessions/i)
  assert.match(migration, /for v_replaced in[\s\S]*event_type, occurred_at, metadata[\s\S]*'restarted'/i)
  assert.match(migration, /set_config\('app\.transactional_lesson_session_start', 'on', true\)/i)
  assert.match(migration, /drop trigger if exists auto_deactivate_old_lesson_sessions/i)
  assert.match(migration, /drop function if exists public\.deactivate_old_lesson_sessions\(\)/i)
  assert.match(migration, /current_setting\('app\.transactional_lesson_session_start', true\) is distinct from 'on'/i)
  assert.match(migration, /set search_path = ''/i)
  assert.match(migration, /revoke all on function public\.start_lesson_session_transactional[\s\S]*from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.start_lesson_session_transactional[\s\S]*to service_role/i)
  assert.match(migration, /revoke insert on table public\.lesson_sessions from authenticated/i)
  assert.doesNotMatch(migration, /drop index[^\n]*unique_active_lesson_session/i)
  assert.doesNotMatch(migration, /p_(?:raw_)?pin\b/i)
})
