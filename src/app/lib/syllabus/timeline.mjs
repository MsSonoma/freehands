import { featuresForTier, resolveEffectiveTier } from '../entitlements.js'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_KEYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])

export function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function dateAtUtcNoon(value) {
  const parsed = new Date(`${dateOnly(value)}T12:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function startOfSyllabusWeek(value) {
  const date = dateAtUtcNoon(value)
  if (!date) return null
  const mondayOffset = (date.getUTCDay() + 6) % 7
  return new Date(date.getTime() - (mondayOffset * DAY_MS)).toISOString().slice(0, 10)
}

function addWeeks(weekStart, count) {
  const date = dateAtUtcNoon(weekStart)
  return new Date(date.getTime() + (count * 7 * DAY_MS)).toISOString().slice(0, 10)
}

export function classifySyllabusWeek(weekStart, today) {
  const currentWeek = startOfSyllabusWeek(today)
  if (weekStart < currentWeek) return 'past'
  if (weekStart > currentWeek) return 'future'
  return 'now'
}

export function buildSyllabusTimeline(forecastItems = [], { today = new Date().toISOString().slice(0, 10) } = {}) {
  const currentWeek = startOfSyllabusWeek(today)
  const items = (forecastItems || [])
    .filter((item) => startOfSyllabusWeek(item?.planned_date))
    .map((item) => ({ ...item, planned_date: dateOnly(item.planned_date) }))
    .sort((left, right) => left.planned_date.localeCompare(right.planned_date)
      || Number(left.sort_order || 0) - Number(right.sort_order || 0)
      || String(left.title || '').localeCompare(String(right.title || '')))
  const itemWeeks = items.map((item) => startOfSyllabusWeek(item.planned_date))
  const firstWeek = [currentWeek, ...itemWeeks].sort()[0]
  const lastWeek = [currentWeek, ...itemWeeks].sort().at(-1)
  const weekCount = Math.round((dateAtUtcNoon(lastWeek) - dateAtUtcNoon(firstWeek)) / (7 * DAY_MS)) + 1
  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const weekStart = addWeeks(firstWeek, index)
    return {
      week_start: weekStart,
      state: classifySyllabusWeek(weekStart, today),
      items: items.filter((item) => startOfSyllabusWeek(item.planned_date) === weekStart),
    }
  })
  return { weeks, now_index: weeks.findIndex((week) => week.state === 'now') }
}

export function moveSyllabusTimeline({ index, nowIndex, weekCount }, action) {
  if (action === 'now') return nowIndex
  if (action === 'earlier') return Math.max(0, index - 1)
  if (action === 'later') return Math.min(weekCount - 1, index + 1)
  return index
}

export function resolveSyllabusReadModel(payload) {
  if (!payload?.has_active_syllabus || !payload?.active_revision) {
    return { kind: 'fallback', source: 'legacy_compatibility', revision: null, forecast_items: [] }
  }
  return {
    kind: 'active',
    source: 'canonical_syllabus',
    revision: payload.active_revision,
    forecast_items: Array.isArray(payload.forecast_items) ? payload.forecast_items : [],
    proposed_reforecast: payload.proposed_reforecast || null,
  }
}

export function syllabusEntitlementsFor({ role, subscriptionTier = null, planTier = null }) {
  const effectiveTier = resolveEffectiveTier(subscriptionTier, planTier)
  return {
    effective_tier: effectiveTier,
    can_establish_syllabus: role === 'facilitator',
    can_change_intent: role === 'facilitator' && featuresForTier(effectiveTier).lessonPlanner === true,
    can_launch_current_lessons: role === 'learner',
    future_visible: true,
  }
}

function annotationKey(item) {
  return item?.id || item?.lineage_id || `${dateOnly(item?.planned_date)}:${item?.subject}:${item?.title}`
}

export function matchMasteryAnnotations(forecastItems = [], proposalItems = []) {
  const assignments = new Map()
  const available = (forecastItems || []).map((item, index) => ({ item, index })).sort((left, right) => (
    dateOnly(left.item?.planned_date).localeCompare(dateOnly(right.item?.planned_date))
    || Number(left.item?.sort_order || 0) - Number(right.item?.sort_order || 0)
    || String(left.item?.lineage_id || left.item?.id || left.index).localeCompare(String(right.item?.lineage_id || right.item?.id || right.index))
  ))
  for (const note of (proposalItems || []).filter((item) => item?.origin === 'mastery_reforecast')) {
    const metadata = note?.metadata?.mastery_reforecast || {}
    const plannedDate = dateOnly(note?.planned_date)
    const exactLineage = String(metadata.anchor_lineage_id || '').trim()
    const lessonKey = String(note?.lesson_key || metadata.lesson_key || '').trim()
    const unique = (predicate) => {
      const matches = available.filter(({ item }) => predicate(item))
      return matches.length === 1 ? matches[0] : null
    }
    const matched = (exactLineage && unique((item) => String(item?.lineage_id || '') === exactLineage))
      || (lessonKey && plannedDate && unique((item) => String(item?.lesson_key || '') === lessonKey && dateOnly(item?.planned_date) === plannedDate))
      || (lessonKey && unique((item) => String(item?.lesson_key || '') === lessonKey))
    if (!matched) continue
    const key = annotationKey(matched.item)
    if (!assignments.has(key)) assignments.set(key, [])
    assignments.get(key).push(note)
  }
  const assignedNotes = new Set([...assignments.values()].flat())
  const unmatched = (proposalItems || []).filter((item) => item?.origin === 'mastery_reforecast' && !assignedNotes.has(item))
  return { assignments, unmatched }
}

export function weeklyPatternRows(pattern) {
  return DAY_KEYS.flatMap((day) => {
    const entries = Array.isArray(pattern?.[day]) ? pattern[day] : []
    const subjects = entries.map((entry) => String(typeof entry === 'string' ? entry : entry?.subject || '').trim()).filter(Boolean)
    return subjects.length ? [{ day, subjects }] : []
  })
}

export function timelineItemAction({ role, weekState, hasLessonArtifact, hasProgress }) {
  if (role !== 'learner' || weekState !== 'now' || !hasLessonArtifact) return null
  return hasProgress ? 'continue' : 'start'
}
