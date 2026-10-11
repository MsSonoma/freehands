import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mathPlaceName,
  parseMathDecimal,
  applyVerticalMathCommand,
} from './verticalMath.mjs'
import {
  buildVerticalAdditionProblem,
  createVerticalAdditionView,
  enterAdditionDigit,
  evaluateVerticalAddition,
} from './verticalAddition.mjs'

test('shared decimal parsing preserves valid grouping, leading zeros, and precision bounds', () => {
  assert.deepEqual(parseMathDecimal('001,234.000001'), {
    whole: '1234',
    fraction: '000001',
    text: '1234.000001',
  })
  assert.deepEqual(parseMathDecimal('0000000'), {
    whole: '0',
    fraction: '',
    text: '0',
  })
  assert.deepEqual(parseMathDecimal('9,999,999.123456'), {
    whole: '9999999',
    fraction: '123456',
    text: '9999999.123456',
  })
  assert.throws(() => parseMathDecimal('10,000,000'), /at most 7/)
  assert.throws(() => parseMathDecimal('1.1234567'), /at most 6/)
})

test('malformed separators are rejected before commas can change the numeric meaning', () => {
  assert.throws(() => parseMathDecimal('1,2'), /valid thousands separators/)
  assert.throws(() => parseMathDecimal('1.2,3'), /valid thousands separators/)
  assert.throws(() => parseMathDecimal('12,34,567'), /valid thousands separators/)
})

test('public work capacity accepts a wrong two-digit carry and grades it as wrong', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  assert.equal(problem.cellsById['carry.tens'].value, '1')
  assert.equal(problem.cellsById['carry.tens'].inputCapacity, 2)

  const requested = applyVerticalMathCommand(problem, createVerticalAdditionView(problem), {
    action: 'hide',
    locations: ['carry.tens'],
  })
  assert.equal(requested.ok, true)
  const entered = enterAdditionDigit(problem, requested.view, 'carry.tens', '12')
  assert.equal(entered.ok, true)
  assert.equal(entered.view.entries['carry.tens'], '12')
  assert(evaluateVerticalAddition(problem, entered.view).incorrectLocations.includes('carry.tens'))
})

test('ordinary cells accept one digit only and malformed text is never sanitized', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  const view = createVerticalAdditionView(problem)
  assert.equal(problem.cellsById['result.ones'].inputCapacity, 1)
  assert.equal(enterAdditionDigit(problem, view, 'result.ones', '8').ok, true)

  for (const malformed of ['12', '1a', 'a1', ' 1']) {
    const response = enterAdditionDigit(problem, view, 'result.ones', malformed)
    assert.equal(response.ok, false, malformed)
    assert.equal(Object.hasOwn(response.view?.entries || view.entries, 'result.ones'), false)
  }
})

test('an all-given demonstration requires no response and is not learner success', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  const shown = applyVerticalMathCommand(problem, createVerticalAdditionView(problem), {
    action: 'show',
    locations: ['result.*'],
  })
  assert.equal(shown.ok, true)
  const evaluation = evaluateVerticalAddition(problem, shown.view)
  assert.equal(evaluation.complete, true)
  assert.equal(evaluation.checked, 0)
  assert.equal(evaluation.responseRequired, false)
  assert.equal(evaluation.correct, false)
})

test('shared place names include the fourteen-digit multiplication result ceiling', () => {
  assert.equal(mathPlaceName(13), 'ten_trillions')
})
