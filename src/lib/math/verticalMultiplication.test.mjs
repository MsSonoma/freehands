import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildVerticalMultiplicationProblem,
  createVerticalMultiplicationView,
  resolveMultiplicationLocations,
  applyVerticalMultiplicationCommand,
  enterMultiplicationDigit,
  enterMultiplicationFullAnswer,
  evaluateVerticalMultiplication,
} from './verticalMultiplication.mjs'
import { mathPlaceName, verticalMathAddressCatalog } from './verticalMath.mjs'

function cellValue(problem, row, place) {
  return problem.cellsById[row + '.' + mathPlaceName(place)].value
}

test('47 times 26 exposes exact partial products and distinct carry sets', () => {
  const problem = buildVerticalMultiplicationProblem(['47', '26'])
  assert.equal(problem.answer, '1222')
  assert.equal(problem.wholeColumns, 4)
  assert.deepEqual(problem.partialRows.map((row) => row.id), ['partial.1', 'partial.2'])

  assert.deepEqual([0, 1, 2, 3].map((place) => cellValue(problem, 'partial.1', place)), ['2', '8', '2', null])
  assert.deepEqual([0, 1, 2, 3].map((place) => cellValue(problem, 'partial.2', place)), ['0', '4', '9', null])
  assert.equal(cellValue(problem, 'multiply_carry.1', 1), '4')
  assert.equal(cellValue(problem, 'multiply_carry.1', 2), '2')
  assert.equal(cellValue(problem, 'multiply_carry.2', 2), '1')
  assert.equal(cellValue(problem, 'multiply_carry.2', 3), null)
  assert.equal(cellValue(problem, 'sum_carry', 2), '1')
  assert.equal(cellValue(problem, 'sum_carry', 3), '1')
  assert.equal(problem.cellsById['result.thousands'].value, '1')
  assert.equal(verticalMathAddressCatalog(problem).operation, 'multiplication')
})

test('123 times 405 retains the zero middle partial as two zero cells', () => {
  const problem = buildVerticalMultiplicationProblem(['123', '405'])
  assert.equal(problem.answer, '49815')
  assert.equal(cellValue(problem, 'partial.1', 0), '5')
  assert.equal(cellValue(problem, 'partial.1', 1), '1')
  assert.equal(cellValue(problem, 'partial.1', 2), '6')
  assert.equal(cellValue(problem, 'partial.2', 0), '0')
  assert.equal(cellValue(problem, 'partial.2', 1), '0')
  assert.equal(cellValue(problem, 'partial.2', 2), null)
  assert.deepEqual([0, 1, 2, 3, 4].map((place) => cellValue(problem, 'partial.3', place)), ['0', '0', '2', '9', '4'])
})

test('zero factors, identity, leading zeros, and internal zeros are represented canonically', () => {
  for (const operands of [['0', '738'], ['738', '0'], ['0', '0']]) {
    const problem = buildVerticalMultiplicationProblem(operands)
    assert.equal(problem.answer, '0', operands.join(' * '))
  }
  assert.equal(buildVerticalMultiplicationProblem(['1', '7654321']).answer, '7654321')
  assert.equal(buildVerticalMultiplicationProblem(['7654321', '1']).answer, '7654321')

  const normalized = buildVerticalMultiplicationProblem(['00012', '00304'])
  assert.deepEqual(normalized.operands, ['12', '304'])
  assert.equal(normalized.answer, '3648')
  assert.equal(normalized.wholeColumns, 5)
  assert.equal(normalized.partialRows.length, 3)
  assert.equal(cellValue(normalized, 'partial.2', 0), '0')
  assert.equal(cellValue(normalized, 'partial.2', 1), '0')
})

test('maximum factors produce fourteen digits and the high named result location', () => {
  const problem = buildVerticalMultiplicationProblem(['9,999,999', '9,999,999'])
  assert.equal(problem.answer, '99999980000001')
  assert.equal(problem.wholeColumns, 14)
  assert.equal(problem.cellsById['result.ten_trillions'].value, '9')
  assert(problem.locations.includes('result.ten_trillions'))
})

