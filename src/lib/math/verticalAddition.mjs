/**
 * Pure addition engine. The renderer, address catalog, visibility commands and
 * input handling live in the shared verticalMath module.
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

export const ADDITION_MAX_OPERANDS = 10
export const ADDITION_MAX_WHOLE_DIGITS = MATH_MAX_WHOLE_DIGITS
export const ADDITION_MAX_FRACTION_DIGITS = MATH_MAX_FRACTION_DIGITS

// Preserve addition's prior external API while moving mechanics into the shared model.
export const additionPlaceName = mathPlaceName
export const createVerticalAdditionView = createVerticalMathView
export const resolveAdditionLocations = resolveVerticalMathLocations
export const applyVerticalAdditionCommand = applyVerticalMathCommand
export const enterAdditionDigit = enterVerticalMathCell
export const enterAdditionFullAnswer = enterVerticalMathFullAnswer
export const evaluateVerticalAddition = evaluateVerticalMath

export function buildVerticalAdditionProblem(rawOperands) {
  if (!Array.isArray(rawOperands) || rawOperands.length < 2 || rawOperands.length > ADDITION_MAX_OPERANDS) {
    throw new Error('Vertical addition requires 2 to 10 numbers.')
  }
  const numbers = rawOperands.map((value, index) => {
    try { return parseMathDecimal(value) }
    catch (error) { throw new Error('Number ' + (index + 1) + ': ' + error.message) }
  })
  const fractionDigits = Math.max(...numbers.map((number) => number.fraction.length))
  const factor = 10n ** BigInt(fractionDigits)
  const sumScaled = numbers.reduce((sum, number) => {
    return sum + BigInt(number.whole) * factor + BigInt(number.fraction.padEnd(fractionDigits, '0') || '0')
  }, 0n)
  const sumWhole = (sumScaled / factor).toString()
  const sumFraction = fractionDigits > 0
    ? (sumScaled % factor).toString().padStart(fractionDigits, '0')
    : ''
  const result = { whole: sumWhole, fraction: sumFraction, text: sumWhole + (sumFraction ? '.' + sumFraction : '') }

  // Preserve one reserved whole-number column so a blank answer does not
  // reveal whether the sum gained an extra digit.
  const largestOperandWidth = Math.max(...numbers.map((number) => number.whole.length))
  const wholeColumns = Math.max(largestOperandWidth + 1, sumWhole.length)
  const columns = mathColumns(wholeColumns, fractionDigits)

  let incomingCarry = 0
  const carries = {}
  for (let place = -fractionDigits; place < wholeColumns; place++) {
    if (incomingCarry) carries[place] = String(incomingCarry)
    const columnSum = numbers.reduce((sum, number) => sum + Number(mathDigitAt(number, place) || 0), incomingCarry)
    incomingCarry = Math.floor(columnSum / 10)
  }
  if (incomingCarry !== 0) throw new Error('Addition result exceeded allocated columns.')

  const cellsById = {}
  const rows = numbers.map((number, index) => makeMathRow(cellsById, columns, {
    id: 'operand.' + (index + 1),
    kind: 'operand',
    number,
    rowIndex: index + 1,
  }))
  // Work rows have the same address and visibility system as number rows.
  const carryRow = makeMathRow(cellsById, columns, { id: 'carry', kind: 'work', values: carries })
  const resultRow = makeMathRow(cellsById, columns, { id: 'result', kind: 'result', number: result })
  const locations = Object.values(cellsById)
    .filter((cell) => cell.value !== null || cell.kind === 'result')
    .map((cell) => cell.id)
  const groups = ['result.*', 'carry.*', ...rows.map((row) => row.id + '.*')]
  return {
    version: 2,
    operation: 'addition',
    operator: '+',
    operands: numbers.map((number) => number.text),
    answer: result.text,
    fractionDigits,
    wholeColumns,
    columns,
    rows,
    carryRow,
    workRows: [carryRow],
    resultRow,
    cellsById,
    locations,
    groups,
  }
}
