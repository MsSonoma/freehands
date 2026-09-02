export const DEMO_LEARNER = Object.freeze({
  id: 'demo',
  name: 'Demo Learner',
  grade: 4,
})

export const SONOMA_TEACHER_ID = 'sonoma'

export function isDemoLearnerId(learnerId) {
  return learnerId === DEMO_LEARNER.id
}

export function initializeDemoLearner(storage) {
  storage?.setItem?.('learner_id', DEMO_LEARNER.id)
  storage?.setItem?.('learner_name', DEMO_LEARNER.name)
  storage?.setItem?.('learner_grade', String(DEMO_LEARNER.grade))
  storage?.removeItem?.('selected_teacher')
  return { ...DEMO_LEARNER }
}

export function canUseAnonymousTeacher(learnerId, teacherId) {
  return isDemoLearnerId(learnerId) && teacherId === SONOMA_TEACHER_ID
}

export function requiresDemoAuthGate(learnerId, teacherId) {
  return isDemoLearnerId(learnerId) && !canUseAnonymousTeacher(learnerId, teacherId)
}

export function shouldAutoShowLearnerTutorial({ learnerResolved, learnerId, tutorialSeen }) {
  return Boolean(learnerResolved && learnerId && !isDemoLearnerId(learnerId) && !tutorialSeen)
}

export function shouldAutoShowSessionTutorial({ learnerId, tutorialSeen }) {
  return !isDemoLearnerId(learnerId) && !tutorialSeen
}

export function getLessonListRequest(learnerId) {
  if (isDemoLearnerId(learnerId)) {
    return { url: '/api/lessons/demo', subject: 'demo' }
  }
  return {
    url: `/api/learner/available-lessons?learner_id=${encodeURIComponent(learnerId || '')}`,
    subject: null,
  }
}

export function shouldUseAccountPersistence(learnerId) {
  return Boolean(learnerId && !isDemoLearnerId(learnerId))
}