test('public width is the normalized factor digit-count sum, not answer length', () => {
  const cases = [
    { operands: ['10', '10'], width: 4, answerLength: 3 },
    { operands: ['12', '34'], width: 4, answerLength: 3 },
    { operands: ['0', '9999999'], width: 8, answerLength: 1 },
    { operands: ['00012', '00003'], width: 3, answerLength: 2 },
  ]
  for (const { operands, width, answerLength } of cases) {
    const problem = buildVerticalMultiplicationProblem(operands)
    assert.equal(problem.wholeColumns, width, operands.join(' * '))
    assert.equal(problem.answer.length, answerLength, operands.join(' * '))
  }
})

test('factor bounds, arity, sign, decimals, and malformed grouping are handled', () => {
  assert.throws(() => buildVerticalMultiplicationProblem(['1']), /exactly two/)
  assert.throws(() => buildVerticalMultiplicationProblem(['1', '2', '3']), /exactly two/)
  assert.throws(() => buildVerticalMultiplicationProblem('1,2'), /exactly two/)
  assert.throws(() => buildVerticalMultiplicationProblem(['10,000,000', '1']), /at most 7/)
  assert.throws(() => buildVerticalMultiplicationProblem(['-1', '2']), /nonnegative/)
  assert.equal(buildVerticalMultiplicationProblem(['1.0', '2']).answer, '2.0')
  assert.equal(buildVerticalMultiplicationProblem(['1.2', '3']).answer, '3.6')
  assert.throws(() => buildVerticalMultiplicationProblem(['1.0000000', '2']), /at most 6 decimal digits/)
  assert.throws(() => buildVerticalMultiplicationProblem(['1,2', '3']), /valid thousands separators/)
  assert.throws(() => buildVerticalMultiplicationProblem(['1.2,3', '4']), /valid thousands separators/)
})

test('initial view hides all solutions and edits only result cells', () => {
  const problem = buildVerticalMultiplicationProblem(['47', '26'])
  const view = createVerticalMultiplicationView(problem)
  const solutionIds = [
    ...problem.resultRow.cells,
    ...problem.workRows.flatMap((row) => row.cells),
  ].map((cell) => cell.id)
  assert(solutionIds.every((id) => view.hidden.includes(id)))
  assert(view.editable.every((id) => id.startsWith('result.')))
  assert(view.editable.includes('result.ones'))
  assert(!view.editable.includes('partial.1.ones'))
  assert(!view.editable.includes('multiply_carry.1.tens'))
})

test('partial and carry locations support hide, show, and highlight commands', () => {
  const problem = buildVerticalMultiplicationProblem(['47', '26'])
  let view = createVerticalMultiplicationView(problem)
  const shown = applyVerticalMultiplicationCommand(problem, view, {
    action: 'show',
    locations: ['partial.1.*', 'multiply_carry.1.*', 'sum_carry.*'],
  })
  assert.equal(shown.ok, true)
  assert(!shown.view.hidden.includes('partial.1.ones'))
  assert(!shown.view.hidden.includes('multiply_carry.1.tens'))
  assert(!shown.view.hidden.includes('sum_carry.hundreds'))

  const hidden = applyVerticalMultiplicationCommand(problem, shown.view, {
    action: 'hide',
    locations: ['partial.1.ones', 'multiply_carry.1.tens', 'sum_carry.hundreds'],
  })
  assert.equal(hidden.ok, true)
  view = hidden.view
  assert(view.editable.includes('partial.1.ones'))
  assert(view.editable.includes('multiply_carry.1.tens'))
  assert(view.editable.includes('sum_carry.hundreds'))

  const highlighted = applyVerticalMultiplicationCommand(problem, view, {
    action: 'highlight',
    locations: ['partial.2.tens', 'multiply_carry.2.hundreds', 'sum_carry.thousands'],
  })
  assert.equal(highlighted.ok, true)
  assert.deepEqual(highlighted.view.highlighted, [
    'partial.2.tens',
    'multiply_carry.2.hundreds',
    'sum_carry.thousands',
  ])
  assert.deepEqual(resolveMultiplicationLocations(problem, ['partial.2.*']), [
    'partial.2.tens', 'partial.2.ones', 'partial.2.hundreds',
  ].sort((a, b) => problem.locations.indexOf(a) - problem.locations.indexOf(b)))
})

