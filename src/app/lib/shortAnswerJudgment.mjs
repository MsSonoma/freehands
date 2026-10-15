// Interpret the structured semantic judgment returned by the shared short-answer API.
// An incomplete or malformed model response is NEVER a wrong learner answer.
export const SHORT_ANSWER_STATUSES = Object.freeze(['correct', 'partial', 'incorrect'])

export function parseShortAnswerJudgment(raw) {
  let result
  try { result = JSON.parse(String(raw || '')) }
  catch { throw new Error('The learning evaluator returned invalid JSON.') }
  const status = String(result?.status || '').trim().toLowerCase()
  const reason = typeof result?.reason === 'string' ? result.reason.trim() : ''
  if (!SHORT_ANSWER_STATUSES.includes(status) || reason.length < 6) {
    throw new Error('The learning evaluator returned an incomplete judgment.')
  }
  return { status, correct: status === 'correct', reason: reason.slice(0, 400) }
}
