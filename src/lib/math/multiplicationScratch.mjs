/**
 * Scratch-only writable partial products. Multiplication already creates one
 * partial row per multiplier digit; never expose its solved digit values.
 * The trailing zero(s) caused by place shift are visible fixed placeholders.
 * Entered partial digits remain separate from canonical MathSession state.
 */
export function multiplicationScratchSlotIds(problem) {
  if (problem?.operation !== 'multiplication' || !Array.isArray(problem.partialRows)) return []
  return problem.partialRows.flatMap((row) =>
    (row.cells || []).filter((cell) =>
      cell.value !== null && !multiplicationScratchIsShiftZero(row, cell),
    ).map((cell) => cell.id))
}

export function multiplicationScratchIsShiftZero(row, cell) {
  return row?.role === 'partial_product' &&
    Number.isInteger(row.rowIndex) &&
    Number.isInteger(cell?.place) &&
    cell.place < row.rowIndex - 1 && cell.value === '0'
}

/** Only digits typed by the learner, never a generated partial-product answer. */
export function sanitizeMultiplicationScratchEntries(problem, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const allowed = new Set(multiplicationScratchSlotIds(problem))
  const clean = {}
  for (const [id, value] of Object.entries(raw)) {
    if (Object.keys(clean).length >= 350) break
    if (allowed.has(id) && typeof value === 'string' && /^\d$/.test(value)) {
      clean[id] = value
    }
  }
  return clean
}

export function updateMultiplicationScratchEntry(problem, current, location, value) {
  if (!multiplicationScratchSlotIds(problem).includes(location)) return null
  if (typeof value !== 'string' || !/^\d?$/.test(value)) return null
  const next = sanitizeMultiplicationScratchEntries(problem, current)
  if (value) next[location] = value
  else delete next[location]
  return next
}
