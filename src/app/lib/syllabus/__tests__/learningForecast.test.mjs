import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { buildInstructionalForecastPlan, buildLearningForecastSnapshot, instructionalEvidenceContext, instructionalSlotsForWeek } from '../learningForecast.mjs'
import { aggregateFacilitatorEvidenceSession } from '../../masteryEvidence/reporting.js'
import { createLearningForecastProposal } from '../learningForecast.server.mjs'
import { materializeForecastOccurrence, reconstructForecastCarryForward } from '../materialization.server.mjs'
import { composeSyllabusLessonTimeline } from '../lessonTimeline.mjs'
import { activateProposedSyllabus, adoptLearningForecastLineage, carryForwardLearningForecastProposal } from '../revisions.server.mjs'
import { validateSnapshot } from '../schema.mjs'
import { syllabusItemActionsFor } from '../timeline.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SYLLABUS = 'syllabus-1'
const ACTIVE = 'revision-1'
const NOW = new Date('2026-08-31T14:00:00.000Z')
const LINEAGE_A = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const LINEAGE_B = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const LINEAGE_C = 'cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa'
const preserveInferenceSuppression = async () => {}

function activeRevision() {
  return {
    id: ACTIVE, syllabus_id: SYLLABUS, revision_number: 1, base_revision_id: null,
    effective_from: '2026-08-31', schema_version: 1,
    goals: { learning: 'Build conceptual fluency.' },
    subjects: [{ name: 'math' }, { name: 'science' }],
    weekly_pattern: { monday: [{ subject: 'math' }], tuesday: [{ subject: 'science' }] },
    teaching_guidance: { curriculum_preferences: { focus_topics: ['fractions'] } },
    planning_policy: { difficulty: 'intermediate' }, legacy_provenance: { sources: {} },
    change_reason: 'Active plan', activated_at: NOW.toISOString(), proposal_kind: null,
  }
}

function item(overrides = {}) {
  return {
    id: 'item-a', revision_id: ACTIVE, lineage_id: LINEAGE_A, planned_date: '2026-09-07',
    subject: 'math', title: 'Educator-authored fractions', description: 'Preserve this intent.',
    lesson_key: null, item_type: 'lesson', origin: 'facilitator', sort_order: 0, metadata: {},
    ...overrides,
  }
}

function evidence(headline = 'Ready to progress') {
  return [{
    report_version: 'facilitator-evidence-v1',
    lesson: { key: 'math/fractions.json', title: 'Fractions', subject: 'math' },
    completeness: { state: 'complete' }, baseline: { state: 'established' },
    independent_evidence: { state: 'independent_success' }, retention: { state: 'not_measured' },
    learning_summary: { headline, narrative: 'Used equivalent models.', unresolved: { label: 'None' } },
    transcript: 'SECRET RAW TRANSCRIPT', events: [{ raw: true }],
  }]
}

function forecastRepository({ forecast = [item()] } = {}) {
  const state = {
    learner: { id: LEARNER, facilitator_id: FACILITATOR, name: 'Avery', grade: '5th', approved_lessons: {} },
    syllabus: { id: SYLLABUS, facilitator_id: FACILITATOR, learner_id: LEARNER, active_revision_id: ACTIVE },
    revisions: [activeRevision()], forecast: structuredClone(forecast), receipts: [], writes: 0,
    failCommitOnce: false,
  }
  let sequence = 1
  const clone = (value) => value == null ? value : structuredClone(value)
  const repository = {
    state,
    async findOwnedLearner(learnerId, facilitatorId) { return learnerId === LEARNER && facilitatorId === FACILITATOR ? clone(state.learner) : null },
    async findSyllabus(facilitatorId, learnerId) { return facilitatorId === FACILITATOR && learnerId === LEARNER ? clone(state.syllabus) : null },
    async findRevision(id, syllabusId) { return clone(state.revisions.find((row) => row.id === id && row.syllabus_id === syllabusId) || null) },
    async listForecastItems(revisionId) { return clone(state.forecast.filter((row) => row.revision_id === revisionId)) },
    async findFacilitatorTimeZone() { return 'America/New_York' },
    async findLatestLearningForecastProposal(syllabusId, baseRevisionId) {
      return clone(state.revisions.filter((row) => row.syllabus_id === syllabusId && row.base_revision_id === baseRevisionId && row.proposal_kind === 'learning_forecast' && !row.activated_at).at(-1) || null)
    },
    async replaceLearningForecastProposal({ syllabusId, expectedActiveRevisionId, planning, proposalKey }) {
      assert.equal(state.syllabus.active_revision_id, expectedActiveRevisionId)
      const existing = state.revisions.find((row) => row.proposal_kind === 'learning_forecast' && row.base_revision_id === expectedActiveRevisionId && !row.activated_at)
      if (existing?.proposal_key === proposalKey) return { revision: clone(existing), reused: true }
      if (existing) {
        state.revisions = state.revisions.filter((row) => row.id !== existing.id)
        state.forecast = state.forecast.filter((row) => row.revision_id !== existing.id)
      }
      const revision = { ...clone(planning), id: `learning-${++sequence}`, syllabus_id: syllabusId, revision_number: ++sequence, base_revision_id: expectedActiveRevisionId, proposal_kind: 'learning_forecast', proposal_key: proposalKey, activated_at: null }
      state.revisions.push(revision)
      state.forecast.push(...planning.forecast_items.map((row, index) => ({ ...clone(row), id: `proposal-item-${sequence}-${index}`, revision_id: revision.id })))
      state.writes++
      return { revision: clone(revision), reused: false }
    },
    async createLearningForecastCarryForwardProposal(args) {
      const existing = state.revisions.find((row) => row.proposal_kind === 'learning_forecast' && row.base_revision_id === args.expectedActiveRevisionId && !row.activated_at)
      if (existing?.proposal_key === args.proposalKey) return { revision: clone(existing), reused: true }
      if (existing) { const error = new Error('newer proposal exists'); error.code = '40001'; throw error }
      return this.replaceLearningForecastProposal(args)
    },
    async claimForecastMaterialization({ syllabusId, lineageId, generationInputHash }) {
      let receipt = state.receipts.find((row) => row.syllabus_id === syllabusId && row.lineage_id === lineageId)
      if (!receipt) {
        receipt = { id: `receipt-${++sequence}`, syllabus_id: syllabusId, lineage_id: lineageId, generation_input_hash: generationInputHash, lesson_key: null, status: 'generating' }
        state.receipts.push(receipt)
        return { claimed: true, receipt: clone(receipt) }
      }
      if (receipt.lesson_key) return { claimed: false, receipt: clone(receipt) }
      if (['generation_failed', 'binding_failed'].includes(receipt.status)) {
        receipt.status = 'generating'
        return { claimed: true, receipt: clone(receipt) }
      }
      return { claimed: false, receipt: clone(receipt) }
    },
    async updateForecastMaterialization(id, patch) { Object.assign(state.receipts.find((row) => row.id === id), clone(patch)) },
    async nextRevisionNumber() { return Math.max(...state.revisions.map((row) => row.revision_number || 0)) + 1 },
    async insertRevision(row) { const saved = { ...clone(row), id: `bound-${++sequence}`, activated_at: null }; state.revisions.push(saved); return clone(saved) },
    async insertForecastItems(revisionId, rows) { state.forecast.push(...rows.map((row, index) => ({ ...clone(row), id: `bound-item-${sequence}-${index}`, revision_id: revisionId }))) },
    async commitRevisionActivation({ revisionId, expectedActiveRevisionId }) {
      if (state.failCommitOnce) { state.failCommitOnce = false; const error = new Error('race'); error.code = '40001'; throw error }
      assert.equal(state.syllabus.active_revision_id, expectedActiveRevisionId)
      const revision = state.revisions.find((row) => row.id === revisionId)
      revision.activated_at = NOW.toISOString(); state.syllabus.active_revision_id = revisionId
      return clone(revision)
    },
    async deleteInactiveRevision(revisionId) { state.revisions = state.revisions.filter((row) => row.id !== revisionId); state.forecast = state.forecast.filter((row) => row.revision_id !== revisionId) },
  }
  return repository
}

