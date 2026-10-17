// The Liftoff API may already include the next probe at the end of its reply.
// Give that question one interactive transcript line without changing spoken text.
export function separateLiftoffTranscriptQuestion(message, prompt) {
  const text = String(message || '').trim()
  const question = String(prompt || '').trim()
  if (!question) return { response: text, question: '' }
  const lastMatch = text.toLowerCase().lastIndexOf(question.toLowerCase())
  if (lastMatch < 0) return { response: text, question }
  const remainder = text.slice(lastMatch + question.length).trim()
  if (remainder) return { response: text, question: '' }
  return { response: text.slice(0, lastMatch).trim(), question: text.slice(lastMatch).trim() }
}

/**
 * Keep feedback visible while reserving the NEXT question (or test transition)
 * for a learner-controlled button. The state machine may already have advanced,
 * but its next question must not leak into the transcript before that choice.
 */
export function prepareSlateLiftoffAdvance(message, nextQuestion, { turnNumber = 0, readyForTest = false } = {}) {
  const question = String(nextQuestion || '').trim()
  const text = String(message || '').trim()
  const separated = separateLiftoffTranscriptQuestion(text, readyForTest ? '' : question)
  let feedback = separated.response
  if (!readyForTest && question && !separated.question) {
    // A model sometimes embeds the next question before a final sentence.
    // Remove that exact prompt from feedback as well, retaining any other text.
    const index = feedback.toLowerCase().lastIndexOf(question.toLowerCase())
    if (index >= 0) {
      feedback = [feedback.slice(0, index).trim(), feedback.slice(index + question.length).trim()]
        .filter(Boolean).join(' ')
    }
  }
  const turn = Number(turnNumber)
  const validTurn = Number.isSafeInteger(turn) && turn >= 0 ? turn : 0
  return {
    feedback,
    pendingAdvance: readyForTest
      ? { kind: 'test', turnNumber: validTurn }
      : question ? { kind: 'question', turnNumber: validTurn, question } : null,
  }
}

/** Reject stale or malformed saved transitions rather than inventing a next question. */
export function restoreSlateLiftoffAdvance(saved, liftoff) {
  if (!saved || typeof saved !== 'object' || !liftoff) return null
  const turn = liftoff.turnNumber
  if (!Number.isSafeInteger(turn) || saved.turnNumber !== turn) return null
  if (saved.kind === 'test') {
    return liftoff.procedureReleased === true ? { kind: 'test', turnNumber: turn } : null
  }
  const currentQuestion = String(liftoff.currentAction?.problem?.prompt || '').trim()
  if (saved.kind !== 'question' || !currentQuestion || liftoff.procedureReleased === true ||
      saved.question !== currentQuestion) return null
  return { kind: 'question', turnNumber: turn, question: currentQuestion }
}
