import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  WEBB_CHAT_TOKEN_BUDGETS,
  parseWebbStructuredReply,
  requestWebbStructuredReply,
} from '../webbChatCompletion.mjs'

const lessonMessages = [
  { role: 'system', content: 'Stay on the assigned lesson objective.' },
  { role: 'user', content: 'How can I identify a story theme?' },
]

function response(content, { status = 200, finishReason = 'stop', completionTokens = 132, reasoningTokens = 48, refusal = null } = {}) {
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
  return requestWebbStructuredReply({
    fetchImpl,
    endpoint: 'https://provider.test/v1/chat/completions',
    apiKey: 'test-key',
    model: 'gpt-5.6-luna',
    messages: lessonMessages,
    temperatureOptions: {},
    logger,
  })
}

test('valid structured Webb reply preserves exactly the spoken question', () => {
  assert.deepEqual(
    parseWebbStructuredReply(JSON.stringify({
      reply: 'Theme is a story\'s central message. What lesson does the main character learn?',
      objectivePrompt: 'What lesson does the main character learn?',
    })),
    {
      reply: 'Theme is a story\'s central message. What lesson does the main character learn?',
      objectivePrompt: 'What lesson does the main character learn?',
    },
  )
  assert.equal(parseWebbStructuredReply(JSON.stringify({
    reply: 'Explain what you noticed about the character.',
    objectivePrompt: 'What is the main idea?',
  })).objectivePrompt, null)
})

test('missing, malformed, or token-truncated structured replies are never accepted', () => {
  for (const raw of ['', '{broken', '{}', '{"reply":""}', '{"reply":null}', '{"reply":42}', '[]', 'null']) {
    assert.equal(parseWebbStructuredReply(raw), null, raw)
  }
  assert.equal(parseWebbStructuredReply('{"reply":"Hello!","objectivePrompt":null}', 'length'), null)
  assert.equal(parseWebbStructuredReply('{"reply":"Hello!","objectivePrompt":null}', 'content_filter'), null)
})

test('successful reply uses the larger model budget with no extra API call', async () => {
  const calls = []
  const result = await call(async (endpoint, options) => {
    calls.push({ endpoint, options, payload: JSON.parse(options.body) })
    return response(JSON.stringify({ reply: 'A theme is an idea running through the story.', objectivePrompt: null }))
  })
  assert.equal(result.ok, true)
  assert.equal(result.reply, 'A theme is an idea running through the story.')
  assert.equal(result.objectivePrompt, null)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].payload.max_completion_tokens, WEBB_CHAT_TOKEN_BUDGETS[0])
  assert.equal(calls[0].payload.model, 'gpt-5.6-luna')
  assert.deepEqual(calls[0].payload.messages, lessonMessages)
  assert.deepEqual(calls[0].payload.response_format, { type: 'json_object' })
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key')
})

test('reasoning exhausted at the first limit triggers one larger retry of the same turn', async () => {
  const requests = []
  const events = []
  const result = await call(async (_endpoint, options) => {
    requests.push(JSON.parse(options.body))
    if (requests.length === 1) return response('', { finishReason: 'length', completionTokens: 1024, reasoningTokens: 1024 })
    return response(JSON.stringify({ reply: 'Theme is a message. Which event shows that message?', objectivePrompt: 'Which event shows that message?' }))
  }, { warn: (...args) => events.push(args) })
  assert.equal(result.ok, true)
  assert.equal(result.objectivePrompt, 'Which event shows that message?')
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map(item => item.max_completion_tokens), [1024, 2048])
  assert.deepEqual(requests[1].messages, requests[0].messages)
  assert.equal(events.length, 1)
  assert.equal(events[0][1].reason, 'token_limit')
  assert.equal(events[0][1].reasoningTokens, 1024)
  assert.doesNotMatch(JSON.stringify(events), /How can I identify a story theme/)
})

test('malformed 200 reply retries, then reports an error instead of false classroom dialogue', async () => {
  let attempts = 0
  const result = await call(async () => {
    attempts += 1
    return response(attempts === 1 ? '{not-json' : '{"objectivePrompt":"What next?"}')
  })
  assert.deepEqual(result, { ok: false, reason: 'unusable_reply' })
  assert.equal(attempts, 2)
})

test('transient upstream HTTP or transport failure gets a bounded retry', async () => {
  let attempts = 0
  const recovered = await call(async () => {
    attempts += 1
    if (attempts === 1) return { ok: false, status: 503 }
    return response('{"reply":"Let us look for character evidence.","objectivePrompt":null}')
  })
  assert.equal(recovered.ok, true)
  assert.equal(attempts, 2)

  attempts = 0
  const network = await call(async () => {
    attempts += 1
    if (attempts === 1) throw new Error('network unavailable')
    return response('{"reply":"Tell me about one event in the story.","objectivePrompt":null}')
  })
  assert.equal(network.ok, true)
  assert.equal(attempts, 2)
})

test('nonretryable HTTP error and safety refusal fail without inventing a response', async () => {
  let attempts = 0
  const rejected = await call(async () => {
    attempts += 1
    return { ok: false, status: 400 }
  })
  assert.deepEqual(rejected, { ok: false, reason: 'upstream_error' })
  assert.equal(attempts, 1)

  attempts = 0
  const refusal = await call(async () => {
    attempts += 1
    return response(null, { refusal: 'Cannot assist with this content' })
  })
  assert.deepEqual(refusal, { ok: false, reason: 'unusable_reply' })
  assert.equal(attempts, 1)
})

test('Webb normal and research chat both use validated replies, never the old canned sentence', () => {
  const route = fs.readFileSync('src/app/api/webb-chat/route.js', 'utf8')
  assert.equal((route.match(/requestWebbStructuredReply\(\{/g) || []).length, 2)
  assert.doesNotMatch(route, /That's a great question! What else would you like to know about this topic/)
  assert.equal((route.match(/WEBB_REPLY_UNAVAILABLE/g) || []).length, 2)
  assert.doesNotMatch(route, /parseStructuredObjectiveReply/)
})
