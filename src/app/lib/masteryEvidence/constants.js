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