test('learning forecast schema accepts first-class description and distinct origin', () => {
  const snapshot = { ...activeRevision(), forecast_items: [item({ origin: 'learning_forecast' })] }
  const validated = validateSnapshot(snapshot, { today: '2026-08-31' })
  assert.equal(validated.forecast_items[0].origin, 'learning_forecast')
  assert.equal(validated.forecast_items[0].description, 'Preserve this intent.')
})

test('unmaterialized learning intent exposes only exact materialization action', () => {
  const actions = syllabusItemActionsFor({ item: item({ origin: 'learning_forecast' }), role: 'facilitator', state: 'future_unfinished' })
  assert.deepEqual(actions, [{ id: 'materialize', label: 'Generate lesson' }])
})

test('weekly pattern owns next-week slot count and snapshot preserves existing intent', () => {
  const active = activeRevision()
  const slots = instructionalSlotsForWeek(active.weekly_pattern, '2026-09-07')
  assert.deepEqual(slots.map(({ planned_date, subject }) => ({ planned_date, subject })), [
    { planned_date: '2026-09-07', subject: 'math' }, { planned_date: '2026-09-08', subject: 'science' },
  ])
  const existing = item()
  const plan = buildInstructionalForecastPlan({ activeRevision: active, forecastItems: [existing], timelineItems: [existing], reports: evidence(), today: '2026-08-31' })
  assert.deepEqual(plan.unfilled_slots.map((slot) => slot.subject), ['science'])
  assert.equal(JSON.stringify(plan.evidence_context).includes('SECRET RAW TRANSCRIPT'), false)
  assert.equal(JSON.stringify(plan.evidence_context).includes('events'), false)
  const built = buildLearningForecastSnapshot({ activeRevision: active, forecastItems: [existing], plan, generatedItems: [{ title: 'Energy transfer', description: 'Trace energy through a simple system.' }], today: '2026-08-31' })
  assert.equal(built.snapshot.forecast_items.find((row) => row.lineage_id === LINEAGE_A).title, existing.title)
  assert.equal(built.additions[0].origin, 'learning_forecast')
  assert.equal(built.additions[0].description, 'Trace energy through a simple system.')
})

