import assert from 'node:assert/strict'
import test from 'node:test'

import { POST as generateLesson } from './route.js'

function withSupabaseEnv() {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  return () => {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url
    if (previous.anon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.anon
    if (previous.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.service
  }
}

function requestFor(body) {
  return new Request('http://localhost.test/api/facilitator/lessons/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
  })
}

function createClientMock(uploadCapture) {
  return (url, key) => {
    if (key === 'anon-key') {
      return { auth: { getUser: async () => ({ data: { user: { id: 'facilitator-1' } }, error: null }) } }
    }
    return {
      auth: { getUser: async () => ({ data: { user: { id: 'facilitator-1' } }, error: null }) },
      from: (table) => {
        if (table !== 'profiles') throw new Error(`Unexpected table: ${table}`)
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { plan_tier: 'pro', subscription_tier: null }, error: null }),
            }),
          }),
        }
      },
      storage: {
        from: () => ({
          upload: async (path, body, options) => {
            uploadCapture.path = path
            uploadCapture.body = body
            uploadCapture.options = options
            return { data: { path }, error: null }
          },
          getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/generated.json' } }),
        }),
      },
    }
  }
}

test('generated lesson storage and API response share one canonical answer order', async () => {
  const restore = withSupabaseEnv()
  const uploadCapture = {}
  const modelLesson = {
    id: 'all-a-source',
    title: 'Balanced Choices',
    grade: '4',
    difficulty: 'intermediate',
    subject: 'math',
    blurb: 'A test lesson.',
    multiplechoice: Array.from({ length: 8 }, (_, index) => ({
      id: `practice-${index + 1}`,
      question: `Practice ${index + 1}`,
      choices: [`right-${index + 1}`, `wrong-a-${index + 1}`, `wrong-b-${index + 1}`, `wrong-c-${index + 1}`],
      correct: 0,
      expectedAny: [`right-${index + 1}`],
    })),
    test: Array.from({ length: 4 }, (_, index) => ({
      id: `reserved-${index + 1}`,
      question: `Test ${index + 1}`,
      choices: [`test-right-${index + 1}`, `test-wrong-a-${index + 1}`, `test-wrong-b-${index + 1}`, `test-wrong-c-${index + 1}`],
      correct: 0,
      expectedAny: [`test-right-${index + 1}`],
    })),
  }
  const originalModelLesson = structuredClone(modelLesson)

  try {
    const response = await generateLesson(requestFor({
      title: 'Balanced Choices',
      subject: 'math',
      difficulty: 'intermediate',
      grade: '4',
      description: 'A test lesson.',
    }), {
      callModel: async () => modelLesson,
      choiceOrderRng: () => 0,
      createClientImpl: createClientMock(uploadCapture),
    })

    const json = await response.json()
    assert.equal(response.status, 200)
    const storedLesson = JSON.parse(uploadCapture.body)
    assert.deepEqual(storedLesson, json.lesson)
    assert.deepEqual(json.lesson.multiplechoice.map((item) => item.correct), [1, 2, 3, 0, 1, 2, 3, 0])
    assert.deepEqual(json.lesson.test.map((item) => item.correct), [1, 2, 3, 0])
    json.lesson.multiplechoice.forEach((item, index) => {
      assert.equal(item.choices[item.correct], `right-${index + 1}`)
      assert.deepEqual(item.expectedAny, [`right-${index + 1}`])
    })
    json.lesson.test.forEach((item, index) => {
      assert.equal(item.choices[item.correct], `test-right-${index + 1}`)
      assert.deepEqual(item.expectedAny, [`test-right-${index + 1}`])
    })
    assert.equal(uploadCapture.options.cacheControl, '0')
    assert.deepEqual(modelLesson, originalModelLesson)
  } finally {
    restore()
  }
})
