import { getReservedAssessmentItems, tagItemsForPhase } from './assessmentIsolation.js';
import { getBaselineItems } from './baseline.js';
import { buildItemIdentity, hashCanonicalValue } from './identity.js';
import {
  INDEPENDENCE_REASONS,
  INDEPENDENCE_STATUSES,
  MASTERY_OUTCOMES,
  classifyAssistanceBeforeFirstResponse,
  hasIdentityOverlap,
  identityKeySet,
  identityKeys,
} from './mastery.js';

export const RETENTION_PROTOCOL_VERSION = 'retention-v1';
export const RETENTION_MIN_DELAY_SECONDS = 24 * 60 * 60;
export const RETENTION_EVIDENCE_PURPOSE = 'retention';

export const RETENTION_OUTCOMES = Object.freeze({
  RETAINED: 'retained',
  NEEDS_REVIEW: 'needs_review',
  ASSISTED_REVIEW: 'assisted_review',
  UNAVAILABLE: 'unavailable',
});

export const RETENTION_QUALIFICATION_STATUSES = Object.freeze({
  ELIGIBLE: 'eligible',
  UNAVAILABLE: 'unavailable',
  ASSISTED: 'assisted',
});

export const RETENTION_REASONS = Object.freeze({
  ELIGIBLE: 'eligible',
  NO_RETENTION_POOL: 'no_retention_pool',
  NO_VALID_ANCHOR: 'no_valid_anchor',
  DELAY_TOO_SHORT: 'delay_too_short',
  NOT_NEW_SESSION: 'not_new_session',
  ANCHOR_ALREADY_CONSUMED: 'anchor_already_consumed',
  PRIOR_EXPOSURE: 'prior_exposure',
  BASELINE_OVERLAP: 'baseline_overlap',
  STAGE6_OVERLAP: 'stage6_overlap',
  INSTRUCTIONAL_OVERLAP: 'instructional_overlap',
  RETENTION_POOL_CONTAMINATED: 'retention_pool_contaminated',
  INTERVENING_SAME_TARGET_INSTRUCTION: 'intervening_same_target_instruction',
  IDENTITY_UNAVAILABLE: 'identity_unavailable',
  MISSING_EXPOSURE_ID: 'missing_exposure_id',
  NOT_FIRST_RESPONSE: 'not_first_response',
  ASSISTANCE_BEFORE_RESPONSE: 'assistance_before_first_response',
  EVIDENCE_UNAVAILABLE: 'evidence_unavailable',
});

const RETENTION_FIELDS = Object.freeze([
  'retention',
  'retentionPool',
  'retention_pool',
  'retentionItems',
  'retention_items',
]);

const INSTRUCTIONAL_PHASES = Object.freeze(['discussion', 'comprehension', 'exercise', 'worksheet']);

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function collectRetentionCandidates(source) {
  const candidates = [];
  if (!source || typeof source !== 'object') return candidates;
  for (const field of RETENTION_FIELDS) {
    const value = source[field];
    if (Array.isArray(value)) candidates.push(...value);
    else if (Array.isArray(value?.questions)) candidates.push(...value.questions);
  }
  return candidates;
}

export function getRetentionItems(lesson = null) {
  if (!lesson || typeof lesson !== 'object') return [];
  const candidates = [
    ...collectRetentionCandidates(lesson),
    ...collectRetentionCandidates(lesson.raw),
  ];
  const seen = new Set();
  const unique = [];
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      ...item,
      evidence_purpose: RETENTION_EVIDENCE_PURPOSE,
      sourceRole: 'retention',
    });
  }
  return unique;
}

async function identityRecords({ lessonKey, lessonId, lessonData, items }) {
  const records = [];
  for (const item of items || []) {
    const identity = await buildItemIdentity({ lessonKey, lessonId, lessonData, item });
    records.push({ item, identity });
  }
  return records;
}

function getInstructionalItems(phaseSets = {}) {
  return INSTRUCTIONAL_PHASES.flatMap((phase) => tagItemsForPhase(asArray(phaseSets?.[phase]), phase));
}

function makeUnavailable(reason, extra = {}) {
  return {
    status: RETENTION_QUALIFICATION_STATUSES.UNAVAILABLE,
    reason,
    selectedItems: [],
    selectedIdentities: [],
    retentionItemCount: 0,
    ...extra,
  };
}

