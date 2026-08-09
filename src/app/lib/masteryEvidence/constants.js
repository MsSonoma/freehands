export const MASTERY_EVIDENCE_SCHEMA_VERSION = 'mastery-evidence-v1';

export const MASTERY_EVIDENCE_STATUSES = Object.freeze({
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  UNAVAILABLE: 'unavailable',
});

export const STAGE_1_EVIDENCE_EVENT_TYPES = Object.freeze({
  SESSION_STARTED: 'session_started',
  PHASE_TRANSITION: 'phase_transition',
  SESSION_ENDED: 'session_ended',
});

export const STAGE_2_EVIDENCE_EVENT_TYPES = Object.freeze({
  ITEM_PRESENTED: 'item_presented',
  LEARNER_RESPONSE: 'learner_response',
  ANSWER_EVALUATED: 'answer_evaluated',
  HINT_GIVEN: 'hint_given',
  RETRY_REQUESTED: 'retry_requested',
  ANSWER_REVEALED: 'answer_revealed',
  ASK_USED: 'ask_used',
  REPEAT_USED: 'repeat_used',
  VISUAL_AID_USED: 'visual_aid_used',
  QUESTION_SET_REFRESHED: 'question_set_refreshed',
  TIMELINE_JUMP: 'timeline_jump',
});

export const MASTERY_EVIDENCE_EVENT_TYPES = Object.freeze({
  ...STAGE_1_EVIDENCE_EVENT_TYPES,
  ...STAGE_2_EVIDENCE_EVENT_TYPES,
});

export const STAGE_1_PHASES = Object.freeze([
  'idle',
  'discussion',
  'teaching',
  'comprehension',
  'exercise',
  'worksheet',
  'test',
  'closing',
  'complete',
]);

export function isMasteryEvidenceEnabled(env = process.env) {
  const raw = String(
    env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED
      ?? env.MASTERY_EVIDENCE_ENABLED
      ?? ''
  ).trim().toLowerCase();

  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}
