/**
 * Keep Mr. Slate's muted looping video moving while a speech clip is active.
 * Some browsers accept play() before a video is ready, then leave it paused or
 * stalled. Retries are bounded per stall and stopped with the speech clip.
 */
export function startSlateVideoDuringSpeech(video, {
  checkIntervalMs = 600,
  stallTimeoutMs = 1800,
  maxAttempts = 4,
} = {}) {
  if (!video || typeof video.play !== 'function') return () => {}

  let active = true
  let attempts = 0
  let lastAttemptAt = -Infinity
  let lastProgressAt = Date.now()
  let lastPosition = Number(video.currentTime) || 0
  let reloaded = false

  const attempt = (restart = false) => {
    if (!active || attempts >= maxAttempts) return
    const now = Date.now()
    if (now - lastAttemptAt < checkIntervalMs / 2) return
    lastAttemptAt = now
    attempts += 1
    try {
      if (restart && !video.paused) video.pause()
      if (video.ended) video.currentTime = 0
      // Reload only after initial attempts fail; avoid disrupting a healthy loop.
      if (attempts === 3 && !reloaded && typeof video.load === 'function') {
        reloaded = true
        video.load()
      }
      const playback = video.play()
      if (playback && typeof playback.catch === 'function') playback.catch(() => {})
    } catch {
      // The bounded watchdog, or the next readiness event, retries.
    }
  }

  const check = () => {
    if (!active) return
    const current = Number(video.currentTime) || 0
    if (current > lastPosition + 0.02 || (video.loop && current < lastPosition - 0.02)) {
      lastProgressAt = Date.now()
      lastPosition = current
      attempts = 0
      reloaded = false
    }
    if (video.paused || Date.now() - lastProgressAt >= stallTimeoutMs) {
      attempt(!video.paused)
    }
  }

  const onReady = () => { if (video.paused) attempt() }
  video.addEventListener?.('loadeddata', onReady)
  video.addEventListener?.('canplay', onReady)
  video.addEventListener?.('waiting', check)
  video.addEventListener?.('stalled', check)

  // Try synchronously as well: an initiating tap may still count as a gesture.
  attempt()
  const watchdog = setInterval(check, checkIntervalMs)

  return () => {
    if (!active) return
    active = false
    clearInterval(watchdog)
    video.removeEventListener?.('loadeddata', onReady)
    video.removeEventListener?.('canplay', onReady)
    video.removeEventListener?.('waiting', check)
    video.removeEventListener?.('stalled', check)
    try { video.pause() } catch {}
  }
}

/**
 * Bound the TTS request as well as local playback. A fetch hanging before an
 * audio source arrives must surface a retry instead of silently waiting.
 */
export async function requestSlateSpeechSource(ttsUrl, text, {
  timeoutMs = 30000,
  maxAttempts = 2,
  retryDelayMs = 350,
  fetcher = fetch,
} = {}) {
  const totalAttempts = Math.max(1, Math.floor(Number(maxAttempts) || 1))
  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const controller = new AbortController()
    let timeout = null
    const expires = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort()
        reject(new Error('tts_timeout'))
      }, timeoutMs)
    })
    try {
      // Race the request and its JSON body against the same deadline. Some
      // mobile fetch implementations do not reject when abort() is called.
      const response = await Promise.race([
        Promise.resolve().then(() => fetcher(ttsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        })),
        expires,
      ])
      if (!response?.ok) {
        const failure = new Error('tts_request_failed')
        failure.retryable = !response?.status || response.status === 408 ||
          response.status === 429 || response.status >= 500
        throw failure
      }
      const payload = await Promise.race([response.json(), expires])
      const audio = String(payload?.audio || '').trim()
      if (!audio) throw new Error('tts_empty')
      return /^(data:|blob:|https?:)/i.test(audio) ? audio : 'data:audio/mp3;base64,' + audio
    } catch (error) {
      if (attempt + 1 >= totalAttempts || error?.retryable === false) throw error
    } finally {
      if (timeout !== null) clearTimeout(timeout)
    }
    if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
  }
  throw new Error('tts_unavailable')
}
