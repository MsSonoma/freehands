import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'

import { aggregateFacilitatorEvidenceSession } from '../../masteryEvidence/reporting.js'
import { createLearningForecastProposal } from '../learningForecast.server.mjs'
import { materializeForecastOccurrence } from '../materialization.server.mjs'
import { composeSyllabusLessonTimeline } from '../lessonTimeline.mjs'
import { buildLessonSchedulePayload } from '../syllabusScheduling.mjs'
import {
  moveSyllabusWeek,
  resolveSyllabusReadModel,
  selectSyllabusWeek,
  syllabusItemActionsFor,
} from '../timeline.mjs'
import {
  learnerNowViewportKey,
  resolveLearnerSyllabusPresentation,
} from '../learnerPresentation.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SYLLABUS = 'syllabus-integrated'
const ACTIVE = 'revision-active'
const SHARED_LESSON = 'math/shared-fractions.json'
const NOW = new Date('2026-08-31T14:00:00.000Z')

function activeRevision() {
  return {
    id: ACTIVE,
    syllabus_id: SYLLABUS,
    revision_number: 1,
    base_revision_id: null,
    effective_from: '2026-08-31',
    schema_version: 1,
    goals: { learning: 'Build durable fraction reasoning.' },
    subjects: [{ name: 'math' }, { name: 'science' }],
    weekly_pattern: {
      monday: [{ subject: 'math' }],
      tuesday: [{ subject: 'science' }],
      wednesday: [{ subject: 'math' }],
    },
    teaching_guidance: { curriculum_preferences: { focus_topics: ['fractions', 'systems'] } },
    planning_policy: { difficulty: 'intermediate' },
    legacy_provenance: { sources: { goals: 'facilitator' } },
    change_reason: 'Facilitator-authored active plan',
    proposal_kind: null,
    proposal_key: null,
    activated_at: NOW.toISOString(),
  }
}

function authoredIntent() {
  return {
    id: 'intent-authored',
    revision_id: ACTIVE,
    lineage_id: '10000000-0000-4000-8000-000000000001',
    planned_date: '2026-09-07',
    subject: 'math',
    title: 'Facilitator-owned fraction intent',
    description: 'This exact educator choice must survive AI forecasting.',
    lesson_key: SHARED_LESSON,
    item_type: 'lesson',
    origin: 'facilitator',
    sort_order: 0,
    metadata: { authored_by: 'facilitator' },
  }
}

function learningReport(outcome, occurredAt) {
  return aggregateFacilitatorEvidenceSession({
    trackedSession: {
      id: `session-${outcome}`,
      lesson_id: SHARED_LESSON,
      lesson_title: 'Shared Fractions',
      subject: 'math',
      ended_at: occurredAt,
    },
    evidenceSession: {
      session_id: `session-${outcome}`,
      lesson_key: SHARED_LESSON,
      mastery_protocol_version: 'independent-mastery-v1',
      retention_protocol_version: 'retention-v1',
      evidence_status: 'complete',
    },
    events: [{
      event_type: 'mastery_check_result',
      event_sequence: 1,
      occurred_at: occurredAt,
      concept_id: 'equivalent-fractions',
      stable_item_id: `item-${outcome}`,
      item_exposure_id: `exposure-${outcome}`,
      assessment_role: 'conversational_mastery_opportunity',
      mastery_outcome: outcome,
      mastery_check_id: `check-${outcome}`,
      mastery_protocol_version: 'independent-mastery-v1',
      payload: {
        qualification: { interaction_model: 'webb_conversation' },
        transcript: 'RAW TRANSCRIPT MUST NOT ENTER FORECAST CONTEXT',
        events: [{ raw: true }],
      },
    }],
  })
}

