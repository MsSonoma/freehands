// Learner-visible work clock. It measures only the current exchange, never a phase.
// Mastery, countdown phase credits, reminders and stalls use their own clocks.
export function startResponseInterval(nowMs = Date.now()) {
  return { startedAtMs: nowMs, pausedMs: 0, pausedAtMs: null };
}

export function pauseResponseInterval(interval, nowMs = Date.now()) {
  if (!interval || interval.pausedAtMs !== null) return interval;
  return { ...interval, pausedAtMs: nowMs };
}

export function resumeResponseInterval(interval, nowMs = Date.now()) {
  if (!interval || interval.pausedAtMs === null) return interval;
  return {
    ...interval,
    pausedMs: interval.pausedMs + Math.max(0, nowMs - interval.pausedAtMs),
    pausedAtMs: null,
  };
}

export function responseIntervalElapsedSeconds(interval, nowMs = Date.now()) {
  if (!interval || !Number.isFinite(interval.startedAtMs)) return 0;
  const endMs = interval.pausedAtMs ?? nowMs;
  return Math.max(0, Math.floor((endMs - interval.startedAtMs - interval.pausedMs) / 1000));
}

export function responseIntervalRemainingSeconds(interval, durationSeconds, nowMs = Date.now()) {
  return Math.max(0, Math.floor(Number(durationSeconds) || 0) - responseIntervalElapsedSeconds(interval, nowMs));
}
