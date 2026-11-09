import { ensurePlaybackAudioSession } from '../session/utils/microphoneSession.js'

/**
 * Resolve only when a Slate speech clip ends or actually fails.
 *
 * iOS/slow connections can spend several seconds buffering after play(), so a
 * short "currentTime has not advanced" timer must not cancel a healthy load.
 * Browsers that require a gesture can retry the *same prepared clip* on the
 * learner's next interaction, without asking TTS for it again.
 */
export function playSlateSpeechUntilEnd(audio, {
  startTimeoutMs = 25000,
  bufferingTimeoutMs = 45000,
  stallTimeoutMs = 20000,
  checkIntervalMs = 500,
  gestureTarget = typeof document !== 'undefined' ? document : null,
} = {}) {
  if (!audio || typeof audio.play !== 'function' || typeof audio.addEventListener !== 'function') {
    return Promise.resolve('unavailable')
  }

  // The music may be disabled, but Slate's voice must still restore the
  // speaker route when a previous mic session has already ended.
  ensurePlaybackAudioSession()
  return new Promise((resolve) => {
    let finished = false
    let started = false
    let playPending = false
    let awaitingGesture = false
    let abortedPlayRetries = 0
    const originalSrc = audio.currentSrc || audio.src || ''
    let lastPosition = Number(audio.currentTime) || 0
    const startAt = Date.now()
    let lastProgressAt = startAt
    let watchdog = null

    const removeGestures = () => {
      gestureTarget?.removeEventListener?.('pointerdown', onGesture, true)
      gestureTarget?.removeEventListener?.('keydown', onGesture, true)
    }

    const settle = (reason) => {
      if (finished) return
      finished = true
      if (watchdog !== null) clearInterval(watchdog)
      removeGestures()
      for (const [type, listener] of listeners) audio.removeEventListener(type, listener)
      if (reason === 'stalled') {
        try { audio.pause?.() } catch {}
      }
      resolve(reason)
    }

    const markStarted = () => {
      if (finished) return
      started = true
      awaitingGesture = false
      removeGestures()
      lastProgressAt = Date.now()
    }

    const handlePlayFailure = (error) => {
      if (finished) return
      if (error?.name === 'AbortError') {
        // Safari may interrupt play() while the same source is still loading.
        // Retry that clip on canplay, but never revive a superseded source.
        if ((audio.currentSrc || audio.src || '') !== originalSrc) {
          settle('abort')
        } else if (!started && abortedPlayRetries < 2) {
          abortedPlayRetries += 1
          if (Number(audio.readyState) >= 2) Promise.resolve().then(attemptPlay)
        } else {
          settle('unavailable')
        }
        return
      }
      if (error?.name === 'NotAllowedError' && gestureTarget?.addEventListener) {
        // Browser permission cannot be manufactured by a timer or a refresh.
        // Reattempt the already-loaded speech synchronously on the next tap.
        awaitingGesture = true
        gestureTarget.addEventListener('pointerdown', onGesture, true)
        gestureTarget.addEventListener('keydown', onGesture, true)
      } else {
        settle('unavailable')
      }
    }

    const attemptPlay = () => {
      if (finished || playPending) return
      awaitingGesture = false
      removeGestures()
      playPending = true
      try {
        Promise.resolve(audio.play()).then(() => {
          playPending = false
          markStarted()
        }).catch((error) => {
          playPending = false
          handlePlayFailure(error)
        })
      } catch (error) {
        playPending = false
        handlePlayFailure(error)
      }
    }

    function onGesture() {
      if (!awaitingGesture || finished) return
      attemptPlay()
    }

    const onProgress = () => {
      if (finished) return
      const position = Number(audio.currentTime) || 0
      if (position > lastPosition + 0.01 || (started && position < lastPosition - 0.05)) {
        started = true
        lastPosition = position
        lastProgressAt = Date.now()
      }
    }

    const onReady = () => {
      // A previous play attempt may have been interrupted while media loaded.
      if (!started && !awaitingGesture && !playPending) attemptPlay()
    }

    const listeners = [
      ...['ended', 'error', 'pause', 'abort'].map((type) => {
        const listener = () => {
          // pause/abort from the previous source can arrive after a new
          // clip has already started on the reused HTMLAudioElement.
          if ((type === 'pause' || type === 'abort') && audio.paused === false) return
          if (type === 'ended' && audio.ended === false) return
          settle(type)
        }
        audio.addEventListener(type, listener)
        return [type, listener]
      }),
      ['playing', markStarted],
      ['timeupdate', onProgress],
      ['canplay', onReady],
    ]
    for (const [type, listener] of listeners.slice(4)) audio.addEventListener(type, listener)

    watchdog = setInterval(() => {
      if (finished) return
      onProgress()
      const now = Date.now()
      if (!started && now - startAt >= startTimeoutMs) {
        // Do not mistake an in-flight mobile media load for a failed clip.
        const loading = Number(audio.networkState) === 2 && Number(audio.readyState) < 2
        if (!loading || now - startAt >= bufferingTimeoutMs) settle('stalled')
      } else if (started && now - lastProgressAt >= stallTimeoutMs) {
        settle('stalled')
      }
    }, checkIntervalMs)

    attemptPlay()
  })
}