test('a mixed valid and invalid location request is atomic', () => {
  const problem = buildVerticalMultiplicationProblem(['47', '26'])
  const view = createVerticalMultiplicationView(problem)
  const snapshot = structuredClone(view)
  const response = applyVerticalMultiplicationCommand(problem, view, {
    action: 'hide',
    locations: ['partial.1.ones', 'partial.9.ones'],
  })
  assert.equal(response.ok, false)
  assert.deepEqual(view, snapshot)
  assert.equal(response.view, undefined)
})

test('every presentation command is rejected during a test phase', () => {
  const problem = buildVerticalMultiplicationProblem(['47', '26'])
  const view = createVerticalMultiplicationView(problem)
  const commands = [
    { action: 'hide', locations: ['result.ones'] },
    { action: 'show', locations: ['partial.1.ones'] },
    { action: 'highlight', locations: ['operand.1.ones'] },
    { action: 'clear_highlight' },
  ]
  for (const command of commands) {
    const response = applyVerticalMultiplicationCommand(problem, view, command, { phase: 'test' })
    assert.equal(response.ok, false, command.action)
    assert.match(response.error, /locked/)
  }
})

test('full-answer and requested partial digits are judged independently', () => {
  const problem = buildVerticalMultiplicationProblem(['47', '26'])
  const initial = createVerticalMultiplicationView(problem)
  const correct = enterMultiplicationFullAnswer(problem, initial, '1222')
  assert.equal(correct.ok, true)
  assert.equal(evaluateVerticalMultiplication(problem, correct.view).correct, true)

  const wrong = enterMultiplicationFullAnswer(problem, initial, '1322')
  assert.equal(wrong.ok, true)
  assert.equal(evaluateVerticalMultiplication(problem, wrong.view).correct, false)
  assert(evaluateVerticalMultiplication(problem, wrong.view).incorrectLocations.includes('result.hundreds'))

  const requested = applyVerticalMultiplicationCommand(problem, correct.view, {
    action: 'hide',
    locations: ['partial.1.ones'],
  })
  const wrongPartial = enterMultiplicationDigit(problem, requested.view, 'partial.1.ones', '3')
  assert.equal(wrongPartial.ok, true)
  const evaluation = evaluateVerticalMultiplication(problem, wrongPartial.view)
  assert.equal(evaluation.complete, true)
  assert.equal(evaluation.correct, false)
  assert.deepEqual(evaluation.incorrectLocations, ['partial.1.ones'])
})

test('work labels do not disclose factor digit values when those digits are hidden', () => {
  const problem = buildVerticalMultiplicationProblem(['83', '74'])
  const hidden = applyVerticalMultiplicationCommand(problem, createVerticalMultiplicationView(problem), {
    action: 'hide',
    locations: ['operand.2.ones', 'operand.2.tens'],
  })
  assert.equal(hidden.ok, true)
  assert.equal(problem.multiplicationCarryRows[0].label, 'Multiplication carries for step 1 (ones place)')
  assert.equal(problem.partialRows[0].label, 'Partial product for step 1 (ones place)')
  assert.equal(problem.multiplicationCarryRows[1].label, 'Multiplication carries for step 2 (tens place)')
  assert.equal(problem.partialRows[1].label, 'Partial product for step 2 (tens place)')
  for (const row of [...problem.multiplicationCarryRows, ...problem.partialRows]) {
    assert(!row.label.includes('74'))
    assert(!row.label.includes('digit 4'))
    assert(!row.label.includes('digit 7'))
  }
})

