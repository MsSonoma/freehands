import { getBaselineItems } from './baseline.js';
import { getReservedAssessmentItems } from './assessmentIsolation.js';
import { buildItemIdentity, hashCanonicalValue } from './identity.js';
import {
  INDEPENDENCE_REASONS,
  INDEPENDENCE_STATUSES,
  MASTERY_OUTCOMES,
  classifyAssistanceBeforeFirstResponse,
  hasIdentityOverlap,
  identityKeySet,
} from './mastery.js';
import {
  RETENTION_MIN_DELAY_SECONDS,
  RETENTION_OUTCOMES,
  RETENTION_QUALIFICATION_STATUSES,
  RETENTION_REASONS,
  classifyRetentionOutcome,
  isRetentionDelayEligible,
  isValidRetentionAnchor,
  qualifyRetentionOpportunity,
} from './retention.js';

export const DAILY_FOLLOWUP_PROTOCOL_VERSION = 'daily-followup-v1';
export const WEEKLY_REVIEW_PROTOCOL_VERSION = 'weekly-review-v1';
export const DAILY_FOLLOWUP_EVIDENCE_PURPOSE = 'daily_followup';
export const WEEKLY_REVIEW_EVIDENCE_PURPOSE = 'weekly_review';
export const WEEKLY_REVIEW_MAX_ITEMS = 5;
export const WEEKLY_REVIEW_WINDOW_DAYS = 7;

export const REVIEW_TYPES = Object.freeze({
  DAILY_FOLLOWUP: 'daily_followup',
  WEEKLY_REVIEW: 'weekly_review',
});

export const WEEKDAYS = Object.freeze([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

export const WEEKLY_REVIEW_OUTCOMES = Object.freeze({
  DEMONSTRATED: 'demonstrated',
  NEEDS_REVIEW: 'needs_review',
  ASSISTED_DEMONSTRATION: 'assisted_demonstration',
  UNAVAILABLE: 'unavailable',
});

export const REVIEW_REASONS = Object.freeze({
  ELIGIBLE: 'eligible',
  NO_DAILY_POOL: 'no_daily_followup_pool',
  NO_WEEKLY_POOL: 'no_weekly_review_pool',
  NO_VALID_ANCHOR: 'no_valid_anchor',
  PRIOR_EXPOSURE: 'prior_exposure',
  ROLE_OVERLAP: 'reserved_role_overlap',
  IDENTITY_UNAVAILABLE: 'identity_unavailable',
  MISSING_EXPOSURE_ID: 'missing_exposure_id',
  NOT_FIRST_RESPONSE: 'not_first_response',
  ASSISTANCE_BEFORE_RESPONSE: 'assistance_before_first_response',
  EVIDENCE_UNAVAILABLE: 'evidence_unavailable',
});

const DAILY_FIELDS = Object.freeze([
  'dailyFollowup',
  'dailyFollowups',
  'daily_followup',
  'daily_followups',
  'dailyFollowupPool',
  'daily_followup_pool',
]);

const WEEKLY_FIELDS = Object.freeze([
  'weeklyReview',
  'weeklyReviews',
  'weekly_review',
  'weekly_reviews',
  'weeklyReviewPool',
  'weekly_review_pool',
]);

const LEGACY_RETENTION_FIELDS = Object.freeze([
  'retention',
  'retentionPool',
  'retention_pool',
  'retentionItems',
  'retention_items',
]);

const INSTRUCTIONAL_FIELDS = Object.freeze([
  'discussion',
  'comprehension',
  'exercise',
  'worksheet',
  'truefalse',
  'multiplechoice',
  'fillintheblank',
  'shortanswer',
  'questions',
]);

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (Array.isArray(value?.questions)) return value.questions.filter(Boolean);
  return [];
}

function collectFields(source, fields) {
  if (!source || typeof source !== 'object') return [];
  return fields.flatMap((field) => asArray(source[field]));
}

function uniqueItems(items, purpose, sourceRole) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      ...item,
      evidence_purpose: purpose,
      sourceRole,
    });
  }
  return result;
}

