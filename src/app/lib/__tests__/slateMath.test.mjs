import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import {
  buildMathActivityProblem,
  createMathSession,
  submitMathSession,
  updateMathSessionView,
} from '../../../lib/math/mathSession.mjs'
import { enterVerticalMathFullAnswer } from '../../../lib/math/verticalMath.mjs'
import {
  createOrRestoreSlateMathActivity,
  createSlateMathActivityId,
  verifySlateMathSubmission,
} from '../slateMath.mjs'
import {
  buildLiftoffSnapshotFeatureState,
  isLiftoffProblemFresh,
  normalizeLiftoffProblem,
} from '../slateLiftoff.mjs'

const math = { operation: 'addition', operands: ['12', '7'], commands: [] }

function submitted(answer = '19') {
  const activityId = createSlateMathActivityId({ occurrenceId: 'o', executionSessionId: 'e', stage: 'teach', turnNumber: 2 })
  let state = createMathSession(math, { activityId }).state
  const entered = enterVerticalMathFullAnswer(buildMathActivityProblem(math), state.view, answer)
  state = updateMathSessionView(state, entered.view, { activityId, expectedRevision: 0, requestId: 'input' }).state
  const result = submitMathSession(state, { activityId, expectedRevision: state.revision, requestId: 'submit' })
  return { problem: { prompt: 'Add.', instanceKey: 'anything', math }, snapshot: result.state, submission: result.submission }
}

test('text problems retain their legacy shape while math survives normalization', () => {
  assert.deepEqual(normalizeLiftoffProblem({ prompt: 'Read this.', instanceKey: 'A' }), {
    prompt: 'Read this.', instanceKey: 'a', fingerprint: 'read this.',
  })
  assert.deepEqual(normalizeLiftoffProblem({ prompt: 'Add.', instanceKey: 'x', math }).math, math)
  assert.throws(() => normalizeLiftoffProblem({ prompt: 'Add.', math: { operation: 'addition', operands: [1, 2] } }), /strings/)
})

test('arithmetic identity defeats nonce and wording freshness changes', () => {
  const first = { prompt: 'Add these.', instanceKey: 'nonce-a', math }
  const second = { prompt: 'Find the sum.', instanceKey: 'nonce-b', math: { ...math, commands: [{ action: 'highlight', locations: ['operand.1.ones'] }] } }
  assert.equal(isLiftoffProblemFresh(second, [first]), false)
})

test('snapshot optional math fields preserve old callers and round trip controller snapshots', () => {
  const old = buildLiftoffSnapshotFeatureState({ occurrenceId: 'o', executionSessionId: 'e' })
  assert.equal(Object.hasOwn(old, 'mathSession'), false)
  const made = createOrRestoreSlateMathActivity({ math, activityId: 'a' })
  assert.equal(made.ok, true)
  const feature = buildLiftoffSnapshotFeatureState({ occurrenceId: 'o', executionSessionId: 'e', mathSession: made.state, mathArchive: [] })
  assert.strictEqual(feature.mathSession, made.state)
  assert.equal(createOrRestoreSlateMathActivity({ math, snapshot: made.state, activityId: 'a' }).ok, true)
})

test('verifier recomputes grading and rejects forged or stale bindings', () => {
  const data = submitted('19')
  data.snapshot.attempts[0].evaluation.correct = false
  const forged = { ...data.submission, evaluation: { correct: false } }
  const verified = verifySlateMathSubmission({ ...data, submission: forged })
  assert.equal(verified.ok, true)
  assert.equal(verified.evidence.correct, true)
  assert.equal(verified.evidence.independent, true)
  assert.deepEqual(verified.evidence.targetValues, data.submission.entries)
  assert.equal(verifySlateMathSubmission({ ...data, submission: { ...forged, activityId: 'wrong' } }).code, 'ACTIVITY_MISMATCH')
  assert.equal(verifySlateMathSubmission({ ...data, submission: { ...forged, submittedRevision: 99 } }).code, 'STALE_SUBMISSION')
  assert.equal(verifySlateMathSubmission({ problem: data.problem, snapshot: data.snapshot }).code, 'MISSING_SUBMISSION')
  assert.equal(verifySlateMathSubmission({ ...data, problem: { ...data.problem, math: { ...math, operands: ['13', '7'] } } }).ok, false)
})

test('assistance and incorrect entries are reported conservatively', () => {
  const wrong = verifySlateMathSubmission(submitted('18'))
  assert.equal(wrong.evidence.correct, false)
  assert.equal(wrong.evidence.independent, false)
  const helped = submitted('19')
  helped.snapshot.attempts[0].assisted = true
  helped.snapshot.assisted = true
  const result = verifySlateMathSubmission(helped)
  assert.equal(result.evidence.assisted, true)
  assert.equal(result.evidence.independent, false)
})

test('activity IDs are deterministic, host-derived, and bounded', () => {
  const input = { occurrenceId: 'x'.repeat(500), executionSessionId: 'e', stage: 'teaching', assessmentIndex: 3 }
  assert.equal(createSlateMathActivityId(input), createSlateMathActivityId(input))
  assert.ok(createSlateMathActivityId(input).length <= 200)
})

test('route blocks test line help and verifies math before the model call', () => {
  const source = readFileSync(new URL('../../api/slate-liftoff/route.js', import.meta.url), 'utf8')
  assert.match(source, /mode === 'line_help'[\s\S]*body\?\.phase === 'test'/)
  assert.ok(source.indexOf('verifySlateMathSubmission({') < source.indexOf('let modelText = await callModel(prompt)'))
  assert.match(source, /mathReceipt/)
})
