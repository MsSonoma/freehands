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
