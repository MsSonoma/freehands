import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SONOMA_TEXT_TOKEN_BUDGETS,
  parseSonomaTextReply,
  requestSonomaTextReply,
} from '../sonomaTextCompletion.mjs'

const messages = [
  { role: 'system', content: 'Teach the assigned lesson.' },
  { role: 'user', content: 'A private learner response.' },
]

function response(content, { status = 200, finishReason = 'stop', refusal = null, completionTokens = 130, reasoningTokens = 30 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return {
        choices: [{ finish_reason: finishReason, message: { content, refusal } }],
        usage: { completion_tokens: completionTokens, completion_tokens_details: { reasoning_tokens: reasoningTokens } },
      }
    },
  }
}

function call(fetchImpl, logger = { warn() {} }) {
  return requestSonomaTextReply({
    fetchImpl,
    endpoint: 'https://provider.invalid/v1/chat/completions',
    apiKey: 'private-test-key',
    model: 'gpt-5.6-luna',
    messages,
    context: 'discussion',
    logger,
  })
}

test('parses only complete, nonempty plain-text model replies', () => {
  assert.equal(parseSonomaTextReply({ finish_reason: 'stop', message: { content: '  Which example fits?  ' } }), 'Which example fits?')
  assert.equal(parseSonomaTextReply({ finish_reason: 'length', message: { content: 'Truncated...' } }), null)
  assert.equal(parseSonomaTextReply({ finish_reason: 'content_filter', message: { content: 'Text' } }), null)
  assert.equal(parseSonomaTextReply({ finish_reason: 'stop', message: { content: '  ' } }), null)
  assert.equal(parseSonomaTextReply({ finish_reason: 'stop', message: { refusal: 'Cannot reply', content: 'Hello' } }), null)
  assert.equal(parseSonomaTextReply(null), null)
})

test('a valid Sonoma turn uses the reasoning-aware budget once', async () => {
  const calls = []
  const result = await call(async (_endpoint, options) => {
    calls.push(JSON.parse(options.body))
    return response('  What example can you think of?  ')
  })
  assert.deepEqual(result, { ok: true, text: 'What example can you think of?' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].max_completion_tokens, SONOMA_TEXT_TOKEN_BUDGETS[0])
  assert.equal(calls[0].model, 'gpt-5.6-luna')
  assert.deepEqual(calls[0].messages, messages)
  assert.equal(calls[0].temperature, undefined)
})

test('reasoning-only completion at 1024 retries the exact turn at 2048', async () => {
  const calls = []
  const logs = []
  const result = await call(async (_endpoint, options) => {
    calls.push(JSON.parse(options.body))
    return calls.length === 1
      ? response('', { finishReason: 'length', completionTokens: 1024, reasoningTokens: 1024 })
      : response('I see your idea. What would happen next?')
  }, { warn: (...args) => logs.push(args) })
  assert.deepEqual(result, { ok: true, text: 'I see your idea. What would happen next?' })
  assert.deepEqual(calls.map(item => item.max_completion_tokens), [1024, 2048])
  assert.deepEqual(calls[0].messages, calls[1].messages)
  assert.equal(logs[0][1].reason, 'token_limit')
  assert.equal(logs[0][1].reasoningTokens, 1024)
  assert.doesNotMatch(JSON.stringify(logs), /A private learner response|private-test-key/)
})

test('an empty 200 or malformed upstream JSON receives a bounded retry', async () => {
  let attempts = 0
  const result = await call(async () => {
    attempts += 1
    if (attempts === 1) return response('')
    return response('Let us compare two examples.')
  })
  assert.deepEqual(result, { ok: true, text: 'Let us compare two examples.' })
  assert.equal(attempts, 2)

  attempts = 0
  const invalid = await call(async () => {
    attempts += 1
    return { ok: true, status: 200, async json() { throw new Error('bad json') } }
  })
  assert.deepEqual(invalid, { ok: false, reason: 'unusable_reply' })
  assert.equal(attempts, 2)
})

test('transient upstream errors retry, permanent errors and refusals do not', async () => {
  let attempts = 0
  const recovered = await call(async () => {
    attempts += 1
    if (attempts === 1) throw new Error('network')
    return response('What did you notice?')
  })
  assert.deepEqual(recovered, { ok: true, text: 'What did you notice?' })
  assert.equal(attempts, 2)

  attempts = 0
  const unavailable = await call(async () => {
    attempts += 1
    return attempts === 1 ? { ok: false, status: 503 } : response('Try that idea again.')
  })
  assert.deepEqual(unavailable, { ok: true, text: 'Try that idea again.' })
  assert.equal(attempts, 2)

  attempts = 0
  const rejected = await call(async () => { attempts += 1; return { ok: false, status: 400 } })
  assert.deepEqual(rejected, { ok: false, reason: 'upstream_error' })
  assert.equal(attempts, 1)

  attempts = 0
  const refused = await call(async () => { attempts += 1; return response('', { refusal: 'Unable to assist' }) })
  assert.deepEqual(refused, { ok: false, reason: 'unusable_reply' })
  assert.equal(attempts, 1)
})

test('two exhausted attempts never masquerade as classroom dialogue', async () => {
  let attempts = 0
  const result = await call(async () => {
    attempts += 1
    return response('A sentence cut short.', { finishReason: 'length', completionTokens: 2048, reasoningTokens: 2048 })
  })
  assert.deepEqual(result, { ok: false, reason: 'unusable_reply' })
  assert.equal(attempts, 2)
})
