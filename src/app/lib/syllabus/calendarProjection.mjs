import { syllabusItemState } from './timeline.mjs'
import { normalizeInstructionalTeacher } from './instructionalTeacher.mjs'
import { buildFuturePlanningProjection } from './futurePlanningProjection.mjs'

function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function occurrenceKey(item) {
  return String(item?.occurrence_id || item?.id || `${item?.lineage_id || 'item'}-${dateOnly(item?.planned_date)}`).trim()
}

export function groupSyllabusCalendarItems(items = [], { proposedForecastItems = [], noSchoolDates = [] } = {}) {
  const projected = buildFuturePlanningProjection({
    timelineItems: items,
    proposedForecastItems,
    noSchoolDates,
    includeOpenSlots: false,
  }).items
  const grouped = {}
  for (const item of projected) {
    const date = dateOnly(item?.planned_date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(item)
  }
  for (const date of Object.keys(grouped)) {
    grouped[date].sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0)
      || String(left?.title || '').localeCompare(String(right?.title || ''))
      || occurrenceKey(left).localeCompare(occurrenceKey(right)))
  }
  return grouped
}

export function syllabusCalendarItemCompleted(item) {
  return item?.actual_kind === 'completed'
    || item?.readiness_state === 'completed'
    || item?.historical_record === true
}

export function syllabusCalendarSelection(item, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!item) return null
  const hasProgress = item?.actual_kind === 'in_progress'
  const key = occurrenceKey(item)
  const assignedTeacher = normalizeInstructionalTeacher(
    item?.assigned_instructional_teacher || item?.instructional_teacher,
  ) || 'sonoma'
  const historicalActivityAllowed = item?.historical_record !== true
    && (item?.placement_kind !== 'actual' || Boolean(item?.source_occurrence_id))
  const teacherEditable = Boolean(
    item?.lesson_key
    && item?.placement_kind !== 'actual'
    && item?.historical_record !== true
    && item?.actual_kind !== 'in_progress',
  )
  const suggested = item?.planning_state === 'forecast' || item?.presentation_kind === 'suggested_inactive'
  return {
    item,
    suggested,
    recoveryRequired: item?.recovery_required === true,
    syllabus_state: syllabusItemState({ item, today, hasProgress }),
    currentLesson: { hasProgress, hasLessonArtifact: item?.has_lesson_artifact !== false },
    teacherEditable,
    historicalActivityAllowed,
    occurrenceKey: key,
    assignedTeacher,
  }
}