// Authoritative per-session work-timer reward state. Deliberately separate from mastery.
export const WORK_TIMER_STYLES = Object.freeze({ COUNTDOWN: 'countdown', COUNTUP: 'countup' });

function whole(value, fallback, minimum, maximum) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(minimum, Math.min(maximum, Math.floor(n))) : fallback;
}

export function normalizeWorkTimerSettings(profile = {}, teacher = 'sonoma') {
  const webb = teacher === 'webb';
  const style = profile[webb ? 'webb_work_timer_style' : 'sonoma_work_timer_style'];
  return {
    enabled: !webb || profile.webb_response_pacing_enabled !== false,
    style: style === 'countdown' || style === 'countup' ? style : (webb ? 'countup' : 'countdown'),
    stallAllowance: whole(profile[webb ? 'webb_stall_allowance' : 'sonoma_stall_allowance'], 2, 0, 99),
    reminderIntervalMin: whole(profile[webb ? 'webb_response_reminder_interval_min' : 'sonoma_response_reminder_interval_min'], 2, 1, 30),
    researchWorkMin: whole(profile.webb_research_work_min, 30, 1, 240),
    writingWorkMin: whole(profile.webb_writing_work_min, 45, 1, 240),
  };
}

export function createWorkTimerReward(profile = {}, teacher = 'sonoma') {
  return { teacher, settings: normalizeWorkTimerSettings(profile, teacher), stalls: [], corrections: [], turnTimes: [], forfeitedPlayPhases: [], deadlineWarningStages: {}, startedAt: new Date().toISOString() };
}

export function restoreWorkTimerReward(snapshot, fallback, teacher = 'sonoma') {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.teacher !== teacher || !snapshot.settings) return fallback;
  return {
    ...fallback,
    teacher,
    settings: {
      ...normalizeWorkTimerSettings({}, teacher),
      ...snapshot.settings,
    },
    stalls: Array.isArray(snapshot.stalls) ? snapshot.stalls.filter(item => item && typeof item.turnId === 'string') : [],
    corrections: Array.isArray(snapshot.corrections) ? snapshot.corrections.filter(item => item && typeof item.turnId === 'string') : [],
    turnTimes: Array.isArray(snapshot.turnTimes) ? snapshot.turnTimes.filter(item => item && typeof item.turnId === 'string') : [],
    forfeitedPlayPhases: Array.isArray(snapshot.forfeitedPlayPhases) ? snapshot.forfeitedPlayPhases.filter(phase => ['discussion', 'comprehension', 'exercise', 'worksheet'].includes(phase)) : [],
    deadlineWarningStages: snapshot.deadlineWarningStages && typeof snapshot.deadlineWarningStages === 'object' && !Array.isArray(snapshot.deadlineWarningStages) ? snapshot.deadlineWarningStages : {},
    startedAt: snapshot.startedAt || fallback.startedAt,
  };
}

export function forfeitNextPlayBreak(reward, phase) {
  if (!reward || !['discussion', 'comprehension', 'exercise', 'worksheet'].includes(phase) || reward.forfeitedPlayPhases?.includes(phase)) return reward;
  return { ...reward, forfeitedPlayPhases: [...(reward.forfeitedPlayPhases || []), phase] };
}

export function nextPlayBreakForfeited(reward, phase) {
  return reward?.forfeitedPlayPhases?.includes(phase) === true;
}

export function recordWorkTimerStall(reward, turn, elapsedSeconds = 0) {
  if (!reward || !turn?.id || reward.stalls.some(item => item.turnId === turn.id)) return reward;
  return {
    ...reward,
    stalls: [...reward.stalls, { turnId: turn.id, stage: turn.stage || turn.phase || null, elapsedSeconds: Math.max(0, Math.floor(Number(elapsedSeconds) || 0)), recordedAt: new Date().toISOString() }],
  };
}

export function recordWebbWorkTurn(reward, turn, elapsedSeconds = 0) {
  if (!reward || !turn?.id || reward.turnTimes.some(item => item.turnId === turn.id)) return reward;
  const stage = turn.stage === 'writing' ? 'writing' : 'research';
  return { ...reward, turnTimes: [...reward.turnTimes, { turnId: turn.id, stage, elapsedSeconds: Math.max(0, Math.floor(Number(elapsedSeconds) || 0)) }] };
}

export function correctWorkTimerStall(reward, turnId, reason, now = new Date().toISOString()) {
  const cleanReason = String(reason || '').trim();
  if (!reward || cleanReason.length < 8 || !reward.stalls.some(stall => stall.turnId === turnId)) return reward;
  if (reward.corrections.some(entry => entry.turnId === turnId)) return reward;
  return { ...reward, corrections: [...reward.corrections, { turnId, reason: cleanReason, correctedAt: now, source: 'facilitator' }] };
}

export function getWorkTimerRewardStatus(reward, { countdownOnTimePhases = 0 } = {}) {
  const settings = reward?.settings || normalizeWorkTimerSettings({}, reward?.teacher);
  const corrected = new Set((reward?.corrections || []).map(row => row.turnId));
  const stalls = (reward?.stalls || []).filter(row => !corrected.has(row.turnId));
  const allowance = settings.stallAllowance;
  if (settings.enabled === false) return { style: settings.style, eligible: false, disabled: true, stallCount: stalls.length, allowance };
  if (settings.style === 'countup') {
    return { style: 'countup', eligible: stalls.length <= allowance, stallCount: stalls.length, allowance, stalls };
  }
  if (reward?.teacher === 'webb') {
    const totals = { research: 0, writing: 0 };
    const counts = { research: 0, writing: 0 };
    for (const turn of reward?.turnTimes || []) {
      if (!(turn.stage in totals)) continue;
      totals[turn.stage] += Math.max(0, Number(turn.elapsedSeconds) || 0);
      counts[turn.stage] += 1;
    }
    const eligible = counts.research > 0 && counts.writing > 0 &&
      totals.research <= settings.researchWorkMin * 60 && totals.writing <= settings.writingWorkMin * 60;
    return { style: 'countdown', eligible, totals, counts, limits: { research: settings.researchWorkMin * 60, writing: settings.writingWorkMin * 60 } };
  }
  return { style: 'countdown', eligible: countdownOnTimePhases >= 3, countdownOnTimePhases };
}
