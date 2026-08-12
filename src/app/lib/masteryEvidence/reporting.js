import {
  MASTERY_EVIDENCE_STATUSES,
  STAGE_2_EVIDENCE_EVENT_TYPES,
  STAGE_6_EVIDENCE_EVENT_TYPES,
  STAGE_7_EVIDENCE_EVENT_TYPES,
} from './constants.js';
import { BASELINE_PROTOCOL_VERSION } from './baseline.js';
import {
  INDEPENDENT_MASTERY_PROTOCOL_VERSION,
  MASTERY_OUTCOMES,
} from './mastery.js';
import {
  RETENTION_OUTCOMES,
  RETENTION_PROTOCOL_VERSION,
} from './retention.js';

export const FACILITATOR_EVIDENCE_REPORT_VERSION = 'facilitator-evidence-v1';

const ASSISTANCE_EVENT_LABELS = Object.freeze({
  [STAGE_2_EVIDENCE_EVENT_TYPES.HINT_GIVEN]: 'Hint used',
  [STAGE_2_EVIDENCE_EVENT_TYPES.RETRY_REQUESTED]: 'Retry used',
  [STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_REVEALED]: 'Answer revealed',
  [STAGE_2_EVIDENCE_EVENT_TYPES.ASK_USED]: 'Asked for help',
  [STAGE_2_EVIDENCE_EVENT_TYPES.VISUAL_AID_USED]: 'Visual aid used',
  [STAGE_6_EVIDENCE_EVENT_TYPES.RECOVERY_STARTED]: 'Recovery teaching started',
  [STAGE_6_EVIDENCE_EVENT_TYPES.RECOVERY_COMPLETED]: 'Recovery teaching completed',
});

const BASELINE_REASON_LABELS = Object.freeze({
  no_baseline_pool: 'This lesson did not include a source-backed baseline item.',
  deterministic_overlap: 'The available baseline item overlapped other lesson evidence.',
  prior_exposure: 'The baseline item had already been shown to the learner.',
  resume_after_instruction: 'The session resumed after instruction had already begun.',
  legacy_or_ambiguous_snapshot: 'The saved session could not establish a clean pre-instruction point.',
  evidence_unavailable: 'The baseline evidence service was unavailable.',
  timeline_jump: 'The session path changed before a clean baseline could be recorded.',
});

const MASTERY_REASON_LABELS = Object.freeze({
  not_reserved_assessment_item: 'The item was not a reserved held-out assessment item.',
  assessment_isolation_not_trustworthy: 'Assessment isolation could not be established.',
  baseline_overlap: 'The item overlapped the baseline.',
  instructional_exposure: 'The item had already appeared during instruction.',
  prior_exposure: 'The item had been shown in an earlier session.',
  current_session_pre_exposure: 'The item had already appeared in this session.',
  missing_exposure_id: 'The item presentation could not be linked reliably.',
  not_first_response: 'The result followed an earlier response.',
  hint_before_first_response: 'A hint was used before the response.',
  answer_reveal_before_first_response: 'The answer was revealed before the response.',
  ask_assistance_before_first_response: 'Ask assistance occurred before the response.',
  visual_assistance_before_first_response: 'A generated visual aid was used before the response.',
  reteach_before_first_response: 'Reteaching or scaffolding occurred before the response.',
  identity_unavailable: 'Stable item identity was unavailable.',
  insufficient_clean_reserved_pool: 'There were not enough clean held-out items.',
});