function getRoleItems(lesson, fields, purpose, sourceRole) {
  if (!lesson || typeof lesson !== 'object') return [];
  return uniqueItems([
    ...collectFields(lesson, fields),
    ...collectFields(lesson.raw, fields),
  ], purpose, sourceRole);
}

export function getDailyFollowUpItems(lesson = null) {
  return getRoleItems(
    lesson,
    DAILY_FIELDS,
    DAILY_FOLLOWUP_EVIDENCE_PURPOSE,
    DAILY_FOLLOWUP_EVIDENCE_PURPOSE,
  );
}

export function getWeeklyReviewItems(lesson = null) {
  return getRoleItems(
    lesson,
    WEEKLY_FIELDS,
    WEEKLY_REVIEW_EVIDENCE_PURPOSE,
    WEEKLY_REVIEW_EVIDENCE_PURPOSE,
  );
}

function getLegacyRetentionItems(lesson = null) {
  return getRoleItems(lesson, LEGACY_RETENTION_FIELDS, 'retention', 'retention');
}

function getInstructionalItems(lesson = null) {
  if (!lesson || typeof lesson !== 'object') return [];
  return uniqueItems([
    ...collectFields(lesson, INSTRUCTIONAL_FIELDS),
    ...collectFields(lesson.raw, INSTRUCTIONAL_FIELDS),
  ], 'instructional', 'instructional');
}

async function identityRecords({ lessonKey, lessonId, lessonData, items }) {
  const records = [];
  for (const item of items || []) {
    const identity = await buildItemIdentity({ lessonKey, lessonId, lessonData, item });
    records.push({ item, identity });
  }
  return records;
}

function unavailablePlan(reason, candidates = []) {
  return {
    eligible: false,
    reason,
    selectedItems: [],
    selectedIdentities: [],
    candidateIdentities: candidates,
  };
}

async function buildRolePlan({
  lessonKey,
  lessonId,
  lessonData,
  role,
  priorExposedKeys = [],
} = {}) {
  const roleItems = role === REVIEW_TYPES.DAILY_FOLLOWUP
    ? getDailyFollowUpItems(lessonData)
    : getWeeklyReviewItems(lessonData);
  if (!roleItems.length) {
    return unavailablePlan(
      role === REVIEW_TYPES.DAILY_FOLLOWUP
        ? REVIEW_REASONS.NO_DAILY_POOL
        : REVIEW_REASONS.NO_WEEKLY_POOL,
    );
  }

  const otherRoleItems = role === REVIEW_TYPES.DAILY_FOLLOWUP
    ? getWeeklyReviewItems(lessonData)
    : getDailyFollowUpItems(lessonData);
  const [roleRecords, protectedRecords] = await Promise.all([
    identityRecords({ lessonKey, lessonId, lessonData, items: roleItems }),
    identityRecords({
      lessonKey,
      lessonId,
      lessonData,
      items: [
        ...getBaselineItems(lessonData),
        ...getReservedAssessmentItems(lessonData),
        ...getLegacyRetentionItems(lessonData),
        ...otherRoleItems,
        ...getInstructionalItems(lessonData),
      ],
    }),
  ]);
  const protectedKeys = identityKeySet(protectedRecords.map((record) => record.identity));
  const exposedKeys = priorExposedKeys instanceof Set
    ? priorExposedKeys
    : new Set(priorExposedKeys || []);

  let firstReason = null;
  const valid = [];
  for (const record of roleRecords) {
    if (!record.identity?.stableItemId || !record.identity?.itemContentHash) {
      firstReason ||= REVIEW_REASONS.IDENTITY_UNAVAILABLE;
      continue;
    }
    if (hasIdentityOverlap(record.identity, protectedKeys)) {
      firstReason ||= REVIEW_REASONS.ROLE_OVERLAP;
      continue;
    }
    if (hasIdentityOverlap(record.identity, exposedKeys)) {
      firstReason ||= REVIEW_REASONS.PRIOR_EXPOSURE;
      continue;
    }
    valid.push(record);
  }

  if (!valid.length) {
    return unavailablePlan(
      firstReason || REVIEW_REASONS.ROLE_OVERLAP,
      roleRecords.map((record) => record.identity),
    );
  }

  return {
    eligible: true,
    reason: REVIEW_REASONS.ELIGIBLE,
    selectedItems: valid.map((record) => record.item),
    selectedIdentities: valid.map((record) => record.identity),
    candidateIdentities: roleRecords.map((record) => record.identity),
  };
}

