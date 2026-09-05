import assert from 'node:assert/strict'
import test from 'node:test'

import { removeLessonOccurrenceFromSyllabus } from '../lessonOccurrenceRemoval.server.mjs'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LESSON_KEY = 'generated/exact-removal.json'
const OTHER_KEY = 'generated/unrelated.json'
const TODAY = '2026-09-04'
const REVISION_ID = 'revision-1'
const NEW_REVISION_ID = 'revision-2'
const ADMIN = { kind: 'fake-admin' }
const REPOSITORY = { kind: 'fake-repository' }

function forecast(id, {
  lessonKey = LESSON_KEY,
  lineageId = `lineage-${id}`,
  plannedDate = TODAY,
  subject = 'math',
  title = `Lesson ${id}`,
  sortOrder = 0,
} = {}) {
  return {
    id,
    lineage_id: lineageId,
    lesson_key: lessonKey,
    planned_date: plannedDate,
    subject,
    title,
    sort_order: sortOrder,
    item_type: 'lesson',
  }
}

function timelineItem({
  occurrenceId,
  id,
  lessonKey = LESSON_KEY,
  placementKind = 'syllabus',
  itemType = 'lesson',
  ...extra
}) {
  return {
    occurrence_id: occurrenceId,
    id,
    lesson_key: lessonKey,
    item_type: itemType,
    placement_kind: placementKind,
    ...extra,
  }
}

function syllabusTarget(id = 'forecast-f', extra = {}) {
  return timelineItem({ occurrenceId: `syllabus:${id}`, id, ...extra })
}

function scheduledTarget(id = 'schedule-f', extra = {}) {
  return timelineItem({ occurrenceId: `scheduled:${id}`, id, placementKind: 'scheduled', ...extra })
}

function activeRevision() {
  return {
    id: REVISION_ID,
    goals: ['Keep learning'],
    subjects: ['math'],
    weekly_pattern: { friday: [{ subject: 'math' }] },
    teaching_guidance: { tone: 'clear' },
    planning_policy: { horizon_days: 14 },
    legacy_provenance: null,
  }
}

function harness({
  timelineItems = [],
  forecastItems = [],
  revision = activeRevision(),
  resolvedToday = TODAY,
  suppressionError = null,
  activationError = null,
  deleteError = null,
} = {}) {
  const operations = []
  const suppressionCalls = []
  const activationCalls = []
  const deleteCalls = []
  const syllabus = {
    active_revision: revision,
    forecast_items: forecastItems,
    timeline_items: timelineItems,
    resolved_today: resolvedToday,
  }

  const dependencies = {
    async getActiveSyllabus() {
      return syllabus
    },
    async setLessonAssociationInferenceSuppressed(args) {
      operations.push('suppress')
      suppressionCalls.push(args)
      assert.equal(args.suppressed, true, 'removal must never request suppressed:false')
      if (suppressionError) throw suppressionError
    },
    async activateSyllabus(args) {
      operations.push('activate')
      activationCalls.push(structuredClone(args))
      if (activationError) throw activationError
      return { active_revision: { id: NEW_REVISION_ID } }
    },
    async deleteExactScheduleOccurrence(args) {
      operations.push('delete')
      deleteCalls.push(args)
      if (deleteError) throw deleteError
      return { id: args.scheduleId }
    },
  }

  return { syllabus, dependencies, operations, suppressionCalls, activationCalls, deleteCalls }
}

function remove(h, overrides = {}) {
  return removeLessonOccurrenceFromSyllabus({
    admin: ADMIN,
    repository: REPOSITORY,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    lessonKey: LESSON_KEY,
    occurrenceId: 'syllabus:forecast-f',
    expectedActiveRevisionId: REVISION_ID,
    now: new Date('2026-09-04T12:00:00.000Z'),
    fallbackTimeZone: 'America/New_York',
    dependencies: h.dependencies,
    ...overrides,
  })
}

async function rejectsWithoutMutation(h, overrides, code) {
  await assert.rejects(remove(h, overrides), (error) => {
    assert.equal(error.code, code)
    return true
  })
  assert.deepEqual(h.operations, [])
  assert.deepEqual(h.suppressionCalls, [])
  assert.deepEqual(h.activationCalls, [])
  assert.deepEqual(h.deleteCalls, [])
}

function assertSuppressionCall(call) {
  assert.deepEqual(call, {
    admin: ADMIN,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    lessonKey: LESSON_KEY,
    suppressed: true,
    verifyLearner: false,
  })
}

