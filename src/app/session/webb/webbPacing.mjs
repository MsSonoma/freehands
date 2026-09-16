export const WEBB_PACING_REMINDERS = Object.freeze({
  1: "I'm right here if you need help. Just ask me if you're stuck.",
  2: "If you need help, it's important to tell me what you're having trouble with so I can help.",
  3: "Remember to pay attention to how much time you're spending on this lesson. If you're stuck, ask me and we'll work through it.",
  4: "We need to get back to work soon. If I still don't hear from you, I'll need to let your facilitator know.",
})

export const DEFAULT_WEBB_PACING_SETTINGS = Object.freeze({
  responsePacingEnabled: true,
  reminderIntervalMin: 2,
  playTimesEnabled: true,
  playTimeMin: 5,
  researchMidpointEnabled: true,
  transitionEnabled: true,
  writingMidpointEnabled: true,
})

function boundedNumber(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

export function normalizeWebbPacingSettings(learner = {}) {
  return {
    responsePacingEnabled: learner?.webb_response_pacing_enabled !== false,
    reminderIntervalMin: boundedNumber(
      learner?.webb_response_reminder_interval_min,
      DEFAULT_WEBB_PACING_SETTINGS.reminderIntervalMin,
      1,
      30,
    ),
    playTimesEnabled: learner?.webb_play_times_enabled !== false,
    playTimeMin: boundedNumber(
      learner?.webb_play_time_min,
      DEFAULT_WEBB_PACING_SETTINGS.playTimeMin,
      1,
      60,
    ),
    researchMidpointEnabled: learner?.webb_play_research_midpoint_enabled !== false,
    transitionEnabled: learner?.webb_play_transition_enabled !== false,
    writingMidpointEnabled: learner?.webb_play_writing_midpoint_enabled !== false,
  }
}

export function createWebbResponseTurn({ stage, nowMs = Date.now(), turnId } = {}) {
  const id = String(turnId || '').trim() || `webb-turn-${nowMs}`
  return {
    id,
    stage: stage === 'writing' ? 'writing' : 'research',
    startedAt: new Date(nowMs).toISOString(),
    pausedMs: 0,
    pauseStartedAt: null,
    reminderStage: 0,
    escalated: false,
    notificationDelivered: false,
    lastActivityAt: null,
  }
}

export function pauseWebbResponseTurn(turn, nowMs = Date.now()) {
  if (!turn || turn.pauseStartedAt) return turn
  return { ...turn, pauseStartedAt: new Date(nowMs).toISOString() }
}

export function resumeWebbResponseTurn(turn, nowMs = Date.now()) {
  if (!turn?.pauseStartedAt) return turn
  const pausedAt = Date.parse(turn.pauseStartedAt)
  const pauseDelta = Number.isFinite(pausedAt) ? Math.max(0, nowMs - pausedAt) : 0
  return {
    ...turn,
    pausedMs: Math.max(0, Number(turn.pausedMs || 0)) + pauseDelta,
    pauseStartedAt: null,
  }
}

export function responseElapsedSeconds(turn, nowMs = Date.now()) {
  if (!turn?.startedAt) return 0
  const startedAt = Date.parse(turn.startedAt)
  if (!Number.isFinite(startedAt)) return 0
  const pausedAt = turn.pauseStartedAt ? Date.parse(turn.pauseStartedAt) : null
  const currentPause = Number.isFinite(pausedAt) ? Math.max(0, nowMs - pausedAt) : 0
  const elapsedMs = nowMs - startedAt - Math.max(0, Number(turn.pausedMs || 0)) - currentPause
  return Math.max(0, Math.floor(elapsedMs / 1000))
}

export function reminderStageForElapsed(elapsedSeconds, intervalMinutes) {
  const intervalSeconds = boundedNumber(intervalMinutes, 2, 1, 30) * 60
  if (intervalSeconds <= 0) return 0
  return Math.min(5, Math.max(0, Math.floor(Math.max(0, Number(elapsedSeconds || 0)) / intervalSeconds)))
}

export function responseTimerColor(elapsedSeconds, intervalMinutes) {
  const stage = reminderStageForElapsed(elapsedSeconds, intervalMinutes)
  if (stage <= 0) return '#22c55e'
  if (stage === 1) return '#84cc16'
  if (stage === 2) return '#eab308'
  if (stage === 3) return '#f97316'
  return '#ef4444'
}

export function midpointThreshold(total) {
  const count = Math.floor(Number(total || 0))
  return count >= 2 ? Math.ceil(count / 2) : null
}

export function webbPlayDurationSeconds(settings, { goldenKeyActive = false, goldenKeyBonusMin = 0 } = {}) {
  const normalized = settings?.playTimeMin == null ? normalizeWebbPacingSettings({}) : settings
  const base = boundedNumber(normalized.playTimeMin, DEFAULT_WEBB_PACING_SETTINGS.playTimeMin, 1, 60)
  const bonus = goldenKeyActive ? boundedNumber(goldenKeyBonusMin, 0, 0, 60) : 0
  return Math.round((base + bonus) * 60)
}

export function expectsLearnerResponse(text) {
  const value = String(text || '').trim()
  if (!value) return false
  if (/\?\s*$/.test(value)) return true
  return /\b(tell me|explain|describe|show me|what do you|what did you|what would|can you|could you|try again|in your own words|which one|how would|why do you)\b/i.test(value)
}

export function learnerRequestedHelp(text) {
  return /\b(help|stuck|i don't know|i dont know|not sure|don't understand|dont understand|explain|another way)\b/i.test(String(text || ''))
}

export function formatWebbElapsed(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)))
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}