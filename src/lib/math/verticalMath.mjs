/**
 * Shared, deterministic grid primitives for vertical arithmetic.
 * No teacher/session code belongs here.
 * A problem contains the solved mathematical model; a view only controls
 * presentation and the learner's entries.
 */
import { validateVerticalMathExercise } from './verticalMathValidation.mjs'

export { validateVerticalMathExercise } from './verticalMathValidation.mjs'

export const MATH_MAX_WHOLE_DIGITS = 7
export const MATH_MAX_FRACTION_DIGITS = 6

const WHOLE_PLACES = [
  'ones', 'tens', 'hundreds', 'thousands', 'ten_thousands',
  'hundred_thousands', 'millions', 'ten_millions', 'hundred_millions',
  'billions', 'ten_billions', 'hundred_billions', 'trillions',
  'ten_trillions',
]
const FRACTION_PLACES = [
  'tenths', 'hundredths', 'thousandths', 'ten_thousandths',
  'hundred_thousandths', 'millionths', 'ten_millionths',
  'hundred_millionths', 'billionths', 'ten_billionths',
  'hundred_billionths', 'trillionths',
]

export function mathPlaceName(place) {
  if (!Number.isInteger(place)) throw new Error('Place must be an integer.')
  return place >= 0
    ? (WHOLE_PLACES[place] || 'whole_place_' + place)
    : (FRACTION_PLACES[-place - 1] || 'fraction_place_' + (-place))
}

export function parseMathDecimal(input, maxWhole = MATH_MAX_WHOLE_DIGITS, maxFraction = MATH_MAX_FRACTION_DIGITS) {
  const literal = String(input ?? '').trim()
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(literal)) {
    throw new Error('Use a nonnegative number with digits, valid thousands separators, and an optional decimal point.')
  }
  const text = literal.replace(/,/g, '')
  const [rawWhole, fraction = ''] = text.split('.')
  const whole = rawWhole.replace(/^0+(?=\d)/, '')
  if (whole.length > maxWhole) throw new Error('Each number may have at most ' + maxWhole + ' whole-number digits.')
  if (fraction.length > maxFraction) throw new Error('Each number may have at most ' + maxFraction + ' decimal digits.')
  return { whole, fraction, text: whole + (fraction ? '.' + fraction : '') }
}

export function mathDigitAt(number, place) {
  if (place >= 0) {
    const index = number.whole.length - place - 1
    return index >= 0 ? number.whole[index] : null
  }
  return number.fraction[-place - 1] ?? null
}

export function mathColumns(wholeColumns, fractionDigits) {
  if (!Number.isInteger(wholeColumns) || wholeColumns < 1 || !Number.isInteger(fractionDigits) || fractionDigits < 0) {
    throw new Error('Invalid place-value dimensions.')
  }
  const columns = []
  for (let place = wholeColumns - 1; place >= -fractionDigits; place--) columns.push(place)
  return columns
}

/** Creates a complete row, including non-value padding positions. */
export function makeMathRow(map, columns, {
  id, kind, number = null, rowIndex = null, values = null,
  role = kind, label = id, inputCapacity = kind === 'work' ? 2 : 1,
  cellPlaces = columns, decimalPlaces = number ? number.fraction.length : 0,
}) {
  if (!Array.isArray(cellPlaces) || cellPlaces.length !== columns.length) {
    throw new Error('Row place values must match the grid width.')
  }
  const cells = cellPlaces.map((place, index) => {
    if (place === null) {
      return {
        id: id + '.padding.' + index,
        row: id,
        rowIndex,
        kind,
        role,
        slot: cellPlaces.length - index - 1,
        column: columns[index],
        place: null,
        value: null,
        inputCapacity,
      }
    }
    if (!Number.isInteger(place)) throw new Error('Row places must be integers or null padding.')
    const value = values
      ? (Object.prototype.hasOwnProperty.call(values, place) ? String(values[place]) : null)
      : (number ? mathDigitAt(number, place) : null)
    const cell = {
      id: id + '.' + mathPlaceName(place),
      row: id,
      rowIndex,
      kind,
      role,
      slot: cellPlaces.length - index - 1,
      column: columns[index],
      place,
      value,
      inputCapacity,
    }
    map[cell.id] = cell
    return cell
  })
  return {
    id, kind, role, label, decimalPlaces,
    ...(rowIndex !== null ? { rowIndex } : {}),
    ...(number ? { number: number.text } : {}),
    cells,
  }
}