test('production facilitator evidence projects deterministic learning summary without raw authority inputs', () => {
  const report = aggregateFacilitatorEvidenceSession({
    trackedSession: { id: 'real-session', lesson_id: 'math/fractions.json', lesson_title: 'Fractions', subject: 'math', ended_at: '2026-08-28T13:00:00Z' },
    evidenceSession: { session_id: 'real-session', lesson_key: 'math/fractions.json', mastery_protocol_version: 'independent-mastery-v1', retention_protocol_version: 'retention-v1', evidence_status: 'complete' },
    events: [{
      event_type: 'mastery_check_result', event_sequence: 1, occurred_at: '2026-08-28T12:00:00.000Z', concept_id: 'equivalent-fractions',
      stable_item_id: 'fraction-item', item_exposure_id: 'fraction-exposure', assessment_role: 'conversational_mastery_opportunity',
      mastery_outcome: 'independent_success', mastery_check_id: 'fraction-check', mastery_protocol_version: 'independent-mastery-v1',
      payload: { qualification: { interaction_model: 'webb_conversation', webb_classification: { coverage: 'covered', comprehension: 'demonstrated', mastery: 'mastered', retention: 'not_measured' } }, transcript: 'SECRET' },
    }],
  })
  assert.equal(report.learning_summary.headline, report.independent_evidence.label)
  assert.equal(report.learning_summary.narrative, report.independent_evidence.detail)
  const projected = instructionalEvidenceContext([report, ...Array.from({ length: 20 }, () => report)])
  assert.equal(projected.length, 12)
  assert.equal(projected[0].learning_summary.headline, report.independent_evidence.label)
  assert.deepEqual(Object.keys(projected[0]).sort(), ['baseline', 'completeness', 'independent', 'learning_summary', 'lesson', 'report_version', 'retention'])
  assert.doesNotMatch(JSON.stringify(projected), /SECRET|events|transcript|medal|score/i)
})

test('model output cannot recast Slate follow-up work as instructional lessons', () => {
  const active = activeRevision()
  const plan = buildInstructionalForecastPlan({ activeRevision: active, forecastItems: [], timelineItems: [], reports: evidence(), today: '2026-08-31' })
  assert.throws(() => buildLearningForecastSnapshot({
    activeRevision: active, forecastItems: [], plan,
    generatedItems: plan.unfilled_slots.map(() => ({ title: 'Weekly Review', description: 'Run a retention check.' })),
    today: '2026-08-31',
  }), /authority boundary/)
})

test('identical authoritative inputs reuse the sole learning proposal; changed evidence replaces it', async () => {
  const repository = forecastRepository()
  let modelCalls = 0
  let capturedContext
  const generateItems = async ({ slots, context }) => { modelCalls++; capturedContext = context; return slots.map(() => ({ title: 'Energy transfer', description: 'Trace energy through a simple system.' })) }
  const invoke = (reports) => createLearningForecastProposal({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE, reports, generateItems, now: NOW })
  const first = await invoke(evidence())
  assert.equal(first.reused, false)
  assert.equal(repository.state.syllabus.active_revision_id, ACTIVE)
  assert.equal(capturedContext.evidence_summaries[0].learning_summary.headline, 'Ready to progress')
  assert.equal(JSON.stringify(capturedContext).includes('SECRET RAW TRANSCRIPT'), false)
  const second = await invoke(evidence())
  assert.equal(second.reused, true)
  assert.equal(modelCalls, 1)
  const third = await invoke(evidence('Needs slower pacing'))
  assert.equal(third.reused, false)
  assert.equal(modelCalls, 2)
  assert.equal(repository.state.revisions.filter((row) => row.proposal_kind === 'learning_forecast' && !row.activated_at).length, 1)
  assert.equal(repository.state.revisions.some((row) => row.proposal_kind === 'mastery_reforecast'), false)
})

test('explicit proposal activation preserves learning origin and description', async () => {
  const repository = forecastRepository()
  const proposal = await createLearningForecastProposal({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
    reports: evidence(), now: NOW,
    generateItems: async ({ slots }) => slots.map(() => ({ title: 'Energy transfer', description: 'Trace energy through a simple system.' })),
  })
  const activated = await activateProposedSyllabus({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, proposalRevisionId: proposal.proposal_revision.id, expectedActiveRevisionId: ACTIVE, now: NOW, today: '2026-08-31' })
  const forecast = activated.forecast_items.find((row) => row.origin === 'learning_forecast')
  assert.equal(forecast.description, 'Trace energy through a simple system.')
  assert.notEqual(activated.syllabus.active_revision_id, proposal.proposal_revision.id)
  assert.equal(repository.state.revisions.find((row) => row.id === proposal.proposal_revision.id).activated_at, null)
})

test('a still-current learning forecast is accepted days later through a fresh local-date revision', async () => {
  const repository = forecastRepository({ forecast: [] })
  const proposal = await createLearningForecastProposal({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
    reports: evidence(), now: NOW,
    generateItems: async ({ slots }) => slots.map((slot) => ({ title: `${slot.subject} progression`, description: `Advance the ${slot.subject} sequence.` })),
  })
  const accepted = await activateProposedSyllabus({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id, expectedActiveRevisionId: ACTIVE,
    now: new Date('2026-09-03T14:00:00.000Z'), today: '2026-09-03',
  })
  assert.equal(accepted.active_revision.effective_from, '2026-09-03')
  assert.notEqual(accepted.active_revision.id, proposal.proposal_revision.id)
  assert.equal(repository.state.revisions.find((row) => row.id === proposal.proposal_revision.id).activated_at, null)
})

test('legacy mastery proposals cannot be activated through the current proposal path', async () => {
  const repository = forecastRepository()
  const mastery = {
    ...activeRevision(), id: 'mastery-proposal', revision_number: 2, base_revision_id: ACTIVE,
    effective_from: '2026-08-31', activated_at: null, proposal_kind: 'mastery_reforecast', proposal_key: 'mastery-key',
  }
  repository.state.revisions.push(mastery)
  repository.state.forecast.push(item({ id: 'mastery-item', revision_id: mastery.id, origin: 'mastery_reforecast', item_type: 'review' }))
  await assert.rejects(activateProposedSyllabus({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: mastery.id, expectedActiveRevisionId: ACTIVE,
    now: new Date('2026-09-03T14:00:00.000Z'), today: '2026-09-03',
  }), { code: 'PROPOSAL_KIND_RETIRED' })
  assert.equal(repository.state.syllabus.active_revision_id, ACTIVE)
})

