import assert from 'node:assert/strict'
import test from 'node:test'

import { readCurrentLessonBinding, removeLessonFromLearner } from '../learnerLessonRemoval.server.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TARGET = 'generated/target.json'
const NOW = new Date('2026-09-04T14:00:00.000Z')

function revision() {
  return {
    id: 'revision-1', syllabus_id: 'syllabus-1', revision_number: 1, effective_from: '2026-09-01', schema_version: 1,
    goals: {}, subjects: [{ name: 'Math' }], weekly_pattern: { friday: [{ subject: 'Math' }, { subject: 'Math' }] },
    teaching_guidance: {}, planning_policy: {}, legacy_provenance: {}, change_reason: 'original', activated_at: NOW.toISOString(),
  }
}

function forecast(id, lessonKey, plannedDate) {
  const lineageIds = {
    past: '10000000-0000-4000-8000-000000000001',
    target: '10000000-0000-4000-8000-000000000002',
    other: '10000000-0000-4000-8000-000000000003',
  }
  return { id, revision_id: 'revision-1', lineage_id: lineageIds[id], planned_date: plannedDate, subject: 'Math', title: id, description: `${id} description`, lesson_key: lessonKey, item_type: 'lesson', origin: 'facilitator', sort_order: id === 'other' ? 1 : 0, metadata: {} }
}

function fixture({ approvedLessons = {}, associations = [], schedules = [], forecasts = [], active = true } = {}) {
  const originalRevision = revision()
  const originalItems = structuredClone(forecasts)
  const state = {
    learner: { id: LEARNER, facilitator_id: FACILITATOR, name: 'Avery', approved_lessons: structuredClone(approvedLessons) },
    syllabus: active ? { id: 'syllabus-1', facilitator_id: FACILITATOR, learner_id: LEARNER, active_revision_id: originalRevision.id } : null,
    revisions: active ? [structuredClone(originalRevision)] : [], items: structuredClone(forecasts),
    associations: structuredClone(associations), schedules: structuredClone(schedules), next: 1, touchedTables: [],
  }
  const clone = (value) => value == null ? value : structuredClone(value)
  const repository = {
    async findOwnedLearner(id, owner) { return id === LEARNER && owner === FACILITATOR ? clone(state.learner) : null },
    async findFacilitatorTimeZone() { return 'UTC' },
    async findSyllabus(owner, id) { return owner === FACILITATOR && id === LEARNER ? clone(state.syllabus) : null },
    async findRevision(id) { return clone(state.revisions.find((row) => row.id === id) || null) },
    async listForecastItems(id) { return clone(state.items.filter((row) => row.revision_id === id)) },
    async listLessonAssociations() { return clone(state.associations) },
    async listLessonSchedule(_facilitatorId, _learnerId, effectiveFrom) {
      return clone(state.schedules.filter((row) => String(row.scheduled_date).slice(0, 10) >= String(effectiveFrom).slice(0, 10)))
    },
    async nextRevisionNumber() { return state.revisions.length + 1 },
    async insertRevision(row) { const saved = { ...clone(row), id: `revision-new-${state.next++}`, activated_at: null }; state.revisions.push(saved); return clone(saved) },
    async insertForecastItems(id, rows) { state.items.push(...rows.map((row) => ({ ...clone(row), id: `new-item-${state.next++}`, revision_id: id }))); return [] },
    async commitRevisionActivation({ revisionId, expectedActiveRevisionId }) { assert.equal(state.syllabus.active_revision_id, expectedActiveRevisionId); const saved = state.revisions.find((row) => row.id === revisionId); saved.activated_at = NOW.toISOString(); state.syllabus.active_revision_id = revisionId; return clone(saved) },
    async deleteInactiveRevision(id) { state.revisions = state.revisions.filter((row) => row.id !== id); state.items = state.items.filter((row) => row.revision_id !== id) },
  }
  function resultBuilder(apply) {
    const filters = {}
    const builder = {
      eq(column, value) { filters[column] = value; return builder },
      in(column, values) { filters[column] = values; return builder },
      then(resolve, reject) { try { apply(filters); return Promise.resolve({ error: null }).then(resolve, reject) } catch (error) { return Promise.reject(error).then(resolve, reject) } },
    }
    return builder
  }
  const admin = {
    from(table) {
      state.touchedTables.push(table)
      if (table === 'lesson_schedule') return { delete: () => resultBuilder((filters) => { state.schedules = state.schedules.filter((row) => !filters.id?.includes(row.id)) }) }
      if (table === 'syllabus_lesson_associations') return { delete: () => resultBuilder((filters) => { state.associations = state.associations.filter((row) => filters.id ? !filters.id.includes(row.id) : row.lesson_key !== filters.lesson_key) }) }
      if (table === 'learners') return { update: (values) => resultBuilder(() => { state.learner = { ...state.learner, ...clone(values) } }) }
      throw new Error(`Historical or unexpected table touched: ${table}`)
    },
  }
  return { state, repository, admin, originalRevision, originalItems }
}

