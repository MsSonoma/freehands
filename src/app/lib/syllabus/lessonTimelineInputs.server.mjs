import { normalizeLessonKey, resolveLessonKeyAgainst } from '../lessonKeyNormalization.js'
import { verifyFacilitatorLessonAccess } from '../serverLessonAccess.mjs'

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
} = {}) {
  const optionalList = async (name, ...args) => typeof repository[name] === 'function' ? repository[name](...args) : []
  const [forecastItems, associations, schedules, sessions, sessionEvents] = await Promise.all([
    repository.listForecastItems(activeRevision.id),
    optionalList('listLessonAssociations', facilitatorId, learner.id),
    optionalList('listLessonSchedule', facilitatorId, learner.id, activeRevision.effective_from),
    optionalList('listAllTrackedSessions', learner.id),
    optionalList('listAllLessonSessionEvents', learner.id),
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
  return { forecastItems, associations, schedules, sessions, sessionEvents, lessonMetadata }
}
