import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { POST as scheduleLesson } from '../../../api/lesson-schedule/route.js'
import { PATCH as patchAssociation, POST as preserveAssociation } from '../../../api/syllabus/lesson-associations/route.js'

const FACILITATOR_ID = '11111111-1111-4111-8111-111111111111'
const LEARNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LESSON_KEY = 'generated/fractions.json'
const FORECAST_LINEAGE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OTHER_LINEAGE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function request(url, body) {
  return new Request(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function associationStore(state) {
  return {
    select() {
      return {
        eq() { return this },
        async maybeSingle() { return { data: structuredClone(state.association), error: null } },
      }
    },
    insert(payload) {
      state.operations.push('association')
      state.association = structuredClone(payload)
      return {
        select() { return this },
        async single() { return { data: structuredClone(state.association), error: null } },
      }
    },
    update(payload) {
      state.operations.push('association')
      state.association = { ...state.association, ...payload }
      return {
        eq() { return this },
        select() { return this },
        async single() { return { data: structuredClone(state.association), error: null } },
      }
    },
  }
}

function learnerQuery() {
  return {
    select() { return this },
    eq() { return this },
    or() { return this },
    async maybeSingle() { return { data: { id: LEARNER_ID }, error: null } },
  }
}

function scheduleAdmin({ scheduled = null, schedules = null } = {}) {
  const initialSchedules = schedules || (scheduled ? [scheduled] : [])
  const state = { association: null, operations: [], scheduled: scheduled ? structuredClone(scheduled) : null, schedules: structuredClone(initialSchedules), scheduleWrites: 0 }
  const scheduleMutation = (payload, kind) => {
    const filters = []
    return {
      eq(column, value) { filters.push([column, value]); return this },
      select() { return this },
      async single() {
        state.operations.push('schedule')
        state.scheduleWrites += 1
        const requestedId = filters.find(([column]) => column === 'id')?.[1]
        const existingIndex = kind === 'update'
          ? state.schedules.findIndex((row) => row.id === requestedId)
          : state.schedules.findIndex((row) => row.learner_id === payload.learner_id && row.lesson_key === payload.lesson_key && row.scheduled_date === payload.scheduled_date)
        const prior = existingIndex >= 0 ? state.schedules[existingIndex] : null
        state.scheduled = { id: prior?.id || state.scheduled?.id || 'schedule-1', ...prior, ...payload }
        if (existingIndex >= 0) state.schedules[existingIndex] = structuredClone(state.scheduled)
        else state.schedules.push(structuredClone(state.scheduled))
        return { data: structuredClone(state.scheduled), error: null }
      },
    }
  }
  const admin = {
    state,
    auth: { async getUser() { return { data: { user: { id: FACILITATOR_ID } }, error: null } } },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'lessons')
        return {
          async download() {
            return { data: new Blob([JSON.stringify({ approved: true, subject: 'math', title: 'Fractions' })]), error: null }
          },
        }
      },
    },
    from(table) {
      if (table === 'learners') return learnerQuery()
      if (table === 'profiles') {
        return {
          select() { return this },
          eq() { return this },
          async maybeSingle() { return { data: { subscription_tier: 'standard', plan_tier: 'standard' }, error: null } },
        }
      }
      if (table === 'syllabus_lesson_associations') return associationStore(state)
      assert.equal(table, 'lesson_schedule')
      return {
        select() {
          const filters = []
          return {
            eq(column, value) { filters.push([column, value]); return this },
            or() { return this },
            async maybeSingle() {
              const id = filters.find(([column]) => column === 'id')?.[1]
              const row = id ? state.schedules.find((item) => item.id === id) : state.schedules[0]
              return { data: row ? structuredClone(row) : null, error: null }
            },
          }
        },
        upsert(payload) { return scheduleMutation(payload, 'upsert') },
        update(payload) { return scheduleMutation(payload, 'update') },
      }
    },
  }
  return admin
}

