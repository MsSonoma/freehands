import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { buildPlanAhead } from '../planning.mjs'
import { buildAutomaticForecastAttemptIdentity, buildForecastViewIdentity, isCurrentForecastResponse } from '../forecastRequestIdentity.mjs'
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
  let replacementContext
  const result = await replaceLearningForecastConcept({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE, proposalRevisionId: proposal.id, lineageId: original.lineage_id, changeRequest: 'Make it more hands-on.', generateItems: async ({ context }) => { replacementContext = context; return [{ title: 'Different idea', description: 'A different exact-slot direction.' }] }, reports: [], now: NOW, today: '2026-08-31' })
  const replaced = result.forecast_items.find((item) => item.lineage_id === original.lineage_id)
  assert.deepEqual({ lineage_id: replaced.lineage_id, planned_date: replaced.planned_date, subject: replaced.subject, sort_order: replaced.sort_order, origin: replaced.origin }, { lineage_id: original.lineage_id, planned_date: original.planned_date, subject: original.subject, sort_order: original.sort_order, origin: 'learning_forecast' })
  assert.equal(result.forecast_items.find((item) => item.lineage_id === sibling.lineage_id).title, 'Sibling')
  assert.equal(repo.state.syllabus.active_revision_id, ACTIVE)
  assert.equal(replacementContext.syllabus.facilitator_change_request, 'Make it more hands-on.')
  assert.deepEqual(replacementContext.syllabus.current_forecast, { title: original.title, description: original.description })
  assert.equal(replaced.metadata.learning_forecast_replacement.facilitator_change_request, 'Make it more hands-on.')
})

test('facilitator concept materialization delegates exact lineage and preserves concept on generator failure', async () => {
  const repo = repository([concept()])
  await assert.rejects(materializeForecastOccurrence({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: concept().lineage_id, expectedActiveRevisionId: ACTIVE, generateLesson: async () => { throw new Error('offline') }, now: NOW }), { code: 'MATERIALIZATION_GENERATION_FAILED' })
  assert.equal(repo.state.syllabus.active_revision_id, ACTIVE)
  assert.equal(repo.state.items[0].lesson_key, null)
  assert.equal(repo.state.receipts[0].status, 'generation_failed')
})

