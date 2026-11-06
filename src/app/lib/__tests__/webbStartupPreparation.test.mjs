import test from 'node:test'
import assert from 'node:assert/strict'
import {
  prepareWebbStartupObjectives,
  WebbPreparationCancelled,
  WebbPreparationFailed,
} from '../webbStartupPreparation.mjs'

const lesson = {
  lessonKey: 'history/evidence',
  title: 'Historical Evidence',
  subject: 'history',
  grade: '4',
  shortanswer: [{ question: 'What is a primary source?' }],
}

const blueprint = {
  controllingIdea: 'Historical evidence helps us understand the past.',
  discourseMode: 'explanation',
  closingGoal: 'synthesize why comparing evidence matters',
  bodyUnits: Array.from({ length: 5 }, (_, index) => ({
    id: `body-${index + 1}`,
    objective: `The learner can explain the evidence concept ${index + 1}.`,
    clue: `evidence concept ${index + 1}`,
    rhetoricalJob: `explain why evidence concept ${index + 1} matters to the historical account`,
    connection: `builds on the earlier evidence by developing historical concept ${index + 1}`,
  })),
}
const complete = {
  blueprint,
  objectives: blueprint.bodyUnits.map(unit => unit.objective),
  clues: blueprint.bodyUnits.map(unit => unit.clue),
}

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
})
const storage = () => {
  const items = new Map()
  return {
    items,
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => { items.set(key, value) },
  }
}
const callArgs = (extra = {}) => ({
  lesson, learnerId: 'learner-1', storage: storage(), delay: async () => {}, ...extra,
})

test('valid objectives are cached only for the same learner and unchanged lesson content', async () => {
  const local = storage()
  const requests = []
  const fetchImpl = async (_url, init) => {
    requests.push(JSON.parse(init.body))
    return jsonResponse(complete)
  }
  const args = callArgs({ storage: local, fetchImpl })
  const first = await prepareWebbStartupObjectives(args)
  assert.deepEqual(first.objectives, complete.objectives)
  assert.deepEqual(first.clues, complete.clues)
  assert.deepEqual(first.blueprint.bodyUnits.map(unit => unit.objective), complete.objectives)
  assert.deepEqual((await prepareWebbStartupObjectives(args)).objectives, complete.objectives)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].action, 'generate-step')
  assert.equal(requests[0].stage, 'initial')

  await prepareWebbStartupObjectives({ ...args, lesson: { ...lesson, shortanswer: [{ question: 'What makes a source reliable?' }] } })
  assert.equal(requests.length, 2, 'editing the lesson invalidates the stored plan')
  await prepareWebbStartupObjectives({ ...args, learnerId: 'learner-2' })
  assert.equal(requests.length, 3, 'a different learner does not inherit the plan')
})

test('cache expires and a stale plan is revalidated against a new generation', async () => {
  const local = storage()
  let calls = 0
  const args = callArgs({
    storage: local,
    now: () => Date.UTC(2026, 10, 6),
    fetchImpl: async () => { calls += 1; return jsonResponse(complete) },
  })
  await prepareWebbStartupObjectives(args)
  await prepareWebbStartupObjectives({ ...args, now: () => Date.UTC(2026, 10, 14) })
  assert.equal(calls, 2)
})

test('a malformed initial draft is repaired by another request, not another model call in the same request', async () => {
  const stages = []
  let notices = 0
  const plan = await prepareWebbStartupObjectives(callArgs({
    onRetry: () => { notices += 1 },
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      stages.push(body.stage)
      if (body.stage === 'initial') return jsonResponse({ nextStage: 'repair', draft: '{not json' })
      assert.equal(body.draft, '{not json')
      return jsonResponse(complete)
    },
  }))
  assert.deepEqual(stages, ['initial', 'repair'])
  assert.equal(notices, 0)
  assert.deepEqual(plan.objectives, complete.objectives)
})

test('three strict validation stages may run without dropping atomic objectives', async () => {
  const stages = []
  const result = await prepareWebbStartupObjectives(callArgs({
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      stages.push(body.stage)
      if (body.stage === 'initial') return jsonResponse({ nextStage: 'repair', draft: 'invalid-draft' })
      if (body.stage === 'repair') return jsonResponse({ nextStage: 'fresh', draft: 'another-invalid-draft' })
      return jsonResponse(complete)
    },
  }))
  assert.deepEqual(stages, ['initial', 'repair', 'fresh'])
  assert.deepEqual(result.objectives, complete.objectives)
})

test('transient 504, 503, and interrupted requests retry their same stage without a manual refresh', async () => {
  const stages = []
  let notices = 0
  const result = await prepareWebbStartupObjectives(callArgs({
    onRetry: () => { notices += 1 },
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      stages.push(body.stage)
      if (stages.length === 1) return jsonResponse({ error: 'Vercel timeout' }, 504)
      if (stages.length === 2) return jsonResponse({ nextStage: 'repair', draft: 'draft-one' })
      if (stages.length === 3) throw new TypeError('temporary network interruption')
      return jsonResponse(complete)
    },
  }))
  assert.equal(notices, 2)
  assert.deepEqual(stages, ['initial', 'initial', 'repair', 'repair'])
  assert.deepEqual(result.objectives, complete.objectives)
})

