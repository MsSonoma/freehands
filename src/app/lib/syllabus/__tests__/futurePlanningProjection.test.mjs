import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFuturePlanningProjection,
  groupFuturePlanningItemsByDate,
  provisionalForecastPlanningItems,
} from '../futurePlanningProjection.mjs'

const ACTIVE = '11111111-1111-4111-8111-111111111111'
const FORECAST = '22222222-2222-4222-8222-222222222222'
const DUPLICATE = '33333333-3333-4333-8333-333333333333'

const weeklyPattern = {
  monday: [{ subject: 'Math' }],
  tuesday: [{ subject: 'Science' }],
  wednesday: [{ subject: 'Language Arts' }],
  thursday: [{ subject: 'History' }],
}

function activeItem(overrides = {}) {
  return {
    id: ACTIVE,
    lineage_id: ACTIVE,
    occurrence_id: `intent:${ACTIVE}`,
    planned_date: '2026-09-14',
    subject: 'Math',
    title: 'Fractions Review',
    sort_order: 0,
    item_type: 'lesson',
    lesson_key: null,
    origin: 'facilitator',
    ...overrides,
  }
}

function forecastItem(overrides = {}) {
  return {
    id: FORECAST,
    lineage_id: FORECAST,
    planned_date: '2026-09-15',
    subject: 'Science',
    title: 'Energy Transfer',
    description: 'Trace how energy moves through a simple system.',
    sort_order: 0,
    item_type: 'lesson',
    lesson_key: null,
    origin: 'learning_forecast',
    ...overrides,
  }
}

test('future planning projection combines active intent, provisional forecast, and open weekly-pattern slots without creating another authority', () => {
  const result = buildFuturePlanningProjection({
    weeklyPattern,
    timelineItems: [activeItem()],
    proposedForecastItems: [forecastItem()],
    rangeStart: '2026-09-14',
    rangeEnd: '2026-09-20',
    today: '2026-09-10',
    includeOpenSlots: true,
  })

  assert.deepEqual(result.active_items.map((item) => item.planning_state), ['active'])
  assert.equal(result.forecast_items.length, 1)
  assert.equal(result.forecast_items[0].planning_state, 'forecast')
  assert.equal(result.forecast_items[0].presentation_kind, 'suggested_inactive')
  assert.equal(result.open_slots.length, 2)
  assert.deepEqual(result.open_slots.map((item) => [item.planned_date, item.subject, item.planning_state]), [
    ['2026-09-16', 'Language Arts', 'open'],
    ['2026-09-17', 'History', 'open'],
  ])
})

test('active exact-slot intent outranks an inactive forecast and both active and forecast slots suppress synthetic open slots', () => {
  const duplicateForecast = forecastItem({
    id: DUPLICATE,
    lineage_id: DUPLICATE,
    planned_date: '2026-09-14',
    subject: 'Math',
    title: 'AI duplicate',
  })
  const result = buildFuturePlanningProjection({
    weeklyPattern,
    timelineItems: [activeItem()],
    proposedForecastItems: [duplicateForecast, forecastItem()],
    rangeStart: '2026-09-14',
    rangeEnd: '2026-09-20',
    today: '2026-09-10',
    includeOpenSlots: true,
  })

  assert.equal(result.forecast_items.some((item) => item.lineage_id === DUPLICATE), false)
  assert.equal(result.open_slots.some((item) => item.planned_date === '2026-09-14'), false)
  assert.equal(result.open_slots.some((item) => item.planned_date === '2026-09-15'), false)
})

test('day-off authority suppresses provisional forecast and open slots while preserving already-explicit active intent', () => {
  const result = buildFuturePlanningProjection({
    weeklyPattern,
    timelineItems: [activeItem({ planned_date: '2026-09-16', subject: 'Language Arts', title: 'Already committed' })],
    proposedForecastItems: [forecastItem({ planned_date: '2026-09-16', subject: 'Language Arts' })],
    noSchoolDates: [{ date: '2026-09-16', reason: 'Family day' }],
    rangeStart: '2026-09-14',
    rangeEnd: '2026-09-20',
    today: '2026-09-10',
    includeOpenSlots: true,
  })

  assert.equal(result.active_items.some((item) => item.title === 'Already committed'), true)
  assert.equal(result.forecast_items.some((item) => item.planned_date === '2026-09-16'), false)
  assert.equal(result.open_slots.some((item) => item.planned_date === '2026-09-16'), false)
})

test('farther future weeks expose facilitator planning slots without fabricating an automatic forecast', () => {
  const result = buildFuturePlanningProjection({
    weeklyPattern,
    timelineItems: [],
    proposedForecastItems: [],
    rangeStart: '2026-09-21',
    rangeEnd: '2026-09-27',
    today: '2026-09-10',
    includeOpenSlots: true,
  })

  assert.equal(result.forecast_items.length, 0)
  assert.equal(result.open_slots.length, 4)
  assert.ok(result.open_slots.every((item) => item.planning_state === 'open'))
})

test('calendar grouping preserves forecast identity and deterministic date order', () => {
  const forecast = provisionalForecastPlanningItems([forecastItem()])
  const grouped = groupFuturePlanningItemsByDate([activeItem(), ...forecast])
  assert.deepEqual(Object.keys(grouped), ['2026-09-14', '2026-09-15'])
  assert.equal(grouped['2026-09-15'][0].occurrence_id, `forecast:${FORECAST}`)
})
