import assert from 'node:assert/strict'
import test from 'node:test'

import { POST } from '../../../api/syllabus/lesson-removal/route.js'

const url = 'http://localhost/api/syllabus/lesson-removal'
const base = {
  learnerId: 'learner-1', lessonKey: 'math/fractions.json', occurrenceId: 'actual:execution-1',
  evidenceDisposition: 'keep', expectedActiveRevisionId: 'revision-1', pin: '1234',
}
const req = (body = base) => new Request(url, {
  method: 'POST', headers: { Authorization: 'Bearer sample-token', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
function deps(overrides = {}) {
  const result = { removed: true, evidenceDisposition: 'keep' }
  return {
    getRequestContext: async () => ({ admin: {}, user: { id: 'facilitator-1' } }),
    repository: {},
    verifyPin: async () => true,
    remove: async () => result,
    ...overrides,
  }
}

test('anonymous requests cannot remove even with a valid-looking PIN', async () => {
  let calls = 0
  const response = await POST(req(), deps({
    getRequestContext: async () => ({ error: 'Unauthorized', status: 401 }),
    remove: async () => { calls++ },
  }))
  assert.equal(response.status, 401)
  assert.equal(calls, 0)
})

test('a wrong PIN cannot reach the removal transaction', async () => {
  let calls = 0
  const response = await POST(req(), deps({
    verifyPin: async () => false,
    remove: async () => { calls++ },
  }))
  assert.equal(response.status, 403)
  assert.equal(calls, 0)
  assert.equal((await response.json()).code, 'FACILITATOR_PIN_REQUIRED')
})

test('missing PIN, forbidden fields, and invalid evidence choices are rejected', async () => {
  for (const body of [
    { ...base, pin: '' },
    { ...base, pin: '999' },
    { ...base, facilitatorId: 'different-owner' },
    { ...base, evidenceDisposition: 'none' },
    { ...base, evidenceDisposition: null },
  ]) {
    let called = false
    const response = await POST(req(body), deps({ remove: async () => { called = true } }))
    assert.equal(response.status, 400)
    assert.equal(called, false)
  }
})

test('server verifies the real facilitator and passes exact targeted removal', async () => {
  let seenPin = ''
  let seen = null
  const response = await POST(req({ ...base, evidenceDisposition: 'delete' }), deps({
    verifyPin: async (_, userId, pin) => { assert.equal(userId, 'facilitator-1'); seenPin = pin; return true },
    remove: async (params) => { seen = params; return { removed: true, evidenceDisposition: 'delete' } },
  }))
  assert.equal(response.status, 200)
  assert.equal(seenPin, '1234')
  assert.equal(seen.facilitatorId, 'facilitator-1')
  assert.equal(seen.lessonKey, base.lessonKey)
  assert.equal(seen.occurrenceId, base.occurrenceId)
  assert.equal(seen.evidenceDisposition, 'delete')
  assert.equal(seen.pin, undefined)
  assert.equal((await response.json()).removed, true)
})

test('server failures are not misreported as success', async () => {
  const response = await POST(req(), deps({ remove: async () => { throw new Error('private') } }))
  assert.equal(response.status, 500)
  assert.equal((await response.json()).ok, undefined)
})
