import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyVerticalDivisionCommand,
  buildVerticalDivisionProblem,
  createVerticalDivisionView,
  enterDivisionAnswer,
  enterDivisionDigit,
  evaluateVerticalDivision,
  resolveDivisionLocations,
} from './verticalDivision.mjs'
import {
  enterVerticalMathRowAnswer,
  getVerticalMathLocationDescriptor,
  validateVerticalMathExercise,
  verticalMathAddressCatalog,
} from './verticalMath.mjs'
import {
  buildVerticalMultiplicationProblem,
  createVerticalMultiplicationView,
  enterMultiplicationFullAnswer,
} from './verticalMultiplication.mjs'
import {
  buildVerticalAdditionProblem,
  createVerticalAdditionView,
  enterAdditionFullAnswer,
} from './verticalAddition.mjs'
import {
  buildVerticalSubtractionProblem,
  createVerticalSubtractionView,
  enterSubtractionFullAnswer,
} from './verticalSubtraction.mjs'

const bySlot = (row, slot) => row.cells.find((cell) => cell.slot === slot)
const rowDigits = (row) => row.cells
  .filter((cell) => cell.value !== null)
  .map((cell) => cell.value)
  .join('')

function expectedDivision(dividendLiteral, divisorLiteral) {
  const dividend = BigInt(dividendLiteral)
  const divisor = BigInt(divisorLiteral)
  return { quotient: String(dividend / divisor), remainder: String(dividend % divisor) }
}

test('known whole-number divisions include zero, bounds, and zero quotient digits', () => {
  const cases = [
    ['84', '7', '12', '0'],
    ['1005', '5', '201', '0'],
    ['1005', '10', '100', '5'],
    ['7', '12', '0', '7'],
    ['0', '9', '0', '0'],
    ['9999999', '1', '9999999', '0'],
    ['9999999', '9999999', '1', '0'],
    ['9999999', '97', '103092', '75'],
  ]
  for (const [dividend, divisor, quotient, remainder] of cases) {
    const problem = buildVerticalDivisionProblem([dividend, divisor])
    assert.deepEqual(
      [problem.quotient, problem.answer, problem.remainder],
      [quotient, quotient, remainder],
      dividend + ' / ' + divisor,
    )
    assert.equal(problem.answerRows[0], problem.resultRow)
    assert.equal(problem.answerRows[1], problem.remainderRow)
    assert.equal(problem.steps.length, dividend.length)
  }

  const interiorZero = buildVerticalDivisionProblem(['1005', '5'])
  assert.equal(interiorZero.steps.map((step) => step.quotientDigit).join(''), '0201')
  assert.equal(interiorZero.steps[1].inputDigit, '0')
  assert.equal(interiorZero.steps[1].bringDownLocation, 'step.2.bring_down.ones')
  const trailingZero = buildVerticalDivisionProblem(['1005', '10'])
  assert.equal(trailingZero.steps.map((step) => step.quotientDigit).join(''), '0100')
  assert.equal(trailingZero.steps[2].inputDigit, '0')
})

test('leading dividend zeros are processed and answer widths depend only on input', () => {
  const problem = buildVerticalDivisionProblem(['00084', '0007'])
  assert.equal(problem.quotient, '12')
  assert.equal(problem.remainder, '0')
  assert.equal(problem.steps.length, 5)
  assert.deepEqual(problem.steps.map((step) => step.inputDigit), ['0', '0', '0', '8', '4'])
  assert.deepEqual(problem.steps.map((step) => step.consumedDividendIndex), [0, 1, 2, 3, 4])
  assert.equal(problem.wholeColumns, 5)
  assert.equal(problem.resultRow.cells.length, 5)
  assert.equal(problem.remainderRow.cells.length, 5)

  const sameInputsDifferentAnswers = [
    buildVerticalDivisionProblem(['9999999', '0000001']),
    buildVerticalDivisionProblem(['9999999', '9999999']),
  ]
  for (const item of sameInputsDifferentAnswers) {
    assert.equal(item.wholeColumns, 7)
    assert.equal(item.resultRow.cells.length, 7)
    assert.equal(item.remainderRow.cells.length, 7)
  }
})