function assertResult(actual, expected) {
  assert.deepEqual(actual, expected)
}

test('blank occurrence identity is rejected without mutation', async () => {
  const h = harness()
  await rejectsWithoutMutation(h, { occurrenceId: '   ' }, 'INVALID_SYLLABUS_OCCURRENCE')
})

test('malformed lesson key is rejected without mutation', async () => {
  const h = harness()
  await rejectsWithoutMutation(h, { lessonKey: 'not-a-path' }, 'INVALID_SYLLABUS_OCCURRENCE')
})

test('wrong lesson key cannot authorize a matching occurrence ID', async () => {
  const h = harness({ timelineItems: [syllabusTarget()] })
  await rejectsWithoutMutation(h, { lessonKey: OTHER_KEY }, 'LESSON_NOT_IN_ACTIVE_SYLLABUS')
})

test('missing exact occurrence is rejected without mutation', async () => {
  const h = harness({ timelineItems: [syllabusTarget('forecast-g')] })
  await rejectsWithoutMutation(h, {}, 'LESSON_NOT_IN_ACTIVE_SYLLABUS')
})

test('duplicate exact current occurrence is ambiguous without mutation', async () => {
  const target = syllabusTarget()
  const h = harness({ timelineItems: [target, { ...target }] })
  await rejectsWithoutMutation(h, {}, 'AMBIGUOUS_SYLLABUS_OCCURRENCE')
})

test('actual occurrence itself is rejected without mutation', async () => {
  const target = syllabusTarget('forecast-f', { placementKind: 'actual' })
  const h = harness({ timelineItems: [target] })
  await rejectsWithoutMutation(h, {}, 'SYLLABUS_OCCURRENCE_NOT_REMOVABLE')
})

test('historical occurrence itself is rejected without mutation', async () => {
  const target = syllabusTarget('forecast-f', { placementKind: 'historical', historical_record: true })
  const h = harness({ timelineItems: [target] })
  await rejectsWithoutMutation(h, {}, 'SYLLABUS_OCCURRENCE_NOT_REMOVABLE')
})

test('Slate assignment is rejected without mutation', async () => {
  const target = syllabusTarget('forecast-f', { placementKind: 'slate_assignment', itemType: 'slate_assignment' })
  const h = harness({ timelineItems: [target] })
  await rejectsWithoutMutation(h, {}, 'SYLLABUS_OCCURRENCE_NOT_REMOVABLE')
})

test('matching actual source occurrence means the requested occurrence already started', async () => {
  const target = syllabusTarget()
  const actual = timelineItem({
    occurrenceId: 'actual:session-1',
    id: 'session-1',
    placementKind: 'actual',
    source_occurrence_id: target.occurrence_id,
  })
  const h = harness({ timelineItems: [target, actual] })
  await rejectsWithoutMutation(h, {}, 'SYLLABUS_OCCURRENCE_ALREADY_STARTED')
})

for (const placementKind of ['inferred', 'needs_placement']) {
  test(`${placementKind} suppresses inference and returns occurrence-level server truth`, async () => {
    const occurrenceId = `${placementKind}:candidate-1`
    const target = timelineItem({ occurrenceId, id: 'candidate-1', placementKind })
    const h = harness({ timelineItems: [target] })
    const result = await remove(h, { occurrenceId, expectedActiveRevisionId: null })

    assert.deepEqual(h.operations, ['suppress'])
    assert.equal(h.suppressionCalls.length, 1)
    assertSuppressionCall(h.suppressionCalls[0])
    assert.deepEqual(h.activationCalls, [])
    assert.deepEqual(h.deleteCalls, [])
    assertResult(result, {
      lessonKey: LESSON_KEY,
      occurrenceId,
      placementKind,
      removedForecastOccurrence: false,
      removedScheduleOccurrence: false,
      inferenceSuppressed: true,
      activeRevisionId: REVISION_ID,
    })
  })
}

test('exact syllabus row F is removed while same-key G and unrelated H survive', async () => {
  const rows = [forecast('forecast-f'), forecast('forecast-g'), forecast('forecast-h', { lessonKey: OTHER_KEY })]
  const h = harness({ timelineItems: [syllabusTarget(), syllabusTarget('forecast-g')], forecastItems: rows })
  const result = await remove(h)

  assert.deepEqual(h.operations, ['activate'])
  assert.deepEqual(h.activationCalls[0].snapshot.forecast_items.map((row) => row.id), ['forecast-g', 'forecast-h'])
  assertResult(result, {
    lessonKey: LESSON_KEY,
    occurrenceId: 'syllabus:forecast-f',
    placementKind: 'syllabus',
    removedForecastOccurrence: true,
    removedScheduleOccurrence: false,
    inferenceSuppressed: false,
    activeRevisionId: NEW_REVISION_ID,
  })
})

