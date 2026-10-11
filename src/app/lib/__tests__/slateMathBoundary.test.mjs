import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

import * as slateLiftoff from '../slateLiftoff.mjs'
import * as slateMath from '../slateMath.mjs'
import * as mathSession from '../../../lib/math/mathSession.mjs'
import * as verticalMathValidation from '../../../lib/math/verticalMathValidation.mjs'
import { enterVerticalMathFullAnswer } from '../../../lib/math/verticalMath.mjs'

const require = createRequire(import.meta.url)
const { transformSync } = require('next/dist/build/swc')
const routeUrl = new URL('../../api/slate-liftoff/route.js', import.meta.url)
const experienceUrl = new URL('../../session/slate/SlateLiftoffExperience.jsx', import.meta.url)
const routeSource = readFileSync(routeUrl, 'utf8')
const experienceSource = readFileSync(experienceUrl, 'utf8')
const routeCode = transformSync(routeSource, {
  filename: routeUrl.pathname,
  jsc: { parser: { syntax: 'ecmascript' }, target: 'es2022' },
  module: { type: 'commonjs' },
}).code

const lesson = { title: 'Adding', subject: 'Math', blurb: 'Add whole numbers.' }
const componentMap = [{
  id: 'add', name: 'Add', description: 'Add the operands.', dependencies: [], importance: 5, essential: true,
}]
const math = { operation: 'addition', operands: ['12', '7'], commands: [] }
const modeledMath = { operation: 'addition', operands: ['10', '5'], commands: [] }
const NO_MATH = Symbol('NO_MATH')

const jsonCopy = (value) => JSON.parse(JSON.stringify(value))

function problem(instanceKey, activity = math) {
  return { prompt: `Solve ${instanceKey}.`, instanceKey, ...(activity === NO_MATH ? {} : { math: activity }) }
}

function action(instanceKey, activity = math) {
  return {
    type: 'probe', targetComponentIds: ['add'], withheldComponentIds: ['add'], supportedComponentIds: [],
    problem: problem(instanceKey, activity), reason: 'Check the addition skill.',
  }
}

function initialization({ modeledMath: modeledActivity = modeledMath, nextMath = math, modeledKey = 'model:1', nextKey = 'probe:1' } = {}) {
  return {
    compatible: true,
    compatibilityReason: 'This lesson is teachable.',
    componentMap,
    modeledProblem: problem(modeledKey, modeledActivity),
    learnerMessage: 'Add by place value.',
    nextAction: action(nextKey, nextMath),
  }
}

function turnResult({ nextKey = 'probe:next', observations, sessionDecision = 'continue', nextType = 'probe' } = {}) {
  return {
    learnerMessage: 'Keep working.',
    diagnosis: { category: 'success', componentId: 'add', evidence: 'The learner submitted an answer.' },
    observations: observations || [{
      componentId: 'add', diagnostic: 'success', result: 'independent_success', independent: true,
      varied: true, integrated: true, supportLevel: 'none',
    }],
    integrationEvidence: true,
    variationEvidence: true,
    nextAction: { ...action(nextKey, NO_MATH), type: nextType },
    sessionDecision,
  }
}

function completion(value) {
  return JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] })
}

