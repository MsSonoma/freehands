/**
 * Exact, deterministic stacked multiplication for two nonnegative decimals.
 * Presentation, visibility commands and input handling live in verticalMath.
 */
import {
  mathPlaceName,
  parseMathDecimal,
  mathColumns,
  makeMathRow,
  createVerticalMathView,
  resolveVerticalMathLocations,
  applyVerticalMathCommand,
  enterVerticalMathCell,
  enterVerticalMathFullAnswer,
  evaluateVerticalMath,
} from './verticalMath.mjs'

export const MULTIPLICATION_MAX_OPERANDS = 2
export const MULTIPLICATION_MAX_WHOLE_DIGITS = 7
export const MULTIPLICATION_MAX_FRACTION_DIGITS = 6

export const multiplicationPlaceName = mathPlaceName
export const createVerticalMultiplicationView = createVerticalMathView
export const resolveMultiplicationLocations = resolveVerticalMathLocations
export const applyVerticalMultiplicationCommand = applyVerticalMathCommand
export const enterMultiplicationDigit = enterVerticalMathCell
export const enterMultiplicationFullAnswer = enterVerticalMathFullAnswer
export const evaluateVerticalMultiplication = evaluateVerticalMath

function parseFactor(value, index) {
  const literal = String(value ?? '').trim()
  try {
    return parseMathDecimal(
      literal,
      MULTIPLICATION_MAX_WHOLE_DIGITS,
      MULTIPLICATION_MAX_FRACTION_DIGITS,
    )
  } catch (error) {
    throw new Error('Factor ' + index + ': ' + error.message)
  }
}

function valuesForShiftedPartial(product, shift) {
  const values = {}
  for (let place = 0; place < shift; place++) values[place] = '0'

  // A zero product has one significant zero in addition to its positional
  // placeholders: shift 2 is therefore displayed as 000.
  const digits = product.toString()
  for (let index = 0; index < digits.length; index++) {
    values[shift + index] = digits[digits.length - index - 1]
  }
  return values
}

function multiplicationCarries(multiplicandDigits, multiplierDigit, shift) {
  const values = {}
  let carry = 0
  const digits = multiplicandDigits
  for (let index = 0; index < digits.length; index++) {
    const digit = Number(digits[digits.length - index - 1])
    const total = digit * multiplierDigit + carry
    carry = Math.floor(total / 10)
    if (carry) values[shift + index + 1] = String(carry)
  }
  return values
}

function sumPartialColumns(partialValues, wholeColumns) {
  const carries = {}
  const digits = {}
  let incomingCarry = 0
  for (let place = 0; place < wholeColumns; place++) {
    const total = partialValues.reduce(
      (sum, values) => sum + Number(values[place] || 0),
      incomingCarry,
    )
    digits[place] = String(total % 10)
    incomingCarry = Math.floor(total / 10)
    if (incomingCarry) {
      if (place + 1 >= wholeColumns) {
        throw new Error('Multiplication result exceeded allocated columns.')
      }
      carries[place + 1] = String(incomingCarry)
    }
  }
  if (incomingCarry) throw new Error('Multiplication result exceeded allocated columns.')
  return { carries, digits }
}