const RETENTION_REASON_LABELS = Object.freeze({
  no_retention_pool: 'This lesson did not include a dedicated retention pool.',
  no_valid_anchor: 'No qualifying earlier independent check was available.',
  delay_too_short: 'The recorded delay did not meet the retention interval requirement.',
  not_new_session: 'The check occurred in the same session as the earlier independent result.',
  anchor_already_consumed: 'The earlier independent result already had a retention check.',
  prior_exposure: 'The delayed item had already been shown to the learner.',
  baseline_overlap: 'The delayed item overlapped the baseline.',
  stage6_overlap: 'The delayed item overlapped the earlier mastery check.',
  instructional_overlap: 'The delayed item overlapped instruction.',
  retention_pool_contaminated: 'The delayed item pool was not cleanly held out.',
  intervening_same_target_instruction: 'The target was reviewed before the delayed check.',
  identity_unavailable: 'Stable item identity was unavailable.',
  missing_exposure_id: 'The delayed item presentation could not be linked reliably.',
  not_first_response: 'The delayed result followed an earlier response.',
  assistance_before_first_response: 'Assistance occurred before the delayed response.',
  evidence_unavailable: 'The delayed evidence service was unavailable.',
});

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function asText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function asFiniteNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compareEvents(left, right) {
  const leftSequence = asFiniteNumber(left?.event_sequence);
  const rightSequence = asFiniteNumber(right?.event_sequence);
  if (leftSequence != null && rightSequence != null && leftSequence !== rightSequence) {
    return leftSequence - rightSequence;
  }
  const leftTime = Date.parse(left?.occurred_at || left?.created_at || '') || 0;
  const rightTime = Date.parse(right?.occurred_at || right?.created_at || '') || 0;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return String(left?.event_id || '').localeCompare(String(right?.event_id || ''));
}

function protocolState(values, expected) {
  const versions = Array.from(new Set(asArray(values).map(asText).filter(Boolean)));
  if (versions.length === 0) return { state: 'absent', versions };
  if (versions.some((version) => version !== expected)) return { state: 'unknown', versions };
  return { state: 'known', versions };
}

function itemReference(event = {}) {
  return {
    event_id: asText(event.event_id),
    occurred_at: asTimestamp(event.occurred_at),
    concept_id: asText(event.concept_id),
    stable_item_id: asText(event.stable_item_id),
    item_content_hash: asText(event.item_content_hash),
    item_exposure_id: asText(event.item_exposure_id),
    assessment_role: asText(event.assessment_role),
    evidence_purpose: asText(event.evidence_purpose),
    mastery_check_id: asText(event.mastery_check_id),
    retention_check_id: asText(event.retention_check_id),
  };
}

function supportingFact(event = {}) {
  return {
    event_type: asText(event.event_type),
    occurred_at: asTimestamp(event.occurred_at),
    phase: asText(event.phase),
    correctness: typeof event?.result?.correct === 'boolean' ? event.result.correct : null,
    is_first_response: typeof event.is_first_response === 'boolean' ? event.is_first_response : null,
    assistance_level: asText(event.assistance_level),
    mastery_outcome: asText(event.mastery_outcome),
    mastery_check_role: asText(event.mastery_check_role),
    independence_status: asText(event.independence_status),
    independence_reason: asText(event.independence_reason),
    retention_outcome: asText(event.retention_outcome),
    retention_delay_seconds: asFiniteNumber(event.retention_delay_seconds),
    retention_qualification_status: asText(event.retention_qualification_status),
    retention_qualification_reason: asText(event.retention_qualification_reason),
    item: itemReference(event),
  };
}

function firstEvaluationPerExposure(events) {
  const selected = new Map();
  for (const event of events) {
    const key = asText(event.item_exposure_id)
      || asText(event.stable_item_id)
      || asText(event.item_id)
      || asText(event.event_id);
    if (!key || selected.has(key)) continue;
    if (event.is_first_response === false) continue;
    selected.set(key, event);
  }
  return Array.from(selected.values());
}

