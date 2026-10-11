import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildVerticalSubtractionProblem,
  createVerticalSubtractionView,
  applyVerticalSubtractionCommand,
  enterSubtractionDigit,
  enterSubtractionFullAnswer,
  evaluateVerticalSubtraction,
} from './verticalSubtraction.mjs'
import { verticalMathAddressCatalog } from './verticalMath.mjs'

test('ordinary subtraction aligns the digits and computes the answer', () => {
  const p = buildVerticalSubtractionProblem(['78', '34'])
  assert.equal(p.answer, '44')
  assert.equal(p.operator, '-')
  assert.equal(p.rows.length, 2)
  assert.equal(p.workRows[0].id, 'regroup')
  assert.equal(p.cellsById['result.tens'].value, '4')
  assert.equal(p.cellsById['regroup.ones'].value, null)
  assert.equal(verticalMathAddressCatalog(p).operation, 'subtraction')
})

test('borrowing from the adjacent place has individually named marks', () => {
  const p = buildVerticalSubtractionProblem(['32', '18'])
  assert.equal(p.answer, '14')
  assert.equal(p.cellsById['regroup.ones'].value, '12')
  assert.equal(p.cellsById['regroup.tens'].value, '2')
  assert.deepEqual(p.borrowSteps[0].through, [])
})

test('borrowing across consecutive zeros modifies every affected place', () => {
  const p = buildVerticalSubtractionProblem(['1002', '879'])
  assert.equal(p.answer, '123')
  assert.equal(p.cellsById['regroup.thousands'].value, '0')
  assert.equal(p.cellsById['regroup.hundreds'].value, '9')
  assert.equal(p.cellsById['regroup.tens'].value, '9')
  assert.equal(p.cellsById['regroup.ones'].value, '12')
  assert.deepEqual(p.borrowSteps[0].through, [
    'operand.1.hundreds',
    'operand.1.tens',
  ])
  assert(p.groups.includes('regroup.*'))
})

test('decimal subtraction aligns padded fractional zeros and borrows into fraction', () => {
  const p = buildVerticalSubtractionProblem(['1.2', '0.35'])
  assert.equal(p.answer, '0.85')
  assert.equal(p.cellsById['operand.1.hundredths'].value, '0')
  assert.equal(p.cellsById['regroup.hundredths'].value, '10')
  assert.equal(p.cellsById['regroup.tenths'].value, '11')
  assert.equal(p.cellsById['regroup.ones'].value, '0')
  assert.equal(p.borrowSteps.length, 2)
})

test('borrow through multiple zero fractional and whole positions', () => {
  const p = buildVerticalSubtractionProblem(['100.00', '0.01'])
  assert.equal(p.answer, '99.99')
  assert.equal(p.cellsById['regroup.hundreds'].value, '0')
  assert.equal(p.cellsById['regroup.tens'].value, '9')
  assert.equal(p.cellsById['regroup.ones'].value, '9')
  assert.equal(p.cellsById['regroup.tenths'].value, '9')
  assert.equal(p.cellsById['regroup.hundredths'].value, '10')
})

test('same shared hide and show commands apply to operands, answers and regroup marks', () => {
  const p = buildVerticalSubtractionProblem(['32', '18'])
  let view = createVerticalSubtractionView(p)
  assert(view.hidden.includes('regroup.ones'))
  const shown = applyVerticalSubtractionCommand(p, view, {
    action: 'show', locations: ['result.*', 'regroup.*'],
  })
  assert.equal(shown.ok, true)
  view = shown.view
  assert(!view.hidden.includes('regroup.ones'))
  const hidden = applyVerticalSubtractionCommand(p, view, {
    action: 'hide', locations: ['regroup.ones', 'result.tens'],
  })
  assert.equal(hidden.ok, true)
  view = hidden.view
  assert(view.editable.includes('regroup.ones'))
  assert(view.editable.includes('result.tens'))
  view = enterSubtractionDigit(p, view, 'regroup.ones', '12').view
  view = enterSubtractionDigit(p, view, 'result.tens', '1').view
  assert.equal(evaluateVerticalSubtraction(p, view).correct, true)
})

test('full answer can be entered and checked with the shared evaluator', () => {
  const p = buildVerticalSubtractionProblem(['1002', '879'])
  const view = createVerticalSubtractionView(p)
  const response = enterSubtractionFullAnswer(p, view, '123')
  assert.equal(response.ok, true)
  assert.equal(evaluateVerticalSubtraction(p, response.view).correct, true)
  const wrong = enterSubtractionFullAnswer(p, view, '133')
  assert.equal(evaluateVerticalSubtraction(p, wrong.view).correct, false)
})

test('invalid locations, wrong borrow values and test-mode presentation changes are blocked', () => {
  const p = buildVerticalSubtractionProblem(['32', '18'])
  const view = createVerticalSubtractionView(p)
  assert.equal(applyVerticalSubtractionCommand(p, view, { action: 'hide', locations: ['regroup.millions'] }).ok, false)
  assert.equal(enterSubtractionDigit(p, view, 'regroup.ones', '10').ok, false) // not editable until explicitly requested
  assert.equal(enterSubtractionDigit(p, view, 'result.ones', '12').ok, false)
  assert.equal(applyVerticalSubtractionCommand(p, view, { action: 'show', locations: ['result.ones'] }, { phase: 'test' }).ok, false)
  assert.equal(applyVerticalSubtractionCommand(p, view, { action: 'highlight', locations: ['result.ones'] }, { phase: 'test' }).ok, false)
})

test('subtraction supports millions and rejects negative results instead of misrepresenting them', () => {
  const p = buildVerticalSubtractionProblem(['9,999,999', '9,999,998'])
  assert.equal(p.answer, '1')
  assert.equal(p.wholeColumns, 8)
  assert.equal(p.cellsById['operand.1.millions'].value, '9')
  assert.throws(() => buildVerticalSubtractionProblem(['7', '15']), /at least as large/)
  assert.throws(() => buildVerticalSubtractionProblem(['1']), /exactly two/)
  assert.throws(() => buildVerticalSubtractionProblem(['9', '2', '1']), /exactly two/)
  assert.throws(() => buildVerticalSubtractionProblem(['10000000', '1']), /at most 7/)
})

test('800 deterministic decimal and whole-number differences equal an independent bigint calculation', () => {
  let seed = 20261010
  function rand() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed
  }
  for (let i = 0; i < 800; i++) {
    const precision = rand() % 7
    const factor = 10n ** BigInt(precision)
    const a = BigInt(rand() % 10000000) * factor + BigInt(rand() % Number(factor))
    const b = BigInt(rand() % 10000000) * factor + BigInt(rand() % Number(factor))
    const bigger = a > b ? a : b
    const smaller = a > b ? b : a
    const format = (value) => (value / factor).toString() +
      (precision ? '.' + (value % factor).toString().padStart(precision, '0') : '')
    const p = buildVerticalSubtractionProblem([format(bigger), format(smaller)])
    assert.equal(p.answer, format(bigger - smaller), 'sample ' + i)
    const filled = enterSubtractionFullAnswer(p, createVerticalSubtractionView(p), format(bigger - smaller))
    assert.equal(filled.ok, true)
    assert.equal(evaluateVerticalSubtraction(p, filled.view).correct, true)
  }
})
