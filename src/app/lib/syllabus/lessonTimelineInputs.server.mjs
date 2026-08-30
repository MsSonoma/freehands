import { normalizeLessonKey, resolveLessonKeyAgainst } from '../lessonKeyNormalization.js'
import { verifyFacilitatorLessonAccess } from '../serverLessonAccess.mjs'
import { aggregateFacilitatorEvidenceSession } from '../masteryEvidence/reporting.js'
import { buildReviewRunSummary } from '../masteryEvidence/followUps.js'

const DEFAULT_CONCURRENCY = 4

function clean(value) { return String(value || '').trim() }
function validEducationalSubject(value) {
  const subject = clean(value)
  return subject && subject.toLocaleLowerCase() !== 'generated' ? subject : ''
}
function lessonKey(row) { return row?.lesson_id || row?.lesson_key }

function membershipRows({ forecastItems = [], associations = [], schedules = [], sessions = [], sessionEvents = [] } = {}) {
  return [
    ...forecastItems.filter((row) => row?.lesson_key),
    ...associations,
    ...schedules,
    ...sessions,
    ...sessionEvents,
  ]
}

async function mapBounded(values, concurrency, mapper) {
  const results = new Array(values.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++
      results[index] = await mapper(values[index])
    }
  })
  await Promise.all(workers)
  return results
}

export async function loadSlateEvidenceInputs({ repository, facilitatorId, learnerId } = {}) {
  if (typeof repository?.listAllSlateEvidenceSessions !== 'function') {
    return { slateEvidenceReports: [], slateReviewReports: [] }
  }
  const evidenceSessions = (await repository.listAllSlateEvidenceSessions(facilitatorId, learnerId)).filter((row) => (
    String(row?.facilitator_id) === String(facilitatorId)
      && String(row?.learner_id) === String(learnerId)
      && String(row?.session_id || '').startsWith('slate:')
      && row?.teaching_protocol_version === 'slate-mastery-retention-v1'
  ))
  const evidenceSessionIds = evidenceSessions.map((row) => row.id).filter(Boolean)
  const evidenceSessionIdSet = new Set(evidenceSessionIds.map(String))
  const events = typeof repository.listEvidenceEvents === 'function'
    ? await repository.listEvidenceEvents(facilitatorId, learnerId, evidenceSessionIds)
    : []
  const eventsBySession = new Map()
  for (const event of events) {
    const id = String(event?.evidence_session_id || '')
    if (!evidenceSessionIdSet.has(id)) continue
    if (!eventsBySession.has(id)) eventsBySession.set(id, [])
    eventsBySession.get(id).push(event)
  }
  const slateEvidenceReports = evidenceSessions.map((evidenceSession) => ({
    ...aggregateFacilitatorEvidenceSession({
      trackedSession: {
        id: evidenceSession.session_id,
        session_id: evidenceSession.browser_session_id,
        lesson_id: evidenceSession.lesson_key,
        started_at: evidenceSession.started_at,
        ended_at: evidenceSession.ended_at,
      },
      evidenceSession,
      events: eventsBySession.get(String(evidenceSession.id)) || [],
    }),
    syllabus_occurrence_id: evidenceSession.syllabus_occurrence_id || null,
  }))

  if (typeof repository.listAllLearningReviewRuns !== 'function') {
    return { slateEvidenceReports, slateReviewReports: [] }
  }
  const runs = (await repository.listAllLearningReviewRuns(facilitatorId, learnerId)).filter((run) => (
    String(run?.facilitator_id) === String(facilitatorId) && String(run?.learner_id) === String(learnerId)
  ))
  const runIds = runs.map((run) => run.id).filter(Boolean)
  const runIdSet = new Set(runIds.map(String))
  const [reviewItems, reviewEvents] = await Promise.all([
    repository.listLearningReviewItems(facilitatorId, learnerId, runIds),
    repository.listLearningReviewEvents(facilitatorId, learnerId, runIds),
  ])
  const occurrenceByMasteryCheck = new Map()
  const evidenceById = new Map(evidenceSessions.map((row) => [String(row.id), row]))
  for (const event of events) {
    const occurrenceId = evidenceById.get(String(event?.evidence_session_id))?.syllabus_occurrence_id
    if (event?.mastery_check_id && occurrenceId) occurrenceByMasteryCheck.set(String(event.mastery_check_id), occurrenceId)
  }
  const itemsByRun = new Map()
  const reviewEventsByRun = new Map()
  for (const item of reviewItems) {
    const id = String(item?.run_id || '')
    if (!runIdSet.has(id)) continue
    if (!itemsByRun.has(id)) itemsByRun.set(id, [])
    itemsByRun.get(id).push(item)
  }
  for (const event of reviewEvents) {
    const id = String(event?.run_id || '')
    if (!runIdSet.has(id)) continue
    if (!reviewEventsByRun.has(id)) reviewEventsByRun.set(id, [])
    reviewEventsByRun.get(id).push(event)
  }
  const slateReviewReports = runs.map((run) => {
    const report = buildReviewRunSummary({
      run,
      items: itemsByRun.get(String(run.id)) || [],
      events: reviewEventsByRun.get(String(run.id)) || [],
    })
    return {
      ...report,
      items: report.items.map((item) => ({
        ...item,
        syllabus_occurrence_id: occurrenceByMasteryCheck.get(String(item.anchor_mastery_check_id)) || null,
      })),
    }
  })
  return { slateEvidenceReports, slateReviewReports }
}