function summarizeBaseline(session, events) {
  const evaluations = firstEvaluationPerExposure(events.filter((event) => (
    event.event_type === STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_EVALUATED
      && event.evidence_purpose === 'baseline'
  )));
  const protocol = protocolState([session?.baseline_protocol_version], BASELINE_PROTOCOL_VERSION);
  const evaluatedCount = evaluations.filter((event) => typeof event?.result?.correct === 'boolean').length;
  const correctCount = evaluations.filter((event) => event?.result?.correct === true).length;
  const intendedCount = asFiniteNumber(session?.baseline_item_count);
  const observed = {
    evaluated_count: evaluatedCount,
    correct_count: correctCount,
    intended_count: intendedCount,
  };
  const supporting_evidence = evaluations.map(supportingFact);

  if (protocol.state === 'unknown') {
    return {
      state: 'unknown_protocol',
      label: 'Baseline evidence recorded',
      detail: 'Detailed interpretation is unavailable for this protocol version.',
      unavailable_reason: 'unknown_protocol',
      observed,
      supporting_evidence,
    };
  }
  if (protocol.state === 'absent' || session?.baseline_status === 'unavailable') {
    const reason = asText(session?.baseline_unavailable_reason) || (protocol.state === 'absent' ? 'legacy_session' : 'evidence_unavailable');
    return {
      state: 'unavailable',
      label: 'Prior-knowledge evidence unavailable',
      detail: reason === 'legacy_session'
        ? 'This session predates source-backed baseline reporting.'
        : (BASELINE_REASON_LABELS[reason] || 'A clean pre-instruction baseline was not available.'),
      unavailable_reason: reason,
      observed,
      supporting_evidence,
    };
  }
  if (
    session?.baseline_status === 'partial'
    || evaluatedCount === 0
    || (intendedCount != null && evaluatedCount < intendedCount)
  ) {
    return {
      state: 'incomplete',
      label: 'Baseline incomplete',
      detail: evaluatedCount > 0
        ? `${evaluatedCount} of ${intendedCount || evaluatedCount} baseline first responses were recorded.`
        : 'A complete pre-instruction response chain was not recorded.',
      unavailable_reason: asText(session?.baseline_unavailable_reason),
      observed,
      supporting_evidence,
    };
  }
  if (correctCount === evaluatedCount) {
    return {
      state: 'demonstrated',
      label: 'Prior knowledge observed',
      detail: `${correctCount} of ${evaluatedCount} baseline first responses were correct before instruction.`,
      unavailable_reason: null,
      observed,
      supporting_evidence,
    };
  }
  return {
    state: 'not_demonstrated',
    label: 'Not demonstrated before instruction',
    detail: `${correctCount} of ${evaluatedCount} baseline first responses were correct.`,
    unavailable_reason: null,
    observed,
    supporting_evidence,
  };
}

