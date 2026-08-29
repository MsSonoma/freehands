import {
  INDEPENDENCE_REASONS,
  INDEPENDENCE_STATUSES,
  MASTERY_OUTCOMES,
  qualifyConversationalMasteryOpportunity,
} from './masteryEvidence/mastery.js'

export const WEBB_MASTERY_PROTOCOL_VERSION = 'webb-conversational-mastery-v1'

export const WEBB_OBJECTIVE_STATES = Object.freeze({
  NOT_COVERED: 'not_covered',
  COVERED: 'covered',
  UNDERSTOOD: 'understood',
  MASTERED: 'mastered',
})

export const WEBB_ASSISTANCE_TYPES = Object.freeze({
  DIRECT_TEACHING: 'direct_teaching',
  CORRECTION: 'correction',
  ANSWER_REQUEST: 'answer_request',
  ANSWER_REVEALED: 'answer_revealed',
  VISUAL_EXPOSURE: 'visual_exposure',
  RETRY_AFTER_TEACHING: 'retry_after_teaching',
})

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(value) {
  return normalizeText(value).split(' ').filter(Boolean)
}

export function detectsAnswerRequest(text) {
  return /\b(?:tell|give|show)\s+me\s+(?:the\s+)?answer\b|\bwhat(?:'s| is)\s+the\s+answer\b|\bi\s+don'?t\s+know[^.!?]{0,30}\b(?:tell|give|show)\s+me\b/i.test(String(text || ''))
}

export function compareLearnerToAssistant({ learnerText, assistantText } = {}) {
  const learner = normalizeText(learnerText)
  const assistant = normalizeText(assistantText)
  if (!learner || !assistant) return { copied: false, kind: null, similarity: 0 }
  if (learner.length >= 12 && assistant.includes(learner)) {
    return { copied: true, kind: 'exact_substring', similarity: 1 }
  }
  const learnerTokens = tokens(learner)
  const assistantTokens = tokens(assistant)
  if (learnerTokens.length < 6 || assistantTokens.length < 6) return { copied: false, kind: null, similarity: 0 }
  const assistantCounts = new Map()
  for (const token of assistantTokens) assistantCounts.set(token, (assistantCounts.get(token) || 0) + 1)
  let overlap = 0
  for (const token of learnerTokens) {
    const count = assistantCounts.get(token) || 0
    if (count > 0) {
      overlap += 1
      assistantCounts.set(token, count - 1)
    }
  }
  const similarity = overlap / learnerTokens.length
  return similarity >= 0.85
    ? { copied: true, kind: 'clear_token_reproduction', similarity }
    : { copied: false, kind: null, similarity }
}

export function findClearAnswerReproduction(conversation, sourceMessageIndex) {
  const learner = conversation?.[sourceMessageIndex]
  if (!learner || learner.role !== 'user') return null
  for (let index = sourceMessageIndex - 1; index >= 0; index -= 1) {
    const assistant = conversation[index]
    if (assistant?.role !== 'assistant') continue
    const match = compareLearnerToAssistant({ learnerText: learner.content, assistantText: assistant.content })
    if (match.copied) {
      return {
        ...match,
        sourceAssistantMessageIndex: index,
        sourceAssistantMessageId: assistant.id || null,
      }
    }
  }
  return null
}

export function addWebbAssistance(evidence = {}, assistance) {
  if (!assistance?.type) return evidence || {}
  const existing = Array.isArray(evidence?.currentSessionAssistance) ? evidence.currentSessionAssistance : []
  const key = `${assistance.type}:${assistance.sourceMessageId || assistance.sourceMessageIndex || ''}`
  if (existing.some((entry) => `${entry.type}:${entry.sourceMessageId || entry.sourceMessageIndex || ''}` === key)) return evidence
  return {
    ...(evidence || {}),
    currentSessionAssistance: [...existing, assistance],
  }
}

function assistedIndependence(assistance = []) {
  if (assistance.some((entry) => entry.type === WEBB_ASSISTANCE_TYPES.ANSWER_REVEALED || entry.type === WEBB_ASSISTANCE_TYPES.ANSWER_REQUEST)) {
    return { independenceStatus: INDEPENDENCE_STATUSES.ANSWER_REVEALED, independenceReason: INDEPENDENCE_REASONS.ANSWER_REVEAL_BEFORE_RESPONSE }
  }
  return { independenceStatus: INDEPENDENCE_STATUSES.RETEACH_OR_SCAFFOLD, independenceReason: INDEPENDENCE_REASONS.RETEACH_BEFORE_RESPONSE }
}

export function classifyWebbObjectiveAttempt({
  objectiveIndex,
  objective,
  evaluation,
  conversation,
  previousEvidence = {},
  priorPromptExposed = false,
  occurredAt = new Date().toISOString(),
} = {}) {
  const sourceMessageIndex = Number(evaluation?.sourceMessageIndex)
  const learnerMessage = conversation?.[sourceMessageIndex]
  if (!learnerMessage || learnerMessage.role !== 'user') return null

  const accuracy = evaluation?.accuracy
  const correct = accuracy === 'correct'
  const priorAttempts = Array.isArray(previousEvidence?.attempts) ? previousEvidence.attempts : []
  const assistance = Array.isArray(previousEvidence?.currentSessionAssistance)
    ? previousEvidence.currentSessionAssistance
    : []
  const reproduction = findClearAnswerReproduction(conversation, sourceMessageIndex)
  const answerRequested = detectsAnswerRequest(learnerMessage.content)
  const isFirstResponse = priorAttempts.length === 0
  const qualification = qualifyConversationalMasteryOpportunity({
    hasStableConceptIdentity: !!String(objective || '').trim(),
    isFirstResponse,
    priorPromptExposed,
    assistanceEventsBeforeResponse: assistance.map(entry => ({ assistanceLevel:
      entry.type === WEBB_ASSISTANCE_TYPES.ANSWER_REVEALED || entry.type === WEBB_ASSISTANCE_TYPES.ANSWER_REQUEST
        ? 'answer_revealed'
        : 'reteach_or_scaffolded' })),
    answerRequested,
    answerReproduction: !!reproduction,
  })
  const clean = qualification.eligible
  const covered = (correct && !answerRequested) || (assistance.length > 0 && priorAttempts.length > 0)
  const comprehension = correct && !reproduction && !answerRequested ? 'demonstrated' : 'not_demonstrated'

  let masteryOutcome = MASTERY_OUTCOMES.UNAVAILABLE
  let independenceStatus = INDEPENDENCE_STATUSES.UNAVAILABLE
  let independenceReason = INDEPENDENCE_REASONS.ELIGIBLE
  if (answerRequested) {
    independenceStatus = qualification.independenceStatus
    independenceReason = qualification.independenceReason
    masteryOutcome = MASTERY_OUTCOMES.UNAVAILABLE
  } else if (reproduction) {
    independenceStatus = INDEPENDENCE_STATUSES.ANSWER_REVEALED
    independenceReason = qualification.independenceReason
  } else if (clean) {
    independenceStatus = INDEPENDENCE_STATUSES.INDEPENDENT
    independenceReason = INDEPENDENCE_REASONS.ELIGIBLE
    masteryOutcome = correct ? MASTERY_OUTCOMES.INDEPENDENT_SUCCESS : MASTERY_OUTCOMES.NEEDS_RECOVERY
  } else if (correct) {
    const assisted = assistance.length ? assistedIndependence(assistance) : qualification
    independenceStatus = assisted.independenceStatus
    independenceReason = assisted.independenceReason
    masteryOutcome = MASTERY_OUTCOMES.ASSISTED_SUCCESS
  } else if (assistance.length > 0) {
    const assisted = assistedIndependence(assistance)
    independenceStatus = assisted.independenceStatus
    independenceReason = assisted.independenceReason
  }

  const attempt = {
    objectiveIndex,
    objective,
    sourceMessageIndex,
    sourceMessageId: learnerMessage.id || null,
    text: String(learnerMessage.content ?? ''),
    accuracy,
    sentenceOk: evaluation?.sentenceOk === true,
    covered,
    comprehension,
    masteryOutcome,
    independenceStatus,
    independenceReason,
    isFirstResponse,
    reproduction,
    answerRequested,
    assistanceBeforeResponse: assistance,
    qualification,
    occurredAt,
  }

  return {
    protocolVersion: WEBB_MASTERY_PROTOCOL_VERSION,
    objectiveIndex,
    objective,
    coverage: covered ? 'covered' : 'not_covered',
    comprehension,
    mastery: masteryOutcome === MASTERY_OUTCOMES.INDEPENDENT_SUCCESS ? 'mastered' : 'pending',
    retention: 'not_measured',
    currentSessionAssistance: assistance,
    attempts: [...priorAttempts, attempt],
    latestAttempt: attempt,
    updatedAt: occurredAt,
  }
}

export function summarizeWebbMastery(objectives = [], objectiveEvidence = {}) {
  const concepts = objectives.map((objective, index) => {
    const evidence = objectiveEvidence[index] || {}
    return {
      objectiveIndex: index,
      objective,
      coverage: evidence.coverage || 'not_covered',
      comprehension: evidence.comprehension || 'not_demonstrated',
      mastery: evidence.mastery || 'pending',
      retention: evidence.retention || 'not_measured',
    }
  })
  return {
    concepts,
    masteryPending: concepts.filter((concept) => concept.mastery !== 'mastered').map((concept) => concept.objective),
    mastered: concepts.filter((concept) => concept.mastery === 'mastered').map((concept) => concept.objective),
    retention: 'not_measured',
  }
}

export function mergeWebbMasterySummaries(previous = null, current = null) {
  const byObjective = new Map()
  for (const concept of previous?.concepts || []) byObjective.set(concept.objective, concept)
  for (const concept of current?.concepts || []) {
    const prior = byObjective.get(concept.objective)
    byObjective.set(concept.objective, prior?.mastery === 'mastered' && concept.mastery !== 'mastered'
      ? { ...concept, mastery: 'mastered' }
      : concept)
  }
  const concepts = Array.from(byObjective.values())
  return {
    concepts,
    masteryPending: concepts.filter(concept => concept.mastery !== 'mastered').map(concept => concept.objective),
    mastered: concepts.filter(concept => concept.mastery === 'mastered').map(concept => concept.objective),
    retention: 'not_measured',
  }
}