export async function buildRetentionPlan({
  lessonKey = '',
  lessonId = '',
  lessonData = null,
  phaseSets = null,
  priorExposedKeys = [],
  targetCount = 1,
} = {}) {
  const retentionItems = getRetentionItems(lessonData);
  if (!retentionItems.length) {
    return makeUnavailable(RETENTION_REASONS.NO_RETENTION_POOL);
  }

  const [retentionRecords, baselineRecords, stage6Records, instructionalRecords] = await Promise.all([
    identityRecords({ lessonKey, lessonId, lessonData, items: retentionItems }),
    identityRecords({ lessonKey, lessonId, lessonData, items: getBaselineItems(lessonData) }),
    identityRecords({ lessonKey, lessonId, lessonData, items: getReservedAssessmentItems(lessonData) }),
    identityRecords({ lessonKey, lessonId, lessonData, items: getInstructionalItems(phaseSets || {}) }),
  ]);

  const priorKeys = priorExposedKeys instanceof Set ? priorExposedKeys : new Set(priorExposedKeys || []);
  const baselineKeys = identityKeySet(baselineRecords.map((record) => record.identity));
  const stage6Keys = identityKeySet(stage6Records.map((record) => record.identity));
  const instructionalKeys = identityKeySet(instructionalRecords.map((record) => record.identity));

  const valid = [];
  const rejectedReasons = new Set();
  for (const record of retentionRecords) {
    if (!record.identity?.stableItemId && !record.identity?.itemContentHash) {
      rejectedReasons.add(RETENTION_REASONS.IDENTITY_UNAVAILABLE);
      continue;
    }
    if (hasIdentityOverlap(record.identity, priorKeys)) {
      rejectedReasons.add(RETENTION_REASONS.PRIOR_EXPOSURE);
      continue;
    }
    if (hasIdentityOverlap(record.identity, baselineKeys)) {
      rejectedReasons.add(RETENTION_REASONS.BASELINE_OVERLAP);
      continue;
    }
    if (hasIdentityOverlap(record.identity, stage6Keys)) {
      rejectedReasons.add(RETENTION_REASONS.STAGE6_OVERLAP);
      continue;
    }
    if (hasIdentityOverlap(record.identity, instructionalKeys)) {
      rejectedReasons.add(RETENTION_REASONS.INSTRUCTIONAL_OVERLAP);
      continue;
    }
    valid.push(record);
  }

  if (!valid.length) {
    return makeUnavailable(Array.from(rejectedReasons)[0] || RETENTION_REASONS.RETENTION_POOL_CONTAMINATED, {
      candidateIdentities: retentionRecords.map((record) => record.identity),
    });
  }

  const count = Math.max(1, Math.min(2, Number.isFinite(Number(targetCount)) ? Number(targetCount) : 1, valid.length));
  const selected = valid.slice(0, count);
  return {
    status: RETENTION_QUALIFICATION_STATUSES.ELIGIBLE,
    reason: null,
    selectedItems: selected.map((record) => record.item),
    selectedIdentities: selected.map((record) => record.identity),
    candidateIdentities: retentionRecords.map((record) => record.identity),
    retentionItemCount: selected.length,
  };
}

export function isRetentionDelayEligible({ anchorOccurredAt, now = new Date().toISOString(), minDelaySeconds = RETENTION_MIN_DELAY_SECONDS } = {}) {
  const anchorMs = Date.parse(anchorOccurredAt || '');
  const nowMs = Date.parse(now || '');
  if (!Number.isFinite(anchorMs) || !Number.isFinite(nowMs)) {
    return { eligible: false, delaySeconds: null, reason: RETENTION_REASONS.EVIDENCE_UNAVAILABLE };
  }
  const delaySeconds = Math.floor((nowMs - anchorMs) / 1000);
  return {
    eligible: delaySeconds >= minDelaySeconds,
    delaySeconds,
    reason: delaySeconds >= minDelaySeconds ? RETENTION_REASONS.ELIGIBLE : RETENTION_REASONS.DELAY_TOO_SHORT,
  };
}

export function isValidRetentionAnchor(event = {}) {
  const outcome = event?.mastery_outcome || event?.masteryOutcome || event?.result?.mastery_outcome;
  return outcome === MASTERY_OUTCOMES.INDEPENDENT_SUCCESS
    || outcome === MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY;
}

export function selectRetentionAnchor({
  anchors = [],
  consumedAnchorIds = [],
  now = new Date().toISOString(),
  currentSessionId = null,
} = {}) {
  const consumed = new Set(consumedAnchorIds || []);
  const valid = anchors
    .filter(isValidRetentionAnchor)
    .filter((anchor) => {
      const checkId = anchor.mastery_check_id || anchor.masteryCheckId || null;
      return checkId && !consumed.has(checkId);
    })
    .filter((anchor) => !currentSessionId || anchor.session_id !== currentSessionId)
    .map((anchor) => ({
      anchor,
      delay: isRetentionDelayEligible({ anchorOccurredAt: anchor.occurred_at || anchor.occurredAt, now }),
    }))
    .filter((entry) => entry.delay.eligible)
    .sort((a, b) => Date.parse(b.anchor.occurred_at || b.anchor.occurredAt || 0) - Date.parse(a.anchor.occurred_at || a.anchor.occurredAt || 0));
  return valid[0] || null;
}

