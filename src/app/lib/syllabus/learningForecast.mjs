import { createHash } from 'node:crypto'
import { FACILITATOR_EVIDENCE_REPORT_VERSION } from '../masteryEvidence/reporting.js'
import { addSyllabusDays, startOfSyllabusWeek } from './timeline.mjs'

const DAY_KEYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])

function clean(value) { return String(value || '').trim() }
function duplicatesSlateAuthority(value) {
  return /\b(daily follow[- ]?up|weekly review|retention check|recovery session|mastery check)\b/i.test(String(value || ''))
}
function stableUuid(value) {
  const hex = createHash('sha256').update(String(value)).digest('hex').slice(0, 32).split('')
  hex[12] = '4'
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4]
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}

function evidenceContext(reports = []) {
  return reports.filter((report) => report?.report_version === FACILITATOR_EVIDENCE_REPORT_VERSION).slice(0, 12).map((report) => ({
    report_version: report.report_version,
    lesson: {
      key: clean(report.lesson?.key || report.lesson?.source_key) || null,
      title: clean(report.lesson?.title) || null,
      subject: clean(report.lesson?.subject) || null,
    },
    completeness: clean(report.completeness?.state) || null,
    baseline: clean(report.baseline?.state) || null,
    independent: clean(report.independent_evidence?.state) || null,
    retention: clean(report.retention?.state) || null,
    learning_summary: report.learning_summary ? {
      headline: clean(report.learning_summary.headline) || null,
      narrative: clean(report.learning_summary.narrative) || null,
      unresolved: clean(report.learning_summary.unresolved?.label) || null,
    } : null,
  }))
}

export function nextInstructionalForecastWeek(today) {
  return addSyllabusDays(startOfSyllabusWeek(today), 7)
}

export function instructionalSlotsForWeek(weeklyPattern, weekStart) {
  const slots = []
  for (let offset = 0; offset < 7; offset++) {
    const plannedDate = addSyllabusDays(weekStart, offset)
    const day = DAY_KEYS[new Date(`${plannedDate}T12:00:00.000Z`).getUTCDay()]
    const entries = Array.isArray(weeklyPattern?.[day]) ? weeklyPattern[day] : []
    entries.forEach((entry, sortOrder) => {
      const subject = clean(typeof entry === 'string' ? entry : entry?.subject)
      if (subject) slots.push({ planned_date: plannedDate, subject, sort_order: sortOrder })
    })
  }
  return slots
}

function inputIdentity({ activeRevision, forecastItems, timelineItems, reports, targetWeekStart, targetWeekEnd }) {
  return createHash('sha256').update(JSON.stringify({
    active_revision_id: activeRevision.id,
    target_week: [targetWeekStart, targetWeekEnd],
    goals: activeRevision.goals,
    subjects: activeRevision.subjects,
    weekly_pattern: activeRevision.weekly_pattern,
    teaching_guidance: activeRevision.teaching_guidance,
    planning_policy: activeRevision.planning_policy,
    forecast_items: forecastItems.map((item) => ({
      lineage_id: item.lineage_id,
      planned_date: String(item.planned_date).slice(0, 10),
      subject: item.subject,
      title: item.title,
      description: item.description || null,
      lesson_key: item.lesson_key || null,
      item_type: item.item_type,
      origin: item.origin,
      sort_order: item.sort_order,
    })),
    occupied_timeline: timelineItems.filter((item) => {
      const date = String(item?.planned_date || '').slice(0, 10)
      return date >= targetWeekStart && date <= targetWeekEnd
    }).map((item) => ({
      occurrence_id: item.occurrence_id || item.id,
      planned_date: String(item.planned_date).slice(0, 10),
      subject: item.subject,
      sort_order: item.sort_order,
      lesson_key: item.lesson_key || null,
    })),
    evidence: evidenceContext(reports),
  })).digest('hex')
}

export function buildInstructionalForecastPlan({ activeRevision, forecastItems = [], timelineItems = [], reports = [], today }) {
  if (!activeRevision?.id) throw new Error('An active Syllabus revision is required')
  const targetWeekStart = nextInstructionalForecastWeek(today)
  const targetWeekEnd = addSyllabusDays(targetWeekStart, 6)
  const slots = instructionalSlotsForWeek(activeRevision.weekly_pattern, targetWeekStart)
  const occupied = new Set(timelineItems.filter((item) => {
    const date = String(item?.planned_date || '').slice(0, 10)
    return date >= targetWeekStart && date <= targetWeekEnd
  }).map((item) => `${String(item.planned_date).slice(0, 10)}:${Number(item.sort_order || 0)}`))
  const unfilledSlots = slots.filter((slot) => !occupied.has(`${slot.planned_date}:${slot.sort_order}`))
  const proposalKey = inputIdentity({ activeRevision, forecastItems, timelineItems, reports, targetWeekStart, targetWeekEnd })
  return {
    proposal_key: proposalKey,
    target_week_start: targetWeekStart,
    target_week_end: targetWeekEnd,
    slots,
    unfilled_slots: unfilledSlots,
    evidence_context: evidenceContext(reports),
  }
}

export function buildLearningForecastSnapshot({ activeRevision, forecastItems = [], plan, generatedItems = [], today }) {
  if (generatedItems.length !== plan.unfilled_slots.length) throw new Error('Forecast model returned an unexpected number of items')
  const additions = plan.unfilled_slots.map((slot, index) => {
    const generated = generatedItems[index] || {}
    const title = clean(generated.title).slice(0, 300)
    const description = clean(generated.description).slice(0, 2000)
    if (!title || !description) throw new Error('Forecast model returned an incomplete instructional forecast')
    if (duplicatesSlateAuthority(`${title} ${description}`)) throw new Error('Forecast model crossed the instructional authority boundary')
    return {
      lineage_id: stableUuid(`${plan.proposal_key}:${slot.planned_date}:${slot.sort_order}:${slot.subject.toLocaleLowerCase()}`),
      planned_date: slot.planned_date,
      subject: slot.subject,
      title,
      description,
      lesson_key: null,
      item_type: 'lesson',
      origin: 'learning_forecast',
      sort_order: slot.sort_order,
      metadata: {
        learning_forecast: {
          proposal_key: plan.proposal_key,
          base_revision_id: activeRevision.id,
          target_week_start: plan.target_week_start,
        },
      },
    }
  })
  const retained = structuredClone(forecastItems).filter((item) => String(item?.planned_date || '').slice(0, 10) >= today)
  const allItems = [...retained, ...additions].sort((left, right) => (
    String(left.planned_date).localeCompare(String(right.planned_date))
    || Number(left.sort_order || 0) - Number(right.sort_order || 0)
    || String(left.lineage_id).localeCompare(String(right.lineage_id))
  ))
  return {
    additions,
    snapshot: {
      effective_from: today,
      goals: structuredClone(activeRevision.goals),
      subjects: structuredClone(activeRevision.subjects),
      weekly_pattern: structuredClone(activeRevision.weekly_pattern),
      teaching_guidance: structuredClone(activeRevision.teaching_guidance),
      planning_policy: structuredClone(activeRevision.planning_policy),
      legacy_provenance: structuredClone(activeRevision.legacy_provenance),
      forecast_items: allItems,
      change_reason: `Instructional learning forecast proposal: week of ${plan.target_week_start}`,
    },
  }
}
