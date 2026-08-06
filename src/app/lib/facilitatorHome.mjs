import { FACILITATOR_PREPARATION_VERSION, FACILITATOR_PREPARATION_STAGES } from './facilitatorPreparation.mjs'

export function normalizeApprovedLessons(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value && key) out[key] = true
  }
  return out
}

export function lessonKeyForGenerated(lesson) {
  return lesson?.file ? `generated/${lesson.file}` : null
}

export function isRecoverablePreparationSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false
  if (Number(snapshot.version) !== FACILITATOR_PREPARATION_VERSION) return false
  if (snapshot.stage === FACILITATOR_PREPARATION_STAGES.COMPLETE) return false
  if (snapshot.lessonIdentity?.lessonKey) return true
  if (snapshot.proposal) return true
  if (snapshot.intent?.learnerId && snapshot.intent?.need) return true
  return !!snapshot.learnerId && snapshot.stage !== FACILITATOR_PREPARATION_STAGES.NEED
}

export function resolveFacilitatorHomeDecision({
  learners = [],
  generatedLessons = [],
  scheduledKeys = {},
  preparationSnapshot = null,
  preparePath = '/facilitator/prepare',
} = {}) {
  if (!learners.length) {
    return {
      kind: 'NO_LEARNER',
      label: 'Add learner',
      title: 'Add your first learner',
      body: 'Start with the learner name and grade. Settings can wait.',
      href: '/facilitator/learners/add',
    }
  }

  if (isRecoverablePreparationSnapshot(preparationSnapshot)) {
    return {
      kind: 'CONTINUE_PREPARING',
      label: 'Continue preparing',
      title: 'Continue preparing this guided learning session',
      body: 'A saved preparation is waiting right where you left it.',
      href: preparePath,
    }
  }

  const draft = generatedLessons.find((lesson) => lesson && lesson.approved !== true)
  if (draft) {
    const lessonKey = lessonKeyForGenerated(draft)
    return {
      kind: 'REVIEW_DRAFT',
      label: 'Review lesson',
      title: 'A lesson draft is waiting for review',
      body: draft.title || draft.file,
      href: lessonKey ? `/facilitator/lessons/edit?key=${encodeURIComponent(lessonKey)}` : '/facilitator/lessons',
    }
  }

  const availableKeys = new Set()
  learners.forEach((learner) => {
    Object.keys(normalizeApprovedLessons(learner.approved_lessons)).forEach((key) => availableKeys.add(key))
  })
  Object.keys(scheduledKeys || {}).forEach((key) => availableKeys.add(key))

  const approvedAwaitingDelivery = generatedLessons.find((lesson) => {
    if (lesson?.approved !== true) return false
    const lessonKey = lessonKeyForGenerated(lesson)
    return lessonKey && !availableKeys.has(lessonKey)
  })
  if (approvedAwaitingDelivery) {
    const lessonKey = lessonKeyForGenerated(approvedAwaitingDelivery)
    const learnerId = learners[0]?.id || ''
    return {
      kind: 'CHOOSE_DELIVERY',
      label: 'Choose delivery',
      title: 'An approved lesson needs a delivery choice',
      body: approvedAwaitingDelivery.title || approvedAwaitingDelivery.file,
      href: `${preparePath}?stage=DELIVERY&learnerId=${encodeURIComponent(learnerId)}&lessonKey=${encodeURIComponent(lessonKey)}`,
    }
  }

  const hasNextLesson = learners.some((learner) => Object.keys(normalizeApprovedLessons(learner.approved_lessons)).length > 0)
    || Object.keys(scheduledKeys || {}).length > 0
  if (!hasNextLesson) {
    return {
      kind: 'PREPARE_NEXT',
      label: 'Prepare next lesson',
      title: 'No next lesson is ready yet',
      body: 'Describe what the learner needs and review Ms. Sonoma\'s proposed approach.',
      href: preparePath,
    }
  }

  return {
    kind: 'PREPARE_AHEAD',
    label: 'Prepare ahead',
    title: 'Nothing urgent needs your decision',
    body: 'You can prepare another guided learning session whenever you are ready.',
    href: preparePath,
  }
}