function integratedRepository() {
  const state = {
    learner: { id: LEARNER, facilitator_id: FACILITATOR, name: 'Avery', grade: '5', approved_lessons: { [SHARED_LESSON]: true } },
    syllabus: { id: SYLLABUS, facilitator_id: FACILITATOR, learner_id: LEARNER, active_revision_id: ACTIVE },
    revisions: [activeRevision()],
    forecast: [authoredIntent()],
    receipts: [],
    proposalWrites: 0,
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
      const existing = state.revisions.find((row) => row.syllabus_id === syllabusId && row.base_revision_id === expectedActiveRevisionId && row.proposal_kind === 'learning_forecast' && !row.activated_at)
      if (existing?.proposal_key === proposalKey) return { revision: clone(existing), reused: true }
      if (existing) {
        state.revisions = state.revisions.filter((row) => row.id !== existing.id)
        state.forecast = state.forecast.filter((row) => row.revision_id !== existing.id)
      }
      const id = `proposal-${++sequence}`
      const revision = { ...clone(planning), id, syllabus_id: syllabusId, revision_number: ++sequence, base_revision_id: expectedActiveRevisionId, proposal_kind: 'learning_forecast', proposal_key: proposalKey, activated_at: null }
      state.revisions.push(revision)
      state.forecast.push(...planning.forecast_items.map((row, index) => ({ ...clone(row), id: `${id}-item-${index}`, revision_id: id })))
      state.proposalWrites += 1
      return { revision: clone(revision), reused: false }
    },
    async createLearningForecastCarryForwardProposal(args) {
      const existing = await this.findLatestLearningForecastProposal(args.syllabusId, args.expectedActiveRevisionId)
      if (existing?.proposal_key === args.proposalKey) return { revision: existing, reused: true }
      return this.replaceLearningForecastProposal(args)
    },
    async findForecastMaterialization(syllabusId, lineageId) {
      return clone(state.receipts.find((row) => row.syllabus_id === syllabusId && row.lineage_id === lineageId) || null)
    },
    async nextRevisionNumber() { return Math.max(...state.revisions.map((row) => row.revision_number || 0)) + 1 },
    async insertRevision(row) {
      const saved = { ...clone(row), id: `active-${++sequence}`, activated_at: null }
      state.revisions.push(saved)
      return clone(saved)
    },
    async insertForecastItems(revisionId, rows) {
      state.forecast.push(...rows.map((row, index) => ({ ...clone(row), id: `${revisionId}-item-${index}`, revision_id: revisionId })))
    },
    async commitRevisionActivation({ revisionId, expectedActiveRevisionId }) {
      assert.equal(state.syllabus.active_revision_id, expectedActiveRevisionId)
      const revision = state.revisions.find((row) => row.id === revisionId)
      revision.activated_at = NOW.toISOString()
      state.syllabus.active_revision_id = revisionId
      return clone(revision)
    },
    async deleteInactiveRevision(revisionId) {
      state.revisions = state.revisions.filter((row) => row.id !== revisionId)
      state.forecast = state.forecast.filter((row) => row.revision_id !== revisionId)
    },
  }
  return repository
}

async function forecast(repository, reports, observedContexts) {
  return createLearningForecastProposal({
    repository,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    expectedActiveRevisionId: repository.state.syllabus.active_revision_id,
    reports,
    now: NOW,
    generateItems: async ({ slots, context }) => {
      observedContexts.push(structuredClone(context))
      return slots.map((slot) => ({
        title: `${slot.subject} evidence-informed next step`,
        description: `Provisional instruction for ${slot.subject}; facilitator review required.`,
      }))
    },
  })
}

test('integrated educator intent, evidence, proposal identity, and exact existing-lesson binding remain coherent', async () => {
  const repository = integratedRepository()
  const contexts = []
  const success = learningReport('independent_success', '2026-08-28T12:00:00.000Z')
  const first = await forecast(repository, [success], contexts)

  assert.equal(first.kind, 'proposal')
  assert.equal(first.reused, false)
  assert.equal(repository.state.syllabus.active_revision_id, ACTIVE)
  assert.equal(first.proposal_revision.activated_at, null)
  assert.deepEqual(first.forecast_items.filter((row) => row.origin === 'learning_forecast').map((row) => [row.planned_date, row.subject]), [
    ['2026-09-08', 'science'],
    ['2026-09-09', 'math'],
  ])
  assert.equal(first.forecast_items.find((row) => row.lineage_id === authoredIntent().lineage_id).title, authoredIntent().title)
  assert.equal(contexts[0].syllabus.goals.learning, activeRevision().goals.learning)
  assert.equal(contexts[0].evidence_summaries[0].independent, 'independent_success')
  assert.equal(JSON.stringify(contexts[0]).includes('RAW TRANSCRIPT'), false)
  assert.equal(JSON.stringify(contexts[0]).includes('events'), false)

  const reused = await forecast(repository, [success], contexts)
  assert.equal(reused.reused, true)
  assert.equal(reused.proposal_revision.id, first.proposal_revision.id)
  assert.equal(contexts.length, 1)

  const recovery = learningReport('needs_recovery', '2026-08-29T12:00:00.000Z')
  const reconsidered = await forecast(repository, [recovery], contexts)
  assert.equal(reconsidered.reused, false)
  assert.notEqual(reconsidered.proposal_revision.id, first.proposal_revision.id)
  assert.notEqual(reconsidered.proposal_revision.proposal_key, first.proposal_revision.proposal_key)
  assert.equal(contexts[1].evidence_summaries[0].independent, 'needs_recovery')
  assert.equal(repository.state.syllabus.active_revision_id, ACTIVE)

  const selected = reconsidered.forecast_items.find((row) => row.origin === 'learning_forecast' && row.subject === 'math')
  const siblingProposal = reconsidered.forecast_items.find((row) => row.origin === 'learning_forecast' && row.lineage_id !== selected.lineage_id)
  let lessonGeneratorCalls = 0
  const materialized = await materializeForecastOccurrence({
    repository,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    proposalRevisionId: reconsidered.proposal_revision.id,
    lineageId: selected.lineage_id,
    expectedActiveRevisionId: ACTIVE,
    now: NOW,
    setInferenceSuppressed: async () => {},
    existingLesson: { lessonKey: SHARED_LESSON, title: 'Canonical Shared Fractions', subject: 'math' },
    generateLesson: async () => { lessonGeneratorCalls += 1; throw new Error('existing binding must not generate') },
  })

  assert.equal(materialized.kind, 'existing_lesson_bound')
  assert.equal(materialized.lineage_id, selected.lineage_id)
  assert.equal(lessonGeneratorCalls, 0)
  assert.deepEqual(repository.state.receipts, [])
  const activeItems = materialized.syllabus.forecast_items
  const bound = activeItems.find((row) => row.lineage_id === selected.lineage_id)
  const sameKeySibling = activeItems.find((row) => row.lineage_id === authoredIntent().lineage_id)
  assert.equal(bound.lesson_key, SHARED_LESSON)
  assert.equal(bound.title, 'Canonical Shared Fractions')
  assert.equal(bound.subject, 'math')
  assert.equal(bound.planned_date, selected.planned_date)
  assert.equal(bound.sort_order, selected.sort_order)
  assert.equal(sameKeySibling.lesson_key, SHARED_LESSON)
  assert.notEqual(sameKeySibling.lineage_id, bound.lineage_id)
  assert.equal(materialized.syllabus.proposed_learning_forecast.forecast_items.some((row) => row.lineage_id === siblingProposal.lineage_id), true)
})

