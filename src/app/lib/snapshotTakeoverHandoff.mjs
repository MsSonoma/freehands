import { lessonKeyBasename } from './lessonKeyNormalization.js'

export const SNAPSHOT_HANDOFF_SOURCE_GRACE_MS = 5000

export function snapshotUpdatedAtMs(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return 0
  for (const value of [snapshot.lastUpdated, snapshot.savedAt]) {
    const parsed = Date.parse(value || '')
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

export function isStrictlyNewerSnapshot(candidate, baseline) {
  return snapshotUpdatedAtMs(candidate) > snapshotUpdatedAtMs(baseline)
}

export function handoffFallbackReady(createdAt, now = new Date(), graceMs = SNAPSHOT_HANDOFF_SOURCE_GRACE_MS) {
  const createdMs = Date.parse(createdAt || '')
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now || '')
  if (!Number.isFinite(createdMs) || !Number.isFinite(nowMs)) return false
  return nowMs - createdMs >= Math.max(0, Number(graceMs) || 0)
}
export function newestSnapshot(...values) {
  return values
    .filter((value) => value && typeof value === 'object')
    .sort((left, right) => snapshotUpdatedAtMs(right) - snapshotUpdatedAtMs(left))[0] || null
}

export function snapshotLessonMatchesExecution(snapshotLessonKey, executionLessonKey) {
  const snapshotBase = lessonKeyBasename(snapshotLessonKey)
  const executionBase = lessonKeyBasename(executionLessonKey)
  return Boolean(snapshotBase && executionBase && snapshotBase === executionBase)
}
export function snapshotMatchesScope(snapshot, { learnerId, lessonKey, browserSessionId } = {}) {
  if (!snapshot || typeof snapshot !== 'object') return false
  return String(snapshot.learnerId || '') === String(learnerId || '')
    && String(snapshot.lessonKey || '') === String(lessonKey || '')
    && String(snapshot.sessionId || '') === String(browserSessionId || '')
}

export function rehomeSnapshotForTakeover(snapshot, {
  targetBrowserSessionId,
  sourceExecutionSessionId,
  targetExecutionSessionId,
  claimSource,
  now = new Date(),
} = {}) {
  if (!snapshot || typeof snapshot !== 'object' || !targetBrowserSessionId) return null
  return {
    ...snapshot,
    sessionId: targetBrowserSessionId,
    ownershipHandoff: {
      sourceExecutionSessionId: sourceExecutionSessionId || null,
      targetExecutionSessionId: targetExecutionSessionId || null,
      claimSource: claimSource || 'unknown',
      appliedAt: now.toISOString(),
    },
  }
}