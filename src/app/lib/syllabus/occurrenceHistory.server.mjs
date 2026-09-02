import { aggregateFacilitatorEvidenceSession } from '../masteryEvidence/reporting.js'
import { buildReviewRunSummary, REVIEW_TYPES } from '../masteryEvidence/followUps.js'
import { resolveCalendarContext } from '../calendarDate.mjs'
import { normalizeInstructionalTeacher, instructionalTeacherLabel } from './instructionalTeacher.mjs'
import { composeSyllabusLessonTimeline } from './lessonTimeline.mjs'
import { loadSyllabusTimelineInputs } from './lessonTimelineInputs.server.mjs'

const TRANSCRIPT_BUCKET = 'transcripts'
const TRANSCRIPT_ROOT = 'v1'

function clean(value) { return String(value || '').trim() }
function same(left, right) { return clean(left) !== '' && clean(left) === clean(right) }

function lessonStorageSegment(lessonKey) {
  const segment = clean(lessonKey).split('/').at(-1)?.replace(/\.json$/i, '')
  return segment && segment !== '.' && segment !== '..' && !/[\\/\u0000-\u001f]/.test(segment) ? segment : null
}

function transcriptBase({ facilitatorId, learnerId, lessonKey, teacher }) {
  const segment = lessonStorageSegment(lessonKey)
  if (!segment) return null
  return teacher && teacher !== 'sonoma'
    ? `${TRANSCRIPT_ROOT}/${facilitatorId}/${learnerId}/${teacher}/${segment}`
    : `${TRANSCRIPT_ROOT}/${facilitatorId}/${learnerId}/${segment}`
}

async function signedTranscript(admin, base, browserSessionId = null) {
  if (!admin || !base) return null
  const sessionId = clean(browserSessionId)
  if (browserSessionId && (!sessionId || /[\\/\u0000-\u001f]/.test(sessionId))) return null
  const sessionBase = sessionId ? `${base}/sessions/${sessionId}` : base
  const store = admin.storage.from(TRANSCRIPT_BUCKET)
  for (const kind of ['txt', 'pdf']) {
    const { data, error } = await store.createSignedUrl(`${sessionBase}/transcript.${kind}`, 600)
    if (!error && data?.signedUrl) return { kind, url: data.signedUrl }
  }
  return null
}

function reportAnchorIds(events = []) {
  return new Set(events.map((event) => clean(event?.mastery_check_id)).filter(Boolean))
}