test('same-key explicit syllabus sibling prevents suppression', async () => {
  const h = harness({
    timelineItems: [syllabusTarget(), scheduledTarget('schedule-g')],
    forecastItems: [forecast('forecast-f')],
  })
  await remove(h)
  assert.deepEqual(h.operations, ['activate'])
  assert.deepEqual(h.suppressionCalls, [])
})

test('final explicit syllabus occurrence suppresses before activation', async () => {
  const h = harness({ timelineItems: [syllabusTarget()], forecastItems: [forecast('forecast-f')] })
  await remove(h)
  assert.deepEqual(h.operations, ['suppress', 'activate'])
  assertSuppressionCall(h.suppressionCalls[0])
})

test('stale expected revision rejects syllabus removal before mutation', async () => {
  const h = harness({ timelineItems: [syllabusTarget()], forecastItems: [forecast('forecast-f')] })
  await rejectsWithoutMutation(h, { expectedActiveRevisionId: 'stale-revision' }, 'ACTIVATION_CONFLICT')
})

test('missing expected revision rejects syllabus removal before suppression', async () => {
  const h = harness({ timelineItems: [syllabusTarget()], forecastItems: [forecast('forecast-f')] })
  await rejectsWithoutMutation(h, { expectedActiveRevisionId: null }, 'ACTIVATION_CONFLICT')
})

test('missing exact forecast row rejects before suppression', async () => {
  const h = harness({ timelineItems: [syllabusTarget()], forecastItems: [forecast('forecast-g')] })
  await rejectsWithoutMutation(h, {}, 'FORECAST_OCCURRENCE_NOT_FOUND')
})

test('usable visible row ID cannot fall back to another row matching only lineage', async () => {
  const occurrenceId = 'syllabus:lineage-X'
  const target = timelineItem({ occurrenceId, id: 'visible-row-id' })
  const h = harness({
    timelineItems: [target],
    forecastItems: [forecast('different-row', { lineageId: 'lineage-X' })],
  })
  await rejectsWithoutMutation(h, { occurrenceId }, 'FORECAST_OCCURRENCE_NOT_FOUND')
})

test('genuine id-less lineage-derived visible target resolves one unique lineage row', async () => {
  const occurrenceId = 'syllabus:lineage-X'
  const target = timelineItem({ occurrenceId, id: undefined, lineage_id: 'lineage-X' })
  const h = harness({
    timelineItems: [target, syllabusTarget('forecast-g')],
    forecastItems: [forecast('forecast-f', { lineageId: 'lineage-X' }), forecast('forecast-g')],
  })
  const result = await remove(h, { occurrenceId })
  assert.deepEqual(h.activationCalls[0].snapshot.forecast_items.map((row) => row.id), ['forecast-g'])
  assert.equal(result.removedForecastOccurrence, true)
})

test('duplicate syllabus lineage matches fail closed before suppression', async () => {
  const occurrenceId = 'syllabus:lineage-X'
  const target = timelineItem({ occurrenceId, id: undefined, lineage_id: 'lineage-X' })
  const h = harness({
    timelineItems: [target],
    forecastItems: [forecast('forecast-f', { lineageId: 'lineage-X' }), forecast('forecast-g', { lineageId: 'lineage-X' })],
  })
  await rejectsWithoutMutation(h, { occurrenceId }, 'AMBIGUOUS_SYLLABUS_OCCURRENCE')
})

test('activation failure after final syllabus suppression propagates and never deletes schedule', async () => {
  const h = harness({
    timelineItems: [syllabusTarget()],
    forecastItems: [forecast('forecast-f')],
    activationError: new Error('activation exploded'),
  })
  await assert.rejects(remove(h), (error) => {
    assert.equal(error.code, 'LESSON_OCCURRENCE_REMOVAL_FAILED')
    assert.match(error.message, /activation exploded/)
    return true
  })
  assert.deepEqual(h.operations, ['suppress', 'activate'])
  assert.deepEqual(h.deleteCalls, [])
})

