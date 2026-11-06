import test from 'node:test'
import assert from 'node:assert/strict'

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
