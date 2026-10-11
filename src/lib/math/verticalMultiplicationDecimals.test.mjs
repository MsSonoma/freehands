import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyVerticalMultiplicationCommand,
  buildVerticalMultiplicationProblem,
  createVerticalMultiplicationView,
  enterMultiplicationDigit,
  enterMultiplicationFullAnswer,
  evaluateVerticalMultiplication,
} from './verticalMultiplication.mjs'

const bySlot = (row, slot) => row.cells.find((cell) => cell.slot === slot)
const displayedDigits = (row) => row.cells.map((cell) => cell.value).filter((value) => value !== null).join('')

function exactDecimal(product, scale) {
  const digits = product.toString().padStart(scale + 1, '0')
  return scale ? digits.slice(0, -scale) + '.' + digits.slice(-scale) : digits
}

test('known decimal products preserve exact scale, zeros, and limits', () => {
  const cases = [
    ['12.3', '4.56', '56.088'],
    ['0.1', '0.2', '0.02'],
    ['2.50', '4.0', '10.000'],
    ['0.000001', '0.000001', '0.000000000001'],
    ['9,999,999.999999', '9,999,999.999999', '99999999999980.000000000001'],
    ['0.00', '123.456', '0.00000'],
    ['10.02', '3.04', '30.4608'],
    ['1.20', '3.00', '3.6000'],
  ]
  for (const [a, b, expected] of cases) {
    assert.equal(buildVerticalMultiplicationProblem([a, b]).answer, expected, a + ' * ' + b)
  }
  assert.throws(() => buildVerticalMultiplicationProblem(['10000000', '1']), /at most 7/)
  assert.throws(() => buildVerticalMultiplicationProblem(['1.0000000', '1']), /at most 6/)
  assert.throws(() => buildVerticalMultiplicationProblem(['-1.2', '3']), /nonnegative/)
  assert.throws(() => buildVerticalMultiplicationProblem(['1,2.3', '4']), /valid thousands separators/)
})

test('decimal metadata maps public places to integer-working slots', () => {
  const problem = buildVerticalMultiplicationProblem(['12.3', '4.56'])
  assert.deepEqual(
    [problem.slotCount, problem.wholeColumns, problem.fractionDigits],
    [6, 3, 3],
  )
  for (const row of [...problem.rows, ...problem.workRows, problem.resultRow]) assert.equal(row.cells.length, 6)
  assert.deepEqual(
    ['operand.1.tenths', 'operand.2.hundredths', 'result.thousandths'].map((id) => [problem.cellsById[id].value, problem.cellsById[id].slot]),
    [['3', 0], ['6', 0], ['8', 0]],
  )
  assert.deepEqual(problem.rows.map((row) => row.decimalPlaces), [1, 2])
  assert.equal(problem.resultRow.decimalPlaces, 3)
  assert(problem.workRows.every((row) => row.decimalPlaces === 0))
  assert.deepEqual(problem.partialRows.map(displayedDigits), ['738', '6150', '49200'])

  const hidden = applyVerticalMultiplicationCommand(problem, createVerticalMultiplicationView(problem), {
    action: 'hide', locations: ['operand.2.tenths', 'operand.2.hundredths'],
  })
  assert.equal(hidden.ok, true)
  for (const row of problem.workRows) assert.doesNotMatch(row.label, /digit [0-9]/)
})

test('maximum decimal width supports two-digit addition carries', () => {
  const problem = buildVerticalMultiplicationProblem(['9,999,999.999999', '9,999,999.999999'])
  assert.deepEqual(
    [problem.answer, problem.slotCount, problem.wholeColumns, problem.fractionDigits],
    ['99999999999980.000000000001', 26, 14, 12],
  )
  assert(problem.sumCarryRow.cells.every((cell) => cell.inputCapacity === 2))
  assert(problem.sumCarryRow.cells.some((cell) => Number(cell.value) >= 10))
})

