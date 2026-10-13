export const VERTICAL_MATH_WORKING_NOTE_LIMIT = 192
export const VERTICAL_MATH_WORKING_NOTE_MAX_DIGITS = 2

const KEY_PATTERN = /^(?:carry|replacement|sum_carry|multiply_carry\.\d+)\.[a-z][a-z0-9_]*$/

export function isVerticalMathWorkingNoteKey(key) {
  return typeof key === 'string' && key.length <= 80 && KEY_PATTERN.test(key)
}

function workRowsOf(problem) {
  return Array.isArray(problem?.workRows)
    ? problem.workRows
    : (problem?.carryRow ? [problem.carryRow] : [])
}

function visibleTopCells(problem) {
  return (problem?.rows?.[0]?.cells || []).filter((cell) => cell.place !== null && cell.value !== null)
}

/**
 * Public scratch slots are derived from visible layout structure, never from
 * solved carry/regroup values. Teacher-controlled work cells take precedence.
 */
export function listVerticalMathWorkingNoteSlots(problem, view) {
  if (!problem || !view) return []
  const hidden = new Set(Array.isArray(view.hidden) ? view.hidden : [])
  const editable = new Set(Array.isArray(view.editable) ? view.editable : [])
  const scratchable = (cell) => hidden.has(cell.id) && !editable.has(cell.id)

  if (problem.operation === 'addition') {
    const row = workRowsOf(problem).find((candidate) => candidate.id === 'carry')
    if (!row) return []
    return row.cells.flatMap((cell) => {
      return cell.place !== null && scratchable(cell) ? [{
        key: 'carry.' + String(cell.id).split('.').at(-1),
        cellId: cell.id,
        rowId: row.id,
        place: cell.place,
        label: 'Working carry note for ' + String(cell.id).split('.').at(-1) + ' place',
      }] : []
    })
  }

  if (problem.operation === 'subtraction') {
    return visibleTopCells(problem).filter((cell) => !hidden.has(cell.id)).map((cell) => ({
      key: 'replacement.' + String(cell.id).split('.').at(-1),
      cellId: cell.id,
      rowId: cell.row,
      place: cell.place,
      overlayCellId: cell.id,
      label: 'Working replacement note for ' + String(cell.id).split('.').at(-1) + ' place',
    }))
  }

  if (problem.operation === 'multiplication') {
    return workRowsOf(problem)
      .filter((row) => row.role === 'multiplication_carry' || row.role === 'sum_carry')
      .flatMap((row) => row.cells.filter((cell) => cell.place !== null && scratchable(cell)).map((cell) => ({
        key: row.id + '.' + String(cell.id).split('.').at(-1),
        cellId: cell.id,
        rowId: row.id,
        place: cell.place,
        label: (row.role === 'sum_carry' ? 'Sum carry' : 'Multiplication carry step ' + row.rowIndex) +
          ' working note for ' + String(cell.id).split('.').at(-1) + ' place',
      })))
  }

  return []
}

export function sanitizeVerticalMathWorkingNotes(notes, { validKeys } = {}) {
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return {}
  const allowed = validKeys ? new Set(validKeys) : null
  const clean = {}
  for (const [key, rawValue] of Object.entries(notes)) {
    if (Object.keys(clean).length >= VERTICAL_MATH_WORKING_NOTE_LIMIT) break
    if (!isVerticalMathWorkingNoteKey(key) || (allowed && !allowed.has(key))) continue
    const value = String(rawValue ?? '')
    if (!new RegExp('^\\d{1,' + VERTICAL_MATH_WORKING_NOTE_MAX_DIGITS + '}$').test(value)) continue
    clean[key] = value
  }
  return clean
}

export function createVerticalMathWorkingNotes(activityId, notes = {}, options = {}) {
  const id = String(activityId || '')
  return { activityId: id, notes: sanitizeVerticalMathWorkingNotes(notes, options) }
}

export function restoreVerticalMathWorkingNotes(snapshot, { activityId, validKeys } = {}) {
  const id = String(activityId || '')
  if (!id || !snapshot || typeof snapshot !== 'object' || String(snapshot.activityId || '') !== id) {
    return createVerticalMathWorkingNotes(id)
  }
  return createVerticalMathWorkingNotes(id, snapshot.notes, { validKeys })
}

export function updateVerticalMathWorkingNote(notes, key, value, { validKeys } = {}) {
  const allowed = validKeys ? new Set(validKeys) : null
  if (!isVerticalMathWorkingNoteKey(key) || (allowed && !allowed.has(key))) return sanitizeVerticalMathWorkingNotes(notes, { validKeys })
  const nextValue = String(value ?? '')
  if (!new RegExp('^\\d{0,' + VERTICAL_MATH_WORKING_NOTE_MAX_DIGITS + '}$').test(nextValue)) {
    return sanitizeVerticalMathWorkingNotes(notes, { validKeys })
  }
  const next = sanitizeVerticalMathWorkingNotes(notes, { validKeys })
  if (!nextValue) delete next[key]
  else if (Object.hasOwn(next, key) || Object.keys(next).length < VERTICAL_MATH_WORKING_NOTE_LIMIT) next[key] = nextValue
  return next
}
