import { buildItemIdentity, hashCanonicalValue } from './identity.js';
import {
  ASSESSMENT_ISOLATION_STATUSES,
  ASSESSMENT_ROLES,
  buildInstructionalLessonView,
  getReservedAssessmentItems,
} from './assessmentIsolation.js';
import { getBaselineItems } from './baseline.js';
import { STAGE_2_EVIDENCE_EVENT_TYPES } from './constants.js';

export const INDEPENDENT_MASTERY_PROTOCOL_VERSION = 'independent-mastery-v1';

export const MASTERY_CHECK_ROLES = Object.freeze({
  INITIAL: 'initial',
  RECOVERY_VERIFICATION: 'recovery_verification',
});

export const INDEPENDENCE_STATUSES = Object.freeze({
  INDEPENDENT: 'independent',
  RETRY_NO_HINT: 'retry_no_hint',
  HINT: 'hint',
  RETEACH_OR_SCAFFOLD: 'reteach_or_scaffold',
  ANSWER_REVEALED: 'answer_revealed',
  UNAVAILABLE: 'unavailable',
});

export const INDEPENDENCE_REASONS = Object.freeze({
  ELIGIBLE: 'eligible',
  NOT_RESERVED: 'not_reserved_assessment_item',
  ISOLATION_NOT_TRUSTWORTHY: 'assessment_isolation_not_trustworthy',
  BASELINE_OVERLAP: 'baseline_overlap',
  INSTRUCTIONAL_EXPOSURE: 'instructional_exposure',
  PRIOR_EXPOSURE: 'prior_exposure',
  CURRENT_PRE_EXPOSURE: 'current_session_pre_exposure',
  MISSING_EXPOSURE_ID: 'missing_exposure_id',
  NOT_FIRST_RESPONSE: 'not_first_response',
  HINT_BEFORE_RESPONSE: 'hint_before_first_response',
  ANSWER_REVEAL_BEFORE_RESPONSE: 'answer_reveal_before_first_response',
  ASK_ASSISTANCE_BEFORE_RESPONSE: 'ask_assistance_before_first_response',
  VISUAL_ASSISTANCE_BEFORE_RESPONSE: 'visual_assistance_before_first_response',
  RETEACH_BEFORE_RESPONSE: 'reteach_before_first_response',
  IDENTITY_UNAVAILABLE: 'identity_unavailable',
  INSUFFICIENT_CLEAN_POOL: 'insufficient_clean_reserved_pool',
});

export const MASTERY_OUTCOMES = Object.freeze({
  INDEPENDENT_SUCCESS: 'independent_success',
  NEEDS_RECOVERY: 'needs_recovery',
  INDEPENDENT_SUCCESS_AFTER_RECOVERY: 'independent_success_after_recovery',
  ASSISTED_SUCCESS: 'assisted_success',
  UNAVAILABLE: 'unavailable',
});

const DISQUALIFYING_ASSISTANCE = new Map([
  [STAGE_2_EVIDENCE_EVENT_TYPES.HINT_GIVEN, INDEPENDENCE_REASONS.HINT_BEFORE_RESPONSE],
  [STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_REVEALED, INDEPENDENCE_REASONS.ANSWER_REVEAL_BEFORE_RESPONSE],
  [STAGE_2_EVIDENCE_EVENT_TYPES.ASK_USED, INDEPENDENCE_REASONS.ASK_ASSISTANCE_BEFORE_RESPONSE],
  [STAGE_2_EVIDENCE_EVENT_TYPES.VISUAL_AID_USED, INDEPENDENCE_REASONS.VISUAL_ASSISTANCE_BEFORE_RESPONSE],
]);

const DISQUALIFYING_ASSISTANCE_LEVELS = new Map([
  ['hinted', INDEPENDENCE_REASONS.HINT_BEFORE_RESPONSE],
  ['answer_revealed', INDEPENDENCE_REASONS.ANSWER_REVEAL_BEFORE_RESPONSE],
  ['reteach_or_scaffolded', INDEPENDENCE_REASONS.RETEACH_BEFORE_RESPONSE],
  ['reteach_or_scaffold', INDEPENDENCE_REASONS.RETEACH_BEFORE_RESPONSE],
]);

export function identityKeys(identity = {}) {
  return [
    identity?.stableItemId || identity?.stable_item_id
      ? `stable:${identity.stableItemId || identity.stable_item_id}`
      : null,
    identity?.itemContentHash || identity?.item_content_hash
      ? `content:${identity.itemContentHash || identity.item_content_hash}`
      : null,
  ].filter(Boolean);
}

export function identityKeySet(identities = []) {
  const keys = new Set();
  for (const identity of identities || []) {
    for (const key of identityKeys(identity)) keys.add(key);
  }
  return keys;
}

export function hasIdentityOverlap(identity = {}, keySet = new Set()) {
  return identityKeys(identity).some((key) => keySet?.has?.(key));
}

function normalizeEventType(event = {}) {
  return event?.eventType || event?.event_type || null;
}

function normalizeAssistanceLevel(event = {}) {
  return event?.assistanceLevel || event?.assistance_level || null;
}