async function loadEvidenceDomain({ repository, facilitatorId, learnerId, canonicalSession, occurrenceIds }) {
  const evidenceSessions = []
  if (canonicalSession && typeof repository.listEvidenceSessions === 'function') {
    const canonical = await repository.listEvidenceSessions(facilitatorId, learnerId, [canonicalSession.id])
    evidenceSessions.push(...canonical.filter((row) => (
      same(row?.facilitator_id, facilitatorId)
      && same(row?.learner_id, learnerId)
      && same(row?.session_id, canonicalSession.id)
    )))
  }
  if (typeof repository.listAllSlateEvidenceSessions === 'function') {
    const slate = await repository.listAllSlateEvidenceSessions(facilitatorId, learnerId)
    evidenceSessions.push(...slate.filter((row) => (
      same(row?.facilitator_id, facilitatorId)
      && same(row?.learner_id, learnerId)
      && clean(row?.session_id).startsWith('slate:')
      && occurrenceIds.has(clean(row?.syllabus_occurrence_id))
    )))
  }

  const uniqueEvidence = [...new Map(evidenceSessions.map((row) => [clean(row.id), row])).values()]
  const evidenceIds = uniqueEvidence.map((row) => row.id).filter(Boolean)
  const rawEvents = evidenceIds.length && typeof repository.listEvidenceEvents === 'function'
    ? await repository.listEvidenceEvents(facilitatorId, learnerId, evidenceIds)
    : []
  const authorizedEvidenceIds = new Set(evidenceIds.map(String))
  const events = rawEvents.filter((row) => (
    same(row?.facilitator_id, facilitatorId)
    && same(row?.learner_id, learnerId)
    && authorizedEvidenceIds.has(clean(row?.evidence_session_id))
  ))
  const eventsByEvidence = new Map()
  for (const event of events) {
    const key = clean(event.evidence_session_id)
    if (!eventsByEvidence.has(key)) eventsByEvidence.set(key, [])
    eventsByEvidence.get(key).push(event)
  }

  const reports = uniqueEvidence.map((evidenceSession) => {
    const instructional = same(evidenceSession.session_id, canonicalSession?.id)
    const trackedSession = instructional ? canonicalSession : {
      id: evidenceSession.session_id,
      session_id: evidenceSession.browser_session_id,
      lesson_id: evidenceSession.lesson_key,
      started_at: evidenceSession.started_at,
      ended_at: evidenceSession.ended_at,
    }
    return {
      ...aggregateFacilitatorEvidenceSession({
        trackedSession,
        evidenceSession,
        events: eventsByEvidence.get(clean(evidenceSession.id)) || [],
      }),
      authority: instructional ? 'instructional_session' : 'slate',
    }
  })

  const anchors = reportAnchorIds(events)
  const reviews = { daily: [], weekly: [] }
  if (anchors.size && typeof repository.listAllLearningReviewRuns === 'function') {
    const runs = (await repository.listAllLearningReviewRuns(facilitatorId, learnerId)).filter((run) => (
      same(run?.facilitator_id, facilitatorId) && same(run?.learner_id, learnerId)
    ))
    const runIds = runs.map((run) => run.id).filter(Boolean)
    const [items, reviewEvents] = await Promise.all([
      repository.listLearningReviewItems(facilitatorId, learnerId, runIds),
      repository.listLearningReviewEvents(facilitatorId, learnerId, runIds),
    ])
    for (const run of runs) {
      const runItems = items.filter((item) => same(item?.run_id, run.id) && anchors.has(clean(item?.anchor_mastery_check_id)))
      if (!runItems.length) continue
      const report = buildReviewRunSummary({
        run,
        items: runItems,
        events: reviewEvents.filter((event) => same(event?.run_id, run.id)),
      })
      if (run.review_type === REVIEW_TYPES.DAILY_FOLLOWUP) reviews.daily.push(report)
      else if (run.review_type === REVIEW_TYPES.WEEKLY_REVIEW) reviews.weekly.push(report)
    }
  }
  return { evidenceSessions: uniqueEvidence, reports, reviews }
}

function canonicalSessionForOccurrence(sessions, occurrenceId) {
  const matches = (sessions || []).filter((session) => `actual:${clean(session?.id || session?.session_id)}` === occurrenceId)
  return matches.length === 1 ? matches[0] : null
}

function legacyRecordForOccurrence(records, occurrenceId) {
  const matches = (records || []).filter((record) => (
    record?.activity_type === 'instructional_completion'
    && `historical:${clean(record?.id || record?.source_identity)}` === occurrenceId
  ))
  return matches.length === 1 ? matches[0] : null
}

