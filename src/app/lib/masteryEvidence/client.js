"use client";

import { getSupabaseClient } from '../supabaseClient.js';
import {
  MASTERY_EVIDENCE_SCHEMA_VERSION,
  MASTERY_EVIDENCE_STATUSES,
  STAGE_1_EVIDENCE_EVENT_TYPES,
  STAGE_2_EVIDENCE_EVENT_TYPES,
  STAGE_6_EVIDENCE_EVENT_TYPES,
  STAGE_7_EVIDENCE_EVENT_TYPES,
  isMasteryEvidenceEnabled,
} from './constants.js';
import {
  buildItemIdentity,
  buildLessonIdentity,
  buildTeachingProtocolIdentity,
  stableStringify,
} from './identity.js';
import {
  ASSESSMENT_ISOLATION_VERSION,
  ASSESSMENT_ROLES,
} from './assessmentIsolation.js';
import {
  BASELINE_PROTOCOL_VERSION,
} from './baseline.js';
import {
  INDEPENDENT_MASTERY_PROTOCOL_VERSION,
  buildMasteryCheckId,
  buildMasteryCycleId,
} from './mastery.js';
import {
  RETENTION_PROTOCOL_VERSION,
  buildRetentionCheckId,
} from './retention.js';
import { inferLessonSource } from './schema.js';

const DEFAULT_WRITE_TIMEOUT_MS = 4000;

function normalizeText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function getEvidenceEnabled() {
  return isMasteryEvidenceEnabled({
    NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED: process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED,
  });
}

function normalizeKeyPart(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[:|]/g, '-');
}

export function makeEvidenceIdempotencyKey({
  schemaVersion = MASTERY_EVIDENCE_SCHEMA_VERSION,
  sessionId,
  eventType,
  suffix = '',
} = {}) {
  const base = [
    normalizeKeyPart(schemaVersion),
    normalizeKeyPart(sessionId),
    normalizeKeyPart(eventType),
  ].filter(Boolean).join(':');
  const normalizedSuffix = normalizeKeyPart(suffix);
  return normalizedSuffix ? `${base}:${normalizedSuffix}` : base;
}

export { stableStringify };

export async function hashLessonContent(lessonData) {
  if (!lessonData) return null;
  try {
    const lessonIdentity = await buildLessonIdentity({ lessonData });
    return lessonIdentity.lessonContentHash;
  } catch {
    return null;
  }
}

async function defaultAuthTokenProvider() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

export class MasteryEvidenceClient {
  constructor({
    enabled = getEvidenceEnabled(),
    fetchImpl = null,
    getAuthToken = defaultAuthTokenProvider,
    now = () => new Date().toISOString(),
    logger = console,
    writeTimeoutMs = DEFAULT_WRITE_TIMEOUT_MS,
  } = {}) {
    this.enabled = !!enabled;
    this.fetchImpl = fetchImpl || ((...args) => fetch(...args));
    this.getAuthToken = getAuthToken;
    this.now = now;
    this.logger = logger;
    this.writeTimeoutMs = writeTimeoutMs;
    this.status = this.enabled
      ? MASTERY_EVIDENCE_STATUSES.PARTIAL
      : MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
    this.hasFailedWrite = false;
    this.meta = null;
    this.evidenceSessionId = null;
    this.serverProvenance = null;
    this.recordedKeys = new Set();
    this.pendingWrites = new Set();
    this.readyPromise = null;
    this.eventSequence = 0;
    this.assessmentIsolation = null;
    this.baseline = null;
    this.mastery = null;
    this.retention = null;
    this.presentedItemIdentityKeys = new Set();
  }

