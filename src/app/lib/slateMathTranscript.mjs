function entered(entries, id) {
  return Object.prototype.hasOwnProperty.call(entries, id)
}

function rowValue(row, entries) {
  const cells = row?.cells?.filter((cell) => entered(entries, cell.id)) || []
  if (!cells.length) return null

  const ordered = [...cells].sort((left, right) => left.slot - right.slot).reverse()
  const digits = ordered.map((cell) => String(entries[cell.id])).join('')
  const decimalEntry = entries[row.id + '.decimal']
  if (decimalEntry !== undefined) {
    const fractionLength = Number(decimalEntry)
    if (Number.isInteger(fractionLength) && fractionLength > 0 && fractionLength < digits.length) {
      return digits.slice(0, -fractionLength) + '.' + digits.slice(-fractionLength)
    }
  }

  const decimalIndex = ordered.findIndex((cell) => cell.place < 0)
  return decimalIndex > 0
    ? digits.slice(0, decimalIndex) + '.' + digits.slice(decimalIndex)
    : digits
}

function friendlyLocation(problem, id) {
  if (id === 'operator') return 'operator'
  if (id.endsWith('.decimal')) return id.startsWith('result.') ? 'result decimal placement' : 'decimal placement'
  const cell = problem?.cellsById?.[id]
  if (cell) {
    const row = [problem.resultRow, problem.remainderRow, ...(problem.workRows || []), ...(problem.rows || [])]
      .find((candidate) => candidate?.id === cell.row)
    const rowLabel = cell.row === 'result' ? 'result' : (cell.row === 'remainder' ? 'remainder' : (row?.label || cell.role || 'work'))
    const place = id.slice(id.lastIndexOf('.') + 1).replaceAll('_', ' ')
    return `${rowLabel} ${place}`
  }
  return id.split('.').map((part) => part.replaceAll('_', ' ')).join(' ')
}

/** Formats only learner-entered math evidence; it never substitutes solved values. */
export function formatSlateMathTranscript(problem, rawEntries) {
  const entries = rawEntries && typeof rawEntries === 'object' ? rawEntries : {}
  const answerRows = Array.isArray(problem?.answerRows) && problem.answerRows.length
    ? problem.answerRows
    : [problem?.resultRow].filter(Boolean)
  const completeAnswers = answerRows.length > 0 && answerRows.every((row) =>
    row.cells.filter((cell) => cell.value !== null).every((cell) => entered(entries, cell.id)))

  if (completeAnswers) {
    const values = answerRows.map((row) => rowValue(row, entries))
    return problem?.operation === 'division'
      ? `Quotient: ${values[0]}, remainder: ${values[1]}`
      : values[0]
  }

  const descriptions = Object.entries(entries).map(([id, value]) =>
    `${friendlyLocation(problem, id)}: ${String(value)}`)
  return descriptions.length ? descriptions.join('; ') : 'No math entries'
}
