import { createHash } from 'node:crypto'
import { FACILITATOR_EVIDENCE_REPORT_VERSION } from '../masteryEvidence/reporting.js'

const ACTIONS = Object.freeze({
  consider_review: [{ item_type: 'review', title_prefix: 'Review' }],
  consider_future_independent_check: [{ item_type: 'check', title_prefix: 'Independent check' }],
  consider_review_then_check: [
    { item_type: 'review', title_prefix: 'Review' },
    { item_type: 'check', title_prefix: 'Independent check' },
  ],
})
const DAY_KEYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function stableUuid(value) {
  const hex = createHash('sha256').update(String(value)).digest('hex').slice(0, 32).split('')
  hex[12] = '4'
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4]
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}

function reportLessonKey(report) {
  return cleanText(report?.lesson?.key)
    || cleanText(report?.lesson?.source_key)
    || cleanText(report?.lesson?.id)
    || null
}

function reportSubject(report) {
  const explicit = cleanText(report?.lesson?.subject)
  if (explicit) return explicit
  const key = reportLessonKey(report)
  const slash = key?.replace(/\\/g, '/').indexOf('/') ?? -1
  if (slash < 1) return null
  const prefix = key.slice(0, slash).replace(/_/g, ' ')
  return prefix.toLocaleLowerCase() === 'generated' ? null : prefix
}

function findingFor(report, actionKind) {
  if (actionKind === 'consider_review') return report?.retention
  return report?.independent_evidence
}

function titleTarget(report, anchor) {
  const source = cleanText(report?.lesson?.title) || cleanText(anchor?.title) || 'the current learning target'
  return source.replace(/^(review|independent check):\s*/i, '')
}

function evidenceReference(report, option) {
  const finding = findingFor(report, option.kind) || {}
  return {
    report_version: cleanText(report?.report_version) || null,
    evidence_session_id: cleanText(report?.provenance?.evidence_session_id) || null,
    session_id: cleanText(report?.session?.id) || null,
    lesson_key: reportLessonKey(report),
    target: {
      scope: cleanText(report?.target?.scope) || null,
      concept_id: cleanText(report?.target?.concept_id) || null,
    },
    recommendation: {
      kind: option.kind,
      label: cleanText(option.label) || null,
    },
    finding: {
      state: cleanText(finding?.state) || null,
      label: cleanText(finding?.label) || null,
    },
  }
}

function proposalKey(baseRevisionId, actions) {
  return createHash('sha256').update(JSON.stringify({
    base_revision_id: baseRevisionId,
    actions: actions.map(({ subject, option, report }) => ({
      subject: subject.toLocaleLowerCase(),
      recommendation: option.kind,
      evidence_session_id: report?.provenance?.evidence_session_id || null,
      session_id: report?.session?.id || null,
      lesson_key: reportLessonKey(report),
    })),
  })).digest('hex')
}

function subjectSlotsForDay(weeklyPattern, day, subjectKey) {
  return (weeklyPattern?.[day] || []).flatMap((entry, index) => {
    const subject = cleanText(typeof entry === 'string' ? entry : entry?.subject).toLocaleLowerCase()
    return subject === subjectKey ? [{ sort_order: index }] : []
  })
}

function projectSubjectSlots({ weeklyPattern, subjectKey, afterDate, count }) {
  const slots = []
  const cursor = new Date(`${afterDate}T00:00:00.000Z`)
  if (Number.isNaN(cursor.getTime())) return null
  for (let dayOffset = 1; dayOffset <= 371 && slots.length < count; dayOffset++) {
    const date = new Date(cursor)
    date.setUTCDate(cursor.getUTCDate() + dayOffset)
    const plannedDate = date.toISOString().slice(0, 10)
    const daySlots = subjectSlotsForDay(weeklyPattern, DAY_KEYS[date.getUTCDay()], subjectKey)
    for (const slot of daySlots) {
      slots.push({ planned_date: plannedDate, sort_order: slot.sort_order })
      if (slots.length === count) break
    }
  }
  return slots.length === count ? slots : null
}

export function describeMasteryProposal(items = []) {
  return items
    .filter((item) => item?.origin === 'mastery_reforecast' && item?.metadata?.mastery_reforecast)
    .map((item) => {
      const provenance = item.metadata.mastery_reforecast
      return {
        subject: item.subject,
        planned_date: item.planned_date,
        item_type: item.item_type,
        title: item.title,
        recommendation: provenance.recommendation,
        finding: provenance.finding,
      }
    })
}

