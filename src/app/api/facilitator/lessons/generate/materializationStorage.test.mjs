import assert from 'node:assert/strict'
import test from 'node:test'
import { StorageClient } from '@supabase/storage-js'
import { POST } from './route.js'
const OWNER = '11111111-1111-4111-8111-111111111111'
const LEARNER = '22222222-2222-4222-8222-222222222222'
const operation = { id: '33333333-3333-4333-8333-333333333333', syllabusId: '44444444-4444-4444-8444-444444444444', lineageId: '55555555-5555-4555-8555-555555555555', generationInputHash: 'a'.repeat(64), recoverOnly: false }
function harness(t, mode = 'missing') {
  const keys = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']
  const before = keys.map(key => process.env[key])
  keys.forEach((key, i) => { process.env[key] = ['http://supabase.test','anon-test','service-test'][i] })
  t.after(() => keys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i] }))
  const state = { modelCalls: 0, uploads: 0, finalized: 0, association: null, artifact: null, mode }
  const transport = async (url, options = {}) => {
    assert.ok(String(url).startsWith('http://supabase.test/storage/v1/'))
    if (options.method === 'GET') {
      if (state.artifact) return new Response(JSON.stringify(state.artifact), { status: 200 })
      if (state.mode === 'missing') return new Response(JSON.stringify({ statusCode: '404', code: 'NoSuchKey', error: 'not_found', message: 'Object not found' }), { status: 400 })
      if (state.mode === 'bucket') return new Response(JSON.stringify({ statusCode: '404', code: 'NoSuchBucket', message: 'Bucket not found' }), { status: 400 })
      return new Response(JSON.stringify({ code: 'AccessDenied', message: 'Access denied' }), { status: 403 })
    }
    assert.equal(options.method, 'POST')
    state.uploads++
    state.artifact = JSON.parse(options.body)
    return new Response(JSON.stringify({ Key: 'exact' }), { status: 200 })
  }
  // Uses the installed SDK, including its download/noResolveJson error wrapper.
  const storage = new StorageClient('http://supabase.test/storage/v1', {}, transport)
  const admin = {
    storage,
    from(table) {
      const rows = { profiles: { subscription_tier: 'pro', plan_tier: 'pro' }, learners: { id: LEARNER }, syllabi: { id: operation.syllabusId, facilitator_id: OWNER, learner_id: LEARNER }, syllabus_forecast_materializations: { id: operation.id, status: 'generating' }, syllabus_lesson_associations: state.association }
      assert.ok(Object.hasOwn(rows, table), `Unexpected table ${table}`)
      let mutation
      const builder = {
        select() { return this }, eq() { return this }, or() { return this },
        insert(value) { mutation = value; return this }, update(value) { mutation = { ...state.association, ...value }; return this },
        async maybeSingle() { return { data: rows[table], error: null } },
        async single() { state.association = mutation; return { data: mutation, error: null } },
      }
      return builder
    },
    async rpc(name, args) { assert.equal(name, 'complete_syllabus_materialization_generation'); assert.equal(args.p_receipt_id, operation.id); state.finalized = 1; return { data: { status: 'generated' }, error: null } },
  }
  const invoke = async (recoverOnly = false) => POST(new Request('http://localhost.test/api/facilitator/lessons/generate', {
    method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'proposal', learnerId: LEARNER, proposal: { version: 1, learnerId: LEARNER, generationSpec: { title: 'Fractions', subject: 'math', grade: '4th', difficulty: 'intermediate', description: 'Compare fractions.' } } }),
  }), {
    createClientImpl: (url, key) => key === 'anon-test' ? { auth: { getUser: async () => ({ data: { user: { id: OWNER } } }) } } : admin,
    materializationOperation: { ...operation, recoverOnly },
    callModel: async () => { state.modelCalls++; return { title: 'Fractions', subject: 'math', grade: '4th', difficulty: 'intermediate' } },
  })
  return { state, invoke }
}
test('real generator route and installed storage SDK continue after the exact wrapped missing-object response', async t => {
  const { state, invoke } = harness(t)
  const response = await invoke()
  const json = await response.json()
  assert.equal(response.status, 200, JSON.stringify(json))
  assert.equal(state.modelCalls, 1)
  assert.equal(state.uploads, 1)
  assert.equal(state.artifact.approved, false)
  assert.equal(state.association.readiness_state, 'draft')
  assert.equal(json.lessonKey, `generated/syllabus-materialization-${operation.id}.json`)
  const recovered = await invoke(true)
  assert.equal(recovered.status, 200)
  assert.equal((await recovered.json()).lessonKey, json.lessonKey)
  assert.equal(state.modelCalls, 1)
  assert.equal(state.uploads, 1)
  assert.equal(state.finalized, 1)
})
for (const mode of ['bucket','permission']) test(`${mode} error never reaches the model or writes a lesson`, async t => {
  const { state, invoke } = harness(t, mode)
  const response = await invoke()
  assert.equal(response.status, 500)
  assert.equal(state.modelCalls, 0)
  assert.equal(state.uploads, 0)
})
test('recovery-only with no artifact remains fail-closed despite confirmed absence', async t => {
  const { state, invoke } = harness(t)
  const response = await invoke(true)
  assert.equal(response.status, 409)
  assert.equal((await response.json()).code, 'MATERIALIZATION_RECOVERY_REQUIRED')
  assert.equal(state.modelCalls, 0)
})
