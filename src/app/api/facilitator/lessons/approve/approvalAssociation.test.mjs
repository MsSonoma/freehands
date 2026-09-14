import assert from 'node:assert/strict'
import test from 'node:test'
import { POST } from './route.js'

const OWNER = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function fixture({ unauthorized = false, associationFails = false, updateFails = false } = {}) {
  const state = { lesson: { title: 'Fractions', subject: 'math', approved: false }, writes: 0, reads: 0, associations: [], associationFails }
  const admin = {
    from(table) {
      let mutation
      const q = {
        select: () => q, eq: () => q, or: () => q,
        async maybeSingle() {
          if (table === 'profiles') return { data: { plan_tier: 'pro' }, error: null }
          if (table === 'learners') return { data: unauthorized ? null : { id: LEARNER }, error: null }
          if (table === 'syllabus_lesson_associations') return { data: state.associations.at(-1) || null, error: null }
          throw new Error('Unexpected table ' + table)
        },
        insert: value => { mutation = value; return q },
        update: value => { mutation = value; return q },
        async single() {
          if (state.associationFails) return { data: null, error: { message: 'controlled association failure' } }
          state.associations.push(mutation)
          return { data: mutation, error: null }
        },
      }
      return q
    },
    storage: { from() { return {
      async download() { state.reads++; return { data: { text: async () => JSON.stringify(state.lesson) }, error: null } },
      async update(path, content) { if (updateFails) return { error: { message: 'offline' } }; state.writes++; state.lesson = JSON.parse(content); return { error: null } },
    } } },
  }
  const invoke = async (includeLearner = true) => {
    const old = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    try {
      const request = new Request('https://app.test/api/facilitator/lessons/approve', { method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ file: 'fractions.json', ...(includeLearner ? { learnerId: LEARNER } : {}) }) })
      const response = await POST(request, { createClientImpl: (_, key) => key === 'anon' ? { auth: { getUser: async () => ({ data: { user: { id: OWNER } } }) } } : admin, sleepImpl: async () => {} })
      return { status: response.status, body: await response.json() }
    } finally {
      for (const [index, key] of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'].entries()) {
        if (old[index] === undefined) delete process.env[key]; else process.env[key] = old[index]
      }
    }
  }
  return { state, invoke }
}
test('approval confirms storage and the owned learner association in one response', async () => {
  const h = fixture(), result = await h.invoke()
  assert.equal(result.status, 200)
  assert.equal(result.body.lesson.approved, true)
  assert.equal(result.body.association.learner_id, LEARNER)
  assert.equal(result.body.association.facilitator_id, OWNER)
  assert.equal(result.body.association.lesson_key, 'generated/fractions.json')
  assert.equal(result.body.association.readiness_state, 'approved')
  assert.equal(h.state.writes, 1)
  assert.equal(h.state.reads, 2, 'initial and confirmation only; no second association storage lookup')
})
test('unowned learner is rejected before storage approval', async () => {
  const h = fixture({ unauthorized: true }), result = await h.invoke()
  assert.equal(result.status, 403)
  assert.equal(h.state.reads, 0)
  assert.equal(h.state.writes, 0)
})
test('association failure is recoverable and retry does not approve the artifact twice', async () => {
  const h = fixture({ associationFails: true })
  const failed = await h.invoke()
  assert.equal(failed.status, 503)
  assert.equal(failed.body.code, 'APPROVAL_ASSOCIATION_FAILED')
  assert.equal(h.state.lesson.approved, true)
  h.state.associationFails = false
  const retried = await h.invoke()
  assert.equal(retried.status, 200)
  assert.equal(retried.body.association.readiness_state, 'approved')
  assert.equal(h.state.writes, 1)
})
test('storage failure cannot mark the learner association approved', async () => {
  const h = fixture({ updateFails: true }), result = await h.invoke()
  assert.equal(result.status, 500)
  assert.equal(h.state.associations.length, 0)
})
test('file-only legacy approval callers remain compatible', async () => {
  const h = fixture(), result = await h.invoke(false)
  assert.equal(result.status, 200)
  assert.equal(result.body.approved, true)
  assert.equal(h.state.associations.length, 0)
})