export function buildMasteryReforecast({ activeRevision, forecastItems = [], reports = [], today }) {
  if (!activeRevision?.id) throw new Error('An active Syllabus revision is required')
  const declaredSubjects = new Map((activeRevision.subjects || []).map((item) => [
    cleanText(typeof item === 'string' ? item : item?.name).toLocaleLowerCase(),
    cleanText(typeof item === 'string' ? item : item?.name),
  ]).filter(([key]) => key))
  const futureItems = structuredClone(forecastItems)
    .filter((item) => cleanText(item?.planned_date) >= today)
    .sort((left, right) => left.planned_date.localeCompare(right.planned_date) || left.sort_order - right.sort_order)
  const firstReportBySubject = new Map()

  for (const report of reports || []) {
    if (report?.report_version !== FACILITATOR_EVIDENCE_REPORT_VERSION) continue
    const rawSubject = reportSubject(report)
    const subjectKey = cleanText(rawSubject).toLocaleLowerCase()
    if (!subjectKey || !declaredSubjects.has(subjectKey) || firstReportBySubject.has(subjectKey)) continue
    firstReportBySubject.set(subjectKey, report)
  }

  const actions = []
  for (const [subjectKey, report] of firstReportBySubject) {
    const option = (report?.options || []).find((item) => item?.evidence_kind === 'proposed' && ACTIONS[item?.kind])
    if (!option) continue
    const anchor = futureItems.find((item) => cleanText(item.subject).toLocaleLowerCase() === subjectKey)
    if (!anchor) continue
    actions.push({ subject: declaredSubjects.get(subjectKey), subjectKey, report, option, anchor })
  }
  if (!actions.length) return null

  const key = proposalKey(activeRevision.id, actions)
  const additions = []
  const rippledItems = []
  const affectedSubjects = new Set(actions.map((action) => action.subjectKey))
  for (const action of actions) {
    const descriptors = ACTIONS[action.option.kind]
    const reference = evidenceReference(action.report, action.option)
    const subjectItems = futureItems.filter((item) => cleanText(item.subject).toLocaleLowerCase() === action.subjectKey)
    const existingSlots = subjectItems.map((item) => ({
      planned_date: item.planned_date,
      sort_order: item.sort_order,
    }))
    const projectedSlots = projectSubjectSlots({
      weeklyPattern: activeRevision.weekly_pattern,
      subjectKey: action.subjectKey,
      afterDate: existingSlots.at(-1).planned_date,
      count: descriptors.length,
    })
    if (!projectedSlots) {
      return {
        kind: 'no_action',
        reason: `The approved weekly pattern does not provide enough future ${action.subject} slots for an honest mastery follow-up sequence.`,
      }
    }
    const slots = [...existingSlots, ...projectedSlots]
    descriptors.forEach((descriptor, index) => {
      const slot = slots[index]
      additions.push({
        lineage_id: stableUuid(`${key}:${action.subjectKey}:${action.option.kind}:${descriptor.item_type}:${index}`),
        planned_date: slot.planned_date,
        subject: action.subject,
        title: `${descriptor.title_prefix}: ${titleTarget(action.report, action.anchor)}`,
        lesson_key: reportLessonKey(action.report) || action.anchor.lesson_key || null,
        item_type: descriptor.item_type,
        origin: 'mastery_reforecast',
        sort_order: slot.sort_order,
        metadata: {
          mastery_reforecast: {
            proposal_key: key,
            base_revision_id: activeRevision.id,
            anchor_lineage_id: action.anchor.lineage_id || null,
            ...reference,
          },
        },
      })
    })
    subjectItems.forEach((item, index) => {
      const slot = slots[index + descriptors.length]
      rippledItems.push({ ...item, planned_date: slot.planned_date, sort_order: slot.sort_order })
    })
  }

  const unaffectedItems = futureItems.filter((item) => !affectedSubjects.has(cleanText(item.subject).toLocaleLowerCase()))
  const forecast = [...unaffectedItems, ...rippledItems, ...additions]
    .sort((left, right) => left.planned_date.localeCompare(right.planned_date)
      || left.sort_order - right.sort_order
      || left.title.localeCompare(right.title))
  const reasons = actions.map(({ subject, option }) => `${subject}: ${cleanText(option.label)}`).filter(Boolean)

  return {
    kind: 'proposal',
    proposal_key: key,
    snapshot: {
      effective_from: today,
      goals: structuredClone(activeRevision.goals),
      subjects: structuredClone(activeRevision.subjects),
      weekly_pattern: structuredClone(activeRevision.weekly_pattern),
      teaching_guidance: structuredClone(activeRevision.teaching_guidance),
      planning_policy: structuredClone(activeRevision.planning_policy),
      legacy_provenance: structuredClone(activeRevision.legacy_provenance),
      forecast_items: forecast,
      change_reason: `Mastery evidence proposal: ${reasons.join(' ')}`,
    },
    changes: describeMasteryProposal(additions),
  }
}
