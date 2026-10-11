import { createVerticalMathView, evaluateVerticalMath } from './verticalMath.mjs'

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

function answerRowsOf(problem) {
  return Array.isArray(problem.answerRows) && problem.answerRows.length
    ? problem.answerRows
    : [problem.resultRow]
}

function presentation(view) {
  return {
    hidden: [...view.hidden],
    editable: [...view.editable],
    highlighted: [...view.highlighted],
  }
}

export function isDefaultMathTestView(problem, view) {
  if (!view || !Array.isArray(view.hidden) || !Array.isArray(view.editable) ||
      !Array.isArray(view.highlighted) || !view.entries || typeof view.entries !== 'object') return false
  return same(presentation(view), presentation(createVerticalMathView(problem)))
}

export function mathTestEnteredIds(problem, view) {
  const defaults = createVerticalMathView(problem)
  return defaults.editable.filter((id) => own(view.entries, id))
}

function incomplete(checked, missingLocations, reason) {
  return {
    complete: false,
    correct: false,
    checked,
    responseRequired: true,
    missingLocations,
    incorrectLocations: [],
    gradable: true,
    status: 'incomplete',
    validation: { ok: true, status: 'incomplete', reason },
  }
}

/**
 * Test readiness is based only on learner-entered place-value digits. Exact
 * grading happens on a private copy whose omitted numeric padding is zeroed.
 */
export function evaluateMathTestAnswer(problem, view) {
  if (!isDefaultMathTestView(problem, view)) {
    return {
      complete: false,
      correct: false,
      checked: 0,
      responseRequired: true,
      missingLocations: [],
      incorrectLocations: [],
      gradable: false,
      status: 'invalid_presentation',
      validation: { ok: false, status: 'invalid_presentation', reason: 'Test answers require the default presentation.' },
    }
  }

  const rows = answerRowsOf(problem)
  const enteredIds = mathTestEnteredIds(problem, view)
  const entered = new Set(enteredIds)
  const missingLocations = []

  for (const row of rows) {
    const cells = row.cells.filter((cell) => Number.isInteger(cell.place) && view.editable.includes(cell.id))
    const supplied = cells.filter((cell) => entered.has(cell.id))
    if (supplied.length === 0) {
      missingLocations.push(row.id)
      continue
    }

    const whole = supplied.filter((cell) => cell.place >= 0)
    const fraction = supplied.filter((cell) => cell.place < 0)
    if (whole.length > 0) {
      const highest = Math.max(...whole.map((cell) => cell.place))
      for (let place = 0; place <= highest; place++) {
        const cell = cells.find((candidate) => candidate.place === place)
        if (cell && !entered.has(cell.id)) missingLocations.push(cell.id)
      }
    }
    if (fraction.length > 0) {
      const deepest = Math.min(...fraction.map((cell) => cell.place))
      for (let place = -1; place >= deepest; place--) {
        const cell = cells.find((candidate) => candidate.place === place)
        if (cell && !entered.has(cell.id)) missingLocations.push(cell.id)
      }
    }
  }

  if (missingLocations.length > 0) {
    return incomplete(enteredIds.length, missingLocations, 'Each answer row needs contiguous entered digits.')
  }

  const gradingView = {
    ...view,
    entries: { ...view.entries },
  }
  const defaults = createVerticalMathView(problem)
  for (const row of rows) {
    const numericCells = row.cells.filter((cell) => Number.isInteger(cell.place) && defaults.editable.includes(cell.id))
    const hasWhole = numericCells.some((cell) => cell.place >= 0 && entered.has(cell.id))
    const hasFraction = numericCells.some((cell) => cell.place < 0 && entered.has(cell.id))
    for (const cell of numericCells) {
      if (!own(gradingView.entries, cell.id)) gradingView.entries[cell.id] = '0'
    }
    // A fraction-only response is read as 0.x without changing learner evidence.
    if (!hasWhole && hasFraction) {
      const ones = numericCells.find((cell) => cell.place === 0)
      if (ones) gradingView.entries[ones.id] = '0'
    }
  }

  const exact = evaluateVerticalMath(problem, gradingView)
  return {
    ...exact,
    complete: true,
    checked: enteredIds.length,
    responseRequired: true,
  }
}
