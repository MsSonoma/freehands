import assert from 'node:assert/strict'
import test from 'node:test'

import { removeLessonOccurrenceFromSyllabus } from '../lessonOccurrenceRemoval.server.mjs'
import { composeSyllabusLessonTimeline } from '../lessonTimeline.mjs'

const LESSON_KEY = 'generated/reconciliation.json'
const TODAY = '2026-09-04'
const R1 = {
  id: 'revision-1',
  effective_from: '2026-09-01',
  goals: [],
  subjects: ['math'],
  weekly_pattern: {},
  teaching_guidance: {},
  planning_policy: {},
  legacy_provenance: null,
}

const forecast = (id, plannedDate) => ({
  id,
  lesson_key: LESSON_KEY,
  subject: 'math',
  title: `Forecast ${id}`,
  planned_date: plannedDate,
  sort_order: 0,
  item_type: 'lesson',
})

const schedule = (overrides = {}) => ({
  id: 'schedule-1',
  lesson_key: LESSON_KEY,
  subject: 'math',
  title: 'Scheduled lesson',
  scheduled_date: '2026-09-07',
  sort_order: 0,
  ...overrides,
})

function compose({ forecasts, schedules }) {
  return composeSyllabusLessonTimeline({
    activeRevision: R1,
    forecastItems: forecasts,
    schedules,
    today: TODAY,
  })
}

test('explicit forecast linkage reconciles only its exact forecast and preserves its sibling', () => {
  const items = compose({
    forecasts: [forecast('forecast-f', '2026-09-07'), forecast('forecast-g', '2026-09-14')],
    schedules: [schedule({ forecast_item_id: 'forecast-f' })],
  })

  const scheduled = items.find((item) => item.occurrence_id === 'scheduled:schedule-1')
  assert.ok(scheduled)
  assert.equal(scheduled.reconciled_forecast_id, 'forecast-f')
  assert.equal(items.some((item) => item.occurrence_id === 'syllabus:forecast-f'), false)
  assert.ok(items.some((item) => item.occurrence_id === 'syllabus:forecast-g'))
})

test('stale explicit forecast linkage does not steal the sole same-key sibling', () => {
  const items = compose({
    forecasts: [forecast('forecast-g', '2026-09-14')],
    schedules: [schedule({ forecast_item_id: 'missing-forecast-f' })],
  })

  const scheduled = items.find((item) => item.occurrence_id === 'scheduled:schedule-1')
  assert.ok(scheduled)
  assert.equal(scheduled.reconciled_forecast_id, null)
  assert.ok(items.some((item) => item.occurrence_id === 'syllabus:forecast-g'))
})

test('an unlinked schedule retains the unique same-date reconciliation heuristic', () => {
  const items = compose({
    forecasts: [forecast('forecast-f', '2026-09-07')],
    schedules: [schedule()],
  })

  const scheduled = items.find((item) => item.occurrence_id === 'scheduled:schedule-1')
  assert.ok(scheduled)
  assert.equal(scheduled.reconciled_forecast_id, 'forecast-f')
  assert.equal(items.some((item) => item.occurrence_id === 'syllabus:forecast-f'), false)
})

test('exact removal converges after forecast activation succeeds and schedule deletion initially fails', async () => {
  const state = {
    activeRevision: R1,
    forecasts: [forecast('forecast-f', '2026-09-07'), forecast('forecast-g', '2026-09-14')],
    schedules: [schedule({ forecast_item_id: 'forecast-f' })],
    activations: [],
    deleteAttempts: 0,
    observedReconciliations: [],
  }
  const currentTimeline = () => {
    const items = composeSyllabusLessonTimeline({
      activeRevision: state.activeRevision,
      forecastItems: state.forecasts,
      schedules: state.schedules,
      today: TODAY,
    })
    state.observedReconciliations.push(
      items.find((item) => item.occurrence_id === 'scheduled:schedule-1')?.reconciled_forecast_id || null,
    )
    return items
  }
  const dependencies = {
    getActiveSyllabus: async () => ({
      active_revision: state.activeRevision,
      forecast_items: state.forecasts,
      timeline_items: currentTimeline(),
      resolved_today: TODAY,
    }),
    activateSyllabus: async ({ snapshot }) => {
      state.activations.push(snapshot)
      state.forecasts = snapshot.forecast_items
      state.activeRevision = { ...R1, id: 'revision-2', effective_from: snapshot.effective_from }
      return { active_revision: state.activeRevision }
    },
    deleteExactScheduleOccurrence: async ({ scheduleId }) => {
      state.deleteAttempts += 1
      if (state.deleteAttempts === 1) throw new Error('deliberate schedule deletion failure')
      const index = state.schedules.findIndex((row) => row.id === scheduleId)
      assert.notEqual(index, -1)
      state.schedules.splice(index, 1)
      return { id: scheduleId }
    },
    setLessonAssociationInferenceSuppressed: async () => {
      assert.fail('sibling G means this is not the final explicit occurrence')
    },
  }
  const request = {
    admin: {},
    repository: {},
    facilitatorId: 'facilitator-1',
    learnerId: 'learner-1',
    lessonKey: LESSON_KEY,
    occurrenceId: 'scheduled:schedule-1',
    expectedActiveRevisionId: R1.id,
    now: new Date(`${TODAY}T12:00:00Z`),
    dependencies,
  }

  const initial = currentTimeline()
  assert.equal(initial.find((item) => item.occurrence_id === 'scheduled:schedule-1')?.reconciled_forecast_id, 'forecast-f')
  assert.ok(initial.some((item) => item.occurrence_id === 'syllabus:forecast-g'))

  await assert.rejects(removeLessonOccurrenceFromSyllabus(request), /deliberate schedule deletion failure/)
  assert.deepEqual(state.forecasts.map((item) => item.id), ['forecast-g'])
  assert.deepEqual(state.schedules.map((item) => item.id), ['schedule-1'])
  assert.equal(state.activeRevision.id, 'revision-2')

  const afterFailure = currentTimeline()
  assert.equal(afterFailure.find((item) => item.occurrence_id === 'scheduled:schedule-1')?.reconciled_forecast_id, null)
  assert.ok(afterFailure.some((item) => item.occurrence_id === 'syllabus:forecast-g'))

  const retry = await removeLessonOccurrenceFromSyllabus(request)
  assert.equal(retry.removedForecastOccurrence, false)
  assert.equal(retry.removedScheduleOccurrence, true)
  assert.deepEqual(state.schedules, [])
  assert.deepEqual(state.forecasts.map((item) => item.id), ['forecast-g'])
  assert.equal(state.activations.length, 1)
  assert.equal(state.deleteAttempts, 2)
  assert.equal(state.observedReconciliations.includes('forecast-g'), false)
  assert.ok(currentTimeline().some((item) => item.occurrence_id === 'syllabus:forecast-g'))
})

test('stale explicit linkage outranks the unique same-date heuristic', () => {
  const items = compose({
    forecasts: [forecast('forecast-g', '2026-09-07')],
    schedules: [schedule({ forecast_item_id: 'missing-forecast-f' })],
  })

  const scheduled = items.find((item) => item.occurrence_id === 'scheduled:schedule-1')
  assert.ok(scheduled)
  assert.equal(scheduled.reconciled_forecast_id, null)
  assert.ok(items.some((item) => item.occurrence_id === 'syllabus:forecast-g'))
})
