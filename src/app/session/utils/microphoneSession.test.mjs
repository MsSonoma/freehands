import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const moduleUrl = new URL('./microphoneSession.js', import.meta.url)

async function setup(t, getUserMedia) {
  const original = Object.fromEntries(
    ['navigator', 'window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  )
  t.after(() => {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })

  let type = 'auto'
  const types = []
  const audioSession = {
    get type() { return type },
    set type(next) { types.push(next); type = next },
  }
  const stored = new Map()
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { audioSession, mediaDevices: { getUserMedia } },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { addEventListener() {} },
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { setItem: (key, value) => stored.set(key, value) },
  })

  const mic = await import(`${moduleUrl.href}?case=${Math.random()}`)
  return { mic, audioSession, types, stored }
}

function fakeStream() {
  let stops = 0
  const track = {
    readyState: 'live',
    enabled: true,
    stop() { stops += 1; this.readyState = 'ended' },
  }
  return {
    track,
    get stops() { return stops },
    getAudioTracks: () => [track],
    getTracks: () => [track],
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}

test('microphone capture explicitly transitions to playback after the last track stops', async t => {
  const stream = fakeStream()
  const { mic, audioSession, types, stored } = await setup(t, () => Promise.resolve(stream))
  const acquired = await mic.getReusableMicrophoneStream()
  assert.equal(acquired, stream)
  assert.equal(audioSession.type, 'play-and-record')
  assert.deepEqual(types, ['play-and-record'])
  assert.equal(mic.isMicrophoneCapturing(), true)
  assert.equal(stored.get('ms_micAllowed'), 'true')

  mic.pauseReusableMicrophoneStream(stream)
  assert.equal(stream.stops, 1)
  assert.equal(mic.isMicrophoneCapturing(), false)
  assert.equal(audioSession.type, 'playback')
  mic.pauseReusableMicrophoneStream(stream)
  assert.equal(audioSession.type, 'playback')
})

test('simultaneous microphone requests never assign two recorders to the same track', async t => {
  const permission = deferred()
  const stream = fakeStream()
  let requests = 0
  const { mic } = await setup(t, () => { requests += 1; return permission.promise })
  const first = mic.getReusableMicrophoneStream()
  const second = mic.getReusableMicrophoneStream()
  permission.resolve(stream)
  const outcomes = await Promise.allSettled([first, second])
  assert.equal(requests, 1)
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1)
  assert.match(outcomes.find(result => result.status === 'rejected').reason.message, /already in use/)
  mic.pauseReusableMicrophoneStream(stream)
})

test('late permission grant after page release stops the track and cannot revive recording', async t => {
  const permission = deferred()
  const stream = fakeStream()
  const { mic, audioSession } = await setup(t, () => permission.promise)
  const pending = mic.getReusableMicrophoneStream()
  mic.releaseReusableMicrophoneStream()
  assert.equal(audioSession.type, 'playback')
  permission.resolve(stream)
  await assert.rejects(pending, /cancelled/)
  assert.equal(stream.stops, 1)
  assert.equal(mic.isMicrophoneCapturing(), false)
  assert.equal(audioSession.type, 'playback')
})

test('late stale permission grant cannot change audio routing of a newer capture', async t => {
  const stale = deferred()
  const fresh = deferred()
  const oldStream = fakeStream()
  const newStream = fakeStream()
  let requests = 0
  const { mic, audioSession } = await setup(t, () => (++requests === 1 ? stale.promise : fresh.promise))
  const oldRequest = mic.getReusableMicrophoneStream()
  mic.releaseReusableMicrophoneStream()
  const newRequest = mic.getReusableMicrophoneStream()
  stale.resolve(oldStream)
  await assert.rejects(oldRequest, /cancelled/)
  assert.equal(oldStream.stops, 1)
  assert.equal(audioSession.type, 'play-and-record')
  fresh.resolve(newStream)
  const active = await newRequest
  assert.equal(active, newStream)
  mic.pauseReusableMicrophoneStream(active)
  assert.equal(audioSession.type, 'playback')
})

test('permission denial restores playback without claiming microphone access', async t => {
  const permission = deferred()
  const { mic, audioSession, stored } = await setup(t, () => permission.promise)
  const pending = mic.getReusableMicrophoneStream()
  permission.reject(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }))
  await assert.rejects(pending, /Permission denied/)
  assert.equal(audioSession.type, 'playback')
  assert.equal(stored.get('ms_micAllowed'), 'false')
  assert.equal(mic.isMicrophoneCapturing(), false)
})

