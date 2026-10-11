import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildVerticalAdditionProblem,
  createVerticalAdditionView,
  resolveAdditionLocations,
  applyVerticalAdditionCommand,
  enterAdditionDigit,
  enterAdditionFullAnswer,
  evaluateVerticalAddition,
} from './verticalAddition.mjs'

test('adds two operands and exposes stable named place values', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  assert.equal(problem.answer, '73')
  assert.equal(problem.rows.length, 2)
  assert.equal(problem.cellsById['operand.1.tens'].value, '4')
  assert.equal(problem.cellsById['operand.2.ones'].value, '6')
  assert.equal(problem.cellsById['carry.tens'].value, '1')
  assert.equal(problem.cellsById['result.tens'].value, '7')
  assert.equal(problem.cellsById['result.ones'].value, '3')
  assert.equal(problem.cellsById['result.hundreds'].value, null) // reserved overflow column
  assert.deepEqual(resolveAdditionLocations(problem, ['result.ones']), ['result.ones'])
})

test('supports all ten rows, millions-place inputs, and overflow result', () => {
  const problem = buildVerticalAdditionProblem(Array(10).fill('9,999,999'))
  assert.equal(problem.rows.length, 10)
  assert.equal(problem.answer, '99999990')
  assert.equal(problem.wholeColumns, 8)
  assert.equal(problem.cellsById['operand.10.millions'].value, '9')
  assert.equal(problem.cellsById['result.ten_millions'].value, '9')
  assert.equal(problem.cellsById['carry.tens'].value, '9')
  assert.equal(problem.cellsById['carry.millions'].value, '9')
  assert.deepEqual(resolveAdditionLocations(problem, ['operand.10.*']).length, 7)
})

test('supports different operand lengths and result longer than any operand', () => {
  const problem = buildVerticalAdditionProblem(['1,245,678', '825432', '9090090', '30001'])
  assert.equal(problem.answer, '11191201')
  assert.equal(problem.wholeColumns, 8)
  assert.equal(problem.cellsById['operand.4.ten_thousands'].value, '3')
  assert.equal(problem.cellsById['result.ten_millions'].value, '1')
  assert.equal(problem.cellsById['operand.4.millions'].value, null)
})

test('adds decimal operands exactly without binary float rounding', () => {
  const problem = buildVerticalAdditionProblem(['0.1', '0.2', '0.7'])
  assert.equal(problem.answer, '1.0')
  assert.equal(problem.fractionDigits, 1)
  assert.equal(problem.cellsById['result.tenths'].value, '0')
  assert.equal(problem.cellsById['carry.ones'].value, '1')
  assert.equal(problem.cellsById['operand.2.tenths'].value, '2')
})

test('adds decimal values carrying through multiple fractional places', () => {
  const problem = buildVerticalAdditionProblem(['0.75', '0.25'])
  assert.equal(problem.answer, '1.00')
  assert.equal(problem.cellsById['carry.tenths'].value, '1')
  assert.equal(problem.cellsById['carry.ones'].value, '1')
  assert.equal(problem.columns.at(-1), -2)
})

test('full-answer input populates correct cells without revealing their expected values', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  let view = createVerticalAdditionView(problem)
  assert.equal(evaluateVerticalAddition(problem, view).complete, false)
  const typed = enterAdditionFullAnswer(problem, view, '73')
  assert.equal(typed.ok, true)
  view = typed.view
  assert.equal(view.entries['result.tens'], '7')
  assert.equal(view.entries['result.ones'], '3')
  assert.equal(evaluateVerticalAddition(problem, view).correct, true)
  assert.equal(enterAdditionFullAnswer(problem, view, '83').view.entries['result.tens'], '8')
  assert.equal(evaluateVerticalAddition(problem, enterAdditionFullAnswer(problem, view, '83').view).correct, false)
})

test('missing single operand digit uses exactly same hide command as missing result digit', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  let view = createVerticalAdditionView(problem)
  const show = applyVerticalAdditionCommand(problem, view, { action: 'show', locations: ['result.*'] })
  assert.equal(show.ok, true)
  view = show.view
  const hidden = applyVerticalAdditionCommand(problem, view, {
    action: 'hide',
    locations: ['operand.1.ones', 'result.tens'],
  })
  assert.equal(hidden.ok, true)
  view = hidden.view
  assert(view.editable.includes('operand.1.ones'))
  assert(view.editable.includes('result.tens'))
  assert(!view.editable.includes('result.ones'))
  const a = enterAdditionDigit(problem, view, 'operand.1.ones', '7')
  assert.equal(a.ok, true)
  const b = enterAdditionDigit(problem, a.view, 'result.tens', '7')
  assert.equal(b.ok, true)
  assert.equal(evaluateVerticalAddition(problem, b.view).correct, true)
})

