/**
 * Deterministically routes a conversational text-bar value into the shared
 * vertical-math view. This module deliberately knows nothing about teachers,
 * sessions, grading, or expected-value selection.
 */
import {
  enterVerticalMathCell,
  enterVerticalMathRowAnswer,
  getVerticalMathLocationDescriptor,
} from './verticalMath.mjs'

const NUMBER_LITERAL = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/
const OPERATOR_LITERAL = /^(?:\+|-|\*|\u00d7)$/
const DIVISION_PAIR = /^(\S+)\s+(?:r|remainder)\s+(\S+)$/i
const DIVISION_PAIR_START = /^\S+\s+(?:r|remainder)\b/i

function answerRows(problem) {
  return Array.isArray(problem?.answerRows) && problem.answerRows.length
    ? problem.answerRows
    : (problem?.resultRow ? [problem.resultRow] : [])
}

function requestedIds(view) {
  const hidden = new Set(Array.isArray(view?.hidden) ? view.hidden : [])
  return [...new Set(Array.isArray(view?.editable) ? view.editable : [])]
    .filter((id) => typeof id === 'string' && hidden.has(id))
}

function knownEditableLocation(problem, ids, location) {
  return typeof location === 'string' && ids.includes(location) &&
    Boolean(getVerticalMathLocationDescriptor(problem, location))
}

function fullAnswerRows(problem, ids) {
  const requested = new Set(ids)
  return answerRows(problem).filter((row) =>
    Array.isArray(row.cells) && row.cells.length > 0 &&
    row.cells.every((cell) => requested.has(cell.id)),
  )
}

function logicalDestinations(problem, ids) {
  const rows = fullAnswerRows(problem, ids)
  const rowCells = new Set(rows.flatMap((row) => row.cells.map((cell) => cell.id)))
  const locations = ids.filter((id) => !rowCells.has(id) && getVerticalMathLocationDescriptor(problem, id))
  return [
    ...rows.map((row) => ({ type: 'row', row })),
    ...locations.map((location) => ({ type: 'location', location })),
  ]
}

