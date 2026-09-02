import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  MaterializationGenerationError,
  materializationArtifactIdentity,
  recoverOrGenerateMaterializationArtifact,
} from '../materializationGenerator.server.mjs'

const OPERATION = Object.freeze({
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  syllabusId: '11111111-1111-4111-8111-111111111111',
  lineageId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  generationInputHash: 'a'.repeat(64),
  facilitatorId: '22222222-2222-4222-8222-222222222222',
  learnerId: '33333333-3333-4333-8333-333333333333',
})

function harness() {
  const artifacts = new Map()
  const state = { modelCalls: 0, quotaCharges: 0, associations: 0, finalized: false }
  const callbacks = {
    loadArtifact: async (identity) => structuredClone(artifacts.get(identity.storagePath) || null),
    generateArtifact: async () => {
      state.modelCalls++
      return { id: 'generated', title: 'Exact lesson', subject: 'math', grade: '5th', difficulty: 'intermediate' }
    },
    createArtifact: async (identity, lesson) => {
      if (artifacts.has(identity.storagePath)) return false
      artifacts.set(identity.storagePath, structuredClone(lesson))
      return true
    },
    associateArtifact: async () => { state.associations++ },
    finalizeOperation: async () => {
      if (!state.finalized) {
        state.finalized = true
        state.quotaCharges++
      }
      return { status: 'generated' }
    },
  }
  return { artifacts, state, callbacks }
}

test('generator success followed by process death recovers the exact artifact without model or quota replay', async () => {
  const h = harness()
  await assert.rejects(recoverOrGenerateMaterializationArtifact({
    operation: OPERATION,
    ...h.callbacks,
    afterArtifactCreated: async () => { throw new Error('simulated process death') },
  }), /simulated process death/)
  assert.equal(h.artifacts.size, 1)
  assert.deepEqual({ modelCalls: h.state.modelCalls, quotaCharges: h.state.quotaCharges }, { modelCalls: 1, quotaCharges: 0 })

  const recovered = await recoverOrGenerateMaterializationArtifact({ operation: OPERATION, recoverOnly: true, ...h.callbacks })
  assert.equal(recovered.recovered, true)
  assert.equal(recovered.identity.lessonKey, `generated/syllabus-materialization-${OPERATION.id}.json`)
  assert.deepEqual({ modelCalls: h.state.modelCalls, quotaCharges: h.state.quotaCharges }, { modelCalls: 1, quotaCharges: 1 })

  await recoverOrGenerateMaterializationArtifact({ operation: OPERATION, recoverOnly: true, ...h.callbacks })
  assert.deepEqual({ modelCalls: h.state.modelCalls, quotaCharges: h.state.quotaCharges }, { modelCalls: 1, quotaCharges: 1 })
})

test('concurrent exact recovery remains one artifact and one quota finalization', async () => {
  const h = harness()
  const identity = materializationArtifactIdentity(OPERATION)
  await recoverOrGenerateMaterializationArtifact({ operation: OPERATION, ...h.callbacks })
  h.state.finalized = false
  h.state.quotaCharges = 0
  await Promise.all([
    recoverOrGenerateMaterializationArtifact({ operation: OPERATION, recoverOnly: true, ...h.callbacks }),
    recoverOrGenerateMaterializationArtifact({ operation: OPERATION, recoverOnly: true, ...h.callbacks }),
  ])
  assert.equal(h.artifacts.size, 1)
  assert.ok(h.artifacts.has(identity.storagePath))
  assert.equal(h.state.quotaCharges, 1)
  assert.equal(h.state.modelCalls, 1)
})

test('ambiguous recovery and wrong authority never trigger blind generation', async () => {
  const h = harness()
  await assert.rejects(
    recoverOrGenerateMaterializationArtifact({ operation: OPERATION, recoverOnly: true, ...h.callbacks }),
    (error) => error instanceof MaterializationGenerationError && error.code === 'MATERIALIZATION_RECOVERY_REQUIRED',
  )
  assert.equal(h.state.modelCalls, 0)

  await recoverOrGenerateMaterializationArtifact({ operation: OPERATION, ...h.callbacks })
  const wrongLearner = { ...OPERATION, learnerId: '44444444-4444-4444-8444-444444444444' }
  await assert.rejects(
    recoverOrGenerateMaterializationArtifact({ operation: wrongLearner, recoverOnly: true, ...h.callbacks }),
    (error) => error.code === 'MATERIALIZATION_ARTIFACT_MISMATCH',
  )
  const wrongFacilitator = { ...OPERATION, facilitatorId: '55555555-5555-4555-8555-555555555555' }
  await assert.rejects(
    recoverOrGenerateMaterializationArtifact({ operation: wrongFacilitator, recoverOnly: true, ...h.callbacks }),
    (error) => error.code === 'MATERIALIZATION_RECOVERY_REQUIRED',
  )
  assert.equal(h.state.modelCalls, 1)
})

test('new operation uses a distinct canonical identity and normal quota boundary', async () => {
  const h = harness()
  const next = { ...OPERATION, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', lineageId: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', generationInputHash: 'b'.repeat(64) }
  await recoverOrGenerateMaterializationArtifact({ operation: OPERATION, ...h.callbacks })
  h.state.finalized = false
  await recoverOrGenerateMaterializationArtifact({ operation: next, ...h.callbacks })
  assert.equal(h.artifacts.size, 2)
  assert.equal(h.state.modelCalls, 2)
  assert.equal(h.state.quotaCharges, 2)
})

test('follow-up migration makes recovery explicit and quota finalization atomic and service-role-only', () => {
  const sql = fs.readFileSync('supabase/migrations/20260901160538_add_materialization_generation_recovery.sql', 'utf8')
  assert.match(sql, /recovery_required/)
  assert.match(sql, /for update of materialization/i)
  assert.match(sql, /charged_at is null/i)
  assert.match(sql, /lifetime_generations_used = coalesce\(lifetime_generations_used, 0\) \+ 1/i)
  assert.match(sql, /revoke all on function public\.complete_syllabus_materialization_generation[\s\S]*public, anon, authenticated, service_role/i)
  assert.match(sql, /grant execute on function public\.complete_syllabus_materialization_generation[\s\S]*to service_role/i)
  assert.doesNotMatch(sql, /interval|older than|delete from public\.syllabus_forecast_materializations/i)
  const materialization = fs.readFileSync('src/app/lib/syllabus/materialization.server.mjs', 'utf8')
  const generator = fs.readFileSync('src/app/api/facilitator/lessons/generate/route.js', 'utf8')
  assert.match(materialization, /recoverOnly: claim\.claimed !== true/)
  assert.match(generator, /upsert: false/)
  assert.doesNotMatch(`${materialization}\n${generator}`, /lesson_schedule|scheduleLesson/)
})
