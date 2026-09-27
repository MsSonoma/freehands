export const REVIEW_TEACHER_IDS = Object.freeze(['sonoma', 'webb', 'slate'])
export const REVIEW_TEACHER_SELECTION_IDS = Object.freeze([...REVIEW_TEACHER_IDS, 'learner'])

export const REVIEW_TEACHERS = Object.freeze({
  sonoma: Object.freeze({
    id: 'sonoma',
    label: 'Ms. Sonoma',
    displayName: 'MS. SONOMA',
    icon: '👩🏻‍🦰',
    video: '/media/ms-sonoma-3.mp4',
    tts: '/api/tts',
  }),
  webb: Object.freeze({
    id: 'webb',
    label: 'Mrs. Webb',
    displayName: 'MRS. WEBB',
    icon: '👩🏻‍🏫',
    video: '/media/webb-teacher.mp4',
    tts: '/api/webb-tts',
  }),
  slate: Object.freeze({
    id: 'slate',
    label: 'Mr. Slate',
    displayName: 'MR. SLATE',
    icon: '🤖',
    video: '/media/Mr.%20Slate%20Suit.mp4',
    tts: '/api/slate-tts',
  }),
  learner: Object.freeze({
    id: 'learner',
    label: 'Learner chooses',
    displayName: 'LEARNER CHOOSES',
    icon: '🎓',
  }),
})

export function isReviewTeacher(value) {
  return REVIEW_TEACHER_IDS.includes(String(value || '').trim().toLowerCase())
}

export function isReviewTeacherSelection(value) {
  return REVIEW_TEACHER_SELECTION_IDS.includes(String(value || '').trim().toLowerCase())
}

export function normalizeReviewTeacher(value, fallback = 'slate') {
  const teacher = String(value || '').trim().toLowerCase()
  if (isReviewTeacher(teacher)) return teacher
  return isReviewTeacher(fallback) ? String(fallback).trim().toLowerCase() : 'slate'
}

export function normalizeReviewTeacherSelection(value, fallback = 'slate') {
  const teacher = String(value || '').trim().toLowerCase()
  if (isReviewTeacherSelection(teacher)) return teacher
  return isReviewTeacherSelection(fallback) ? String(fallback).trim().toLowerCase() : 'slate'
}

export function reviewTeacherConfig(value) {
  return REVIEW_TEACHERS[normalizeReviewTeacher(value)]
}

export function reviewTeacherSelectionConfig(value) {
  return REVIEW_TEACHERS[normalizeReviewTeacherSelection(value)]
}

export function reviewTeacherLabel(value) {
  return reviewTeacherConfig(value).label
}

export function reviewTeacherIcon(value) {
  return reviewTeacherConfig(value).icon
}

export function reviewTeacherSelectionLabel(value) {
  return reviewTeacherSelectionConfig(value).label
}

export function reviewTeacherSelectionIcon(value) {
  return reviewTeacherSelectionConfig(value).icon
}