export function classifyAssistanceBeforeFirstResponse(events = []) {
  for (const event of events || []) {
    const eventType = normalizeEventType(event);
    if (eventType === STAGE_2_EVIDENCE_EVENT_TYPES.REPEAT_USED) continue;
    if (eventType === STAGE_2_EVIDENCE_EVENT_TYPES.RETRY_REQUESTED) {
      return {
        independenceStatus: INDEPENDENCE_STATUSES.RETRY_NO_HINT,
        independenceReason: INDEPENDENCE_REASONS.NOT_FIRST_RESPONSE,
      };
    }
    const level = normalizeAssistanceLevel(event);
    if (DISQUALIFYING_ASSISTANCE_LEVELS.has(level)) {
      const reason = DISQUALIFYING_ASSISTANCE_LEVELS.get(level);
      return {
        independenceStatus: level === 'answer_revealed'
          ? INDEPENDENCE_STATUSES.ANSWER_REVEALED
          : (level === 'hinted' ? INDEPENDENCE_STATUSES.HINT : INDEPENDENCE_STATUSES.RETEACH_OR_SCAFFOLD),
        independenceReason: reason,
      };
    }
    if (DISQUALIFYING_ASSISTANCE.has(eventType)) {
      const reason = DISQUALIFYING_ASSISTANCE.get(eventType);
      return {
        independenceStatus: eventType === STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_REVEALED
          ? INDEPENDENCE_STATUSES.ANSWER_REVEALED
          : (eventType === STAGE_2_EVIDENCE_EVENT_TYPES.HINT_GIVEN ? INDEPENDENCE_STATUSES.HINT : INDEPENDENCE_STATUSES.RETEACH_OR_SCAFFOLD),
        independenceReason: reason,
      };
    }
  }
  return {
    independenceStatus: INDEPENDENCE_STATUSES.INDEPENDENT,
    independenceReason: INDEPENDENCE_REASONS.ELIGIBLE,
  };
}

export function qualifyMasteryOpportunity({
  itemIdentity = null,
  assessmentRole = null,
  assessmentIsolationStatus = null,
  itemExposureId = null,
  isFirstResponse = true,
  preAssessmentExposed = false,
  priorExposedKeys = [],
  baselineIdentityKeys = [],
  instructionalExposureKeys = [],
  assistanceEventsBeforeResponse = [],
} = {}) {
  const priorKeys = priorExposedKeys instanceof Set ? priorExposedKeys : new Set(priorExposedKeys || []);
  const baselineKeys = baselineIdentityKeys instanceof Set ? baselineIdentityKeys : new Set(baselineIdentityKeys || []);
  const instructionalKeys = instructionalExposureKeys instanceof Set ? instructionalExposureKeys : new Set(instructionalExposureKeys || []);

  const fail = (reason, status = INDEPENDENCE_STATUSES.UNAVAILABLE) => ({
    eligible: false,
    independenceStatus: status,
    independenceReason: reason,
  });

  if (!itemIdentity?.stableItemId && !itemIdentity?.stable_item_id && !itemIdentity?.itemContentHash && !itemIdentity?.item_content_hash) {
    return fail(INDEPENDENCE_REASONS.IDENTITY_UNAVAILABLE);
  }
  if (assessmentRole !== ASSESSMENT_ROLES.ASSESSMENT_RESERVED) {
    return fail(INDEPENDENCE_REASONS.NOT_RESERVED);
  }
  if (assessmentIsolationStatus !== ASSESSMENT_ISOLATION_STATUSES.ISOLATED) {
    return fail(INDEPENDENCE_REASONS.ISOLATION_NOT_TRUSTWORTHY);
  }
  if (!itemExposureId) {
    return fail(INDEPENDENCE_REASONS.MISSING_EXPOSURE_ID);
  }
  if (preAssessmentExposed) {
    return fail(INDEPENDENCE_REASONS.CURRENT_PRE_EXPOSURE);
  }
  if (hasIdentityOverlap(itemIdentity, priorKeys)) {
    return fail(INDEPENDENCE_REASONS.PRIOR_EXPOSURE);
  }
  if (hasIdentityOverlap(itemIdentity, baselineKeys)) {
    return fail(INDEPENDENCE_REASONS.BASELINE_OVERLAP);
  }
  if (hasIdentityOverlap(itemIdentity, instructionalKeys)) {
    return fail(INDEPENDENCE_REASONS.INSTRUCTIONAL_EXPOSURE);
  }
  if (!isFirstResponse) {
    return fail(INDEPENDENCE_REASONS.NOT_FIRST_RESPONSE, INDEPENDENCE_STATUSES.RETRY_NO_HINT);
  }

  const assistance = classifyAssistanceBeforeFirstResponse(assistanceEventsBeforeResponse);
  if (assistance.independenceStatus !== INDEPENDENCE_STATUSES.INDEPENDENT) {
    return {
      eligible: false,
      ...assistance,
    };
  }

  return {
    eligible: true,
    independenceStatus: INDEPENDENCE_STATUSES.INDEPENDENT,
    independenceReason: INDEPENDENCE_REASONS.ELIGIBLE,
  };
}