function workRowsOf(problem) {
  return Array.isArray(problem.workRows)
    ? problem.workRows
    : (problem.carryRow ? [problem.carryRow] : [])
}

function answerRowsOf(problem) {
  return Array.isArray(problem.answerRows) && problem.answerRows.length
    ? problem.answerRows
    : [problem.resultRow]
}

const OPERATOR_CHOICES = ['+', '-', '\u00d7']

function normalizedOperator(operator) {
  if (operator === '+') return '+'
  if (operator === '-') return '-'
  if (operator === '\u00d7' || operator === '*') return '\u00d7'
  throw new Error('Unsupported arithmetic operator.')
}

function decimalRowsOf(problem) {
  return [...problem.rows, ...answerRowsOf(problem)]
}

function symbolDescriptors(problem) {
  // Whole-number long division uses a bracket supplied by its layout model.
  // It has no hideable operator or decimal-placement target in this slice.
  if (problem.operation === 'division') return []
  const descriptors = [{
    id: 'operator',
    kind: 'operator',
    value: normalizedOperator(problem.operator),
    choices: [...OPERATOR_CHOICES],
  }]
  for (const row of decimalRowsOf(problem)) {
    const ones = row.cells.find((cell) => cell.place === 0)
    if (!ones) throw new Error('A number row is missing its ones position.')
    descriptors.push({
      id: row.id + '.decimal',
      kind: 'decimal',
      row: row.id,
      value: String(ones.slot),
      minimum: 0,
      maximum: row.cells.length - 1,
    })
  }
  return descriptors
}

function symbolDescriptor(problem, location) {
  return symbolDescriptors(problem).find((descriptor) => descriptor.id === location) || null
}

function rowById(problem, rowId) {
  return [...problem.rows, ...workRowsOf(problem), ...answerRowsOf(problem)]
    .find((row) => row.id === rowId) || null
}

/** Public input metadata deliberately excludes solved values. */
export function getVerticalMathLocationDescriptor(problem, location) {
  const symbol = symbolDescriptor(problem, location)
  if (symbol) {
    const { value, ...publicDescriptor } = symbol
    return publicDescriptor
  }
  const cell = problem.cellsById[location]
  if (!cell || (cell.value === null && cell.kind !== 'result')) return null
  return {
    id: cell.id,
    kind: 'digit',
    row: cell.row,
    rowIndex: cell.rowIndex,
    role: cell.role,
    slot: cell.slot,
    column: cell.column,
    place: cell.place,
    inputCapacity: cell.inputCapacity,
  }
}

/** Public row metadata gives renderers named inputs without solved values. */
export function getVerticalMathRowDescriptor(problem, rowId) {
  const row = rowById(problem, rowId)
  if (!row) return null
  return {
    id: row.id,
    kind: row.kind,
    role: row.role,
    label: row.label,
    ...(row.rowIndex !== undefined ? { rowIndex: row.rowIndex } : {}),
    cells: row.cells.map((cell) => getVerticalMathLocationDescriptor(problem, cell.id)),
    ...(problem.operation !== 'division' && (row.kind === 'operand' || row.kind === 'result')
      ? { decimal: getVerticalMathLocationDescriptor(problem, row.id + '.decimal') }
      : {}),
  }
}

export function createVerticalMathView(problem) {
  const answerCells = answerRowsOf(problem).flatMap((row) => row.cells.map((cell) => cell.id))
  const workCells = workRowsOf(problem).flatMap((row) => row.cells)
    .filter((cell) => Boolean(problem.cellsById[cell.id]))
    .map((cell) => cell.id)
  return {
    hidden: [
      ...answerCells,
      ...workCells,
    ],
    editable: answerCells,
    highlighted: [],
    entries: {},
  }
}