test('materializing one proposed lineage adopts only that concept and leaves siblings inactive', async () => {
  const repository = forecastRepository({ forecast: [] })
  const proposal = await createLearningForecastProposal({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
    reports: evidence(), now: NOW,
    generateItems: async ({ slots }) => slots.map(() => ({ title: 'Repeated title', description: 'A distinct conceptual progression.' })),
  })
  const proposedConcepts = proposal.forecast_items.filter((row) => row.origin === 'learning_forecast')
  assert.equal(proposedConcepts.length, 2)
  assert.equal(repository.state.syllabus.active_revision_id, ACTIVE)
  const selected = proposedConcepts[1]
  const later = new Date('2026-09-03T14:00:00.000Z')
  let generatorCalls = 0
  const materialized = await materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id, lineageId: selected.lineage_id,
    expectedActiveRevisionId: ACTIVE, now: later,
    generateLesson: async () => { generatorCalls++; return { lessonKey: 'generated/selected.json' } },
  })
  const finalItems = repository.state.forecast.filter((row) => row.revision_id === materialized.syllabus.active_revision.id)
  assert.deepEqual(finalItems.map((row) => row.lineage_id), [selected.lineage_id])
  assert.equal(finalItems[0].lesson_key, 'generated/selected.json')
  const originalProposalItems = repository.state.forecast.filter((row) => row.revision_id === proposal.proposal_revision.id && row.origin === 'learning_forecast')
  assert.equal(originalProposalItems.length, 2)
  assert.equal(repository.state.revisions.find((row) => row.id === proposal.proposal_revision.id).activated_at, null)
  const sibling = proposedConcepts.find((row) => row.lineage_id !== selected.lineage_id)
  assert.equal(finalItems.some((row) => row.lineage_id === sibling.lineage_id), false)
  const retry = await materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: selected.lineage_id,
    expectedActiveRevisionId: materialized.syllabus.active_revision.id, now: later,
    generateLesson: async () => { generatorCalls++; return { lessonKey: 'generated/duplicate.json' } },
  })
  assert.equal(retry.lesson_key, 'generated/selected.json')
  assert.equal(generatorCalls, 1)
})

test('X then Y materialization carries exact remaining siblings forward and exhausts with whole adoption', async () => {
  const repository = forecastRepository({ forecast: [] })
  const active = repository.state.revisions.find((row) => row.id === ACTIVE)
  active.subjects.push({ name: 'language arts' })
  active.weekly_pattern.wednesday = [{ subject: 'language arts' }]
  let forecastModelCalls = 0
  const proposal = await createLearningForecastProposal({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
    reports: evidence(), now: NOW,
    generateItems: async ({ slots }) => {
      forecastModelCalls++
      return slots.map((slot, index) => ({ title: `Concept ${index + 1}`, description: `Exact ${slot.subject} description ${index + 1}.` }))
    },
  })
  const [x, y, z] = proposal.forecast_items.filter((row) => row.origin === 'learning_forecast')
  assert.equal(forecastModelCalls, 1)
  const originalEvidence = structuredClone(repository.state.forecast.filter((row) => row.revision_id === proposal.proposal_revision.id))
  const exactConcept = ({ lineage_id, title, description, subject, planned_date }) => ({ lineage_id, title, description, subject, planned_date })
  let lessonGeneratorCalls = 0

  const afterX = await materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id, lineageId: x.lineage_id,
    expectedActiveRevisionId: ACTIVE, now: NOW,
    generateLesson: async () => { lessonGeneratorCalls++; return { lessonKey: 'generated/x.json' } },
  })
  const activeAfterX = repository.state.forecast.filter((row) => row.revision_id === afterX.syllabus.active_revision.id)
  assert.deepEqual(activeAfterX.map((row) => row.lineage_id), [x.lineage_id])
  assert.equal(activeAfterX[0].lesson_key, 'generated/x.json')
  assert.deepEqual(repository.state.forecast.filter((row) => row.revision_id === proposal.proposal_revision.id), originalEvidence)
  const p2 = afterX.syllabus.proposed_learning_forecast
  assert.equal(p2.revision.base_revision_id, afterX.syllabus.active_revision.id)
  assert.deepEqual(p2.forecast_items.map(exactConcept), [y, z].map(exactConcept))
  assert.match(p2.revision.proposal_key, /^learning-forecast-rebase-v1:/)
  assert.equal(p2.revision.legacy_provenance.learning_forecast_rebase.root_source_proposal_revision_id, proposal.proposal_revision.id)

  await assert.rejects(adoptLearningForecastLineage({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id, lineageId: y.lineage_id,
    expectedActiveRevisionId: afterX.syllabus.active_revision.id, now: NOW, today: '2026-08-31',
  }), { code: 'FORECAST_PROPOSAL_STALE' })

  const afterY = await materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: p2.revision.id, lineageId: y.lineage_id,
    expectedActiveRevisionId: afterX.syllabus.active_revision.id, now: NOW,
    generateLesson: async () => { lessonGeneratorCalls++; return { lessonKey: 'generated/y.json' } },
  })
  const activeAfterY = repository.state.forecast.filter((row) => row.revision_id === afterY.syllabus.active_revision.id)
  assert.deepEqual(activeAfterY.map((row) => [row.lineage_id, row.lesson_key]), [
    [x.lineage_id, 'generated/x.json'],
    [y.lineage_id, 'generated/y.json'],
  ])
  const p3 = afterY.syllabus.proposed_learning_forecast
  assert.equal(p3.revision.base_revision_id, afterY.syllabus.active_revision.id)
  assert.deepEqual(p3.forecast_items.map(exactConcept), [exactConcept(z)])
  assert.equal(forecastModelCalls, 1)
  assert.equal(lessonGeneratorCalls, 2)

  const exhausted = await activateProposedSyllabus({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: p3.revision.id, expectedActiveRevisionId: afterY.syllabus.active_revision.id,
    now: NOW, today: '2026-08-31',
  })
  assert.deepEqual(exhausted.forecast_items.map((row) => row.lineage_id), [x.lineage_id, y.lineage_id, z.lineage_id])
  assert.equal(await repository.findLatestLearningForecastProposal(SYLLABUS, exhausted.active_revision.id), null)
  assert.equal(forecastModelCalls, 1)
})

