import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { GET, POST } from '../../../api/facilitator/learners/lesson-availability/route.js'

function request(method, body) {
  return new Request('http://localhost/api/facilitator/learners/lesson-availability', {
    method, headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

function env() {
  const previous = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  return () => [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY] = previous
}

function clients({ learner, captures = {} } = {}) {
  const chain = (result) => { const value = { select: () => value, eq: () => value, or: () => value, maybeSingle: async () => result }; return value }
  const admin = {
    from(table) {
      if (table === 'learners') return {
        ...chain({ data: learner || null, error: null }),
        update: (value) => ({ eq: async () => { captures.update = value; return { error: null } } }),
      }
      if (table === 'syllabus_lesson_associations') return {
        select: () => chain({ data: null, error: null }),
        insert: (value) => ({ select: () => ({ single: async () => { captures.association = value; return { data: value, error: null } } }) }),
      }
      throw new Error(`Unexpected table ${table}`)
    },
    storage: { from: () => ({ download: async () => ({ data: new Blob([JSON.stringify({ approved: true, subject: 'math', title: 'Lesson' })]), error: null }) }) },
  }
  return (_url, key) => key === 'anon'
    ? { auth: { getUser: async () => ({ data: { user: { id: 'facilitator-1' } }, error: null }) } }
    : admin
}

test('lesson availability GET rejects unauthenticated requests', async () => {
  const response = await GET(new Request('http://localhost/api/facilitator/learners/lesson-availability?learnerId=learner-1&lessonKey=math/test.json'))
  assert.equal(response.status, 401)
})

test('lesson availability GET and POST reject another facilitator learner', async () => {
  const restore = env()
  try {
    const deps = { createClientImpl: clients({ learner: null }) }
    const get = await GET(new Request('http://localhost/api/facilitator/learners/lesson-availability?learnerId=other&lessonKey=math/test.json', { headers: { Authorization: 'Bearer token' } }), deps)
    const post = await POST(request('POST', { learnerId: 'other', lessonKey: 'math/test.json', available: false }), deps)
    assert.equal(get.status, 403)
    assert.equal(post.status, 403)
  } finally { restore() }
})

test('available=true preserves Grant behavior and canonical association creation', async () => {
  const restore = env()
  const captures = {}
  try {
    const response = await POST(request('POST', { learnerId: 'learner-1', lessonKey: 'generated/test.json', available: true }), { createClientImpl: clients({ learner: { id: 'learner-1', name: 'Avery', approved_lessons: {} }, captures }) })
    assert.equal(response.status, 200)
    assert.deepEqual(captures.update, { approved_lessons: { 'generated/test.json': true } })
    assert.equal(captures.association.lesson_key, 'generated/test.json')
  } finally { restore() }
})

test('available=false routes through the canonical removal service', () => {
  const route = fs.readFileSync(new URL('../../../api/facilitator/learners/lesson-availability/route.js', import.meta.url), 'utf8')
  assert.match(route, /available[\s\S]*removeLessonFromLearner\(\{/)
  assert.match(route, /facilitatorId: user\.id/)
})

test('lesson editor uses server binding truth and clear Remove from learner preservation copy', () => {
  const source = fs.readFileSync(new URL('../../../facilitator/lessons/edit/page.js', import.meta.url), 'utf8')
  assert.match(source, /lesson-availability\?\$\{params\}/)
  assert.match(source, /result\.currentlyBound \? \[learner\.id\] : \[\]/)
  assert.doesNotMatch(source, /\(learner\.approved_lessons \|\| \{\}\)\[lessonKey\]/)
  assert.match(source, /Remove from learner/)
  assert.match(source, /lesson itself was not deleted, and existing learning history was preserved/)
})
