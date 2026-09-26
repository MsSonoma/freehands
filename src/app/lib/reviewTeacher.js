export const REVIEW_TEACHER_IDS = Object.freeze(['sonoma', 'webb', 'slate'])

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
})

export function isReviewTeacher(value) {
  return REVIEW_TEACHER_IDS.includes(String(value || '').trim().toLowerCase())
}

export function normalizeReviewTeacher(value, fallback = 'slate') {
  const teacher = String(value || '').trim().toLowerCase()
  if (isReviewTeacher(teacher)) return teacher
  return isReviewTeacher(fallback) ? String(fallback).trim().toLowerCase() : 'slate'
}

export function reviewTeacherConfig(value) {
  return REVIEW_TEACHERS[normalizeReviewTeacher(value)]
}

export function reviewTeacherLabel(value) {
  return reviewTeacherConfig(value).label
}

export function reviewTeacherIcon(value) {
  return reviewTeacherConfig(value).icon
}
