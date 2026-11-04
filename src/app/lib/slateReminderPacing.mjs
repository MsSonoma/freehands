// Mr. Slate only: workspace editing delays attention reminders, not the lesson timer.
export const SLATE_REMINDER_ACTIVITY_GRACE_MS = 60_000
export const SLATE_REMINDER_MAX_EXTENSION_MS = 180_000

// Compare learner-entered content, not revisions, visibility, or UI-only changes.
export function slateWorkspaceContentChanged(previous, next) {
  if (!previous || !next) return false
  const workingContent = (draft) => JSON.stringify({
    operands: draft.operands || [],
    operation: draft.operation || '',
    view: draft.session?.view || null,
    notes: draft.notes || {},
    partialEntries: draft.partialEntries || {},
  })
  return workingContent(previous) !== workingContent(next)
}

export function slateReminderIsDue({
  nowMs,
  turnStartedAtMs,
  lastReminderAtMs,
  lastActivityAtMs,
  stage = 0,
  intervalMs,
  submitted = false,
  microphoneCapturing = false,
}) {
  if (submitted || microphoneCapturing || stage >= 4) return false
  if (![nowMs, turnStartedAtMs, lastReminderAtMs, lastActivityAtMs, intervalMs]
    .every((value) => Number.isFinite(value))) return false
  if (intervalMs <= 0 || nowMs - lastReminderAtMs < intervalMs) return false

  // Recent edits buy one minute, but only within the turn's fixed three-minute
  // extension budget. Repeated edits cannot move this ceiling forward.
  const activityUntil = lastActivityAtMs + SLATE_REMINDER_ACTIVITY_GRACE_MS
  const hardDeadline = turnStartedAtMs + intervalMs + SLATE_REMINDER_MAX_EXTENSION_MS
  return nowMs >= Math.min(activityUntil, hardDeadline)
}
