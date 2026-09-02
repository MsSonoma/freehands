import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { buildPlanAhead } from '../planning.mjs'
import { buildForecastViewIdentity, isCurrentForecastResponse } from '../forecastRequestIdentity.mjs'
import { createFacilitatorConcept, editFacilitatorConcept, replaceLearningForecastConcept } from '../planning.server.mjs'
import { materializeForecastOccurrence } from '../materialization.server.mjs'
import { syllabusActionPresentation } from '../timeline.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ACTIVE = 'revision-1'
const SYLLABUS = 'syllabus-1'
const NOW = new Date('2026-08-31T14:00:00.000Z')

function revision() { return { id: ACTIVE, syllabus_id: SYLLABUS, revision_number: 1, effective_from: '2026-08-31', schema_version: 1, goals: { legacy_notes: 'Learn deliberately.' }, subjects: [{ name: 'Math' }, { name: 'Science' }], weekly_pattern: { monday: [{ subject: 'Math' }, { subject: 'Math' }], wednesday: [{ subject: 'Science' }] }, teaching_guidance: { curriculum_preferences: {} }, planning_policy: { difficulty: 'intermediate' }, legacy_provenance: {}, change_reason: 'baseline', activated_at: NOW.toISOString() } }
function concept(overrides = {}) { return { id: 'item-1', revision_id: ACTIVE, lineage_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', planned_date: '2026-09-07', subject: 'Math', title: 'Fractions', description: 'Compare equivalent fractions.', lesson_key: null, item_type: 'lesson', origin: 'facilitator', sort_order: 0, metadata: {}, ...overrides } }

function repository(initial = []) {
  const state = { learner: { id: LEARNER, facilitator_id: FACILITATOR, grade: '5th' }, syllabus: { id: SYLLABUS, facilitator_id: FACILITATOR, learner_id: LEARNER, active_revision_id: ACTIVE }, revisions: [revision()], items: structuredClone(initial), receipts: [], sequence: 1 }
  const clone = (value) => value == null ? value : structuredClone(value)
  return {
    state,
    async findOwnedLearner(id, owner) { return id === LEARNER && owner === FACILITATOR ? clone(state.learner) : null },
    async findSyllabus(owner, id) { return owner === FACILITATOR && id === LEARNER ? clone(state.syllabus) : null },
    async findRevision(id) { return clone(state.revisions.find((row) => row.id === id) || null) },
    async listForecastItems(id) { return clone(state.items.filter((row) => row.revision_id === id)) },
    async nextRevisionNumber() { return state.revisions.length + 1 },
    async insertRevision(row) { const saved = { ...clone(row), id: `revision-${++state.sequence}`, activated_at: null }; state.revisions.push(saved); return clone(saved) },
    async insertForecastItems(id, rows) { state.items.push(...rows.map((row) => ({ ...clone(row), id: `item-${++state.sequence}`, revision_id: id }))) },
    async commitRevisionActivation({ revisionId, expectedActiveRevisionId }) { assert.equal(state.syllabus.active_revision_id, expectedActiveRevisionId); const saved = state.revisions.find((row) => row.id === revisionId); saved.activated_at = NOW.toISOString(); state.syllabus.active_revision_id = revisionId; return clone(saved) },
    async deleteInactiveRevision(id) { state.revisions = state.revisions.filter((row) => row.id !== id); state.items = state.items.filter((row) => row.revision_id !== id) },
    async findLatestLearningForecastProposal(syllabusId, baseRevisionId) { return clone(state.revisions.findLast((row) => row.syllabus_id === syllabusId && row.base_revision_id === baseRevisionId && row.proposal_kind === 'learning_forecast' && !row.activated_at) || null) },
    async replaceLearningForecastProposal({ expectedActiveRevisionId, planning, proposalKey }) { const old = state.revisions.find((row) => row.base_revision_id === expectedActiveRevisionId && row.proposal_kind === 'learning_forecast' && !row.activated_at); if (old) { state.revisions = state.revisions.filter((row) => row !== old); state.items = state.items.filter((row) => row.revision_id !== old.id) } const saved = { ...clone(planning), id: `proposal-${++state.sequence}`, syllabus_id: SYLLABUS, base_revision_id: expectedActiveRevisionId, revision_number: state.sequence, proposal_kind: 'learning_forecast', proposal_key: proposalKey, activated_at: null }; state.revisions.push(saved); state.items.push(...planning.forecast_items.map((row) => ({ ...clone(row), id: `item-${++state.sequence}`, revision_id: saved.id }))); return { revision: clone(saved), reused: false } },
    async findFacilitatorTimeZone() { return 'America/New_York' },
    async claimForecastMaterialization({ lineageId, generationInputHash }) { const receipt = { id: `receipt-${++state.sequence}`, lineage_id: lineageId, generation_input_hash: generationInputHash, status: 'generating', lesson_key: null }; state.receipts.push(receipt); return { claimed: true, receipt: clone(receipt) } },
    async updateForecastMaterialization(id, values) { Object.assign(state.receipts.find((row) => row.id === id), values) },
  }
}

test('Plan Ahead expands one to four weeks from canonical weekly pattern and places existing intent by exact slot', () => {
  const plan = buildPlanAhead({ weeklyPattern: revision().weekly_pattern, forecastItems: [concept()], today: '2026-08-31', weeks: 4 })
  assert.equal(plan.length, 4)
  assert.equal(plan[0].slots.length, 3)
  assert.equal(plan[0].slots[0].item.title, 'Fractions')
  assert.equal(plan[3].week_start, '2026-09-28')
})

test('Create Your Own creates canonical facilitator intent with stable independent lineage and no artifact', async () => {
  const repo = repository()
  const first = await createFacilitatorConcept({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE, plannedDate: '2026-09-07', sortOrder: 0, title: 'Same title', description: 'First exact slot.', now: NOW, today: '2026-08-31' })
  const firstItem = first.forecast_items[0]
  assert.equal(firstItem.origin, 'facilitator')
  assert.equal(firstItem.lesson_key, null)
  assert.equal(firstItem.metadata.facilitator_planning.action, 'created')
  const second = await createFacilitatorConcept({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: first.active_revision.id, plannedDate: '2026-09-07', sortOrder: 1, title: 'Same title', description: 'Second exact slot.', now: NOW, today: '2026-08-31' })
  assert.notEqual(second.forecast_items[0].lineage_id, second.forecast_items[1].lineage_id)
})

test('editing preserves exact lineage, records educator authorship, and concurrent revisions fail closed', async () => {
  const repo = repository([concept({ origin: 'learning_forecast' })])
  const result = await editFacilitatorConcept({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE, lineageId: concept().lineage_id, title: 'Educator direction', description: 'A refined progression.', now: NOW, today: '2026-08-31' })
  assert.equal(result.forecast_items[0].lineage_id, concept().lineage_id)
  assert.equal(result.forecast_items[0].origin, 'facilitator')
  assert.equal(result.forecast_items[0].metadata.facilitator_planning.prior_origin, 'learning_forecast')
  await assert.rejects(createFacilitatorConcept({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE, plannedDate: '2026-09-10', sortOrder: 0, title: 'Stale', description: 'Must fail.', now: NOW, today: '2026-08-31' }), { code: 'ACTIVATION_CONFLICT' })
})

test('AI replacement changes only exact title and description while preserving slot, subject, lineage and inactive authority', async () => {
  const original = concept({ origin: 'learning_forecast' })
  const sibling = concept({ id: 'item-2', lineage_id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', sort_order: 1, title: 'Sibling' })
  const repo = repository()
  await repo.replaceLearningForecastProposal({ expectedActiveRevisionId: ACTIVE, planning: { ...revision(), effective_from: '2026-08-31', forecast_items: [original, sibling] }, proposalKey: 'original' })
  const proposal = await repo.findLatestLearningForecastProposal(SYLLABUS, ACTIVE)
  const result = await replaceLearningForecastConcept({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE, proposalRevisionId: proposal.id, lineageId: original.lineage_id, generateItems: async () => [{ title: 'Different idea', description: 'A different exact-slot direction.' }], reports: [], now: NOW, today: '2026-08-31' })
  const replaced = result.forecast_items.find((item) => item.lineage_id === original.lineage_id)
  assert.deepEqual({ lineage_id: replaced.lineage_id, planned_date: replaced.planned_date, subject: replaced.subject, sort_order: replaced.sort_order, origin: replaced.origin }, { lineage_id: original.lineage_id, planned_date: original.planned_date, subject: original.subject, sort_order: original.sort_order, origin: 'learning_forecast' })
  assert.equal(result.forecast_items.find((item) => item.lineage_id === sibling.lineage_id).title, 'Sibling')
  assert.equal(repo.state.syllabus.active_revision_id, ACTIVE)
})

test('facilitator concept materialization delegates exact lineage and preserves concept on generator failure', async () => {
  const repo = repository([concept()])
  await assert.rejects(materializeForecastOccurrence({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: concept().lineage_id, expectedActiveRevisionId: ACTIVE, generateLesson: async () => { throw new Error('offline') }, now: NOW }), { code: 'MATERIALIZATION_GENERATION_FAILED' })
  assert.equal(repo.state.syllabus.active_revision_id, ACTIVE)
  assert.equal(repo.state.items[0].lesson_key, null)
  assert.equal(repo.state.receipts[0].status, 'generation_failed')
})

test('facilitator UI lazily POSTs forecast on future navigation, provides retry, and keeps learner document control-free', () => {
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  const document = fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8')
  const learner = fs.readFileSync(new URL('../../../learn/LearnerHome.js', import.meta.url), 'utf8')
  assert.match(facilitator, /selectedWeekStart !== targetWeek/)
  assert.match(facilitator, /fetch\('\/api\/syllabus\/forecast'/)
  assert.match(facilitator, /forecastAttempt\.current === identity/)
  assert.match(facilitator, /Retry forecast/)
  assert.match(document, /role === 'facilitator' && onEditSection/)
  assert.doesNotMatch(learner, /onEditSection=/)
})

test('unified planning route enforces planning entitlement without scheduling or a second planned-lessons authority', () => {
  const route = fs.readFileSync(new URL('../../../api/syllabus/planning/route.js', import.meta.url), 'utf8')
  const workspace = fs.readFileSync(new URL('../../../components/syllabus/SyllabusPlanningWorkspace.js', import.meta.url), 'utf8')
  const getRoute = fs.readFileSync(new URL('../../../api/syllabus/route.js', import.meta.url), 'utf8')
  assert.match(route, /requireSyllabusFuturePlanning\(access\)/)
  assert.match(route, /createFacilitatorConcept/)
  assert.doesNotMatch(`${route}\n${workspace}`, /plannedLessons|lesson_schedule|scheduleLesson|generate-lesson-outline/)
  assert.doesNotMatch(getRoute, /createLearningForecastProposal|generateInstructionalForecastItems/)
})

test('Syllabus UX preserves week position and hardens overlays and async planning races', () => {
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  const document = fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8')
  const workspace = fs.readFileSync(new URL('../../../components/syllabus/SyllabusPlanningWorkspace.js', import.meta.url), 'utf8')
  assert.match(document, /\[learnerId, today\]/)
  assert.doesNotMatch(document, /\[revision\?\.id, today\]/)
  assert.match(facilitator, /planningRequest\.current/)
  assert.match(facilitator, /pageIdentity\.current/)
  assert.match(facilitator, /loadSequence\.current/)
  assert.match(facilitator, /forecastError &&/)
  assert.match(facilitator, /Replacing…/)
  assert.match(facilitator, /event\.key !== 'Escape'/)
  assert.match(workspace, /event\.key === 'Escape'/)
  assert.match(workspace, /if \(result\) setEditor\(null\)/)
  assert.match(workspace, /role="alert"/)
})

test('production Syllabus callers expose only host-supported action capabilities', () => {
  const document = fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8')
  const home = fs.readFileSync(new URL('../../../facilitator/page.js', import.meta.url), 'utf8')
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  const learner = fs.readFileSync(new URL('../../../learn/LearnerHome.js', import.meta.url), 'utf8')
  const qa = fs.readFileSync(new URL('../../../qa/syllabus/SyllabusQaHarness.js', import.meta.url), 'utf8')
  assert.equal(syllabusActionPresentation({ action: { id: 'history' }, role: 'facilitator' }), 'hidden')
  assert.equal(syllabusActionPresentation({ action: { id: 'history' }, role: 'facilitator', capabilities: { reviewHistory: true } }), 'button')
  assert.equal(syllabusActionPresentation({ action: { id: 'materialize' }, role: 'facilitator' }), 'hidden')
  assert.equal(syllabusActionPresentation({ action: { id: 'materialize' }, role: 'facilitator', capabilities: { lessonActions: true } }), 'button')
  assert.equal(syllabusActionPresentation({ action: { id: 'view' }, href: '/facilitator/prepare', role: 'facilitator' }), 'link')
  assert.match(document, /presentation === 'hidden'/)
  assert.doesNotMatch(home, /actionCapabilities=/)
  assert.match(home, /href: '\/facilitator\/syllabus'/)
  assert.match(facilitator, /actionCapabilities=\{\{ reviewHistory: true, lessonActions: true \}\}/)
  assert.match(learner, /actionCapabilities=\{\{ openLesson: true \}\}/)
  assert.match(qa, /reviewHistory: true, lessonActions: true/)
})

test('production forecast responses require exact learner revision target week selected week and sequence', () => {
  const weekA = buildForecastViewIdentity({ learnerId: LEARNER, activeRevisionId: ACTIVE, targetWeek: '2026-09-07', selectedWeekStart: '2026-09-07' })
  const weekB = buildForecastViewIdentity({ learnerId: LEARNER, activeRevisionId: ACTIVE, targetWeek: '2026-09-07', selectedWeekStart: '2026-09-14' })
  assert.notEqual(weekA, weekB)
  assert.equal(isCurrentForecastResponse({ requestIdentity: weekA, currentIdentity: weekB, requestSequence: 1, currentSequence: 1 }), false)
  assert.equal(isCurrentForecastResponse({ requestIdentity: weekA, currentIdentity: weekA, requestSequence: 1, currentSequence: 2 }), false)
  assert.equal(isCurrentForecastResponse({ requestIdentity: weekA, currentIdentity: weekA, requestSequence: 2, currentSequence: 2 }), true)
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  assert.match(facilitator, /targetWeek: currentTargetForecastWeek/)
  assert.match(facilitator, /selectedWeekStart/)
  assert.match(facilitator, /forecastRequestSequence/)
  assert.match(facilitator, /if \(!responseIsCurrent\(\)\) return/)
  assert.match(facilitator, /forecastAttempt\.current === identity/)
})
