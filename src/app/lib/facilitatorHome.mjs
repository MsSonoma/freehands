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

export function countEducatorApprovedLessons(lessons = []) {
  if (!Array.isArray(lessons)) return 0
  return lessons.filter((lesson) => lesson?.approved === true).length
}

export function countLearnerActiveLessons(learners = []) {
  if (!Array.isArray(learners)) return 0
  const activeKeys = new Set()
  learners.forEach((learner) => {
    Object.keys(normalizeApprovedLessons(learner?.approved_lessons)).forEach((key) => activeKeys.add(key))
  })
  return activeKeys.size
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

function resolveSnapshotDecision(snapshot, learners, legacyPreparePath) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  if (Number(snapshot.version) !== FACILITATOR_PREPARATION_VERSION) return null
  if (snapshot.stage === FACILITATOR_PREPARATION_STAGES.COMPLETE) return null

  const learnerId = snapshot.learnerId || snapshot.intent?.learnerId || ''
  if (learnerId && Array.isArray(learners) && learners.length && !learners.some((learner) => learner?.id === learnerId)) {
    const approvedArtifact = snapshot.lessonIdentity?.lessonKey
      && [FACILITATOR_PREPARATION_STAGES.APPROVED, FACILITATOR_PREPARATION_STAGES.DELIVERY].includes(snapshot.stage)
    return approvedArtifact ? {
      kind: 'ORPHANED_APPROVED_LESSON',
      label: 'Open lesson library',
      title: 'The lesson remains saved, but its learner is no longer available',
      body: 'Open the Lesson Library and choose an available learner before putting this approved lesson back into a Syllabus.',
      href: '/facilitator/lessons',
    } : {
      kind: 'SELECT_LEARNER',
      label: 'Recover lesson setup',
      title: 'The saved lesson references a learner that is no longer available',
      body: 'Open the compatibility handoff, choose an available learner, and continue in the current Lesson Generator.',
      href: legacyPreparePath,
    }
  }

  if (!isRecoverablePreparationSnapshot(snapshot, learners)) return null

  if ([
    FACILITATOR_PREPARATION_STAGES.NEED,
    FACILITATOR_PREPARATION_STAGES.PROPOSAL,
    FACILITATOR_PREPARATION_STAGES.GENERATING,
  ].includes(snapshot.stage)) {
    return {
      kind: 'CONTINUE_GENERATOR',
      label: 'Continue in Lesson Generator',
      title: 'Continue creating this lesson',
      body: 'A legacy saved lesson setup is waiting. It will reopen in the current Lesson Generator.',
      href: legacyPreparePath,
    }
  }

  if (snapshot.stage === FACILITATOR_PREPARATION_STAGES.DRAFT) {
    return {
      kind: 'REVIEW_DRAFT',
      label: 'Review lesson',
      title: 'A lesson draft is waiting for review',
      body: snapshot.proposal?.generationSpec?.title || snapshot.lessonIdentity?.file || 'Review the saved draft before approving it.',
      href: legacyPreparePath,
    }
  }

  if ([FACILITATOR_PREPARATION_STAGES.APPROVED, FACILITATOR_PREPARATION_STAGES.DELIVERY].includes(snapshot.stage)) {
    const lessonKey = snapshot.lessonIdentity?.lessonKey || ''
    return {
      kind: 'OPEN_APPROVED_LESSON',
      label: 'Open in Syllabus',
      title: 'An approved lesson is ready in the learner plan',
      body: snapshot.proposal?.generationSpec?.title || snapshot.lessonIdentity?.file || 'Use the learner plan to schedule, make available, or start this lesson.',
      href: lessonKey
        ? `${legacyPreparePath}?stage=DELIVERY&source=syllabus&learnerId=${encodeURIComponent(learnerId)}&lessonKey=${encodeURIComponent(lessonKey)}`
        : legacyPreparePath,
    }
  }

  return null
}

export function resolveFacilitatorHomeDecision({
  learners = [],
  scheduledKeys = {},
  preparationSnapshot = null,
  legacyPreparePath = '/facilitator/prepare',
  generatorPath = '/facilitator/generator',
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

  const snapshotDecision = resolveSnapshotDecision(preparationSnapshot, learners, legacyPreparePath)
  if (snapshotDecision) return snapshotDecision

  const hasNextLesson = learners.some((learner) => Object.keys(normalizeApprovedLessons(learner.approved_lessons)).length > 0)
    || Object.keys(scheduledKeys || {}).length > 0
  if (!hasNextLesson) {
    return {
      kind: 'CREATE_NEXT',
      label: 'Create next lesson',
      title: 'No next lesson is ready yet',
      body: 'Open Lesson Generator to describe what the learner needs and approve the generated lesson.',
      href: generatorPath,
    }
  }

  return {
    kind: 'CREATE_ANOTHER',
    label: 'Create another lesson',
    title: 'Nothing urgent needs your decision',
    body: 'You can create another lesson in Lesson Generator whenever you are ready.',
    href: generatorPath,
  }
}