test('650 deterministic products satisfy independent partial and carry recurrences', () => {
  let seed = 20261010
  function rand() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed
  }

  for (let trial = 0; trial < 650; trial++) {
    const a = rand() % 10000000
    const b = rand() % 10000000
    const problem = buildVerticalMultiplicationProblem([String(a), String(b)])
    const expectedProduct = BigInt(a) * BigInt(b)
    assert.equal(problem.answer, expectedProduct.toString(), 'BigInt oracle case ' + trial)

    const aDigits = String(a).split('').reverse().map(Number)
    const bDigits = String(b).split('').reverse().map(Number)
    const independentPartials = []
    for (let shift = 0; shift < bDigits.length; shift++) {
      const multiplierDigit = bDigits[shift]
      let incomingCarry = 0
      const unshiftedDigits = []
      const incomingCarries = new Map()
      for (let index = 0; index < aDigits.length; index++) {
        const total = aDigits[index] * multiplierDigit + incomingCarry
        unshiftedDigits[index] = total % 10
        incomingCarry = Math.floor(total / 10)
        if (incomingCarry) incomingCarries.set(shift + index + 1, String(incomingCarry))
      }
      if (incomingCarry) unshiftedDigits.push(incomingCarry)
      while (unshiftedDigits.length > 1 && unshiftedDigits.at(-1) === 0) unshiftedDigits.pop()
      if (unshiftedDigits.length === 0) unshiftedDigits.push(0)

      const partial = Array(problem.wholeColumns).fill(null)
      for (let place = 0; place < shift; place++) partial[place] = '0'
      for (let index = 0; index < unshiftedDigits.length; index++) {
        partial[shift + index] = String(unshiftedDigits[index])
      }
      independentPartials.push(partial)

      for (let place = 0; place < problem.wholeColumns; place++) {
        assert.equal(
          cellValue(problem, 'partial.' + (shift + 1), place),
          partial[place],
          'partial case ' + trial + ', step ' + (shift + 1) + ', place ' + place,
        )
        assert.equal(
          cellValue(problem, 'multiply_carry.' + (shift + 1), place),
          incomingCarries.get(place) ?? null,
          'multiply carry case ' + trial + ', step ' + (shift + 1) + ', place ' + place,
        )
      }
    }

    let sumCarry = 0
    const reconstructed = []
    for (let place = 0; place < problem.wholeColumns; place++) {
      const columnTotal = independentPartials.reduce(
        (sum, partial) => sum + Number(partial[place] ?? 0),
        sumCarry,
      )
      reconstructed[place] = String(columnTotal % 10)
      sumCarry = Math.floor(columnTotal / 10)
      const expectedIncoming = place === problem.wholeColumns - 1
        ? null
        : (sumCarry ? String(sumCarry) : null)
      if (place + 1 < problem.wholeColumns) {
        assert.equal(
          cellValue(problem, 'sum_carry', place + 1),
          expectedIncoming,
          'sum carry case ' + trial + ', place ' + (place + 1),
        )
      }
    }
    assert.equal(sumCarry, 0, 'allocated width consumes final carry in case ' + trial)
    const reconstructedAnswer = reconstructed.reverse().join('').replace(/^0+(?=\d)/, '')
    assert.equal(reconstructedAnswer, expectedProduct.toString(), 'column recurrence case ' + trial)

    const entered = enterMultiplicationFullAnswer(
      problem,
      createVerticalMultiplicationView(problem),
      expectedProduct.toString(),
    )
    assert.equal(entered.ok, true, 'default answer accepted in case ' + trial)
    assert.equal(evaluateVerticalMultiplication(problem, entered.view).correct, true, 'default view grades case ' + trial)
  }
})
