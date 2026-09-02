const DAY_KEYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])

function clean(value) { return String(value || '').trim() }
function subjectKey(value) { return clean(value).toLocaleLowerCase() }

export function syllabusCapacitySlots(weeklyPattern, date) {
  const parsed = new Date(`${String(date || '').slice(0, 10)}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return []
  const rows = weeklyPattern?.[DAY_KEYS[parsed.getUTCDay()]]
  return Array.isArray(rows) ? rows.map((row, index) => ({
    index,
    subject: clean(typeof row === 'string' ? row : row?.subject),
  })) : []
}

export function evaluateManualSyllabusPlacement({ weeklyPattern, date, subject, lessonKey, intents = [] }) {
  const slots = syllabusCapacitySlots(weeklyPattern, date)
  const normalizedDate = String(date || '').slice(0, 10)
  const normalizedLesson = clean(lessonKey)
  const existing = (intents || []).filter((intent) => String(intent?.date || '').slice(0, 10) === normalizedDate)
  if (existing.some((intent) => clean(intent.lesson_key) === normalizedLesson)) return { allowed: true, idempotent: true, total_capacity: slots.length }

  const occupied = new Set()
  const ordered = [...existing].sort((left, right) => Number(left.priority || 0) - Number(right.priority || 0)
    || Number(left.sort_order || 0) - Number(right.sort_order || 0)
    || clean(left.id || left.lesson_key).localeCompare(clean(right.id || right.lesson_key)))
  for (const intent of ordered) {
    const target = subjectKey(intent.subject)
    const matching = slots.find((slot) => subjectKey(slot.subject) === target && !occupied.has(slot.index))
    const available = matching || slots.find((slot) => !occupied.has(slot.index))
    if (available) occupied.add(available.index)
  }
  const subjectSlots = slots.filter((slot) => subjectKey(slot.subject) === subjectKey(subject))
  const openSubjectSlot = subjectSlots.find((slot) => !occupied.has(slot.index))
  if (openSubjectSlot) return {
    allowed: true,
    slot_index: openSubjectSlot.index,
    total_capacity: slots.length,
    subject_capacity: subjectSlots.length,
  }
  const conflict = occupied.size >= slots.length ? 'daily_capacity' : 'subject_capacity'
  const message = conflict === 'daily_capacity'
    ? `${normalizedDate} already has its ${slots.length} planned lesson${slots.length === 1 ? '' : 's'}. Enter the Facilitator PIN to add another lesson anyway.`
    : `${subject || 'This subject'} has no open slot on ${normalizedDate}. Enter the Facilitator PIN to override the subject pattern.`
  return { allowed: false, conflict, message, total_capacity: slots.length, subject_capacity: subjectSlots.length }
}

export function findSnapshotCapacityConflict(snapshot = {}, { schedules = [], associations = [] } = {}) {
  const occupied = new Map()
  const subjectByLesson = new Map((associations || []).map((row) => [clean(row?.lesson_key), clean(row?.subject)]))
  for (const item of snapshot.forecast_items || []) if (item?.lesson_key) subjectByLesson.set(clean(item.lesson_key), clean(item.subject))
  const scheduleRows = [...(schedules || [])].sort((left, right) => String(left?.scheduled_date || '').localeCompare(String(right?.scheduled_date || ''))
    || clean(left?.id || left?.lesson_key).localeCompare(clean(right?.id || right?.lesson_key)))
  for (const row of scheduleRows) {
    const date = String(row?.scheduled_date || '').slice(0, 10)
    if (!date) continue
    if (!occupied.has(date)) occupied.set(date, [])
    const intent = {
      id: row.id,
      lesson_key: clean(row.lesson_key),
      subject: clean(row.subject) || subjectByLesson.get(clean(row.lesson_key)) || '',
      date,
      priority: 0,
    }
    const result = evaluateManualSyllabusPlacement({
      weeklyPattern: snapshot.weekly_pattern,
      date,
      subject: intent.subject,
      lessonKey: intent.lesson_key || `schedule:${clean(row.id)}`,
      intents: occupied.get(date),
    })
    if (!result.allowed) return { ...result, schedule: row }
    occupied.get(date).push(intent)
  }
  const scheduleCountByLesson = new Map()
  for (const row of scheduleRows) scheduleCountByLesson.set(clean(row.lesson_key), (scheduleCountByLesson.get(clean(row.lesson_key)) || 0) + 1)
  const forecastCountByLesson = new Map()
  for (const item of snapshot.forecast_items || []) if (item?.lesson_key) forecastCountByLesson.set(clean(item.lesson_key), (forecastCountByLesson.get(clean(item.lesson_key)) || 0) + 1)
  const items = [...(snapshot.forecast_items || [])].sort((left, right) => String(left?.planned_date || '').localeCompare(String(right?.planned_date || ''))
    || Number(left?.sort_order || 0) - Number(right?.sort_order || 0)
    || clean(left?.id || left?.lineage_id || left?.lesson_key || left?.title).localeCompare(clean(right?.id || right?.lineage_id || right?.lesson_key || right?.title)))
  for (const item of items) {
    const date = String(item?.planned_date || '').slice(0, 10)
    const lessonKey = clean(item?.lesson_key)
    const correspondingSchedule = lessonKey && scheduleCountByLesson.get(lessonKey) === 1 && forecastCountByLesson.get(lessonKey) === 1
    if (correspondingSchedule) continue
    if (!occupied.has(date)) occupied.set(date, [])
    const result = evaluateManualSyllabusPlacement({
      weeklyPattern: snapshot.weekly_pattern,
      date,
      subject: item?.subject,
      lessonKey: lessonKey || `forecast:${clean(item?.id || item?.lineage_id || item?.title)}`,
      intents: occupied.get(date),
    })
    if (!result.allowed) return { ...result, item }
    occupied.get(date).push({
      id: item?.id || item?.lineage_id,
      lesson_key: lessonKey || `forecast:${clean(item?.id || item?.lineage_id || item?.title)}`,
      subject: item?.subject,
      date,
      sort_order: item?.sort_order,
    })
  }
  return null
}

export async function inspectLearnerSyllabusPlacement({ admin, facilitatorId, learnerId, lessonKey, subject, date, excludeScheduleId = null }) {
  const { data: syllabus, error: syllabusError } = await admin.from('syllabi').select('active_revision_id')
    .eq('facilitator_id', facilitatorId).eq('learner_id', learnerId).maybeSingle()
  if (syllabusError) throw syllabusError
  if (!syllabus?.active_revision_id) return { allowed: true, syllabus_active: false }
  const [
    { data: revision, error: revisionError },
    { data: forecast, error: forecastError },
    { data: schedules, error: schedulesError },
    { data: associations, error: associationsError },
  ] = await Promise.all([
    admin.from('syllabus_revisions').select('weekly_pattern').eq('id', syllabus.active_revision_id).maybeSingle(),
    admin.from('syllabus_forecast_items').select('id,lesson_key,subject,planned_date,sort_order').eq('revision_id', syllabus.active_revision_id).eq('planned_date', date),
    admin.from('lesson_schedule').select('id,lesson_key,scheduled_date').eq('learner_id', learnerId).eq('scheduled_date', date),
    admin.from('syllabus_lesson_associations').select('lesson_key,subject').eq('facilitator_id', facilitatorId).eq('learner_id', learnerId),
  ])
  if (revisionError) throw revisionError
  if (forecastError) throw forecastError
  if (schedulesError) throw schedulesError
  if (associationsError) throw associationsError
  if (!revision?.weekly_pattern) return { allowed: false, conflict: 'no_capacity', message: `No normal Syllabus slot is configured for ${date}. Enter the Facilitator PIN to place this lesson anyway.` }
  const effectiveSchedules = (schedules || []).filter((row) => !excludeScheduleId || clean(row.id) !== clean(excludeScheduleId))
  const scheduledKeys = new Set(effectiveSchedules.map((row) => clean(row.lesson_key)))
  const forecastIntents = (forecast || []).filter((row) => !scheduledKeys.has(clean(row.lesson_key))).map((row) => ({
    id: row.id, lesson_key: row.lesson_key, subject: row.subject, date: row.planned_date, sort_order: row.sort_order, priority: 1,
  }))
  const subjectByLesson = new Map((associations || []).map((row) => [clean(row.lesson_key), row.subject]))
  for (const row of forecast || []) subjectByLesson.set(clean(row.lesson_key), row.subject)
  const scheduleIntents = effectiveSchedules.map((row) => ({
    id: row.id, lesson_key: row.lesson_key, subject: subjectByLesson.get(clean(row.lesson_key)) || '', date: row.scheduled_date, priority: 0,
  }))
  return { syllabus_active: true, ...evaluateManualSyllabusPlacement({
    weeklyPattern: revision.weekly_pattern, date, subject, lessonKey, intents: [...scheduleIntents, ...forecastIntents],
  }) }
}