test('unreconciled scheduled occurrence deletes only the exact schedule ID', async () => {
  const target = scheduledTarget('schedule-f')
  const h = harness({ timelineItems: [target, scheduledTarget('schedule-g')] })
  const result = await remove(h, { occurrenceId: target.occurrence_id, expectedActiveRevisionId: null })

  assert.deepEqual(h.operations, ['delete'])
  assert.deepEqual(h.deleteCalls, [{ admin: ADMIN, learnerId: LEARNER, lessonKey: LESSON_KEY, scheduleId: 'schedule-f' }])
  assertResult(result, {
    lessonKey: LESSON_KEY,
    occurrenceId: 'scheduled:schedule-f',
    placementKind: 'scheduled',
    removedForecastOccurrence: false,
    removedScheduleOccurrence: true,
    inferenceSuppressed: false,
    activeRevisionId: REVISION_ID,
  })
})

test('same-key explicit schedule sibling prevents suppression', async () => {
  const target = scheduledTarget('schedule-f')
  const h = harness({ timelineItems: [target, syllabusTarget('forecast-g')] })
  await remove(h, { occurrenceId: target.occurrence_id })
  assert.deepEqual(h.operations, ['delete'])
  assert.deepEqual(h.suppressionCalls, [])
})

test('final unreconciled schedule occurrence suppresses before exact delete', async () => {
  const target = scheduledTarget('schedule-f')
  const h = harness({ timelineItems: [target] })
  await remove(h, { occurrenceId: target.occurrence_id })
  assert.deepEqual(h.operations, ['suppress', 'delete'])
  assertSuppressionCall(h.suppressionCalls[0])
})

test('malformed scheduled identity fails before mutation', async () => {
  const occurrenceId = 'schedule-f'
  const target = timelineItem({ occurrenceId, id: 'schedule-f', placementKind: 'scheduled' })
  const h = harness({ timelineItems: [target] })
  await rejectsWithoutMutation(h, { occurrenceId }, 'INVALID_SYLLABUS_OCCURRENCE')
})

test('scheduled target ID mismatch fails before mutation', async () => {
  const target = scheduledTarget('schedule-f', { id: 'different-schedule' })
  const h = harness({ timelineItems: [target] })
  await rejectsWithoutMutation(h, { occurrenceId: target.occurrence_id }, 'SCHEDULE_OCCURRENCE_NOT_FOUND')
})

test('unreconciled schedule removal requires no expected active revision', async () => {
  const target = scheduledTarget('schedule-f')
  const h = harness({ timelineItems: [target, scheduledTarget('schedule-g')] })
  await remove(h, { occurrenceId: target.occurrence_id, expectedActiveRevisionId: null })
  assert.deepEqual(h.operations, ['delete'])
})

test('stale expected revision is ignored for genuine schedule-only removal', async () => {
  const target = scheduledTarget('schedule-f')
  const h = harness({ timelineItems: [target, scheduledTarget('schedule-g')] })
  await remove(h, { occurrenceId: target.occurrence_id, expectedActiveRevisionId: 'stale-revision' })
  assert.deepEqual(h.operations, ['delete'])
})

test('final schedule suppression failure prevents delete', async () => {
  const target = scheduledTarget('schedule-f')
  const h = harness({ timelineItems: [target], suppressionError: new Error('suppression exploded') })
  await assert.rejects(remove(h, { occurrenceId: target.occurrence_id }), (error) => {
    assert.equal(error.code, 'LESSON_OCCURRENCE_REMOVAL_FAILED')
    assert.match(error.message, /suppression exploded/)
    return true
  })
  assert.deepEqual(h.operations, ['suppress'])
  assert.deepEqual(h.deleteCalls, [])
})

test('reconciled schedule requires an expected active revision', async () => {
  const target = scheduledTarget('schedule-f', { reconciled_forecast_id: 'forecast-f' })
  const h = harness({ timelineItems: [target], forecastItems: [forecast('forecast-f')] })
  await rejectsWithoutMutation(h, { occurrenceId: target.occurrence_id, expectedActiveRevisionId: null }, 'ACTIVATION_CONFLICT')
})

test('stale expected revision rejects reconciled schedule before suppression', async () => {
  const target = scheduledTarget('schedule-f', { reconciled_forecast_id: 'forecast-f' })
  const h = harness({ timelineItems: [target], forecastItems: [forecast('forecast-f')] })
  await rejectsWithoutMutation(h, { occurrenceId: target.occurrence_id, expectedActiveRevisionId: 'stale' }, 'ACTIVATION_CONFLICT')
})

