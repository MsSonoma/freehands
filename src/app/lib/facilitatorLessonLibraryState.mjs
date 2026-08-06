import { normalizeLessonKey } from './lessonKeyNormalization.js'

export const LIBRARY_LESSON_STATES = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  AVAILABLE: 'available',
  SCHEDULED_TODAY: 'scheduled_today',
  SCHEDULED_FUTURE: 'scheduled_future',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DOWNLOADABLE: 'downloadable',
  SELECT_LEARNER: 'select_learner',
  SAVED: 'saved',
})

export const LIBRARY_PRIMARY_ACTIONS = Object.freeze({
  REVIEW: 'review',
  DELIVERY: 'delivery',
  DOWNLOAD: 'download',
  NONE: 'none',
})

const formatScheduledDate = (value, formatter = null) => {
  if (!value) return 'Scheduled'
  if (formatter) return formatter(value)
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return `Scheduled for ${value}`
  return `Scheduled for ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
}

export function resolveInitialLibraryLearner(learners = []) {
  return Array.isArray(learners) && learners.length === 1 ? learners[0] : null
}

export function buildPreparationActionHref({ learnerId, lessonKey, stage }) {
  const canonicalKey = normalizeLessonKey(lessonKey)
  const params = new URLSearchParams()
  if (learnerId) params.set('learnerId', learnerId)
  if (canonicalKey) params.set('lessonKey', canonicalKey)
  if (stage) params.set('stage', stage)
  return `/facilitator/prepare?${params.toString()}`
}

export function resolveLibraryLessonState({
  lesson = {},
  lessonKey,
  learnerId = '',
  isDownloadableNotOwned = false,
  availableLessons = {},
  scheduledToday = {},
  futureScheduledLessons = {},
  inProgressLessons = {},
  completedLessons = {},
  dateFormatter = null,
} = {}) {
  const canonicalKey = normalizeLessonKey(lessonKey || (lesson?.isGenerated && lesson?.file ? `generated/${lesson.file}` : lesson?.lessonKey))
  const legacyGeneralKey = canonicalKey?.replace?.(/^generated\//, 'general/')
  const deliveredNow = Boolean(canonicalKey && (availableLessons?.[canonicalKey] || availableLessons?.[legacyGeneralKey]))
  const scheduledTodayValue = canonicalKey ? scheduledToday?.[canonicalKey] : null
  const futureScheduledValue = canonicalKey ? futureScheduledLessons?.[canonicalKey] : null
  const inProgressValue = canonicalKey ? inProgressLessons?.[canonicalKey] : null
  const completedValue = canonicalKey ? completedLessons?.[canonicalKey] : null
  const isExplicitGeneratedDraft = lesson?.isGenerated === true && lesson?.approved === false
  const isApprovedGenerated = lesson?.isGenerated === true && lesson?.approved === true

  // Precedence: ownership/download state first; learner outcome state beats delivery state;
  // scheduled state beats available; delivery decisions beat generic saved lessons.
  if (isDownloadableNotOwned) {
    return {
      stateKey: LIBRARY_LESSON_STATES.DOWNLOADABLE,
      label: 'Available to download',
      primaryActionType: LIBRARY_PRIMARY_ACTIONS.DOWNLOAD,
      preparationStage: null,
      href: null,
      lessonKey: canonicalKey,
    }
  }

  if (!learnerId) {
    return {
      stateKey: LIBRARY_LESSON_STATES.SELECT_LEARNER,
      label: 'Choose a learner',
      primaryActionType: LIBRARY_PRIMARY_ACTIONS.NONE,
      preparationStage: null,
      href: null,
      lessonKey: canonicalKey,
    }
  }

  if (completedValue) {
    return {
      stateKey: LIBRARY_LESSON_STATES.COMPLETED,
      label: 'Completed',
      primaryActionType: LIBRARY_PRIMARY_ACTIONS.NONE,
      preparationStage: null,
      href: null,
      lessonKey: canonicalKey,
    }
  }

  if (inProgressValue) {
    return {
      stateKey: LIBRARY_LESSON_STATES.IN_PROGRESS,
      label: 'In progress',
      primaryActionType: LIBRARY_PRIMARY_ACTIONS.NONE,
      preparationStage: null,
      href: null,
      lessonKey: canonicalKey,
    }
  }

  if (scheduledTodayValue) {
    return {
      stateKey: LIBRARY_LESSON_STATES.SCHEDULED_TODAY,
      label: 'Scheduled for today',
      primaryActionType: LIBRARY_PRIMARY_ACTIONS.NONE,
      preparationStage: null,
      href: null,
      lessonKey: canonicalKey,
    }
  }

  if (futureScheduledValue) {
    return {
      stateKey: LIBRARY_LESSON_STATES.SCHEDULED_FUTURE,
      label: formatScheduledDate(futureScheduledValue, dateFormatter),
      primaryActionType: LIBRARY_PRIMARY_ACTIONS.NONE,
      preparationStage: null,
      href: null,
      lessonKey: canonicalKey,
    }
  }

  if (deliveredNow) {
    return {
      stateKey: LIBRARY_LESSON_STATES.AVAILABLE,
      label: 'Available now',
      primaryActionType: LIBRARY_PRIMARY_ACTIONS.NONE,
      preparationStage: null,
      href: null,
      lessonKey: canonicalKey,
    }
  }

  if (isExplicitGeneratedDraft) {
    return {
      stateKey: LIBRARY_LESSON_STATES.DRAFT,
      label: 'Draft - needs your review',
      primaryActionType: LIBRARY_PRIMARY_ACTIONS.REVIEW,
      preparationStage: 'DRAFT',
      href: buildPreparationActionHref({ learnerId, lessonKey: canonicalKey, stage: 'DRAFT' }),
      lessonKey: canonicalKey,
    }
  }

  if (isApprovedGenerated) {
    return {
      stateKey: LIBRARY_LESSON_STATES.APPROVED,
      label: 'Approved - choose delivery',
      primaryActionType: LIBRARY_PRIMARY_ACTIONS.DELIVERY,
      preparationStage: 'DELIVERY',
      href: buildPreparationActionHref({ learnerId, lessonKey: canonicalKey, stage: 'DELIVERY' }),
      lessonKey: canonicalKey,
    }
  }

  return {
    stateKey: LIBRARY_LESSON_STATES.SAVED,
    label: lesson?.isGenerated ? 'Saved lesson' : 'Ready in library',
    primaryActionType: LIBRARY_PRIMARY_ACTIONS.NONE,
    preparationStage: null,
    href: null,
    lessonKey: canonicalKey,
  }
}

export function primaryActionCount(state) {
  return state?.primaryActionType && state.primaryActionType !== LIBRARY_PRIMARY_ACTIONS.NONE ? 1 : 0
}