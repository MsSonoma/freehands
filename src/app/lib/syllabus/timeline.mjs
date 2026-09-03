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

export function addSyllabusDays(value, count) {
  const date = dateAtUtcNoon(value)
  if (!date) return null
  return new Date(date.getTime() + (count * DAY_MS)).toISOString().slice(0, 10)
}

function addWeeks(weekStart, count) {
  return addSyllabusDays(weekStart, count * 7)
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

export function moveSyllabusWeek(weekStart, action, today = new Date().toISOString().slice(0, 10)) {
  const current = startOfSyllabusWeek(today)
  if (action === 'now') return current
  if (action === 'earlier') return addSyllabusDays(weekStart || current, -7)
  if (action === 'later') return addSyllabusDays(weekStart || current, 7)
  return weekStart || current
}

export function selectSyllabusWeek(items = [], { weekStart, today = new Date().toISOString().slice(0, 10) } = {}) {
  const selectedStart = startOfSyllabusWeek(weekStart || today)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addSyllabusDays(selectedStart, index)
    return {
      date,
      items: (items || []).filter((item) => dateOnly(item?.planned_date) === date)
        .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0)
          || String(left.occurrence_id || left.id || left.title || '').localeCompare(String(right.occurrence_id || right.id || right.title || ''))),
    }
  })
  return {
    week_start: selectedStart,
    state: classifySyllabusWeek(selectedStart, today),
    days,
    items: days.flatMap((day) => day.items),
  }
}