test('carry-forward drops a sibling that conflicts with active educator intent', async () => {
  const repository = forecastRepository()
  const proposal = {
    ...activeRevision(), id: 'conflicting-proposal', revision_number: 2, base_revision_id: ACTIVE,
    activated_at: null, proposal_kind: 'learning_forecast', proposal_key: 'conflicting-source',
  }
  repository.state.revisions.push(proposal)
  repository.state.forecast.push(
    item({ id: 'selected', revision_id: proposal.id, lineage_id: LINEAGE_B, planned_date: '2026-09-08', subject: 'science', title: 'Selected science', description: 'Adopt this one.', origin: 'learning_forecast' }),
    item({ id: 'conflict', revision_id: proposal.id, lineage_id: LINEAGE_C, title: 'Conflicting AI math', description: 'Must not replace educator intent.', origin: 'learning_forecast' }),
  )
  const adopted = await adoptLearningForecastLineage({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.id, lineageId: LINEAGE_B, expectedActiveRevisionId: ACTIVE,
    now: NOW, today: '2026-08-31',
  })
  assert.equal(adopted.carry_forward.status, 'exhausted')
  const activeItems = repository.state.forecast.filter((row) => row.revision_id === adopted.active_revision.id)
  assert.equal(activeItems.find((row) => row.lineage_id === LINEAGE_A).title, 'Educator-authored fractions')
  assert.equal(activeItems.some((row) => row.lineage_id === LINEAGE_C), false)
  assert.equal(await repository.findLatestLearningForecastProposal(SYLLABUS, adopted.active_revision.id), null)
})

test('a superseded learning proposal cannot adopt or carry a lineage into authority', async () => {
  const repository = forecastRepository({ forecast: [] })
  const older = { ...activeRevision(), id: 'older-learning', revision_number: 2, base_revision_id: ACTIVE, activated_at: null, proposal_kind: 'learning_forecast', proposal_key: 'older-key' }
  const newer = { ...activeRevision(), id: 'newer-learning', revision_number: 3, base_revision_id: ACTIVE, activated_at: null, proposal_kind: 'learning_forecast', proposal_key: 'newer-key' }
  repository.state.revisions.push(older, newer)
  repository.state.forecast.push(
    item({ id: 'older-item', revision_id: older.id, origin: 'learning_forecast' }),
    item({ id: 'newer-item', revision_id: newer.id, lineage_id: LINEAGE_B, origin: 'learning_forecast' }),
  )
  await assert.rejects(adoptLearningForecastLineage({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: older.id, lineageId: LINEAGE_A, expectedActiveRevisionId: ACTIVE,
    now: NOW, today: '2026-08-31',
  }), { code: 'PROPOSAL_SUPERSEDED' })
  assert.equal(repository.state.syllabus.active_revision_id, ACTIVE)
  assert.equal(repository.state.writes, 0)
})

test('generation failure leaves multi-sibling carry-forward current and independently actionable', async () => {
  const repository = forecastRepository({ forecast: [] })
  const active = repository.state.revisions.find((row) => row.id === ACTIVE)
  active.subjects.push({ name: 'language arts' })
  active.weekly_pattern.wednesday = [{ subject: 'language arts' }]
  let forecastModelCalls = 0
  const proposal = await createLearningForecastProposal({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
    reports: evidence(), now: NOW,
    generateItems: async ({ slots }) => {
      forecastModelCalls++
      return slots.map((slot, index) => ({ title: `Failure concept ${index}`, description: `Preserve ${slot.subject} ${index}.` }))
    },
  })
  const [x, y, z] = proposal.forecast_items.filter((row) => row.origin === 'learning_forecast')
  const exact = ({ lineage_id, title, description, subject, planned_date, metadata }) => ({ lineage_id, title, description, subject, planned_date, metadata })
  let generatorCalls = 0
  await assert.rejects(materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id, lineageId: x.lineage_id,
    expectedActiveRevisionId: ACTIVE, now: NOW,
    generateLesson: async () => { generatorCalls++; throw new Error('generator offline') },
  }), { code: 'MATERIALIZATION_GENERATION_FAILED' })

  const activeBId = repository.state.syllabus.active_revision_id
  const activeB = repository.state.forecast.filter((row) => row.revision_id === activeBId)
  assert.deepEqual(activeB.map((row) => [row.lineage_id, row.lesson_key]), [[x.lineage_id, null]])
  const p2 = await repository.findLatestLearningForecastProposal(SYLLABUS, activeBId)
  assert.ok(p2)
  assert.deepEqual((await repository.listForecastItems(p2.id)).map(exact), [y, z].map(exact))
  assert.equal(repository.state.receipts.length, 1)
  assert.equal(repository.state.receipts[0].status, 'generation_failed')
  assert.equal(generatorCalls, 1)
  assert.equal(forecastModelCalls, 1)

  const actedOnY = await adoptLearningForecastLineage({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: p2.id, lineageId: y.lineage_id, expectedActiveRevisionId: activeBId,
    now: NOW, today: '2026-08-31',
  })
  assert.deepEqual(actedOnY.forecast_items.map((row) => row.lineage_id), [x.lineage_id, y.lineage_id])
  assert.deepEqual(actedOnY.carry_forward.forecast_items.map(exact), [exact(z)])
  assert.equal(repository.state.receipts.length, 1)
  assert.equal(generatorCalls, 1)
  assert.equal(forecastModelCalls, 1)
})