test('invalid location and illegal digits are rejected without mutating view', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  const view = createVerticalAdditionView(problem)
  const prior = JSON.stringify(view)
  assert.equal(applyVerticalAdditionCommand(problem, view, { action: 'hide', locations: ['foo.ones'] }).ok, false)
  assert.equal(applyVerticalAdditionCommand(problem, view, {
    action: 'hide', locations: ['result.ones', 'operand.1.millions'],
  }).ok, false)
  assert.equal(enterAdditionDigit(problem, view, 'result.ones', '99').ok, false)
  assert.equal(enterAdditionDigit(problem, view, 'operand.1.ones', '7').ok, false)
  assert.equal(JSON.stringify(view), prior)
})

test('highlight and grouped show commands use validated named addresses', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  let view = createVerticalAdditionView(problem)
  const highlight = applyVerticalAdditionCommand(problem, view, {
    action: 'highlight', locations: ['result.ones', 'operand.2.ones'],
  })
  assert.equal(highlight.ok, true)
  assert.equal(highlight.view.highlighted.length, 2)
  view = applyVerticalAdditionCommand(problem, highlight.view, { action: 'show', locations: ['result.*'] }).view
  assert.equal(view.editable.filter((id) => id.startsWith('result.')).length, 0)
  assert.equal(view.hidden.filter((id) => id.startsWith('result.')).length, 0)
})

test('test mode disallows revealing answers through tool commands', () => {
  const problem = buildVerticalAdditionProblem(['47', '26'])
  const view = createVerticalAdditionView(problem)
  const response = applyVerticalAdditionCommand(problem, view, {
    action: 'show', locations: ['result.ones'],
  }, { phase: 'test' })
  assert.equal(response.ok, false)
  assert.equal(view.hidden.includes('result.ones'), true)
})

test('rejects invalid row count and too many digits', () => {
  assert.throws(() => buildVerticalAdditionProblem(['1']), /2 to 10/)
  assert.throws(() => buildVerticalAdditionProblem(Array(11).fill('1')), /2 to 10/)
  assert.throws(() => buildVerticalAdditionProblem(['10,000,000', '1']), /at most 7/)
  assert.throws(() => buildVerticalAdditionProblem(['-2', '1']), /nonnegative/)
  assert.throws(() => buildVerticalAdditionProblem(['1.1234567', '1']), /at most 6/)
})

test('600 deterministic generated whole and decimal additions match independent bigint arithmetic', () => {
  let seed = 20261010
  function rand() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed
  }
  for (let trial = 0; trial < 600; trial++) {
    const count = 2 + (rand() % 9)
    const operands = []
    const parts = []
    for (let index = 0; index < count; index++) {
      const whole = String(rand() % 10000000)
      const precision = rand() % 7
      const fraction = precision ? String(rand() % (10 ** precision)).padStart(precision, '0') : ''
      parts.push({ whole, fraction })
      operands.push(whole + (fraction ? '.' + fraction : ''))
    }
    const scale = Math.max(...parts.map((part) => part.fraction.length))
    const total = parts.reduce((sum, part) => (
      sum + BigInt(part.whole + part.fraction) * 10n ** BigInt(scale - part.fraction.length)
    ), 0n)
    const power = 10n ** BigInt(scale)
    const expected = String(total / power) + (scale ? '.' + String(total % power).padStart(scale, '0') : '')
    const problem = buildVerticalAdditionProblem(operands)
    assert.equal(problem.answer, expected, 'case ' + trial + ': ' + operands.join(' + '))
    const filled = enterAdditionFullAnswer(problem, createVerticalAdditionView(problem), expected)
    assert.equal(filled.ok, true, 'case ' + trial + ' accepts the exact answer')
    assert.equal(evaluateVerticalAddition(problem, filled.view).correct, true, 'case ' + trial + ' grades correctly')
  }
})