export async function resolveSyllabusLessonMetadata({
  admin,
  facilitatorId,
  forecastItems = [],
  associations = [],
  approvedLessons = {},
  schedules = [],
  sessions = [],
  sessionEvents = [],
  verifyLessonAccess = verifyFacilitatorLessonAccess,
  concurrency = DEFAULT_CONCURRENCY,
} = {}) {
  if (!admin || !facilitatorId) return []
  const rows = membershipRows({ forecastItems, associations, schedules, sessions, sessionEvents })
  const concreteKeys = [
    ...rows.map(lessonKey),
    ...Object.keys(approvedLessons || {}),
  ].map(normalizeLessonKey).filter((key) => key?.includes('/'))
  const resolveKey = (value) => resolveLessonKeyAgainst(value, concreteKeys)

  const explicitMetadata = new Map()
  for (const row of [...associations, ...forecastItems, ...schedules]) {
    const key = resolveKey(row?.lesson_key)
    if (!key) continue
    const current = explicitMetadata.get(key) || {}
    const subject = validEducationalSubject(row?.subject)
    const title = clean(row?.title)
    explicitMetadata.set(key, {
      subject: current.subject || subject,
      title: current.title || title,
    })
  }

  const keys = [...new Set(rows.map((row) => resolveKey(lessonKey(row)))
    .filter((key) => key?.startsWith('generated/')))]
    .filter((key) => {
      const explicit = explicitMetadata.get(key)
      return !explicit?.subject || !explicit?.title
    })

  const resolved = await mapBounded(keys, concurrency, async (key) => {
    try {
      const access = await verifyLessonAccess({
        admin,
        userId: facilitatorId,
        lessonKey: key,
        requireApproved: false,
      })
      if (!access?.ok) return null
      const subject = validEducationalSubject(access.lesson?.subject)
      const title = clean(access.lesson?.title)
      return subject || title ? { lesson_key: key, ...(subject ? { subject } : {}), ...(title ? { title } : {}) } : null
    } catch {
      return null
    }
  })
  return resolved.filter(Boolean)
}

export async function loadSyllabusTimelineInputs({
  repository,
  admin,
  facilitatorId,
  learner,
  activeRevision,
  verifyLessonAccess,
  includeSlateEvidence = false,
} = {}) {
  const optionalList = async (name, ...args) => typeof repository[name] === 'function' ? repository[name](...args) : []
  const [forecastItems, associations, schedules, sessions, sessionEvents, legacyActivities, slateEvidence] = await Promise.all([
    repository.listForecastItems(activeRevision.id),
    optionalList('listLessonAssociations', facilitatorId, learner.id),
    optionalList('listLessonSchedule', facilitatorId, learner.id, activeRevision.effective_from),
    optionalList('listAllTrackedSessions', learner.id),
    optionalList('listAllLessonSessionEvents', learner.id),
    optionalList('listLegacyActivityRecords', facilitatorId, learner.id),
    includeSlateEvidence
      ? loadSlateEvidenceInputs({ repository, facilitatorId, learnerId: learner.id })
      : { slateEvidenceReports: [], slateReviewReports: [] },
  ])
  const lessonMetadata = await resolveSyllabusLessonMetadata({
    admin,
    facilitatorId,
    forecastItems,
    associations,
    approvedLessons: learner.approved_lessons || {},
    schedules,
    sessions,
    sessionEvents,
    verifyLessonAccess,
  })
  return { forecastItems, associations, schedules, sessions, sessionEvents, legacyActivities, lessonMetadata, ...slateEvidence }
}
