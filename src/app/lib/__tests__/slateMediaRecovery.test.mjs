import assert from 'node:assert/strict'
import test from 'node:test'
import { startSlateVideoDuringSpeech, requestSlateSpeechSource } from '../slateMediaRecovery.mjs'
import { playSlateSpeechUntilEnd } from '../slateSpeechPlayback.mjs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class FakeVideo extends EventTarget {
  paused = true
  ended = false
  loop = true
  readyState = 0
  currentTime = 0
  starts = 0
  reloads = 0

  play() {
    this.starts += 1
    // Simulate a cold-start block that leaves the video paused.
    if (this.starts === 1) return Promise.reject(new Error('not ready'))
    this.paused = false
    return Promise.resolve()
  }

  pause() { this.paused = true }
  load() { this.reloads += 1 }
}

class FakeAudio extends EventTarget {
  currentTime = 0
  paused = true
  pauses = 0

  play() {
    this.paused = false
    return Promise.resolve()
  }

  pause() {
    this.paused = true
    this.pauses += 1
    this.dispatchEvent(new Event('pause'))
  }
}

test('cold video retries after the first failed play and stops at speech end', async () => {
  const video = new FakeVideo()
  const stop = startSlateVideoDuringSpeech(video, { checkIntervalMs: 10, stallTimeoutMs: 70 })
  await sleep(35)
  assert.ok(video.starts >= 2, 'video should retry without a page refresh')
  stop()
  const count = video.starts
  await sleep(40)
  assert.equal(video.starts, count, 'no retries after speech is finished')
  assert.equal(video.paused, true)
})

test('stalled video recovers a bounded number of times', async () => {
  const video = new FakeVideo()
  const stop = startSlateVideoDuringSpeech(video, { checkIntervalMs: 10, stallTimeoutMs: 20, maxAttempts: 3 })
  await sleep(110)
  stop()
  assert.equal(video.starts, 3, 'video retries stop after the per-stall limit')
  assert.equal(video.reloads, 1, 'a single later retry refreshes the media')
})

test('speech that never starts times out and releases the lesson', async () => {
  const audio = new FakeAudio()
  audio.play = () => new Promise(() => {})
  const reason = await playSlateSpeechUntilEnd(audio, {
    startTimeoutMs: 25, stallTimeoutMs: 25, checkIntervalMs: 5,
  })
  assert.equal(reason, 'stalled')
  assert.equal(audio.pauses, 1)
})

test('speech that starts but stops advancing is released', async () => {
  const audio = new FakeAudio()
  const reason = await playSlateSpeechUntilEnd(audio, {
    startTimeoutMs: 100, stallTimeoutMs: 25, checkIntervalMs: 5,
  })
  assert.equal(reason, 'stalled')
  assert.equal(audio.pauses, 1)
})

test('normal audio completion does not trigger late recovery', async () => {
  const audio = new FakeAudio()
  const result = playSlateSpeechUntilEnd(audio, {
    startTimeoutMs: 20, stallTimeoutMs: 20, checkIntervalMs: 5,
  })
  audio.dispatchEvent(new Event('ended'))
  assert.equal(await result, 'ended')
  await sleep(30)
  assert.equal(audio.pauses, 0)
})

test('TTS request returns a ready-to-replay source without changing the lesson', async () => {
  const source = await requestSlateSpeechSource('/api/slate-tts', 'Hello', {
    fetcher: async (_url, request) => {
      assert.equal(request.method, 'POST')
      assert.equal(JSON.parse(request.body).text, 'Hello')
      return { ok: true, json: async () => ({ audio: 'AQID' }) }
    },
  })
  assert.equal(source, 'data:audio/mp3;base64,AQID')
})

test('a hung TTS request is bounded even when the transport does not resolve', async () => {
  const fetcher = (_url, request) => new Promise((_, reject) => {
    request.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
  await assert.rejects(
    requestSlateSpeechSource('/api/slate-tts', 'Hello', { fetcher, timeoutMs: 20 }),
    /tts_timeout|aborted/,
  )
})


test('audio buffering past the normal start threshold is not cancelled before it becomes playable', async () => {
  const audio = new FakeAudio()
  audio.networkState = 2
  audio.readyState = 0
  let cancelled = false
  audio.play = () => new Promise((resolve, reject) => {
    setTimeout(() => {
      if (cancelled) { reject(new Error('interrupted by premature timeout')); return }
      audio.readyState = 3
      audio.paused = false
      audio.dispatchEvent(new Event('playing'))
      resolve()
    }, 70)
  })
  audio.pause = () => { cancelled = true; audio.paused = true; audio.pauses += 1; audio.dispatchEvent(new Event('pause')) }
  const playing = playSlateSpeechUntilEnd(audio, {
    startTimeoutMs: 20, bufferingTimeoutMs: 150, stallTimeoutMs: 100, checkIntervalMs: 5,
  })
  await sleep(85)
  assert.equal(cancelled, false, 'buffering audio must not be paused before it can start')
  audio.dispatchEvent(new Event('ended'))
  assert.equal(await playing, 'ended')
})

test('autoplay rejection is recovered on the next real learner gesture with no new TTS fetch', async () => {
  const gestureTarget = new EventTarget()
  const audio = new FakeAudio()
  let plays = 0
  audio.play = () => {
    plays += 1
    if (plays === 1) {
      return Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }))
    }
    audio.paused = false
    audio.dispatchEvent(new Event('playing'))
    return Promise.resolve()
  }
  const playing = playSlateSpeechUntilEnd(audio, {
    gestureTarget, startTimeoutMs: 100, stallTimeoutMs: 100, checkIntervalMs: 5,
  })
  await sleep(5)
  gestureTarget.dispatchEvent(new Event('pointerdown'))
  await sleep(5)
  audio.dispatchEvent(new Event('ended'))
  assert.equal(await playing, 'ended')
  assert.equal(plays, 2)
})

test('transient TTS timeout is retried with the same text instead of losing speech', async () => {
  let calls = 0
  const src = await requestSlateSpeechSource('/api/slate-tts', 'Try again', {
    timeoutMs: 20, retryDelayMs: 1, maxAttempts: 2,
    fetcher: (_url, request) => {
      calls += 1
      if (calls === 1) return new Promise((_, reject) => {
        request.signal.addEventListener('abort', () => reject(new Error('timed out')), { once: true })
      })
      return Promise.resolve({ ok: true, json: async () => ({ audio: 'AQID' }) })
    },
  })
  assert.equal(src, 'data:audio/mp3;base64,AQID')
  assert.equal(calls, 2)
})


test('an interrupted first play is retried once its existing audio source becomes ready', async () => {
  const audio = new FakeAudio()
  audio.readyState = 0
  let attempts = 0
  audio.play = () => {
    attempts += 1
    if (attempts === 1) {
      return Promise.reject(Object.assign(new Error('loading interrupted'), { name: 'AbortError' }))
    }
    audio.paused = false
    audio.dispatchEvent(new Event('playing'))
    return Promise.resolve()
  }
  const pending = playSlateSpeechUntilEnd(audio, {
    startTimeoutMs: 100, stallTimeoutMs: 100, checkIntervalMs: 5,
  })
  await sleep(5)
  audio.readyState = 3
  audio.dispatchEvent(new Event('canplay'))
  await sleep(5)
  audio.dispatchEvent(new Event('ended'))
  assert.equal(await pending, 'ended')
  assert.equal(attempts, 2)
})
