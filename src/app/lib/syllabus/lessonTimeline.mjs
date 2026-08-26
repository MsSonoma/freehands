import { lessonKeyBasename, normalizeLessonKey, resolveLessonKeyAgainst } from '../lessonKeyNormalization.js'
import { dateOnly } from './timeline.mjs'

const DAY_MS = 86400000
const DAY_KEYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])

function clean(value) { return String(value || '').trim() }
function subjectKey(value) { return clean(value).toLocaleLowerCase() }
function isoDate(value) { return dateOnly(value) }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(isoDate(value)) }
function compareTimestamp(left, right) {
  const leftTime = Date.parse(left)
  const rightTime = Date.parse(right)
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime
  return String(left || '').localeCompare(String(right || ''))
}
function mondayOf(value) {
  const date = new Date(`${value}T12:00:00.000Z`)
  const offset = (date.getUTCDay() + 6) % 7
  return new Date(date.getTime() - offset * DAY_MS).toISOString().slice(0, 10)
}

function inferredSubjectSlot({ weeklyPattern, subject, afterDate, occupied }) {
  const start = new Date(`${afterDate}T12:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  const target = subjectKey(subject)
  for (let offset = 0; offset <= 371; offset++) {
    const cursor = new Date(start.getTime() + offset * DAY_MS)
    const plannedDate = cursor.toISOString().slice(0, 10)
    const entries = Array.isArray(weeklyPattern?.[DAY_KEYS[cursor.getUTCDay()]])
      ? weeklyPattern[DAY_KEYS[cursor.getUTCDay()]]
      : []
    for (let sortOrder = 0; sortOrder < entries.length; sortOrder++) {
      const entrySubject = subjectKey(typeof entries[sortOrder] === 'string' ? entries[sortOrder] : entries[sortOrder]?.subject)
      const slot = `${plannedDate}:${sortOrder}`
      if (entrySubject === target && !occupied.has(slot)) return { planned_date: plannedDate, sort_order: sortOrder, slot }
    }
  }
  return null
}

function defaultMetadata(key, row = {}) {
  const normalized = normalizeLessonKey(key)
  const prefix = normalized?.includes('/') ? normalized.split('/')[0] : ''
  return {
    subject: clean(row.subject) || (prefix && prefix !== 'generated' ? prefix : 'general'),
    title: clean(row.title) || lessonKeyBasename(normalized).replace(/[_-]+/g, ' ') || 'Lesson',
  }
}

function readinessRank(state) {
  return { saved: 0, draft: 1, approved: 2, available: 3, in_progress: 4, completed: 5 }[state] ?? 0
}

export function composeSyllabusLessonTimeline({
  activeRevision = {},
  forecastItems = [],
  associations = [],
  approvedLessons = {},
  schedules = [],
  sessions = [],
  sessionEvents = [],
  today = new Date().toISOString().slice(0, 10),
} = {}) {
  const concreteKeys = [
    ...forecastItems.map((row) => row?.lesson_key),
    ...associations.map((row) => row?.lesson_key),
    ...Object.keys(approvedLessons || {}),
    ...schedules.map((row) => row?.lesson_key),
  ].map(normalizeLessonKey).filter((key) => key?.includes('/'))
  const resolveKey = (value) => resolveLessonKeyAgainst(value, concreteKeys)
  const entries = new Map()

  const ensure = (rawKey, row = {}) => {
    const key = resolveKey(rawKey)
    if (!key) return null
    if (!entries.has(key)) entries.set(key, { lesson_key: key, ...defaultMetadata(key, row), readiness_state: 'saved' })
    const entry = entries.get(key)
    if (clean(row.subject)) entry.subject = clean(row.subject)
    if (clean(row.title)) entry.title = clean(row.title)
    return entry
  }
  const setReadiness = (entry, state) => {
    if (entry && readinessRank(state) >= readinessRank(entry.readiness_state)) entry.readiness_state = state
  }

  for (const association of associations || []) {
    const entry = ensure(association.lesson_key, association)
    if (!entry) continue
    entry.association_id = association.id
    entry.association_source = association.association_source
    setReadiness(entry, association.readiness_state || 'saved')
  }
  for (const rawKey of Object.keys(approvedLessons || {})) setReadiness(ensure(rawKey), 'available')

  for (const item of forecastItems || []) {
    if (!item?.lesson_key) continue
    const entry = ensure(item.lesson_key, item)
    if (!entry || entry.explicit_syllabus_date) continue
    entry.explicit_syllabus_date = isoDate(item.planned_date)
    entry.explicit_syllabus_item = item
  }
  const effectiveFrom = isoDate(activeRevision?.effective_from)
  for (const row of schedules || []) {
    if (!validDate(row?.scheduled_date) || (validDate(effectiveFrom) && isoDate(row.scheduled_date) < effectiveFrom)) continue
    const entry = ensure(row?.lesson_key, row)
    if (entry) entry.explicit_schedule_date = isoDate(row.scheduled_date)
  }

  const intentReadiness = new Map([...entries].map(([key, entry]) => [key, entry.readiness_state]))
  const terminalEventsBySession = new Map()
  for (const event of sessionEvents || []) {
    if (!['completed', 'incomplete'].includes(event?.event_type) || !event?.occurred_at) continue
    const sessionId = clean(event.session_id)
    if (!sessionId) continue
    const current = terminalEventsBySession.get(sessionId)
    if (!current || compareTimestamp(event.occurred_at, current.occurred_at) > 0) {
      terminalEventsBySession.set(sessionId, event)
    }
  }
  const actualCandidates = []
  const knownSessionIds = new Set()
  for (const session of sessions || []) {
    const sessionIds = [session?.id, session?.session_id].map(clean).filter(Boolean)
    for (const sessionId of sessionIds) knownSessionIds.add(sessionId)
    const terminalEvent = sessionIds.map((sessionId) => terminalEventsBySession.get(sessionId)).filter(Boolean)
      .sort((left, right) => compareTimestamp(right.occurred_at, left.occurred_at))[0]
    const key = resolveKey(terminalEvent?.lesson_id || terminalEvent?.lesson_key || session?.lesson_id || session?.lesson_key)
    if (!key) continue
    if (terminalEvent) {
      actualCandidates.push({
        key,
        kind: terminalEvent.event_type,
        attempt_at: session.started_at || terminalEvent.occurred_at,
        occurred_at: terminalEvent.occurred_at,
      })
    } else if (session?.ended_at) {
      actualCandidates.push({ key, kind: 'completed', attempt_at: session.started_at || session.ended_at, occurred_at: session.ended_at })
    } else if (session?.started_at) {
      actualCandidates.push({ key, kind: 'in_progress', attempt_at: session.started_at, occurred_at: session.started_at })
    }
  }
  for (const event of sessionEvents || []) {
    if (!['completed', 'incomplete'].includes(event?.event_type) || !event?.occurred_at || knownSessionIds.has(clean(event.session_id))) continue
    const key = resolveKey(event.lesson_id || event.lesson_key)
    if (key) actualCandidates.push({ key, kind: event.event_type, attempt_at: event.occurred_at, occurred_at: event.occurred_at })
  }
  actualCandidates.sort((left, right) => compareTimestamp(left.attempt_at, right.attempt_at)
    || compareTimestamp(left.occurred_at, right.occurred_at))
  const latestActualByLesson = new Map()
  for (const candidate of actualCandidates) {
    const entry = ensure(candidate.key)
    if (!entry) continue
    const current = latestActualByLesson.get(candidate.key)
    if (current && (compareTimestamp(candidate.attempt_at, current.attempt_at) < 0
      || (compareTimestamp(candidate.attempt_at, current.attempt_at) === 0 && compareTimestamp(candidate.occurred_at, current.occurred_at) < 0))) continue
    latestActualByLesson.set(candidate.key, candidate)
    entry.actual_at = candidate.occurred_at
    entry.actual_kind = candidate.kind
    if (candidate.kind === 'in_progress') {
      entry.actual_started_date = isoDate(candidate.occurred_at)
      entry.actual_date = today
      entry.readiness_state = 'in_progress'
    } else {
      entry.actual_started_date = null
      entry.actual_date = isoDate(candidate.occurred_at)
      entry.readiness_state = candidate.kind === 'completed'
        ? 'completed'
        : (intentReadiness.get(candidate.key) || 'saved')
    }
  }

  const occupied = new Set()
  for (const item of forecastItems || []) {
    if (validDate(item?.planned_date)) occupied.add(`${isoDate(item.planned_date)}:${Number(item.sort_order || 0)}`)
  }
  for (const row of schedules || []) {
    if (!validDate(row?.scheduled_date) || (validDate(effectiveFrom) && isoDate(row.scheduled_date) < effectiveFrom)) continue
    const entry = entries.get(resolveKey(row.lesson_key))
    const date = new Date(`${isoDate(row.scheduled_date)}T12:00:00.000Z`)
    const dayEntries = Array.isArray(activeRevision?.weekly_pattern?.[DAY_KEYS[date.getUTCDay()]])
      ? activeRevision.weekly_pattern[DAY_KEYS[date.getUTCDay()]]
      : []
    const index = dayEntries.findIndex((item) => subjectKey(typeof item === 'string' ? item : item?.subject) === subjectKey(entry?.subject))
    if (index >= 0) occupied.add(`${isoDate(row.scheduled_date)}:${index}`)
  }
  const output = []
  for (const entry of entries.values()) {
    let plannedDate = entry.actual_date
    let placementKind = entry.actual_date ? 'actual' : null
    if (!plannedDate && entry.explicit_schedule_date) { plannedDate = entry.explicit_schedule_date; placementKind = 'scheduled' }
    if (!plannedDate && entry.explicit_syllabus_date) { plannedDate = entry.explicit_syllabus_date; placementKind = 'syllabus' }
    let sortOrder = Number(entry.explicit_syllabus_item?.sort_order || 0)
    if (!plannedDate) {
      const slot = inferredSubjectSlot({ weeklyPattern: activeRevision?.weekly_pattern, subject: entry.subject, afterDate: today, occupied })
      if (slot) {
        plannedDate = slot.planned_date
        sortOrder = slot.sort_order
        placementKind = 'inferred'
        occupied.add(slot.slot)
      } else {
        plannedDate = today
        placementKind = 'needs_placement'
      }
    }
    const originalPlacementDate = plannedDate
    const overdueIntent = placementKind !== 'actual' && plannedDate < mondayOf(today)
    if (overdueIntent) plannedDate = today
    output.push({
      ...entry,
      id: entry.explicit_syllabus_item?.id || `lesson:${entry.lesson_key}`,
      lineage_id: entry.explicit_syllabus_item?.lineage_id || null,
      planned_date: plannedDate,
      sort_order: sortOrder,
      item_type: entry.explicit_syllabus_item?.item_type || 'lesson',
      origin: entry.explicit_syllabus_item?.origin || 'facilitator',
      placement_kind: placementKind,
      is_explicit_schedule: placementKind === 'scheduled',
      is_provisional: placementKind === 'inferred',
      needs_placement: placementKind === 'needs_placement',
      is_overdue_intent: overdueIntent,
      original_placement_date: overdueIntent ? originalPlacementDate : null,
    })
  }

  for (const item of forecastItems || []) {
    if (item?.lesson_key) continue
    const overdueIntent = isoDate(item.planned_date) < mondayOf(today)
    output.push({
      ...item,
      planned_date: overdueIntent ? today : item.planned_date,
      placement_kind: 'syllabus',
      readiness_state: 'saved',
      is_explicit_schedule: false,
      is_provisional: false,
      is_overdue_intent: overdueIntent,
      original_placement_date: overdueIntent ? isoDate(item.planned_date) : null,
    })
  }
  return output.sort((left, right) => left.planned_date.localeCompare(right.planned_date)
    || Number(left.sort_order || 0) - Number(right.sort_order || 0)
    || String(left.title || '').localeCompare(String(right.title || '')))
}