function summarizeIndependentEvidence(session, events, interventions) {
  const results = events.filter((event) => event.event_type === STAGE_6_EVIDENCE_EVENT_TYPES.MASTERY_CHECK_RESULT);
  const protocol = protocolState([
    session?.mastery_protocol_version,
    ...results.map((event) => event.mastery_protocol_version),
  ], INDEPENDENT_MASTERY_PROTOCOL_VERSION);
  const supporting_evidence = results.map(supportingFact);
  const outcomes = new Set(results.map((event) => event.mastery_outcome).filter(Boolean));
  const firstNeedsRecovery = results.find((event) => event.mastery_outcome === MASTERY_OUTCOMES.NEEDS_RECOVERY) || null;
  const recoverySuccess = results.find((event) => event.mastery_outcome === MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY) || null;
  const recovery_chain = [];
  if (firstNeedsRecovery) {
    recovery_chain.push({
      state: 'not_demonstrated',
      label: 'Initial independent check: not demonstrated',
      occurred_at: asTimestamp(firstNeedsRecovery.occurred_at),
      evidence_kind: 'observed',
    });
  }
  if (recoverySuccess) {
    recovery_chain.push({
      state: 'recovery',
      label: 'Recovery teaching occurred',
      occurred_at: asTimestamp(recoverySuccess.occurred_at),
      evidence_kind: 'inferred_from_structured_outcome',
    });
    recovery_chain.push({
      state: 'demonstrated',
      label: 'Fresh verification: demonstrated independently',
      occurred_at: asTimestamp(recoverySuccess.occurred_at),
      evidence_kind: 'observed',
    });
  }

  if (protocol.state === 'unknown') {
    return {
      state: 'unknown_protocol',
      label: 'Independent evidence recorded',
      detail: 'Detailed interpretation is unavailable for this protocol version.',
      unavailable_reason: 'unknown_protocol',
      recovery_chain,
      supporting_evidence,
    };
  }
  if (protocol.state === 'absent') {
    return {
      state: 'unavailable',
      label: 'Independent evidence unavailable',
      detail: 'This session predates source-backed independent checks.',
      unavailable_reason: 'legacy_session',
      recovery_chain,
      supporting_evidence,
    };
  }
  if (outcomes.has(MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY)) {
    return {
      state: 'independent_success_after_recovery',
      label: 'Demonstrated independently after recovery',
      detail: 'The initial held-out check was unsuccessful; a different held-out item was later answered correctly without disqualifying assistance.',
      unavailable_reason: null,
      recovery_chain,
      supporting_evidence,
    };
  }
  if (outcomes.has(MASTERY_OUTCOMES.INDEPENDENT_SUCCESS)) {
    const mixed = outcomes.has(MASTERY_OUTCOMES.NEEDS_RECOVERY);
    return {
      state: 'independent_success',
      label: 'Demonstrated independently',
      detail: mixed
        ? 'Independent performance was observed on a clean held-out item; another independent check was not demonstrated.'
        : 'A correct first response was recorded on a clean held-out item without disqualifying assistance.',
      unavailable_reason: null,
      recovery_chain,
      supporting_evidence,
    };
  }
  if (outcomes.has(MASTERY_OUTCOMES.ASSISTED_SUCCESS)) {
    const assisted = results.find((event) => event.mastery_outcome === MASTERY_OUTCOMES.ASSISTED_SUCCESS);
    return {
      state: 'assisted_success',
      label: 'Correct with assistance',
      detail: 'A correct response was recorded, but assistance or retry conditions prevented an independent classification.',
      unavailable_reason: asText(assisted?.independence_reason),
      recovery_chain,
      supporting_evidence,
    };
  }
  if (outcomes.has(MASTERY_OUTCOMES.NEEDS_RECOVERY)) {
    return {
      state: 'needs_recovery',
      label: 'Independent demonstration not yet established',
      detail: 'The clean held-out first response was not correct, and no later fresh independent verification succeeded in this record.',
      unavailable_reason: null,
      recovery_chain,
      supporting_evidence,
    };
  }
  const unavailable = results.find((event) => event.mastery_outcome === MASTERY_OUTCOMES.UNAVAILABLE);
  const timelineChanged = interventions.some((item) => item.kind === 'timeline_jump');
  const reason = asText(unavailable?.independence_reason) || (timelineChanged ? 'timeline_jump' : 'result_not_recorded');
  return {
    state: 'unavailable',
    label: 'Independent evidence unavailable',
    detail: timelineChanged
      ? 'The facilitator changed the session path, and no qualifying independent-check result was recorded.'
      : (MASTERY_REASON_LABELS[reason] || 'No qualifying independent-check result was recorded.'),
    unavailable_reason: reason,
    recovery_chain,
    supporting_evidence,
  };
}