async function binding(overrides) {
  const fx = fixture(overrides)
  return readCurrentLessonBinding({ repository: fx.repository, facilitatorId: FACILITATOR, learner: fx.state.learner, lessonKey: TARGET, now: NOW })
}

test('current binding detects normalized approved_lessons-only authority', async () => {
  const result = await binding({ approvedLessons: { 'facilitator/target.json': true }, active: false })
  assert.equal(result.currentlyBound, true)
  assert.equal(result.sources.approved, true)
})

test('current binding detects association-only authority', async () => {
  const result = await binding({ associations: [{ id: 1, lesson_key: TARGET }], active: false })
  assert.equal(result.currentlyBound, true)
  assert.equal(result.sources.association, true)
})

test('current binding detects active today/future forecast-only authority', async () => {
  const result = await binding({ forecasts: [forecast('target', TARGET, '2026-09-04')] })
  assert.equal(result.currentlyBound, true)
  assert.equal(result.sources.forecast, true)
})

test('current binding detects today/future schedule-only authority', async () => {
  const result = await binding({ schedules: [{ id: 1, lesson_key: TARGET, scheduled_date: '2026-09-05' }], active: false })
  assert.equal(result.currentlyBound, true)
  assert.equal(result.sources.schedule, true)
})

test('past-only forecast and schedule state is not a current binding', async () => {
  const result = await binding({ forecasts: [forecast('past', TARGET, '2026-09-03')], schedules: [{ id: 1, lesson_key: TARGET, scheduled_date: '2026-09-03' }] })
  assert.deepEqual(result, { lessonKey: TARGET, currentlyBound: false, sources: { approved: false, association: false, forecast: false, schedule: false } })
})

test('removal clears every current authority while preserving prior revision, unrelated intent, past schedule, and historical stores', async () => {
  const fx = fixture({
    approvedLessons: { [TARGET]: true, 'facilitator/target.json': true, 'math/keep.json': true },
    associations: [{ id: 10, lesson_key: 'facilitator/target.json' }, { id: 11, lesson_key: 'math/keep.json' }],
    schedules: [{ id: 20, lesson_key: TARGET, scheduled_date: '2026-09-03' }, { id: 21, lesson_key: TARGET, scheduled_date: '2026-09-04' }],
    forecasts: [forecast('past', TARGET, '2026-09-03'), forecast('target', TARGET, '2026-09-04'), forecast('other', 'math/keep.json', '2026-09-11')],
  })
  const beforeRevision = structuredClone(fx.state.revisions[0])
  const beforeItems = structuredClone(fx.state.items)
  const result = await removeLessonFromLearner({ admin: fx.admin, repository: fx.repository, facilitatorId: FACILITATOR, learner: fx.state.learner, lessonKey: TARGET, now: NOW })

  assert.deepEqual(result.approvedLessons, { 'math/keep.json': true })
  assert.equal(result.removedForecastOccurrences, 1)
  assert.equal(result.removedScheduleOccurrences, 1)
  assert.deepEqual(fx.state.associations, [{ id: 11, lesson_key: 'math/keep.json' }])
  assert.deepEqual(fx.state.schedules.map((row) => row.id), [20])
  assert.deepEqual(fx.state.revisions[0], beforeRevision)
  assert.deepEqual(fx.state.items.filter((row) => row.revision_id === 'revision-1'), beforeItems)
  const activeItems = fx.state.items.filter((row) => row.revision_id === fx.state.syllabus.active_revision_id)
  assert.equal(activeItems.some((row) => row.lesson_key === TARGET), false)
  assert.equal(activeItems.some((row) => row.lesson_key === 'math/keep.json'), true)
  assert.deepEqual([...new Set(fx.state.touchedTables)].sort(), ['learners', 'lesson_schedule', 'syllabus_lesson_associations'])
})

test('repeated removal and partial-state retry converge without additional revision or historical mutation', async () => {
  const fx = fixture({ approvedLessons: { [TARGET]: true }, associations: [{ id: 10, lesson_key: TARGET }], forecasts: [forecast('other', 'math/keep.json', '2026-09-05')] })
  const revisionsBefore = fx.state.revisions.length
  await removeLessonFromLearner({ admin: fx.admin, repository: fx.repository, facilitatorId: FACILITATOR, learner: fx.state.learner, lessonKey: TARGET, now: NOW })
  await removeLessonFromLearner({ admin: fx.admin, repository: fx.repository, facilitatorId: FACILITATOR, learner: fx.state.learner, lessonKey: TARGET, now: NOW })
  assert.equal(fx.state.revisions.length, revisionsBefore)
  assert.deepEqual(fx.state.associations, [])
  assert.deepEqual(fx.state.learner.approved_lessons, {})
  assert.equal(fx.state.items.length, 1)
})