export function classifyMasteryOutcome({
  qualification = {},
  isCorrect = false,
  checkRole = MASTERY_CHECK_ROLES.INITIAL,
} = {}) {
  if (qualification?.eligible) {
    if (isCorrect === true) {
      return checkRole === MASTERY_CHECK_ROLES.RECOVERY_VERIFICATION
        ? MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY
        : MASTERY_OUTCOMES.INDEPENDENT_SUCCESS;
    }
    return MASTERY_OUTCOMES.NEEDS_RECOVERY;
  }
  if (isCorrect === true && qualification?.independenceStatus && qualification.independenceStatus !== INDEPENDENCE_STATUSES.UNAVAILABLE) {
    return MASTERY_OUTCOMES.ASSISTED_SUCCESS;
  }
  return MASTERY_OUTCOMES.UNAVAILABLE;
}

export async function buildMasteryCycleId({
  lessonVersionId = null,
  conceptId = null,
  itemIdentity = null,
} = {}) {
  const hash = await hashCanonicalValue({
    protocol: INDEPENDENT_MASTERY_PROTOCOL_VERSION,
    lesson_version_id: lessonVersionId || null,
    concept_id: conceptId || itemIdentity?.conceptId || null,
    stable_item_id: itemIdentity?.stableItemId || null,
    item_content_hash: itemIdentity?.itemContentHash || null,
  });
  return hash ? `mastery-cycle:${INDEPENDENT_MASTERY_PROTOCOL_VERSION}:${hash.slice(0, 24)}` : null;
}

export async function buildMasteryCheckId({
  masteryCycleId = null,
  itemExposureId = null,
  checkRole = MASTERY_CHECK_ROLES.INITIAL,
} = {}) {
  const hash = await hashCanonicalValue({
    protocol: INDEPENDENT_MASTERY_PROTOCOL_VERSION,
    mastery_cycle_id: masteryCycleId,
    item_exposure_id: itemExposureId,
    check_role: checkRole,
  });
  return hash ? `mastery-check:${INDEPENDENT_MASTERY_PROTOCOL_VERSION}:${hash.slice(0, 24)}` : null;
}

async function identityRecords({ lessonKey, lessonId, lessonData, items }) {
  const records = [];
  for (const item of items || []) {
    const identity = await buildItemIdentity({ lessonKey, lessonId, lessonData, item });
    records.push({ item, identity });
  }
  return records;
}

export async function buildMasteryEligibilityContext({
  lessonKey = '',
  lessonId = '',
  lessonData = null,
  phaseSets = null,
  priorExposedKeys = [],
} = {}) {
  const baselineRecords = await identityRecords({
    lessonKey,
    lessonId,
    lessonData,
    items: getBaselineItems(lessonData),
  });
  const instructionalItems = ['discussion', 'comprehension', 'exercise', 'worksheet']
    .flatMap((phase) => Array.isArray(phaseSets?.[phase]) ? phaseSets[phase] : []);
  const instructionalRecords = await identityRecords({ lessonKey, lessonId, lessonData, items: instructionalItems });
  const reservedRecords = await identityRecords({
    lessonKey,
    lessonId,
    lessonData,
    items: getReservedAssessmentItems(lessonData),
  });
  return {
    baselineIdentityKeys: identityKeySet(baselineRecords.map((record) => record.identity)),
    instructionalExposureKeys: identityKeySet(instructionalRecords.map((record) => record.identity)),
    priorExposedKeys: priorExposedKeys instanceof Set ? priorExposedKeys : new Set(priorExposedKeys || []),
    reservedItemIdentities: reservedRecords.map((record) => record.identity),
  };
}

export function selectRecoveryVerificationItem({
  failedItemIdentity = null,
  candidateItems = [],
  candidateIdentities = [],
  alreadyUsedIdentityKeys = [],
} = {}) {
  const used = alreadyUsedIdentityKeys instanceof Set ? alreadyUsedIdentityKeys : new Set(alreadyUsedIdentityKeys || []);
  for (let i = 0; i < candidateItems.length; i += 1) {
    const identity = candidateIdentities[i] || null;
    if (!identity) continue;
    if (hasIdentityOverlap(identity, used)) continue;
    if (failedItemIdentity && identityKeys(identity).some((key) => identityKeys(failedItemIdentity).includes(key))) continue;
    return { item: candidateItems[i], identity, index: i };
  }
  return null;
}

export function buildRecoveryTeachingPayload({
  lessonData = null,
  failedItem = null,
  learnerResponse = null,
  correctAnswer = null,
  recoveryMode = 'current_test_correction',
} = {}) {
  return {
    protocol_version: INDEPENDENT_MASTERY_PROTOCOL_VERSION,
    recovery_mode: recoveryMode,
    instructional_lesson_view: buildInstructionalLessonView(lessonData),
    failed_item: failedItem ? { ...failedItem } : null,
    learner_response: learnerResponse == null ? null : String(learnerResponse),
    correct_answer: correctAnswer == null ? null : String(correctAnswer),
  };
}
