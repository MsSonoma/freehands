/**
 * Retry a transient Mr. Slate judgment without asking the learner to resubmit.
 * Callers must save the answer before starting this request and apply its
 * returned judgment only once. Each retry uses the same serialized payload.
 */
export function isRetryableSlateJudgmentStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

export async function postSlateJudgmentWithRetry({
  url,
  body,
  isValid,
  stillCurrent = () => true,
  onRetry = () => {},
  attempts = 3,
  timeoutMs = 65000,
  retryDelayMs = 750,
  fetcher = fetch,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!url || typeof isValid !== 'function') throw new Error('Judgment request configuration is invalid.')
  const serializedBody = JSON.stringify(body)
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (!stillCurrent()) throw new Error('This answer is no longer current.')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializedBody,
        signal: controller.signal,
      })
      const result = await response.json().catch(() => null)
      if (response.ok && isValid(result)) {
        if (!stillCurrent()) throw new Error('This answer is no longer current.')
        return result
      }
      const message = !response.ok && typeof result?.error === 'string' && result.error.trim()
        ? result.error.trim()
        : 'Mr. Slate did not return a usable judgment.'
      const error = new Error(message)
      if (!response.ok && !isRetryableSlateJudgmentStatus(response.status)) {
        error.retryable = false
      }
      throw error
    } catch (error) {
      if (error?.retryable === false) throw error
      lastError = error
    } finally {
      clearTimeout(timeoutId)
    }

    if (attempt >= attempts) break
    if (!stillCurrent()) throw new Error('This answer is no longer current.')
    onRetry({ attempt, attempts })
    if (retryDelayMs > 0) await delay(retryDelayMs * attempt)
  }

  throw new Error('Mr. Slate could not finish checking the saved answer. Please try Submit again.', { cause: lastError })
}
