// Download errors may wrap an HTTP Response rather than a parsed StorageApiError.
// Only a confirmed missing OBJECT permits first-time generation.
export async function isMissingStorageObject(error) {
  const records = []
  const seen = new Set()
  const queue = [error]
  while (queue.length && records.length < 8) {
    const value = queue.shift()
    if (!value || typeof value !== 'object' || seen.has(value)) continue
    seen.add(value)
    records.push(value)
    if (typeof value.clone === 'function' && typeof value.json === 'function') {
      try { queue.push(await value.clone().json()) } catch { /* Unknown response is not absence. */ }
    }
    if (value.originalError) queue.push(value.originalError)
    if (value.cause) queue.push(value.cause)
  }
  const statuses = records.flatMap(value => [value.status, value.statusCode, value.httpStatusCode]).map(Number).filter(Number.isFinite)
  if (statuses.some(status => status === 401 || status === 403 || status === 429 || status >= 500)) return false
  const codes = records.flatMap(value => [value.code, value.error, value.statusCode])
    .filter(value => typeof value === 'string' && !/^\d+$/.test(value))
  if (codes.some(code => !['NoSuchKey', 'not_found', 'Object not found'].includes(code))) return false
  if (records.some(value => /bucket|tenant|permission|denied|unauthori[sz]ed/i.test(String(value.message || '')))) return false
  return codes.includes('NoSuchKey') || records.some(value => /^object (?:not found|does not exist)\.?$/i.test(String(value.message || '').trim()))
}
