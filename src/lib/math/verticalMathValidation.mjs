const OPERATORS = ['+', '-', '\u00d7']

const result = (ok, status, reason, examined) => ({ ok, status, reason, examined })

function hiddenSet(view) {
  return new Set(Array.isArray(view?.hidden) ? view.hidden : [])
}

function editableTargets(problem, view) {
  const cellIds = problem?.cellsById || {}
  const answerRows = Array.isArray(problem?.answerRows) && problem.answerRows.length
    ? problem.answerRows
    : (problem?.resultRow ? [problem.resultRow] : [])
  const symbolIds = new Set(problem?.operation === 'division' ? [] : [
    'operator',
    ...(problem?.rows || []).map((row) => row.id + '.decimal'),
    ...answerRows.map((row) => row.id + '.decimal'),
  ])
  return (Array.isArray(view?.editable) ? view.editable : [])
    .filter((id) => Boolean(cellIds[id]) || symbolIds.has(id))
}

function onesSlot(row) {
  return row.cells.find((cell) => cell.place === 0)?.slot
}

function pow10(exponent) {
  return 10n ** BigInt(exponent)
}

function gcd(left, right) {
  let a = left < 0n ? -left : left
  let b = right < 0n ? -right : right
  while (b) [a, b] = [b, a % b]
  return a
}

function fraction(numerator, denominator = 1n) {
  if (denominator < 0n) {
    numerator = -numerator
    denominator = -denominator
  }
  const divisor = gcd(numerator, denominator) || 1n
  return { numerator: numerator / divisor, denominator: denominator / divisor }
}

function add(left, right) {
  return fraction(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  )
}

function subtract(left, right) {
  return fraction(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  )
}

function multiply(left, right) {
  return fraction(left.numerator * right.numerator, left.denominator * right.denominator)
}

function arithmetic(operator, operands) {
  if (!operands.length) return null
  if (operator === '+') return operands.reduce(add, fraction(0n))
  if (operator === '-') return operands.slice(1).reduce(subtract, operands[0])
  if (operator === '\u00d7') return operands.reduce(multiply, fraction(1n))
  return null
}

function coefficientOf(digits) {
  return BigInt(digits.join('') || '0')
}

function scaledResult(value, decimalBoundary, width) {
  if (value.numerator < 0n) return null
  const scaledNumerator = value.numerator * pow10(decimalBoundary)
  if (scaledNumerator % value.denominator !== 0n) return null
  const coefficient = scaledNumerator / value.denominator
  const text = coefficient.toString()
  if (text.length > width) return null
  return { coefficient, digits: text.padStart(width, '0').split('') }
}

function visibleResultMatches(row, digits, hidden) {
  return row.cells.every((cell, index) => {
    if (hidden.has(cell.id)) return true
    return digits[index] === (cell.value === null ? '0' : String(cell.value))
  })
}

function multiplyWithinBudget(current, factor, maximum) {
  if (!Number.isSafeInteger(factor) || factor < 1) return maximum + 1
  if (current > Math.floor(maximum / factor)) return maximum + 1
  return current * factor
}

function sourceHasUnknowns(problem, hidden) {
  if (hidden.has('operator')) return true
  return problem.rows.some((row) =>
    hidden.has(row.id + '.decimal') ||
    row.cells.some((cell) => cell.value !== null && hidden.has(cell.id)),
  )
}

function workNeedsProof(problem, view, hidden) {
  const editable = new Set(Array.isArray(view?.editable) ? view.editable : [])
  return (problem.workRows || []).some((row) => row.cells.some((cell) =>
    editable.has(cell.id) || (cell.value !== null && !hidden.has(cell.id)),
  ))
}

/**
 * Conservatively proves whether the public exercise has exactly one completion.
 * Solved hidden values and learner entries are intentionally never used as givens.
 */
