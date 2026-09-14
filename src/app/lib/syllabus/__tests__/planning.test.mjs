import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { buildFuturePlanningProjection } from '../futurePlanningProjection.mjs'
import { instructionalForecastWindow } from '../forecastWindow.mjs'
import { buildAutomaticForecastAttemptIdentity, buildForecastViewIdentity, isCurrentForecastResponse } from '../forecastRequestIdentity.mjs'
import { createFacilitatorConcept, createFacilitatorDayConcept, editFacilitatorConcept, replaceLearningForecastConcept } from '../planning.server.mjs'
import { materializeForecastOccurrence } from '../materialization.server.mjs'
import { syllabusActionPresentation } from '../timeline.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ACTIVE = 'revision-1'
const SYLLABUS = 'syllabus-1'
const NOW = new Date('2026-08-31T14:00:00.000Z')

function revision() { return { id: ACTIVE, syllabus_id: SYLLABUS, revision_number: 1, effective_from: '2026-08-31', schema_version: 1, goals: { legacy_notes: 'Learn deliberately.' }, subjects: [{ name: 'Math' }, { name: 'Science' }], weekly_pattern: { monday: [{ subject: 'Math' }, { subject: 'Math' }], wednesday: [{ subject: 'Science' }] }, teaching_guidance: { curriculum_preferences: {} }, planning_policy: { difficulty: 'intermediate' }, legacy_provenance: {}, change_reason: 'baseline', activated_at: NOW.toISOString() } }
function concept(overrides = {}) { return { id: 'item-1', revision_id: ACTIVE, lineage_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', planned_date: '2026-09-07', subject: 'Math', title: 'Fractions', description: 'Compare equivalent fractions.', lesson_key: null, item_type: 'lesson', origin: 'facilitator', sort_order: 0, metadata: {}, ...overrides } }

function repository(initial = [], { noSchoolDates = [] } = {}) {
  const state = { learner: { id: LEARNER, facilitator_id: FACILITATOR, grade: '5th' }, syllabus: { id: SYLLABUS, facilitator_id: FACILITATOR, learner_id: LEARNER, active_revision_id: ACTIVE }, revisions: [revision()], items: structuredClone(initial), receipts: [], noSchoolDates: structuredClone(noSchoolDates), sequence: 1 }
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
    async listNoSchoolDates(owner, id, fromDate = null, toDate = null) { return owner === FACILITATOR && id === LEARNER ? clone(state.noSchoolDates.filter((row) => (!fromDate || row.date >= fromDate) && (!toDate || row.date <= toDate))) : [] },
    async claimForecastMaterialization({ lineageId, generationInputHash }) { const receipt = { id: `receipt-${++state.sequence}`, lineage_id: lineageId, generation_input_hash: generationInputHash, status: 'generating', lesson_key: null }; state.receipts.push(receipt); return { claimed: true, receipt: clone(receipt) } },
    async updateForecastMaterialization(id, values) { Object.assign(state.receipts.find((row) => row.id === id), values) },
  }
}

test('the automatic forecast uses a rolling seven-day window, including this week', () => {
  assert.deepEqual(instructionalForecastWindow('2026-09-14'), { start: '2026-09-14', end: '2026-09-20' })
  assert.deepEqual(instructionalForecastWindow('2026-09-18'), { start: '2026-09-18', end: '2026-09-24' })
  assert.deepEqual(instructionalForecastWindow('2026-12-29'), { start: '2026-12-29', end: '2027-01-04' })
  assert.deepEqual(instructionalForecastWindow(''), { start: '', end: '' })
})

test('future planning expands canonical weekly-pattern slots in place while preserving exact active intent', () => {
  const plan = buildFuturePlanningProjection({
    weeklyPattern: revision().weekly_pattern,
    timelineItems: [concept()],
    rangeStart: '2026-09-07',
    rangeEnd: '2026-10-04',
    today: '2026-08-31',
    includeOpenSlots: true,
  })
  assert.equal(plan.active_items[0].title, 'Fractions')
  assert.equal(plan.open_slots.length, 11)
  assert.equal(plan.open_slots.some((slot) => slot.planned_date === '2026-09-07' && slot.sort_order === 0), false)
  assert.equal(plan.open_slots.some((slot) => slot.planned_date === '2026-09-28'), true)
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

test('day-authored lesson uses normal capacity, requires PIN outside the pattern, and day-off authority wins over PIN', async () => {
  const normalRepo = repository()
  const normal = await createFacilitatorDayConcept({ repository: normalRepo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE, plannedDate: '2026-09-07', subject: 'Math', title: 'Monday lesson', description: 'Use the ordinary Monday Math slot.', generationSpec: { difficulty: 'advanced', notes: 'Use manipulatives.', vocab: 'quotient, divisor', ignored: 'not persisted' }, now: NOW, today: '2026-08-31' })
  assert.equal(normal.forecast_items[0].planned_date, '2026-09-07')
  assert.equal(normal.forecast_items[0].sort_order, 0)
  assert.equal(normal.forecast_items[0].metadata.facilitator_planning.action, 'created_day')
  assert.deepEqual(normal.forecast_items[0].metadata.facilitator_planning.generation_spec, { difficulty: 'advanced', notes: 'Use manipulatives.', vocab: 'quotient, divisor' })
  assert.equal(normal.created_lineage_id, normal.forecast_items[0].lineage_id)

  const exceptionRepo = repository()
  await assert.rejects(createFacilitatorDayConcept({ repository: exceptionRepo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE, plannedDate: '2026-09-08', subject: 'Math', title: 'Tuesday Math', description: 'An educator-directed exception.', now: NOW, today: '2026-08-31' }), { code: 'SYLLABUS_CAPACITY_PIN_REQUIRED' })
  const exception = await createFacilitatorDayConcept({ repository: exceptionRepo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE, plannedDate: '2026-09-08', subject: 'Math', title: 'Tuesday Math', description: 'An educator-directed exception.', allowCapacityException: true, now: NOW, today: '2026-08-31' })
  assert.equal(exception.forecast_items[0].planned_date, '2026-09-08')
  assert.equal(exception.forecast_items[0].subject, 'Math')

  const blockedRepo = repository([], { noSchoolDates: [{ date: '2026-09-07', reason: 'Holiday: Labor Day' }] })
  await assert.rejects(createFacilitatorDayConcept({ repository: blockedRepo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE, plannedDate: '2026-09-07', subject: 'Math', title: 'Blocked', description: 'Must not be created.', allowCapacityException: true, now: NOW, today: '2026-08-31' }), { code: 'NO_SCHOOL_DATE' })
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

test('day-authored detailed generation settings reach canonical materialization and participate in its identity', async () => {
  const detailed = concept({ metadata: { facilitator_planning: { generation_spec: { difficulty: 'advanced', notes: 'Use manipulatives.', vocab: 'quotient, divisor' } } } })
  const firstRepo = repository([detailed])
  let received
  await assert.rejects(materializeForecastOccurrence({ repository: firstRepo, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: detailed.lineage_id, expectedActiveRevisionId: ACTIVE, generateLesson: async (spec) => { received = spec; throw new Error('offline') }, now: NOW }), { code: 'MATERIALIZATION_GENERATION_FAILED' })
  assert.equal(received.difficulty, 'advanced')
  assert.match(received.notes, /Use manipulatives\./)
  assert.equal(received.vocab, 'quotient, divisor')
  const detailedHash = firstRepo.state.receipts[0].generation_input_hash

  const ordinaryRepo = repository([concept()])
  await assert.rejects(materializeForecastOccurrence({ repository: ordinaryRepo, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: concept().lineage_id, expectedActiveRevisionId: ACTIVE, generateLesson: async () => { throw new Error('offline') }, now: NOW }), { code: 'MATERIALIZATION_GENERATION_FAILED' })
  assert.notEqual(detailedHash, ordinaryRepo.state.receipts[0].generation_input_hash)
})
test('facilitator concept materialization delegates exact lineage and preserves concept on generator failure', async () => {
  const repo = repository([concept()])
  await assert.rejects(materializeForecastOccurrence({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, lineageId: concept().lineage_id, expectedActiveRevisionId: ACTIVE, generateLesson: async () => { throw new Error('offline') }, now: NOW }), { code: 'MATERIALIZATION_GENERATION_FAILED' })
  assert.equal(repo.state.syllabus.active_revision_id, ACTIVE)
  assert.equal(repo.state.items[0].lesson_key, null)
  assert.equal(repo.state.receipts[0].status, 'generation_failed')
})

const homeSource = () => fs.readFileSync(new URL('../../../facilitator/page.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const documentSource = () => fs.readFileSync(new URL('../../../components/syllabus/SyllabusDocument.js', import.meta.url), 'utf8')

test('facilitator Home is the full Syllabus, not a preview or separate planning workspace', () => {
  const home = homeSource()
  assert.match(home, /export default function FacilitatorPage/)
  assert.match(home, /<SyllabusDocument/)
  assert.match(home, /<FacilitatorSyllabusLessonOverlay/)
  assert.match(home, /<SyllabusPlanEditor/)
  assert.match(home, /<SyllabusDayActionDialog/)
  assert.doesNotMatch(home, /SyllabusPlanningWorkspace|planAheadOpen|styles\.learningProposal|MS\. SONOMA \/ FORECAST/)
  assert.doesNotMatch(documentSource(), /Plan ahead|OpenPlanningSlot|onPlanSlot|onSuggestSlot/)
  assert.equal(fs.existsSync(new URL('../../../components/syllabus/SyllabusPlanningWorkspace.js', import.meta.url)), false)
})

test('the retired Syllabus URL only redirects to Home with query context preserved', () => {
  const legacy = fs.readFileSync(new URL('../../../facilitator/syllabus/page.js', import.meta.url), 'utf8')
  assert.match(legacy, /redirect\(query \? `\/facilitator\?\$\{query\}` : '\/facilitator'\)/)
  assert.match(legacy, /await searchParams/)
  assert.match(legacy, /params\.append/)
  assert.doesNotMatch(legacy, /SyllabusDocument|fetch\(/)
})

test('automatic requests survive week navigation and begin only after authoritative hydration', () => {
  const home = homeSource()
  const start = home.indexOf('useEffect(() => {\n    if (!syllabusHydrated) return undefined')
  const effect = home.slice(start, home.indexOf('  useEffect(() => {', start + 1))
  assert.ok(start >= 0)
  assert.match(effect, /refreshSequence: forecastRefreshSequence/)
  assert.match(effect, /forecastAttempt\.current === identity/)
  assert.equal((effect.match(/createLearningForecast\(\{ automatic: true \}\)/g) || []).length, 1)
  assert.doesNotMatch(effect, /selectedWeekStart|learningProposal/)
  assert.match(home, /proposal_revision\?\.base_revision_id === syllabus\.active_revision\.id/)
  assert.match(home, /json\.kind === 'no_action'[\s\S]*?setLearningProposal\(null\)/)
})

test('grey forecast lessons are projected into dated rows and open the real per-lesson workflow', () => {
  const home = homeSource(), doc = documentSource()
  assert.match(home, /proposedForecastItems=/)
  assert.match(home, /forecastWindowEnd=\{forecastWindow\.end\}/)
  assert.match(doc, /buildFuturePlanningProjection/)
  assert.match(doc, /syllabusDayPresentation\(day\.items, suggestions\)/)
  assert.match(doc, /onSelect\(item, \{ suggested, recoveryRequired: generation\.blocked \}\)/)
  assert.match(doc, /includeOpenSlots: false/)
  assert.match(doc, /Retry forecast/)
  const overlay = fs.readFileSync(new URL('../../../components/syllabus/FacilitatorSyllabusLessonOverlay.js', import.meta.url), 'utf8')
  const generationState = fs.readFileSync(new URL('../lessonGenerationState.mjs', import.meta.url), 'utf8')
  for (const action of ['Generate lesson', 'Generate with changes', 'Create your own lesson', 'Retry generation']) assert.ok(`${overlay}\n${generationState}`.includes(action))
  assert.match(overlay, /generation\.action/)
  assert.match(doc, /isUngeneratedSyllabusLesson\(item\)/)
  assert.match(home, /onGenerateWithChanges=/)
  assert.match(home, /onCreateOwnLesson=\{createOwnForecastLesson\}/)
  assert.doesNotMatch(home, /activateLearningProposal/)
})

test('grey projection never overwrites commitments or days off and cannot create beyond its window', () => {
  const forecast = (date, order, lineage) => ({ planned_date: date, sort_order: order, lineage_id: lineage, origin: 'learning_forecast', lesson_key: null, subject: 'Math' })
  const active = { ...forecast('2026-09-14', 0, 'active'), origin: 'facilitator', lesson_key: 'generated/committed.json' }
  const projection = buildFuturePlanningProjection({
    timelineItems: [active],
    proposedForecastItems: [forecast('2026-09-14', 0, 'conflict'), forecast('2026-09-14', 1, 'open'), forecast('2026-09-16', 0, 'holiday'), forecast('2026-09-21', 0, 'too-far')],
    noSchoolDates: [{ date: '2026-09-16' }],
    rangeStart: '2026-09-14', rangeEnd: '2026-09-20', today: '2026-09-14',
  })
  assert.deepEqual(projection.forecast_items.map(item => item.lineage_id), ['open'])
  assert.equal(projection.active_items[0].lesson_key, active.lesson_key)
  assert.equal(projection.forecast_items[0].presentation_kind, 'suggested_inactive')
  assert.deepEqual(projection.open_slots, [])
})

test('learner presentation never receives the facilitator forecast mutation handlers', () => {
  const learner = fs.readFileSync(new URL('../../../learn/LearnerHome.js', import.meta.url), 'utf8')
  assert.doesNotMatch(learner, /onEditSection=|onRetryForecast=|onCreateOwnLesson=/)
  assert.match(documentSource(), /role === 'facilitator' && onSelectLesson/)
})

test('canonical workflow keeps generation and approval separate and preserves return identity', async () => {
  const { buildLessonWorkflowReturnHref } = await import('../../facilitatorLessonWorkflow.mjs')
  const href = buildLessonWorkflowReturnHref({ source: 'syllabus', learnerId: LEARNER, plannedDate: '2026-09-14', lessonKey: 'generated/example.json', occurrenceId: 'exact-occurrence' })
  const url = new URL(href, 'https://fixture.invalid')
  assert.equal(url.pathname, '/facilitator')
  assert.equal(url.searchParams.get('learnerId'), LEARNER)
  assert.equal(url.searchParams.get('date'), '2026-09-14')
  assert.equal(url.searchParams.get('occurrenceId'), 'exact-occurrence')
})

test('request identity rejects a late response after the learner or revision changed', () => {
  const identity = buildForecastViewIdentity({ learnerId: LEARNER, activeRevisionId: ACTIVE, targetWeek: '2026-09-14' })
  assert.equal(isCurrentForecastResponse({ requestIdentity: identity, currentIdentity: identity, requestSequence: 1, currentSequence: 2 }), false)
  assert.equal(isCurrentForecastResponse({ requestIdentity: identity, currentIdentity: 'another-learner', requestSequence: 1, currentSequence: 1 }), false)
})


test('generation with changes handles an already-selected lesson in place without recreating a proposal', async () => {
  const original = concept({ origin: 'learning_forecast' })
  const repo = repository([original])
  const result = await replaceLearningForecastConcept({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
    lineageId: original.lineage_id, changeRequest: 'Use familiar examples.', reports: [], now: NOW, today: '2026-08-31',
    generateItems: async ({ slots, context }) => {
      assert.equal(slots.length, 1)
      assert.equal(context.syllabus.facilitator_change_request, 'Use familiar examples.')
      return [{ title: 'Fractions with examples', description: 'Use familiar examples to compare fractions.' }]
    },
  })
  assert.equal(result.kind, 'active')
  assert.equal(result.proposal_revision, undefined)
  const edited = result.forecast_items.find(row => row.lineage_id === original.lineage_id)
  assert.equal(edited.title, 'Fractions with examples')
  assert.equal(edited.planned_date, original.planned_date)
  assert.equal(edited.lineage_id, original.lineage_id)
})


test('an in-flight or ambiguous generation cannot be rewritten through custom lesson editing', async () => {
  for (const status of ['generating', 'generated', 'binding_failed', 'recovery_required']) {
    const repo = repository([concept({ origin: 'learning_forecast' })])
    repo.findForecastMaterialization = async () => ({ status, lesson_key: null })
    await assert.rejects(editFacilitatorConcept({ repository: repo, facilitatorId: FACILITATOR, learnerId: LEARNER, expectedActiveRevisionId: ACTIVE,
      lineageId: concept().lineage_id, title: 'Changed', description: 'Must not alter pending generation.', now: NOW, today: '2026-08-31',
    }), { code: 'MATERIALIZATION_RECOVERY_REQUIRED' })
    assert.equal(repo.state.syllabus.active_revision_id, ACTIVE)
  }
})
