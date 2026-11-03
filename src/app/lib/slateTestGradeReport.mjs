// Shared between the learner's result screen and the facilitator's archived report.
// Full mastery still requires a correct independent demonstration; partial test credit
// reports useful understanding without inventing a mastery claim.
export function slateTestResultStatus(result = {}) {
  const explicit = String(result.judgmentStatus || result.status || '').toLowerCase()
  if (['correct', 'partial', 'incorrect'].includes(explicit)) return explicit
  if (result.correct === true) return 'correct'
  if (result.correct === false) return 'incorrect'
  return 'ungraded'
}

export function summarizeSlateTestResults(results = []) {
  const items = Array.isArray(results) ? results : []
  const counts = { correct: 0, partial: 0, incorrect: 0, ungraded: 0 }
  for (const item of items) counts[slateTestResultStatus(item)] += 1
  const points = counts.correct + counts.partial * 0.5
  const complete = items.length > 0 && counts.ungraded === 0
  return {
    ...counts,
    total: items.length,
    points,
    percentage: complete ? Math.round((points / items.length) * 100) : null,
    complete,
  }
}

export function buildSlateTestReportFromEvents(events = [], recordedPercentage = null) {
  const byQuestion = new Map()
  for (const event of Array.isArray(events) ? events : []) {
    const index = Number(event?.payload?.question_index)
    if (!Number.isInteger(index) || index < 0 || index >= 150) continue
    const row = byQuestion.get(index) || { index }
    if (event.event_type === 'item_presented') {
      row.question = String(event?.payload?.item?.question || '')
      if (event?.payload?.item && typeof event.payload.item === 'object') row.item = event.payload.item
    }
    if (event.event_type === 'answer_evaluated') {
      row.answer = String(event?.payload?.response_value ?? '')
      row.expected = String(event?.payload?.correct_answer ?? '')
      row.correct = event?.result?.correct === true
      row.judgmentStatus = ['correct', 'partial', 'incorrect'].includes(event?.result?.judgment_status)
        ? event.result.judgment_status : null
      row.judgmentReason = typeof event?.payload?.judgment_reason === 'string'
        ? event.payload.judgment_reason : ''
      row.hasEvaluation = true
    }
    byQuestion.set(index, row)
  }
  const items = [...byQuestion.values()].filter(row => row.hasEvaluation).sort((a, b) => a.index - b.index)
  if (!items.length) return null
  const legacy = items.some(item => !item.judgmentStatus || !item.judgmentReason)
  const score = summarizeSlateTestResults(items)
  const recorded = recordedPercentage == null ? null : Number(recordedPercentage)
  return {
    items, legacy, score,
    percentage: Number.isFinite(recorded) ? recorded : score.percentage,
  }
}

/**
 * Keep independent judgments immutable. Facilitator decisions are a separate
 * append-only review layer, never evidence of an independent demonstration.
 */
export function applySlateTestResultOverrides(report, decisions = []) {
  if (!report || !Array.isArray(report.items)) return report
  const ordered = [...(Array.isArray(decisions) ? decisions : [])]
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
      String(a.id || '').localeCompare(String(b.id || '')))
  const byQuestion = new Map()
  for (const row of ordered) {
    const index = Number(row.question_index)
    if (!Number.isInteger(index) || index < 0) continue
    const entry = byQuestion.get(index) || {}
    if (row.action === 'grade' && ['correct', 'partial', 'incorrect'].includes(row.corrected_status)) {
      entry.grade = row
    } else if (row.action === 'question') entry.question = row
    byQuestion.set(index, entry)
  }
  const items = report.items.map((item, position) => {
    const index = Number.isInteger(item.index) ? item.index : position
    const review = byQuestion.get(index)
    return {
      ...item,
      ...(review?.grade ? { facilitatorGradeReview: review.grade } : {}),
      ...(review?.question ? { facilitatorQuestionReview: review.question } : {}),
    }
  })
  const adjustedItems = items.map(item => {
    const status = item.facilitatorGradeReview?.corrected_status
    if (!['correct', 'partial', 'incorrect'].includes(status)) return item
    return { ...item, judgmentStatus: status, correct: status === 'correct' }
  })
  const adjustedScore = summarizeSlateTestResults(adjustedItems)
  return {
    ...report, items, adjustedScore,
    adjustedPercentage: adjustedScore.complete ? adjustedScore.percentage : null,
    gradeReviewed: items.some(row => Boolean(row.facilitatorGradeReview)),
    facilitatorReviewed: items.some(row => Boolean(row.facilitatorGradeReview || row.facilitatorQuestionReview)),
  }
}
