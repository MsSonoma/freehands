/**
 * Wait for actual HTML speech completion, not the play() promise. A blocked,
 * never-starting, or stalled clip releases the lesson instead of hanging it.
 * Calling the returned promise is safe for both automatic and tap-to-replay
 * playback; it never advances a question itself.
 */
export function playSlateSpeechUntilEnd(audio, {
  startTimeoutMs = 5000,
  stallTimeoutMs = 9000,
  checkIntervalMs = 500,
} = {}) {
  if (!audio || typeof audio.play !== 'function' || typeof audio.addEventListener !== 'function') {
    return Promise.resolve('unavailable')
  }
  return new Promise((resolve) => {
    let finished = false
    let started = false
    let lastPosition = Number(audio.currentTime) || 0
    const startAt = Date.now()
    let lastProgressAt = startAt
    let watchdog = null

    const settle = (reason) => {
      if (finished) return
      finished = true
      if (watchdog !== null) clearInterval(watchdog)
      for (const [type, listener] of listeners) audio.removeEventListener(type, listener)
      if (reason === 'stalled') {
        try { audio.pause?.() } catch {}
      }
      resolve(reason)
    }

    const listeners = ['ended', 'error', 'pause', 'abort'].map((type) => {
      const listener = () => settle(type)
      audio.addEventListener(type, listener)
      return [type, listener]
    })

    watchdog = setInterval(() => {
      if (finished) return
      const now = Date.now()
      const position = Number(audio.currentTime) || 0
      if (position > lastPosition + 0.01) {
        started = true
        lastPosition = position
        lastProgressAt = now
      }
      if (!started && now - startAt >= startTimeoutMs) settle('stalled')
      else if (started && now - lastProgressAt >= stallTimeoutMs) settle('stalled')
    }, checkIntervalMs)

    try {
      Promise.resolve(audio.play()).then(() => {
        if (finished) return
        started = true
        lastProgressAt = Date.now()
      }).catch(() => settle('unavailable'))
    } catch {
      settle('unavailable')
    }
  })
}