test('microphone handling tolerates browsers without the AudioSession API', async t => {
  const stream = fakeStream()
  const { mic } = await setup(t, () => Promise.resolve(stream))
  delete globalThis.navigator.audioSession
  const acquired = await mic.getReusableMicrophoneStream()
  assert.equal(acquired, stream)
  mic.pauseReusableMicrophoneStream(acquired)
  assert.equal(stream.stops, 1)
})


test('abandoning a pending microphone request restores speaker routing and stops late permission grants', async t => {
  const pendingPermission = deferred()
  const lateStream = fakeStream()
  const { mic, audioSession } = await setup(t, () => pendingPermission.promise)
  const controller = new AbortController()
  const incoming = mic.getReusableMicrophoneStream({ signal: controller.signal })
  assert.equal(audioSession.type, 'play-and-record')
  controller.abort()
  await assert.rejects(incoming, { name: 'AbortError' })
  assert.equal(audioSession.type, 'playback')
  pendingPermission.resolve(lateStream)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(lateStream.stops, 1)
  assert.equal(mic.isMicrophoneCapturing(), false)
  assert.equal(audioSession.type, 'playback')
})

test('cancelling one of two microphone requesters does not interrupt the survivor', async t => {
  const permission = deferred()
  const stream = fakeStream()
  const { mic, audioSession } = await setup(t, () => permission.promise)
  const firstController = new AbortController()
  const secondController = new AbortController()
  const first = mic.getReusableMicrophoneStream({ signal: firstController.signal })
  const second = mic.getReusableMicrophoneStream({ signal: secondController.signal })
  firstController.abort()
  await assert.rejects(first, { name: 'AbortError' })
  assert.equal(audioSession.type, 'play-and-record')
  permission.resolve(stream)
  assert.equal(await second, stream)
  assert.equal(mic.isMicrophoneCapturing(), true)
  mic.pauseReusableMicrophoneStream(stream)
  assert.equal(audioSession.type, 'playback')
})

test('a new audio screen restores speaker routing when no microphone session owns it', async t => {
  const { mic, audioSession } = await setup(t, () => Promise.reject(new Error('unused')))
  audioSession.type = 'play-and-record'
  mic.ensurePlaybackAudioSession()
  assert.equal(audioSession.type, 'playback')
})


test('ensuring playback cannot steal the audio route from an active recorder', async t => {
  const stream = fakeStream()
  const { mic, audioSession } = await setup(t, () => Promise.resolve(stream))
  await mic.getReusableMicrophoneStream()
  mic.ensurePlaybackAudioSession()
  assert.equal(audioSession.type, 'play-and-record')
  mic.pauseReusableMicrophoneStream(stream)
  assert.equal(audioSession.type, 'playback')
})

test('Slate and Webb input screens cancel pending microphone access on teardown', () => {
  const standard = readFileSync('src/app/session/components/InputPanel.js', 'utf8')
  const webb = readFileSync('src/app/session/webb/WebbDictationButton.jsx', 'utf8')
  for (const file of [standard, webb]) {
    assert.match(file, /getReusableMicrophoneStream\(\{ signal: controller\.signal \}\)/)
    assert.match(file, /micRequestControllerRef\.current\?\.abort\(\)/)
  }
})
test('page release clears old permission waiters so a later cancelled screen restores playback', async t => {
  const firstGrant = deferred()
  const secondGrant = deferred()
  const firstStream = fakeStream()
  const secondStream = fakeStream()
  let count = 0
  const { mic, audioSession } = await setup(t, () => (++count === 1 ? firstGrant.promise : secondGrant.promise))

  const old = mic.getReusableMicrophoneStream()
  const oldRejected = assert.rejects(old, /cancelled/)
  mic.releaseReusableMicrophoneStream()
  const controller = new AbortController()
  const newest = mic.getReusableMicrophoneStream({ signal: controller.signal })
  assert.equal(audioSession.type, 'play-and-record')
  controller.abort()
  await assert.rejects(newest, { name: 'AbortError' })
  assert.equal(audioSession.type, 'playback')

  firstGrant.resolve(firstStream)
  secondGrant.resolve(secondStream)
  await oldRejected
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(firstStream.stops, 1)
  assert.equal(secondStream.stops, 1)
  assert.equal(audioSession.type, 'playback')
})