test('quotient and remainder are required and graded separately without correction', () => {
  const problem = buildVerticalDivisionProblem(['84', '7'])
  const initial = createVerticalDivisionView(problem)
  const initialGrade = evaluateVerticalDivision(problem, initial)
  assert.equal(initialGrade.complete, false)
  assert(initialGrade.missingLocations.includes('result.ones'))
  assert(initialGrade.missingLocations.includes('remainder.ones'))
  assert.equal(Object.hasOwn(initial.entries, 'remainder.ones'), false)

  const quotientOnly = enterVerticalMathRowAnswer(problem, initial, 'result', '12')
  assert.equal(quotientOnly.ok, true)
  assert.equal(evaluateVerticalDivision(problem, quotientOnly.view).missingLocations.includes('remainder.ones'), true)
  const remainderOnly = enterVerticalMathRowAnswer(problem, initial, 'remainder', '0')
  assert.equal(remainderOnly.ok, true)
  assert.equal(evaluateVerticalDivision(problem, remainderOnly.view).missingLocations.includes('result.ones'), true)

  const correct = enterDivisionAnswer(problem, initial, { quotient: '12', remainder: '0' })
  assert.equal(correct.ok, true)
  assert.equal(evaluateVerticalDivision(problem, correct.view).correct, true)

  const wrong = enterDivisionAnswer(problem, initial, { quotient: '99', remainder: '6' })
  assert.equal(wrong.ok, true)
  assert.equal(wrong.view.entries['result.tens'], '9')
  assert.equal(wrong.view.entries['result.ones'], '9')
  assert.equal(wrong.view.entries['remainder.ones'], '6')
  assert.equal(evaluateVerticalDivision(problem, wrong.view).correct, false)

  const largerRemainderProblem = buildVerticalDivisionProblem(['7', '12'])
  const largerRemainder = enterDivisionAnswer(
    largerRemainderProblem,
    createVerticalDivisionView(largerRemainderProblem),
    { quotient: '0', remainder: '13' },
  )
  assert.equal(largerRemainder.ok, true)
  assert.equal(largerRemainder.view.entries['remainder.tens'], '1')
  assert.equal(largerRemainder.view.entries['remainder.ones'], '3')
  assert.equal(evaluateVerticalDivision(largerRemainderProblem, largerRemainder.view).correct, false)
})

test('work rows have local places, shifted physical slots, stable names, and no addressable padding', () => {
  const problem = buildVerticalDivisionProblem(['1005', '5'])
  const ids = Object.keys(problem.cellsById)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(new Set(problem.locations).size, problem.locations.length)

  for (const step of problem.steps) {
    const expectedRows = step.index === 1
      ? ['partial', 'product', 'remainder']
      : ['bringDown', 'partial', 'product', 'remainder']
    assert.deepEqual(Object.keys(step.rows), expectedRows)
    for (const rowId of Object.values(step.rows)) {
      const row = problem.workRows.find((candidate) => candidate.id === rowId)
      assert(row, rowId)
      assert.deepEqual(resolveDivisionLocations(problem, [rowId + '.*']), row.cells
        .filter((cell) => cell.value !== null)
        .map((cell) => cell.id))
      for (const cell of row.cells) {
        if (cell.place === null) {
          assert.equal(problem.cellsById[cell.id], undefined)
          assert.equal(problem.locations.includes(cell.id), false)
          assert.equal(getVerticalMathLocationDescriptor(problem, cell.id), null)
        } else {
          assert.equal(cell.slot, step.endSlot + cell.place)
          assert.equal(cell.id, row.id + '.' + ['ones', 'tens', 'hundreds'][cell.place])
        }
      }
      const ones = row.cells.find((cell) => cell.place === 0)
      assert.equal(ones.slot, step.endSlot)
    }
    assert.equal(step.consumedDividendColumn, problem.columns[step.consumedDividendIndex])
    if (step.index > 1) {
      assert.equal(problem.cellsById[step.bringDownLocation].value, step.inputDigit)
      assert.equal(problem.cellsById[step.bringDownLocation].slot, step.endSlot)
    } else assert.equal(step.bringDownLocation, null)
  }
  for (const group of problem.groups) assert.doesNotThrow(() => resolveDivisionLocations(problem, [group]))
  assert.equal(problem.groups.length, 2 + problem.rows.length + problem.workRows.length)
})