test('integrated exact schedule lineage reaches learner read model without same-key or date collapse', async () => {
  const repository = integratedRepository()
  const contexts = []
  const proposal = await forecast(repository, [learningReport('independent_success', '2026-08-28T12:00:00.000Z')], contexts)
  const selected = proposal.forecast_items.find((row) => row.origin === 'learning_forecast' && row.subject === 'math')
  const materialized = await materializeForecastOccurrence({
    repository, facilitatorId: FACILITATOR, learnerId: LEARNER,
    proposalRevisionId: proposal.proposal_revision.id, lineageId: selected.lineage_id,
    expectedActiveRevisionId: ACTIVE, now: NOW, setInferenceSuppressed: async () => {},
    existingLesson: { lessonKey: SHARED_LESSON, title: 'Canonical Shared Fractions', subject: 'math' },
    generateLesson: async () => { throw new Error('must not generate') },
  })
  const schedulePayload = buildLessonSchedulePayload({
    learnerId: LEARNER,
    lessonKey: SHARED_LESSON,
    scheduledDate: '2026-09-21',
    scheduleId: 'schedule-exact',
    forecastLineageId: selected.lineage_id,
  })
  const scheduleRow = {
    id: schedulePayload.scheduleId,
    learner_id: schedulePayload.learnerId,
    lesson_key: schedulePayload.lessonKey,
    scheduled_date: schedulePayload.scheduledDate,
    forecast_lineage_id: schedulePayload.forecastLineageId,
    subject: 'math', title: 'Canonical Shared Fractions', sort_order: selected.sort_order,
    created_at: '2026-08-31T15:00:00.000Z',
  }
  const historicalSession = { id: 'history-exact', lesson_id: SHARED_LESSON, started_at: '2026-08-25T10:00:00Z', ended_at: '2026-08-25T11:00:00Z' }
  const timeline = composeSyllabusLessonTimeline({
    activeRevision: materialized.syllabus.active_revision,
    forecastItems: materialized.syllabus.forecast_items,
    schedules: [scheduleRow],
    sessions: [historicalSession],
    approvedLessons: { [SHARED_LESSON]: true },
    today: '2026-08-31',
  })
  const scheduled = timeline.find((row) => row.occurrence_id === 'scheduled:schedule-exact')
  assert.equal(scheduled.forecast_lineage_id, selected.lineage_id)
  assert.equal(scheduled.reconciled_forecast_id, materialized.syllabus.forecast_items.find((row) => row.lineage_id === selected.lineage_id).id)
  assert.equal(scheduled.planned_date, '2026-09-21')
  assert.equal(timeline.some((row) => row.occurrence_id === `syllabus:${scheduled.reconciled_forecast_id}`), false)
  assert.equal(timeline.some((row) => row.lineage_id === authoredIntent().lineage_id), true)
  assert.equal(timeline.some((row) => row.occurrence_id === 'actual:history-exact'), true)

  const manual = buildLessonSchedulePayload({ learnerId: LEARNER, lessonKey: 'science/manual.json', scheduledDate: '2026-09-10' })
  assert.equal(Object.hasOwn(manual, 'forecastLineageId'), false)
  const legacy = composeSyllabusLessonTimeline({
    activeRevision: materialized.syllabus.active_revision,
    forecastItems: [{ ...authoredIntent(), id: 'legacy-forecast', lineage_id: '20000000-0000-4000-8000-000000000002', planned_date: '2026-09-14' }],
    schedules: [{ id: 'legacy-schedule', lesson_key: SHARED_LESSON, scheduled_date: '2026-09-14', forecast_lineage_id: null }],
    today: '2026-08-31',
  })
  assert.equal(legacy.find((row) => row.occurrence_id === 'scheduled:legacy-schedule').reconciled_forecast_id, 'legacy-forecast')

  const stateBeforePassiveView = structuredClone(repository.state)
  const readModel = resolveSyllabusReadModel({
    has_active_syllabus: true,
    active_revision: materialized.syllabus.active_revision,
    forecast_items: materialized.syllabus.forecast_items,
    timeline_items: timeline,
    resolved_today: '2026-08-31',
  })
  const pending = resolveLearnerSyllabusPresentation({ learnerId: LEARNER, syllabusStatus: 'loading', syllabusKind: 'fallback' })
  const active = resolveLearnerSyllabusPresentation({ learnerId: LEARNER, syllabusStatus: 'ready', syllabusDecisionLearnerId: LEARNER, syllabusKind: readModel.kind })
  assert.equal(pending.state, 'pending')
  assert.equal(pending.showSupportingLibrary, false)
  assert.equal(active.state, 'active')
  assert.equal(active.showSupportingLibrary, false)
  const currentWeekStart = moveSyllabusWeek(null, 'now', readModel.resolved_today)
  assert.equal(selectSyllabusWeek(readModel.timeline_items, { weekStart: currentWeekStart, today: readModel.resolved_today }).state, 'now')
  assert.equal(learnerNowViewportKey({ role: 'learner', learnerId: LEARNER, revisionId: readModel.revision.id, weekState: 'now', weekStart: currentWeekStart }), `${LEARNER}:${readModel.revision.id}:${currentWeekStart}`)
  const learnerActions = syllabusItemActionsFor({ item: scheduled, role: 'learner', state: 'future_unfinished', hasLessonArtifact: true })
  assert.equal(learnerActions.some((action) => ['edit', 'schedule', 'reschedule', 'materialize', 'use_existing'].includes(action.id)), false)
  assert.deepEqual(repository.state, stateBeforePassiveView)
})

