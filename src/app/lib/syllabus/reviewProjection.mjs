import { dateOnly } from './timeline.mjs'

const DAY_MS = 86400000
const WEEKDAYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])

function clean(value) { return String(value || '').trim() }

function dateInTimeZone(value, timeZone = 'UTC') {
  const parsed = new Date(value || '')
  if (Number.isNaN(parsed.getTime())) return ''
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(parsed)
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return `${values.year}-${values.month}-${values.day}`
  } catch {
    return parsed.toISOString().slice(0, 10)
  }
}

function utcDate(value) {
  const day = dateOnly(value)
  const parsed = new Date(`${day}T12:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function addDays(value, days) {
  const parsed = utcDate(value)
  if (!parsed) return ''
  return new Date(parsed.getTime() + (days * DAY_MS)).toISOString().slice(0, 10)
}

function weekdayIndex(value) {
  const parsed = utcDate(value)
  return parsed ? parsed.getUTCDay() : -1
}

function nextReviewDate(value, reviewDay) {
  const current = weekdayIndex(value)
  const target = WEEKDAYS.indexOf(clean(reviewDay).toLowerCase())
  if (current < 0 || target < 0) return ''
  let delta = (target - current + 7) % 7
  if (delta === 0) delta = 7
  return addDays(value, delta)
}

function lessonIdentity(item = {}) {
  return clean(
    item.source_occurrence_id
      || item.occurrence_id
      || item.lineage_id
      || item.id
      || `${item.lesson_key || ''}:${item.planned_date || ''}:${item.sort_order || 0}`,
  )
}

function isInstructionalLesson(item = {}) {
  if ((item.item_type || 'lesson') !== 'lesson') return false
  if (!clean(item.lesson_key)) return false
  if (item.historical_record === true) return false
  return Boolean(dateOnly(item.planned_date))
}

function isCompleted(item = {}) {
  return item.readiness_state === 'completed' || item.actual_kind === 'completed'
}

function dedupeLessons(items = []) {
  const chosen = new Map()
  for (const item of items || []) {
    if (!isInstructionalLesson(item)) continue
    const id = lessonIdentity(item)
    if (!id) continue
    const current = chosen.get(id)
    if (!current || (isCompleted(item) && !isCompleted(current))) chosen.set(id, item)
  }
  return [...chosen.values()]
}

function lessonProgress(item = {}) {
  return {
    id: lessonIdentity(item),
    lesson_key: clean(item.lesson_key),
    title: clean(item.title) || 'Lesson',
    subject: clean(item.subject) || 'General',
    completed: isCompleted(item),
  }
}

export function buildDailyReviewCycles({
  timelineItems = [],
  enabled = false,
  today = '',
  timeZone = 'UTC',
} = {}) {
  if (!enabled) return []
  const grouped = new Map()
  for (const lesson of dedupeLessons(timelineItems)) {
    const plannedDate = dateOnly(lesson.planned_date)
    if (!plannedDate) continue
    if (!grouped.has(plannedDate)) grouped.set(plannedDate, [])
    grouped.get(plannedDate).push(lesson)
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reviewDate, lessons]) => {
      const progress = lessons.map(lessonProgress)
      const completedCount = progress.filter((entry) => entry.completed).length
      return {
        review_type: 'daily_review',
        cycleKey: `${timeZone}:${reviewDate}`,
        reviewDate,
        timeZone,
        lessonKeys: [...new Set(progress.map((entry) => entry.lesson_key).filter(Boolean))],
        lessons: progress,
        lessonCount: progress.length,
        completedCount,
        ready: progress.length > 0 && completedCount === progress.length && (!today || reviewDate === dateOnly(today)),
      }
    })
}

export function buildWeeklyReviewCycles({
  timelineItems = [],
  enabled = false,
  reviewDay = 'friday',
  today = '',
  timeZone = 'UTC',
} = {}) {
  if (!enabled) return []
  const grouped = new Map()
  for (const lesson of dedupeLessons(timelineItems)) {
    const plannedDate = dateOnly(lesson.planned_date)
    const reviewDate = nextReviewDate(plannedDate, reviewDay)
    if (!reviewDate) continue
    if (!grouped.has(reviewDate)) grouped.set(reviewDate, [])
    grouped.get(reviewDate).push(lesson)
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reviewDate, lessons]) => {
      const progress = lessons.map(lessonProgress)
      const completedCount = progress.filter((entry) => entry.completed).length
      return {
        review_type: 'weekly_review',
        cycleKey: `${timeZone}:${reviewDate}`,
        reviewDate,
        timeZone,
        windowStartDate: addDays(reviewDate, -7),
        windowEndDate: reviewDate,
        lessonKeys: [...new Set(progress.map((entry) => entry.lesson_key).filter(Boolean))],
        lessons: progress,
        lessonCount: progress.length,
        completedCount,
        ready: progress.length > 0 && completedCount === progress.length && (!today || reviewDate <= dateOnly(today)),
      }
    })
}

export function buildSyllabusReviewProjection({
  timelineItems = [],
  settings = {},
  today = '',
  timeZone = 'UTC',
  availability = null,
} = {}) {
  const daily = buildDailyReviewCycles({
    timelineItems,
    enabled: settings.daily_followups_enabled === true,
    today,
    timeZone,
  })
  const weekly = buildWeeklyReviewCycles({
    timelineItems,
    enabled: settings.weekly_reviews_enabled === true,
    reviewDay: settings.weekly_review_day || 'friday',
    today,
    timeZone,
  })
  const cards = Array.isArray(availability?.cards) ? availability.cards : []
  const completedCycles = Array.isArray(availability?.completed_cycles) ? availability.completed_cycles : []
  const cardByCycle = new Map(cards.map((card) => [`${card.review_type}:${card.cycle_key}`, card]))
  const completedByCycle = new Map(completedCycles.map((run) => [`${run.review_type}:${run.cycle_key}`, run]))

  const items = [...daily, ...weekly].map((cycle) => {
    const key = `${cycle.review_type}:${cycle.cycleKey}`
    const card = cardByCycle.get(key) || null
    const completedRun = completedByCycle.get(key) || null
    const completed = Boolean(completedRun)
    if (today && cycle.reviewDate < dateOnly(today) && !card && !completed) return null
    const status = completed
      ? 'completed'
      : card?.resume
        ? 'in_progress'
        : card
          ? 'available'
          : cycle.ready
            ? 'waiting_review_material'
            : 'pending_lessons'
    const label = cycle.review_type === 'daily_review' ? 'Daily Review' : 'Weekly Review'
    return {
      id: `review:${key}`,
      occurrence_id: `review:${key}`,
      item_type: 'review',
      review_type: cycle.review_type,
      cycle_key: cycle.cycleKey,
      planned_date: completedRun?.completed_at ? (dateInTimeZone(completedRun.completed_at, cycle.timeZone || timeZone) || cycle.reviewDate) : cycle.reviewDate,
      sort_order: 1000000,
      subject: 'Review',
      title: label,
      description: cycle.review_type === 'daily_review'
        ? 'Review the learning completed on this day.'
        : 'Review recent learning from this weekly cycle.',
      placement_kind: 'review',
      readiness_state: completed ? 'completed' : status,
      review_status: status,
      review_ready: Boolean(card) && !completed,
      review_card_id: card?.id || null,
      review_run_id: card?.run_id || null,
      review_remaining_count: card?.remaining_count ?? null,
      review_progress: {
        completed_count: cycle.completedCount,
        total_count: cycle.lessonCount,
        lessons: cycle.lessons,
      },
      completed_at: completedRun?.completed_at || null,
    }
  }).filter(Boolean)

  return {
    dailyReviewCycles: daily,
    weeklyReviewCycles: weekly,
    items,
  }
}