test('step arithmetic follows incoming-remainder recurrence and exact row values', () => {
  const problem = buildVerticalDivisionProblem(['1005', '5'])
  let incoming = 0n
  for (const step of problem.steps) {
    const partial = incoming * 10n + BigInt(step.inputDigit)
    const digit = partial / 5n
    const product = digit * 5n
    const remainder = partial - product
    assert.deepEqual(
      [step.partial, step.quotientDigit, step.product, step.remainder],
      [String(partial), String(digit), String(product), String(remainder)],
    )
    assert.equal(rowDigits(problem.workRows.find((row) => row.id === step.rows.partial)), String(partial))
    assert.equal(rowDigits(problem.workRows.find((row) => row.id === step.rows.product)), String(product))
    assert.equal(rowDigits(problem.workRows.find((row) => row.id === step.rows.remainder)), String(remainder))
    incoming = remainder
  }
})

test('malformed operands and atomic entry or command requests are rejected', () => {
  for (const operands of [null, [], ['1'], ['1', '2', '3']]) {
    assert.throws(() => buildVerticalDivisionProblem(operands), /exactly two/)
  }
  for (const [operands, message] of [
    [['-1', '2'], /nonnegative/],
    [['1', '-2'], /nonnegative/],
    [['1.0', '2'], /decimal/],
    [['1', '2.0'], /decimal/],
    [['1', '0'], /greater than zero/],
    [['1,00', '2'], /valid thousands separators/],
    [['1', '1,,0'], /valid thousands separators/],
    [['10000000', '1'], /at most 7/],
    [['1', '10000000'], /at most 7/],
  ]) assert.throws(() => buildVerticalDivisionProblem(operands), message)

  const problem = buildVerticalDivisionProblem(['84', '7'])
  const view = createVerticalDivisionView(problem)
  const snapshot = structuredClone(view)
  for (const answer of [null, {}, { quotient: '12' }, { remainder: '0' }]) {
    const response = enterDivisionAnswer(problem, view, answer)
    assert.equal(response.ok, false)
    assert.deepEqual(view, snapshot)
  }
  const malformedSecond = enterDivisionAnswer(problem, view, { quotient: '12', remainder: '1.2' })
  assert.equal(malformedSecond.ok, false)
  assert.deepEqual(malformedSecond.view, snapshot)
  assert.deepEqual(view, snapshot)

  const mixed = applyVerticalDivisionCommand(problem, view, {
    action: 'hide', locations: ['result.ones', 'not.a.location'],
  })
  assert.equal(mixed.ok, false)
  assert.deepEqual(view, snapshot)
})