  initialize({
    sessionId,
    browserSessionId,
    learnerId,
    lessonKey,
    lessonId,
    lessonData,
    assessmentIsolation = null,
    baseline = null,
    mastery = null,
    retention = null,
    teachingProtocol = null,
    activityAuthorization = null,
    startedAt,
  } = {}) {
    if (!this.enabled) {
      this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      this.readyPromise = Promise.resolve({ ok: false, status: this.status });
      return this.readyPromise;
    }

    const normalizedSessionId = normalizeText(sessionId);
    const normalizedLearnerId = normalizeText(learnerId);
    const normalizedLessonKey = normalizeText(lessonKey);
    if (!normalizedSessionId || !normalizedLearnerId || !normalizedLessonKey) {
      this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      this.readyPromise = Promise.resolve({ ok: false, status: this.status });
      return this.readyPromise;
    }

    this.meta = {
      sessionId: normalizedSessionId,
      browserSessionId: normalizeText(browserSessionId),
      learnerId: normalizedLearnerId,
      lessonKey: normalizedLessonKey,
      lessonId: normalizeText(lessonId),
      lessonData: lessonData || null,
      assessmentIsolation: assessmentIsolation || null,
      baseline: baseline || null,
      mastery: mastery || null,
      retention: retention || null,
      teachingProtocol: teachingProtocol || null,
      activityAuthorization: activityAuthorization || null,
      startedAt: startedAt || this.now(),
    };
    this.assessmentIsolation = assessmentIsolation || null;
    this.baseline = baseline || null;
    this.mastery = mastery || null;
    this.retention = retention || null;
    this.presentedItemIdentityKeys = new Set();

    this.readyPromise = this.#createSession();
    return this.readyPromise;
  }

