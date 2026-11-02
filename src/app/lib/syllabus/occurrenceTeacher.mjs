import { normalizeInstructionalTeacher } from './instructionalTeacher.mjs'

// Instructional authority belongs to the occurrence, not the lesson association.
// An older Slate assignment must never relabel a started Sonoma attempt.
export function instructionalTeacherForOccurrence(item, lesson = null) {
  const source = item && typeof item === 'object' ? item : {}
  const actual = source.placement_kind === 'actual'
    ? normalizeInstructionalTeacher(source.actual_instructional_teacher)
    : null
  return actual
    || normalizeInstructionalTeacher(source.assigned_instructional_teacher)
    || normalizeInstructionalTeacher(source.instructional_teacher)
    || normalizeInstructionalTeacher(lesson?.instructional_teacher)
    || 'sonoma'
}
