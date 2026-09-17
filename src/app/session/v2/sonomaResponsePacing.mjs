export const SONOMA_RESPONSE_PACING_THRESHOLDS_SECONDS = Object.freeze([45, 90, 150, 240, 300])

export const SONOMA_RESPONSE_PACING_REMINDERS = Object.freeze({
  standard: Object.freeze({
    1: "I'm still here when you're ready. If you need help, I can help.",
    2: "If you're stuck, tell me what you need help with. It's important that you let me know.",
    3: "We need to keep an eye on how long the lesson is taking. Let's get back to work.",
    4: "We need to get back to work. If we don't continue, I'll have to let your facilitator know.",
  }),
  test: Object.freeze({
    1: "I'm still here when you're ready to answer.",
    2: "Take the time you need to think, but make sure you give your answer when you're ready.",
    3: "We need to keep an eye on how long the lesson is taking. Let's get back to the test.",
    4: "We need to get back to the test. If we don't continue, I'll have to let your facilitator know.",
  }),
})

export const SONOMA_RESPONSE_ACTIVITY_SNOOZE_MS = 12000

function toMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : null
}

export function createSonomaResponseTurn({
  phase,
  questionIndex = null,
  itemId = null,
  turnKind = 'question',
  turnId,
  nowMs = Date.now(),
} = {}) {
  const normalizedPhase = String(phase || '').trim().toLowerCase()
  const id = String(turnId || '').trim() || `sonoma-turn-${nowMs}`
  return {
    id,
    phase: normalizedPhase,
    questionIndex: Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : null,
    itemId: itemId == null ? null : String(itemId),
    turnKind: String(turnKind || 'question'),
    startedAt: new Date(nowMs).toISOString(),
    pausedMs: 0,
    pauseStartedAt: null,
    reminderStage: 0,
    escalated: false,
    notificationDelivered: false,
    notificationDeliveredAt: null,
    lastReminderAt: null,
    lastActivityAt: null,
  }
}

export function pauseSonomaResponseTurn(turn, nowMs = Date.now()) {
  if (!turn || turn.pauseStartedAt) return turn
  return { ...turn, pauseStartedAt: new Date(nowMs).toISOString() }
}

export function resumeSonomaResponseTurn(turn, nowMs = Date.now()) {
  if (!turn?.pauseStartedAt) return turn
  const pausedAt = toMillis(turn.pauseStartedAt)
  const pauseDelta = pausedAt == null ? 0 : Math.max(0, nowMs - pausedAt)
  return {
    ...turn,
    pausedMs: Math.max(0, Number(turn.pausedMs || 0)) + pauseDelta,
    pauseStartedAt: null,
  }
}

export function sonomaResponseElapsedSeconds(turn, nowMs = Date.now()) {
  const startedAt = toMillis(turn?.startedAt)
  if (startedAt == null) return 0
  const pausedAt = toMillis(turn?.pauseStartedAt)
  const currentPause = pausedAt == null ? 0 : Math.max(0, nowMs - pausedAt)
  const elapsedMs = nowMs - startedAt - Math.max(0, Number(turn?.pausedMs || 0)) - currentPause
  return Math.max(0, Math.floor(elapsedMs / 1000))
}

export function sonomaReminderStageForElapsed(elapsedSeconds) {
  const elapsed = Math.max(0, Number(elapsedSeconds || 0))
  let stage = 0
  for (let index = 0; index < SONOMA_RESPONSE_PACING_THRESHOLDS_SECONDS.length; index += 1) {
    if (elapsed >= SONOMA_RESPONSE_PACING_THRESHOLDS_SECONDS[index]) stage = index + 1
  }
  return stage
}

export function sonomaReminderForStage(stage, phase) {
  if (!Number.isFinite(Number(stage)) || stage < 1 || stage > 4) return ''
  const group = String(phase || '').toLowerCase() === 'test'
    ? SONOMA_RESPONSE_PACING_REMINDERS.test
    : SONOMA_RESPONSE_PACING_REMINDERS.standard
  return group[Number(stage)] || ''
}

export function isSameSonomaTurnScope(turn, candidate = {}) {
  if (!turn) return false
  const phase = String(candidate.phase || '').trim().toLowerCase()
  const candidateIndex = Number.isFinite(Number(candidate.questionIndex)) ? Number(candidate.questionIndex) : null
  const turnIndex = Number.isFinite(Number(turn.questionIndex)) ? Number(turn.questionIndex) : null
  if (String(turn.phase || '').trim().toLowerCase() !== phase) return false
  if (phase === 'discussion') return true
  return candidateIndex === turnIndex
}

export function markSonomaLearnerActivity(turn, nowMs = Date.now()) {
  if (!turn) return turn
  return { ...turn, lastActivityAt: new Date(nowMs).toISOString() }
}

export function isSonomaActivitySnoozed(turn, nowMs = Date.now(), snoozeMs = SONOMA_RESPONSE_ACTIVITY_SNOOZE_MS) {
  const activityAt = toMillis(turn?.lastActivityAt)
  if (activityAt == null) return false
  return Math.max(0, nowMs - activityAt) < Math.max(0, Number(snoozeMs || 0))
}
export function newSonomaTurnId(nowMs = Date.now()) {
  try {
    if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID()
    if (globalThis?.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16)
      globalThis.crypto.getRandomValues(bytes)
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  } catch {}
  const seed = Math.max(0, Number(nowMs || Date.now())).toString(16).padStart(12, '0').slice(-12)
  return `00000000-0000-4000-8000-${seed}`
}