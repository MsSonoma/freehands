import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { POST as scheduleLesson } from '../../../api/lesson-schedule/route.js'
import { PATCH as patchAssociation, POST as preserveAssociation } from '../../../api/syllabus/lesson-associations/route.js'

const FACILITATOR_ID = '11111111-1111-4111-8111-111111111111'
const LEARNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LESSON_KEY = 'generated/fractions.json'

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

function scheduleAdmin({ scheduled = null } = {}) {
  const state = { association: null, operations: [], scheduled: scheduled ? structuredClone(scheduled) : null, scheduleWrites: 0 }
  const scheduleMutation = (payload) => ({
    eq() { return this },
    select() { return this },
    async single() {
      state.operations.push('schedule')
      state.scheduleWrites += 1
      state.scheduled = { id: state.scheduled?.id || 'schedule-1', ...payload }
      return { data: structuredClone(state.scheduled), error: null }
    },
  })
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
              return { data: state.scheduled && (!id || state.scheduled.id === id) ? structuredClone(state.scheduled) : null, error: null }
            },
          }
        },
        upsert(payload) { return scheduleMutation(payload) },
        update(payload) { return scheduleMutation(payload) },
      }
    },
  }
  return admin
}

function scheduleDeps(admin, clear) {
  return {
    createClientImpl: () => admin,
    inspectLearnerSyllabusPlacement: async () => ({ allowed: true }),
    setLessonAssociationInferenceSuppressed: clear,
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

test('Prepare sends placement action only from Save for later and never sends suppression state', () => {
  const source = fs.readFileSync(path.resolve('src/app/facilitator/prepare/page.js'), 'utf8')
  const functionSource = (name, nextName) => source.slice(source.indexOf(`async function ${name}`), source.indexOf(`async function ${nextName}`))
  assert.match(functionSource('saveForLater', 'saveDraftAndLeave'), /preserveLessonAssociation\(undefined, undefined, 'save_for_later'\)/)
  for (const [name, nextName] of [
    ['makeAvailable', 'startNow'],
    ['startNow', 'scheduleLesson'],
    ['scheduleLesson', 'saveForLater'],
    ['saveDraftAndLeave', 'saveInstructionalTeacher'],
    ['saveInstructionalTeacher', 'approveLesson'],
  ]) {
    assert.doesNotMatch(functionSource(name, nextName), /save_for_later/)
  }
  const preserveSource = functionSource('preserveLessonAssociation', 'makeAvailable')
  assert.doesNotMatch(preserveSource, /\bsuppressed\b|inferred_placement_suppressed/)
})
