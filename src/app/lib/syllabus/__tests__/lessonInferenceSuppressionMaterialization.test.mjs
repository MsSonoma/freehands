import assert from 'node:assert/strict'
import test from 'node:test'

import { materializeForecastOccurrence } from '../materialization.server.mjs'

const FACILITATOR_ID = '22222222-2222-4222-8222-222222222222'
const LEARNER_ID = '33333333-3333-4333-8333-333333333333'
const SYLLABUS_ID = '11111111-1111-4111-8111-111111111111'
const REVISION_ID = '44444444-4444-4444-8444-444444444444'
const LINEAGE_ID = '55555555-5555-4555-8555-555555555555'
const LESSON_KEY = 'generated/materialized-lesson.json'
const RECEIPT_ID = '66666666-6666-4666-8666-666666666666'
const NOW = new Date('2026-09-04T16:00:00.000Z')

function fixture({ reused = false, bindFailure = null, boundReceiptFailure = null } = {}) {
  const order = []
  const receiptUpdates = []
  const item = {
    id: '77777777-7777-4777-8777-777777777777',
    revision_id: REVISION_ID,
    lineage_id: LINEAGE_ID,
    planned_date: '2026-09-07',
    subject: 'math',
    title: 'Fractions on a number line',
    description: 'Place and compare fractions.',
    lesson_key: reused ? LESSON_KEY : null,
    item_type: 'lesson',
    origin: 'facilitator',
    sort_order: 0,
    metadata: {},
  }
  const revision = {
    id: REVISION_ID,
    syllabus_id: SYLLABUS_ID,
    revision_number: 1,
    base_revision_id: null,
    effective_from: '2026-09-04',
    schema_version: 1,
    goals: { learning: 'Build conceptual fluency.' },
    subjects: [{ name: 'math' }, { name: 'science' }],
    weekly_pattern: { monday: [{ subject: 'math' }], tuesday: [{ subject: 'science' }] },
    teaching_guidance: { curriculum_preferences: { focus_topics: ['fractions'] } },
    planning_policy: { difficulty: 'intermediate' },
    legacy_provenance: { sources: {} },
    change_reason: 'Active plan',
    activated_at: NOW.toISOString(),
    proposal_kind: null,
  }
  const syllabus = {
    id: SYLLABUS_ID,
    facilitator_id: FACILITATOR_ID,
    learner_id: LEARNER_ID,
    active_revision_id: REVISION_ID,
  }
  const state = {
    learner: { id: LEARNER_ID, facilitator_id: FACILITATOR_ID, grade: '5th' },
    syllabus,
    revisions: [revision],
    forecast: [item],
    receipts: [],
  }
  let sequence = 1
  const clone = (value) => value == null ? value : structuredClone(value)
  const methods = {
    findOwnedLearner: async (learnerId, facilitatorId) => learnerId === LEARNER_ID && facilitatorId === FACILITATOR_ID ? clone(state.learner) : null,
    findSyllabus: async (facilitatorId, learnerId) => facilitatorId === FACILITATOR_ID && learnerId === LEARNER_ID ? clone(state.syllabus) : null,
    findFacilitatorTimeZone: async () => 'America/New_York',
    findLatestLearningForecastProposal: async () => null,
    findRevision: async (id, syllabusId) => clone(state.revisions.find((row) => row.id === id && row.syllabus_id === syllabusId) || null),
    listForecastItems: async (revisionId) => clone(state.forecast.filter((row) => row.revision_id === revisionId)),
    claimForecastMaterialization: async ({ syllabusId, lineageId, generationInputHash }) => {
      const receipt = {
        id: RECEIPT_ID,
        syllabus_id: syllabusId,
        lineage_id: lineageId,
        generation_input_hash: generationInputHash,
        lesson_key: null,
        status: 'generating',
      }
      state.receipts.push(receipt)
      return { claimed: true, receipt: clone(receipt) }
    },
    updateForecastMaterialization: async (id, patch) => {
      receiptUpdates.push(structuredClone(patch))
      if (patch.status === 'bound') {
        order.push('receipt:bound')
        if (boundReceiptFailure) throw boundReceiptFailure
      }
      Object.assign(state.receipts.find((row) => row.id === id), clone(patch))
    },
    nextRevisionNumber: async () => Math.max(...state.revisions.map((row) => row.revision_number || 0)) + 1,
    insertRevision: async (row) => {
      const saved = { ...clone(row), id: `bound-${++sequence}`, activated_at: null }
      state.revisions.push(saved)
      return clone(saved)
    },
    insertForecastItems: async (revisionId, rows) => {
      state.forecast.push(...rows.map((row, index) => ({ ...clone(row), id: `bound-item-${sequence}-${index}`, revision_id: revisionId })))
    },
    commitRevisionActivation: async ({ revisionId, expectedActiveRevisionId }) => {
      if (bindFailure) throw bindFailure
      assert.equal(state.syllabus.active_revision_id, expectedActiveRevisionId)
      const activated = state.revisions.find((row) => row.id === revisionId)
      activated.activated_at = NOW.toISOString()
      state.syllabus.active_revision_id = revisionId
      order.push('bind')
      return clone(activated)
    },
    deleteInactiveRevision: async (revisionId) => {
      state.revisions = state.revisions.filter((row) => row.id !== revisionId)
      state.forecast = state.forecast.filter((row) => row.revision_id !== revisionId)
    },
  }
  return {
    repository: methods,
    order,
    receiptUpdates,
    state,
    item,
    revision,
    syllabus,
  }
}