export async function loadSyllabusOccurrenceHistory({
  repository,
  admin,
  facilitatorId,
  learnerId,
  occurrenceId,
  fallbackTimeZone,
  now = new Date(),
  evidenceEnabled = true,
  signTranscript = signedTranscript,
} = {}) {
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (!learner) return { kind: 'not_found' }
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus?.active_revision_id) return { kind: 'not_found' }
  const activeRevision = await repository.findRevision(syllabus.active_revision_id, syllabus.id)
  if (!activeRevision) return { kind: 'not_found' }
  const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function'
    ? await repository.findFacilitatorTimeZone(facilitatorId)
    : null
  const calendar = resolveCalendarContext({ now, profileTimeZone, fallbackTimeZone })
  const inputs = await loadSyllabusTimelineInputs({ repository, admin, facilitatorId, learner, activeRevision, includeSlateEvidence: false })
  const timeline = composeSyllabusLessonTimeline({
    activeRevision,
    ...inputs,
    approvedLessons: learner.approved_lessons || {},
    today: calendar.today,
    timeZone: calendar.timeZone,
  })
  const matches = timeline.filter((item) => same(item?.occurrence_id, occurrenceId))
  if (matches.length !== 1) return { kind: 'not_found' }
  const item = matches[0]
  if (item?.historical_activity_only === true) return { kind: 'not_found' }
  const canonicalSession = canonicalSessionForOccurrence(inputs.sessions, clean(item.occurrence_id))
  const legacyRecord = legacyRecordForOccurrence(inputs.legacyActivities, clean(item.occurrence_id))
  if (!canonicalSession && !legacyRecord) return { kind: 'not_found' }

  const occurrenceIds = new Set([clean(item.occurrence_id), clean(item.source_occurrence_id)].filter(Boolean))
  let evidenceDomain = { status: evidenceEnabled ? 'unavailable' : 'disabled', reports: [], reviews: { daily: [], weekly: [] }, evidenceSessions: [] }
  if (evidenceEnabled) {
    try {
      evidenceDomain = { status: 'available', ...(await loadEvidenceDomain({ repository, facilitatorId, learnerId, canonicalSession, occurrenceIds })) }
    } catch {
      evidenceDomain = { status: 'unavailable', reports: [], reviews: { daily: [], weekly: [] }, evidenceSessions: [] }
    }
  }

  const teacher = normalizeInstructionalTeacher(item.actual_instructional_teacher || canonicalSession?.instructional_teacher || legacyRecord?.instructional_teacher)
  const sessionRecords = []
  if (canonicalSession) {
    const base = transcriptBase({ facilitatorId, learnerId, lessonKey: item.lesson_key, teacher })
    const transcript = await signTranscript(admin, base, canonicalSession.session_id).catch(() => null)
    if (transcript) sessionRecords.push({
      kind: 'instructional_transcript',
      teacher: teacher || null,
      teacherName: teacher ? instructionalTeacherLabel(teacher) : 'Instructional teacher',
      startedAt: canonicalSession.started_at || null,
      endedAt: canonicalSession.ended_at || null,
      transcript,
    })
  } else if (legacyRecord?.evidence_reference) {
    const base = clean(legacyRecord.evidence_reference).replace(/\/ledger\.json$/i, '')
    const transcript = await signTranscript(admin, base).catch(() => null)
    if (transcript) sessionRecords.push({
      kind: 'historical_transcript',
      teacher: teacher || null,
      teacherName: teacher ? instructionalTeacherLabel(teacher) : 'Historical session',
      startedAt: null,
      endedAt: legacyRecord.occurred_at || null,
      transcript,
    })
  }

  for (const evidenceSession of evidenceDomain.evidenceSessions.filter((row) => clean(row.session_id).startsWith('slate:'))) {
    const base = transcriptBase({ facilitatorId, learnerId, lessonKey: evidenceSession.lesson_key || item.lesson_key, teacher: 'slate' })
    const transcript = await signTranscript(admin, base, evidenceSession.browser_session_id).catch(() => null)
    if (transcript) sessionRecords.push({
      kind: 'slate_transcript', teacher: 'slate', teacherName: 'Mr. Slate',
      startedAt: evidenceSession.started_at || null, endedAt: evidenceSession.ended_at || null, transcript,
    })
  }

  const primaryReport = evidenceDomain.reports.find((report) => report.authority === 'instructional_session') || null
  return {
    kind: 'ok',
    detail: {
      occurrence: {
        id: clean(item.occurrence_id),
        lessonTitle: item.title || 'Lesson',
        lessonKey: item.lesson_key || null,
        subject: item.subject || null,
        occurrenceDate: item.planned_date || null,
        completedAt: item.actual_at || legacyRecord?.occurred_at || canonicalSession?.ended_at || null,
        completionState: item.actual_kind || 'completed',
        actualInstructionalTeacher: teacher ? { id: teacher, label: instructionalTeacherLabel(teacher) } : null,
      },
      evidence: {
        status: evidenceDomain.status,
        primary: primaryReport,
        slate: evidenceDomain.reports.filter((report) => report.authority === 'slate'),
      },
      reviews: evidenceDomain.reviews,
      sessionRecords,
      transcriptStatus: sessionRecords.length ? 'available' : 'unavailable',
    },
  }
}
