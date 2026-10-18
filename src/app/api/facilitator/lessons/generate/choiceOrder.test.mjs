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
    learningObjectives: [{ id: 'objective-1', name: 'Choose the correct answer', description: 'Select the correct item from four choices.', evidenceType: 'recognition' }],
    multiplechoice: Array.from({ length: 8 }, (_, index) => ({
      id: `practice-${index + 1}`,
      question: `Practice ${index + 1}`,
      choices: [`right-${index + 1}`, `wrong-a-${index + 1}`, `wrong-b-${index + 1}`, `wrong-c-${index + 1}`],
      correct: 0,
      expectedAny: [`right-${index + 1}`],
    })),
    test: Array.from({ length: 6 }, (_, index) => ({
      id: `reserved-${index + 1}`,
      objectiveId: 'objective-1',
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
    assert.deepEqual(json.lesson.test.map((item) => item.correct), [1, 2, 3, 0, 1, 2])
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

test('the route repairs only unaligned test items and stores the repaired draft once', async () => {
  const restore = withSupabaseEnv()
  const uploadCapture = {}
  let calls = 0
  const original = {
    title: 'Explain multiplication strategies', subject: 'math', grade: '5',
    teachingNotes: 'Explain several ways to multiply and discuss why the methods work.',
    learningObjectives: [{ id: 'defend', name: 'Defend a method', description: 'Explain why the method works', evidenceType: 'reasoned_explanation' }],
    test: Array.from({ length: 6 }, (_, index) => ({
      id: `heldout-${index + 1}`, objectiveId: 'defend',
      question: `What is ${index + 21} × 4?`,
      expectedAny: [String((index + 21) * 4)],
    })),
  }
  try {
    const response = await generateLesson(requestFor({
      title: original.title, subject: 'math', difficulty: 'intermediate', grade: '5',
      description: 'Explain and defend several ways to multiply.',
    }), {
      callModel: async (prompt) => {
        calls++
        if (calls === 1) return structuredClone(original)
        assert.match(prompt, /Improve ONLY the held-out independent test items/)
        return { repairs: Array.from({ length: 6 }, (_, index) => ({
          index: index + 1,
          item: {
            id: `heldout-${index + 1}`, objectiveId: 'defend',
            question: `For ${index + 21} × 4, explain why a strategy you choose gives the right result.`,
            expectedAny: ['Multiplying by four can be done by doubling twice because each doubling multiplies the quantity by two.'],
          },
        })) }
      },
      createClientImpl: createClientMock(uploadCapture),
    })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(calls, 2)
    assert.equal(body.lesson.assessmentReadiness.status, 'aligned')
    assert.equal(body.lesson.assessmentReadiness.repaired, true)
    assert.equal(body.lesson.approved, false)
    assert.deepEqual(body.lesson.learningObjectives, original.learningObjectives)
    assert.equal(body.lesson.test.length, 6)
    assert.deepEqual(JSON.parse(uploadCapture.body), body.lesson)
  } finally {
    restore()
  }
})

test('a mismatched generated test is saved as a reviewable draft rather than rejecting the learner', async () => {
  const restore = withSupabaseEnv()
  const uploadCapture = {}
  try {
    const response = await generateLesson(requestFor({
      title: 'Defend an efficient multiplication strategy',
      subject: 'math',
      difficulty: 'intermediate',
      grade: '5',
      description: 'Explain and defend strategies, not only calculate a product.',
    }), {
      callModel: async () => ({
        title: 'Defend an efficient multiplication strategy',
        learningObjectives: [{
          id: 'defend',
          name: 'Defend a multiplication strategy',
          description: 'Explain why a strategy works.',
          evidenceType: 'reasoned_explanation',
        }],
        test: Array.from({ length: 6 }, (_, index) => ({
          id: `t-${index + 1}`,
          objectiveId: 'defend',
          question: `What is ${index + 12} × 4?`,
          expectedAny: [String((index + 12) * 4)],
        })),
      }),
      createClientImpl: createClientMock(uploadCapture),
    })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.lesson.approved, false)
    assert.equal(body.lesson.assessmentReadiness.status, 'needs_review')
    assert.ok(body.lesson.assessmentReadiness.issues.includes('reasoning_not_assessed:defend'))
    assert.deepEqual(body.lesson.assessmentReadiness.objectivesNeedingAssessment, ['defend'])
    assert.deepEqual(JSON.parse(uploadCapture.body), body.lesson, 'the review warning persists with the saved lesson')
    assert.equal(body.lesson.test.length, 6)
  } finally {
    restore()
  }
})
