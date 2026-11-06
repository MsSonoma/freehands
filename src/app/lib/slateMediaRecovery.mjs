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
  timeoutMs = 15000,
  fetcher = fetch,
} = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetcher(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    if (!response?.ok) throw new Error('tts_request_failed')
    const payload = await response.json()
    const audio = String(payload?.audio || '').trim()
    if (!audio) throw new Error('tts_empty')
    return /^(data:|blob:|https?:)/i.test(audio) ? audio : `data:audio/mp3;base64,${audio}`
  } finally {
    clearTimeout(timeout)
  }
}