function humanize(value) {
  return String(value || '').replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function placeLabel(place) {
  const whole = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions']
  const fraction = ['tenths', 'hundredths', 'thousandths', 'ten thousandths', 'hundred thousandths', 'millionths']
  if (!Number.isInteger(place)) return ''
  return place >= 0 ? (whole[place] || `whole place ${place}`) : (fraction[-place - 1] || `fraction place ${-place}`)
}

function changedLocations(before, after) {
  const left = before?.entries || {}
  const right = after?.entries || {}
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((id) => left[id] !== right[id])
    .sort()
}

function entryResult(view, nextView) {
  return { kind: 'entry', view: nextView, locations: changedLocations(view, nextView) }
}

function rejection(kind, text, message) {
  return { kind, text, message }
}

function enterLocation(problem, view, location, parsed, raw) {
  const entered = enterVerticalMathCell(problem, view, location, parsed)
  return entered.ok
    ? entryResult(view, entered.view)
    : rejection('invalid', raw, entered.error)
}

function enterRow(problem, view, row, parsed, raw) {
  const entered = enterVerticalMathRowAnswer(problem, view, row.id, parsed)
  return entered.ok
    ? entryResult(view, entered.view)
    : rejection('invalid', raw, entered.error)
}

function enterDivisionPair(problem, view, rows, match, raw) {
  if (rows.length !== 2 || rows.some((row) => !row.cells.every((cell) => view.editable.includes(cell.id)))) {
    return rejection('clarification', raw, 'Select the quotient and remainder answer rows before entering both values.')
  }
  const first = enterVerticalMathRowAnswer(problem, view, rows[0].id, match[1])
  if (!first.ok) return rejection('invalid', raw, first.error)
  const second = enterVerticalMathRowAnswer(problem, first.view, rows[1].id, match[2])
  if (!second.ok) return rejection('invalid', raw, second.error)
  return entryResult(view, second.view)
}

/** Conservative deterministic signal for callers deciding whether prose asks for help. */
export function isMathConversationQuestion(text) {
  const value = String(text ?? '').trim().replace(/[\u2018\u2019]/g, "'")
  if (!value) return false
  if (/\?/.test(value)) return true
  return /^(?:(?:why|how|what|when|where|which|who|can|could|would|should|do|does|did|is|are|am|may)\b|help\b|i\s+(?:do\s+not|don't)\s+(?:understand|know)\b|i(?:'m|\s+am)\s+(?:not\s+sure|confused|stuck)\b|i\s+need\s+help\b)/i.test(value)
}

/**
 * Route one regular-textarea value to math entry or conversation handling.
 * Parsing trims surrounding whitespace; conversation results retain the raw text.
 */
export function routeMathTextInput(problem, view, text, { selectedLocation = null } = {}) {
  const raw = String(text ?? '')
  const parsed = raw.trim()
  if (!parsed) return { kind: 'empty' }

  const divisionMatch = problem?.operation === 'division' ? parsed.match(DIVISION_PAIR) : null
  const numeric = NUMBER_LITERAL.test(parsed)
  const operator = OPERATOR_LITERAL.test(parsed)
  const scalarLike = /^[\d\s,+\-.*\u00d7/]+$/.test(parsed)

  if (!divisionMatch && !numeric && !operator) {
    if ((problem?.operation === 'division' && DIVISION_PAIR_START.test(parsed)) || scalarLike) {
      return rejection('invalid', raw, 'Enter a valid nonnegative number without changing its punctuation.')
    }
    return { kind: 'conversation', text: raw }
  }

  const ids = requestedIds(view)
  const destinations = logicalDestinations(problem, ids)
  const rows = fullAnswerRows(problem, ids)

  if (divisionMatch) {
    if (destinations.length !== 2 || rows.length !== 2) {
      return rejection('clarification', raw, 'The current math view does not request exactly a quotient and remainder.')
    }
    return enterDivisionPair(problem, view, rows, divisionMatch, raw)
  }

  if (destinations.length === 0) {
    return rejection('clarification', raw, 'There is no editable math location for this entry.')
  }

  // A sole fully editable answer row is one destination. It intentionally wins
  // over incidental focus on one of its digits.
  if (destinations.length === 1 && destinations[0].type === 'row') {
    return numeric
      ? enterRow(problem, view, destinations[0].row, parsed, raw)
      : rejection('invalid', raw, 'Enter a nonnegative number for the answer row.')
  }

  if (destinations.length === 1 && destinations[0].type === 'location') {
    return enterLocation(problem, view, destinations[0].location, parsed, raw)
  }

  if (typeof selectedLocation === 'string' && selectedLocation.endsWith('.*')) {
    const rowId = selectedLocation.slice(0, -2)
    const selectedRow = rows.find((row) => row.id === rowId)
    if (selectedRow) {
      return numeric
        ? enterRow(problem, view, selectedRow, parsed, raw)
        : rejection('invalid', raw, 'Enter a nonnegative number for the answer row.')
    }
  }

  if (knownEditableLocation(problem, ids, selectedLocation)) {
    return enterLocation(problem, view, selectedLocation, parsed, raw)
  }

  if (problem?.operation === 'division' && rows.length === 2 && destinations.length === 2 && numeric) {
    return rejection('clarification', raw, 'Enter both values, for example "12 r 0", or select an answer row.')
  }

  return rejection('clarification', raw, 'More than one math location is editable; select one location or answer row.')
}

/** Public choices for a text bar. Values bind only to currently requested locations. */
export function listMathTextDestinations(problem, view) {
  const ids = requestedIds(view)
  const destinations = logicalDestinations(problem, ids)
  if (destinations.length <= 1) return []
  const rows = fullAnswerRows(problem, ids)
  const choices = [{ value: '', label: 'Automatic' }]
  for (const row of rows) {
    choices.push({ value: `${row.id}.*`, label: row.role === 'remainder' ? 'Remainder' : 'Whole answer' })
  }
  for (const id of ids) {
    const descriptor = getVerticalMathLocationDescriptor(problem, id)
    if (!descriptor) continue
    const rowName = humanize(descriptor.row || descriptor.role || 'Math')
    const decimalHidden = descriptor.row && view.hidden.includes(`${descriptor.row}.decimal`)
    const label = descriptor.kind === 'operator' ? 'Arithmetic symbol'
      : descriptor.kind === 'decimal' ? `${rowName} decimal point`
        : `${rowName} ${decimalHidden ? `slot ${descriptor.slot}` : placeLabel(descriptor.place)}`
    choices.push({ value: id, label })
  }
  return choices
}