export function formatRetentionDelay(delaySeconds) {
  const total = Number(delaySeconds);
  if (!Number.isFinite(total) || total < 0) return null;
  let remaining = Math.floor(total);
  const units = [
    ['week', 7 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];
  const parts = [];
  for (const [name, seconds] of units) {
    const count = Math.floor(remaining / seconds);
    if (count > 0) {
      parts.push(`${count} ${name}${count === 1 ? '' : 's'}`);
      remaining -= count * seconds;
    }
    if (parts.length === 2) break;
  }
  return parts.length ? parts.join(', ') : '0 seconds';
}

function summarizeRetention(session, events) {
  const results = events.filter((event) => event.event_type === STAGE_7_EVIDENCE_EVENT_TYPES.RETENTION_CHECK_RESULT);
  const protocol = protocolState([
    session?.retention_protocol_version,
    ...results.map((event) => event.retention_protocol_version),
  ], RETENTION_PROTOCOL_VERSION);
  const supporting_evidence = results.map(supportingFact);
  const latest = results.at(-1) || null;
  const prior_independent_evidence = latest?.retention_anchor_mastery_check_id
    ? {
        state: 'observed',
        label: 'Earlier independent demonstration observed',
        mastery_check_id: asText(latest.retention_anchor_mastery_check_id),
        detail: 'The delayed check explicitly references a qualifying Stage 6 independent-result anchor.',
      }
    : null;

  if (protocol.state === 'unknown') {
    return {
      state: 'unknown_protocol',
      label: 'Retention evidence recorded',
      detail: 'Detailed interpretation is unavailable for this protocol version.',
      delay_seconds: asFiniteNumber(latest?.retention_delay_seconds),
      delay_label: formatRetentionDelay(latest?.retention_delay_seconds),
      unavailable_reason: 'unknown_protocol',
      prior_independent_evidence,
      supporting_evidence,
    };
  }
  if (protocol.state === 'absent') {
    return {
      state: 'unavailable',
      label: 'Retention evidence unavailable',
      detail: 'This session predates source-backed delayed retention checks.',
      delay_seconds: null,
      delay_label: null,
      unavailable_reason: 'legacy_session',
      prior_independent_evidence,
      supporting_evidence,
    };
  }
  if (!latest) {
    return {
      state: 'not_measured',
      label: 'Retention not yet measured',
      detail: 'No qualifying delayed retention result has been recorded. No future check is implied or scheduled.',
      delay_seconds: null,
      delay_label: null,
      unavailable_reason: null,
      prior_independent_evidence: null,
      supporting_evidence,
    };
  }

  const delaySeconds = asFiniteNumber(latest.retention_delay_seconds);
  const delayLabel = formatRetentionDelay(delaySeconds);
  if (latest.retention_outcome === RETENTION_OUTCOMES.RETAINED) {
    return {
      state: 'retained',
      label: delayLabel ? `Retained after ${delayLabel}` : 'Retained at this interval',
      detail: 'A new held-out item was answered correctly without disqualifying assistance before review.',
      delay_seconds: delaySeconds,
      delay_label: delayLabel,
      unavailable_reason: null,
      prior_independent_evidence,
      supporting_evidence,
    };
  }
  if (latest.retention_outcome === RETENTION_OUTCOMES.NEEDS_REVIEW) {
    return {
      state: 'needs_review',
      label: delayLabel ? `Review recommended after ${delayLabel}` : 'Review recommended',
      detail: 'The learner did not independently demonstrate the target at the delayed check; earlier independent evidence remains part of the record.',
      delay_seconds: delaySeconds,
      delay_label: delayLabel,
      unavailable_reason: null,
      prior_independent_evidence,
      supporting_evidence,
    };
  }
  if (latest.retention_outcome === RETENTION_OUTCOMES.ASSISTED_REVIEW) {
    return {
      state: 'assisted_review',
      label: 'Retention not independently established',
      detail: delayLabel
        ? `The delayed check occurred after ${delayLabel}, but assistance affected independent qualification.`
        : 'Assistance affected the delayed check before an independent result was established.',
      delay_seconds: delaySeconds,
      delay_label: delayLabel,
      unavailable_reason: asText(latest.retention_qualification_reason),
      prior_independent_evidence,
      supporting_evidence,
    };
  }
  const reason = asText(latest.retention_qualification_reason) || 'evidence_unavailable';
  return {
    state: 'unavailable',
    label: 'Retention evidence unavailable',
    detail: RETENTION_REASON_LABELS[reason] || 'The delayed check could not support a retention interpretation.',
    delay_seconds: delaySeconds,
    delay_label: delayLabel,
    unavailable_reason: reason,
    prior_independent_evidence,
    supporting_evidence,
  };
}

function assistanceEntry(event) {
  let label = ASSISTANCE_EVENT_LABELS[event.event_type];
  if (event.event_type === STAGE_2_EVIDENCE_EVENT_TYPES.ASK_USED && event?.payload?.current_answer_requested === true) {
    label = 'Asked for the answer';
  }
  return {
    type: event.event_type,
    label,
    occurred_at: asTimestamp(event.occurred_at),
    phase: asText(event.phase),
    item: itemReference(event),
  };
}

function summarizeAssistance(evidenceSession, events, independentEvidence, retention) {
  const assistanceEvents = events
    .filter((event) => ASSISTANCE_EVENT_LABELS[event.event_type])
    .map(assistanceEntry);
  if (
    independentEvidence.state === 'independent_success_after_recovery'
    && !assistanceEvents.some((event) => event.type === 'recovery_derived')
  ) {
    assistanceEvents.push({
      type: 'recovery_derived',
      label: 'Recovery teaching occurred',
      occurred_at: independentEvidence.recovery_chain.find((item) => item.state === 'recovery')?.occurred_at || null,
      phase: 'test',
      item: null,
    });
  }
  if (
    (independentEvidence.state === 'assisted_success' || retention.state === 'assisted_review')
    && assistanceEvents.length === 0
  ) {
    assistanceEvents.push({
      type: 'qualification_assisted',
      label: 'Assistance affected independent qualification',
      occurred_at: null,
      phase: null,
      item: null,
    });
  }
  const accessibility_actions = events
    .filter((event) => event.event_type === STAGE_2_EVIDENCE_EVENT_TYPES.REPEAT_USED)
    .map((event) => ({
      type: 'verbatim_repeat',
      label: 'Prompt repeated verbatim',
      occurred_at: asTimestamp(event.occurred_at),
      phase: asText(event.phase),
      classification: 'accessibility_or_control',
    }));

  if (!evidenceSession) {
    return {
      state: 'unavailable',
      label: 'Assistance evidence unavailable',
      detail: 'This session predates structured assistance reporting.',
      events: assistanceEvents,
      accessibility_actions,
    };
  }
  return {
    state: assistanceEvents.length ? 'observed' : 'none_observed',
    label: assistanceEvents.length ? 'Assistance observed' : 'No qualifying help observed',
    detail: assistanceEvents.length
      ? `${assistanceEvents.length} notable help or recovery event${assistanceEvents.length === 1 ? '' : 's'} recorded.`
      : 'No hints, answer reveals, Ask assistance, generated visual assistance, or recovery teaching were recorded.',
    events: assistanceEvents,
    accessibility_actions,
  };
}

function summarizeInterventions(events) {
  return events.flatMap((event) => {
    if (event.event_type === STAGE_2_EVIDENCE_EVENT_TYPES.TIMELINE_JUMP) {
      const from = asText(event?.payload?.from_phase) || asText(event.phase) || 'the current phase';
      const target = asText(event?.payload?.target_phase) || 'another phase';
      return [{
        kind: 'timeline_jump',
        label: `Facilitator moved from ${from} to ${target}.`,
        occurred_at: asTimestamp(event.occurred_at),
        from_phase: from,
        target_phase: target,
      }];
    }
    if (event.event_type === STAGE_2_EVIDENCE_EVENT_TYPES.QUESTION_SET_REFRESHED) {
      return [{
        kind: 'question_set_refreshed',
        label: 'Facilitator refreshed the question set.',
        occurred_at: asTimestamp(event.occurred_at),
        from_phase: null,
        target_phase: null,
      }];
    }
    return [];
  });
}

function summarizeScore(events) {
  const ended = events.filter((event) => event.event_type === 'session_ended').at(-1);
  const value = asFiniteNumber(ended?.payload?.test_percentage);
  if (value == null) return null;
  return {
    label: 'Test score',
    value,
    unit: 'percent',
    source: 'session_ended',
    detail: 'This score is shown separately and is not reinterpreted as independent evidence.',
  };
}

function summarizeCompleteness(evidenceSession, facets) {
  if (!evidenceSession || evidenceSession.evidence_status === MASTERY_EVIDENCE_STATUSES.UNAVAILABLE) {
    return {
      state: 'unavailable',
      label: 'Structured evidence unavailable',
      detail: 'Available lesson and transcript history remain useful, but Stage 5-7 evidence was not recorded.',
    };
  }
  const hasUnknownProtocol = facets.some((facet) => facet.state === 'unknown_protocol');
  if (evidenceSession.evidence_status === MASTERY_EVIDENCE_STATUSES.PARTIAL || hasUnknownProtocol) {
    return {
      state: 'partial',
      label: 'Evidence record partial',
      detail: hasUnknownProtocol
        ? 'Evidence was recorded, but at least one protocol version cannot be interpreted by this reporting version.'
        : 'Some evidence writes or finalization steps were not confirmed.',
    };
  }
  return {
    state: 'complete',
    label: 'Evidence record complete',
    detail: 'The evidence writer confirmed this session record. This does not mean every outcome was measured.',
  };
}

function buildInterpretations(baseline, independentEvidence, retention) {
  const interpretations = [];
  const independentObserved = [
    'independent_success',
    'independent_success_after_recovery',
  ].includes(independentEvidence.state);

  if (baseline.state === 'demonstrated' && independentObserved) {
    interpretations.push({
      kind: 'prior_knowledge_repeated',
      evidence_kind: 'inferred',
      label: 'The learner demonstrated the target before instruction and again at a later independent check.',
    });
  } else if (baseline.state === 'not_demonstrated' && independentObserved) {
    interpretations.push({
      kind: 'performance_improved',
      evidence_kind: 'inferred',
      label: 'Independent performance improved between the baseline and the later check.',
    });
  }
  if (independentEvidence.state === 'independent_success_after_recovery') {
    interpretations.push({
      kind: 'recovery_before_success',
      evidence_kind: 'inferred',
      label: 'The learner required recovery before later independent success.',
    });
  }
  if (retention.state === 'needs_review' && independentObserved) {
    interpretations.push({
      kind: 'prior_success_later_review',
      evidence_kind: 'inferred',
      label: 'Earlier independent performance remains observed; the delayed check suggests review may be useful.',
    });
  }
  return interpretations;
}

function buildOptions(independentEvidence, retention) {
  if (retention.state === 'needs_review') {
    return [{ kind: 'consider_review', evidence_kind: 'proposed', label: 'Consider a review session.' }];
  }
  if (independentEvidence.state === 'assisted_success') {
    return [{ kind: 'consider_future_independent_check', evidence_kind: 'proposed', label: 'Consider another independent check in a future session.' }];
  }
  if (independentEvidence.state === 'needs_recovery') {
    return [{ kind: 'consider_review_then_check', evidence_kind: 'proposed', label: 'Consider more review followed by a fresh independent check.' }];
  }
  if (
    ['independent_success', 'independent_success_after_recovery'].includes(independentEvidence.state)
    && retention.state === 'not_measured'
  ) {
    return [{ kind: 'continue_normally', evidence_kind: 'proposed', label: 'Continue normally; retention has not yet been measured.' }];
  }
  return [];
}

function buildTarget(events) {
  const conceptIds = Array.from(new Set(events.map((event) => asText(event.concept_id)).filter(Boolean)));
  if (conceptIds.length === 1) {
    return { scope: 'concept', concept_id: conceptIds[0], concept_ids: conceptIds };
  }
  if (conceptIds.length > 1) {
    return { scope: 'multiple_concepts', concept_id: null, concept_ids: conceptIds };
  }
  return { scope: 'lesson', concept_id: null, concept_ids: [] };
}

function uniqueItemReferences(events) {
  const seen = new Set();
  const references = [];
  for (const event of events) {
    const reference = itemReference(event);
    const key = reference.event_id
      || `${reference.item_exposure_id || ''}:${reference.stable_item_id || ''}:${reference.occurred_at || ''}`;
    if (!key || seen.has(key)) continue;
    if (!reference.stable_item_id && !reference.item_exposure_id && !reference.concept_id) continue;
    seen.add(key);
    references.push(reference);
  }
  return references;
}

export function aggregateFacilitatorEvidenceSession({ trackedSession = {}, evidenceSession = null, events = [] } = {}) {
  const orderedEvents = asArray(events).slice().sort(compareEvents);
  const interventions = summarizeInterventions(orderedEvents);
  const baseline = summarizeBaseline(evidenceSession, orderedEvents);
  const independent_evidence = summarizeIndependentEvidence(evidenceSession, orderedEvents, interventions);
  const retention = summarizeRetention(evidenceSession, orderedEvents);
  const assistance = summarizeAssistance(evidenceSession, orderedEvents, independent_evidence, retention);
  const completeness = summarizeCompleteness(evidenceSession, [baseline, independent_evidence, retention]);
  const startedAt = asTimestamp(evidenceSession?.started_at || trackedSession?.started_at);
  const endedAt = asTimestamp(evidenceSession?.ended_at || trackedSession?.ended_at);
  const durationSeconds = startedAt && endedAt
    ? Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000))
    : null;

  return {
    report_version: FACILITATOR_EVIDENCE_REPORT_VERSION,
    session: {
      id: asText(evidenceSession?.session_id || trackedSession?.id),
      browser_session_id: asText(evidenceSession?.browser_session_id || trackedSession?.session_id),
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      completion_state: endedAt ? 'ended' : 'in_progress',
    },
    lesson: {
      key: asText(evidenceSession?.stable_lesson_key || evidenceSession?.lesson_key || trackedSession?.lesson_id),
      source_key: asText(evidenceSession?.lesson_key || trackedSession?.lesson_id),
      id: asText(evidenceSession?.lesson_id || trackedSession?.lesson_id),
      source: asText(evidenceSession?.lesson_source),
      version_id: asText(evidenceSession?.lesson_version_id),
    },
    target: buildTarget(orderedEvents),
    completeness,
    baseline,
    assistance,
    independent_evidence,
    retention,
    score: summarizeScore(orderedEvents),
    interventions,
    interpretations: buildInterpretations(baseline, independent_evidence, retention),
    options: buildOptions(independent_evidence, retention),
    provenance: {
      evidence_session_id: asText(evidenceSession?.id),
      evidence_schema_version: asText(evidenceSession?.schema_version),
      lesson_identity_version: asText(evidenceSession?.lesson_identity_version),
      lesson_version_id: asText(evidenceSession?.lesson_version_id),
      protocols: {
        teaching: asText(evidenceSession?.teaching_protocol_version),
        assessment_isolation: asText(evidenceSession?.assessment_isolation_version),
        baseline: asText(evidenceSession?.baseline_protocol_version),
        independent_mastery: asText(evidenceSession?.mastery_protocol_version),
        retention: asText(evidenceSession?.retention_protocol_version),
      },
      item_references: uniqueItemReferences(orderedEvents),
    },
  };
}