test('visibility commands preserve history, editability, isolation, and test locks', () => {
  const problem = buildVerticalDivisionProblem(['84', '7'])
  const initial = createVerticalDivisionView(problem)
  assert(problem.workRows.flatMap((row) => row.cells)
    .filter((cell) => problem.cellsById[cell.id])
    .every((cell) => initial.hidden.includes(cell.id) && !initial.editable.includes(cell.id)))
  assert(problem.answerRows.flatMap((row) => row.cells)
    .every((cell) => initial.hidden.includes(cell.id) && initial.editable.includes(cell.id)))

  const isolatedId = problem.steps[1].bringDownLocation
  const requested = applyVerticalDivisionCommand(problem, initial, {
    action: 'hide', locations: [isolatedId],
  })
  assert.equal(requested.ok, true)
  const entered = enterDivisionDigit(problem, requested.view, isolatedId, '4')
  assert.equal(entered.ok, true)
  assert.equal(evaluateVerticalDivision(problem, entered.view).incorrectLocations.includes(isolatedId), false)
  const wrong = enterDivisionDigit(problem, requested.view, isolatedId, '3')
  assert.equal(evaluateVerticalDivision(problem, wrong.view).incorrectLocations.includes(isolatedId), true)

  const concealed = applyVerticalDivisionCommand(problem, entered.view, {
    action: 'hide', locations: [isolatedId], editable: false,
  })
  assert.equal(concealed.ok, true)
  assert.equal(concealed.view.entries[isolatedId], '4')
  assert.equal(concealed.view.editable.includes(isolatedId), false)
  const shown = applyVerticalDivisionCommand(problem, concealed.view, {
    action: 'show', locations: [isolatedId],
  })
  assert.equal(shown.ok, true)
  assert.equal(Object.hasOwn(shown.view.entries, isolatedId), false)

  let revealed = applyVerticalDivisionCommand(problem, initial, {
    action: 'show', locations: ['result.*'],
  }).view
  revealed = applyVerticalDivisionCommand(problem, revealed, {
    action: 'show', locations: ['remainder.*'],
  }).view
  assert.equal(validateVerticalMathExercise(problem, revealed).status, 'no_response')
  assert.equal(evaluateVerticalDivision(problem, revealed).status, 'no_response')

  for (const command of [
    { action: 'hide', locations: ['result.ones'] },
    { action: 'show', locations: ['result.ones'] },
    { action: 'highlight', locations: ['result.ones'] },
    { action: 'clear_highlight' },
  ]) {
    assert.equal(applyVerticalDivisionCommand(problem, initial, command, { phase: 'test' }).ok, false)
  }
})

test('division exposes no symbol targets and concealed operands are conservatively ungradable', () => {
  const problem = buildVerticalDivisionProblem(['84', '7'])
  const catalog = verticalMathAddressCatalog(problem)
  assert.equal(catalog.locations.includes('operator'), false)
  assert.equal(catalog.locations.some((id) => id.endsWith('.decimal')), false)
  for (const location of ['operator', 'operand.1.decimal', 'result.decimal', 'remainder.decimal']) {
    assert.throws(() => resolveDivisionLocations(problem, [location]), /Unknown|unavailable/)
  }

  const initial = createVerticalDivisionView(problem)
  const concealed = applyVerticalDivisionCommand(problem, initial, {
    action: 'hide', locations: ['operand.1.ones'], editable: false,
  })
  assert.equal(concealed.ok, true)
  const grade = evaluateVerticalDivision(problem, concealed.view)
  assert.equal(grade.gradable, false)
  assert.equal(grade.status, 'unverified')
  assert.deepEqual(grade.incorrectLocations, [])

  const snapshot = structuredClone(initial)
  const blocked = applyVerticalDivisionCommand(problem, initial, {
    action: 'hide', locations: ['operand.1.ones'], editable: false,
  }, { requireUnique: true })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.status, 'unverified')
  assert.deepEqual(initial, snapshot)
})

test('shared row-answer capacity rejects oversized decimals without truncation', () => {
  const multiplication = buildVerticalMultiplicationProblem(['12.3', '4.56'])
  const multiplicationView = createVerticalMultiplicationView(multiplication)
  assert.equal(enterMultiplicationFullAnswer(multiplication, multiplicationView, '56.088').ok, true)
  const oversizedProduct = enterMultiplicationFullAnswer(multiplication, multiplicationView, '1056.088')
  assert.equal(oversizedProduct.ok, false)
  assert.deepEqual(multiplicationView.entries, {})

  const addition = buildVerticalAdditionProblem(['12.3', '4.56'])
  const additionView = createVerticalAdditionView(addition)
  assert.equal(enterAdditionFullAnswer(addition, additionView, '16.86').ok, true)
  assert.equal(enterAdditionFullAnswer(addition, additionView, '1016.86').ok, false)

  const subtraction = buildVerticalSubtractionProblem(['12.3', '4.56'])
  const subtractionView = createVerticalSubtractionView(subtraction)
  assert.equal(enterSubtractionFullAnswer(subtraction, subtractionView, '7.74').ok, true)
  assert.equal(enterSubtractionFullAnswer(subtraction, subtractionView, '1007.74').ok, false)
})

