export const DEFAULT_INSTRUCTIONAL_TEACHER = 'sonoma'
export const INSTRUCTIONAL_TEACHERS = Object.freeze(['sonoma', 'webb'])

const ALLOWED = new Set(INSTRUCTIONAL_TEACHERS)

export function normalizeInstructionalTeacher(value, { allowOmitted = false } = {}) {
  if (allowOmitted && value === undefined) return undefined
  const teacher = String(value || '').trim().toLowerCase()
  return ALLOWED.has(teacher) ? teacher : null
}

export function instructionalTeacherLabel(value) {
  return normalizeInstructionalTeacher(value) === 'webb' ? 'Mrs. Webb' : 'Ms. Sonoma'
}

export function syllabusTeacherLabel(item = {}) {
  if (item?.placement_kind === 'actual') {
    const actual = normalizeInstructionalTeacher(item.actual_instructional_teacher)
    return actual ? `Taught by ${instructionalTeacherLabel(actual)}` : 'Taught by unknown'
  }
  const assigned = normalizeInstructionalTeacher(item?.assigned_instructional_teacher || item?.instructional_teacher)
    || DEFAULT_INSTRUCTIONAL_TEACHER
  return `Assigned teacher: ${instructionalTeacherLabel(assigned)}`
}

export function buildInstructionalSessionRoute({
  learnerId,
  subject,
  fileName,
  instructionalTeacher = DEFAULT_INSTRUCTIONAL_TEACHER,
  goldenKey = false,
  occurrenceId = '',
}) {
  const teacher = normalizeInstructionalTeacher(instructionalTeacher)
  if (!teacher) throw new Error('A valid instructional teacher assignment is required.')
  const params = new URLSearchParams({ subject, lesson: fileName })
  if (learnerId && learnerId !== 'demo') params.set('learnerId', learnerId)
  if (occurrenceId) params.set('occurrenceId', occurrenceId)
  if (teacher === 'webb') return `/session/webb?${params.toString()}`
  if (goldenKey) params.set('goldenKey', 'true')
  return `/session?${params.toString()}`
}