export function buildDailyFollowUpPlan(options = {}) {
  return buildRolePlan({ ...options, role: REVIEW_TYPES.DAILY_FOLLOWUP });
}

export function buildWeeklyReviewPlan(options = {}) {
  return buildRolePlan({ ...options, role: REVIEW_TYPES.WEEKLY_REVIEW });
}

export async function deterministicReviewOrder(entries = [], cycleKey = '') {
  const scored = [];
  for (const entry of entries || []) {
    const targetKey = entry?.anchor?.concept_id
      || entry?.anchor?.lesson_key
      || entry?.lessonKey
      || entry?.identity?.stableItemId
      || '';
    const score = await hashCanonicalValue({ cycle_key: cycleKey, target_key: targetKey });
    scored.push({ entry, score: score || targetKey });
  }
  return scored
    .sort((a, b) => a.score.localeCompare(b.score))
    .map(({ entry }) => entry);
}

function validTimeZone(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

function zonedParts(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function localMidnightUtc({ year, month, day }, timeZone) {
  const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(guess), timeZone);
    const actualPseudoUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    guess += desired - actualPseudoUtc;
  }
  return new Date(guess);
}

function addLocalDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function dateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function normalizeWeeklyReviewDay(value) {
  const day = String(value || '').trim().toLowerCase();
  return WEEKDAYS.includes(day) ? day : 'friday';
}

export function buildWeeklyReviewCycle({
  now = new Date().toISOString(),
  weekday = 'friday',
  timeZone = 'UTC',
} = {}) {
  const nowInstant = new Date(now);
  if (Number.isNaN(nowInstant.getTime())) throw new Error('Invalid review cycle timestamp');
  const zone = validTimeZone(timeZone);
  const reviewDay = normalizeWeeklyReviewDay(weekday);
  const current = zonedParts(nowInstant, zone);
  const currentDate = { year: current.year, month: current.month, day: current.day };
  const currentWeekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'long',
  }).format(nowInstant).toLowerCase();
  const currentWeekday = WEEKDAYS.indexOf(currentWeekdayName);
  const targetWeekday = WEEKDAYS.indexOf(reviewDay);
  const daysSinceActivation = (currentWeekday - targetWeekday + 7) % 7;
  const activationLocal = addLocalDays(currentDate, -daysSinceActivation);
  const nextActivationLocal = addLocalDays(activationLocal, 7);
  const learningWindowStartLocal = addLocalDays(activationLocal, -WEEKLY_REVIEW_WINDOW_DAYS);
  const activationAt = localMidnightUtc(activationLocal, zone);
  const nextActivationAt = localMidnightUtc(nextActivationLocal, zone);
  const windowStart = localMidnightUtc(learningWindowStartLocal, zone);

  return {
    cycleKey: `${zone}:${dateKey(activationLocal)}`,
    weekday: reviewDay,
    timeZone: zone,
    activationAt: activationAt.toISOString(),
    nextActivationAt: nextActivationAt.toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: activationAt.toISOString(),
    active: nowInstant >= activationAt && nowInstant < nextActivationAt,
  };
}

function normalizeEventType(event) {
  return event?.event_type || event?.eventType || null;
}

function normalizeOutcome(event) {
  return event?.mastery_outcome || event?.masteryOutcome || event?.result?.mastery_outcome || null;
}

export function groupLatestEligibleAnchors(events = []) {
  const ordered = (events || [])
    .filter((event) => normalizeEventType(event) === 'mastery_check_result')
    .filter((event) => isValidRetentionAnchor({ ...event, mastery_outcome: normalizeOutcome(event) }))
    .sort((a, b) => Date.parse(b.occurred_at || 0) - Date.parse(a.occurred_at || 0));
  const seen = new Set();
  const result = [];
  for (const anchor of ordered) {
    const targetKey = anchor.concept_id || anchor.lesson_key || anchor.mastery_cycle_id || anchor.mastery_check_id;
    if (!targetKey || seen.has(targetKey)) continue;
    seen.add(targetKey);
    result.push(anchor);
  }
  return result;
}

