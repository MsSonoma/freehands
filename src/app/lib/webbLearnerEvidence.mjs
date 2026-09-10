/** Source identity, not model-authored prose, owns a learner note. */
export function learnerMessageIndex(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null
  const index = Number(value)
  return Number.isSafeInteger(index) && index >= 0 ? index : null
}

export function sourceLearnerMessage(conversation, sourceMessageIndex) {
  const index = learnerMessageIndex(sourceMessageIndex)
  if (index === null) return null
  const message = conversation?.[index]
  if (message?.role !== 'user' || typeof message.content !== 'string' || !message.content.trim()) return null
  return { message, index, text: message.content }
}

// Legacy replies only. New replies select the whole message without echoing text.
// Preserve numbers, negation and word order when tolerating harmless formatting.
function normalizeQuote(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '')
}

export function evaluationSource(conversation, evaluation) {
  const source = sourceLearnerMessage(conversation, evaluation?.sourceMessageIndex)
  if (!source) return null
  const quote = String(evaluation?.quote ?? '').trim()
  if (quote && !source.text.includes(quote)) {
    const normalized = normalizeQuote(quote)
    if (!normalized || !normalizeQuote(source.text).includes(normalized)) return null
  }
  return source
}

export function createLearnerNote({ objectiveIndex, evaluation, conversation, capturedAt }) {
  if (evaluation?.accuracy !== 'correct') return null
  const source = evaluationSource(conversation, evaluation)
  if (!source) return null
  return {
    objectiveIndex,
    text: source.text,
    sourceMessageIndex: source.index,
    sourceMessageId: source.message.id || null,
    sourceMessageCreatedAt: source.message.createdAt || null,
    accuracy: 'correct',
    sentenceReadyAtCapture: evaluation.sentenceOk === true,
    capturedAt: capturedAt || new Date().toISOString(),
    assistance: 'mrs-webb-research-conversation',
    provenance: 'learner-message',
  }
}

/** Recover only an already-qualified attempt whose exact original words exist. */
export function noteFromQualifiedAttempt({ objectiveIndex, objective, attempt, conversation }) {
  if (attempt?.accuracy !== 'correct' || attempt.comprehension !== 'demonstrated'
    || (attempt.reproduction && attempt.evidenceKind !== 'fixed_fact')
    || attempt.answerRequested || attempt.objective !== objective) return null
  let index = learnerMessageIndex(attempt.sourceMessageIndex)
  if (attempt.sourceMessageId) {
    const matches = (conversation || []).map((message, i) => ({ message, i }))
      .filter(({ message }) => message?.id === attempt.sourceMessageId)
    if (matches.length !== 1) return null
    index = matches[0].i
  }
  const source = sourceLearnerMessage(conversation, index)
  if (!source || source.text !== attempt.text) return null
  return createLearnerNote({
    objectiveIndex, conversation,
    evaluation: { accuracy: 'correct', sentenceOk: attempt.sentenceOk, sourceMessageIndex: index },
    capturedAt: attempt.occurredAt,
  })
}

export function isSourceVerifiedNote(note, conversation, objectiveIndex) {
  if (note?.provenance !== 'learner-message' || note.accuracy !== 'correct'
    || Number(note.objectiveIndex) !== objectiveIndex) return false
  const source = sourceLearnerMessage(conversation, note.sourceMessageIndex)
  return !!source && source.text === note.text
    && (!note.sourceMessageId || note.sourceMessageId === source.message.id)
}
