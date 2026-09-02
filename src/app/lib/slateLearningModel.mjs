import {
  MASTERY_CHECK_ROLES,
  MASTERY_OUTCOMES,
  INDEPENDENCE_REASONS,
  classifyMasteryOutcome,
  qualifyMasteryOpportunity,
} from './masteryEvidence/mastery.js'
import {
  ASSESSMENT_ISOLATION_STATUSES,
  ASSESSMENT_ROLES,
  getReservedAssessmentItems,
} from './masteryEvidence/assessmentIsolation.js'

export const SLATE_PROTOCOL_VERSION = 'slate-mastery-retention-v1'

export const SLATE_RUN_PURPOSES = Object.freeze({
  PRACTICE: 'practice',
  MASTERY: 'independent_mastery',
  RECOVERY: 'recovery',
  DAILY: 'daily_followup',
  WEEKLY: 'weekly_review',
  RETENTION: 'retention',
})

const PRACTICE_FIELDS = ['sample', 'truefalse', 'multiplechoice', 'fillintheblank', 'shortanswer']

function normalizeItem(item, fallbackType, sourceRole, index) {
  if (!item?.question) return null
  let type = String(item.type || fallbackType || 'shortanswer').toLowerCase()
  if (type === 'truefalse' && typeof item.answer !== 'boolean') type = 'shortanswer'
  if (type === 'multiplechoice' && !item.choices?.length) type = 'shortanswer'
  return {
    ...item,
    id: item.id || `${sourceRole}-${index + 1}`,
    conceptId: item.conceptId || item.concept_id || null,
    type,
    sourceRole,
    assessmentRole: sourceRole === 'test'
      ? ASSESSMENT_ROLES.ASSESSMENT_RESERVED
      : ASSESSMENT_ROLES.INSTRUCTIONAL,
  }
}

export function buildSlatePool(lessonData, runPurpose = SLATE_RUN_PURPOSES.PRACTICE) {
  if (runPurpose === SLATE_RUN_PURPOSES.MASTERY || runPurpose === SLATE_RUN_PURPOSES.RECOVERY) {
    return getReservedAssessmentItems(lessonData)
      .map((item, index) => normalizeItem(
        item,
        item?.choices?.length ? 'multiplechoice' : (typeof item?.answer === 'boolean' ? 'truefalse' : 'shortanswer'),
        'test',
        index,
      ))
      .filter(Boolean)
  }
  return PRACTICE_FIELDS.flatMap((field) => {
    const fallbackType = field === 'sample' ? 'shortanswer' : field
    return (Array.isArray(lessonData?.[field]) ? lessonData[field] : [])
      .map((item, index) => normalizeItem(item, fallbackType, field, index))
      .filter(Boolean)
  })
}

export function slateRunPurpose(value) {
  return Object.values(SLATE_RUN_PURPOSES).includes(value) ? value : SLATE_RUN_PURPOSES.PRACTICE
}

export function createSlateRunState(runPurpose = SLATE_RUN_PURPOSES.PRACTICE) {
  return {
    runPurpose: slateRunPurpose(runPurpose),
    recoveryNeeded: false,
    recoveryStarted: false,
    recoveryCompleted: false,
    failedIdentityKeys: [],
    usedIdentityKeys: [],
  }
}