export function selectDailyFollowUpAnchors({
  evidenceEvents = [],
  reviewResultEvents = [],
  now = new Date().toISOString(),
} = {}) {
  const consumed = new Set([
    ...evidenceEvents
      .filter((event) => normalizeEventType(event) === 'retention_check_result')
      .map((event) => event.retention_anchor_mastery_check_id),
    ...reviewResultEvents
      .filter((event) => event.review_type === REVIEW_TYPES.DAILY_FOLLOWUP || event?.metadata?.review_type === REVIEW_TYPES.DAILY_FOLLOWUP)
      .map((event) => event.anchor_mastery_check_id || event?.metadata?.anchor_mastery_check_id),
  ].filter(Boolean));

  return groupLatestEligibleAnchors(evidenceEvents).filter((anchor) => {
    if (!anchor.mastery_check_id || consumed.has(anchor.mastery_check_id)) return false;
    const delay = isRetentionDelayEligible({ anchorOccurredAt: anchor.occurred_at, now });
    if (!delay.eligible) return false;
    const anchorTime = Date.parse(anchor.occurred_at || '');
    return !evidenceEvents.some((event) => {
      const occurred = Date.parse(event.occurred_at || '');
      if (!Number.isFinite(occurred) || occurred <= anchorTime || occurred > Date.parse(now)) return false;
      if (event.event_id === anchor.event_id) return false;
      const instructional = event.assessment_role === 'instructional'
        || ['discussion', 'comprehension', 'exercise', 'worksheet'].includes(event.phase);
      if (!instructional) return false;
      return anchor.concept_id ? event.concept_id === anchor.concept_id : event.lesson_key === anchor.lesson_key;
    });
  });
}

export function selectWeeklyReviewAnchors({ evidenceEvents = [], cycle } = {}) {
  if (!cycle) return [];
  const start = Date.parse(cycle.windowStart || '');
  const end = Date.parse(cycle.windowEnd || '');
  const windowEvents = (evidenceEvents || []).filter((event) => {
    const occurred = Date.parse(event.occurred_at || '');
    return Number.isFinite(occurred) && occurred >= start && occurred < end;
  });
  return groupLatestEligibleAnchors(windowEvents).filter((anchor) => {
    const occurred = Date.parse(anchor.occurred_at || '');
    return Number.isFinite(occurred) && occurred >= start && occurred < end;
  });
}

export function qualifyDailyFollowUpOpportunity(options = {}) {
  return qualifyRetentionOpportunity(options);
}

export function classifyDailyFollowUpOutcome(options = {}) {
  return classifyRetentionOutcome(options);
}

export function qualifyWeeklyReviewOpportunity({
  anchor = null,
  itemIdentity = null,
  itemExposureId = null,
  isFirstResponse = true,
  priorExposedKeys = [],
  assistanceEventsBeforeResponse = [],
} = {}) {
  const fail = (reason, status = RETENTION_QUALIFICATION_STATUSES.UNAVAILABLE) => ({
    eligible: false,
    qualificationStatus: status,
    qualificationReason: reason,
    independenceStatus: status === RETENTION_QUALIFICATION_STATUSES.ASSISTED
      ? INDEPENDENCE_STATUSES.RETEACH_OR_SCAFFOLD
      : INDEPENDENCE_STATUSES.UNAVAILABLE,
    independenceReason: reason,
  });
  if (!anchor || !isValidRetentionAnchor(anchor)) return fail(REVIEW_REASONS.NO_VALID_ANCHOR);
  if (!itemIdentity?.stableItemId && !itemIdentity?.stable_item_id) return fail(REVIEW_REASONS.IDENTITY_UNAVAILABLE);
  if (!itemExposureId) return fail(REVIEW_REASONS.MISSING_EXPOSURE_ID);
  if (!isFirstResponse) return fail(REVIEW_REASONS.NOT_FIRST_RESPONSE, RETENTION_QUALIFICATION_STATUSES.ASSISTED);
  const exposed = priorExposedKeys instanceof Set ? priorExposedKeys : new Set(priorExposedKeys || []);
  if (hasIdentityOverlap(itemIdentity, exposed)) return fail(REVIEW_REASONS.PRIOR_EXPOSURE);
  const assistance = classifyAssistanceBeforeFirstResponse(assistanceEventsBeforeResponse);
  if (assistance.independenceStatus !== INDEPENDENCE_STATUSES.INDEPENDENT) {
    return {
      eligible: false,
      qualificationStatus: RETENTION_QUALIFICATION_STATUSES.ASSISTED,
      qualificationReason: REVIEW_REASONS.ASSISTANCE_BEFORE_RESPONSE,
      independenceStatus: assistance.independenceStatus,
      independenceReason: assistance.independenceReason,
    };
  }
  return {
    eligible: true,
    qualificationStatus: RETENTION_QUALIFICATION_STATUSES.ELIGIBLE,
    qualificationReason: REVIEW_REASONS.ELIGIBLE,
    independenceStatus: INDEPENDENCE_STATUSES.INDEPENDENT,
    independenceReason: INDEPENDENCE_REASONS.ELIGIBLE,
  };
}

