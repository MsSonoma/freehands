export const TIMER_PACE_COLORS = Object.freeze({
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
});

export function getTimerPaceColor({
  timerType = 'play',
  elapsedSeconds = 0,
  totalSeconds = 0,
  remainingSeconds = null,
  phaseProgress = 0,
} = {}) {
  if (timerType !== 'work') return TIMER_PACE_COLORS.green;

  const total = Number(totalSeconds);
  const elapsed = Number(elapsedSeconds);
  const hasExplicitRemaining = remainingSeconds !== null
    && remainingSeconds !== undefined
    && Number.isFinite(Number(remainingSeconds));
  const remaining = hasExplicitRemaining ? Number(remainingSeconds) : total - elapsed;

  if (!Number.isFinite(total) || total <= 0 || remaining <= 0) {
    return TIMER_PACE_COLORS.red;
  }

  const elapsedPercent = Math.max(0, Math.min(100, (elapsed / total) * 100));
  const workPercent = Math.max(0, Math.min(100, Number(phaseProgress) || 0));
  const paceDelta = workPercent - elapsedPercent;

  if (paceDelta < -15) return TIMER_PACE_COLORS.red;
  if (paceDelta < -5) return TIMER_PACE_COLORS.yellow;
  return TIMER_PACE_COLORS.green;
}