function forecastRepository({ lineageId = FORECAST_LINEAGE, lessonKey = LESSON_KEY } = {}) {
  return {
    async findSyllabus() { return { id: 'syllabus-1', active_revision_id: 'revision-1' } },
    async findRevision() { return { id: 'revision-1' } },
    async listForecastItems() { return lineageId ? [{ lineage_id: lineageId, lesson_key: lessonKey, item_type: 'lesson', origin: 'facilitator' }] : [] },
  }
}

function scheduleDeps(admin, clear, syllabusRepository = null, blockedDate = null) {
  return {
    createClientImpl: () => admin,
    inspectLearnerSyllabusPlacement: async () => ({ allowed: true }),
    findNoSchoolDate: async () => blockedDate,
    setLessonAssociationInferenceSuppressed: clear,
    ...(syllabusRepository ? { syllabusRepository } : {}),
  }
}

function associationAdmin() {
  const state = { association: null, operations: [] }
  return {
    state,
    storage: {
      from() {
        return {
          async download() {
            return { data: new Blob([JSON.stringify({ approved: true, subject: 'math', title: 'Fractions' })]), error: null }
          },
        }
      },
    },
    from(table) {
      if (table === 'learners') return learnerQuery()
      assert.equal(table, 'syllabus_lesson_associations')
      return associationStore(state)
    },
  }
}

function associationDeps(admin, clear = async () => {}) {
  return {
    requestContext: { user: { id: FACILITATOR_ID }, admin },
    setLessonAssociationInferenceSuppressed: clear,
  }
}

test('new scheduling fails closed on a no-school date before any schedule mutation', async () => {
  const admin = scheduleAdmin()
  const response = await scheduleLesson(request('http://localhost/api/lesson-schedule', {
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    scheduledDate: '2026-09-08',
  }), scheduleDeps(admin, async () => {}, null, { id: 'off-1', reason: 'Holiday' }))
  assert.equal(response.status, 409)
  assert.equal((await response.json()).code, 'NO_SCHOOL_DATE')
  assert.equal(admin.state.scheduleWrites, 0)
})

test('new schedule persists and preserves association before exact suppression clear', async () => {
  const admin = scheduleAdmin()
  let clearArgs
  const response = await scheduleLesson(request('http://localhost/api/lesson-schedule', {
    learnerId: LEARNER_ID,
    lessonKey: 'facilitator/fractions.json',
    scheduledDate: '2026-09-08',
  }), scheduleDeps(admin, async (args) => { admin.state.operations.push('clear'); clearArgs = args }))

  assert.equal(response.status, 200)
  assert.deepEqual(admin.state.operations, ['schedule', 'association', 'clear'])
  assert.deepEqual(clearArgs, {
    admin,
    facilitatorId: FACILITATOR_ID,
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    suppressed: false,
    verifyLearner: false,
  })
})

test('reschedule clears suppression after schedule and association mutations', async () => {
  const admin = scheduleAdmin({ scheduled: { id: 'schedule-1', facilitator_id: FACILITATOR_ID, learner_id: LEARNER_ID, lesson_key: LESSON_KEY, scheduled_date: '2026-09-08' } })
  const response = await scheduleLesson(request('http://localhost/api/lesson-schedule', {
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    scheduledDate: '2026-09-09',
    scheduleId: 'schedule-1',
  }), scheduleDeps(admin, async () => { admin.state.operations.push('clear') }))

  assert.equal(response.status, 200)
  assert.equal(admin.state.scheduled.scheduled_date, '2026-09-09')
  assert.deepEqual(admin.state.operations, ['schedule', 'association', 'clear'])
})

test('reschedule by schedule row ID moves only the selected same-key sibling', async () => {
  const siblings = [
    { id: 'schedule-1', facilitator_id: FACILITATOR_ID, learner_id: LEARNER_ID, lesson_key: LESSON_KEY, scheduled_date: '2026-09-08' },
    { id: 'schedule-2', facilitator_id: FACILITATOR_ID, learner_id: LEARNER_ID, lesson_key: LESSON_KEY, scheduled_date: '2026-09-10' },
  ]
  const admin = scheduleAdmin({ schedules: siblings })
  const response = await scheduleLesson(request('http://localhost/api/lesson-schedule', {
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    scheduledDate: '2026-09-09',
    scheduleId: 'schedule-1',
  }), scheduleDeps(admin, async () => {}))

  assert.equal(response.status, 200)
  assert.deepEqual(admin.state.schedules.map(({ id, scheduled_date }) => ({ id, scheduled_date })), [
    { id: 'schedule-1', scheduled_date: '2026-09-09' },
    { id: 'schedule-2', scheduled_date: '2026-09-10' },
  ])
})