export function classifyWeeklyReviewOutcome({ qualification = {}, isCorrect = false } = {}) {
  if (qualification.eligible) {
    return isCorrect ? WEEKLY_REVIEW_OUTCOMES.DEMONSTRATED : WEEKLY_REVIEW_OUTCOMES.NEEDS_REVIEW;
  }
  if (qualification.qualificationStatus === RETENTION_QUALIFICATION_STATUSES.ASSISTED) {
    return isCorrect
      ? WEEKLY_REVIEW_OUTCOMES.ASSISTED_DEMONSTRATION
      : WEEKLY_REVIEW_OUTCOMES.NEEDS_REVIEW;
  }
  return WEEKLY_REVIEW_OUTCOMES.UNAVAILABLE;
}

function optionTextAt(item, index) {
  const choices = Array.isArray(item?.choices)
    ? item.choices
    : (Array.isArray(item?.options) ? item.options : []);
  return index >= 0 && index < choices.length ? String(choices[index]) : null;
}

export function buildReviewAcceptableAnswers(item = {}) {
  const answers = [
    ...(Array.isArray(item.expectedAny) ? item.expectedAny : []),
    ...(Array.isArray(item.acceptable) ? item.acceptable : []),
  ];
  if (item.expected != null) answers.push(item.expected);
  if (item.answer != null && typeof item.answer !== 'number') answers.push(item.answer);
  const correctIndex = Number.isInteger(item.correct)
    ? item.correct
    : (Number.isInteger(item.answer) ? item.answer : null);
  if (correctIndex != null) {
    const letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[correctIndex];
    if (letter) answers.push(letter, letter.toLowerCase());
    const text = optionTextAt(item, correctIndex);
    if (text) answers.push(text);
  }
  return Array.from(new Set(answers.map((answer) => String(answer ?? '').trim()).filter(Boolean)));
}

export function evaluateReviewAnswer(item, response) {
  const normalize = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s./-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const learner = normalize(response);
  if (!learner) return false;
  const acceptable = buildReviewAcceptableAnswers(item).map(normalize).filter(Boolean);
  if (acceptable.includes(learner)) return true;

  const isTrueFalse = acceptable.includes('true') || acceptable.includes('false');
  if (isTrueFalse) {
    if (acceptable.includes('true') && ['t', 'yes', 'correct', 'right'].includes(learner)) return true;
    if (acceptable.includes('false') && ['f', 'no', 'incorrect', 'wrong'].includes(learner)) return true;
  }

  const hasChoices = Array.isArray(item?.choices) || Array.isArray(item?.options);
  if (hasChoices) return false;
  const learnerTokens = new Set(learner.split(' ').filter(Boolean));
  return acceptable.some((answer) => {
    const tokens = answer.split(' ').filter(Boolean);
    if (!tokens.length) return false;
    const matches = tokens.filter((token) => learnerTokens.has(token)).length;
    return tokens.length <= 2 ? matches === tokens.length : matches / tokens.length >= 0.6;
  });
}

