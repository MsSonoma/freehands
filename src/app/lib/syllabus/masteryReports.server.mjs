import { aggregateFacilitatorEvidenceSession } from '../masteryEvidence/reporting.js'

export async function loadRecentMasteryReports({
  repository,
  facilitatorId,
  learnerId,
  resolveLesson = null,
  limit = 25,
}) {
  const trackedSessions = await repository.listRecentTrackedSessions(learnerId, limit)
  const trackedIds = trackedSessions.map((row) => row.id)
  const evidenceSessions = await repository.listEvidenceSessions(facilitatorId, learnerId, trackedIds)
  const evidenceIds = evidenceSessions.map((row) => row.id)
  const events = await repository.listEvidenceEvents(facilitatorId, learnerId, evidenceIds)
  const evidenceBySession = new Map(evidenceSessions.map((row) => [String(row.session_id), row]))
  const eventsByEvidence = new Map()
  for (const event of events) {
    const key = String(event.evidence_session_id)
    if (!eventsByEvidence.has(key)) eventsByEvidence.set(key, [])
    eventsByEvidence.get(key).push(event)
  }

  const reports = trackedSessions.map((trackedSession) => {
    const evidenceSession = evidenceBySession.get(String(trackedSession.id)) || null
    return aggregateFacilitatorEvidenceSession({
      trackedSession,
      evidenceSession,
      events: evidenceSession ? eventsByEvidence.get(String(evidenceSession.id)) || [] : [],
    })
  })
  if (!resolveLesson) return reports

  return Promise.all(reports.map(async (report) => {
    const lessonKey = report.lesson?.key || report.lesson?.source_key || report.lesson?.id
    const lesson = lessonKey ? await resolveLesson(lessonKey) : null
    return lesson?.subject
      ? { ...report, lesson: { ...report.lesson, subject: lesson.subject, title: lesson.title || null } }
      : report
  }))
}
