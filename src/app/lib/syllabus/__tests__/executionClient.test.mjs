import assert from 'node:assert/strict'
import test from 'node:test'

import { authorizeProtectedOccurrence, startProtectedInstructionalSession } from '../executionClient.js'

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
