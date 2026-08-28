import { lessonKeyBasename, normalizeLessonKey, resolveLessonKeyAgainst } from '../lessonKeyNormalization.js'
import { dateOnly } from './timeline.mjs'
import { calendarDateInTimeZone } from '../calendarDate.mjs'

const DAY_MS = 86400000
const DAY_KEYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])
const FORECAST_HORIZON_DAYS = 371

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
function patternEntries(weeklyPattern, plannedDate) {
  const date = new Date(`${plannedDate}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return []
  const rows = weeklyPattern?.[DAY_KEYS[date.getUTCDay()]]
  return Array.isArray(rows) ? rows.map((row, index) => ({
    index,
    subject: clean(typeof row === 'string' ? row : row?.subject),
    slot: `${plannedDate}:${index}`,
  })) : []
}
function reserveExplicitSlot({ weeklyPattern, plannedDate, subject, preferredIndex, occupied }) {
  const slots = patternEntries(weeklyPattern, plannedDate)
  const target = subjectKey(subject)
  const preferred = slots.find((slot) => slot.index === Number(preferredIndex) && subjectKey(slot.subject) === target && !occupied.has(slot.slot))
  const matching = preferred || slots.find((slot) => subjectKey(slot.subject) === target && !occupied.has(slot.slot))
  const available = matching || slots.find((slot) => !occupied.has(slot.slot))
  if (!available) return { slot: null, capacity_conflict: slots.length ? 'daily_capacity' : 'no_capacity' }
  occupied.add(available.slot)
  return { slot: available, capacity_conflict: subjectKey(available.subject) === target ? null : 'subject_capacity' }
}
function inferredSubjectSlot({ weeklyPattern, subject, afterDate, occupied }) {
  const start = new Date(`${afterDate}T12:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  const target = subjectKey(subject)
  for (let offset = 0; offset <= FORECAST_HORIZON_DAYS; offset++) {
    const cursor = new Date(start.getTime() + offset * DAY_MS)
    const plannedDate = cursor.toISOString().slice(0, 10)
    for (const entry of patternEntries(weeklyPattern, plannedDate)) {
      if (subjectKey(entry.subject) === target && !occupied.has(entry.slot)) {
        return { planned_date: plannedDate, sort_order: entry.index, slot: entry.slot }
      }
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
function intentWasCreatedAfterCompletion(intent, activeRevision, completedAt) {
  if (!completedAt) return true
  const provenance = intent.kind === 'syllabus'
    ? (intent.row?.created_at || activeRevision?.activated_at || activeRevision?.created_at)
    // lesson_schedule rows are updated only by the explicit reschedule path. Its
    // updated_at is therefore the trustworthy intent time when it is later than
    // created_at, rather than letting the original insert forever win.
    : [intent.row?.created_at, intent.row?.updated_at].filter(Boolean)
      .sort((left, right) => compareTimestamp(right, left))[0]
  return Boolean(provenance && compareTimestamp(provenance, completedAt) > 0)
}

function intentOccurrenceId(intent) {
  return `${intent.kind}:${clean(intent.row?.id || intent.row?.lineage_id) || `${intent.key}:${intent.planned_date}:${intent.sort_order}`}`
}

export function composeSyllabusLessonTimeline({
  activeRevision = {}, forecastItems = [], associations = [], approvedLessons = {}, schedules = [], sessions = [], sessionEvents = [],
  today = new Date().toISOString().slice(0, 10),
  timeZone = 'UTC',
} = {}) {
  const concreteKeys = [
    ...forecastItems.map((row) => row?.lesson_key), ...associations.map((row) => row?.lesson_key), ...Object.keys(approvedLessons || {}),
    ...schedules.map((row) => row?.lesson_key), ...sessions.map((row) => row?.lesson_id || row?.lesson_key),
    ...sessionEvents.map((row) => row?.lesson_id || row?.lesson_key),
  ].map(normalizeLessonKey).filter((key) => key?.includes('/'))
  const resolveKey = (value) => resolveLessonKeyAgainst(value, concreteKeys)
  const metadata = new Map()
  const ensureMetadata = (rawKey, row = {}) => {
    const key = resolveKey(rawKey)
    if (!key) return null
    if (!metadata.has(key)) metadata.set(key, { lesson_key: key, ...defaultMetadata(key, row), readiness_state: 'saved' })
    const entry = metadata.get(key)
    if (clean(row.subject)) entry.subject = clean(row.subject)
    if (clean(row.title)) entry.title = clean(row.title)
    return entry
  }
  const setReadiness = (entry, state) => {
    if (entry && readinessRank(state) >= readinessRank(entry.readiness_state)) entry.readiness_state = state
  }
  for (const association of associations || []) {
    const entry = ensureMetadata(association.lesson_key, association)
    if (!entry) continue
    entry.association_id = association.id
    entry.association_source = association.association_source
    setReadiness(entry, association.readiness_state || 'saved')
  }
  for (const rawKey of Object.keys(approvedLessons || {})) setReadiness(ensureMetadata(rawKey), 'available')
  for (const item of forecastItems || []) if (item?.lesson_key) ensureMetadata(item.lesson_key, item)

  const terminalEventsBySession = new Map()
  const occurrenceBySession = new Map()
  for (const event of sessionEvents || []) {
    const sessionId = clean(event?.session_id)
    const occurrenceId = clean(event?.metadata?.syllabus_occurrence_id)
    if (sessionId && occurrenceId) occurrenceBySession.set(sessionId, occurrenceId)
    if (!['completed', 'incomplete'].includes(event?.event_type) || !event?.occurred_at) continue
    if (!sessionId) continue
    const current = terminalEventsBySession.get(sessionId)
    if (!current || compareTimestamp(event.occurred_at, current.occurred_at) > 0
      || (compareTimestamp(event.occurred_at, current.occurred_at) === 0 && clean(event.id).localeCompare(clean(current.id)) > 0)) terminalEventsBySession.set(sessionId, event)
  }
  const actuals = []
  const actualDate = (value) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? isoDate(value) : calendarDateInTimeZone(parsed, timeZone)
  }
  const knownSessionIds = new Set()
  for (const session of sessions || []) {
    const sessionIds = [session?.id, session?.session_id].map(clean).filter(Boolean)
    sessionIds.forEach((id) => knownSessionIds.add(id))
    const terminal = sessionIds.map((id) => terminalEventsBySession.get(id)).filter(Boolean)
      .sort((left, right) => compareTimestamp(right.occurred_at, left.occurred_at) || clean(right.id).localeCompare(clean(left.id)))[0]
    const key = resolveKey(terminal?.lesson_id || terminal?.lesson_key || session?.lesson_id || session?.lesson_key)
    if (!key) continue
    const identity = clean(session?.id || session?.session_id) || clean(terminal?.id)
    const occurrenceId = sessionIds.map((id) => occurrenceBySession.get(id)).find(Boolean) || clean(session?.syllabus_occurrence_id)
    if (terminal) actuals.push({ key, id: identity, occurrenceId, kind: terminal.event_type, occurred_at: terminal.occurred_at, started_at: session.started_at || terminal.occurred_at })
    else if (session?.ended_at) actuals.push({ key, id: identity, occurrenceId, kind: 'completed', occurred_at: session.ended_at, started_at: session.started_at || session.ended_at })
    else if (session?.started_at) actuals.push({ key, id: identity, occurrenceId, kind: 'in_progress', occurred_at: session.started_at, started_at: session.started_at })
  }
  for (const event of sessionEvents || []) {
    if (!['completed', 'incomplete'].includes(event?.event_type) || !event?.occurred_at || knownSessionIds.has(clean(event.session_id))) continue
    const key = resolveKey(event.lesson_id || event.lesson_key)
    if (key) actuals.push({ key, id: clean(event.id) || `${key}:${event.occurred_at}:${event.event_type}`, kind: event.event_type, occurred_at: event.occurred_at, started_at: event.occurred_at })
  }
  actuals.sort((left, right) => compareTimestamp(left.started_at, right.started_at) || compareTimestamp(left.occurred_at, right.occurred_at) || left.id.localeCompare(right.id))
  const latestCompletionByKey = new Map()
  for (const actual of actuals) {
    ensureMetadata(actual.key)
    if (actual.kind !== 'completed') continue
    const current = latestCompletionByKey.get(actual.key)
    if (!current || compareTimestamp(actual.occurred_at, current) > 0) latestCompletionByKey.set(actual.key, actual.occurred_at)
  }

  const effectiveFrom = isoDate(activeRevision?.effective_from)
  const scheduleIntents = []
  for (const row of schedules || []) {
    if (!validDate(row?.scheduled_date) || (validDate(effectiveFrom) && isoDate(row.scheduled_date) < effectiveFrom)) continue
    const key = resolveKey(row.lesson_key)
    if (key) {
      ensureMetadata(key, row)
      scheduleIntents.push({ kind: 'scheduled', key, row, planned_date: isoDate(row.scheduled_date), sort_order: Number(row.sort_order || 0) })
    }
  }
  const forecastIntents = []
  for (const row of forecastItems || []) {
    if (!row?.lesson_key || !validDate(row?.planned_date)) continue
    const key = resolveKey(row.lesson_key)
    if (key) forecastIntents.push({ kind: 'syllabus', key, row, planned_date: isoDate(row.planned_date), sort_order: Number(row.sort_order || 0) })
  }
  const consumedForecasts = new Set()
  const scheduleCountByKey = new Map()
  for (const intent of scheduleIntents) scheduleCountByKey.set(intent.key, (scheduleCountByKey.get(intent.key) || 0) + 1)
  const rowIdentities = (row) => [
    row?.forecast_item_id,
    row?.syllabus_forecast_item_id,
    row?.forecast_lineage_id,
    row?.syllabus_lineage_id,
    row?.metadata?.forecast_item_id,
    row?.metadata?.forecast_lineage_id,
  ].map(clean).filter(Boolean)
  for (const schedule of scheduleIntents) {
    const candidates = forecastIntents.filter((forecast) => forecast.key === schedule.key && !consumedForecasts.has(forecast))
    const identities = new Set(rowIdentities(schedule.row))
    let match = identities.size
      ? candidates.find((forecast) => identities.has(clean(forecast.row?.id)) || identities.has(clean(forecast.row?.lineage_id)))
      : null
    if (!match) {
      const exactDate = candidates.filter((forecast) => forecast.planned_date === schedule.planned_date)
      if (exactDate.length === 1) match = exactDate[0]
    }
    if (!match && candidates.length === 1 && scheduleCountByKey.get(schedule.key) === 1) match = candidates[0]
    if (match) {
      consumedForecasts.add(match)
      schedule.reconciled_forecast_id = clean(match.row?.id || match.row?.lineage_id)
    }
  }
  const intents = [...scheduleIntents, ...forecastIntents.filter((intent) => !consumedForecasts.has(intent))]
  const activeIntents = intents.filter((intent) => intentWasCreatedAfterCompletion(intent, activeRevision, latestCompletionByKey.get(intent.key)))
    .sort((left, right) => (left.kind === right.kind ? 0 : left.kind === 'scheduled' ? -1 : 1)
      || left.planned_date.localeCompare(right.planned_date) || left.sort_order - right.sort_order
      || clean(left.row?.id || left.row?.lineage_id).localeCompare(clean(right.row?.id || right.row?.lineage_id)))

  const occupied = new Set()
  const actualCapacity = new Map()
  for (const actual of actuals) {
    if (actualDate(actual.occurred_at) !== today) continue
    const details = metadata.get(actual.key) || ensureMetadata(actual.key)
    actualCapacity.set(actual, reserveExplicitSlot({
      weeklyPattern: activeRevision?.weekly_pattern,
      plannedDate: today,
      subject: details?.subject,
      preferredIndex: null,
      occupied,
    }))
  }
  const consumedIntents = new Set()
  for (const actual of actuals.filter((row) => actualDate(row.occurred_at) === today)) {
    const candidates = activeIntents.filter((intent) => !consumedIntents.has(intent) && intent.key === actual.key)
    const proven = actual.occurrenceId
      ? candidates.filter((intent) => intentOccurrenceId(intent) === actual.occurrenceId)
      : []
    const sameDay = candidates.filter((intent) => intent.planned_date === today)
    const overdue = candidates.filter((intent) => intent.planned_date < today)
    const match = proven.length === 1
      ? proven[0]
      : (sameDay.length === 1 ? sameDay[0] : (candidates.length === 1 && overdue.length === 1 ? overdue[0] : null))
    if (match) consumedIntents.add(match)
  }
  const placedIntents = activeIntents.filter((intent) => !consumedIntents.has(intent))
  for (const intent of placedIntents) {
    const details = metadata.get(intent.key) || ensureMetadata(intent.key, intent.row)
    const overdue = intent.planned_date < today
    if (overdue) {
      const slot = inferredSubjectSlot({ weeklyPattern: activeRevision?.weekly_pattern, subject: details?.subject, afterDate: today, occupied })
      if (slot) occupied.add(slot.slot)
      intent.capacity = { slot, capacity_conflict: slot ? null : 'no_capacity' }
      intent.rendered_date = slot?.planned_date || today
      intent.needs_placement = !slot
    } else {
      intent.capacity = reserveExplicitSlot({ weeklyPattern: activeRevision?.weekly_pattern, plannedDate: intent.planned_date, subject: details?.subject, preferredIndex: intent.sort_order, occupied })
      intent.rendered_date = intent.planned_date
      intent.needs_placement = false
    }
  }
  const standaloneForecastCapacity = new Map()
  for (const item of (forecastItems || []).filter((row) => !row?.lesson_key && validDate(row?.planned_date))) {
    if (isoDate(item.planned_date) < today) {
      const slot = inferredSubjectSlot({ weeklyPattern: activeRevision?.weekly_pattern, subject: item.subject, afterDate: today, occupied })
      if (slot) occupied.add(slot.slot)
      standaloneForecastCapacity.set(item, { slot, capacity_conflict: slot ? null : 'no_capacity', rendered_date: slot?.planned_date || today, needs_placement: !slot })
    } else {
      const capacity = reserveExplicitSlot({ weeklyPattern: activeRevision?.weekly_pattern, plannedDate: isoDate(item.planned_date), subject: item.subject, preferredIndex: Number(item.sort_order || 0), occupied })
      standaloneForecastCapacity.set(item, { ...capacity, rendered_date: isoDate(item.planned_date), needs_placement: false })
    }
  }

  const output = actuals.map((actual) => {
    const details = metadata.get(actual.key) || defaultMetadata(actual.key)
    const capacity = actualCapacity.get(actual)
    return {
      ...details, id: `actual:${actual.id}`, occurrence_id: `actual:${actual.id}`, planned_date: actualDate(actual.occurred_at), sort_order: capacity?.slot?.index ?? 0,
      item_type: 'lesson', placement_kind: 'actual', actual_kind: actual.kind, actual_at: actual.occurred_at,
      actual_started_date: actualDate(actual.started_at),
      readiness_state: actual.kind === 'completed' ? 'completed' : (actual.kind === 'in_progress' ? 'in_progress' : details.readiness_state),
      is_explicit_schedule: false, is_provisional: false, needs_placement: false, capacity_conflict: capacity?.capacity_conflict || null,
    }
  })

  for (const intent of placedIntents) {
    const details = metadata.get(intent.key) || defaultMetadata(intent.key, intent.row)
    const overdue = intent.planned_date < today
    const occurrenceId = intentOccurrenceId(intent)
    output.push({
      ...details, ...intent.row, id: intent.row?.id || occurrenceId, occurrence_id: occurrenceId, lesson_key: intent.key,
      planned_date: intent.rendered_date, sort_order: intent.capacity?.slot?.index ?? intent.sort_order,
      item_type: intent.row?.item_type || 'lesson', placement_kind: intent.kind, is_explicit_schedule: intent.kind === 'scheduled',
      is_provisional: false, needs_placement: intent.needs_placement, capacity_conflict: intent.capacity?.capacity_conflict || null,
      is_overdue_intent: overdue, original_placement_date: overdue ? intent.planned_date : null,
      is_deliberate_repeat: latestCompletionByKey.has(intent.key),
      reconciled_forecast_id: intent.reconciled_forecast_id || null,
      original_scheduled_date: intent.kind === 'scheduled' ? intent.planned_date : null,
    })
  }

  const keysWithActualOrIntent = new Set([...actuals.map((actual) => actual.key), ...activeIntents.map((intent) => intent.key)])
  const inferenceCandidates = [...metadata.values()].filter((entry) => !keysWithActualOrIntent.has(entry.lesson_key))
    .sort((left, right) => clean(left.association_id).localeCompare(clean(right.association_id)) || left.lesson_key.localeCompare(right.lesson_key))
  for (const entry of inferenceCandidates) {
    const slot = inferredSubjectSlot({ weeklyPattern: activeRevision?.weekly_pattern, subject: entry.subject, afterDate: today, occupied })
    if (slot) occupied.add(slot.slot)
    output.push({
      ...entry, id: `inferred:${entry.association_id || entry.lesson_key}`, occurrence_id: `inferred:${entry.association_id || entry.lesson_key}`,
      planned_date: slot?.planned_date || today, sort_order: slot?.sort_order || 0, item_type: 'lesson', origin: 'facilitator',
      placement_kind: slot ? 'inferred' : 'needs_placement', is_explicit_schedule: false, is_provisional: Boolean(slot),
      needs_placement: !slot, is_overdue_intent: false, original_placement_date: null,
    })
  }

  for (const item of forecastItems || []) {
    if (item?.lesson_key) continue
    const overdue = isoDate(item.planned_date) < today
    const capacity = standaloneForecastCapacity.get(item)
    output.push({
      ...item, occurrence_id: `syllabus:${item.id || item.lineage_id || `${isoDate(item.planned_date)}:${item.sort_order || 0}:${item.title}`}`,
      planned_date: capacity?.rendered_date || item.planned_date, sort_order: capacity?.slot?.index ?? Number(item.sort_order || 0),
      placement_kind: 'syllabus', readiness_state: 'saved', is_explicit_schedule: false, capacity_conflict: capacity?.capacity_conflict || null,
      is_provisional: false, needs_placement: Boolean(capacity?.needs_placement), is_overdue_intent: overdue, original_placement_date: overdue ? isoDate(item.planned_date) : null,
    })
  }
  return output.sort((left, right) => left.planned_date.localeCompare(right.planned_date)
    || Number(left.sort_order || 0) - Number(right.sort_order || 0)
    || String(left.occurrence_id || left.id || '').localeCompare(String(right.occurrence_id || right.id || '')))
}
