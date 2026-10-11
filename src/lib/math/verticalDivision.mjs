/**
 * Exact, deterministic whole-number long division. Rendering of the bracket
 * and step rows is deliberately left to a future presentation slice.
 */
import {
  MATH_MAX_WHOLE_DIGITS,
  parseMathDecimal,
  mathColumns,
  makeMathRow,
  createVerticalMathView,
  resolveVerticalMathLocations,
  applyVerticalMathCommand,
  enterVerticalMathCell,
  enterVerticalMathRowAnswer,
  evaluateVerticalMath,
} from './verticalMath.mjs'

export const DIVISION_MAX_WHOLE_DIGITS = MATH_MAX_WHOLE_DIGITS

export const createVerticalDivisionView = createVerticalMathView
export const resolveDivisionLocations = resolveVerticalMathLocations
export const applyVerticalDivisionCommand = applyVerticalMathCommand
export const enterDivisionDigit = enterVerticalMathCell
export const evaluateVerticalDivision = evaluateVerticalMath

function parseWholeOperand(input, index) {
  const literal = String(input ?? '').trim()
  let parsed
  try { parsed = parseMathDecimal(input, DIVISION_MAX_WHOLE_DIGITS, 0) }
  catch (error) { throw new Error('Number ' + index + ': ' + error.message) }
  if (literal.includes('.')) throw new Error('Number ' + index + ': Division operands must be whole numbers without a decimal point.')
  const digits = literal.replace(/,/g, '')
  if (digits.length > DIVISION_MAX_WHOLE_DIGITS) {
    throw new Error('Number ' + index + ': Each number may have at most ' + DIVISION_MAX_WHOLE_DIGITS + ' whole-number digits.')
  }
  return { parsed, digits, value: BigInt(parsed.whole) }
}

function alignedWorkRow(cellsById, columns, id, label, text, endIndex, divisionRole) {
  const cellPlaces = Array(columns.length).fill(null)
  const values = {}
  const startIndex = endIndex - text.length + 1
  if (startIndex < 0) throw new Error('Division work exceeded the input-based grid width.')
  for (let index = startIndex; index <= endIndex; index++) {
    const place = endIndex - index
    cellPlaces[index] = place
    values[place] = text[index - startIndex]
  }
  const row = makeMathRow(cellsById, columns, {
    id,
    kind: 'work',
    role: 'numeric',
    label,
    values,
    cellPlaces,
    inputCapacity: 1,
  })
  return { ...row, divisionRole, position: { endIndex, endSlot: columns.length - endIndex - 1 } }
}

