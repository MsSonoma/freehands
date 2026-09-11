import { addSyllabusDays, dateOnly } from './timeline.mjs'
import { canonicalSlotsForDate, syllabusSlotKey } from './planning.mjs'
import { noSchoolDateSet } from './noSchoolDates.mjs'

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly(value))
}

function inRange(date, start, end) {
  return validDate(date) && (!start || date >= start) && (!end || date <= end)
}

function planningItemKey(item) {
  return String(item?.occurrence_id || item?.lineage_id || item?.id || `${dateOnly(item?.planned_date)}:${Number(item?.sort_order || 0)}:${item?.subject || ''}`)
}

function comparePlanningItems(left, right) {
  return dateOnly(left?.planned_date).localeCompare(dateOnly(right?.planned_date))
    || Number(left?.sort_order || 0) - Number(right?.sort_order || 0)
    || ({ active: 0, forecast: 1, open: 2 }[left?.planning_state] ?? 9) - ({ active: 0, forecast: 1, open: 2 }[right?.planning_state] ?? 9)
    || planningItemKey(left).localeCompare(planningItemKey(right))
}

export function provisionalForecastPlanningItems(items = [], { rangeStart = '', rangeEnd = '', noSchoolDates = [] } = {}) {
  const blocked = noSchoolDateSet(noSchoolDates)
  return (items || [])
    .filter((item) => item?.origin === 'learning_forecast'
      && !item?.lesson_key
      && inRange(dateOnly(item?.planned_date), rangeStart, rangeEnd)
      && !blocked.has(dateOnly(item?.planned_date)))
    .map((item) => ({
      ...item,
      occurrence_id: `forecast:${item.lineage_id || item.id || `${dateOnly(item.planned_date)}:${Number(item.sort_order || 0)}`}`,
      placement_kind: 'forecast',
      planning_state: 'forecast',
      presentation_kind: 'suggested_inactive',
      is_provisional: true,
    }))
    .sort(comparePlanningItems)
}

export function buildFuturePlanningProjection({
  weeklyPattern = {},
  timelineItems = [],
  proposedForecastItems = [],
  noSchoolDates = [],
  rangeStart = '',
  rangeEnd = '',
  today = '',
  includeOpenSlots = false,
} = {}) {
  const start = dateOnly(rangeStart)
  const end = dateOnly(rangeEnd)
  const resolvedToday = dateOnly(today)
  const blocked = noSchoolDateSet(noSchoolDates)
  const activeItems = (timelineItems || [])
    .filter((item) => inRange(dateOnly(item?.planned_date), start, end))
    .map((item) => ({ ...item, planning_state: item?.planning_state || 'active' }))
  const occupiedSlots = new Set(activeItems
    .filter((item) => item?.item_type !== 'slate_assignment' && validDate(item?.planned_date))
    .map(syllabusSlotKey))
  const forecastItems = provisionalForecastPlanningItems(proposedForecastItems, { rangeStart: start, rangeEnd: end, noSchoolDates })
    .filter((item) => !occupiedSlots.has(syllabusSlotKey(item)))
  const reservedSlots = new Set([...occupiedSlots, ...forecastItems.map(syllabusSlotKey)])
  const openSlots = []

  if (includeOpenSlots && validDate(start) && validDate(end) && start <= end) {
    for (let date = start; date && date <= end; date = addSyllabusDays(date, 1)) {
      if ((resolvedToday && date < resolvedToday) || blocked.has(date)) continue
      for (const slot of canonicalSlotsForDate(weeklyPattern, date)) {
        const slotKey = syllabusSlotKey(slot)
        if (reservedSlots.has(slotKey)) continue
        openSlots.push({
          ...slot,
          slot_key: slotKey,
          id: `open:${slotKey}`,
          occurrence_id: `open:${slotKey}`,
          item_type: 'planning_slot',
          lesson_key: null,
          planning_state: 'open',
          presentation_kind: 'open_slot',
          is_provisional: true,
        })
      }
    }
  }

  const items = [...activeItems, ...forecastItems, ...openSlots].sort(comparePlanningItems)
  return { items, active_items: activeItems.sort(comparePlanningItems), forecast_items: forecastItems, open_slots: openSlots.sort(comparePlanningItems) }
}

export function groupFuturePlanningItemsByDate(items = []) {
  const grouped = {}
  for (const item of items || []) {
    const date = dateOnly(item?.planned_date)
    if (!validDate(date)) continue
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(item)
  }
  for (const date of Object.keys(grouped)) grouped[date].sort(comparePlanningItems)
  return grouped
}
