const has = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key)

function answerRows(problem) {
  return Array.isArray(problem?.answerRows) && problem.answerRows.length
    ? problem.answerRows
    : [problem?.resultRow].filter(Boolean)
}

function visibleDigit(cell, view) {
  if (!Number.isInteger(cell?.place)) return null
  const entered = view?.entries || {}
  if (view?.editable?.includes(cell.id) && has(entered, cell.id)) return String(entered[cell.id])
  if (!view?.hidden?.includes(cell.id) && cell.value !== null && cell.value !== undefined) return String(cell.value)
  return null
}

/**
 * Reads only what the learner entered or the grid already visibly provided.
 * Never solves a problem or reads a concealed answer-key cell. Partial answers
 * without contiguous digits are not transferable.
 */
export function slateMathWorkspaceResult(problem, view) {
  if (!problem || !view) return ''
  const rows = answerRows(problem)
  if (!rows.length) return ''
  const values = []
  for (const row of rows) {
    const places = new Map()
    let hasLearnerEntry = false
    for (const cell of row?.cells || []) {
      const value = visibleDigit(cell, view)
      if (value === null || !/^\d$/.test(value)) continue
      if (view.editable?.includes(cell.id) && has(view.entries, cell.id)) hasLearnerEntry = true
      places.set(cell.place, value)
    }
    if (!hasLearnerEntry) return ''
    const whole = [...places.keys()].filter((place) => place >= 0)
    const fractions = [...places.keys()].filter((place) => place < 0)
    const highest = whole.length ? Math.max(...whole) : 0
    let integer = ''
    for (let place = highest; place >= 0; place--) {
      if (!places.has(place) && whole.length) return ''
      integer += places.get(place) || '0'
    }
    let fraction = ''
    if (fractions.length) {
      const lowest = Math.min(...fractions)
      for (let place = -1; place >= lowest; place--) {
        if (!places.has(place)) return ''
        fraction += places.get(place)
      }
    }
    values.push((integer.replace(/^0+(?=\d)/, '') || '0') + (fraction ? '.' + fraction : ''))
  }
  return problem.operation === 'division' ? values.join(' r ') : values[0]
}

/** Keeps the learner's own explanation intact, including on repeat clicks. */
export function insertSlateMathResult(current, result) {
  const value = String(result || '').trim()
  const existing = String(current || '')
  if (!value) return existing
  if (existing.split(/\r?\n/).some((line) => line.trim() === value)) return existing
  return existing.trim() ? existing.trimEnd() + '\n' + value : value
}
