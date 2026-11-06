import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { postSlateJudgmentWithRetry, isRetryableSlateJudgmentStatus } from '../slateJudgmentRetry.mjs'

const valid = (data) => data?.ok === true

test('transient 504 retries the exact saved answer without resubmission', async () => {
  const requests = []
  const retries = []
  const input = { mode: 'turn', learnerResponse: 'My answer', state: { turnNumber: 3 } }
  const result = await postSlateJudgmentWithRetry({
    url: '/api/slate-liftoff', body: input, isValid: valid,
    retryDelayMs: 0, onRetry: (event) => retries.push(event),
    fetcher: async (_url, init) => {
      requests.push(init)
      return requests.length === 1
        ? { ok: false, status: 504, json: async () => ({ error: 'FUNCTION_INVOCATION_TIMEOUT' }) }
        : { ok: true, status: 200, json: async () => ({ ok: true, learnerMessage: 'Proceed.' }) }
    },
  })
  assert.equal(result.learnerMessage, 'Proceed.')
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map((request) => JSON.parse(request.body)), [input, input])
  assert.notEqual(requests[0].signal, requests[1].signal)
  assert.equal(retries.length, 1)
})

test('empty success response and 503 are retried rather than treated as grades', async () => {
  const statuses = [200, 503, 200]
  let calls = 0
  const result = await postSlateJudgmentWithRetry({
    url: '/api/judge-short-answer', body: { learnerAnswer: 'correct idea' },
    isValid: (data) => ['correct', 'partial', 'incorrect'].includes(data?.status) && Boolean(data?.reason),
    retryDelayMs: 0,
    fetcher: async () => {
      const status = statuses[calls++]
      return { ok: status === 200, status,
        json: async () => calls === 3 ? { status: 'correct', reason: 'Demonstrated.' } : null }
    },
  })
  assert.equal(result.status, 'correct')
  assert.equal(calls, 3)
})

test('non-retriable validation errors are not replayed', async () => {
  let calls = 0
  await assert.rejects(postSlateJudgmentWithRetry({
    url: '/api/slate-liftoff', body: { bad: true }, isValid: valid,
    fetcher: async () => {
      calls += 1
      return { ok: false, status: 409, json: async () => ({ error: 'Stale submission.' }) }
    },
  }), /Stale submission/)
  assert.equal(calls, 1)
})

test('stalled request is aborted and retried automatically', async () => {
  let calls = 0
  await assert.rejects(postSlateJudgmentWithRetry({
    url: '/api/slate-liftoff', body: { answer: 'persisted' }, isValid: valid,
    attempts: 2, timeoutMs: 5, retryDelayMs: 0,
    fetcher: async (_url, { signal }) => {
      calls += 1
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('request aborted')), { once: true })
      })
    },
  }), /saved answer/)
  assert.equal(calls, 2)
})

test('stale lesson does not retry a judgment for a different question', async () => {
  let active = true
  let calls = 0
  await assert.rejects(postSlateJudgmentWithRetry({
    url: '/api/slate-liftoff', body: { answer: 'persisted' }, isValid: valid,
    stillCurrent: () => active, retryDelayMs: 0,
    fetcher: async () => {
      calls += 1
      active = false
      return { ok: false, status: 503, json: async () => null }
    },
  }), /no longer current/)
  assert.equal(calls, 1)
})

test('retry conditions cover server faults and rate limits, never learner validation failures', () => {
  for (const status of [408, 425, 429, 500, 502, 503, 504]) assert.equal(isRetryableSlateJudgmentStatus(status), true)
  for (const status of [200, 400, 401, 403, 404, 409, 422]) assert.equal(isRetryableSlateJudgmentStatus(status), false)
})

test('Liftoff and independent test use the saved-answer retry flow', () => {
  const slate = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
  const judge = fs.readFileSync(path.resolve('src/app/api/judge-short-answer/route.js'), 'utf8')
  assert.match(slate, /const turn = await postSlateJudgmentWithRetry\(/)
  assert.match(slate, /const judgment = await judgeAssessmentItem\(item, pending\.answer/)
  assert.match(slate, /const body = await postSlateJudgmentWithRetry\(/)
  assert.match(slate, /if \(!await persistLiftoffSnapshot\(\)\) throw new Error\('Your math answer could not be safely saved/)
  assert.match(slate, /judgmentRetryNotice &&/)
  assert.match(judge, /export const maxDuration = 60/)
})