test('binding failure keeps B-based siblings current and retry reuses artifact before rebasing onto C', async () => {
  const repository = forecastRepository({ forecast: [] })
  const active = repository.state.revisions.find((row) => row.id === ACTIVE)
  active.subjects.push({ name: 'language arts' })
  active.weekly_pattern.wednesday = [{ subject: 'language arts' }]
  let forecastModelCalls = 0
  const proposal = await createLearningForecastProposal({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
    reports: evidence(), now: NOW,
    generateItems: async ({ slots }) => {
      forecastModelCalls++
      return slots.map((slot, index) => ({ title: `Binding concept ${index}`, description: `Preserve ${slot.subject} binding ${index}.` }))
    },
  })
  const [x, y, z] = proposal.forecast_items.filter((row) => row.origin === 'learning_forecast')
  const exact = ({ lineage_id, title, description, subject, planned_date, metadata }) => ({ lineage_id, title, description, subject, planned_date, metadata })
  let generatorCalls = 0
  await assert.rejects(materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id, lineageId: x.lineage_id,
    expectedActiveRevisionId: ACTIVE, now: NOW,
    generateLesson: async () => {
      generatorCalls++
      repository.state.failCommitOnce = true
      return { lessonKey: 'generated/retry-x.json' }
    },
  }), { code: 'ACTIVATION_CONFLICT' })

  const activeBId = repository.state.syllabus.active_revision_id
  const activeB = repository.state.forecast.filter((row) => row.revision_id === activeBId)
  assert.deepEqual(activeB.map((row) => [row.lineage_id, row.lesson_key]), [[x.lineage_id, null]])
  const p2 = await repository.findLatestLearningForecastProposal(SYLLABUS, activeBId)
  assert.ok(p2)
  assert.deepEqual((await repository.listForecastItems(p2.id)).map(exact), [y, z].map(exact))
  assert.equal(repository.state.receipts.length, 1)
  assert.equal(repository.state.receipts[0].lesson_key, 'generated/retry-x.json')
  assert.equal(repository.state.receipts[0].status, 'binding_failed')

  const retried = await materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    lineageId: x.lineage_id, expectedActiveRevisionId: activeBId, now: NOW,
    generateLesson: async () => { generatorCalls++; return { lessonKey: 'generated/duplicate.json' } },
  })
  assert.equal(retried.reused, true)
  assert.equal(retried.lesson_key, 'generated/retry-x.json')
  assert.equal(generatorCalls, 1)
  assert.equal(forecastModelCalls, 1)
  const activeCId = retried.syllabus.active_revision.id
  assert.notEqual(activeCId, activeBId)
  assert.equal(retried.syllabus.forecast_items.find((row) => row.lineage_id === x.lineage_id).lesson_key, 'generated/retry-x.json')
  const p3 = retried.syllabus.proposed_learning_forecast
  assert.equal(p3.revision.base_revision_id, activeCId)
  assert.deepEqual(p3.forecast_items.map(exact), [y, z].map(exact))
  assert.equal(repository.state.receipts.length, 1)
  assert.equal(repository.state.receipts[0].status, 'bound')
})

test('failed first post-adoption carry preserves adoption and reconstructs without generation', async () => {
  const repository = forecastRepository({ forecast: [] })
  const proposal = await createLearningForecastProposal({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
    reports: evidence(), now: NOW,
    generateItems: async ({ slots }) => slots.map((slot) => ({ title: `${slot.subject} concept`, description: `Exact ${slot.subject} concept.` })),
  })
  const [selected, sibling] = proposal.forecast_items.filter((row) => row.origin === 'learning_forecast')
  const createCarry = repository.createLearningForecastCarryForwardProposal
  repository.createLearningForecastCarryForwardProposal = async () => { throw new Error('temporary write failure') }
  let generatorCalls = 0
  await assert.rejects(materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id, lineageId: selected.lineage_id,
    expectedActiveRevisionId: ACTIVE, now: NOW, today: '2026-08-31',
    generateLesson: async () => { generatorCalls++; return { lessonKey: 'generated/must-not-run.json' } },
  }), { code: 'FORECAST_CARRY_FORWARD_FAILED' })
  const adoptedRevisionId = repository.state.syllabus.active_revision_id
  const adoptedItems = repository.state.forecast.filter((row) => row.revision_id === adoptedRevisionId)
  assert.deepEqual(adoptedItems.map((row) => [row.lineage_id, row.lesson_key]), [[selected.lineage_id, null]])
  assert.equal(await repository.findLatestLearningForecastProposal(SYLLABUS, adoptedRevisionId), null)
  assert.equal(generatorCalls, 0)
  assert.equal(repository.state.receipts.length, 0)
  repository.createLearningForecastCarryForwardProposal = createCarry
  const reconstructedResult = await reconstructForecastCarryForward({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    sourceProposalRevisionId: proposal.proposal_revision.id,
    expectedActiveRevisionId: adoptedRevisionId, now: NOW,
  })
  const reconstructed = reconstructedResult.carry_forward
  assert.equal(reconstructed.status, 'created')
  assert.deepEqual(reconstructed.forecast_items.map((row) => row.lineage_id), [sibling.lineage_id])
  const repeatedResult = await reconstructForecastCarryForward({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    sourceProposalRevisionId: proposal.proposal_revision.id,
    expectedActiveRevisionId: adoptedRevisionId, now: NOW,
  })
  const repeated = repeatedResult.carry_forward
  assert.equal(repeated.status, 'reused')
  assert.equal(repository.state.revisions.filter((row) => row.base_revision_id === adoptedRevisionId && row.proposal_kind === 'learning_forecast').length, 1)
  assert.equal(generatorCalls, 0)
  assert.equal(repository.state.receipts.length, 0)
})

