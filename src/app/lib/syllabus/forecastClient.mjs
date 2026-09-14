// Bound the complete refresh, including body reading. No educational authority is changed here.
export const FORECAST_REFRESH_TIMEOUT_MS = 65000
export async function fetchForecastJson(url, options = {}, { timeoutMs = FORECAST_REFRESH_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController()
  const parentSignal = options.signal
  let rejectCancellation
  const cancellation = new Promise((_, reject) => { rejectCancellation = reject })
  const cancel = () => {
    rejectCancellation(Object.assign(new Error('Forecast refresh cancelled'), { name: 'AbortError' }))
    controller.abort()
  }
  if (parentSignal?.aborted) cancel()
  else parentSignal?.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => {
    rejectCancellation(Object.assign(new Error('The forecast refresh timed out. Your existing lessons are unchanged. Try again.'), { name: 'TimeoutError' }))
    controller.abort()
  }, timeoutMs)
  try {
    return await Promise.race([
      cancellation,
      (async () => {
        if (controller.signal.aborted) throw Object.assign(new Error('Forecast refresh cancelled'), { name: 'AbortError' })
        const response = await fetchImpl(url, { ...options, signal: controller.signal })
        const json = await response.json()
        return { response, json }
      })(),
    ])
  } finally {
    clearTimeout(timer)
    parentSignal?.removeEventListener('abort', cancel)
  }
}
