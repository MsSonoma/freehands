import { normalizeLessonKey } from '../lessonKeyNormalization.js'

const clean = (value) => String(value || '').trim()
const sameLesson = (row, removal) => normalizeLessonKey(row?.lesson_key || row?.lesson_id) === normalizeLessonKey(removal?.lesson_key)

function sourceIds(removal) {
  return [removal?.occurrence_id, removal?.source_occurrence_id].map(clean).filter(Boolean)
}

// Planning rows remain auditable in their originating revision, but no longer
// occupy the learner's active Syllabus or get carried into the next forecast.
export function visiblePlanningOccurrences(rows = [], removals = [], kind) {
  const prefix = kind === 'scheduled' ? 'scheduled:' : 'syllabus:'
  return (rows || []).filter((row) => !(removals || []).some((removal) => {
    if (!sameLesson(row, removal)) return false
    const identities = sourceIds(removal)
    if (identities.includes(prefix + clean(row?.id))) return true
    return kind === 'syllabus' && clean(removal?.forecast_lineage_id)
      && clean(row?.lineage_id) === clean(removal.forecast_lineage_id)
  }))
}

// Timeline removal applies to both choices. Mastery evidence stays in storage
// unless the facilitator explicitly requests deletion.
export function removedTimelineSessionIds(removals = []) {
  return new Set((removals || [])
    .flatMap((removal) => Array.isArray(removal.execution_session_ids) ? removal.execution_session_ids : [])
    .map(clean).filter(Boolean))
}

export function removedEvidenceSessionIds(removals = []) {
  return new Set((removals || [])
    .filter((removal) => removal?.evidence_disposition === 'delete')
    .flatMap((removal) => Array.isArray(removal.execution_session_ids) ? removal.execution_session_ids : [])
    .map(clean).filter(Boolean))
}

export function visibleLessonTimeline(items = [], removals = []) {
  return (items || []).filter((item) => !(removals || []).some((removal) => {
    if (!sameLesson(item, removal)) return false
    const identity = clean(item?.occurrence_id || item?.id)
    const target = clean(removal.occurrence_id)
    const source = clean(removal.source_occurrence_id)
    if (identity === target || (source && identity === source)) return true

    // Removing the scheduled occurrence also removes its started attempts from
    // Syllabus display. Removing an individual actual attempt does not hide its
    // siblings, even if both attempts came from the same scheduled source.
    const parentRemoval = !target.startsWith('actual:') && !target.startsWith('historical:')
    if (parentRemoval && clean(item?.source_occurrence_id) === target) return true
    const parent = clean(item?.parent_occurrence_id || item?.syllabus_occurrence_id)
    if (parentRemoval && parent === target) return true
    return false
  }))
}

export function removedLessonBlocksInference(lessonKey, removals = []) {
  return (removals || []).some((removal) => normalizeLessonKey(removal?.lesson_key) === normalizeLessonKey(lessonKey))
}