test('materialization binds canonical lesson key to exact lineage and timeline has no inferred duplicate', async () => {
  const repository = forecastRepository({ forecast: [
    item({ origin: 'learning_forecast', title: 'Repeated title' }),
    item({ id: 'item-b', lineage_id: LINEAGE_B, planned_date: '2026-09-08', subject: 'science', origin: 'learning_forecast', title: 'Repeated title' }),
  ] })
  let generatorCalls = 0
  const result = await materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: LINEAGE_B,
    expectedActiveRevisionId: ACTIVE, now: NOW,
    generateLesson: async () => { generatorCalls++; return { lessonKey: 'generated/repeated_title.json' } },
  })
  assert.equal(generatorCalls, 1)
  const bound = repository.state.forecast.filter((row) => row.revision_id === result.syllabus.active_revision.id)
  assert.equal(bound.find((row) => row.lineage_id === LINEAGE_B).lesson_key, 'generated/repeated_title.json')
  assert.equal(bound.find((row) => row.lineage_id === LINEAGE_A).lesson_key, null)
  const timeline = composeSyllabusLessonTimeline({ activeRevision: result.syllabus.active_revision, forecastItems: bound, associations: [{ lesson_key: 'generated/repeated_title.json', learner_id: LEARNER, readiness_state: 'draft' }], today: '2026-08-31' })
  assert.equal(timeline.filter((row) => row.lesson_key === 'generated/repeated_title.json').length, 1)
})

test('generation failure preserves planned concept and successful binding retry reuses artifact', async () => {
  const failed = forecastRepository({ forecast: [item({ origin: 'learning_forecast' })] })
  await assert.rejects(materializeForecastOccurrence({ repository: failed, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: LINEAGE_A, expectedActiveRevisionId: ACTIVE, now: NOW, generateLesson: async () => { throw new Error('offline') }, setInferenceSuppressed: preserveInferenceSuppression }), { code: 'MATERIALIZATION_GENERATION_FAILED' })
  assert.equal(failed.state.syllabus.active_revision_id, ACTIVE)
  assert.equal(failed.state.forecast[0].lesson_key, null)

  const retry = forecastRepository({ forecast: [item({ origin: 'learning_forecast' })] })
  retry.state.failCommitOnce = true
  let calls = 0
  await assert.rejects(materializeForecastOccurrence({ repository: retry, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: LINEAGE_A, expectedActiveRevisionId: ACTIVE, now: NOW, generateLesson: async () => { calls++; return { lessonKey: 'generated/fractions.json' } }, setInferenceSuppressed: preserveInferenceSuppression }), { code: 'ACTIVATION_CONFLICT' })
  const repaired = await materializeForecastOccurrence({ repository: retry, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: LINEAGE_A, expectedActiveRevisionId: ACTIVE, now: NOW, generateLesson: async () => { calls++; return { lessonKey: 'generated/duplicate.json' } }, setInferenceSuppressed: preserveInferenceSuppression })
  assert.equal(calls, 1)
  assert.equal(repaired.lesson_key, 'generated/fractions.json')
})

test('a generating receipt retry is recovery-only and binds the exact recovered artifact', async () => {
  const repository = forecastRepository({ forecast: [item({ origin: 'learning_forecast' })] })
  repository.claimForecastMaterialization = async ({ syllabusId, lineageId, generationInputHash }) => {
    const receipt = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', syllabus_id: syllabusId, lineage_id: lineageId, generation_input_hash: generationInputHash, lesson_key: null, status: 'generating' }
    repository.state.receipts.push(receipt)
    return { claimed: false, receipt: structuredClone(receipt) }
  }
  let recoveryCalls = 0
  const result = await materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: LINEAGE_A, expectedActiveRevisionId: ACTIVE, now: NOW,
    generateLesson: async ({ materializationOperation }) => {
      recoveryCalls++
      assert.equal(materializationOperation.recoverOnly, true)
      assert.equal(materializationOperation.lineageId, LINEAGE_A)
      return { lessonKey: 'generated/syllabus-materialization-dddddddd-dddd-4ddd-8ddd-dddddddddddd.json', recovered: true }
    },
  })
  assert.equal(recoveryCalls, 1)
  assert.equal(result.lesson_key, 'generated/syllabus-materialization-dddddddd-dddd-4ddd-8ddd-dddddddddddd.json')
  assert.equal(repository.state.receipts[0].status, 'bound')
})

