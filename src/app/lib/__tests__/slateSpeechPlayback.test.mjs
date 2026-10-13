import assert from 'node:assert/strict'
import test from 'node:test'
import { playSlateSpeechUntilEnd } from '../slateSpeechPlayback.mjs'

class FakeAudio extends EventTarget {
  started = false
  play() {
    this.started = true
    return Promise.resolve()
  }
}

test('TTS sequencing waits for audio ended, not the play promise', async () => {
  const audio = new FakeAudio()
  let settled = ''
  const playing = playSlateSpeechUntilEnd(audio).then((value) => { settled = value })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(audio.started, true)
  assert.equal(settled, '')
  audio.dispatchEvent(new Event('ended'))
  await playing
  assert.equal(settled, 'ended')
  audio.dispatchEvent(new Event('pause'))
  assert.equal(settled, 'ended')
})

test('muting or pausing a response releases the wait without indefinite blocking', async () => {
  const audio = new FakeAudio()
  const playing = playSlateSpeechUntilEnd(audio)
  audio.dispatchEvent(new Event('pause'))
  assert.equal(await playing, 'pause')
})

test('TTS error and rejected autoplay release the wait', async () => {
  const audio = new FakeAudio()
  const playing = playSlateSpeechUntilEnd(audio)
  audio.dispatchEvent(new Event('error'))
  assert.equal(await playing, 'error')
  const blocked = new FakeAudio()
  blocked.play = () => Promise.reject(new Error('autoplay blocked'))
  assert.equal(await playSlateSpeechUntilEnd(blocked), 'unavailable')
})

test('missing player does not block question availability', async () => {
  assert.equal(await playSlateSpeechUntilEnd(null), 'unavailable')
})
