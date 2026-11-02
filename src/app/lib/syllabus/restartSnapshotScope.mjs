// Upgrade a local checkpoint made before snapshots were isolated per restart.
// Never import an earlier Slate checkpoint into a Sonoma attempt, even if the
// browser session ID was incorrectly reused.
export function canAdoptLegacyRestartSnapshot(snapshot, { learnerId, lessonKey, occurrenceId, browserSessionId, startedAt, teacher } = {}) {
  if (!snapshot || typeof snapshot !== 'object' || !String(occurrenceId || '').startsWith('restart:')) return false
  if (!learnerId || !lessonKey || !browserSessionId || !startedAt) return false
  if (snapshot.learnerId !== learnerId || snapshot.lessonKey !== lessonKey || snapshot.sessionId !== browserSessionId) return false
  const start = Date.parse(startedAt)
  const saved = Date.parse(snapshot.lastUpdated || snapshot.savedAt || '')
  if (!Number.isFinite(start) || !Number.isFinite(saved) || saved < start) return false
  const recordedOccurrence = snapshot.syllabusOccurrenceId || snapshot.featureState?.occurrenceId
  if (recordedOccurrence && recordedOccurrence !== occurrenceId) return false
  const recordedTeacher = snapshot.instructionalTeacher || snapshot.featureState?.instructionalTeacher
  if (teacher && recordedTeacher && recordedTeacher !== teacher) return false
  return true
}
