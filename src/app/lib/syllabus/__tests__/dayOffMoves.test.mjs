import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { instructionalOccupiedSlotKeys, isDayOffMovedToDate } from '../dayOffMoves.mjs'
import { findSnapshotCapacityConflict } from '../capacity.mjs'
import { composeSyllabusLessonTimeline } from '../lessonTimeline.mjs'
import { buildInstructionalForecastPlan, instructionalWeekIsFilled } from '../learningForecast.mjs'
import { buildFuturePlanningProjection } from '../futurePlanningProjection.mjs'

const activeRevision = {
  id: 'revision-active',
  weekly_pattern: {
    monday: [{ subject: 'Math' }],
    tuesday: [{ subject: 'Science' }],
  },
}
const makeupMath = {
  id: 'moved-math',
  lineage_id: 'math-lineage',
  planned_date: '2026-09-21',
  sort_order: 10001,
  subject: 'Math',
  title: 'Fractions',
  item_type: 'lesson',
  metadata: { day_off_moves: [{
    source_date: '2026-09-14',
    source_sort_order: 0,
    destination_date: '2026-09-21',
  }] },
}
const science = {
  id: 'science',
  lineage_id: 'science-lineage',
  planned_date: '2026-09-15',
  sort_order: 0,
  subject: 'Science',
  title: 'Energy',
  item_type: 'lesson',
}

test('one-time moved lessons reserve the original forecast slot even across weeks', () => {
  assert.deepEqual(instructionalOccupiedSlotKeys(makeupMath), ['2026-09-21:10001', '2026-09-14:0'])
  assert.equal(instructionalWeekIsFilled({
    activeRevision,
    timelineItems: [makeupMath, science],
    noSchoolDates: [], // Removing the Day Off marker must not create a replacement.
    weekStart: '2026-09-14',
    today: '2026-09-14',
  }), true)

  const forecast = buildInstructionalForecastPlan({
    activeRevision,
    timelineItems: [makeupMath, science],
    noSchoolDates: [],
    targetWeekStart: '2026-09-14',
    today: '2026-09-14',
  })
  assert.deepEqual(forecast.unfilled_slots, [])
})

test('Day Off stacking preserves a separate regular lesson slot on the destination day', () => {
  const projection = buildFuturePlanningProjection({
    weeklyPattern: activeRevision.weekly_pattern,
    timelineItems: [makeupMath, science],
    proposedForecastItems: [],
    noSchoolDates: [],
    rangeStart: '2026-09-14',
    rangeEnd: '2026-09-22',
    today: '2026-09-14',
    includeOpenSlots: true,
  })
  assert.equal(projection.active_items.some((row) => row.id === makeupMath.id && row.planned_date === '2026-09-21'), true)
  assert.equal(projection.open_slots.some((row) => row.planned_date === '2026-09-14'), false)
  assert.equal(projection.open_slots.some((row) => row.planned_date === '2026-09-21'), true, 'the destination retains its own canonical weekly slot')
  assert.equal(projection.open_slots.some((row) => row.planned_date === '2026-09-22'), true)
})

test('authorized Day Off stacking does not cause future capacity conflicts', () => {
  const regular = {
    id: 'regular-math', planned_date: '2026-09-21', sort_order: 0,
    subject: 'Math', title: 'Scheduled normal math', lesson_key: 'math/regular.json',
    item_type: 'lesson', origin: 'facilitator', metadata: {},
  }
  assert.equal(isDayOffMovedToDate(makeupMath, '2026-09-21'), true)
  const movedSchedule = {
    id: 'scheduled-moved', lesson_key: 'math/other.json',
    scheduled_date: '2026-09-21',
    day_off_move_source_date: '2026-09-14',
    day_off_move_destination_date: '2026-09-21',
  }
  assert.equal(isDayOffMovedToDate(movedSchedule, '2026-09-21'), true)
  assert.equal(isDayOffMovedToDate({ ...movedSchedule, scheduled_date: '2026-09-28' }), false)
  const conflict = findSnapshotCapacityConflict({
    weekly_pattern: activeRevision.weekly_pattern,
    forecast_items: [regular, makeupMath],
  }, { schedules: [movedSchedule] })
  assert.equal(conflict, null)

  const timeline = composeSyllabusLessonTimeline({
    activeRevision,
    forecastItems: [regular, makeupMath],
    associations: [],
    schedules: [],
    today: '2026-09-14',
  })
  assert.equal(timeline.some((row) => row.lineage_id === makeupMath.lineage_id && row.capacity_conflict == null), true)
  assert.equal(timeline.some((row) => row.id === 'regular-math'), true)
})

test('moving a scheduled lesson cannot swallow an unrelated same-key destination forecast', () => {
  const key = 'math/repeated.json'
  const forecast = {
    id: 'target-original', lineage_id: 'target-lineage',
    lesson_key: key, item_type: 'lesson', origin: 'facilitator',
    planned_date: '2026-09-21', sort_order: 0, subject: 'Math',
    title: 'Target lesson', metadata: {},
  }
  const movedSchedule = {
    id: 'source-schedule', lesson_key: key, scheduled_date: '2026-09-21',
    day_off_move_source_date: '2026-09-14',
    day_off_move_destination_date: '2026-09-21',
    sort_order: 10003,
  }
  const items = composeSyllabusLessonTimeline({
    activeRevision,
    forecastItems: [forecast],
    schedules: [movedSchedule],
    today: '2026-09-14',
  })
  assert.equal(items.filter((row) => row.lesson_key === key).length, 2)
  assert.equal(items.some((row) => row.occurrence_id === 'scheduled:source-schedule'), true)
  assert.equal(items.some((row) => row.occurrence_id === 'syllabus:target-original'), true)
})

test('multiple successive Day Off moves retain every original forecast slot', () => {
  const twiceMoved = {
    ...makeupMath,
    planned_date: '2026-09-22',
    sort_order: 10005,
    metadata: { day_off_moves: [
      ...makeupMath.metadata.day_off_moves,
      { source_date: '2026-09-21', source_sort_order: 10001, destination_date: '2026-09-22' },
    ] },
  }
  assert.deepEqual(instructionalOccupiedSlotKeys(twiceMoved), ['2026-09-22:10005', '2026-09-14:0', '2026-09-21:10001'])
})

test('the database move is single-transaction, facilitator-scoped, and revision-safe', () => {
  const sql = fs.readFileSync(new URL('../../../../../supabase/migrations/20261017180700_day_off_one_time_makeup.sql', import.meta.url), 'utf8')
  for (const pattern of [
    /create or replace function public\.move_syllabus_day_off\(/i,
    /security invoker/i,
    /for update/i,
    /commit_syllabus_revision_activation/i,
    /insert into public\.syllabus_day_off_moves/i,
    /insert into public\.no_school_dates/i,
    /source_date\s*<>\s*destination_date/i,
    /day_off_moves/i,
  ]) assert.match(sql, pattern)
  assert.match(sql, /revoke all on function public\.move_syllabus_day_off[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.move_syllabus_day_off[\s\S]*to service_role/i)
})