  async recordSessionStarted({ initialPhase = null } = {}) {
    if (!this.enabled) return { ok: false, status: this.status };
    const startedAt = this.meta?.startedAt || this.now();
    return await this.#trackWrite(this.#recordEvent({
      eventType: STAGE_1_EVIDENCE_EVENT_TYPES.SESSION_STARTED,
      occurredAt: startedAt,
      phase: initialPhase,
      suffix: STAGE_1_EVIDENCE_EVENT_TYPES.SESSION_STARTED,
      payload: { source: 'session-v2', initial_phase: initialPhase || null },
    }));
  }

  recordPhaseTransition({ previousPhase = null, phase = null, sequence = 0 } = {}) {
    if (!this.enabled) return Promise.resolve({ ok: false, status: this.status });
    const suffix = [
      STAGE_1_EVIDENCE_EVENT_TYPES.PHASE_TRANSITION,
      Number.isFinite(Number(sequence)) ? Number(sequence) : 0,
      previousPhase || 'unknown',
      phase || 'unknown',
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_1_EVIDENCE_EVENT_TYPES.PHASE_TRANSITION,
      occurredAt: this.now(),
      phase,
      suffix,
      payload: {
        source: 'session-v2',
        previous_phase: previousPhase || null,
        phase: phase || null,
        sequence: Number.isFinite(Number(sequence)) ? Number(sequence) : 0,
      },
    }));
  }

  recordItemPresented({
    phase,
    itemId = null,
    itemPurpose = null,
    itemExposureId,
    identityItem = null,
    assessmentRole = null,
    evidencePurpose = null,
    legacyItemFingerprint,
    questionIndex = null,
    totalQuestions = null,
    item = null,
  } = {}) {
    const suffix = [
      itemExposureId || legacyItemFingerprint || itemId || 'unknown-item',
      'presented',
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED,
      occurredAt: this.now(),
      phase,
      suffix,
      itemId: itemId || legacyItemFingerprint || null,
      itemPurpose,
      itemExposureId,
      identityItem,
      assessmentRole,
      evidencePurpose,
      payload: {
        source: 'session-v2',
        legacy_item_fingerprint: legacyItemFingerprint || null,
        question_index: Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : null,
        total_questions: Number.isFinite(Number(totalQuestions)) ? Number(totalQuestions) : null,
        item,
      },
    }));
  }

  recordLearnerResponse({
    phase,
    itemId = null,
    itemPurpose = null,
    itemExposureId,
    identityItem = null,
    assessmentRole = null,
    evidencePurpose = null,
    legacyItemFingerprint,
    attemptNumber,
    isFirstResponse,
    response,
    responseType = 'text',
    questionIndex = null,
  } = {}) {
    const normalizedAttempt = Number.isFinite(Number(attemptNumber)) ? Number(attemptNumber) : 1;
    const suffix = [
      itemExposureId || legacyItemFingerprint || itemId || 'unknown-item',
      'attempt',
      normalizedAttempt,
      'response',
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_2_EVIDENCE_EVENT_TYPES.LEARNER_RESPONSE,
      occurredAt: this.now(),
      phase,
      suffix,
      itemId: itemId || legacyItemFingerprint || null,
      itemPurpose,
      itemExposureId,
      identityItem,
      assessmentRole,
      evidencePurpose,
      attemptNumber: normalizedAttempt,
      isFirstResponse: !!isFirstResponse,
      payload: {
        source: 'session-v2',
        legacy_item_fingerprint: legacyItemFingerprint || null,
        question_index: Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : null,
        response_type: responseType,
        response_value: response == null ? null : String(response),
      },
    }));
  }

  recordAnswerEvaluated({
    phase,
    itemId = null,
    itemPurpose = null,
    itemExposureId,
    identityItem = null,
    assessmentRole = null,
    evidencePurpose = null,
    legacyItemFingerprint,
    attemptNumber,
    isFirstResponse,
    isCorrect,
    evaluationMode = 'current_app_judgment',
    response = null,
    correctAnswer = null,
    questionIndex = null,
  } = {}) {
    const normalizedAttempt = Number.isFinite(Number(attemptNumber)) ? Number(attemptNumber) : 1;
    const suffix = [
      itemExposureId || legacyItemFingerprint || itemId || 'unknown-item',
      'attempt',
      normalizedAttempt,
      'evaluation',
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_EVALUATED,
      occurredAt: this.now(),
      phase,
      suffix,
      itemId: itemId || legacyItemFingerprint || null,
      itemPurpose,
      itemExposureId,
      identityItem,
      assessmentRole,
      evidencePurpose,
      attemptNumber: normalizedAttempt,
      isFirstResponse: !!isFirstResponse,
      result: {
        correct: isCorrect === true,
        evaluation_mode: evaluationMode,
      },
      payload: {
        source: 'session-v2',
        legacy_item_fingerprint: legacyItemFingerprint || null,
        question_index: Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : null,
        response_value: response == null ? null : String(response),
        correct_answer: correctAnswer == null ? null : String(correctAnswer),
      },
    }));
  }

  recordHintGiven({
    phase,
    itemId = null,
    itemPurpose = null,
    itemExposureId,
    identityItem = null,
    assessmentRole = null,
    legacyItemFingerprint,
    attemptNumber,
    hintSource = 'current_phase_feedback',
    hintText = null,
    questionIndex = null,
  } = {}) {
    const normalizedAttempt = Number.isFinite(Number(attemptNumber)) ? Number(attemptNumber) : 1;
    const suffix = [
      itemExposureId || legacyItemFingerprint || itemId || 'unknown-item',
      'attempt',
      normalizedAttempt,
      'hint',
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_2_EVIDENCE_EVENT_TYPES.HINT_GIVEN,
      occurredAt: this.now(),
      phase,
      suffix,
      itemId: itemId || legacyItemFingerprint || null,
      itemPurpose,
      itemExposureId,
      identityItem,
      assessmentRole,
      assistanceLevel: 'hinted',
      attemptNumber: normalizedAttempt,
      payload: {
        source: 'session-v2',
        legacy_item_fingerprint: legacyItemFingerprint || null,
        question_index: Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : null,
        hint_source: hintSource,
        hint_text: hintText == null ? null : String(hintText),
      },
    }));
  }

  recordRetryRequested({
    phase,
    itemId = null,
    itemPurpose = null,
    itemExposureId,
    identityItem = null,
    assessmentRole = null,
    legacyItemFingerprint,
    attemptNumber,
    retrySource = 'current_phase_feedback',
    questionIndex = null,
  } = {}) {
    const normalizedAttempt = Number.isFinite(Number(attemptNumber)) ? Number(attemptNumber) : 1;
    const suffix = [
      itemExposureId || legacyItemFingerprint || itemId || 'unknown-item',
      'attempt',
      normalizedAttempt,
      'retry',
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_2_EVIDENCE_EVENT_TYPES.RETRY_REQUESTED,
      occurredAt: this.now(),
      phase,
      suffix,
      itemId: itemId || legacyItemFingerprint || null,
      itemPurpose,
      itemExposureId,
      identityItem,
      assessmentRole,
      assistanceLevel: 'retry_no_hint',
      attemptNumber: normalizedAttempt,
      payload: {
        source: 'session-v2',
        legacy_item_fingerprint: legacyItemFingerprint || null,
        question_index: Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : null,
        retry_source: retrySource,
      },
    }));
  }

  recordAnswerRevealed({
    phase,
    itemId = null,
    itemPurpose = null,
    itemExposureId,
    identityItem = null,
    assessmentRole = null,
    legacyItemFingerprint,
    attemptNumber = null,
    revealSource = 'current_phase_feedback',
    correctAnswer = null,
    questionIndex = null,
  } = {}) {
    const suffix = [
      itemExposureId || legacyItemFingerprint || itemId || 'unknown-item',
      attemptNumber ? `attempt:${attemptNumber}` : 'no-attempt',
      'answer-revealed',
      revealSource,
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_REVEALED,
      occurredAt: this.now(),
      phase,
      suffix,
      itemId: itemId || legacyItemFingerprint || null,
      itemPurpose,
      itemExposureId,
      identityItem,
      assessmentRole,
      assistanceLevel: 'answer_revealed',
      attemptNumber,
      payload: {
        source: 'session-v2',
        legacy_item_fingerprint: legacyItemFingerprint || null,
        question_index: Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : null,
        reveal_source: revealSource,
        correct_answer: correctAnswer == null ? null : String(correctAnswer),
      },
    }));
  }

  recordAskUsed({
    phase,
    itemId = null,
    itemPurpose = null,
    itemExposureId = null,
    identityItem = null,
    assessmentRole = null,
    evidencePurpose = null,
    legacyItemFingerprint = null,
    askMode = 'freeform',
    prompt = null,
    answerRevealed = false,
  } = {}) {
    const suffix = [
      itemExposureId || legacyItemFingerprint || itemId || 'no-active-item',
      askMode,
      this.eventSequence + 1,
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_2_EVIDENCE_EVENT_TYPES.ASK_USED,
      occurredAt: this.now(),
      phase,
      suffix,
      itemId: itemId || legacyItemFingerprint || null,
      itemPurpose,
      itemExposureId,
      identityItem,
      assessmentRole,
      evidencePurpose,
      assistanceLevel: answerRevealed ? 'answer_revealed' : 'reteach_or_scaffolded',
      payload: {
        source: 'session-v2',
        legacy_item_fingerprint: legacyItemFingerprint || null,
        ask_mode: askMode,
        prompt: prompt == null ? null : String(prompt),
        current_answer_requested: askMode === 'current_answer_request',
        answer_revealed: !!answerRevealed,
      },
    }));
  }

  recordInteractionEvent({
    eventType,
    phase,
    suffix,
    itemId = null,
    itemPurpose = null,
    itemExposureId = null,
    identityItem = null,
    assessmentRole = null,
    evidencePurpose = null,
    legacyItemFingerprint = null,
    payload = {},
  } = {}) {
    return this.#trackWrite(this.#recordEvent({
      eventType,
      occurredAt: this.now(),
      phase,
      suffix: suffix || String(this.eventSequence + 1),
      itemId: itemId || legacyItemFingerprint || null,
      itemPurpose,
      itemExposureId,
      identityItem,
      assessmentRole,
      evidencePurpose,
      payload: {
        source: 'session-v2',
        legacy_item_fingerprint: legacyItemFingerprint || null,
        ...payload,
      },
    }));
  }

  async recordSessionEnded({ reason = 'completed', testPercentage = null } = {}) {
    if (!this.enabled) return { ok: false, status: this.status };

    await Promise.allSettled(Array.from(this.pendingWrites));
    const endedAt = this.now();
    const eventResult = await this.#trackWrite(this.#recordEvent({
      eventType: STAGE_1_EVIDENCE_EVENT_TYPES.SESSION_ENDED,
      occurredAt: endedAt,
      phase: 'complete',
      suffix: STAGE_1_EVIDENCE_EVENT_TYPES.SESSION_ENDED,
      payload: {
        source: 'session-v2',
        reason,
        test_percentage: testPercentage,
      },
    }));

    const finalStatus = eventResult?.ok && !this.hasFailedWrite
      ? MASTERY_EVIDENCE_STATUSES.COMPLETE
      : MASTERY_EVIDENCE_STATUSES.PARTIAL;
    return await this.finalize({ evidenceStatus: finalStatus, endedAt });
  }

  async markPartial({ endedAt = this.now() } = {}) {
    if (!this.evidenceSessionId) {
      this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      return { ok: false, status: this.status };
    }
    return await this.finalize({
      evidenceStatus: MASTERY_EVIDENCE_STATUSES.PARTIAL,
      endedAt,
    });
  }

  async finalize({ evidenceStatus = MASTERY_EVIDENCE_STATUSES.PARTIAL, endedAt = this.now() } = {}) {
    if (!this.enabled || !this.evidenceSessionId) {
      this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      return { ok: false, status: this.status };
    }
    const response = await this.#post({
      action: 'finalize_session',
      evidence_session_id: this.evidenceSessionId,
      evidence_status: evidenceStatus,
      ended_at: endedAt,
    });
    if (response?.ok) {
      this.status = response.evidence_session?.evidence_status || evidenceStatus;
      return { ok: true, status: this.status, evidenceSession: response.evidence_session };
    }
    this.hasFailedWrite = true;
    this.status = MASTERY_EVIDENCE_STATUSES.PARTIAL;
    return { ok: false, status: this.status };
  }

  async updateBaselineStatus({
    baselineStatus,
    baselineItemCount = null,
    baselineUnavailableReason = null,
    baselineProtocolVersion = BASELINE_PROTOCOL_VERSION,
  } = {}) {
    try {
      if (this.readyPromise) await this.readyPromise;
      if (!this.evidenceSessionId) return { ok: false, status: this.status };
      const response = await this.#post({
        action: 'update_baseline_status',
        schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
        evidence_session_id: this.evidenceSessionId,
        baseline_protocol_version: baselineProtocolVersion,
        baseline_status: baselineStatus,
        baseline_item_count: Number.isFinite(Number(baselineItemCount))
          ? Number(baselineItemCount)
          : null,
        baseline_unavailable_reason: baselineUnavailableReason || null,
      });
      return { ok: !!response?.ok, status: this.status };
    } catch (error) {
      this.logger?.warn?.('[MasteryEvidence] Baseline status update failed:', error);
      return { ok: false, status: this.status };
    }
  }

  async recordMasteryCheckResult({
    phase = 'test',
    itemId = null,
    itemPurpose = 'test',
    itemExposureId,
    identityItem = null,
    assessmentRole = null,
    legacyItemFingerprint = null,
    attemptNumber = 1,
    isFirstResponse = true,
    isCorrect = false,
    masteryCycleId = null,
    masteryCheckId = null,
    masteryCheckRole = null,
    independenceStatus = null,
    independenceReason = null,
    masteryOutcome = null,
    response = null,
    correctAnswer = null,
    qualification = null,
    questionIndex = null,
  } = {}) {
    const itemIdentity = await this.#resolveItemIdentity(identityItem);
    const cycleId = masteryCycleId || await buildMasteryCycleId({
      lessonVersionId: null,
      conceptId: itemIdentity?.conceptId || null,
      itemIdentity,
    });
    const checkId = masteryCheckId || await buildMasteryCheckId({
      masteryCycleId: cycleId,
      itemExposureId,
      checkRole: masteryCheckRole,
    });
    const suffix = [
      checkId || itemExposureId || legacyItemFingerprint || itemId || 'unknown-mastery-check',
      masteryOutcome || 'outcome',
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_6_EVIDENCE_EVENT_TYPES.MASTERY_CHECK_RESULT,
      occurredAt: this.now(),
      phase,
      suffix,
      itemId: itemId || legacyItemFingerprint || null,
      itemPurpose,
      itemExposureId,
      identityItem,
      assessmentRole,
      evidencePurpose: 'independent_mastery',
      attemptNumber,
      isFirstResponse,
      result: {
        correct: isCorrect === true,
        mastery_outcome: masteryOutcome || null,
        independence_status: independenceStatus || null,
        independence_reason: independenceReason || null,
      },
      payload: {
        source: 'session-v2',
        legacy_item_fingerprint: legacyItemFingerprint || null,
        question_index: Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : null,
        response_value: response == null ? null : String(response),
        correct_answer: correctAnswer == null ? null : String(correctAnswer),
        qualification: qualification || null,
      },
      masteryProtocolVersion: INDEPENDENT_MASTERY_PROTOCOL_VERSION,
      masteryCycleId: cycleId,
      masteryCheckId: checkId,
      masteryCheckRole,
      independenceStatus,
      independenceReason,
      masteryOutcome,
    }));
  }

  async recordRetentionCheckResult({
    phase = 'idle',
    itemId = null,
    itemPurpose = 'retention',
    itemExposureId,
    identityItem = null,
    assessmentRole = null,
    legacyItemFingerprint = null,
    attemptNumber = 1,
    isFirstResponse = true,
    isCorrect = false,
    retentionCheckId = null,
    retentionAnchorMasteryCheckId = null,
    retentionDelaySeconds = null,
    retentionQualificationStatus = null,
    retentionQualificationReason = null,
    retentionOutcome = null,
    independenceStatus = null,
    independenceReason = null,
    response = null,
    correctAnswer = null,
    qualification = null,
    questionIndex = null,
  } = {}) {
    const checkId = retentionCheckId || await buildRetentionCheckId({
      retentionAnchorMasteryCheckId,
      itemExposureId,
    });
    const suffix = [
      checkId || itemExposureId || legacyItemFingerprint || itemId || 'unknown-retention-check',
      retentionOutcome || 'outcome',
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_7_EVIDENCE_EVENT_TYPES.RETENTION_CHECK_RESULT,
      occurredAt: this.now(),
      phase,
      suffix,
      itemId: itemId || legacyItemFingerprint || null,
      itemPurpose,
      itemExposureId,
      identityItem,
      assessmentRole,
      evidencePurpose: 'retention',
      attemptNumber,
      isFirstResponse,
      result: {
        correct: isCorrect === true,
        retention_outcome: retentionOutcome || null,
        retention_qualification_status: retentionQualificationStatus || null,
        retention_qualification_reason: retentionQualificationReason || null,
      },
      payload: {
        source: 'session-v2',
        legacy_item_fingerprint: legacyItemFingerprint || null,
        question_index: Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : null,
        response_value: response == null ? null : String(response),
        correct_answer: correctAnswer == null ? null : String(correctAnswer),
        qualification: qualification || null,
      },
      retentionProtocolVersion: RETENTION_PROTOCOL_VERSION,
      retentionCheckId: checkId,
      retentionAnchorMasteryCheckId,
      retentionDelaySeconds,
      retentionQualificationStatus,
      retentionQualificationReason,
      retentionOutcome,
      independenceStatus,
      independenceReason,
    }));
  }

  async checkPriorExposure({ learnerId, itemIdentities = [] } = {}) {
    try {
      if (this.readyPromise) await this.readyPromise;
      const response = await this.#post({
        action: 'check_prior_exposure',
        schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
        learner_id: learnerId,
        item_identities: itemIdentities.map((identity) => ({
          stable_item_id: identity?.stableItemId || identity?.stable_item_id || null,
          item_content_hash: identity?.itemContentHash || identity?.item_content_hash || null,
        })),
      });
      return {
        ok: !!response?.ok,
        exposedKeys: Array.isArray(response?.exposed_keys) ? response.exposed_keys : [],
      };
    } catch (error) {
      this.logger?.warn?.('[MasteryEvidence] Prior exposure check failed:', error);
      return { ok: false, exposedKeys: [] };
    }
  }

  async checkRetentionEligibility({
    learnerId,
    lessonKey = this.meta?.lessonKey,
    currentSessionId = this.meta?.sessionId,
    itemIdentities = [],
    now = this.now(),
  } = {}) {
    try {
      if (this.readyPromise) await this.readyPromise;
      const response = await this.#post({
        action: 'check_retention_eligibility',
        schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
        learner_id: learnerId,
        lesson_key: lessonKey,
        current_session_id: currentSessionId,
        now,
        item_identities: itemIdentities.map((identity) => ({
          stable_item_id: identity?.stableItemId || identity?.stable_item_id || null,
          item_content_hash: identity?.itemContentHash || identity?.item_content_hash || null,
        })),
      });
      return {
        ok: !!response?.ok,
        eligible: !!response?.eligible,
        anchor: response?.anchor || null,
        retentionDelaySeconds: Number.isFinite(Number(response?.retention_delay_seconds))
          ? Number(response.retention_delay_seconds)
          : null,
        exposedKeys: Array.isArray(response?.exposed_keys) ? response.exposed_keys : [],
        reason: response?.reason || null,
      };
    } catch (error) {
      this.logger?.warn?.('[MasteryEvidence] Retention eligibility check failed:', error);
      return { ok: false, eligible: false, anchor: null, retentionDelaySeconds: null, exposedKeys: [], reason: 'evidence_unavailable' };
    }
  }

  async #createSession() {
    try {
      const lessonIdentity = await buildLessonIdentity({
        lessonKey: this.meta?.lessonKey,
        lessonId: this.meta?.lessonId,
        lessonData: this.meta?.lessonData,
      });
      const protocolIdentity = this.meta?.teachingProtocol || await buildTeachingProtocolIdentity();
      const response = await this.#post({
        action: 'create_session',
        schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
        identity_schema_version: lessonIdentity.identitySchemaVersion,
        session_id: this.meta.sessionId,
        browser_session_id: this.meta.browserSessionId,
        learner_id: this.meta.learnerId,
        lesson_key: this.meta.lessonKey,
        stable_lesson_key: lessonIdentity.stableLessonKey || this.meta.lessonKey,
        lesson_id: this.meta.lessonId,
        lesson_source: inferLessonSource({
          lessonKey: this.meta.lessonKey,
          lessonId: this.meta.lessonId,
          lessonData: this.meta.lessonData,
        }),
        lesson_version: normalizeText(this.meta.lessonData?.version || this.meta.lessonData?.updated_at),
        lesson_identity_version: lessonIdentity.lessonIdentityVersion,
        lesson_version_id: lessonIdentity.lessonVersionId,
        lesson_content_hash: lessonIdentity.lessonContentHash,
        teaching_protocol_version: protocolIdentity.protocolVersion,
        teaching_protocol_hash: protocolIdentity.protocolHash,
        authorized_occurrence_id: this.meta?.activityAuthorization?.occurrenceId || null,
        assessment_isolation_version: this.assessmentIsolation?.version || ASSESSMENT_ISOLATION_VERSION,
        assessment_isolation_status: this.assessmentIsolation?.status || null,
        reserved_assessment_count: Number.isFinite(Number(this.assessmentIsolation?.reservedAssessmentCount))
          ? Number(this.assessmentIsolation.reservedAssessmentCount)
          : null,
        baseline_protocol_version: this.baseline?.protocolVersion || BASELINE_PROTOCOL_VERSION,
        baseline_status: this.baseline?.status || null,
        baseline_item_count: Number.isFinite(Number(this.baseline?.baselineItemCount))
          ? Number(this.baseline.baselineItemCount)
          : null,
        baseline_unavailable_reason: this.baseline?.reason || null,
        mastery_protocol_version: this.mastery?.protocolVersion || INDEPENDENT_MASTERY_PROTOCOL_VERSION,
        retention_protocol_version: this.retention?.protocolVersion || RETENTION_PROTOCOL_VERSION,
        started_at: this.meta.startedAt,
      });
      if (!response?.ok || !response.evidence_session?.id) {
        this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
        return { ok: false, status: this.status };
      }
      this.evidenceSessionId = response.evidence_session.id;
      this.serverProvenance = response.server_provenance || null;
      this.status = response.evidence_session.evidence_status || MASTERY_EVIDENCE_STATUSES.PARTIAL;
      return { ok: true, status: this.status, evidenceSession: response.evidence_session };
    } catch (error) {
      this.hasFailedWrite = true;
      this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      this.logger?.warn?.('[MasteryEvidence] Session initialization failed:', error);
      return { ok: false, status: this.status };
    }
  }

  async #resolveItemIdentity(identityItem) {
    if (!identityItem) {
      return {
        stableItemId: null,
        itemContentHash: null,
        itemIdentityVersion: null,
        conceptId: null,
      };
    }
    try {
      return await buildItemIdentity({
        lessonKey: this.meta?.lessonKey,
        lessonId: this.meta?.lessonId,
        lessonData: this.meta?.lessonData,
        item: identityItem,
      });
    } catch {
      return {
        stableItemId: null,
        itemContentHash: null,
        itemIdentityVersion: null,
        conceptId: null,
      };
    }
  }

  #itemIdentityKeys(itemIdentity = {}) {
    return [
      itemIdentity?.stableItemId ? `stable:${itemIdentity.stableItemId}` : null,
      itemIdentity?.itemContentHash ? `content:${itemIdentity.itemContentHash}` : null,
    ].filter(Boolean);
  }

  #hasPresentedItem(itemIdentity = {}) {
    return this.#itemIdentityKeys(itemIdentity)
      .some((key) => this.presentedItemIdentityKeys.has(key));
  }

  #markPresentedItem(itemIdentity = {}) {
    for (const key of this.#itemIdentityKeys(itemIdentity)) {
      this.presentedItemIdentityKeys.add(key);
    }
  }

  async #recordEvent({
    eventType,
    occurredAt,
    phase,
    suffix,
    payload,
    result = null,
    itemId = null,
    itemPurpose = null,
    itemExposureId = null,
    identityItem = null,
    assessmentRole = null,
    evidencePurpose = null,
    masteryProtocolVersion = null,
    masteryCycleId = null,
    masteryCheckId = null,
    masteryCheckRole = null,
    independenceStatus = null,
    independenceReason = null,
    masteryOutcome = null,
    retentionProtocolVersion = null,
    retentionCheckId = null,
    retentionAnchorMasteryCheckId = null,
    retentionDelaySeconds = null,
    retentionQualificationStatus = null,
    retentionQualificationReason = null,
    retentionOutcome = null,
    preAssessmentExposed = null,
    assistanceLevel = null,
    attemptNumber = null,
    isFirstResponse = null,
  }) {
    try {
      if (this.readyPromise) await this.readyPromise;
      if (!this.evidenceSessionId || !this.meta) return { ok: false, status: this.status };
      const eventSequence = this.eventSequence + 1;
      const itemIdentity = await this.#resolveItemIdentity(identityItem);
      const normalizedAssessmentRole = assessmentRole === ASSESSMENT_ROLES.ASSESSMENT_RESERVED
        ? ASSESSMENT_ROLES.ASSESSMENT_RESERVED
        : (assessmentRole === ASSESSMENT_ROLES.INSTRUCTIONAL
          ? ASSESSMENT_ROLES.INSTRUCTIONAL
          : (assessmentRole === ASSESSMENT_ROLES.CONVERSATIONAL_OPPORTUNITY
            ? ASSESSMENT_ROLES.CONVERSATIONAL_OPPORTUNITY
            : null));
      const computedPreAssessmentExposed = eventType === STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED
        && normalizedAssessmentRole === ASSESSMENT_ROLES.ASSESSMENT_RESERVED
        ? this.#hasPresentedItem(itemIdentity)
        : preAssessmentExposed;
      const idempotencyKey = makeEvidenceIdempotencyKey({
        sessionId: this.meta.sessionId,
        eventType,
        suffix,
      });
      if (this.recordedKeys.has(idempotencyKey)) {
        return { ok: true, duplicate: true, status: this.status };
      }
      const response = await this.#post({
        action: 'record_event',
        schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
        evidence_session_id: this.evidenceSessionId,
        event_type: eventType,
        idempotency_key: idempotencyKey,
        event_sequence: eventSequence,
        occurred_at: occurredAt,
        phase,
        concept_id: itemIdentity.conceptId,
        item_id: itemId,
        stable_item_id: itemIdentity.stableItemId,
        item_content_hash: itemIdentity.itemContentHash,
        item_identity_version: itemIdentity.itemIdentityVersion,
        assessment_role: normalizedAssessmentRole,
        pre_assessment_exposed: typeof computedPreAssessmentExposed === 'boolean'
          ? computedPreAssessmentExposed
          : null,
        evidence_purpose: evidencePurpose || null,
        item_purpose: itemPurpose,
        item_exposure_id: itemExposureId,
        mastery_protocol_version: masteryProtocolVersion || null,
        mastery_cycle_id: masteryCycleId || null,
        mastery_check_id: masteryCheckId || null,
        mastery_check_role: masteryCheckRole || null,
        independence_status: independenceStatus || null,
        independence_reason: independenceReason || null,
        mastery_outcome: masteryOutcome || null,
        retention_protocol_version: retentionProtocolVersion || null,
        retention_check_id: retentionCheckId || null,
        retention_anchor_mastery_check_id: retentionAnchorMasteryCheckId || null,
        retention_delay_seconds: Number.isFinite(Number(retentionDelaySeconds))
          ? Number(retentionDelaySeconds)
          : null,
        retention_qualification_status: retentionQualificationStatus || null,
        retention_qualification_reason: retentionQualificationReason || null,
        retention_outcome: retentionOutcome || null,
        assistance_level: assistanceLevel,
        attempt_number: attemptNumber,
        is_first_response: isFirstResponse,
        result,
        payload,
        provenance: this.serverProvenance || null,
      });
      if (response?.ok) {
        this.eventSequence = eventSequence;
        this.recordedKeys.add(idempotencyKey);
        if (eventType === STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED) {
          this.#markPresentedItem(itemIdentity);
        }
        return { ok: true, duplicate: !!response.duplicate, status: this.status };
      }
      this.hasFailedWrite = true;
      return { ok: false, status: this.status };
    } catch (error) {
      this.hasFailedWrite = true;
      this.status = this.evidenceSessionId
        ? MASTERY_EVIDENCE_STATUSES.PARTIAL
        : MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      this.logger?.warn?.('[MasteryEvidence] Event write failed:', error);
      return { ok: false, status: this.status };
    }
  }

  async #post(body) {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Evidence auth token unavailable');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.writeTimeoutMs);
    try {
      const response = await this.fetchImpl('/api/evidence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Evidence request failed (${response.status})`);
      }
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  #trackWrite(promise) {
    const tracked = Promise.resolve(promise);
    this.pendingWrites.add(tracked);
    tracked.finally(() => this.pendingWrites.delete(tracked));
    return tracked;
  }
}
