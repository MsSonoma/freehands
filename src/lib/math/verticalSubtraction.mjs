/**
 * Exact, deterministic stacked subtraction with conventional regrouping marks.
 * The first version supports two nonnegative operands and a nonnegative result.
 * Decimal places are padded for the vertical working layout, not rounded.
 */
import {
  MATH_MAX_WHOLE_DIGITS,
  MATH_MAX_FRACTION_DIGITS,
  mathPlaceName,
  parseMathDecimal,
  mathDigitAt,
  mathColumns,
  makeMathRow,
  createVerticalMathView,
  resolveVerticalMathLocations,
  applyVerticalMathCommand,
  enterVerticalMathCell,
  enterVerticalMathFullAnswer,
  evaluateVerticalMath,
} from './verticalMath.mjs'

export const SUBTRACTION_MAX_OPERANDS = 2
export const SUBTRACTION_MAX_WHOLE_DIGITS = MATH_MAX_WHOLE_DIGITS
export const SUBTRACTION_MAX_FRACTION_DIGITS = MATH_MAX_FRACTION_DIGITS

export const createVerticalSubtractionView = createVerticalMathView
export const resolveSubtractionLocations = resolveVerticalMathLocations
export const applyVerticalSubtractionCommand = applyVerticalMathCommand
export const enterSubtractionDigit = enterVerticalMathCell
export const enterSubtractionFullAnswer = enterVerticalMathFullAnswer
export const evaluateVerticalSubtraction = evaluateVerticalMath

function scaledInteger(number, fractionDigits) {
  return BigInt(number.whole) * 10n ** BigInt(fractionDigits) +
    BigInt(number.fraction.padEnd(fractionDigits, '0') || '0')
}

export function buildVerticalSubtractionProblem(rawOperands) {
  if (!Array.isArray(rawOperands) || rawOperands.length !== 2) {
    throw new Error('Vertical subtraction currently requires exactly two numbers.')
  }
  const parsed = rawOperands.map((value, index) => {
    try { return parseMathDecimal(value) }
    catch (error) { throw new Error('Number ' + (index + 1) + ': ' + error.message) }
  })
  const fractionDigits = Math.max(...parsed.map((number) => number.fraction.length))
  const minuendScaled = scaledInteger(parsed[0], fractionDigits)
  const subtrahendScaled = scaledInteger(parsed[1], fractionDigits)
  if (minuendScaled < subtrahendScaled) {
    throw new Error('This subtraction version requires the first number to be at least as large as the second.')
  }
  const scale = 10n ** BigInt(fractionDigits)
  const difference = minuendScaled - subtrahendScaled
  const whole = String(difference / scale)
  const fraction = fractionDigits ? String(difference % scale).padStart(fractionDigits, '0') : ''
  const answer = whole + (fraction ? '.' + fraction : '')

  // Pad missing fractional places in the displayed operands so that a learner
  // can see the zero through which regrouping occurs (e.g. 1.2 -> 1.20).
  const numbers = parsed.map((number) => ({
    ...number,
    fraction: number.fraction.padEnd(fractionDigits, '0'),
  }))
  const result = { whole, fraction, text: answer }
  const wholeColumns = Math.max(...parsed.map((number) => number.whole.length)) + 1
  const columns = mathColumns(wholeColumns, fractionDigits)

  const top = {}
  const bottom = {}
  for (const place of columns) {
    top[place] = Number(mathDigitAt(numbers[0], place) || 0)
    bottom[place] = Number(mathDigitAt(numbers[1], place) || 0)
  }
  const touchedPlaces = new Set()
  const borrowSteps = []
  for (let place = -fractionDigits; place < wholeColumns; place++) {
    if (top[place] < bottom[place]) {
      let donor = place + 1
      while (donor < wholeColumns && top[donor] === 0) donor++
      if (donor >= wholeColumns) throw new Error('No valid regrouping source exists for this problem.')
      top[donor] -= 1
      touchedPlaces.add(donor)
      for (let middle = donor - 1; middle > place; middle--) {
        // Every intermediate digit is zero before the borrow is propagated.
        top[middle] = 9
        touchedPlaces.add(middle)
      }
      top[place] += 10
      touchedPlaces.add(place)
      borrowSteps.push({
        from: 'operand.1.' + mathPlaceName(donor),
        to: 'operand.1.' + mathPlaceName(place),
        through: Array.from({ length: donor - place - 1 }, (_, i) =>
          'operand.1.' + mathPlaceName(donor - i - 1)),
      })
    }
  }
  const regroupValues = {}
  for (const place of touchedPlaces) regroupValues[place] = String(top[place])

  const cellsById = {}
  const rows = numbers.map((number, index) => makeMathRow(cellsById, columns, {
    id: 'operand.' + (index + 1),
    kind: 'operand',
    number,
    rowIndex: index + 1,
  }))
  const regroupRow = makeMathRow(cellsById, columns, {
    id: 'regroup',
    kind: 'work',
    values: regroupValues,
  })
  const resultRow = makeMathRow(cellsById, columns, {
    id: 'result',
    kind: 'result',
    number: result,
  })
  const locations = Object.values(cellsById)
    .filter((cell) => cell.value !== null || cell.kind === 'result')
    .map((cell) => cell.id)
  const groups = ['result.*', ...(touchedPlaces.size ? ['regroup.*'] : []), ...rows.map((row) => row.id + '.*')]
  return {
    version: 2,
    operation: 'subtraction',
    operator: '-',
    operands: parsed.map((number) => number.text),
    answer,
    fractionDigits,
    wholeColumns,
    columns,
    rows,
    workRows: [regroupRow],
    regroupRow,
    borrowSteps,
    resultRow,
    cellsById,
    locations,
    groups,
  }
}