export function buildVerticalMultiplicationProblem(rawOperands) {
  if (!Array.isArray(rawOperands) || rawOperands.length !== MULTIPLICATION_MAX_OPERANDS) {
    throw new Error('Vertical multiplication requires exactly two factors.')
  }
  const numbers = rawOperands.map((value, index) => parseFactor(value, index + 1))
  const coefficients = numbers.map((number) => number.whole + number.fraction)
  const multiplicand = BigInt(coefficients[0])
  const multiplier = BigInt(coefficients[1])
  const product = multiplicand * multiplier
  const fractionDigits = numbers[0].fraction.length + numbers[1].fraction.length
  const productDigits = product.toString().padStart(fractionDigits + 1, '0')
  const answerWhole = fractionDigits > 0
    ? productDigits.slice(0, -fractionDigits)
    : productDigits
  const answerFraction = fractionDigits > 0 ? productDigits.slice(-fractionDigits) : ''
  const answer = answerWhole + (answerFraction ? '.' + answerFraction : '')

  // Physical width depends only on the two public input widths. Each row maps
  // those slots to its own mathematical places.
  const slotCount = coefficients[0].length + coefficients[1].length
  const wholeColumns = slotCount - fractionDigits
  const columns = mathColumns(wholeColumns, fractionDigits)
  const workColumns = mathColumns(slotCount, 0)
  const cellsById = {}

  const rows = numbers.map((number, index) => makeMathRow(cellsById, columns, {
    id: 'operand.' + (index + 1),
    kind: 'operand',
    number,
    rowIndex: index + 1,
    role: 'factor',
    label: 'Factor ' + (index + 1),
    cellPlaces: mathColumns(slotCount - number.fraction.length, number.fraction.length),
    decimalPlaces: number.fraction.length,
  }))

  const multiplierDigits = coefficients[1].split('').reverse().map(Number)
  const partialRows = []
  const multiplicationCarryRows = []
  const partialValueMaps = []
  for (let shift = 0; shift < multiplierDigits.length; shift++) {
    const step = shift + 1
    const multiplierDigit = multiplierDigits[shift]
    const partialValues = valuesForShiftedPartial(multiplicand * BigInt(multiplierDigit), shift)
    const carryValues = multiplicationCarries(coefficients[0], multiplierDigit, shift)
    partialValueMaps.push(partialValues)

    const workingLabel = fractionDigits > 0 ? '; whole-number working' : ''
    const carryRow = makeMathRow(cellsById, columns, {
      id: 'multiply_carry.' + step,
      kind: 'work',
      role: 'multiplication_carry',
      label: 'Multiplication carries for step ' + step + ' (' + mathPlaceName(shift) + ' place' + workingLabel + ')',
      values: carryValues,
      rowIndex: step,
      inputCapacity: 1,
      cellPlaces: workColumns,
      decimalPlaces: 0,
    })
    const partialRow = makeMathRow(cellsById, columns, {
      id: 'partial.' + step,
      kind: 'work',
      role: 'partial_product',
      label: 'Partial product for step ' + step + ' (' + mathPlaceName(shift) + ' place' + workingLabel + ')',
      values: partialValues,
      rowIndex: step,
      inputCapacity: 1,
      cellPlaces: workColumns,
      decimalPlaces: 0,
    })
    multiplicationCarryRows.push(carryRow)
    partialRows.push(partialRow)
  }
  if (partialRows.length) partialRows[partialRows.length - 1].operator = '+'

  const summed = sumPartialColumns(partialValueMaps, slotCount)
  const sumCarryRow = makeMathRow(cellsById, columns, {
    id: 'sum_carry',
    kind: 'work',
    role: 'sum_carry',
    label: 'Carries from adding the partial products' + (fractionDigits > 0 ? ' (whole-number working)' : ''),
    values: summed.carries,
    inputCapacity: 2,
    cellPlaces: workColumns,
    decimalPlaces: 0,
  })
  const result = { whole: answerWhole, fraction: answerFraction, text: answer }
  const resultRow = makeMathRow(cellsById, columns, {
    id: 'result',
    kind: 'result',
    role: 'result',
    label: 'Product',
    number: result,
    decimalPlaces: fractionDigits,
  })

  const workRows = []
  for (let index = 0; index < partialRows.length; index++) {
    workRows.push(multiplicationCarryRows[index], partialRows[index])
  }
  workRows.push(sumCarryRow)

  const layout = [
    ...rows.map((row) => ({ type: 'row', rowId: row.id })),
    { type: 'rule', id: 'factor_rule' },
  ]
  for (let index = 0; index < partialRows.length; index++) {
    layout.push(
      { type: 'row', rowId: multiplicationCarryRows[index].id },
      { type: 'row', rowId: partialRows[index].id },
    )
  }
  layout.push(
    { type: 'row', rowId: sumCarryRow.id },
    { type: 'rule', id: 'result_rule' },
    { type: 'row', rowId: resultRow.id },
  )

  const locations = Object.values(cellsById)
    .filter((cell) => cell.value !== null || cell.kind === 'result')
    .map((cell) => cell.id)
  const addressableRows = [resultRow, ...workRows, ...rows].filter((row) =>
    row.kind === 'result' || row.cells.some((cell) => cell.value !== null),
  )
  const groups = addressableRows.map((row) => row.id + '.*')

  // The independently accumulated columns must agree with the exact BigInt
  // product; keeping this invariant here catches malformed scratch work.
  const summedCoefficient = workColumns
    .map((place) => summed.digits[place])
    .join('')
    .replace(/^0+(?=\d)/, '')
  if (summedCoefficient !== product.toString()) {
    throw new Error('Partial products did not sum to the exact product.')
  }

  return {
    version: 2,
    operation: 'multiplication',
    operator: '\u00d7',
    operands: numbers.map((number) => number.text),
    answer,
    fractionDigits,
    wholeColumns,
    columns,
    workingColumns: workColumns,
    slotCount,
    decimalScale: fractionDigits,
    rows,
    workRows,
    partialRows,
    multiplicationCarryRows,
    sumCarryRow,
    resultRow,
    cellsById,
    locations,
    groups,
    layout,
  }
}