export function qualifyRetentionOpportunity({
  anchor = null,
  delaySeconds = null,
  itemIdentity = null,
  itemExposureId = null,
  isFirstResponse = true,
  priorExposedKeys = [],
  assistanceEventsBeforeResponse = [],
  interveningSameTargetInstruction = false,
} = {}) {
  const fail = (reason, status = RETENTION_QUALIFICATION_STATUSES.UNAVAILABLE, independenceStatus = INDEPENDENCE_STATUSES.UNAVAILABLE) => ({
    eligible: false,
    retentionQualificationStatus: status,
    retentionQualificationReason: reason,
    independenceStatus,
    independenceReason: reason,
  });

  if (!anchor || !isValidRetentionAnchor(anchor)) return fail(RETENTION_REASONS.NO_VALID_ANCHOR);
  if (!Number.isFinite(Number(delaySeconds)) || Number(delaySeconds) < RETENTION_MIN_DELAY_SECONDS) {
    return fail(RETENTION_REASONS.DELAY_TOO_SHORT);
  }
  if (!itemIdentity?.stableItemId && !itemIdentity?.stable_item_id && !itemIdentity?.itemContentHash && !itemIdentity?.item_content_hash) {
    return fail(RETENTION_REASONS.IDENTITY_UNAVAILABLE);
  }
  if (!itemExposureId) return fail(RETENTION_REASONS.MISSING_EXPOSURE_ID);
  if (!isFirstResponse) return fail(RETENTION_REASONS.NOT_FIRST_RESPONSE, RETENTION_QUALIFICATION_STATUSES.ASSISTED, INDEPENDENCE_STATUSES.RETRY_NO_HINT);
  if (hasIdentityOverlap(itemIdentity, priorExposedKeys instanceof Set ? priorExposedKeys : new Set(priorExposedKeys || []))) {
    return fail(RETENTION_REASONS.PRIOR_EXPOSURE);
  }
  if (interveningSameTargetInstruction) {
    return fail(RETENTION_REASONS.INTERVENING_SAME_TARGET_INSTRUCTION);
  }

  const assistance = classifyAssistanceBeforeFirstResponse(assistanceEventsBeforeResponse);
  if (assistance.independenceStatus !== INDEPENDENCE_STATUSES.INDEPENDENT) {
    return {
      eligible: false,
      retentionQualificationStatus: RETENTION_QUALIFICATION_STATUSES.ASSISTED,
      retentionQualificationReason: RETENTION_REASONS.ASSISTANCE_BEFORE_RESPONSE,
      independenceStatus: assistance.independenceStatus,
      independenceReason: assistance.independenceReason || INDEPENDENCE_REASONS.ELIGIBLE,
    };
  }

  return {
    eligible: true,
    retentionQualificationStatus: RETENTION_QUALIFICATION_STATUSES.ELIGIBLE,
    retentionQualificationReason: RETENTION_REASONS.ELIGIBLE,
    independenceStatus: INDEPENDENCE_STATUSES.INDEPENDENT,
    independenceReason: INDEPENDENCE_REASONS.ELIGIBLE,
  };
}

export function classifyRetentionOutcome({ qualification = {}, isCorrect = false } = {}) {
  if (qualification?.eligible) {
    return isCorrect === true ? RETENTION_OUTCOMES.RETAINED : RETENTION_OUTCOMES.NEEDS_REVIEW;
  }
  if (isCorrect === true && qualification?.retentionQualificationStatus === RETENTION_QUALIFICATION_STATUSES.ASSISTED) {
    return RETENTION_OUTCOMES.ASSISTED_REVIEW;
  }
  return RETENTION_OUTCOMES.UNAVAILABLE;
}

export async function buildRetentionCheckId({
  retentionAnchorMasteryCheckId = null,
  itemExposureId = null,
  retentionProtocolVersion = RETENTION_PROTOCOL_VERSION,
} = {}) {
  const hash = await hashCanonicalValue({
    retention_protocol_version: retentionProtocolVersion,
    retention_anchor_mastery_check_id: retentionAnchorMasteryCheckId,
    item_exposure_id: itemExposureId,
  });
  return hash ? `retention-check:${retentionProtocolVersion}:${hash.slice(0, 24)}` : null;
}

export function retentionIdentityKeys(itemsOrIdentities = []) {
  const keys = new Set();
  for (const entry of itemsOrIdentities || []) {
    for (const key of identityKeys(entry)) keys.add(key);
  }
  return keys;
}
