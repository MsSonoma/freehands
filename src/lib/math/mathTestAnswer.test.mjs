import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVerticalAdditionProblem } from './verticalAddition.mjs'
import { buildVerticalDivisionProblem } from './verticalDivision.mjs'
import { createVerticalMathView } from './verticalMath.mjs'
import { evaluateMathTestAnswer } from './mathTestAnswer.mjs'
import {
  createMathSession,
  restoreMathSession,
  serializeMathSession,
  submitMathSession,
  updateMathSessionView,
} from './mathSession.mjs'

function evaluated(problem, entries) {
  const view = createVerticalMathView(problem)
  return evaluateMathTestAnswer(problem, { ...view, entries })
}

function testSession(operands, operation = 'addition', activityId = 'test-activity') {
  const created = createMathSession({ operation, operands }, { activityId, phase: 'test' })
  assert.equal(created.ok, true)
  return created.state
}

function enter(state, entries, requestId = 'input-1') {
  const updated = updateMathSessionView(
    state,
    { ...state.view, entries },
    { activityId: state.activityId, expectedRevision: state.revision, requestId },
  )
  assert.equal(updated.ok, true)
  return updated.state
}

test('test readiness accepts shorter and longer whole answers without using the solved width', () => {
  const problem = buildVerticalAdditionProblem(['12', '7'])

  const shorter = evaluated(problem, { 'result.ones': '9' })
  assert.equal(shorter.complete, true)
  assert.equal(shorter.correct, false)
  assert.equal(shorter.checked, 1)

  const correct = evaluated(problem, { 'result.tens': '1', 'result.ones': '9' })
  assert.equal(correct.complete, true)
  assert.equal(correct.correct, true)
  assert.equal(correct.checked, 2)

  const longer = evaluated(problem, {
    'result.hundreds': '1',
    'result.tens': '1',
    'result.ones': '9',
  })
  assert.equal(longer.complete, true)
  assert.equal(longer.correct, false)
  assert.equal(longer.checked, 3)
})

test('whole answers require ones and reject internal holes below the first supplied digit', () => {
  const problem = buildVerticalAdditionProblem(['100', '100'])
  const missingLowerPlaces = evaluated(problem, { 'result.hundreds': '2' })
  assert.equal(missingLowerPlaces.complete, false)
  assert.deepEqual(missingLowerPlaces.missingLocations, ['result.ones', 'result.tens'])

  const internalHole = evaluated(problem, {
    'result.hundreds': '2',
    'result.ones': '0',
  })
  assert.equal(internalHole.complete, false)
  assert.deepEqual(internalHole.missingLocations, ['result.tens'])

  const complete = evaluated(problem, {
    'result.hundreds': '2',
    'result.tens': '0',
    'result.ones': '0',
  })
  assert.equal(complete.correct, true)
})

test('zero and decimal answers permit omitted numeric padding but not internal fractional holes', () => {
  const zero = buildVerticalAdditionProblem(['0', '0'])
  assert.equal(evaluated(zero, { 'result.ones': '0' }).correct, true)

  const decimal = buildVerticalAdditionProblem(['0.20', '0.30'])
  const fractionOnly = evaluated(decimal, { 'result.tenths': '5' })
  assert.equal(fractionOnly.complete, true)
  assert.equal(fractionOnly.correct, true)

  const thousandths = buildVerticalAdditionProblem(['0.001', '0'])
  const hole = evaluated(thousandths, { 'result.thousandths': '1' })
  assert.equal(hole.complete, false)
  assert.deepEqual(hole.missingLocations, ['result.tenths', 'result.hundredths'])
})

test('division requires both answer rows and accepts an explicitly entered zero remainder', () => {
  const problem = buildVerticalDivisionProblem(['6', '3'])
  const quotientOnly = evaluated(problem, { 'result.ones': '2' })
  assert.equal(quotientOnly.complete, false)
  assert.deepEqual(quotientOnly.missingLocations, ['remainder'])

  const both = evaluated(problem, {
    'result.ones': '2',
    'remainder.ones': '0',
  })
  assert.equal(both.complete, true)
  assert.equal(both.correct, true)
})

test('test submissions retain only entered evidence and redact public grading', () => {
  let state = testSession(['12', '7'])
  state = enter(state, { 'result.ones': '9' })
  const request = {
    activityId: state.activityId,
    expectedRevision: state.revision,
    requestId: 'submit-1',
  }
  const submitted = submitMathSession(state, request)
  assert.equal(submitted.ok, true)
  assert.deepEqual(submitted.submission.entries, { 'result.ones': '9' })
  assert.equal(submitted.submission.responseText, 'result.ones=9')
  assert.equal(Object.hasOwn(submitted.submission, 'evaluation'), false)
  assert.equal(Object.hasOwn(submitted.submission, 'correct'), false)
  assert.deepEqual(submitted.state.attempts[0].targets, ['result.ones'])
  assert.deepEqual(submitted.state.attempts[0].entries, { 'result.ones': '9' })
  assert.equal(submitted.state.attempts[0].evaluation.correct, false)

  const duplicate = submitMathSession(submitted.state, request)
  assert.equal(duplicate.ok, true)
  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.state.attempts.length, 1)
  assert.deepEqual(duplicate.submission, submitted.submission)
})

test('test snapshots roundtrip and reject reveals and unsupported attempt targets', () => {
  const spec = { operation: 'addition', operands: ['12', '7'] }
  let state = testSession(spec.operands)
  state = enter(state, { 'result.tens': '1', 'result.ones': '9' })
  const submitted = submitMathSession(state, {
    activityId: state.activityId,
    expectedRevision: state.revision,
    requestId: 'submit-restore',
  })
  assert.equal(submitted.ok, true)

  const restored = restoreMathSession(serializeMathSession(submitted.state), {
    activityId: state.activityId,
    phase: 'test',
    spec,
  })
  assert.equal(restored.ok, true)
  assert.deepEqual(restored.state.attempts[0].targets, ['result.tens', 'result.ones'])

  const revealed = serializeMathSession(submitted.state)
  revealed.view.highlighted = ['result.ones']
  const rejectedReveal = restoreMathSession(revealed, {
    activityId: state.activityId,
    phase: 'test',
    spec,
  })
  assert.equal(rejectedReveal.ok, false)
  assert.equal(rejectedReveal.code, 'INVALID_SNAPSHOT')

  const unsupported = serializeMathSession(submitted.state)
  unsupported.attempts[0].targets.push('result.hundreds')
  const rejectedTarget = restoreMathSession(unsupported, {
    activityId: state.activityId,
    phase: 'test',
    spec,
  })
  assert.equal(rejectedTarget.ok, false)
  assert.equal(rejectedTarget.code, 'INVALID_SNAPSHOT')
})

test('teaching submissions keep their existing full-target evaluation', () => {
  const created = createMathSession(
    { operation: 'addition', operands: ['12', '7'] },
    { activityId: 'teaching-activity', phase: 'teaching' },
  )
  assert.equal(created.ok, true)
  const partial = enter(created.state, { 'result.ones': '9' }, 'teaching-input')
  const submitted = submitMathSession(partial, {
    activityId: partial.activityId,
    expectedRevision: partial.revision,
    requestId: 'teaching-submit',
  })
  assert.equal(submitted.ok, false)
  assert.equal(submitted.code, 'INCOMPLETE_RESPONSE')
})