test('facilitator UI automatically POSTs forecast after authoritative refresh, keeps forecast rows decision-free, and keeps learner document control-free', () => {
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const document = fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8')
  const learner = fs.readFileSync(new URL('../../../learn/LearnerHome.js', import.meta.url), 'utf8')
  const automaticEffectStart = facilitator.indexOf('useEffect(() => {\n    const activeId')
  const automaticEffect = facilitator.slice(automaticEffectStart, facilitator.indexOf('  useEffect(() => {', automaticEffectStart + 1))
  assert.match(facilitator, /fetch\('\/api\/syllabus\/forecast'/)
  assert.match(facilitator, /setForecastRefreshSequence\(\(current\) => current \+ 1\)/)
  assert.match(automaticEffect, /refreshSequence: forecastRefreshSequence/)
  assert.match(automaticEffect, /forecastAttempt\.current === identity/)
  assert.equal((automaticEffect.match(/createLearningForecast\(\{ automatic: true \}\)/g) || []).length, 1)
  assert.doesNotMatch(automaticEffect, /selectedWeekStart|learningProposal/)
  assert.doesNotMatch(document, /Retry forecast|Use this forecast/)
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
  const detailOverlay = fs.readFileSync(new URL('../../../components/syllabus/FacilitatorSyllabusLessonOverlay.js', import.meta.url), 'utf8')
  const workspace = fs.readFileSync(new URL('../../../components/syllabus/SyllabusPlanningWorkspace.js', import.meta.url), 'utf8')
  assert.ok(document.includes('[learnerId, restoreWeekStart, today]'))
  assert.ok(!document.includes('[revision?.id, today]'))
  assert.ok(facilitator.includes('planningRequest.current'))
  assert.ok(facilitator.includes('pageIdentity.current'))
  assert.ok(facilitator.includes('loadSequence.current'))
  assert.match(document, /forecastError &&/)
  assert.ok(detailOverlay.includes('Generate with changes'))
  assert.ok(facilitator.includes("event.key !== 'Escape'"))
  assert.ok(workspace.includes("event.key === 'Escape'"))
  assert.ok(workspace.includes('if (result) setEditor(null)'))
  assert.match(workspace, /role="alert"/)
  assert.ok(!workspace.includes('role="dialog"') && !workspace.includes('aria-modal') && !workspace.includes('styles.backdrop') && !workspace.includes('document.body.style.overflow'))
})

test('inactive forecast presentation stays readable in the weekly document and keeps its actions in the detail overlay', () => {
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  const document = fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8')
  const detailOverlay = fs.readFileSync(new URL('../../../components/syllabus/FacilitatorSyllabusLessonOverlay.js', import.meta.url), 'utf8')
  assert.ok(!facilitator.includes('styles.learningProposal') && !facilitator.includes('Proposed forecast') && !facilitator.includes('Next week&apos;s open Syllabus slots'))
  assert.ok(facilitator.includes('proposedForecastItems={learningProposal?.forecast_items || []}'))
  assert.match(document, /Forecast lesson/)
  assert.ok(document.includes('data-forecast-lineage={item.lineage_id}'))
  assert.ok(document.includes('onSelect(item, { suggested: true, recoveryRequired })'))
  assert.doesNotMatch(document, /suggestionAction|Use this forecast|Retry forecast/)
  for (const action of ['Forecast lesson', 'Generate lesson', 'Generate with changes', 'Create your own lesson']) assert.match(detailOverlay, new RegExp(action))
  assert.match(detailOverlay, /one-week-ahead lesson recommendation/)
  assert.match(document, /projectLearningForecastForWeek/)
  assert.match(document, /syllabusDayPresentation/)
})

test('forecast progress and failure stay quiet inside the exact target week without a second planning decision', () => {
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  const document = fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8')
  assert.match(document, /week\.week_start === startOfSyllabusWeek\(proposedForecastTargetWeek\)/)
  assert.match(document, /Preparing next week&apos;s lesson forecast/)
  assert.doesNotMatch(document, /Retry forecast|Use this forecast/)
  assert.match(facilitator, /setForecastError\(cause\.message\)/)
  assert.doesNotMatch(facilitator.slice(facilitator.indexOf('async function createLearningForecast'), facilitator.indexOf('function openSectionEditor')), /setError\(cause\.message\)/)
})

test('forecast decisions stay per lesson: unchanged, facilitator-directed, or educator-authored generation', () => {
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  const route = fs.readFileSync(new URL('../../../api/syllabus/planning/route.js', import.meta.url), 'utf8')
  const model = fs.readFileSync(new URL('../learningForecastModel.server.mjs', import.meta.url), 'utf8')
  assert.match(facilitator, /generateForecastWithChanges/)
  assert.match(facilitator, /changeRequest/)
  assert.match(facilitator, /source: 'forecast-own'/)
  assert.match(facilitator, /Generate my lesson/)
  assert.match(route, /changeRequest: body\.changeRequest/)
  assert.match(model, /facilitator_change_request/)
  assert.doesNotMatch(facilitator, /activateLearningProposal/)
})
test('Plan Ahead is one inline Syllabus mode and the initial no-active flow remains dedicated', () => {
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  const document = fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8')
  const workspace = fs.readFileSync(new URL('../../../components/syllabus/SyllabusPlanningWorkspace.js', import.meta.url), 'utf8')
  assert.match(facilitator, /planAheadOpen \? <SyllabusPlanningWorkspace/)
  assert.equal((document.match(/>Plan ahead</g) || []).length, 1)
  assert.doesNotMatch(workspace, /role="dialog"|aria-modal|styles\.backdrop/)
  assert.match(workspace, /Back to week view/)
  assert.match(facilitator, /This learner does not have an active Syllabus yet/)
  for (const section of ['Goals', 'Subjects', 'Weekly pattern', 'Teaching guidance']) assert.match(document, new RegExp(section, 'i'))
})

test('production Syllabus callers expose selection only where the host supplies a detail workflow', () => {
  const document = fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8')
  const home = fs.readFileSync(new URL('../../../facilitator/page.js', import.meta.url), 'utf8')
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  const learner = fs.readFileSync(new URL('../../../learn/LearnerHome.js', import.meta.url), 'utf8')
  assert.equal(syllabusActionPresentation({ action: { id: 'history' }, role: 'facilitator' }), 'hidden')
  assert.equal(syllabusActionPresentation({ action: { id: 'history' }, role: 'facilitator', capabilities: { reviewHistory: true } }), 'button')
  assert.equal(syllabusActionPresentation({ action: { id: 'materialize' }, role: 'facilitator' }), 'hidden')
  assert.equal(syllabusActionPresentation({ action: { id: 'materialize' }, role: 'facilitator', capabilities: { lessonActions: true } }), 'button')
  assert.equal(syllabusActionPresentation({ action: { id: 'view' }, href: '/facilitator/prepare', role: 'facilitator' }), 'link')
  assert.ok(!document.includes("presentation === 'hidden'") && !document.includes('actionCapabilities='))
  assert.match(document, /onSelectLesson/)
  assert.doesNotMatch(home, /actionCapabilities=/)
  assert.match(home, new RegExp("href: '/facilitator/syllabus'"))
  assert.ok(facilitator.includes('onSelectLesson={(item, context) => setSelectedSyllabusLesson'))
  assert.doesNotMatch(facilitator, /actionCapabilities=/)
  assert.ok(learner.includes('onSelectLesson={(item, context) => openSyllabusLesson'))
  assert.ok(!learner.includes('actionCapabilities={{ openLesson: true }}'))
})

test('production forecast identity ignores viewed week while protecting canonical identity and request sequence', () => {
  const weekA = buildForecastViewIdentity({ learnerId: LEARNER, activeRevisionId: ACTIVE, targetWeek: '2026-09-07', selectedWeekStart: '2026-09-07' })
  const sameForecastFromAnotherView = buildForecastViewIdentity({ learnerId: LEARNER, activeRevisionId: ACTIVE, targetWeek: '2026-09-07', selectedWeekStart: '2026-09-14' })
  const nextTarget = buildForecastViewIdentity({ learnerId: LEARNER, activeRevisionId: ACTIVE, targetWeek: '2026-09-14', selectedWeekStart: '2026-09-07' })
  const nextRevision = buildForecastViewIdentity({ learnerId: LEARNER, activeRevisionId: 'revision-2', targetWeek: '2026-09-07' })
  const nextLearner = buildForecastViewIdentity({ learnerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', activeRevisionId: ACTIVE, targetWeek: '2026-09-07' })
  assert.equal(weekA, sameForecastFromAnotherView)
  assert.equal(weekA, buildForecastViewIdentity({ learnerId: LEARNER, activeRevisionId: ACTIVE, targetWeek: '2026-09-07' }))
  assert.notEqual(weekA, nextTarget)
  assert.notEqual(weekA, nextRevision)
  assert.notEqual(weekA, nextLearner)
  assert.equal(isCurrentForecastResponse({ requestIdentity: weekA, currentIdentity: nextTarget, requestSequence: 1, currentSequence: 1 }), false)
  assert.equal(isCurrentForecastResponse({ requestIdentity: weekA, currentIdentity: sameForecastFromAnotherView, requestSequence: 1, currentSequence: 2 }), false)
  assert.equal(isCurrentForecastResponse({ requestIdentity: weekA, currentIdentity: sameForecastFromAnotherView, requestSequence: 2, currentSequence: 2 }), true)
  assert.equal(buildAutomaticForecastAttemptIdentity({ requestIdentity: weekA, refreshSequence: 1 }), `${weekA}:1`)
  assert.equal(buildAutomaticForecastAttemptIdentity({ requestIdentity: sameForecastFromAnotherView, refreshSequence: 1 }), `${weekA}:1`)
  assert.equal(buildAutomaticForecastAttemptIdentity({ requestIdentity: weekA, refreshSequence: 2 }), `${weekA}:2`)
  const facilitator = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  assert.match(facilitator, /targetWeek: currentTargetForecastWeek/)
  assert.doesNotMatch(facilitator.slice(facilitator.indexOf('forecastViewIdentity.current ='), facilitator.indexOf('const planningAccess')), /selectedWeekStart/)
  assert.match(facilitator, /forecastRequestSequence/)
  assert.match(facilitator, /if \(!responseIsCurrent\(\)\) return/)
  assert.match(facilitator, /forecastAttempt\.current === identity/)
})
