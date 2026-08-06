import assert from 'node:assert/strict'
import test from 'node:test'

import { POST as approveLesson } from '../src/app/api/facilitator/lessons/approve/route.js'
import { POST as generateLesson } from '../src/app/api/facilitator/lessons/generate/route.js'
import { POST as updateAvailability } from '../src/app/api/facilitator/learners/lesson-availability/route.js'
import { POST as proposeLesson } from '../src/app/api/facilitator/lessons/propose/route.js'

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

function jsonRequest(body) {
  return new Request('http://localhost.test/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
  })
}

function createTableMock({ profile = { plan_tier: 'pro', subscription_tier: null }, learner = null, updateCapture = null } = {}) {
  return function from(table) {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }
    }

    if (table === 'learners') {
      return {
        select: () => ({
          eq: () => ({
            or: () => ({ maybeSingle: async () => ({ data: learner, error: null }) }),
          }),
        }),
        update: (value) => ({
          eq: async () => {
            if (updateCapture) updateCapture.value = value
            return { error: null }
          },
        }),
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  }
}

function createClientMock({ user = { id: 'facilitator-1' }, admin = {} } = {}) {
  return (url, key) => {
    if (key === 'anon-key') {
      return { auth: { getUser: async () => ({ data: { user }, error: null }) } }
    }
    return {
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      from: admin.from || createTableMock(),
      storage: admin.storage,
    }
  }
}

test('proposal route rejects another facilitator learner', async () => {
  const restore = withSupabaseEnv()
  try {
    const response = await proposeLesson(jsonRequest({
      intent: { version: 1, learnerId: 'other-learner', need: 'Needs help comparing fractions with unlike denominators.' },
    }), {
      createClientImpl: createClientMock({ admin: { from: createTableMock({ learner: null }) } }),
    })

    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'Learner not found or unauthorized')
  } finally {
    restore()
  }
})

test('generation proposal mode fails on storage failure without returning identity', async () => {
  const restore = withSupabaseEnv()
  const previousKey = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    const response = await generateLesson(jsonRequest({
      mode: 'proposal',
      proposal: {
        version: 1,
        learnerId: 'learner-1',
        generationSpec: {
          title: 'Fractions Focus',
          subject: 'math',
          difficulty: 'intermediate',
          grade: '4',
          description: 'Needs help comparing fractions with unlike denominators.',
          notes: '',
          vocab: '',
        },
      },
    }), {
      createClientImpl: createClientMock({
        admin: {
          from: createTableMock(),
          storage: { from: () => ({ upload: async () => ({ error: { message: 'storage offline' } }) }) },
        },
      }),
    })

    const json = await response.json()
    assert.equal(response.status, 500)
    assert.match(json.error, /Lesson storage failed: storage offline/)
    assert.equal(json.identity, undefined)
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
    restore()
  }
})

test('approval derives storage ownership from authenticated user', async () => {
  const restore = withSupabaseEnv()
  const paths = []
  try {
    const response = await approveLesson(jsonRequest({ file: 'fractions.json', userId: 'attacker-user' }), {
      createClientImpl: createClientMock({
        user: { id: 'real-user' },
        admin: {
          from: createTableMock(),
          storage: { from: () => ({
            download: async (path) => {
              paths.push(['download', path])
              return { data: new Blob([JSON.stringify({ title: 'Fractions', approved: false })], { type: 'application/json' }), error: null }
            },
            upload: async (path) => {
              paths.push(['upload', path])
              return { error: null }
            },
          }) },
        },
      }),
    })

    const json = await response.json()
    assert.equal(response.status, 200)
    assert.equal(json.ownerId, 'real-user')
    assert.deepEqual(paths.map((item) => item[1]), [
      'facilitator-lessons/real-user/fractions.json',
      'facilitator-lessons/real-user/fractions.json',
    ])
  } finally {
    restore()
  }
})

test('unapproved generated draft cannot become available', async () => {
  const restore = withSupabaseEnv()
  try {
    const response = await updateAvailability(jsonRequest({ learnerId: 'learner-1', lessonKey: 'generated/draft.json', available: true }), {
      createClientImpl: createClientMock({
        admin: {
          from: createTableMock({ learner: { id: 'learner-1', name: 'Ada', approved_lessons: {} } }),
          storage: { from: () => ({
            download: async () => ({ data: new Blob([JSON.stringify({ approved: false })], { type: 'application/json' }), error: null }),
          }) },
        },
      }),
    })

    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'Approve the lesson content before making it available')
  } finally {
    restore()
  }
})

test('inaccessible or deleted lesson can still be removed from availability', async () => {
  const restore = withSupabaseEnv()
  const updateCapture = {}
  let downloadCalls = 0
  try {
    const response = await updateAvailability(jsonRequest({ learnerId: 'learner-1', lessonKey: 'generated/deleted.json', available: false }), {
      createClientImpl: createClientMock({
        admin: {
          from: createTableMock({ learner: { id: 'learner-1', name: 'Ada', approved_lessons: { 'generated/deleted.json': true, 'math/live.json': true } }, updateCapture }),
          storage: { from: () => ({
            download: async () => {
              downloadCalls += 1
              return { data: null, error: { message: 'not found' } }
            },
          }) },
        },
      }),
    })

    const json = await response.json()
    assert.equal(response.status, 200)
    assert.equal(downloadCalls, 0)
    assert.deepEqual(json.approvedLessons, { 'math/live.json': true })
    assert.deepEqual(updateCapture.value, { approved_lessons: { 'math/live.json': true } })
  } finally {
    restore()
  }
})