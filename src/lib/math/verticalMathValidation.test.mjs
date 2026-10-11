import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVerticalAdditionProblem, createVerticalAdditionView } from './verticalAddition.mjs'
import { buildVerticalSubtractionProblem } from './verticalSubtraction.mjs'
import { buildVerticalMultiplicationProblem } from './verticalMultiplication.mjs'
import {
  applyVerticalMathCommand,
  enterVerticalMathCell,
  evaluateVerticalMath,
  validateVerticalMathExercise,
} from './verticalMath.mjs'

function show(problem, view, locations) {
  const response = applyVerticalMathCommand(problem, view, { action: 'show', locations })
  assert.equal(response.ok, true)
  return response.view
}

function hide(problem, view, locations, editable = true, options = {}) {
  return applyVerticalMathCommand(problem, view, { action: 'hide', locations, editable }, options)
}

function shownResult(problem) {
  return show(problem, createVerticalAdditionView(problem), ['result.*'])
}

test('default known operands with empty full results take the unique fast path for all operations', () => {
  for (const problem of [
    buildVerticalAdditionProblem(['4', '5']),
    buildVerticalSubtractionProblem(['9', '4']),
    buildVerticalMultiplicationProblem(['3', '2']),
  ]) {
    const validation = validateVerticalMathExercise(problem, createVerticalAdditionView(problem))
    assert.equal(validation.status, 'unique')
    assert.equal(validation.examined, 1)
  }
})

test('4 + 5 = 9 with two masked addends is ambiguous and learner entries are never evidence', () => {
  const problem = buildVerticalAdditionProblem(['4', '5'])
  const locations = ['operand.1.ones', 'operand.2.ones']
  const requested = hide(problem, shownResult(problem), locations)
  assert.equal(requested.ok, true)
  assert.equal(validateVerticalMathExercise(problem, requested.view).status, 'ambiguous')
  let entered = enterVerticalMathCell(problem, requested.view, locations[0], '3').view
  entered = enterVerticalMathCell(problem, entered, locations[1], '6').view
  const grade = evaluateVerticalMath(problem, entered)
  assert.equal(grade.gradable, false)
  assert.equal(grade.correct, false)
  assert.deepEqual(grade.incorrectLocations, [])
})

test('a single missing operand is uniquely fixed by a shown result', () => {
  const problem = buildVerticalAdditionProblem(['4', '5'])
  const requested = hide(problem, shownResult(problem), ['operand.1.ones'])
  assert.equal(validateVerticalMathExercise(problem, requested.view).status, 'unique')
})

test('requireUnique rejects an ambiguous presentation atomically', () => {
  const problem = buildVerticalAdditionProblem(['4', '5'])
  const view = shownResult(problem)
  const snapshot = structuredClone(view)
  const response = hide(problem, view, ['operand.1.ones', 'operand.2.ones'], true, { requireUnique: true })
  assert.equal(response.ok, false)
  assert.equal(response.status, 'ambiguous')
  assert.deepEqual(view, snapshot)
})

test('a concealed noneditable source remains unknown and search budget exhaustion is unverified', () => {
  const problem = buildVerticalAdditionProblem(['4', '5'])
  const one = hide(problem, createVerticalAdditionView(problem), ['operand.1.ones'], false)
  assert.equal(validateVerticalMathExercise(problem, one.view).status, 'ambiguous')
  const two = hide(problem, one.view, ['operand.2.ones'], false)
  assert.equal(validateVerticalMathExercise(problem, two.view, { maxCandidates: 10 }).status, 'unverified')
})

test('visible or required scratch with an unknown source is conservatively unverified', () => {
  const problem = buildVerticalAdditionProblem(['8', '7'])
  let view = show(problem, shownResult(problem), ['carry.tens'])
  view = hide(problem, view, ['operand.1.ones']).view
  assert.equal(validateVerticalMathExercise(problem, view).status, 'unverified')

  const required = hide(problem, createVerticalAdditionView(problem), ['operand.1.ones', 'carry.tens']).view
  assert.equal(validateVerticalMathExercise(problem, required).status, 'unverified')
})

test('shown product digits uniquely fix 56.088 decimal placement while zero remains ambiguous', () => {
  const product = buildVerticalMultiplicationProblem(['12.3', '4.56'])
  const productView = hide(product, shownResult(product), ['result.decimal']).view
  assert.equal(validateVerticalMathExercise(product, productView).status, 'unique')

  const zero = buildVerticalMultiplicationProblem(['0', '0'])
  const zeroView = hide(zero, shownResult(zero), ['result.decimal']).view
  assert.equal(validateVerticalMathExercise(zero, zeroView).status, 'ambiguous')
})

test('shown result makes 3 ? 2 = 5 unique and 2 ? 2 = 4 ambiguous', () => {
  const unique = buildVerticalAdditionProblem(['3', '2'])
  const uniqueView = hide(unique, shownResult(unique), ['operator']).view
  assert.equal(validateVerticalMathExercise(unique, uniqueView).status, 'unique')

  const ambiguous = buildVerticalAdditionProblem(['2', '2'])
  const ambiguousView = hide(ambiguous, shownResult(ambiguous), ['operator']).view
  assert.equal(validateVerticalMathExercise(ambiguous, ambiguousView).status, 'ambiguous')
})

test('addition decimal search uses physical slots and ignores wrong learner entries', () => {
  const problem = buildVerticalAdditionProblem(['1.2', '3.45'])
  const location = 'operand.1.decimal'
  const requested = hide(problem, shownResult(problem), [location])
  assert.equal(validateVerticalMathExercise(problem, requested.view).status, 'unique')
  const wrong = enterVerticalMathCell(problem, requested.view, location, '1').view
  assert.equal(validateVerticalMathExercise(problem, wrong).status, 'unique')
  assert.deepEqual(evaluateVerticalMath(problem, wrong).incorrectLocations, [location])
})

test('canonical templates are admitted without leaking expected values in validation results', () => {
  const problem = buildVerticalAdditionProblem(['4', '5'])
  const view = hide(problem, shownResult(problem), ['operand.1.ones']).view
  const validation = validateVerticalMathExercise(problem, view)
  assert.deepEqual(Object.keys(validation).sort(), ['examined', 'ok', 'reason', 'status'])
  assert.equal(validation.ok, true)
  assert.equal(validation.status, 'unique')
  assert.doesNotMatch(JSON.stringify(validation), /operand|expected|4/)
})
