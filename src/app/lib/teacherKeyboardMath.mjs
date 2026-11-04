import { initialSlateManualScratch, restoreSlateManualScratch } from './slateManualScratch.mjs'

/**
 * Scratch work is learner-owned, lesson-owned, and occurrence-owned. Do not
 * recycle arithmetic entries between two syllabus repeats of the same lesson.
 */
export function teacherKeyboardMathKey({ teacher, learnerId, lessonKey, occurrenceId = '', phase = 'teaching' } = {}) {
  const role = String(teacher || '').trim().toLowerCase()
  const learner = String(learnerId || '').trim()
  const lesson = String(lessonKey || '').trim()
  if (!['sonoma', 'webb'].includes(role) || !learner || !lesson) return null
  const parts = [role, learner, lesson, String(occurrenceId || 'unassigned'), phase === 'test' ? 'test' : 'teaching']
  return 'keyboard-math-workspace:v1:' + parts.map(encodeURIComponent).join(':')
}

export function teacherKeyboardMathActivityId(storageKey) {
  return 'keyboard-math:' + String(storageKey || '').slice(0, 145)
}

export function restoreTeacherKeyboardMath(raw, storageKey, phase = 'teaching') {
  if (!storageKey) return initialSlateManualScratch()
  return restoreSlateManualScratch(
    raw,
    teacherKeyboardMathActivityId(storageKey),
    phase === 'test' ? 'test' : 'teaching',
  )
}