function args(h, setInferenceSuppressed) {
  return {
    repository: h.repository,
    admin: { kind: 'test-admin' },
    facilitatorId: FACILITATOR_ID,
    learnerId: LEARNER_ID,
    lineageId: LINEAGE_ID,
    expectedActiveRevisionId: REVISION_ID,
    generateLesson: async () => ({ lessonKey: LESSON_KEY }),
    setInferenceSuppressed,
    now: NOW,
  }
}

function capturingSetter(calls, implementation = async () => {}) {
  return async (input) => {
    calls.push(structuredClone(input))
    assert.equal(input.suppressed, false, 'materialization must never set suppression true')
    return implementation(input)
  }
}

test('new materialization binds, persists bound receipt, then clears suppression with exact arguments', async () => {
  const h = fixture()
  const setterCalls = []
  const result = await materializeForecastOccurrence(args(h, capturingSetter(setterCalls, async () => {
    h.order.push('suppression:clear')
  })))

  assert.equal(result.reused, false)
  assert.deepEqual(h.order, ['bind', 'receipt:bound', 'suppression:clear'])
  assert.equal(h.order.indexOf('suppression:clear') > h.order.indexOf('bind'), true)
  assert.equal(h.order.indexOf('suppression:clear') > h.order.indexOf('receipt:bound'), true)
  assert.deepEqual(setterCalls, [{
    admin: { kind: 'test-admin' },
    facilitatorId: FACILITATOR_ID,
    learnerId: LEARNER_ID,
    lessonKey: LESSON_KEY,
    suppressed: false,
    verifyLearner: false,
  }])
})

test('bind failure never clears suppression', async () => {
  const bindError = new Error('bind failed')
  const h = fixture({ bindFailure: bindError })
  const setterCalls = []
  await assert.rejects(materializeForecastOccurrence(args(h, capturingSetter(setterCalls))), /could not be bound/i)
  assert.equal(setterCalls.length, 0)
})

test('bound receipt failure never clears suppression', async () => {
  const h = fixture({ boundReceiptFailure: new Error('bound receipt failed') })
  const setterCalls = []
  await assert.rejects(materializeForecastOccurrence(args(h, capturingSetter(setterCalls))), /could not be bound/i)
  assert.equal(setterCalls.length, 0)
})

test('clear failure after successful bind propagates without relabeling the receipt binding_failed', async () => {
  const h = fixture()
  const setterCalls = []
  await assert.rejects(
    materializeForecastOccurrence(args(h, capturingSetter(setterCalls, async () => { throw new Error('clear failed') }))),
    /clear failed/,
  )
  assert.equal(setterCalls.length, 1)
  assert.equal(h.receiptUpdates.some((patch) => patch.status === 'bound'), true)
  assert.equal(h.receiptUpdates.some((patch) => patch.status === 'binding_failed'), false)
})

test('reused materialization clears suppression before returning and does not mutate binding', async () => {
  const h = fixture({ reused: true })
  const setterCalls = []
  const result = await materializeForecastOccurrence(args(h, capturingSetter(setterCalls, async () => {
    h.order.push('suppression:clear')
  })))
  h.order.push('returned')

  assert.equal(result.reused, true)
  assert.deepEqual(h.order, ['suppression:clear', 'returned'])
  assert.equal(setterCalls.length, 1)
  assert.deepEqual(h.receiptUpdates, [])
})

test('reused materialization propagates clear failure without mutating binding', async () => {
  const h = fixture({ reused: true })
  const setterCalls = []
  await assert.rejects(
    materializeForecastOccurrence(args(h, capturingSetter(setterCalls, async () => { throw new Error('reused clear failed') }))),
    /reused clear failed/,
  )
  assert.equal(setterCalls.length, 1)
  assert.deepEqual(h.receiptUpdates, [])
})

test('missing association is a local no-op for new and reused materialization', async () => {
  const missing = () => {
    const error = new Error('association missing')
    error.code = 'LESSON_ASSOCIATION_NOT_FOUND'
    throw error
  }
  const newFixture = fixture()
  const reusedFixture = fixture({ reused: true })
  const newCalls = []
  const reusedCalls = []

  const newlyBound = await materializeForecastOccurrence(args(newFixture, capturingSetter(newCalls, missing)))
  const reused = await materializeForecastOccurrence(args(reusedFixture, capturingSetter(reusedCalls, missing)))

  assert.equal(newlyBound.reused, false)
  assert.equal(reused.reused, true)
  assert.equal(newCalls.length, 1)
  assert.equal(reusedCalls.length, 1)
})

test('setter errors other than missing association propagate', async () => {
  const h = fixture({ reused: true })
  const setterCalls = []
  const error = new Error('permission denied')
  error.code = 'SETTER_PERMISSION_DENIED'
  await assert.rejects(
    materializeForecastOccurrence(args(h, capturingSetter(setterCalls, async () => { throw error }))),
    (caught) => caught === error,
  )
  assert.equal(setterCalls.length, 1)
})