test('true materialization ambiguity enters recovery-required without blind regeneration', async () => {
  const repository = forecastRepository({ forecast: [item({ origin: 'learning_forecast' })] })
  repository.claimForecastMaterialization = async ({ syllabusId, lineageId, generationInputHash }) => {
    const receipt = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', syllabus_id: syllabusId, lineage_id: lineageId, generation_input_hash: generationInputHash, lesson_key: null, status: 'generating' }
    repository.state.receipts.push(receipt)
    return { claimed: false, receipt: structuredClone(receipt) }
  }
  let attempts = 0
  await assert.rejects(materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: LINEAGE_A, expectedActiveRevisionId: ACTIVE, now: NOW,
    generateLesson: async ({ materializationOperation }) => {
      attempts++
      assert.equal(materializationOperation.recoverOnly, true)
      throw Object.assign(new Error('No exact artifact exists at the deterministic path.'), { code: 'MATERIALIZATION_RECOVERY_REQUIRED', operation: { id: materializationOperation.id, lineageId: LINEAGE_A } })
    },
  }), { code: 'MATERIALIZATION_RECOVERY_REQUIRED' })
  assert.equal(attempts, 1)
  assert.equal(repository.state.receipts[0].status, 'recovery_required')
  assert.equal(repository.state.receipts[0].lesson_key, null)
})

test('missing authoritative learner grade fails before adoption or generation', async () => {
  const repository = forecastRepository({ forecast: [] })
  const proposal = await createLearningForecastProposal({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
    reports: evidence(), now: NOW,
    generateItems: async ({ slots }) => slots.map(() => ({ title: 'Concept', description: 'A bounded concept.' })),
  })
  const selected = proposal.forecast_items.find((row) => row.origin === 'learning_forecast')
  repository.state.learner.grade = null
  let generatorCalls = 0
  await assert.rejects(materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id, lineageId: selected.lineage_id,
    expectedActiveRevisionId: ACTIVE, now: NOW,
    generateLesson: async () => { generatorCalls++; return { lessonKey: 'generated/fabricated-grade.json' } },
  }), { code: 'MATERIALIZATION_GRADE_REQUIRED' })
  assert.equal(generatorCalls, 0)
  assert.equal(repository.state.syllabus.active_revision_id, ACTIVE)
  assert.equal(repository.state.receipts.length, 0)
})

test('a newer active revision blocks proposed-lineage adoption before generation', async () => {
  const repository = forecastRepository({ forecast: [] })
  const proposal = await createLearningForecastProposal({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
    reports: evidence(), now: NOW,
    generateItems: async ({ slots }) => slots.map(() => ({ title: 'Concept', description: 'A bounded concept.' })),
  })
  const selected = proposal.forecast_items.find((row) => row.origin === 'learning_forecast')
  repository.state.syllabus.active_revision_id = 'newer-active-revision'
  let generatorCalls = 0
  await assert.rejects(materializeForecastOccurrence({
    setInferenceSuppressed: preserveInferenceSuppression,
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id, lineageId: selected.lineage_id,
    expectedActiveRevisionId: ACTIVE, now: NOW,
    generateLesson: async () => { generatorCalls++; return { lessonKey: 'generated/stale.json' } },
  }), { code: 'MATERIALIZATION_CONFLICT' })
  assert.equal(generatorCalls, 0)
  assert.equal(repository.state.revisions.find((row) => row.id === proposal.proposal_revision.id).activated_at, null)
})

test('unauthorized learner and active-revision conflicts fail closed', async () => {
  const repository = forecastRepository({ forecast: [item({ origin: 'learning_forecast' })] })
  const generateLesson = async () => ({ lessonKey: 'generated/nope.json' })
  await assert.rejects(materializeForecastOccurrence({ repository, facilitatorId: OTHER, learnerId: LEARNER, lineageId: LINEAGE_A, expectedActiveRevisionId: ACTIVE, now: NOW, generateLesson, setInferenceSuppressed: preserveInferenceSuppression }), { code: 'FORECAST_OCCURRENCE_NOT_FOUND' })
  await assert.rejects(materializeForecastOccurrence({ repository, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: LINEAGE_A, expectedActiveRevisionId: 'stale', now: NOW, generateLesson, setInferenceSuppressed: preserveInferenceSuppression }), { code: 'MATERIALIZATION_CONFLICT' })
})

test('migration generalizes proposal authority and adds durable materialization receipts', () => {
  const sql = fs.readFileSync(new URL('../../../../../supabase/migrations/20260831201314_add_learning_forecast_foundation.sql', import.meta.url), 'utf8')
  assert.match(sql, /add column if not exists description text/i)
  assert.match(sql, /learning_forecast/i)
  assert.match(sql, /replace_syllabus_proposal/i)
  assert.match(sql, /syllabus_forecast_materializations/i)
  assert.match(sql, /unique \(syllabus_id, lineage_id\)/i)
  assert.match(sql, /claim_syllabus_forecast_materialization/i)
  assert.match(sql, /grant select, insert, update on table public\.syllabus_forecast_materializations to service_role/i)
  assert.match(sql, /p_proposal_kind = 'mastery_reforecast' and p_effective_from is distinct from current_date/i)
  assert.match(sql, /p_proposal_kind = 'learning_forecast'[\s\S]*abs\(p_effective_from - current_date\) > 1/i)
  assert.match(sql, /if found and not p_replace_existing[\s\S]*A newer Syllabus proposal already exists/i)
  assert.match(sql, /abs\(proposed_revision\.effective_from - current_date\) > 1/i)
})

test('forecast route stays separate from full-generation quota and materialization reuses canonical generator', () => {
  const forecastRoute = fs.readFileSync(new URL('../../../api/syllabus/forecast/route.js', import.meta.url), 'utf8')
  const materializeRoute = fs.readFileSync(new URL('../../../api/syllabus/materialize/route.js', import.meta.url), 'utf8')
  assert.doesNotMatch(forecastRoute, /lifetime_generations_used|lessons\/generate/)
  assert.match(materializeRoute, /facilitator\/lessons\/generate\/route\.js/)
  assert.match(materializeRoute, /mode:\s*'proposal'/)
  assert.doesNotMatch(materializeRoute, /lesson_schedule|scheduleLesson/)
})
