function dateOnly(value) { return String(value || '').slice(0, 10) }

export function noSchoolDateSet(rows = []) {
  return new Set((rows || []).map((row) => dateOnly(typeof row === 'string' ? row : row?.date)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))
}

export function noSchoolReasonMap(rows = []) {
  const result = {}
  for (const row of rows || []) {
    const date = dateOnly(typeof row === 'string' ? row : row?.date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    result[date] = String(typeof row === 'string' ? '' : row?.reason || '').trim()
  }
  return result
}

export function isNoSchoolDate(rows = [], date) {
  return noSchoolDateSet(rows).has(dateOnly(date))
}