export function resolveVerticalMathLocations(problem, requestedLocations) {
  if (!Array.isArray(requestedLocations) || requestedLocations.length === 0) {
    throw new Error('Select at least one named location.')
  }
  const resolved = []
  for (const location of requestedLocations) {
    if (typeof location !== 'string') throw new Error('Location names must be strings.')
    if (location.endsWith('.*')) {
      const group = location.slice(0, -2)
      const matching = Object.values(problem.cellsById).filter((cell) =>
        cell.row === group && (cell.value !== null || cell.kind === 'result'))
      if (!matching.length) throw new Error('Unknown or empty location group: ' + location)
      matching.forEach((cell) => resolved.push(cell.id))
    } else {
      const cell = problem.cellsById[location]
      const symbol = symbolDescriptor(problem, location)
      if ((!cell || (cell.value === null && cell.kind !== 'result')) && !symbol) {
        throw new Error('Unknown or unavailable location: ' + location)
      }
      resolved.push(location)
    }
  }
  return [...new Set(resolved)]
}

/** Universal teacher actions. Invalid requests return an error without mutation. */
export function applyVerticalMathCommand(problem, view, command, options = {}) {
  const action = command?.action
  if (!['hide', 'show', 'highlight', 'clear_highlight'].includes(action)) {
    return { ok: false, error: 'Unknown math command.' }
  }
  if (Object.hasOwn(command || {}, 'editable') && typeof command.editable !== 'boolean') {
    return { ok: false, error: 'Editable must be a boolean.' }
  }
  let ids
  try {
    ids = action === 'clear_highlight' && !command?.locations
      ? []
      : resolveVerticalMathLocations(problem, command?.locations)
  } catch (error) {
    return { ok: false, error: error.message }
  }
  if ((options.phase || 'teaching') === 'test') {
    return { ok: false, error: 'Math presentation is locked during an independent test.' }
  }
  const next = {
    hidden: [...view.hidden],
    editable: [...view.editable],
    highlighted: [...view.highlighted],
    entries: { ...view.entries },
  }
  if (action === 'hide') {
    next.hidden = [...new Set([...next.hidden, ...ids])]
    next.editable = command.editable === false
      ? next.editable.filter((id) => !ids.includes(id))
      : [...new Set([...next.editable, ...ids])]
  }
  if (action === 'show') {
    next.hidden = next.hidden.filter((id) => !ids.includes(id))
    next.editable = next.editable.filter((id) => !ids.includes(id))
    ids.forEach((id) => { delete next.entries[id] })
  }
  if (action === 'highlight') next.highlighted = ids
  if (action === 'clear_highlight') next.highlighted = []
  if (options.requireUnique === true) {
    const validation = validateVerticalMathExercise(problem, next)
    if (!validation.ok) {
      return {
        ok: false,
        error: validation.reason,
        status: validation.status,
        validation,
      }
    }
  }
  return { ok: true, view: next, locations: ids }
}

export function enterVerticalMathCell(problem, view, location, input) {
  const cell = problem.cellsById[location]
  const symbol = symbolDescriptor(problem, location)
  if ((!cell && !symbol) || !view.editable.includes(location)) {
    return { ok: false, error: 'That location is not editable.' }
  }
  if (symbol) {
    if (input === '') {
      const entries = { ...view.entries }
      delete entries[location]
      return { ok: true, view: { ...view, entries } }
    }
    let answer
    if (symbol.kind === 'operator') {
      if (typeof input !== 'string') return { ok: false, error: 'Enter a supported operator.' }
      try { answer = normalizedOperator(input) }
      catch { return { ok: false, error: 'Enter a supported operator.' } }
    } else {
      if (typeof input !== 'string' || !/^(?:0|[1-9]\d*)$/.test(input)) {
        return { ok: false, error: 'Enter a whole-number decimal boundary.' }
      }
      const boundary = Number(input)
      if (!Number.isSafeInteger(boundary) || boundary < symbol.minimum || boundary > symbol.maximum) {
        return { ok: false, error: 'That decimal boundary is outside the available row.' }
      }
      answer = input
    }
    return { ok: true, view: { ...view, entries: { ...view.entries, [location]: answer } } }
  }
  // Regroup values may be 10–19, while ordinary number cells are single digits.
  const maxLength = Number.isInteger(cell.inputCapacity) && cell.inputCapacity > 0
    ? cell.inputCapacity
    : (cell.kind === 'work' ? 2 : 1)
  const digit = String(input ?? '')
  if (!new RegExp('^\\d{0,' + maxLength + '}$').test(digit)) {
    return { ok: false, error: 'Enter up to ' + maxLength + ' numeric digit(s).' }
  }
  const entries = { ...view.entries }
  if (digit === '') delete entries[location]
  else entries[location] = digit
  return { ok: true, view: { ...view, entries } }
}