test('valid forecast lineage is verified against the active Syllabus and stored on the schedule row', async () => {
  const admin = scheduleAdmin()
  const response = await scheduleLesson(request('http://localhost/api/lesson-schedule', {
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    scheduledDate: '2026-09-08',
    forecastLineageId: FORECAST_LINEAGE,
  }), scheduleDeps(admin, async () => {}, forecastRepository()))
  assert.equal(response.status, 200)
  assert.equal(admin.state.scheduled.forecast_lineage_id, FORECAST_LINEAGE)
})

test('invalid, stale, and mismatched forecast lineage claims fail before schedule mutation', async () => {
  for (const [forecastLineageId, repository, expectedStatus] of [
    ['not-a-uuid', forecastRepository(), 400],
    [FORECAST_LINEAGE, forecastRepository({ lineageId: null }), 409],
    [FORECAST_LINEAGE, forecastRepository({ lessonKey: 'generated/other.json' }), 409],
  ]) {
    const admin = scheduleAdmin()
    const response = await scheduleLesson(request('http://localhost/api/lesson-schedule', {
      learnerId: LEARNER_ID,
      lessonKey: LESSON_KEY,
      scheduledDate: '2026-09-08',
      forecastLineageId,
    }), scheduleDeps(admin, async () => {}, repository))
    assert.equal(response.status, expectedStatus)
    assert.equal(admin.state.scheduleWrites, 0)
  }
})

test('exact reschedule preserves forecast lineage and rejects retargeting', async () => {
  const linked = { id: 'schedule-1', facilitator_id: FACILITATOR_ID, learner_id: LEARNER_ID, lesson_key: LESSON_KEY, scheduled_date: '2026-09-08', forecast_lineage_id: FORECAST_LINEAGE }
  const admin = scheduleAdmin({ scheduled: linked })
  const preserved = await scheduleLesson(request('http://localhost/api/lesson-schedule', {
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    scheduledDate: '2026-09-11',
    scheduleId: 'schedule-1',
  }), scheduleDeps(admin, async () => {}, forecastRepository()))
  assert.equal(preserved.status, 200)
  assert.equal(admin.state.scheduled.forecast_lineage_id, FORECAST_LINEAGE)
  assert.equal(admin.state.scheduled.scheduled_date, '2026-09-11')

  const retargeted = await scheduleLesson(request('http://localhost/api/lesson-schedule', {
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    scheduledDate: '2026-09-12',
    scheduleId: 'schedule-1',
    forecastLineageId: OTHER_LINEAGE,
  }), scheduleDeps(admin, async () => {}, forecastRepository({ lineageId: OTHER_LINEAGE })))
  assert.equal(retargeted.status, 409)
  assert.equal(admin.state.scheduled.scheduled_date, '2026-09-11')
})

test('failed schedule clear reports failure after persistence and retry converges', async () => {
  const admin = scheduleAdmin()
  let attempts = 0
  const clear = async () => {
    admin.state.operations.push('clear')
    attempts += 1
    if (attempts === 1) throw new Error('clear failed')
  }
  const scheduleRequest = () => request('http://localhost/api/lesson-schedule', {
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    scheduledDate: '2026-09-08',
  })

  const failed = await scheduleLesson(scheduleRequest(), scheduleDeps(admin, clear))
  assert.notEqual(failed.status, 200)
  assert.equal(admin.state.scheduled.lesson_key, LESSON_KEY)
  assert.equal(admin.state.scheduleWrites, 1)
  assert.deepEqual(admin.state.operations, ['schedule', 'association', 'clear'])

  admin.state.operations.length = 0
  const retried = await scheduleLesson(scheduleRequest(), scheduleDeps(admin, clear))
  assert.equal(retried.status, 200)
  assert.equal(admin.state.scheduleWrites, 2)
  assert.deepEqual(admin.state.operations, ['schedule', 'association', 'clear'])
})