export function compareTrackedSessionsNewestFirst(left, right) {
  const leftTime = Date.parse(left?.started_at || '') || 0;
  const rightTime = Date.parse(right?.started_at || '') || 0;
  if (leftTime !== rightTime) return rightTime - leftTime;
  return String(right?.id || '').localeCompare(String(left?.id || ''));
}

export function encodeReportCursor(session = {}) {
  const startedAt = asTimestamp(session.started_at);
  const id = asText(session.id);
  if (!startedAt || !id) return null;
  return Buffer.from(JSON.stringify({ started_at: startedAt, id }), 'utf8').toString('base64url');
}

export function decodeReportCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    const startedAt = asTimestamp(parsed?.started_at);
    const id = asText(parsed?.id);
    if (!startedAt || !id || !/^[A-Za-z0-9-]+$/.test(id)) throw new Error('Invalid cursor');
    return { started_at: startedAt, id };
  } catch {
    throw new Error('Invalid evidence history cursor');
  }
}

export function isSessionBeforeCursor(session, cursor) {
  if (!cursor) return true;
  const sessionTime = Date.parse(session?.started_at || '') || 0;
  const cursorTime = Date.parse(cursor.started_at || '') || 0;
  if (sessionTime !== cursorTime) return sessionTime < cursorTime;
  return String(session?.id || '').localeCompare(String(cursor.id || '')) < 0;
}
