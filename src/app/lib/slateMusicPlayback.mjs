const pendingMusicStarts = new WeakSet()

function musicPlaybackFailure(error) {
  if (error?.name === 'NotAllowedError') return 'Music was blocked. Tap MUSIC to try again.'
  return 'Music could not start. Tap MUSIC to try again.'
}

/**
 * Attempt music playback and expose the result. A rejected play() is not proof
 * that music is enabled even when the UI toggle says MUSIC ON.
 */
export function startSlateMusicPlayback(audio, { ensureOutput, onStatus } = {}) {
  if (!audio || typeof audio.play !== 'function') {
    onStatus?.('Music player is unavailable.')
    return
  }
  if (pendingMusicStarts.has(audio)) return
  try { ensureOutput?.() } catch {}
  pendingMusicStarts.add(audio)

  let playback
  try {
    playback = audio.play()
  } catch (error) {
    pendingMusicStarts.delete(audio)
    onStatus?.(musicPlaybackFailure(error))
    return
  }

  Promise.resolve(playback).then(
    () => {
      pendingMusicStarts.delete(audio)
      onStatus?.('')
    },
    error => {
      pendingMusicStarts.delete(audio)
      onStatus?.(musicPlaybackFailure(error))
    },
  )
}