export function reviewHelpText(item = {}) {
  if (item.hint) return String(item.hint);
  const answers = buildReviewAcceptableAnswers(item);
  return answers[0] || 'Try reviewing this lesson with your facilitator.';
}

export function sanitizeReviewItem(item = {}) {
  const choices = Array.isArray(item.choices)
    ? item.choices
    : (Array.isArray(item.options) ? item.options : []);
  return {
    question: item.question || item.prompt || item.text || item.Q || item.q || '',
    choices,
    has_help: !!(item.hint || buildReviewAcceptableAnswers(item).length),
  };
}

export function dailyOutcomeLabel(outcome, delaySeconds) {
  const duration = formatReviewDelay(delaySeconds);
  if (outcome === RETENTION_OUTCOMES.RETAINED) return `Retained after ${duration}`;
  if (outcome === RETENTION_OUTCOMES.NEEDS_REVIEW) return `Review recommended after ${duration}`;
  if (outcome === RETENTION_OUTCOMES.ASSISTED_REVIEW) return 'Retention not independently established';
  return 'Daily Follow-Up evidence unavailable';
}

export function weeklyOutcomeLabel(outcome, delaySeconds) {
  const duration = formatReviewDelay(delaySeconds);
  if (outcome === WEEKLY_REVIEW_OUTCOMES.DEMONSTRATED) return `Demonstrated in weekly review after ${duration}`;
  if (outcome === WEEKLY_REVIEW_OUTCOMES.NEEDS_REVIEW) return `Review recommended from weekly review after ${duration}`;
  if (outcome === WEEKLY_REVIEW_OUTCOMES.ASSISTED_DEMONSTRATION) return 'Demonstrated with assistance in weekly review';
  return 'Weekly Review evidence unavailable';
}

export function formatReviewDelay(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return 'an unrecorded interval';
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const minutes = Math.max(1, Math.floor(seconds / 60));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function buildReviewRunSummary({ run, items = [], events = [] } = {}) {
  const resultByItem = new Map();
  for (const event of events || []) {
    if (event.event_type === 'review_item_result') resultByItem.set(String(event.review_item_id), event);
  }
  const itemSummaries = items.map((item) => {
    const result = resultByItem.get(String(item.id)) || null;
    const isDaily = run.review_type === REVIEW_TYPES.DAILY_FOLLOWUP;
    return {
      lesson_key: item.lesson_key,
      lesson_id: item.lesson_id,
      concept_id: item.concept_id,
      anchor_mastery_check_id: item.anchor_mastery_check_id,
      state: result?.review_outcome || 'not_measured',
      label: result
        ? (isDaily
          ? dailyOutcomeLabel(result.review_outcome, result.delay_seconds)
          : weeklyOutcomeLabel(result.review_outcome, result.delay_seconds))
        : 'Not measured',
      delay_seconds: result?.delay_seconds ?? null,
      qualification_status: result?.qualification_status || null,
      qualification_reason: result?.qualification_reason || null,
      prior_daily_retrieval_observed: result?.prior_daily_retrieval_observed === true,
      intervening_instruction_observed: result?.intervening_instruction_observed === true,
      intervening_review_observed: result?.intervening_review_observed === true,
    };
  });
  return {
    report_version: 'facilitator-review-evidence-v1',
    kind: 'review',
    review: {
      id: run.id,
      type: run.review_type,
      protocol_version: run.protocol_version,
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      timezone: run.timezone,
      activation_at: run.activation_at,
      window_start: run.window_start,
      window_end: run.window_end,
    },
    label: run.review_type === REVIEW_TYPES.DAILY_FOLLOWUP ? 'Daily Follow-Up' : 'Weekly Review',
    items: itemSummaries,
  };
}

export function dailyDelay(anchor, presentedAt) {
  return isRetentionDelayEligible({
    anchorOccurredAt: anchor?.occurred_at,
    now: presentedAt,
    minDelaySeconds: RETENTION_MIN_DELAY_SECONDS,
  });
}
