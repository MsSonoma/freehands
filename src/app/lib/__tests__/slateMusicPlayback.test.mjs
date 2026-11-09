import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { startSlateMusicPlayback } from '../slateMusicPlayback.mjs'

test('music starts and clears previous failure when output succeeds', async () => {
  let routeEnsured = 0
  const messages = []
  const music = { play: () => Promise.resolve() }
  startSlateMusicPlayback(music, {
    ensureOutput: () => { routeEnsured += 1 },
    onStatus: message => messages.push(message),
  })
  await Promise.resolve()
  assert.equal(routeEnsured, 1)
  assert.deepEqual(messages, [''])
})

test('music playback rejection is visible and the same clip can retry', async () => {
  let plays = 0
  const music = { play: () => {
    plays += 1
    if (plays === 1) {
      return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }))
    }
    return Promise.resolve()
  } }
  const messages = []
  const onStatus = message => messages.push(message)
  startSlateMusicPlayback(music, { onStatus })
  await Promise.resolve()
  await Promise.resolve()
  assert.match(messages[0], /Music was blocked/)
  startSlateMusicPlayback(music, { onStatus })
  await Promise.resolve()
  assert.equal(plays, 2)
  assert.equal(messages.at(-1), '')
})

test('music player handles synchronous failure rather than swallowing it', () => {
  const messages = []
  startSlateMusicPlayback({ play() { throw new Error('bad state') } }, {
    onStatus: message => messages.push(message),
  })
  assert.match(messages[0], /could not start/)
})

test('music does not issue overlapping play calls while waiting to start', async () => {
  let resolve
  const delay = new Promise(done => { resolve = done })
  let plays = 0
  const music = { play() { plays += 1; return delay } }
  startSlateMusicPlayback(music)
  startSlateMusicPlayback(music)
  assert.equal(plays, 1)
  resolve()
  await Promise.resolve()
  startSlateMusicPlayback(music)
  assert.equal(plays, 2)
})


test('both Slate music views report playback failures instead of swallowing them', () => {
  const drill = readFileSync('src/app/session/slate/page.jsx', 'utf8')
  const liftoff = readFileSync('src/app/session/slate/SlateLiftoffExperience.jsx', 'utf8')
  assert.match(drill, /startSlateMusicPlayback\(audio/)
  assert.match(liftoff, /startSlateMusicPlayback\(audio/)
  assert.match(drill, /slateMusicPlaybackError && <span role="status"/)
  assert.match(liftoff, /musicPlaybackError && <span role="status"/)
  assert.match(drill, /ensureOutput: ensurePlaybackAudioSession/)
  assert.match(liftoff, /ensureOutput: ensurePlaybackAudioSession/)
})
