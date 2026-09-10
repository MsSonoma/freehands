import { instructionalSubjectKey, subjectBalancedInstructionalEvidenceContext } from './evidenceProjection.mjs'

const CORE_SUBJECT_STRANDS = Object.freeze({
  math: Object.freeze([
    'number sense and operations',
    'fractions, decimals, and rational-number reasoning',
    'patterns and algebraic thinking',
    'measurement and units',
    'geometry and spatial reasoning',
    'data, graphs, and probability',
    'mathematical modeling and multi-step problem solving',
  ]),
  'language arts': Object.freeze([
    'literature and reading comprehension',
    'informational reading and research',
    'writing and composition',
    'grammar, usage, and conventions',
    'vocabulary and word study',
    'speaking, listening, and presentation',
  ]),
  science: Object.freeze([
    'life science',
    'physical science',
    'earth and space science',
    'scientific inquiry and experimental reasoning',
    'engineering, systems, and design',
  ]),
  'social studies': Object.freeze([
    'history and chronology',
    'geography and human-environment relationships',
    'civics and government',
    'economics',
    'culture and society',
    'historical sources and evidence',
  ]),
})

const NO_UNRESOLVED = new Set([
  '', 'none', 'no', 'n/a', 'not applicable', 'none identified', 'no unresolved evidence',
  'nothing unresolved', 'no unresolved learning',
])

function clean(value) { return String(value || '').trim() }
function subjectKey(value) { return instructionalSubjectKey(value) }
function canonicalSubject(value) { return instructionalSubjectKey(value) }

function uniqueSubjects(slots = []) {
  const seen = new Set()
  const result = []
  for (const slot of slots || []) {
    const subject = clean(slot?.subject)
    const key = subjectKey(subject)
    if (!subject || seen.has(key)) continue
    seen.add(key)
    result.push(subject)
  }
  return result
}
function meaningfulUnresolved(value) {
  const normalized = clean(value).toLocaleLowerCase()
  return normalized && !NO_UNRESOLVED.has(normalized)
}
function futureIntentRows({ subject, forecastItems = [], timelineItems = [], today }) {
  const target = subjectKey(subject)
  const rows = []
  const seen = new Set()
  for (const item of [...(forecastItems || []), ...(timelineItems || [])]) {
    const plannedDate = clean(item?.planned_date).slice(0, 10)
    if (!plannedDate || (today && plannedDate < today) || subjectKey(item?.subject) !== target) continue
    if (item?.placement_kind === 'actual' || item?.placement_kind === 'historical' || item?.actual_kind === 'completed' || item?.readiness_state === 'completed') continue
    const title = clean(item?.title)
    if (!title) continue
    const strand = clean(item?.metadata?.learning_forecast?.strand)
    const key = `${plannedDate}:${title.toLocaleLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ planned_date: plannedDate, title, ...(strand ? { strand } : {}) })
  }
  return rows.sort((left, right) => left.planned_date.localeCompare(right.planned_date)).slice(0, 12)
}

function historicalTerritoryRows({ subject, timelineItems = [], today, limit = 12 }) {
  const target = subjectKey(subject)
  const rows = []
  for (const item of timelineItems || []) {
    const plannedDate = clean(item?.planned_date).slice(0, 10)
    if (!plannedDate || (today && plannedDate > today) || subjectKey(item?.subject) !== target) continue
    if (item?.supplemental === true || item?.placement_kind === 'slate_assignment' || item?.historical_activity_only === true) continue
    const instructionalHistory = item?.actual_kind === 'completed'
      || item?.readiness_state === 'completed'
      || item?.placement_kind === 'historical'
    if (!instructionalHistory) continue
    const title = clean(item?.title)
    if (!title) continue
    rows.push({ planned_date: plannedDate, title })
  }
  rows.sort((left, right) => right.planned_date.localeCompare(left.planned_date))
  const seenTitles = new Set()
  return rows.filter((row) => {
    const key = row.title.toLocaleLowerCase()
    if (seenTitles.has(key)) return false
    seenTitles.add(key)
    return true
  }).slice(0, limit)
}

export function broadInstructionalStrands(subject) {
  return [...(CORE_SUBJECT_STRANDS[canonicalSubject(subject)] || [])]
}

export function buildSubjectBreadthContext({
  learnerGrade,
  slots = [],
  reports = [],
  forecastItems = [],
  timelineItems = [],
  today = null,
  perSubjectEvidenceLimit = 8,
} = {}) {
  const requestedSubjects = uniqueSubjects(slots)
  const balancedEvidence = subjectBalancedInstructionalEvidenceContext(reports, requestedSubjects, { perSubjectLimit: perSubjectEvidenceLimit })
  return {
    learner_grade: clean(learnerGrade) || null,
    planning_principle: 'Learning history is evidence, not an instruction to continue the most recent topic. Preserve necessary prerequisite sequences, then deliberately maintain breadth across the subject.',
    subjects: requestedSubjects.map((subject) => {
      const key = subjectKey(subject)
      const recentLearning = balancedEvidence.filter((report) => subjectKey(report?.lesson?.subject) === key)
      const unresolved = recentLearning.filter((report) => (
        meaningfulUnresolved(report?.learning_summary?.unresolved)
        || (report?.completeness && report.completeness !== 'complete')
      )).slice(0, 4).map((report) => ({
        title: report.lesson?.title || null,
        unresolved: report.learning_summary?.unresolved || null,
        completeness: report.completeness || null,
      }))
      const strands = broadInstructionalStrands(subject)
      return {
        subject,
        map_source: strands.length ? 'broad_subject_domains' : 'infer_for_custom_subject',
        broad_strands: strands,
        recent_learning: recentLearning,
        recent_topic_history: historicalTerritoryRows({ subject, timelineItems, today }),
        unresolved_instructional_signals: unresolved,
        future_intent: futureIntentRows({ subject, forecastItems, timelineItems, today }),
        default_planning_move: unresolved.length ? 'evaluate_continue_or_return_then_branch' : 'branch',
      }
    }),
  }
}

export function forecastPlanningMetadata(item = {}) {
  const planningMove = clean(item.planning_move)
  const strand = clean(item.strand)
  const planningReason = clean(item.planning_reason)
  return {
    ...(planningMove ? { planning_move: planningMove } : {}),
    ...(strand ? { strand } : {}),
    ...(planningReason ? { planning_reason: planningReason } : {}),
  }
}