test('invalid third-stage output starts one new generation before giving up', async () => {
  let calls = 0
  const result = await prepareWebbStartupObjectives(callArgs({
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) return jsonResponse({ nextStage: 'repair', draft: 'draft-one' })
      if (calls === 2) return jsonResponse({ nextStage: 'fresh', draft: 'draft-two' })
      if (calls === 3) return jsonResponse({ code: 'WEBB_BLUEPRINT_INVALID' }, 422)
      return jsonResponse(complete)
    },
  }))
  assert.equal(calls, 4)
  assert.deepEqual(result.objectives, complete.objectives)
})

test('permanent HTTP failure does not loop or allow learner input', async () => {
  let calls = 0
  await assert.rejects(
    prepareWebbStartupObjectives(callArgs({
      fetchImpl: async () => { calls += 1; return jsonResponse({ error: 'Bad request' }, 400) },
    })),
    WebbPreparationFailed,
  )
  assert.equal(calls, 1)
})

test('invalid or missing blueprint is never cached or passed to the learner', async () => {
  const local = storage()
  let calls = 0
  await assert.rejects(
    prepareWebbStartupObjectives(callArgs({
      storage: local,
      fetchImpl: async () => {
        calls += 1
        return jsonResponse({ ...complete, blueprint: null })
      },
    })),
    WebbPreparationFailed,
  )
  assert.equal(calls, 2)
  assert.equal(local.items.size, 0)
})

test('pending mastery revisits are scoped to exact pending goals and never use an unrelated full blueprint', async () => {
  let calls = 0
  const local = storage()
  const pending = [complete.objectives[0]]
  const fetchImpl = async () => {
    calls += 1
    return jsonResponse({ objectives: pending, clues: ['Goal 1'], revisit: true })
  }
  const result = await prepareWebbStartupObjectives(callArgs({ storage: local, pendingObjectives: pending, fetchImpl }))
  assert.deepEqual(result.objectives, pending)
  assert.equal(result.blueprint, null)
  await prepareWebbStartupObjectives(callArgs({ storage: local, pendingObjectives: pending, fetchImpl }))
  assert.equal(calls, 1)
  await assert.rejects(
    prepareWebbStartupObjectives(callArgs({
      storage: local, pendingObjectives: [complete.objectives[1]],
      fetchImpl: async () => { calls += 1; return jsonResponse({ objectives: pending, clues: ['Goal 1'], revisit: true }) },
    })),
    WebbPreparationFailed,
  )
  assert.equal(calls, 3, 'changed pending goals invalidate the old plan')
})

test('abandoned startup cancels further attempts and never caches a result', async () => {
  let active = true
  const local = storage()
  let calls = 0
  await assert.rejects(
    prepareWebbStartupObjectives(callArgs({
      storage: local,
      shouldContinue: () => active,
      fetchImpl: async () => { calls += 1; active = false; return jsonResponse({ error: 'timeout' }, 504) },
    })),
    WebbPreparationCancelled,
  )
  assert.equal(calls, 1)
  assert.equal(local.items.size, 0)
})

test('cached plans that contain stacked objectives are rejected, not reused', async () => {
  const local = storage()
  const calls = []
  const fetchImpl = async (_url, options) => {
    calls.push(JSON.parse(options.body).stage)
    return jsonResponse(complete)
  }
  const args = callArgs({ storage: local, fetchImpl })
  await prepareWebbStartupObjectives(args)
  const key = [...local.items.keys()][0]
  const stored = JSON.parse(local.getItem(key))
  stored.plan.objectives[0] = 'The learner can identify the cause and explain the result.'
  stored.plan.blueprint.bodyUnits[0].objective = stored.plan.objectives[0]
  local.setItem(key, JSON.stringify(stored))
  const result = await prepareWebbStartupObjectives(args)
  assert.deepEqual(result.objectives, complete.objectives)
  assert.deepEqual(calls, ['initial', 'initial'])
})

test('invalid, answer-bearing cached clue causes regeneration', async () => {
  const local = storage()
  let count = 0
  const args = callArgs({
    storage: local,
    fetchImpl: async () => { count += 1; return jsonResponse(complete) },
  })
  await prepareWebbStartupObjectives(args)
  const key = [...local.items.keys()][0]
  const stored = JSON.parse(local.getItem(key))
  stored.plan.clues[0] = 'Evidence proved the claim'
  stored.plan.blueprint.bodyUnits[0].clue = 'Evidence proved the claim'
  local.setItem(key, JSON.stringify(stored))
  await prepareWebbStartupObjectives(args)
  assert.equal(count, 2)
})