export function buildVerticalDivisionProblem(rawOperands) {
  if (!Array.isArray(rawOperands) || rawOperands.length !== 2) {
    throw new Error('Vertical division requires exactly two whole numbers.')
  }
  const dividendInput = parseWholeOperand(rawOperands[0], 1)
  const divisorInput = parseWholeOperand(rawOperands[1], 2)
  if (divisorInput.value === 0n) throw new Error('The divisor must be greater than zero.')

  const quotient = dividendInput.value / divisorInput.value
  const finalRemainder = dividendInput.value % divisorInput.value
  const dividendDigits = dividendInput.digits.split('')
  const wholeColumns = Math.max(dividendInput.digits.length, divisorInput.digits.length)
  const columns = mathColumns(wholeColumns, 0)
  const dividendOffset = wholeColumns - dividendDigits.length
  const cellsById = {}
  const operandNumbers = [dividendInput, divisorInput].map((item) => ({
    whole: item.digits,
    fraction: '',
    text: item.parsed.whole,
  }))
  const rows = operandNumbers.map((number, index) => makeMathRow(cellsById, columns, {
    id: 'operand.' + (index + 1),
    kind: 'operand',
    number,
    rowIndex: index + 1,
  }))

  const workRows = []
  const steps = []
  let previousRemainder = 0n
  for (let index = 0; index < dividendDigits.length; index++) {
    const stepNumber = index + 1
    const inputDigit = dividendDigits[index]
    const partial = previousRemainder * 10n + BigInt(inputDigit)
    const quotientDigit = partial / divisorInput.value
    const product = divisorInput.value * quotientDigit
    const remainder = partial - product
    const endIndex = dividendOffset + index
    let bringDownRow = null
    if (index > 0) {
      bringDownRow = alignedWorkRow(
        cellsById, columns, 'step.' + stepNumber + '.bring_down', 'Bring down',
        inputDigit, endIndex, 'bring_down',
      )
      workRows.push(bringDownRow)
    }
    const partialRow = alignedWorkRow(
      cellsById, columns, 'step.' + stepNumber + '.partial', 'Partial dividend',
      partial.toString(), endIndex, 'partial',
    )
    const productRow = alignedWorkRow(
      cellsById, columns, 'step.' + stepNumber + '.product', 'Product',
      product.toString(), endIndex, 'product',
    )
    const remainderRow = alignedWorkRow(
      cellsById, columns, 'step.' + stepNumber + '.remainder', 'Remainder',
      remainder.toString(), endIndex, 'remainder',
    )
    workRows.push(partialRow, productRow, remainderRow)
    steps.push({
      index: stepNumber,
      inputDigit,
      partial: partial.toString(),
      quotientDigit: quotientDigit.toString(),
      product: product.toString(),
      remainder: remainder.toString(),
      consumedDividendIndex: index,
      consumedDividendColumn: columns[endIndex],
      endSlot: columns.length - endIndex - 1,
      bringDownLocation: bringDownRow ? bringDownRow.cells.find((cell) => cell.place === 0).id : null,
      rows: {
        ...(bringDownRow ? { bringDown: bringDownRow.id } : {}),
        partial: partialRow.id,
        product: productRow.id,
        remainder: remainderRow.id,
      },
    })
    previousRemainder = remainder
  }

  const quotientNumber = { whole: quotient.toString(), fraction: '', text: quotient.toString() }
  const remainderNumber = { whole: finalRemainder.toString(), fraction: '', text: finalRemainder.toString() }
  const resultRow = makeMathRow(cellsById, columns, {
    id: 'result', kind: 'result', number: quotientNumber,
  })
  const finalRemainderRow = makeMathRow(cellsById, columns, {
    id: 'remainder', kind: 'result', role: 'remainder', label: 'Remainder', number: remainderNumber,
  })
  const answerRows = [resultRow, finalRemainderRow]
  const locations = Object.values(cellsById)
    .filter((cell) => cell.value !== null || cell.kind === 'result')
    .map((cell) => cell.id)
  const groups = [
    'result.*', 'remainder.*',
    ...workRows.map((row) => row.id + '.*'),
    ...rows.map((row) => row.id + '.*'),
  ]
  return {
    version: 2,
    operation: 'division',
    operator: '\u00f7',
    operands: [dividendInput.parsed.whole, divisorInput.parsed.whole],
    answer: quotient.toString(),
    quotient: quotient.toString(),
    remainder: finalRemainder.toString(),
    fractionDigits: 0,
    wholeColumns,
    columns,
    rows,
    workRows,
    steps,
    resultRow,
    remainderRow: finalRemainderRow,
    answerRows,
    cellsById,
    locations,
    groups,
    layout: {
      type: 'long_division',
      bracket: { dividendRow: 'operand.1', divisorRow: 'operand.2', quotientRow: 'result' },
      dividendOffset,
      stepRowOrder: ['bring_down', 'partial', 'product', 'remainder'],
    },
  }
}

/** Atomically enters both whole-number answer rows. */
export function enterDivisionAnswer(problem, view, answer) {
  if (!answer || typeof answer !== 'object' ||
      !Object.hasOwn(answer, 'quotient') || !Object.hasOwn(answer, 'remainder')) {
    return { ok: false, error: 'Enter both quotient and remainder.' }
  }
  const quotientEntry = enterVerticalMathRowAnswer(problem, view, 'result', answer.quotient)
  if (!quotientEntry.ok) return quotientEntry
  const remainderEntry = enterVerticalMathRowAnswer(problem, quotientEntry.view, 'remainder', answer.remainder)
  if (!remainderEntry.ok) return { ...remainderEntry, view }
  return remainderEntry
}
