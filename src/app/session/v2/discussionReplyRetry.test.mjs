import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./DiscussionPhase.jsx', import.meta.url), 'utf8')
  .replace(/^import [^\r\n]+[\r\n]*/gm, '')
  .replace('export class DiscussionPhase', 'class DiscussionPhase')
const Phase = new Function(
  'fetchTTS',
  'buildInstructionalLessonView',
  source + '\nreturn DiscussionPhase',
)(async () => null, lesson => lesson)

function bus() {
  const listeners = new Map()
  const events = []
  return {
    events,
    on(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(callback)
      return () => listeners.get(name)?.delete(callback)
    },
    emit(name, data) {
      events.push({ name, data })
      for (const cb of listeners.get(name) || []) cb(data)
    },
  }
}

function audio() {
  const listeners = new Set()
  return {
    on: (name, cb) => { if (name === 'end') listeners.add(cb) },
    off: (name, cb) => { if (name === 'end') listeners.delete(cb) },
    stop: () => {},
    playAudio: async () => {
      queueMicrotask(() => { for (const cb of [...listeners]) cb({ completed: true }) })
    },
  }
}

async function withFakeApis({ replies, check = { newlyCompleted: [], evaluationStatus: ['partial'] }, history = [{ role: 'assistant', content: 'Welcome.' }], resumeCompletedIndices = [] }, run) {
  const originalFetch = globalThis.fetch
  const requests = []
  let checks = 0
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options?.body || '{}')
    if (url === '/api/webb-objectives') {
      if (body.action === 'generate') {
        return { ok: true, json: async () => ({ objectives: ['Describe the main idea'], clues: ['Main idea'] }) }
      }
      checks += 1
      return { ok: true, json: async () => check }
    }
    if (url === '/api/sonoma-discussion') {
      if (body.action === 'overview') {
        return { ok: true, json: async () => ({ text: 'Welcome. We will discuss an idea.' }) }
      }
      requests.push(body)
      const next = replies.shift()
      return next ?? { ok: false, status: 502 }
    }
    throw new Error('Unexpected endpoint: ' + url)
  }
  const eventBus = bus()
  const phase = new Phase({
    audioEngine: audio(),
    eventBus,
    lessonData: { title: 'The main idea', subject: 'Language Arts', grade: 4 },
    learnerName: 'Test Learner',
    resumeHistory: history,
    resumeCompletedIndices,
  })
  try {
    await phase.prefetch()
    phase.start()
    await run({ phase, events: eventBus.events, requests, getChecks: () => checks })
  } finally {
    phase.destroy()
    globalThis.fetch = originalFetch
  }
}

const ok = text => ({ ok: true, json: async () => ({ text }) })
const failed = { ok: false, status: 502 }

test('failed model reply leaves one learner turn, no fabricated teaching, and a working exact retry', async () => {
  await withFakeApis({ replies: [failed, ok('Which example shows the main idea?')] }, async ({ phase, events, requests, getChecks }) => {
    assert.equal(phase.state, 'chatting')
    await phase.submitMessage('Here is my explanation.')
    assert.equal(phase.state, 'reply-unavailable')
    assert.equal(events.filter(e => e.name === 'discussionMessage' && e.data.role === 'user').length, 1)
    assert.equal(events.filter(e => e.name === 'discussionMessage' && e.data.role === 'assistant').length, 0)
    assert.equal(events.filter(e => e.name === 'discussionComplete').length, 0)

    await phase.retryReply()
    assert.equal(phase.state, 'chatting')
    assert.equal(getChecks(), 1)
    assert.equal(requests.length, 2)
    assert.deepEqual(requests[0].messages, requests[1].messages)
    assert.equal(requests[0].messages.filter(m => m.role === 'user').length, 1)
    assert.equal(events.filter(e => e.name === 'discussionMessage' && e.data.role === 'user').length, 1)
    assert.deepEqual(events.filter(e => e.name === 'discussionMessage' && e.data.role === 'assistant').map(e => e.data.text), ['Which example shows the main idea?'])
  })
})

test('retry cannot complete discussion before valid model speech, and never re-awards mastery', async () => {
  await withFakeApis({
    replies: [ok(''), ok('You explained the main idea well.')],
    check: { newlyCompleted: [0], evaluationStatus: [] },
  }, async ({ phase, events, getChecks }) => {
    await phase.submitMessage('The central meaning is clear.')
    assert.equal(phase.completedObjectives, 1)
    assert.equal(phase.state, 'reply-unavailable')
    assert.equal(events.filter(e => e.name === 'discussionObjectiveComplete').length, 1)
    assert.deepEqual(events.find(e => e.name === 'discussionObjectiveComplete').data.completedIndices, [0])
    assert.equal(events.filter(e => e.name === 'discussionComplete').length, 0)

    await phase.retryReply()
    assert.equal(phase.state, 'complete')
    assert.equal(getChecks(), 1)
    assert.equal(events.filter(e => e.name === 'discussionObjectiveComplete').length, 1)
    assert.equal(events.filter(e => e.name === 'discussionComplete').length, 1)
  })
})

test('resuming a transcript with an unanswered learner message preserves the turn for retry', async () => {
  await withFakeApis({
    replies: [ok('Thank you. Let us continue.')],
    history: [{ role: 'assistant', content: 'Welcome.' }, { role: 'user', content: 'What I learned.' }],
  }, async ({ phase, events, requests, getChecks }) => {
    assert.equal(phase.state, 'reply-unavailable')
    await phase.retryReply()
    assert.equal(phase.state, 'chatting')
    assert.equal(getChecks(), 0)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].messages.filter(m => m.role === 'user').length, 1)
    assert.equal(events.filter(e => e.name === 'discussionMessage' && e.data.role === 'user').length, 0)
  })
})

test('source contracts require a visible retry and forbid the generic fallback script', () => {
  const page = readFileSync(new URL('./SessionPageV2.jsx', import.meta.url), 'utf8')
  const discussion = readFileSync(new URL('../../api/sonoma-discussion/route.js', import.meta.url), 'utf8')
  const exercise = readFileSync(new URL('../../api/sonoma-exercise/route.js', import.meta.url), 'utf8')
  assert.match(page, /discussionState === 'reply-unavailable'/)
  assert.match(page, /discussionPhaseRef\.current\?\.retryReply\(\)/)
  assert.match(page, /Your answer is still here/)
  assert.match(page, /saveProgress\('discussion-objective'/)
  assert.match(discussion, /requestSonomaTextReply/)
  assert.match(exercise, /requestSonomaTextReply/)
  assert.doesNotMatch(source, /Great thinking! Can you tell me more about what you've learned/)
})