test('exact reconciled forecast F is removed while same-key sibling G survives', async () => {
  const target = scheduledTarget('schedule-f', { reconciled_forecast_id: 'forecast-f' })
  const sibling = scheduledTarget('schedule-g')
  const h = harness({
    timelineItems: [target, sibling],
    forecastItems: [forecast('forecast-f'), forecast('forecast-g')],
  })
  const result = await remove(h, { occurrenceId: target.occurrence_id })

  assert.deepEqual(h.activationCalls[0].snapshot.forecast_items.map((row) => row.id), ['forecast-g'])
  assertResult(result, {
    lessonKey: LESSON_KEY,
    occurrenceId: 'scheduled:schedule-f',
    placementKind: 'scheduled',
    removedForecastOccurrence: true,
    removedScheduleOccurrence: true,
    inferenceSuppressed: false,
    activeRevisionId: NEW_REVISION_ID,
  })
})

test('non-final reconciled schedule activates before delete without suppression', async () => {
  const target = scheduledTarget('schedule-f', { reconciled_forecast_id: 'forecast-f' })
  const h = harness({
    timelineItems: [target, syllabusTarget('forecast-g')],
    forecastItems: [forecast('forecast-f'), forecast('forecast-g')],
  })
  await remove(h, { occurrenceId: target.occurrence_id })
  assert.deepEqual(h.operations, ['activate', 'delete'])
  assert.deepEqual(h.suppressionCalls, [])
})

test('final reconciled schedule suppresses, activates, then deletes', async () => {
  const target = scheduledTarget('schedule-f', { reconciled_forecast_id: 'forecast-f' })
  const h = harness({ timelineItems: [target], forecastItems: [forecast('forecast-f')] })
  await remove(h, { occurrenceId: target.occurrence_id })
  assert.deepEqual(h.operations, ['suppress', 'activate', 'delete'])
  assertSuppressionCall(h.suppressionCalls[0])
})

test('ambiguous reconciled lineage fails before suppression', async () => {
  const target = scheduledTarget('schedule-f', { reconciled_forecast_id: 'lineage-X' })
  const h = harness({
    timelineItems: [target],
    forecastItems: [forecast('forecast-f', { lineageId: 'lineage-X' }), forecast('forecast-g', { lineageId: 'lineage-X' })],
  })
  await rejectsWithoutMutation(h, { occurrenceId: target.occurrence_id }, 'AMBIGUOUS_SYLLABUS_OCCURRENCE')
})

test('reconciled activation failure prevents schedule delete', async () => {
  const target = scheduledTarget('schedule-f', { reconciled_forecast_id: 'forecast-f' })
  const h = harness({
    timelineItems: [target, scheduledTarget('schedule-g')],
    forecastItems: [forecast('forecast-f')],
    activationError: new Error('activation exploded'),
  })
  await assert.rejects(remove(h, { occurrenceId: target.occurrence_id }), (error) => {
    assert.equal(error.code, 'LESSON_OCCURRENCE_REMOVAL_FAILED')
    return true
  })
  assert.deepEqual(h.operations, ['activate'])
  assert.deepEqual(h.deleteCalls, [])
})

test('final reconciled suppression failure prevents activation and delete', async () => {
  const target = scheduledTarget('schedule-f', { reconciled_forecast_id: 'forecast-f' })
  const h = harness({
    timelineItems: [target],
    forecastItems: [forecast('forecast-f')],
    suppressionError: new Error('suppression exploded'),
  })
  await assert.rejects(remove(h, { occurrenceId: target.occurrence_id }), (error) => {
    assert.equal(error.code, 'LESSON_OCCURRENCE_REMOVAL_FAILED')
    return true
  })
  assert.deepEqual(h.operations, ['suppress'])
  assert.deepEqual(h.activationCalls, [])
  assert.deepEqual(h.deleteCalls, [])
})

test('reconciled delete failure propagates after exactly one successful activation', async () => {
  const target = scheduledTarget('schedule-f', { reconciled_forecast_id: 'forecast-f' })
  const h = harness({
    timelineItems: [target, scheduledTarget('schedule-g')],
    forecastItems: [forecast('forecast-f')],
    deleteError: new Error('delete exploded'),
  })
  await assert.rejects(remove(h, { occurrenceId: target.occurrence_id }), (error) => {
    assert.equal(error.code, 'LESSON_OCCURRENCE_REMOVAL_FAILED')
    assert.match(error.message, /delete exploded/)
    return true
  })
  assert.deepEqual(h.operations, ['activate', 'delete'])
  assert.equal(h.activationCalls.length, 1)
  assert.equal(h.deleteCalls.length, 1)
})
