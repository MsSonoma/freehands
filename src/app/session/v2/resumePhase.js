const RESTORED_PHASE_ORDER = ['discussion', 'exercise', 'worksheet', 'test', 'closing'];

export function normalizeResumePhase(phase) {
  if (!phase || typeof phase !== 'string') return null;
  const raw = phase.trim().toLowerCase();
  if (!raw) return null;

  if (raw === 'discussion') return 'discussion';
  if (raw === 'exercise') return 'exercise';
  if (raw === 'worksheet') return 'worksheet';
  if (raw === 'test' || raw === 'grading' || raw === 'congrats') return 'test';
  if (raw === 'complete' || raw === 'closing') return 'closing';

  // Legacy Teaching/Comprehension are no longer normal learner-flow phases.
  // The restored product handles pre-exercise understanding in Socratic Discussion.
  // If legacy progress cannot be translated exactly, resume at Discussion rather
  // than skipping unfinished understanding work.
  if (raw === 'teaching' || raw === 'comprehension') return 'discussion';

  return null;
}

function rankPhase(phase) {
  const normalized = normalizeResumePhase(phase);
  const idx = RESTORED_PHASE_ORDER.indexOf(normalized);
  return idx === -1 ? -1 : idx;
}

export function deriveResumePhaseFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;

  const candidates = new Set();
  const addCandidate = (value) => {
    const normalized = normalizeResumePhase(value);
    if (normalized) candidates.add(normalized);
  };

  // Current V2 schema.
  addCandidate(snapshot.currentPhase);
  const completed = Array.isArray(snapshot.completedPhases) ? snapshot.completedPhases : [];
  completed.forEach(addCandidate);
  const phaseData = snapshot.phaseData && typeof snapshot.phaseData === 'object'
    ? Object.keys(snapshot.phaseData)
    : [];
  phaseData.forEach(addCandidate);

  // Legacy persisted schema verified in production storage.
  addCandidate(snapshot.resume?.phase);
  addCandidate(snapshot.phase);

  if (!candidates.size) return null;

  let best = null;
  for (const candidate of candidates) {
    if (best === null || rankPhase(candidate) > rankPhase(best)) {
      best = candidate;
    }
  }

  return best;
}

export function canRestoreSnapshotForExecution({
  snapshot,
  executionAuthorization,
  authorizedOccurrenceId,
  authorizedResumeBrowserSessionId,
  subject,
} = {}) {
  if (!snapshot || executionAuthorization !== 'allowed') return false;
  if (subject === 'demo' || String(authorizedOccurrenceId || '').startsWith('legacy:')) return true;
  return Boolean(
    authorizedResumeBrowserSessionId
    && snapshot.sessionId
    && snapshot.sessionId === authorizedResumeBrowserSessionId
  );
}

export function rejectSnapshotForActiveExecution(service) {
  service?.clearLoadedSnapshot?.();
}