export function classifySlateMasteryResponse({
  runState,
  itemIdentity,
  itemExposureId,
  isCorrect,
  priorExposedKeys = [],
  preAssessmentExposed = false,
  assessmentIsolationStatus = ASSESSMENT_ISOLATION_STATUSES.UNAVAILABLE,
  assistanceEventsBeforeResponse = [],
} = {}) {
  const purpose = slateRunPurpose(runState?.runPurpose)
  if (purpose !== SLATE_RUN_PURPOSES.MASTERY && purpose !== SLATE_RUN_PURPOSES.RECOVERY) {
    return { qualifying: false, masteryOutcome: null, qualification: null, checkRole: null }
  }
  if (runState?.recoveryNeeded && !runState?.recoveryCompleted) {
    return {
      qualifying: false,
      qualification: {
        eligible: false,
        independenceStatus: 'unavailable',
        independenceReason: INDEPENDENCE_REASONS.RECOVERY_NOT_COMPLETED,
      },
      checkRole: MASTERY_CHECK_ROLES.RECOVERY_VERIFICATION,
      masteryOutcome: MASTERY_OUTCOMES.UNAVAILABLE,
      recoveryNeeded: true,
    }
  }
  const checkRole = runState?.recoveryNeeded && runState?.recoveryCompleted
    ? MASTERY_CHECK_ROLES.RECOVERY_VERIFICATION
    : MASTERY_CHECK_ROLES.INITIAL
  const qualification = qualifyMasteryOpportunity({
    itemIdentity,
    assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
    assessmentIsolationStatus,
    itemExposureId,
    isFirstResponse: true,
    preAssessmentExposed,
    priorExposedKeys,
    assistanceEventsBeforeResponse,
  })
  const masteryOutcome = classifyMasteryOutcome({ qualification, isCorrect, checkRole })
  return {
    qualifying: qualification.eligible === true,
    qualification,
    checkRole,
    masteryOutcome,
    recoveryNeeded: masteryOutcome === MASTERY_OUTCOMES.NEEDS_RECOVERY,
  }
}

export function pointGoalMessage({ evidenceStatus, masteryOutcome } = {}) {
  if (evidenceStatus !== 'complete') return 'Drill complete. Your learning record may be incomplete.'
  if (masteryOutcome === MASTERY_OUTCOMES.INDEPENDENT_SUCCESS) return 'Drill complete. You got that one on your own.'
  if (masteryOutcome === MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY) return 'Drill complete. You got it this time.'
  return 'Drill complete.'
}

const DRILL_COMPLETION_AUDIO = Object.freeze([
  'Drill sequence complete. Excellent work.',
  'Target score reached. Drill complete.',
  'You have completed the drill sequence.',
  'Practice goal complete. Well done.',
])

const MASTERY_COMPLETION_AUDIO = Object.freeze([
  'Drill complete. You got that one on your own.',
  'Drill complete. Independent success confirmed.',
])

const RECOVERY_COMPLETION_AUDIO = Object.freeze([
  'Drill complete. You got it this time.',
  'Drill complete. Your fresh answer was correct.',
])

export function slateCompletionAudioOptions({ evidenceStatus, masteryOutcome } = {}) {
  if (evidenceStatus !== 'complete') return [...DRILL_COMPLETION_AUDIO]
  if (masteryOutcome === MASTERY_OUTCOMES.INDEPENDENT_SUCCESS) return [...MASTERY_COMPLETION_AUDIO]
  if (masteryOutcome === MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY) return [...RECOVERY_COMPLETION_AUDIO]
  return [...DRILL_COMPLETION_AUDIO]
}

export function markSlateRecoveryStarted(runState, recorded) {
  if (!runState?.recoveryNeeded || recorded !== true) return runState
  return { ...runState, recoveryStarted: true, recoveryCompleted: false }
}

export function markSlateRecoveryCompleted(runState, recorded) {
  if (!runState?.recoveryNeeded || !runState?.recoveryStarted || recorded !== true) return runState
  return { ...runState, recoveryCompleted: true }
}

export function canonicalSlateMastery(events = []) {
  const byLesson = {}
  for (const event of events || []) {
    if (!String(event?.session_id || '').startsWith('slate:')) continue
    if (![MASTERY_OUTCOMES.INDEPENDENT_SUCCESS, MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY].includes(event?.mastery_outcome)) continue
    if (event?.evidence_status && event.evidence_status !== 'complete') continue
    const key = event.lesson_key
    if (!key) continue
    const occurredAt = event.occurred_at || null
    if (!byLesson[key] || String(occurredAt || '') > String(byLesson[key].masteredAt || '')) {
      byLesson[key] = { mastered: true, masteredAt: occurredAt, source: 'canonical_evidence' }
    }
  }
  return byLesson
}