test('824 deterministic divisions match independent arithmetic, recurrence, cells, and alignment', () => {
  let seed = 0x8a85eb36
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0)
  const directed = [
    ['0', '1'], ['0000000', '0000001'], ['9999999', '1'],
    ['9999999', '9999999'], ['9999999', '97'], ['1005', '5'],
    ['1005', '10'], ['7', '12'],
  ]
  const cases = [...directed]
  while (cases.length < 824) {
    const dividendWidth = 1 + (rand() % 7)
    const divisorWidth = 1 + (rand() % 7)
    const dividend = String(rand() % 10000000).padStart(dividendWidth, '0').slice(-dividendWidth)
    let divisor = String(rand() % 10000000).padStart(divisorWidth, '0').slice(-divisorWidth)
    if (BigInt(divisor) === 0n) divisor = '0'.repeat(divisorWidth - 1) + '1'
    cases.push([dividend, divisor])
  }

  for (let trial = 0; trial < cases.length; trial++) {
    const [dividendLiteral, divisorLiteral] = cases[trial]
    const divisor = BigInt(divisorLiteral)
    const expected = expectedDivision(dividendLiteral, divisorLiteral)
    const problem = buildVerticalDivisionProblem([dividendLiteral, divisorLiteral])
    assert.deepEqual([problem.quotient, problem.remainder], [expected.quotient, expected.remainder], 'answer ' + trial)
    assert.equal(BigInt(dividendLiteral), divisor * BigInt(problem.quotient) + BigInt(problem.remainder), 'identity ' + trial)
    assert(BigInt(problem.remainder) >= 0n && BigInt(problem.remainder) < divisor, 'remainder bound ' + trial)
    assert.equal(problem.steps.length, dividendLiteral.length, 'step count ' + trial)

    let incoming = 0n
    for (let index = 0; index < dividendLiteral.length; index++) {
      const step = problem.steps[index]
      const digit = dividendLiteral[index]
      const partial = incoming * 10n + BigInt(digit)
      const quotientDigit = partial / divisor
      const product = divisor * quotientDigit
      const remainder = partial - product
      assert.deepEqual(
        [step.inputDigit, step.partial, step.quotientDigit, step.product, step.remainder],
        [digit, String(partial), String(quotientDigit), String(product), String(remainder)],
        'recurrence ' + trial + ':' + index,
      )
      assert.equal(step.consumedDividendIndex, index, 'consumed index ' + trial + ':' + index)
      const physicalIndex = problem.layout.dividendOffset + index
      assert.equal(step.consumedDividendColumn, problem.columns[physicalIndex], 'column ' + trial + ':' + index)
      assert.equal(step.endSlot, problem.columns.length - physicalIndex - 1, 'end slot ' + trial + ':' + index)

      const expectedRows = [
        [step.rows.partial, String(partial)],
        [step.rows.product, String(product)],
        [step.rows.remainder, String(remainder)],
      ]
      if (index > 0) expectedRows.push([step.rows.bringDown, digit])
      for (const [rowId, text] of expectedRows) {
        const row = problem.workRows.find((candidate) => candidate.id === rowId)
        assert(row, 'row ' + trial + ':' + index + ':' + rowId)
        const reversed = [...text].reverse()
        for (let place = 0; place < reversed.length; place++) {
          const cell = row.cells.find((candidate) => candidate.place === place)
          assert.equal(cell.value, reversed[place], 'cell value ' + trial + ':' + index + ':' + rowId + ':' + place)
          assert.equal(cell.slot, step.endSlot + place, 'alignment ' + trial + ':' + index + ':' + rowId + ':' + place)
          assert.equal(bySlot(row, step.endSlot + place), cell)
        }
      }
      if (index > 0) assert.equal(problem.cellsById[step.bringDownLocation].value, digit)
      incoming = remainder
    }

    const entered = enterDivisionAnswer(problem, createVerticalDivisionView(problem), expected)
    assert.equal(entered.ok, true, 'entry ' + trial)
    assert.equal(evaluateVerticalDivision(problem, entered.view).correct, true, 'grade ' + trial)
  }
})
