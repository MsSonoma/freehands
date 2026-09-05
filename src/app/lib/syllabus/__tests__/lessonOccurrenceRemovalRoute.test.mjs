import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { DELETE } from '../../../api/syllabus/lesson-occurrences/route.js'
import { SyllabusError } from '../schema.mjs'

const url = 'http://localhost/api/syllabus/lesson-occurrences'
const validBody = {
  learnerId: 'learner-1',
  lessonKey: 'math/fractions.json',
  occurrenceId: 'occurrence-1',
}

function request(body = validBody) {
  return new Request(url, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function dependencies(overrides = {}) {
  const admin = overrides.admin || { server: 'admin' }
  const repository = overrides.repository || { server: 'repository' }
  return {
    admin,
    repository,
    getRequestContext: async () => ({ admin, user: { id: 'facilitator-authenticated' } }),
    syllabusAccess: { test: 'access' },
    requireSyllabusFuturePlanning: () => {},
    removeLessonOccurrenceFromSyllabus: async () => ({ removed: true }),
    ...overrides,
  }
}

async function payload(response) {
  return response.json()
}

test('unauthenticated request is rejected without calling the service', async () => {
  let calls = 0
  const response = await DELETE(request(), dependencies({
    getRequestContext: async () => ({ error: 'Authentication required', status: 401 }),
    removeLessonOccurrenceFromSyllabus: async () => { calls += 1 },
  }))
  assert.equal(response.status, 401)
  assert.equal(calls, 0)
})

test('Syllabus entitlement failure is preserved without calling the service', async () => {
  let calls = 0
  const response = await DELETE(request(), dependencies({
    requireSyllabusFuturePlanning: () => {
      throw new SyllabusError('Future planning access required', 403, 'SYLLABUS_FUTURE_PLANNING_REQUIRED')
    },
    removeLessonOccurrenceFromSyllabus: async () => { calls += 1 },
  }))
  assert.equal(response.status, 403)
  assert.deepEqual(await payload(response), {
    error: 'Future planning access required',
    code: 'SYLLABUS_FUTURE_PLANNING_REQUIRED',
  })
  assert.equal(calls, 0)
})

test('invalid JSON returns 400', async () => {
  const response = await DELETE(request('{'), dependencies())
  assert.equal(response.status, 400)
})

for (const [name, body] of [['null', null], ['array', []]]) {
  test(`${name} JSON body returns 400`, async () => {
    const response = await DELETE(request(JSON.stringify(body)), dependencies())
    assert.equal(response.status, 400)
  })
}

for (const field of ['learnerId', 'lessonKey', 'occurrenceId']) {
  test(`missing ${field} returns 400`, async () => {
    const body = { ...validBody }
    delete body[field]
    const response = await DELETE(request(body), dependencies())
    assert.equal(response.status, 400)
  })

  test(`blank ${field} returns 400`, async () => {
    const response = await DELETE(request({ ...validBody, [field]: '   ' }), dependencies())
    assert.equal(response.status, 400)
  })
}

test('non-string expectedActiveRevisionId returns 400', async () => {
  const response = await DELETE(request({ ...validBody, expectedActiveRevisionId: 42 }), dependencies())
  assert.equal(response.status, 400)
})

test('blank expectedActiveRevisionId returns 400', async () => {
  const response = await DELETE(request({ ...validBody, expectedActiveRevisionId: '  ' }), dependencies())
  assert.equal(response.status, 400)
})

test('omitted expectedActiveRevisionId is passed as null', async () => {
  let captured
  const response = await DELETE(request(), dependencies({
    removeLessonOccurrenceFromSyllabus: async (input) => { captured = input; return { removed: true } },
  }))
  assert.equal(response.status, 200)
  assert.equal(captured.expectedActiveRevisionId, null)
})

test('expectedActiveRevisionId string is passed unchanged', async () => {
  let captured
  const revision = ' revision-exact '
  const response = await DELETE(request({ ...validBody, expectedActiveRevisionId: revision }), dependencies({
    removeLessonOccurrenceFromSyllabus: async (input) => { captured = input; return { removed: true } },
  }))
  assert.equal(response.status, 200)
  assert.equal(captured.expectedActiveRevisionId, revision)
})

test('successful DELETE passes exactly the authenticated and requested service inputs', async () => {
  const admin = { server: 'admin-exact' }
  const repository = { server: 'repository-exact' }
  let captured
  const response = await DELETE(request({ ...validBody, expectedActiveRevisionId: 'revision-7' }), dependencies({
    admin,
    repository,
    removeLessonOccurrenceFromSyllabus: async (input) => { captured = input; return { removed: true } },
  }))
  assert.equal(response.status, 200)
  assert.deepEqual(captured, {
    admin,
    repository,
    facilitatorId: 'facilitator-authenticated',
    learnerId: 'learner-1',
    lessonKey: 'math/fractions.json',
    occurrenceId: 'occurrence-1',
    expectedActiveRevisionId: 'revision-7',
  })
})

const forbiddenFields = {
  facilitatorId: 'client-facilitator',
  plannedDate: '2026-09-04',
  lineageId: 'lineage-1',
  scheduleId: 'schedule-1',
  reconciledForecastId: 'forecast-1',
  inferred_placement_suppressed: true,
  removeFromLearner: true,
}

for (const [field, value] of Object.entries(forbiddenFields)) {
  test(`authority-bearing field ${field} is rejected`, async () => {
    let calls = 0
    const response = await DELETE(request({ ...validBody, [field]: value }), dependencies({
      removeLessonOccurrenceFromSyllabus: async () => { calls += 1 },
    }))
    assert.equal(response.status, 400)
    assert.equal(calls, 0)
  })
}

test('success returns the complete verified service result', async () => {
  const result = {
    lessonKey: 'math/fractions.json',
    occurrenceId: 'occurrence-1',
    placementKind: 'scheduled',
    removedForecastOccurrence: false,
    removedScheduleOccurrence: true,
    inferenceSuppressed: false,
    activeRevisionId: 'revision-8',
  }
  const response = await DELETE(request(), dependencies({
    removeLessonOccurrenceFromSyllabus: async () => result,
  }))
  assert.equal(response.status, 200)
  assert.deepEqual(await payload(response), { ok: true, ...result })
})

test('SyllabusError status and code are preserved', async () => {
  const response = await DELETE(request(), dependencies({
    removeLessonOccurrenceFromSyllabus: async () => {
      throw new SyllabusError('Revision conflict', 409, 'ACTIVATION_CONFLICT')
    },
  }))
  assert.equal(response.status, 409)
  assert.deepEqual(await payload(response), {
    error: 'Revision conflict',
    code: 'ACTIVATION_CONFLICT',
  })
})

test('unknown service errors return a safe 500 response', async () => {
  const response = await DELETE(request(), dependencies({
    removeLessonOccurrenceFromSyllabus: async () => {
      const error = new Error('database secret')
      error.stack = 'internal stack details'
      throw error
    },
  }))
  assert.equal(response.status, 500)
  assert.deepEqual(await payload(response), { error: 'Lesson occurrence removal failed' })
})

test('route delegates removal without direct schedule, forecast, or association mutation', () => {
  const source = fs.readFileSync(new URL('../../../api/syllabus/lesson-occurrences/route.js', import.meta.url), 'utf8')
  assert.match(source, /removeOccurrence\(\{/)
  assert.doesNotMatch(source, /\.from\s*\(/)
  assert.doesNotMatch(source, /syllabus_schedule|syllabus_forecast|syllabus_lesson_associations/)
})
