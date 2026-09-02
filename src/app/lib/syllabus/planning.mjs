import { addSyllabusDays, startOfSyllabusWeek } from './timeline.mjs'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function dateOnly(value) { return String(value || '').slice(0, 10) }
export function syllabusSlotKey(item) { return `${dateOnly(item?.planned_date)}:${Number(item?.sort_order) || 0}` }

function slotsForWeek(weeklyPattern, weekStart) {
  const slots = []
  for (let offset = 0; offset < 7; offset++) {
    const plannedDate = addSyllabusDays(weekStart, offset)
    const day = DAYS[new Date(`${plannedDate}T12:00:00.000Z`).getUTCDay()]
    const entries = Array.isArray(weeklyPattern?.[day]) ? weeklyPattern[day] : []
    entries.forEach((entry, sortOrder) => {
      const subject = String(typeof entry === 'string' ? entry : entry?.subject || '').trim()
      if (subject) slots.push({ planned_date: plannedDate, subject, sort_order: sortOrder })
    })
  }
  return slots
}

export function buildPlanAhead({ weeklyPattern, forecastItems = [], today, weeks = 1 }) {
  const horizon = Math.max(1, Math.min(4, Number(weeks) || 1))
  const firstWeek = addSyllabusDays(startOfSyllabusWeek(today), 7)
  const bySlot = new Map(forecastItems.map((item) => [syllabusSlotKey(item), item]))
  return Array.from({ length: horizon }, (_, index) => {
    const weekStart = addSyllabusDays(firstWeek, index * 7)
    return {
      week_start: weekStart,
      slots: slotsForWeek(weeklyPattern, weekStart).map((slot) => ({
        ...slot,
        slot_key: syllabusSlotKey(slot),
        item: bySlot.get(syllabusSlotKey(slot)) || null,
      })),
    }
  })
}

export function canonicalSlotFor({ weeklyPattern, plannedDate, sortOrder }) {
  const date = dateOnly(plannedDate)
  const weekStart = startOfSyllabusWeek(date)
  return slotsForWeek(weeklyPattern, weekStart)
    .find((slot) => slot.planned_date === date && slot.sort_order === Number(sortOrder)) || null
}
