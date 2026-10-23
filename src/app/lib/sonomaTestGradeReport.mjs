// Read-only reconstruction of Sonoma Test grading. The original first-response
// events are never edited when a facilitator later revises the reported grade.
import { summarizeSlateTestResults } from './slateTestGradeReport.mjs'

const STATUSES = new Set(['correct', 'partial', 'incorrect', 'ungraded'])
const asIndex = (value) => {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && n < 150 ? n : null
}
const clean = (v) => v == null ? '' : String(v)

// Retain the actual prior decision when resuming snapshots written before
// Sonoma began storing three-way verdicts. This does not rejudge the learner.
export function normalizeSavedSonomaTestAnswers(answers = []) {
  if (!Array.isArray(answers)) return []
  return answers.map((item) => {
    if (!item || typeof item !== 'object') return { judgmentStatus: 'ungraded', judgmentReason: 'No saved answer data.' }
    if (STATUSES.has(item.judgmentStatus)) return { ...item }
    const status = item.isCorrect === true ? 'correct'
      : item.isCorrect === false ? 'incorrect' : 'ungraded'
    return {
      ...item,
      judgmentStatus: status,
      judgmentReason: item.judgmentReason || 'Legacy evaluation: no reason was saved.',
      legacyEvaluation: true,
    }
  })
}

export function buildSonomaTestGradeReport(events = [], recordedPercentage = null) {
  const byQuestion = new Map()
  const presentedIndices = new Set()
  let expectedCount = null
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.phase !== 'test') continue
    const payload = event?.payload || {}
    const declared = Number(payload.total_questions)
    if (payload.total_questions != null && Number.isInteger(declared) && declared > 0) {
      expectedCount = Math.max(expectedCount || 0, declared)
    }
    const index = asIndex(payload.question_index)
    if (index == null) continue
    const row = byQuestion.get(index) || { index, reviews: [] }
    if (event.event_type === 'item_presented') {
      presentedIndices.add(index)
      row.question = clean(payload.item?.question || payload.item?.text || row.question)
      row.itemId = clean(event.stable_item_id || event.item_id || row.itemId)
    }
    if (event.event_type === 'answer_evaluated') {
      row.answer = clean(payload.response_value)
      row.referenceAnswer = clean(payload.correct_answer)
      row.originalStatus = STATUSES.has(event?.result?.judgment_status)
        ? event.result.judgment_status
        : (typeof event?.result?.correct === 'boolean'
          ? (event.result.correct ? 'correct' : 'incorrect') : 'ungraded')
      row.originalReason = clean(payload.judgment_reason)
      row.judgmentStatus = row.originalStatus
      row.judgmentReason = row.originalReason
      row.isCorrect = row.originalStatus === 'correct'
      row.hasEvaluation = true
      row.legacy = !row.originalReason
    }
    if (event.event_type === 'test_grade_reviewed') {
      const status = clean(payload.revised_status)
      if (STATUSES.has(status) && status !== 'ungraded') {
        const review = {
          status, reason: clean(payload.revised_reason),
          reviewedBy: clean(payload.reviewed_by),
          reviewedAt: event.occurred_at || null,
          previousStatus: clean(payload.previous_status),
        }
        row.reviews.push(review)
        row.judgmentStatus = status
        row.judgmentReason = review.reason
        row.isCorrect = status === 'correct'
      }
    }
    byQuestion.set(index, row)
  }
  const items = [...byQuestion.values()].filter(row => row.hasEvaluation).sort((a,b) => a.index-b.index)
  if (!items.length) return null
  const normalized = items.map(item => ({
    ...item,
    correct: item.judgmentStatus === 'correct'
      ? true : (item.judgmentStatus === 'ungraded' ? null : false),
  }))
  const summary = summarizeSlateTestResults(normalized)
  if (expectedCount == null && presentedIndices.size) expectedCount = presentedIndices.size
  const incomplete = expectedCount == null || summary.total !== expectedCount
  const derivedPercentage = incomplete ? null : summary.percentage
  const recorded = recordedPercentage == null || recordedPercentage === '' ? null : Number(recordedPercentage)
  const numericRecorded = Number.isFinite(recorded) ? recorded : null
  return {
    items, score: summary,
    recordedPercentage: numericRecorded,
    expectedCount,
    observedCount: summary.total,
    incomplete,
    derivedPercentage,
    scoreMismatch: numericRecorded != null && derivedPercentage != null
      && numericRecorded !== derivedPercentage,
    legacy: items.some(item => item.legacy),
  }
}
