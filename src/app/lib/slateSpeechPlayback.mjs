/**
 * Waits for HTML media playback to actually finish. play() resolves when sound
 * starts, not when it ends. An interrupted or unavailable clip settles too,
 * so the lesson cannot remain locked if speech is muted or cannot play.
 */
export function playSlateSpeechUntilEnd(audio) {
  if (!audio || typeof audio.play !== 'function' || typeof audio.addEventListener !== 'function') {
    return Promise.resolve('unavailable')
  }
  return new Promise((resolve) => {
    const events = ['ended', 'error', 'pause', 'abort']
    let finished = false
    const settle = (reason) => {
      if (finished) return
      finished = true
      for (const [type, listener] of listeners) audio.removeEventListener(type, listener)
      resolve(reason)
    }
    const listeners = events.map((type) => {
      const listener = () => settle(type)
      audio.addEventListener(type, listener)
      return [type, listener]
    })
    try {
      Promise.resolve(audio.play()).catch(() => settle('unavailable'))
    } catch {
      settle('unavailable')
    }
  })
}