export function enterVerticalMathFullAnswer(problem, view, text) {
  if (view.editable.includes('result.decimal')) {
    return { ok: false, error: 'Enter the result digits and decimal placement separately.' }
  }
  return enterVerticalMathRowAnswer(problem, view, problem.resultRow.id, text)
}

/** Enters one public-width answer row without exposing its solved width. */
export function enterVerticalMathRowAnswer(problem, view, rowId, text) {
  const row = answerRowsOf(problem).find((candidate) => candidate.id === rowId)
  if (!row) return { ok: false, error: 'Unknown answer row.' }
  if (view.editable.includes(row.id + '.decimal')) {
    return { ok: false, error: 'Enter the result digits and decimal placement separately.' }
  }
  let number
  const fractionDigits = Number.isInteger(row.decimalPlaces) ? row.decimalPlaces : problem.fractionDigits
  const wholeCapacity = row.cells.reduce((maximum, cell) =>
    Number.isInteger(cell.place) && cell.place >= 0
      ? Math.max(maximum, cell.place + 1)
      : maximum, 0)
  try { number = parseMathDecimal(text, Math.max(1, wholeCapacity), fractionDigits) }
  catch (error) { return { ok: false, error: error.message } }
  const padded = { whole: number.whole, fraction: number.fraction.padEnd(fractionDigits, '0') }
  const entries = { ...view.entries }
  for (const cell of row.cells) {
    if (!view.editable.includes(cell.id)) continue
    const digit = mathDigitAt(padded, cell.place)
    if (digit === null) delete entries[cell.id]
    else entries[cell.id] = digit
  }
  return { ok: true, view: { ...view, entries } }
}

/** Evaluation is for application logic only; the renderer must not reveal it in test mode. */
export function evaluateVerticalMath(problem, view) {
  const validation = validateVerticalMathExercise(problem, view)
  const targets = view.editable.filter((id) => Boolean(problem.cellsById[id] || symbolDescriptor(problem, id)))
  if (validation.status !== 'unique') {
    return {
      complete: validation.status === 'no_response',
      correct: false,
      checked: validation.status === 'no_response' ? 0 : targets.length,
      responseRequired: validation.status !== 'no_response' && targets.length > 0,
      missingLocations: [],
      incorrectLocations: [],
      gradable: false,
      status: validation.status,
      validation,
    }
  }
  const missingLocations = targets.filter((id) => {
    const cell = problem.cellsById[id]
    const symbol = symbolDescriptor(problem, id)
    return (symbol || cell.value !== null) && !Object.hasOwn(view.entries, id)
  })
  const incorrectLocations = targets.filter((id) => {
    const cell = problem.cellsById[id]
    const symbol = symbolDescriptor(problem, id)
    const entered = view.entries[id]
    if (entered === undefined) return false
    if (symbol) return entered !== symbol.value
    return cell.value === null ? entered !== '0' : entered !== cell.value
  })
  return {
    complete: missingLocations.length === 0,
    correct: targets.length > 0 && missingLocations.length === 0 && incorrectLocations.length === 0,
    checked: targets.length,
    responseRequired: targets.length > 0,
    missingLocations,
    incorrectLocations,
    gradable: true,
    status: validation.status,
    validation,
  }
}

/** The teacher receives these addresses, not a screenshot or cell coordinates. */
export function verticalMathAddressCatalog(problem) {
  const symbolLocations = symbolDescriptors(problem).map((descriptor) => descriptor.id)
  return {
    operation: problem.operation,
    locations: [...new Set([...problem.locations, ...symbolLocations])],
    groups: [...problem.groups],
  }
}