export function validateVerticalMathExercise(problem, view, { maxCandidates = 10000 } = {}) {
  if (!Number.isSafeInteger(maxCandidates) || maxCandidates < 1) {
    return result(false, 'unverified', 'The uniqueness search budget is invalid.', 0)
  }
  if (!problem || !Array.isArray(problem.rows) || !problem.resultRow || !problem.cellsById || !view) {
    return result(false, 'unverified', 'The exercise structure could not be verified.', 0)
  }

  const targets = editableTargets(problem, view)
  if (targets.length === 0) {
    return result(true, 'no_response', 'This presentation does not request a learner response.', 0)
  }

  const hidden = hiddenSet(view)
  const answerRows = Array.isArray(problem.answerRows) && problem.answerRows.length
    ? problem.answerRows
    : [problem.resultRow]
  const allRows = [...problem.rows, ...answerRows]
  if (allRows.some((row) => !Array.isArray(row.cells) || row.cells.length === 0 || !Number.isInteger(onesSlot(row)))) {
    return result(false, 'unverified', 'The exercise has invalid decimal geometry.', 0)
  }

  if (problem.operation === 'division') {
    const decimalTargets = [
      ...problem.rows.map((row) => row.id + '.decimal'),
      ...answerRows.map((row) => row.id + '.decimal'),
    ]
    const concealedSource = hidden.has('operator') ||
      decimalTargets.some((id) => hidden.has(id)) ||
      problem.rows.some((row) => row.cells.some((cell) => cell.value !== null && hidden.has(cell.id)))
    const validOperands = problem.operator === '\u00f7' && problem.rows.length === 2 &&
      Array.isArray(problem.operands) && problem.operands.length === 2 &&
      problem.operands.every((operand) => /^(?:0|[1-9]\d*)$/.test(operand)) &&
      problem.operands[1] !== '0' && answerRows.length === 2 &&
      answerRows.includes(problem.resultRow)
    if (concealedSource || !validOperands) {
      return result(false, 'unverified', 'Whole-number division cannot be verified while a source value or unsupported symbol target is concealed.', 0)
    }
    return result(true, 'unique', 'The visible dividend and divisor determine the quotient, remainder, and requested work.', 1)
  }

  const operandsKnown = problem.rows.every((row) =>
    !hidden.has(row.id + '.decimal') &&
    row.cells.every((cell) => cell.value === null || !hidden.has(cell.id)),
  )
  if (operandsKnown && !hidden.has('operator') && !hidden.has(problem.resultRow.id + '.decimal')) {
    return result(true, 'unique', 'The visible givens determine one completion.', 1)
  }

  if (sourceHasUnknowns(problem, hidden) && workNeedsProof(problem, view, hidden)) {
    return result(false, 'unverified', 'Visible or required work cannot be safely checked while a source value is concealed.', 0)
  }

  const variables = []
  const rowDigits = new Map()
  const rowBoundaries = new Map()
  let domainSize = 1

  for (const row of problem.rows) {
    const digits = row.cells.map((cell) => cell.value === null ? '0' : String(cell.value))
    rowDigits.set(row.id, digits)
    row.cells.forEach((cell, index) => {
      // Null cells are structural padding, not extra secret digits.
      if (cell.value !== null && hidden.has(cell.id)) {
        variables.push({ kind: 'digit', rowId: row.id, index, values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] })
        domainSize = multiplyWithinBudget(domainSize, 10, maxCandidates)
      }
    })
    if (hidden.has(row.id + '.decimal')) {
      const values = Array.from({ length: row.cells.length }, (_, index) => index)
      variables.push({ kind: 'decimal', rowId: row.id, values })
      domainSize = multiplyWithinBudget(domainSize, values.length, maxCandidates)
    } else {
      rowBoundaries.set(row.id, onesSlot(row))
    }
  }

  let operator = problem.operator === '*' ? '\u00d7' : problem.operator
  if (hidden.has('operator')) {
    variables.push({ kind: 'operator', values: OPERATORS })
    domainSize = multiplyWithinBudget(domainSize, OPERATORS.length, maxCandidates)
  }

  const resultBoundaryId = problem.resultRow.id + '.decimal'
  let fixedResultBoundary = onesSlot(problem.resultRow)
  if (hidden.has(resultBoundaryId)) {
    const values = Array.from({ length: problem.resultRow.cells.length }, (_, index) => index)
    variables.push({ kind: 'result_decimal', values })
    domainSize = multiplyWithinBudget(domainSize, values.length, maxCandidates)
  }

  if (domainSize > maxCandidates) {
    return result(false, 'unverified', 'The concealed-value search exceeds the uniqueness budget.', 0)
  }

  let examined = 0
  const completions = new Set()

  function visit(variableIndex) {
    if (completions.size > 1) return
    if (variableIndex < variables.length) {
      const variable = variables[variableIndex]
      for (const value of variable.values) {
        if (variable.kind === 'digit') rowDigits.get(variable.rowId)[variable.index] = value
        else if (variable.kind === 'decimal') rowBoundaries.set(variable.rowId, value)
        else if (variable.kind === 'operator') operator = value
        else fixedResultBoundary = value
        visit(variableIndex + 1)
        if (completions.size > 1) return
      }
      return
    }

    examined++
    const operands = problem.rows.map((row) =>
      fraction(coefficientOf(rowDigits.get(row.id)), pow10(rowBoundaries.get(row.id))),
    )
    const value = arithmetic(operator, operands)
    if (!value || value.numerator < 0n) return
    const rendered = scaledResult(value, fixedResultBoundary, problem.resultRow.cells.length)
    if (!rendered || !visibleResultMatches(problem.resultRow, rendered.digits, hidden)) return

    const operandKey = problem.rows.map((row) =>
      coefficientOf(rowDigits.get(row.id)).toString() + '@' + rowBoundaries.get(row.id),
    ).join(',')
    completions.add(operator + '|' + operandKey + '|' + rendered.coefficient + '@' + fixedResultBoundary)
  }

  visit(0)
  if (completions.size > 1) {
    return result(false, 'ambiguous', 'The visible exercise has more than one valid completion.', examined)
  }
  if (completions.size === 0) {
    return result(false, 'unverified', 'No valid completion satisfies all visible constraints.', examined)
  }
  return result(true, 'unique', 'The visible givens determine one completion.', examined)
}
