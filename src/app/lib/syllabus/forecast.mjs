import { createHash } from 'node:crypto'

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function stableUuid(value) {
  const hex = createHash('sha256').update(String(value)).digest('hex').slice(0, 32).split('')
  hex[12] = '4'
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4]
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}

export function normalizeWeeklyPattern(pattern) {
  const source = pattern && typeof pattern === 'object' && !Array.isArray(pattern) ? pattern : {}
  return Object.fromEntries(DAY_KEYS.map((day) => [day, Array.isArray(source[day]) ? source[day] : []]))
}

export function subjectsFromLegacy({ weeklyPattern, plannedLessons }) {
  const names = new Map()
  const add = (value) => {
    const name = String(value || '').trim()
    if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name)
  }
  for (const day of DAY_KEYS) for (const item of weeklyPattern[day] || []) add(typeof item === 'string' ? item : item?.subject)
  for (const row of plannedLessons || []) add(row?.lesson_data?.subject || row?.lesson_data?.category || 'General')
  return [...names.values()].map((name) => ({ name, source: 'legacy_current_use' }))
}

export function legacyForecastItems(plannedLessons, { today }) {
  return (plannedLessons || [])
    .filter((row) => String(row?.scheduled_date || '').slice(0, 10) >= today)
    .map((row, index) => {
      const lesson = row.lesson_data || {}
      const plannedDate = String(row.scheduled_date).slice(0, 10)
      const title = String(lesson.title || lesson.name || lesson.id || 'Planned lesson').trim()
      const subject = String(lesson.subject || lesson.category || 'General').trim()
      const lessonKey = String(lesson.lesson_key || lesson.lessonKey || lesson.file || lesson.id || '').trim() || null
      return {
        lineage_id: stableUuid(`planned_lessons:${row.id || `${plannedDate}:${subject}:${title}:${index}`}`),
        planned_date: plannedDate,
        subject,
        title,
        lesson_key: lessonKey,
        item_type: 'lesson',
        origin: 'legacy_import',
        sort_order: index,
        metadata: { legacy_source: 'planned_lessons', legacy_row_id: row.id || null },
      }
    })
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date) || a.sort_order - b.sort_order)
}
