import assert from 'node:assert/strict'
import test from 'node:test'

import { authorizeProtectedOccurrence, getProtectedBrowserSessionId, prepareProtectedBrowserSessionForOccurrence, startProtectedInstructionalSession } from '../executionClient.js'

const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LEGACY_OCCURRENCE = 'legacy:generated/legacy.json:2026-08-28'

test('no-active-Syllabus authorization reaches the server with an empty occurrence and requires its canonical response', async () => {
  const bodies = []
  const result = await authorizeProtectedOccurrence({
    learnerId: LEARNER,
    lessonKey: 'generated/legacy.json',
    occurrenceId: '',
  }, {
    accessToken: async () => 'token',
    fetch: async (_url, options) => {
      bodies.push(JSON.parse(options.body))
      return new Response(JSON.stringify({ ok: true, occurrenceId: LEGACY_OCCURRENCE, lessonKey: 'generated/legacy.json' }), { status: 200 })
    },
  })
  assert.equal(bodies.length, 1)
  assert.equal(bodies[0].occurrenceId, '')
  assert.equal(result.occurrenceId, LEGACY_OCCURRENCE)
})

test('authorization never accepts a successful response without a server occurrence identity', async () => {
  await assert.rejects(() => authorizeProtectedOccurrence({
    learnerId: LEARNER,
    lessonKey: 'generated/legacy.json',
  }, {
    accessToken: async () => 'token',
    fetch: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  }), /not authorized/i)
})

test('Webb protected start uses only the occurrence returned by server authorization', async () => {
  const starts = []
  const result = await startProtectedInstructionalSession({
    learnerId: LEARNER,
    lessonKey: 'generated/legacy.json',
    occurrenceId: '',
    instructionalTeacher: 'webb',
  }, {
    authorizeProtectedOccurrence: async (scope) => {
      assert.equal(scope.instructionalTeacher, 'webb')
      return { ok: true, occurrenceId: LEGACY_OCCURRENCE, instructionalTeacher: 'webb' }
    },
    getProtectedBrowserSessionId: () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    startLessonSession: async (...args) => {
      starts.push(args)
      return { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }
    },
  })
  assert.equal(starts.length, 1)
  assert.equal(starts[0][6], LEGACY_OCCURRENCE)
  assert.equal(starts[0][7], 'webb')
  assert.equal(result.occurrenceId, LEGACY_OCCURRENCE)
})

test('facilitator restart uses a new browser ID but refresh reuses the same attempt', () => {
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage }
  const makeStorage = () => {
    const data = new Map()
    return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, String(value)) }
  }
  const learnerId = LEARNER
  const lessonKey = 'generated/fractions.json'
  const occurrenceId = 'restart:11111111-1111-4111-8111-111111111111'
  try {
    globalThis.window = { location: { pathname: '/learn', search: '' } }
    globalThis.localStorage = makeStorage()
    globalThis.sessionStorage = makeStorage()
    globalThis.localStorage.setItem('lesson_session_id', 'old-browser-session')
    const fresh = prepareProtectedBrowserSessionForOccurrence({ learnerId, lessonKey, occurrenceId })
    assert.ok(fresh)
    assert.notEqual(fresh, 'old-browser-session')
    assert.equal(prepareProtectedBrowserSessionForOccurrence({ learnerId, lessonKey, occurrenceId }), fresh)
    globalThis.window.location = { pathname: '/session', search: `?learnerId=${learnerId}&subject=generated&lesson=fractions.json&occurrenceId=${occurrenceId}` }
    assert.equal(getProtectedBrowserSessionId(), fresh)
    const another = prepareProtectedBrowserSessionForOccurrence({ learnerId, lessonKey,
      occurrenceId: 'restart:22222222-2222-4222-8222-222222222222' })
    assert.notEqual(another, fresh)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})

test('an already-started Sonoma restart keeps its original tracked browser ID', () => {
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage }
  try {
    const store = () => { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, String(value)) } }
    globalThis.window = { location: { pathname: '/learn', search: '' } }
    globalThis.localStorage = store(); globalThis.sessionStorage = store()
    const scope = { learnerId: LEARNER, lessonKey: 'generated/fractions.json',
      occurrenceId: 'restart:33333333-3333-4333-8333-333333333333',
      resumeExisting: true, startedAt: '2026-11-02T16:48:55Z',
      existingBrowserSessionId: 'a00261cf-aad0-4706-a86d-6ab412571186' }
    const id = prepareProtectedBrowserSessionForOccurrence(scope)
    assert.equal(id, scope.existingBrowserSessionId)
    assert.equal(globalThis.localStorage.getItem(`protected_restart_started_at:${scope.learnerId}:${scope.lessonKey}:${scope.occurrenceId}`), scope.startedAt)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})