test('generic association POST preserves association without clearing suppression', async () => {
  const admin = associationAdmin()
  let clearCalls = 0
  const response = await preserveAssociation(request('http://localhost/api/syllabus/lesson-associations', {
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    instructionalTeacher: 'webb',
  }), associationDeps(admin, async () => { clearCalls += 1 }))

  assert.equal(response.status, 200)
  assert.equal(admin.state.association.lesson_key, LESSON_KEY)
  assert.equal(clearCalls, 0)
})

test('save_for_later preserves association before exact suppression clear', async () => {
  const admin = associationAdmin()
  let clearArgs
  const response = await preserveAssociation(request('http://localhost/api/syllabus/lesson-associations', {
    learnerId: LEARNER_ID,
    lessonKey: 'facilitator/fractions.json',
    action: 'save_for_later',
  }), associationDeps(admin, async (args) => { admin.state.operations.push('clear'); clearArgs = args }))

  assert.equal(response.status, 200)
  assert.deepEqual(admin.state.operations, ['association', 'clear'])
  assert.deepEqual(clearArgs, {
    admin,
    facilitatorId: FACILITATOR_ID,
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    suppressed: false,
    verifyLearner: false,
  })
})

test('unsupported association action fails closed before mutation', async () => {
  const admin = associationAdmin()
  let clearCalls = 0
  const response = await preserveAssociation(request('http://localhost/api/syllabus/lesson-associations', {
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    action: 'set_suppression',
  }), associationDeps(admin, async () => { clearCalls += 1 }))

  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'INVALID_LESSON_ASSOCIATION_ACTION')
  assert.equal(admin.state.association, null)
  assert.equal(clearCalls, 0)
})

for (const field of ['suppressed', 'inferred_placement_suppressed']) {
  test(`association POST rejects direct client field ${field}`, async () => {
    const admin = associationAdmin()
    const response = await preserveAssociation(request('http://localhost/api/syllabus/lesson-associations', {
      learnerId: LEARNER_ID,
      lessonKey: LESSON_KEY,
      [field]: true,
    }), associationDeps(admin))
    assert.equal(response.status, 400)
    assert.equal(admin.state.association, null)
  })
}

test('failed save_for_later clear reports failure after association preservation', async () => {
  const admin = associationAdmin()
  const response = await preserveAssociation(request('http://localhost/api/syllabus/lesson-associations', {
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    action: 'save_for_later',
  }), associationDeps(admin, async () => { admin.state.operations.push('clear'); throw new Error('clear failed') }))

  assert.notEqual(response.status, 200)
  assert.equal(admin.state.association.lesson_key, LESSON_KEY)
  assert.deepEqual(admin.state.operations, ['association', 'clear'])
})

test('teacher PATCH contains no suppression-clear lifecycle', () => {
  const source = fs.readFileSync(path.resolve('src/app/api/syllabus/lesson-associations/route.js'), 'utf8')
  const patchSource = source.slice(source.indexOf('export async function PATCH'))
  assert.doesNotMatch(patchSource, /setLessonAssociationInferenceSuppressed|clearInferenceSuppression/)
  assert.equal(typeof patchAssociation, 'function')
})

test('Generator association refresh never accepts client suppression state', () => {
  const source = fs.readFileSync(path.resolve('src/app/facilitator/generator/page.js'), 'utf8')
  const start = source.indexOf('async function refreshGeneratedLessonAssociation')
  const end = source.indexOf('async function approveGeneratedLesson', start)
  const refreshSource = source.slice(start, end)
  assert.match(refreshSource, /fetch\('\/api\/syllabus\/lesson-associations'/)
  assert.match(refreshSource, /body: JSON\.stringify\(\{ learnerId: intendedLearnerId, lessonKey \}\)/)
  assert.doesNotMatch(refreshSource, /save_for_later|\bsuppressed\b|inferred_placement_suppressed/)
})