test('changed bounded learning evidence changes the next proposal without taking facilitator authority', async () => {
  const repository = integratedRepository()
  const contexts = []
  const first = await forecast(repository, [learningReport('independent_success', '2026-08-28T12:00:00.000Z')], contexts)
  const recovery = await forecast(repository, [learningReport('needs_recovery', '2026-08-29T12:00:00.000Z')], contexts)
  const repeatedRecovery = await forecast(repository, [learningReport('needs_recovery', '2026-08-29T12:00:00.000Z')], contexts)

  assert.notEqual(recovery.proposal_revision.proposal_key, first.proposal_revision.proposal_key)
  assert.equal(repeatedRecovery.reused, true)
  assert.equal(repeatedRecovery.proposal_revision.id, recovery.proposal_revision.id)
  assert.equal(repository.state.syllabus.active_revision_id, ACTIVE)
  assert.equal(recovery.proposal_revision.activated_at, null)
  assert.equal(recovery.forecast_items.find((row) => row.lineage_id === authoredIntent().lineage_id).title, authoredIntent().title)
  assert.equal(contexts.at(-1).evidence_summaries[0].independent, 'needs_recovery')
})

test('forecast-lineage migration remains additive, nullable, exact, and non-destructive', () => {
  const migration = new URL('../../../../../supabase/migrations/20260905120000_add_lesson_schedule_forecast_lineage.sql', import.meta.url)
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /add column if not exists forecast_lineage_id uuid/i)
  assert.match(sql, /unique index[\s\S]*\(learner_id, forecast_lineage_id\)[\s\S]*where forecast_lineage_id is not null/i)
  assert.doesNotMatch(sql, /foreign key|references syllabus_forecast_items|delete from|truncate|drop table|alter column[^;]*not null/i)
  assert.equal(createHash('sha256').update(fs.readFileSync(migration)).digest('hex'), 'e8f563d9198f0a89e2eb0d7c5945b648d5ec9c21823785461f3c048417ec9ae6')
})