function loadRoute(queue = []) {
  const calls = []
  const dependencies = new Map([
    ['next/server', { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), {
      ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    }) } }],
    ['@/app/lib/aiModel', { AI_MODEL: 'boundary-test-model' }],
    ['@/lib/contentSafety', {
      classifyConversationSafety: () => ({ classification: 'safe' }),
      hardenInstructions: (prompt) => prompt,
      validateInput: () => ({ safe: true }),
      validateOutput: async () => ({ safe: true }),
    }],
    ['@/app/lib/slateLiftoff.mjs', slateLiftoff],
    ['@/app/lib/slateMath.mjs', slateMath],
    ['@/lib/math/mathSession.mjs', mathSession],
    ['@/lib/math/verticalMathValidation.mjs', verticalMathValidation],
  ])
  const cjsModule = { exports: {} }
  const context = vm.createContext({
    console,
    JSON,
    Request,
    Response,
    setTimeout,
    clearTimeout,
    process: { env: { NODE_ENV: 'production', OPENAI_API_KEY: 'test-not-a-real-key' } },
    fetch: async (url, init) => {
      calls.push({ url: String(url), init })
      assert.ok(queue.length, 'unexpected model fetch')
      return new Response(completion(queue.shift()), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  const factory = new vm.Script(`(function(require,module,exports){${routeCode}\n})`, { filename: 'slate-liftoff-route.cjs' })
    .runInContext(context)
  factory((id) => {
    assert.ok(dependencies.has(id), `unexpected dependency: ${id}`)
    return dependencies.get(id)
  }, cjsModule, cjsModule.exports)
  return { route: cjsModule.exports, calls }
}

async function post(route, body) {
  const response = await route.POST({ json: async () => body })
  return { status: response.status, body: jsonCopy(await response.json()) }
}

test('real POST initializes normalized math and preserves legacy nonmath initialization', async () => {
  const first = initialization()
  const nonmath = initialization({ modeledMath: NO_MATH, nextMath: NO_MATH, modeledKey: 'model:words', nextKey: 'probe:words' })
  const { route, calls } = loadRoute([first, nonmath])
  const mathResponse = await post(route, { mode: 'initialize', lesson })
  assert.equal(mathResponse.status, 200)
  assert.deepEqual(mathResponse.body.nextAction.problem.math, math)
  const legacyResponse = await post(route, { mode: 'initialize', lesson })
  assert.equal(legacyResponse.status, 200)
  assert.equal(Object.hasOwn(legacyResponse.body.nextAction.problem, 'math'), false)
  assert.equal(calls.length, 2)
})

test('invalid structured math variants all enter bounded correction and recover', async (t) => {
  const invalid = {
    null_math: null,
    array_math: [],
    invalid_operation: { operation: 'square', operands: ['2'], commands: [] },
    oversized_operand: { operation: 'addition', operands: ['12345678', '1'], commands: [] },
    malformed_commands: { operation: 'addition', operands: ['12', '7'], commands: [{}] },
    ambiguous_mask: { operation: 'addition', operands: ['12', '7'], commands: [{ action: 'hide', locations: ['operand.1.ones'], editable: true }] },
  }
  for (const [name, invalidMath] of Object.entries(invalid)) {
    await t.test(name, async () => {
      const { route, calls } = loadRoute([
        initialization({ nextMath: invalidMath }),
        initialization({ nextMath: math, nextKey: `probe:${name}:fixed` }),
      ])
      const response = await post(route, { mode: 'initialize', lesson })
      assert.equal(response.status, 200)
      assert.deepEqual(response.body.nextAction.problem.math, math)
      assert.equal(calls.length, 2)
    })
  }
})

test('repeatedly invalid math stops with 502 after exactly three model calls', async () => {
  const bad = initialization({ nextMath: null })
  const { route, calls } = loadRoute([bad, bad, bad])
  const response = await post(route, { mode: 'initialize', lesson })
  assert.equal(response.status, 502)
  assert.equal(calls.length, 3)
})

test('all-given next math retries, while modeled all-given and atomic show-then-hide remain legal', async () => {
  const allGiven = { ...math, commands: [{ action: 'show', locations: ['result.*'] }] }
  const modeledAllGiven = { ...modeledMath, commands: [{ action: 'show', locations: ['result.*'] }] }
  const batch = { ...math, commands: [
    { action: 'show', locations: ['result.*'] },
    { action: 'hide', locations: ['result.ones'] },
  ] }
  const { route, calls } = loadRoute([
    initialization({ nextMath: allGiven }),
    initialization({ modeledMath: modeledAllGiven, nextMath: batch, modeledKey: 'model:shown', nextKey: 'probe:ones' }),
  ])
  const response = await post(route, { mode: 'initialize', lesson })
  assert.equal(response.status, 200)
  assert.deepEqual(response.body.modeledProblem.math, modeledAllGiven)
  assert.deepEqual(response.body.nextAction.problem.math.commands, batch.commands)
  assert.equal(calls.length, 2)
})

function liftoffState(currentProblem) {
  return {
    turnNumber: 2,
    components: componentMap.map((component) => ({ ...component, evidence: [] })),
    currentAction: action('probe:current', currentProblem.math),
    problemHistory: [],
  }
}

function submittedMath(answer, { assisted = false } = {}) {
  const activityId = assisted ? 'activity:assisted' : `activity:${answer}`
  let state = mathSession.createMathSession(math, { activityId, phase: 'teaching' }).state
  if (assisted) {
    const helped = mathSession.recordMathSessionHelp(state, {
      activityId, expectedRevision: state.revision, requestId: 'help', kind: 'line_help',
    })
    assert.equal(helped.ok, true)
    state = helped.state
  }
  const entered = enterVerticalMathFullAnswer(mathSession.buildMathActivityProblem(math), state.view, answer)
  assert.equal(entered.ok, true)
  const edited = mathSession.updateMathSessionView(state, entered.view, {
    activityId, expectedRevision: state.revision, requestId: 'edit',
  })
  assert.equal(edited.ok, true)
  const submitted = mathSession.submitMathSession(edited.state, {
    activityId, expectedRevision: edited.state.revision, requestId: 'submit',
  })
  assert.equal(submitted.ok, true)
  return submitted
}

test('wrong math is recomputed authoritatively and cannot be promoted by tampered evaluation', async () => {
  const submitted = submittedMath('18')
  const tampered = { ...submitted.submission, evaluation: { ...submitted.submission.evaluation, correct: true } }
  const { route, calls } = loadRoute([turnResult({ sessionDecision: 'procedure_released', nextType: 'release' })])
  const response = await post(route, {
    mode: 'turn', lesson, state: liftoffState(problem('probe:current', math)),
    mathSession: submitted.state, mathSubmission: tampered,
  })
  assert.equal(response.status, 200)
  assert.deepEqual(response.body.mathReceipt, {
    activityId: submitted.submission.activityId,
    requestId: submitted.submission.requestId,
    submittedRevision: submitted.submission.submittedRevision,
  })
  assert.equal(response.body.observations[0].result, 'failure')
  assert.equal(response.body.observations[0].independent, false)
  assert.equal(response.body.integrationEvidence, false)
  assert.equal(response.body.sessionDecision, 'continue')
  assert.equal(response.body.nextAction.type, 'reprobe')
  assert.equal(calls.length, 1)
})

test('assisted correct math is supported evidence and cannot trigger independent release', async () => {
  const submitted = submittedMath('19', { assisted: true })
  const tampered = { ...submitted.submission, evaluation: { ...submitted.submission.evaluation, correct: false } }
  const { route } = loadRoute([turnResult({ sessionDecision: 'procedure_released', nextType: 'release' })])
  const response = await post(route, {
    mode: 'turn', lesson, state: liftoffState(problem('probe:current', math)),
    mathSession: submitted.state, mathSubmission: tampered,
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.observations[0].result, 'supported_success')
  assert.equal(response.body.observations[0].independent, false)
  assert.equal(response.body.integrationEvidence, false)
  assert.equal(response.body.variationEvidence, false)
  assert.equal(response.body.sessionDecision, 'continue')
  assert.equal(response.body.nextAction.type, 'reprobe')
})

test('mismatched math request and revision fields fail before any model call', async (t) => {
  const submitted = submittedMath('19')
  for (const [name, mutation] of [
    ['request', { requestId: 'not-the-latest-request' }],
    ['revision', { submittedRevision: submitted.submission.submittedRevision + 1 }],
  ]) {
    await t.test(name, async () => {
      const { route, calls } = loadRoute([])
      const response = await post(route, {
        mode: 'turn', lesson, state: liftoffState(problem('probe:current', math)),
        mathSession: submitted.state, mathSubmission: { ...submitted.submission, ...mutation },
      })
      assert.equal(response.status, 409)
      assert.equal(calls.length, 0)
    })
  }
})

test('test-mode line help is rejected before any model call', async () => {
  const { route, calls } = loadRoute([])
  const response = await post(route, {
    mode: 'line_help', phase: 'test', lesson, sourceLine: 'Add the ones first.', action: 'rephrase',
  })
  assert.equal(response.status, 400)
  assert.equal(calls.length, 0)
})

test('route exports only supported framework fields and source keeps post-await ownership fencing', () => {
  const { route } = loadRoute([])
  assert.deepEqual(Object.keys(route).sort(), ['GET', 'POST', 'dynamic', 'runtime'])
  assert.doesNotMatch(routeSource, /export\s+function\s+validateLiftoffMathProblem/)

  const fetchStart = experienceSource.indexOf("const response = await fetch('/api/slate-liftoff'")
  const afterFetch = experienceSource.slice(fetchStart)
  const fence = afterFetch.indexOf('if (snapshotServiceRef.current?.writesFenced) return')
  const parse = afterFetch.indexOf('const turn = await response.json()')
  const apply = afterFetch.indexOf('const nextState = applyLiftoffTurn')
  const archive = afterFetch.indexOf('appendSlateMathArchive(mathArchiveRef.current')
  const speak = afterFetch.indexOf('void speak(turn.learnerMessage)')
  assert.ok(fetchStart >= 0 && fence >= 0)
  assert.ok(fence < parse && fence < apply && fence < archive && fence < speak)
  assert.match(experienceSource, /result\.success !== false && result\.blocked !== true && !result\.ownershipLost && !service\.writesFenced/)
})
