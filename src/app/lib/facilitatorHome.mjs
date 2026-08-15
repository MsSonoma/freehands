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

export function isRecoverablePreparationSnapshot(snapshot, learners = []) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false
  if (Number(snapshot.version) !== FACILITATOR_PREPARATION_VERSION) return false
  if (snapshot.stage === FACILITATOR_PREPARATION_STAGES.COMPLETE) return false
  if (snapshot.learnerId && Array.isArray(learners) && learners.length) {
    if (!learners.some((learner) => learner?.id === snapshot.learnerId)) return false
  }
  if (snapshot.lessonIdentity?.lessonKey) return true
  if (snapshot.proposal) return true
  if (snapshot.intent?.learnerId && snapshot.intent?.need) return true
  return !!snapshot.learnerId && snapshot.stage !== FACILITATOR_PREPARATION_STAGES.NEED
}

function resolveSnapshotDecision(snapshot, learners, preparePath) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  if (Number(snapshot.version) !== FACILITATOR_PREPARATION_VERSION) return null
  if (snapshot.stage === FACILITATOR_PREPARATION_STAGES.COMPLETE) return null

  const learnerId = snapshot.learnerId || snapshot.intent?.learnerId || ''
  if (learnerId && Array.isArray(learners) && learners.length && !learners.some((learner) => learner?.id === learnerId)) {
    return {
      kind: 'SELECT_LEARNER',
      label: 'Choose learner',
      title: 'Choose a learner to continue',
      body: 'The saved preparation references a learner that is no longer available. Choose a learner before continuing.',
      href: preparePath,
    }
  }

  if (!isRecoverablePreparationSnapshot(snapshot, learners)) return null

  if ([
    FACILITATOR_PREPARATION_STAGES.NEED,
    FACILITATOR_PREPARATION_STAGES.PROPOSAL,
    FACILITATOR_PREPARATION_STAGES.GENERATING,
  ].includes(snapshot.stage)) {
    return {
      kind: 'CONTINUE_PREPARING',
      label: 'Continue preparing',
      title: 'Continue preparing this guided learning session',
      body: 'A saved preparation is waiting right where you left it.',
      href: preparePath,
    }
  }

  if (snapshot.stage === FACILITATOR_PREPARATION_STAGES.DRAFT) {
    return {
      kind: 'REVIEW_DRAFT',
      label: 'Review lesson',
      title: 'A lesson draft is waiting for review',
      body: snapshot.proposal?.generationSpec?.title || snapshot.lessonIdentity?.file || 'Review the saved draft before approving it.',
      href: preparePath,
    }
  }

  if (snapshot.stage === FACILITATOR_PREPARATION_STAGES.DELIVERY) {
    const lessonKey = snapshot.lessonIdentity?.lessonKey || ''
    return {
      kind: 'CHOOSE_DELIVERY',
      label: 'Choose session option',
      title: 'An approved lesson is waiting',
      body: snapshot.proposal?.generationSpec?.title || snapshot.lessonIdentity?.file || 'Choose when the learner receives this approved lesson.',
      href: lessonKey
        ? `${preparePath}?stage=DELIVERY&learnerId=${encodeURIComponent(learnerId)}&lessonKey=${encodeURIComponent(lessonKey)}`
        : preparePath,
    }
  }

  return null
}

export function resolveFacilitatorHomeDecision({
  learners = [],
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

  const snapshotDecision = resolveSnapshotDecision(preparationSnapshot, learners, preparePath)
  if (snapshotDecision) return snapshotDecision

  const availableKeys = new Set()
  learners.forEach((learner) => {
    Object.keys(normalizeApprovedLessons(learner.approved_lessons)).forEach((key) => availableKeys.add(key))
  })
  Object.keys(scheduledKeys || {}).forEach((key) => availableKeys.add(key))

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
