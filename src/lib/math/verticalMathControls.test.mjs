import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVerticalAdditionProblem, createVerticalAdditionView } from './verticalAddition.mjs'
import { buildVerticalMultiplicationProblem } from './verticalMultiplication.mjs'
import {
  applyVerticalMathCommand,
  enterVerticalMathCell,
  enterVerticalMathFullAnswer,
  evaluateVerticalMath,
  getVerticalMathLocationDescriptor,
  getVerticalMathRowDescriptor,
  resolveVerticalMathLocations,
  verticalMathAddressCatalog,
  validateVerticalMathExercise,
} from './verticalMath.mjs'

function request(problem, view, locations, editable = true) {
  return applyVerticalMathCommand(problem, view, { action: 'hide', locations, editable })
}

test('symbol IDs resolve exactly, stay out of digit wildcards, and appear in the catalog', () => {
  const problem = buildVerticalAdditionProblem(['1.2', '3.45'])
  assert.deepEqual(resolveVerticalMathLocations(problem, ['operator']), ['operator'])
  assert.deepEqual(resolveVerticalMathLocations(problem, ['operand.1.decimal']), ['operand.1.decimal'])
  assert(resolveVerticalMathLocations(problem, ['result.*']).every((id) => id !== 'result.decimal'))
  const catalog = verticalMathAddressCatalog(problem)
  assert(catalog.locations.includes('operator'))
  assert(catalog.locations.includes('operand.1.decimal'))
  assert(catalog.locations.includes('result.decimal'))
  assert.equal(Object.hasOwn(catalog, 'operator'), false)
})

test('public descriptors name symbols without exposing expected values', () => {
  const problem = buildVerticalAdditionProblem(['1.2', '3.45'])
  const operator = getVerticalMathLocationDescriptor(problem, 'operator')
  assert.deepEqual(operator.choices, ['+', '-', '\u00d7'])
  assert.equal(Object.hasOwn(operator, 'value'), false)
  const decimal = getVerticalMathLocationDescriptor(problem, 'operand.1.decimal')
  assert.equal(decimal.kind, 'decimal')
  assert.equal(decimal.minimum, 0)
  assert.equal(decimal.maximum, problem.rows[0].cells.length - 1)
  assert.equal(Object.hasOwn(decimal, 'value'), false)
  const row = getVerticalMathRowDescriptor(problem, 'operand.1')
  assert.equal(row.cells.length, problem.rows[0].cells.length)
  assert.equal(row.decimal.id, 'operand.1.decimal')
})

test('default hide remains editable while explicit conceal preserves history and removes grading', () => {
  const problem = buildVerticalAdditionProblem(['4', '5'])
  const initial = createVerticalAdditionView(problem)
  const legacy = request(problem, initial, ['operator'])
  assert.equal(legacy.ok, true)
  assert(legacy.view.editable.includes('operator'))
  const entered = enterVerticalMathCell(problem, legacy.view, 'operator', '+')
  const concealed = request(problem, entered.view, ['operator'], false)
  assert.equal(concealed.ok, true)
  assert.equal(concealed.view.entries.operator, '+')
  assert.equal(concealed.view.editable.includes('operator'), false)
  assert.equal(evaluateVerticalMath(problem, concealed.view).checked, initial.editable.length)
})

test('invalid editable type fails atomically and test phase locks every presentation command', () => {
  const problem = buildVerticalAdditionProblem(['4', '5'])
  const view = createVerticalAdditionView(problem)
  const snapshot = structuredClone(view)
  assert.equal(applyVerticalMathCommand(problem, view, {
    action: 'hide', locations: ['operator'], editable: 'false',
  }).ok, false)
  assert.deepEqual(view, snapshot)
  for (const command of [
    { action: 'hide', locations: ['operator'] },
    { action: 'show', locations: ['operator'] },
    { action: 'highlight', locations: ['operator'] },
    { action: 'clear_highlight' },
  ]) assert.equal(applyVerticalMathCommand(problem, view, command, { phase: 'test' }).ok, false)
})

test('operator input normalizes multiplication and grades correct, wrong, empty, and malformed answers', () => {
  const problem = buildVerticalMultiplicationProblem(['2', '3'])
  const unsafe = request(problem, createVerticalAdditionView(problem), ['operator'])
  assert.equal(validateVerticalMathExercise(problem, unsafe.view).status, 'ambiguous')
  const shown = applyVerticalMathCommand(problem, createVerticalAdditionView(problem), {
    action: 'show', locations: ['result.*'],
  })
  const requested = request(problem, shown.view, ['operator'])
  assert.equal(evaluateVerticalMath(problem, requested.view).complete, false)
  const correct = enterVerticalMathCell(problem, requested.view, 'operator', '*')
  assert.equal(correct.ok, true)
  assert.equal(correct.view.entries.operator, '\u00d7')
  assert.equal(evaluateVerticalMath(problem, correct.view).incorrectLocations.includes('operator'), false)
  const wrong = enterVerticalMathCell(problem, requested.view, 'operator', '+')
  assert(evaluateVerticalMath(problem, wrong.view).incorrectLocations.includes('operator'))
  for (const malformed of ['x', ' +', 1]) assert.equal(
    enterVerticalMathCell(problem, requested.view, 'operator', malformed).ok, false,
  )
  const cleared = enterVerticalMathCell(problem, correct.view, 'operator', '')
  assert.equal(Object.hasOwn(cleared.view.entries, 'operator'), false)
})

test('decimal placement uses physical alignment and public-width bounds without coercion', () => {
  const problem = buildVerticalAdditionProblem(['1.2', '3.45'])
  const ids = ['operand.1.decimal', 'operand.2.decimal']
  const unsafe = request(problem, createVerticalAdditionView(problem), ids)
  assert.equal(validateVerticalMathExercise(problem, unsafe.view).status, 'ambiguous')
  const shown = applyVerticalMathCommand(problem, createVerticalAdditionView(problem), {
    action: 'show', locations: ['result.*'],
  })
  const requested = request(problem, shown.view, [ids[0]])
  const correct = enterVerticalMathCell(problem, requested.view, ids[0], '2')
  assert.equal(evaluateVerticalMath(problem, correct.view).incorrectLocations.length, 0)
  const wrong = enterVerticalMathCell(problem, requested.view, ids[0], '1')
  assert(evaluateVerticalMath(problem, wrong.view).incorrectLocations.includes(ids[0]))
  const maximum = problem.rows[0].cells.length - 1
  for (const malformed of ['02', '1.0', ' 1', '-1', maximum + 1, String(maximum + 1)]) {
    assert.equal(enterVerticalMathCell(problem, requested.view, ids[0], malformed).ok, false)
  }
})

test('full-answer entry cannot bypass an editable result decimal region', () => {
  const problem = buildVerticalAdditionProblem(['1.2', '3.45'])
  const requested = request(problem, createVerticalAdditionView(problem), ['result.decimal'])
  const before = structuredClone(requested.view)
  const response = enterVerticalMathFullAnswer(problem, requested.view, '4.65')
  assert.equal(response.ok, false)
  assert.deepEqual(requested.view, before)
})