export function resolveSyllabusReadModel(payload) {
  if (!payload?.has_active_syllabus || !payload?.active_revision) {
    return { kind: 'fallback', source: 'legacy_compatibility', revision: null, forecast_items: [], timeline_items: [] }
  }
  return {
    kind: 'active',
    source: 'canonical_syllabus',
    revision: payload.active_revision,
    forecast_items: Array.isArray(payload.forecast_items) ? payload.forecast_items : [],
    timeline_items: Array.isArray(payload.timeline_items) ? payload.timeline_items : (Array.isArray(payload.forecast_items) ? payload.forecast_items : []),
    proposed_reforecast: payload.proposed_reforecast || null,
    proposed_learning_forecast: payload.proposed_learning_forecast || null,
    resolved_today: dateOnly(payload.resolved_today),
    resolved_timezone: payload.resolved_timezone || 'UTC',
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

export function addWeeklyPatternSlot(pattern, day, subject) {
  if (!DAY_KEYS.includes(day) || !String(subject || '').trim()) return structuredClone(pattern || {})
  const next = structuredClone(pattern || {})
  const entries = Array.isArray(next[day]) ? next[day] : []
  next[day] = [...entries, { subject: String(subject).trim() }]
  return next
}

export function removeWeeklyPatternSlot(pattern, day, index) {
  const next = structuredClone(pattern || {})
  if (!DAY_KEYS.includes(day) || !Array.isArray(next[day])) return next
  next[day] = next[day].filter((_, entryIndex) => entryIndex !== Number(index))
  return next
}

export function weeklyPatternCapacity(pattern, day) {
  return Array.isArray(pattern?.[day]) ? pattern[day].length : 0
}

export function syllabusItemState({ item, today = new Date().toISOString().slice(0, 10), hasProgress = false }) {
  if (item?.actual_kind === 'completed') return 'completed_historical'
  if (item?.actual_kind === 'incomplete') return 'incomplete_historical'
  if (item?.actual_kind === 'in_progress' || (hasProgress && dateOnly(item?.planned_date) === dateOnly(today))) return 'in_progress'
  if (item?.needs_placement) return 'needs_placement'
  const plannedDate = dateOnly(item?.planned_date)
  if (plannedDate === dateOnly(today)) return 'today_unfinished'
  if (plannedDate > dateOnly(today)) return 'future_unfinished'
  return 'incomplete_historical'
}

export function syllabusItemActions({ role, state, hasLessonArtifact = false, readinessState = 'saved', isScheduled = false, isToday = false }) {
  if (role === 'learner') {
    if (state === 'completed_historical') return [{ id: 'review', label: 'View / Review' }, { id: 'repeat', label: 'Do again', requires_pin: true }]
    if (state === 'needs_placement') return [{ id: 'view', label: 'View' }]
    if (!hasLessonArtifact) return [{ id: 'view', label: 'View' }]
    if (state === 'today_unfinished') return [{ id: 'execute', label: 'Start', requires_pin: false }]
    if (state === 'in_progress') return [{ id: 'execute', label: 'Continue', requires_pin: !isToday }]
    return [{ id: 'view', label: 'View' }, { id: 'execute', label: state === 'incomplete_historical' ? 'Retry' : 'Start', requires_pin: true }]
  }
  if (role !== 'facilitator') return []
  if (state === 'completed_historical') return [
    { id: 'view', label: 'View' }, { id: 'history', label: 'Review history' }, { id: 'repeat', label: 'Repeat', requires_pin: true },
  ]
  if (state === 'incomplete_historical' || state === 'in_progress') return [
    { id: 'view', label: 'Open' }, { id: 'history', label: 'Review history' }, { id: 'execute', label: state === 'in_progress' ? 'Continue' : 'Retry' },
  ]
  if (state === 'needs_placement') return [{ id: 'view', label: 'Open' }, { id: 'prepare', label: 'Prepare' }, { id: 'schedule', label: 'Schedule' }]
  const actions = [{ id: 'view', label: 'Open' }, { id: 'edit', label: 'Edit' }, { id: 'prepare', label: 'Prepare' }]
  actions.push({ id: isScheduled ? 'reschedule' : 'schedule', label: isScheduled ? 'Reschedule' : 'Schedule' })
  if (readinessState !== 'available') actions.push({ id: 'make_available', label: 'Make available' })
  return actions
}

export function syllabusItemActionsFor({ item, ...actionContext }) {
  if (item?.historical_activity_only === true) return []
  if (item?.item_type === 'slate_assignment') {
    return actionContext.role === 'learner'
      ? [{ id: 'practice_slate', label: 'Start Mr. Slate' }]
      : (actionContext.role === 'facilitator' ? [{ id: 'remove_slate_schedule', label: 'Remove scheduled session' }] : [])
  }
  if (
    actionContext.role === 'facilitator'
    && (item?.item_type || 'lesson') === 'lesson'
    && ['learning_forecast', 'facilitator'].includes(item?.origin)
    && !item?.lesson_key
  ) return item.origin === 'facilitator'
    ? [{ id: 'edit_concept', label: 'Edit concept' }, { id: 'materialize', label: 'Generate lesson' }]
    : [{ id: 'materialize', label: 'Generate lesson' }]
  const actions = syllabusItemActions(actionContext)
  if ((item?.item_type || 'lesson') !== 'lesson') return actions
  if (actionContext.role === 'learner' && actionContext.hasLessonArtifact) return [...actions, { id: 'practice_slate', label: 'Practice with Mr. Slate' }]
  if (actionContext.role === 'facilitator' && item?.lesson_key && item?.historical_record !== true) {
    return [...actions, { id: 'schedule_slate', label: 'Schedule Mr. Slate' }]
  }
  return actions
}

export function syllabusActionPresentation({ action, href = null, role, capabilities = {} } = {}) {
  if (!action?.id) return 'hidden'
  if (action.id === 'history') return capabilities.reviewHistory === true ? 'button' : 'hidden'
  if (href && !action.requires_pin) return 'link'
  if (role === 'learner') return capabilities.openLesson === true ? 'button' : 'hidden'
  return capabilities.lessonActions === true ? 'button' : 'hidden'
}

export function timelineItemAction({ role, weekState, hasLessonArtifact, hasProgress }) {
  if (role !== 'learner' || weekState !== 'now' || !hasLessonArtifact) return null
  return hasProgress ? 'continue' : 'start'
}