test('decimal answer entry, fractional edits, and test locks behave correctly', () => {
  const scaled = buildVerticalMultiplicationProblem(['2.50', '4.0'])
  const full = enterMultiplicationFullAnswer(scaled, createVerticalMultiplicationView(scaled), '10')
  assert.equal(full.ok, true)
  assert.equal(evaluateVerticalMultiplication(scaled, full.view).correct, true)

  const problem = buildVerticalMultiplicationProblem(['12.3', '4.56'])
  const wrong = enterMultiplicationFullAnswer(problem, createVerticalMultiplicationView(problem), '56.08')
  assert.equal(wrong.ok, true)
  assert.equal(evaluateVerticalMultiplication(problem, wrong.view).correct, false)
  const hidden = applyVerticalMultiplicationCommand(problem, wrong.view, {
    action: 'hide', locations: ['operand.1.tenths'],
  })
  const edited = enterMultiplicationDigit(problem, hidden.view, 'operand.1.tenths', '3')
  assert.equal(edited.ok, true)
  assert.equal(edited.view.entries['operand.1.tenths'], '3')
  const locked = applyVerticalMultiplicationCommand(problem, edited.view, {
    action: 'show', locations: ['operand.1.tenths'],
  }, { phase: 'test' })
  assert.equal(locked.ok, false)
  assert.match(locked.error, /locked/)
})

test('700 deterministic decimal products satisfy independent digit and carry recurrences', () => {
  let seed = 0x5eed1234
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0)
  for (let trial = 0; trial < 700; trial++) {
    const precisions = [rand() % 7, rand() % 7]
    const literals = precisions.map((precision) => {
      const whole = String(rand() % 10000000)
      const fraction = precision ? String(rand() % (10 ** precision)).padStart(precision, '0') : ''
      return whole + (precision ? '.' + fraction : '')
    })
    const coefficients = literals.map((literal) => literal.replace('.', ''))
    const scale = precisions[0] + precisions[1]
    const expected = exactDecimal(BigInt(coefficients[0]) * BigInt(coefficients[1]), scale)
    const problem = buildVerticalMultiplicationProblem(literals)
    const width = coefficients[0].length + coefficients[1].length
    assert.equal(problem.answer, expected, 'answer case ' + trial)
    assert.deepEqual([problem.slotCount, problem.wholeColumns, problem.fractionDigits], [width, width - scale, scale])

    for (let factor = 0; factor < 2; factor++) {
      const reversed = [...coefficients[factor]].reverse()
      for (let slot = 0; slot < width; slot++) {
        const cell = bySlot(problem.rows[factor], slot)
        assert.deepEqual(
          [cell.value, cell.place],
          [reversed[slot] ?? null, slot - precisions[factor]],
          'factor mapping case ' + trial + ', factor ' + factor + ', slot ' + slot,
        )
      }
    }

    const aDigits = [...coefficients[0]].reverse().map(Number)
    const bDigits = [...coefficients[1]].reverse().map(Number)
    const partials = []
    for (let shift = 0; shift < bDigits.length; shift++) {
      let carry = 0
      const digits = []
      for (const digit of aDigits) {
        const total = digit * bDigits[shift] + carry
        digits.push(total % 10)
        carry = Math.floor(total / 10)
      }
      if (carry) digits.push(carry)
      while (digits.length > 1 && digits.at(-1) === 0) digits.pop()
      const partial = Array(width).fill(null)
      for (let slot = 0; slot < shift; slot++) partial[slot] = '0'
      digits.forEach((digit, index) => { partial[shift + index] = String(digit) })
      partials.push(partial)
      for (let slot = 0; slot < width; slot++) {
        assert.equal(bySlot(problem.partialRows[shift], slot).value, partial[slot], 'partial case ' + trial + ', step ' + shift + ', slot ' + slot)
      }
    }

    const expectedCarries = Array(width).fill(null)
    let carry = 0
    for (let slot = 0; slot < width; slot++) {
      const total = carry + partials.reduce((sum, partial) => sum + Number(partial[slot] ?? 0), 0)
      carry = Math.floor(total / 10)
      if (slot + 1 < width && carry) expectedCarries[slot + 1] = String(carry)
    }
    assert.equal(carry, 0, 'final carry case ' + trial)
    for (let slot = 0; slot < width; slot++) {
      assert.equal(bySlot(problem.sumCarryRow, slot).value, expectedCarries[slot], 'sum carry case ' + trial + ', slot ' + slot)
    }
    const entered = enterMultiplicationFullAnswer(problem, createVerticalMultiplicationView(problem), expected)
    assert.equal(entered.ok, true, 'entry case ' + trial)
    assert.equal(evaluateVerticalMultiplication(problem, entered.view).correct, true, 'grade case ' + trial)
  }
})
