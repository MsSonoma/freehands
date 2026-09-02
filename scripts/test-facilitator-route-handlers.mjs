import assert from 'node:assert/strict'
import test from 'node:test'

import { POST as approveLesson } from '../src/app/api/facilitator/lessons/approve/route.js'
import { POST as generateLesson } from '../src/app/api/facilitator/lessons/generate/route.js'
import { POST as updateAvailability } from '../src/app/api/facilitator/learners/lesson-availability/route.js'
import { POST as proposeLesson } from '../src/app/api/facilitator/lessons/propose/route.js'
import { GET as getLessonSchedule, POST as scheduleLesson } from '../src/app/api/lesson-schedule/route.js'
import { POST as preserveLessonAssociation } from '../src/app/api/syllabus/lesson-associations/route.js'

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

function createTableMock({ profile = { plan_tier: 'pro', subscription_tier: null }, learner = null, updateCapture = null, scheduleCapture = null, scheduleUpdateCapture = null, existingSchedule = null, associationCapture = null, associationState = null } = {}) {
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

    if (table === 'lesson_schedule') {
      const selection = {
        eq: () => selection,
        or: () => selection,
        maybeSingle: async () => ({ data: existingSchedule, error: null }),
      }
      return {
        select: () => selection,
        upsert: (value) => ({
          select: () => ({
            single: async () => {
              if (scheduleCapture) scheduleCapture.value = value
              return { data: { id: 'schedule-1', ...value }, error: null }
            },
          }),
        }),
        update: (value) => ({
          eq: () => ({
            select: () => ({ single: async () => {
              if (scheduleUpdateCapture) scheduleUpdateCapture.value = value
              return { data: { id: existingSchedule?.id || 'schedule-1', ...value }, error: null }
            } }),
          }),
        }),
      }
    }

    if (table === 'syllabus_lesson_associations') {
      const filters = {}
      const selection = {
        eq: (column, value) => {
          filters[column] = value
          return selection
        },
        maybeSingle: async () => ({ data: associationState ? { readiness_state: associationState } : null, error: null }),
      }
      return {
        select: () => selection,
        insert: (value) => ({
          select: () => ({ single: async () => {
            if (associationCapture) associationCapture.value = value
            return { data: { id: 1, ...value }, error: null }
          } }),
        }),
        update: (value) => {
          const updateSelection = {
            eq: () => updateSelection,
            select: () => ({ single: async () => {
              if (associationCapture) associationCapture.value = value
              return { data: { id: 1, ...value }, error: null }
            } }),
          }
          return updateSelection
        },
        upsert: (value) => ({
          select: () => ({ single: async () => {
            if (associationCapture) associationCapture.value = value
            return { data: { id: 1, ...value }, error: null }
          } }),
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

function generatedLessonStorage(lesson = { approved: true }, downloadError = null) {
  return {
    from: () => ({
      download: async () => downloadError
        ? { data: null, error: downloadError }
        : { data: new Blob([JSON.stringify(lesson)], { type: 'application/json' }), error: null },
    }),
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
          from: createTableMock({ learner: { id: 'learner-1' } }),
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
  let approved = false
  try {
    const response = await approveLesson(jsonRequest({ file: 'fractions.json', userId: 'attacker-user' }), {
      createClientImpl: createClientMock({
        user: { id: 'real-user' },
        admin: {
          from: createTableMock(),
          storage: { from: () => ({
            download: async (path) => {
              paths.push(['download', path])
              return { data: new Blob([JSON.stringify({ title: 'Fractions', approved })], { type: 'application/json' }), error: null }
            },
            update: async (path) => {
              paths.push(['update', path])
              approved = true
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

test('association API derives draft readiness and source instead of trusting client claims', async () => {
  const learnerId = '11111111-1111-4111-8111-111111111111'
  const associationCapture = {}
  const admin = {
    from: createTableMock({ learner: { id: learnerId }, associationCapture }),
    storage: generatedLessonStorage({ approved: false, subject: 'math', title: 'Draft fractions' }),
  }
  const response = await preserveLessonAssociation(jsonRequest({
    learnerId,
    lessonKey: 'generated/fractions.json',
    readinessState: 'available',
    associationSource: 'availability',
  }), { requestContext: { user: { id: 'facilitator-1' }, admin } })

  assert.equal(response.status, 200)
  assert.equal(associationCapture.value.readiness_state, 'draft')
  assert.equal(associationCapture.value.association_source, 'prepare')
})

test('schedule API still rejects missing authorization before entitlement checks', async () => {
  const restore = withSupabaseEnv()
  try {
    const response = await scheduleLesson(new Request('http://localhost.test/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerId: 'learner-1', lessonKey: 'math/live.json', scheduledDate: '2026-08-06' }),
    }), {
      createClientImpl: createClientMock({ admin: { from: createTableMock({ learner: { id: 'learner-1' } }) } }),
    })

    assert.equal(response.status, 401)
    assert.equal((await response.json()).error, 'Missing authorization')
  } finally {
    restore()
  }
})

test('schedule API rejects an invalid bearer token', async () => {
  const restore = withSupabaseEnv()
  try {
    const response = await scheduleLesson(jsonRequest({
      learnerId: 'learner-1',
      lessonKey: 'generated/live.json',
      scheduledDate: '2026-08-06',
    }), {
      createClientImpl: createClientMock({ user: null }),
    })

    assert.equal(response.status, 401)
    assert.equal((await response.json()).error, 'Unauthorized')
  } finally {
    restore()
  }
})

test('schedule API enforces centralized scheduling entitlement behavior', async () => {
  const restore = withSupabaseEnv()
  try {
    for (const profile of [
      { plan_tier: 'free', subscription_tier: null },
      { plan_tier: 'trial', subscription_tier: null },
    ]) {
      const response = await scheduleLesson(jsonRequest({ learnerId: 'learner-1', lessonKey: 'math/live.json', scheduledDate: '2026-08-06' }), {
        createClientImpl: createClientMock({
          admin: { from: createTableMock({ profile, learner: { id: 'learner-1' } }) },
        }),
      })
      assert.equal(response.status, 403)
      assert.equal((await response.json()).error, 'Scheduling requires a Standard plan or higher')
    }

    for (const { profile, label } of [
      { label: 'standard', profile: { plan_tier: 'standard', subscription_tier: null } },
      { label: 'pro', profile: { plan_tier: 'pro', subscription_tier: null } },
      { label: 'beta', profile: { plan_tier: 'free', subscription_tier: 'beta' } },
    ]) {
      const scheduleCapture = {}
      const response = await scheduleLesson(jsonRequest({ learnerId: 'learner-1', lessonKey: 'facilitator-lessons/live.json', scheduledDate: '2026-08-06' }), {
        inspectLearnerSyllabusPlacement: async () => ({ allowed: true }),
        createClientImpl: createClientMock({
          admin: {
            from: createTableMock({ profile, learner: { id: 'learner-1' }, scheduleCapture }),
            storage: generatedLessonStorage(),
          },
        }),
      })
      const json = await response.json()
      assert.equal(response.status, 200, label)
      assert.equal(json.success, true, label)
      assert.equal(json.data.lesson_key, 'generated/live.json', label)
      assert.deepEqual(scheduleCapture.value, {
        facilitator_id: 'facilitator-1',
        learner_id: 'learner-1',
        lesson_key: 'generated/live.json',
        scheduled_date: '2026-08-06',
      }, label)
    }

    for (const planTier of ['free', 'pro']) {
      const unauthorizedResponse = await scheduleLesson(jsonRequest({ learnerId: 'other-learner', lessonKey: 'math/live.json', scheduledDate: '2026-08-06' }), {
        createClientImpl: createClientMock({
          admin: { from: createTableMock({ profile: { plan_tier: planTier, subscription_tier: null }, learner: null }) },
        }),
      })
      assert.equal(unauthorizedResponse.status, 403, planTier)
      assert.equal((await unauthorizedResponse.json()).error, 'Learner not found or unauthorized', planTier)
    }
  } finally {
    restore()
  }
})

test('action=active authorizes learner ownership before querying service-role schedule data', async () => {
  const restore = withSupabaseEnv()
  try {
    let scheduleQueries = 0
    const response = await getLessonSchedule(new Request('http://localhost.test/api/lesson-schedule?action=active&learnerId=other-learner', {
      headers: { Authorization: 'Bearer test-token' },
    }), {
      createClientImpl: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'facilitator-1' } }, error: null }) },
        from: (table) => {
          if (table === 'learners') return { select: () => ({ eq: () => ({ or: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }
          if (table === 'lesson_schedule') { scheduleQueries += 1; throw new Error('schedule must not be queried') }
          throw new Error(`Unexpected table: ${table}`)
        },
      }),
    })
    assert.equal(response.status, 403)
    assert.equal(scheduleQueries, 0)
  } finally {
    restore()
  }
})

test('schedule API requires a valid Facilitator PIN for a Syllabus capacity exception', async () => {
  const restore = withSupabaseEnv()
  try {
    const admin = {
      from: createTableMock({ profile: { plan_tier: 'standard', subscription_tier: null }, learner: { id: 'learner-1' }, scheduleCapture: {} }),
      storage: generatedLessonStorage(),
    }
    const deps = {
      createClientImpl: createClientMock({ admin }),
      inspectLearnerSyllabusPlacement: async () => ({ allowed: false, conflict: 'daily_capacity', message: 'Tuesday is full. Enter the Facilitator PIN.' }),
      verifyFacilitatorPinForUser: async (_admin, userId, pin) => userId === 'facilitator-1' && pin === '2468',
    }
    const blocked = await scheduleLesson(jsonRequest({ learnerId: 'learner-1', lessonKey: 'facilitator-lessons/live.json', scheduledDate: '2026-08-06' }), deps)
    assert.equal(blocked.status, 409)
    assert.equal((await blocked.json()).code, 'SYLLABUS_CAPACITY_PIN_REQUIRED')

    const rejected = await scheduleLesson(jsonRequest({ learnerId: 'learner-1', lessonKey: 'facilitator-lessons/live.json', scheduledDate: '2026-08-06', exceptionPin: '0000' }), deps)
    assert.equal(rejected.status, 403)
    assert.equal((await rejected.json()).code, 'INVALID_FACILITATOR_PIN')

    const approved = await scheduleLesson(jsonRequest({ learnerId: 'learner-1', lessonKey: 'facilitator-lessons/live.json', scheduledDate: '2026-08-06', exceptionPin: '2468' }), deps)
    assert.equal(approved.status, 200)
    assert.equal((await approved.json()).success, true)
  } finally {
    restore()
  }
})

test('reschedule updates the identified occurrence instead of inserting a duplicate date row', async () => {
  const restore = withSupabaseEnv()
  try {
    const scheduleCapture = {}
    const scheduleUpdateCapture = {}
    let excludedId = null
    const response = await scheduleLesson(jsonRequest({
      learnerId: 'learner-1',
      lessonKey: 'facilitator-lessons/live.json',
      scheduledDate: '2026-08-07',
      scheduleId: 'schedule-existing',
    }), {
      createClientImpl: createClientMock({ admin: {
        from: createTableMock({
          profile: { plan_tier: 'standard', subscription_tier: null },
          learner: { id: 'learner-1' },
          existingSchedule: { id: 'schedule-existing', learner_id: 'learner-1', lesson_key: 'generated/live.json', scheduled_date: '2026-08-06' },
          scheduleCapture,
          scheduleUpdateCapture,
        }),
        storage: generatedLessonStorage(),
      } }),
      inspectLearnerSyllabusPlacement: async ({ excludeScheduleId }) => { excludedId = excludeScheduleId; return { allowed: true } },
    })
    assert.equal(response.status, 200)
    assert.equal(excludedId, 'schedule-existing')
    assert.equal(scheduleCapture.value, undefined)
    assert.deepEqual(scheduleUpdateCapture.value, {
      facilitator_id: 'facilitator-1', learner_id: 'learner-1', lesson_key: 'generated/live.json', scheduled_date: '2026-08-07',
    })
  } finally {
    restore()
  }
})

test('schedule API denies unapproved or inaccessible generated lessons', async () => {
  const restore = withSupabaseEnv()
  try {
    const cases = [
      {
        label: 'unapproved',
        storage: generatedLessonStorage({ approved: false }),
        error: 'Approve the lesson content before scheduling it',
      },
      {
        label: 'inaccessible',
        storage: generatedLessonStorage(null, { message: 'not found' }),
        error: 'Lesson not found or unauthorized',
      },
    ]

    for (const item of cases) {
      const response = await scheduleLesson(jsonRequest({
        learnerId: 'learner-1',
        lessonKey: 'generated/draft.json',
        scheduledDate: '2026-08-06',
      }), {
        createClientImpl: createClientMock({
          admin: {
            from: createTableMock({
              profile: { plan_tier: 'standard', subscription_tier: null },
              learner: { id: 'learner-1' },
            }),
            storage: item.storage,
          },
        }),
      })

      assert.equal(response.status, 403, item.label)
      assert.equal((await response.json()).error, item.error, item.label)
    }
  } finally {
    restore()
  }
})
