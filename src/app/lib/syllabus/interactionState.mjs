import { isUngeneratedSyllabusLesson } from './lessonGenerationState.mjs'
import { syllabusItemState } from './timeline.mjs'
import { normalizeInstructionalTeacher } from './instructionalTeacher.mjs'

export function isCurrentLearnerSnapshot(snapshot, learnerId) {
  return Boolean(learnerId && snapshot?.has_active_syllabus && snapshot?.active_revision?.id)
    && String(snapshot?.syllabus?.learner_id || '') === String(learnerId)
    && Array.isArray(snapshot.timeline_items) && Array.isArray(snapshot.forecast_items)
}

// Resolve the selected item from current canonical data, not a frozen click-time copy.
export function resolveSyllabusSelection(selection, snapshot, proposedItems = []) {
  if (!selection?.item || !Array.isArray(snapshot?.timeline_items)) return selection
  const previous = selection.item
  const occurrence = String(previous.occurrence_id || previous.id || '')
  const historical = previous.historical_record || previous.placement_kind === 'actual'
  const active = snapshot.timeline_items
  let matches = occurrence ? active.filter(item => String(item.occurrence_id || item.id || '') === occurrence) : []
  if (!matches.length && !historical && previous.lineage_id) {
    matches = active.filter(item => item.lineage_id === previous.lineage_id && !item.historical_record && item.placement_kind !== 'actual')
  }
  let suggested = false
  if (!matches.length && !historical && previous.lineage_id) {
    matches = proposedItems.filter(item => item.lineage_id === previous.lineage_id)
    suggested = true
  }
  if (matches.length !== 1) return null
  const item = matches[0]
  if (JSON.stringify(item) === JSON.stringify(previous) && Boolean(selection.suggested) === suggested) return selection
  return {
    ...selection, item, suggested,
    recoveryRequired: item.generation_status === 'recovery_required',
    occurrenceKey: item.occurrence_id || item.id || item.lineage_id,
    syllabus_state: syllabusItemState({ item, today: snapshot.resolved_today, hasProgress: selection.currentLesson?.hasProgress }),
    assignedTeacher: normalizeInstructionalTeacher(item.assigned_instructional_teacher || item.instructional_teacher) || 'sonoma',
    teacherEditable: Boolean(item.lesson_key) && !item.historical_record && item.placement_kind !== 'actual'
      && !active.some(row => row.placement_kind === 'actual' && row.source_occurrence_id === (item.occurrence_id || item.id)),
  }
}

export function lessonMutationBlockReason({ item, suggested, forecastBusy = false, materializingLineage = '', replacingLineage = '', planningBusy = false, hydrated = true } = {}) {
  if (!isUngeneratedSyllabusLesson(item)) return ''
  if (materializingLineage) return materializingLineage === item.lineage_id
    ? 'This lesson is being generated. You can keep reading or close these details.'
    : 'Another lesson is being generated. These details stay available; generation actions will unlock when it finishes.'
  if (planningBusy || replacingLineage || !hydrated) return 'The Syllabus is updating. These details stay available; lesson actions will unlock when it finishes.'
  if (suggested && forecastBusy) return 'These suggestions are refreshing. You can read them now; generation actions will unlock when the refresh finishes.'
  return ''
}
