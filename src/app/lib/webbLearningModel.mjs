import { WEBB_WRITING_SUBPHASES, latestWritingAttempt, normalizeWritingSubphase } from './webbWritingFlow.mjs'

export const WEBB_SNAPSHOT_VERSION = 6

export const WEBB_SESSION_STAGES = Object.freeze({
  RESEARCH: 'research',
  WRITING: 'writing',
  ESSAY: 'essay',
})

import { learnerMessageIndex as asIndex, sourceLearnerMessage, createLearnerNote, evaluationSource } from './webbLearnerEvidence.mjs'
import { reconcileWebbObjectiveState } from './webbObjectiveState.mjs'
export { sourceLearnerMessage, createLearnerNote } from './webbLearnerEvidence.mjs'

export function parseComprehensionEvaluations({ raw, objectives, understoodIndices = [], conversation, capturedAt }) {
  const newlyUnderstood = []
  const learnerNotes = {}
  const sentenceQuality = {}
  const evaluationStatus = {}
  const evaluationDetails = {}
  const invalidLines = []

  for (const line of String(raw || '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.toLowerCase() === 'none') continue
    const parts = trimmed.split('|')
    if (parts.length < 4) { invalidLines.push(trimmed); continue }
    const objectiveIndex = asIndex(parts[0])
    const accuracy = String(parts[1] || '').trim().toLowerCase()
    const sentenceOk = String(parts[2] || '').trim().toLowerCase() === 'yes'
    // Accept the displayed [index] notation as well as the requested integer.
    const messageToken = String(parts[3] || '').trim().replace(/^\[(\d+)\]$/, '$1')
    const sourceMessageIndex = asIndex(messageToken)
    const detail = parts.slice(4).join('|').trim()
    const evidenceKind = ['fixed_fact', 'meaning'].includes(detail) ? detail : 'meaning'
    const quote = ['fixed_fact', 'meaning'].includes(detail) ? '' : detail
    if (objectiveIndex === null || !objectives?.[objectiveIndex]) { invalidLines.push(trimmed); continue }
    if (understoodIndices.includes(objectiveIndex)) continue
    if (Object.prototype.hasOwnProperty.call(evaluationStatus, objectiveIndex)) continue
    if (!['correct', 'partial', 'incorrect'].includes(accuracy)
      || !['yes', 'no'].includes(String(parts[2]).trim().toLowerCase())
      || !evaluationSource(conversation, { sourceMessageIndex, quote })) {
      invalidLines.push(trimmed)
      continue
    }
    evaluationStatus[objectiveIndex] = accuracy
    sentenceQuality[objectiveIndex] = sentenceOk
    evaluationDetails[objectiveIndex] = { objectiveIndex, accuracy, sentenceOk, sourceMessageIndex, quote, evidenceKind }
    const note = createLearnerNote({
      objectiveIndex,
      evaluation: { accuracy, sentenceOk, sourceMessageIndex, quote },
      conversation,
      capturedAt,
    })
    if (!note) continue
    newlyUnderstood.push(objectiveIndex)
    learnerNotes[objectiveIndex] = note
  }
  return { newlyUnderstood, learnerNotes, sentenceQuality, evaluationStatus, evaluationDetails, invalidLines }
}

export function createVerbatimLearnerRecord({ objectiveIndex, evaluation, conversation, capturedAt }) {
  const source = sourceLearnerMessage(conversation, evaluation?.sourceMessageIndex)
  if (!source) return null
  const quote = String(evaluation?.quote ?? '')
  if (quote && !source.text.includes(quote)) return null
  return {
    objectiveIndex,
    text: source.text,
    sourceMessageIndex: source.index,
    sourceMessageId: source.message.id || null,
    sourceMessageCreatedAt: source.message.createdAt || null,
    accuracy: evaluation?.accuracy || null,
    sentenceReadyAtCapture: evaluation?.sentenceOk === true,
    capturedAt: capturedAt || new Date().toISOString(),
    assistance: 'mrs-webb-research-conversation',
    provenance: 'learner-message',
  }
}

export function createWritingAttempt({ objectiveIndex, text, message, accuracy, sentenceOk, positionFit = true, attemptedAt }) {
  const fitsPosition = positionFit !== false
  return {
    objectiveIndex,
    text: String(text ?? ''),
    sourceMessageId: message?.id || null,
    sourceMessageCreatedAt: message?.createdAt || null,
    accuracy,
    sentenceOk: sentenceOk === true,
    positionFit: fitsPosition,
    accepted: accuracy === 'correct' && sentenceOk === true && fitsPosition,
    attemptedAt: attemptedAt || new Date().toISOString(),
    assistance: 'mrs-webb-guidance',
    provenance: 'learner-message',
  }
}

export function nextWritingObjectiveIndex(objectives, acceptedSentences) {
  return (objectives || []).findIndex((_, index) => !acceptedSentences?.[index])
}

export function assembleLearnerEssay(objectives, acceptedSentences) {
  const sentences = (objectives || []).map((_, index) => acceptedSentences?.[index]).filter(Boolean)
  if (sentences.length !== (objectives || []).length) return ''
  if (sentences.some(sentence => sentence.provenance !== 'learner-message' || !sentence.text)) return ''
  return sentences.map(sentence => sentence.text).join(' ')
}

function validAcceptedWritingSentence(sentence) {
  return sentence?.provenance === 'learner-message' && String(sentence?.text || '').trim().length > 0
}

function normalizedWebbStage(value) {
  const stage = String(value || '').trim().toLowerCase()
  return Object.values(WEBB_SESSION_STAGES).includes(stage) ? stage : null
}

function writingAttemptRecorded(snapshot, objectiveIndex, message) {
  if (!message) return false
  const candidates = [
    ...(Array.isArray(snapshot?.writingAttempts?.[objectiveIndex]) ? snapshot.writingAttempts[objectiveIndex] : []),
    snapshot?.acceptedSentences?.[objectiveIndex],
  ].filter(Boolean)
  return candidates.some(attempt => {
    if (message.id && attempt?.sourceMessageId) return attempt.sourceMessageId === message.id
    return String(attempt?.text || '').trim() === String(message.content || '').trim()
  })
}

function inferPendingWritingReview(snapshot, objectiveIndex) {
  const explicit = snapshot?.pendingWritingReview
  const explicitMessage = explicit?.message
  if (asIndex(explicit?.objectiveIndex) === objectiveIndex
    && explicitMessage?.role === 'user'
    && String(explicit?.text || '').trim()
    && String(explicitMessage.content || '').trim() === String(explicit.text || '').trim()
    && !writingAttemptRecorded(snapshot, objectiveIndex, explicitMessage)) {
    return {
      objectiveIndex,
      text: String(explicit.text).trim(),
      message: explicitMessage,
    }
  }

  const history = Array.isArray(snapshot?.chatMessages) ? snapshot.chatMessages : []
  const last = history.at(-1)
  if (last?.role !== 'user' || !String(last.content || '').trim()) return null
  if (writingAttemptRecorded(snapshot, objectiveIndex, last)) return null
  return { objectiveIndex, text: String(last.content).trim(), message: last }
}

/**
 * Composition resume is derived from durable writing artifacts, not from one boolean.
 * This prevents a stale writingMode flag or an interrupted sentence request from
 * dropping Mrs. Webb back into research while the writing UI restores correctly.
 */
export function restoreWebbCompositionState(snapshot = {}, objectives = snapshot?.objectives || []) {
  const list = Array.isArray(objectives) ? objectives : []
  const acceptedSentences = snapshot?.acceptedSentences || {}
  const writingAttempts = snapshot?.writingAttempts || {}
  const savedIndex = asIndex(snapshot?.writingIndex)
  const savedSubphase = normalizeWritingSubphase(snapshot?.writingSubphase, !!snapshot?.writingMode)
  const explicitStage = normalizedWebbStage(snapshot?.webbStage)
  const savedEssay = String(snapshot?.essay || '').trim() ? snapshot.essay : null
  const essay = savedEssay || assembleLearnerEssay(list, acceptedSentences) || null
  const nextIndex = nextWritingObjectiveIndex(list, acceptedSentences)
  const acceptedCount = list.filter((_, index) => validAcceptedWritingSentence(acceptedSentences?.[index])).length
  const attemptCount = Object.values(writingAttempts).reduce((count, attempts) => count + (Array.isArray(attempts) ? attempts.length : 0), 0)
  const hasDraft = String(snapshot?.writingDraft || '').trim().length > 0
  const currentAccepted = savedIndex !== null && validAcceptedWritingSentence(acceptedSentences?.[savedIndex])

  const completedEssayStage = explicitStage === WEBB_SESSION_STAGES.ESSAY || snapshot?.essayMode === true || !!savedEssay
  if (completedEssayStage && essay && nextIndex === -1) {
    return {
      webbStage: WEBB_SESSION_STAGES.ESSAY,
      writingMode: false, writingIndex: savedIndex ?? Math.max(0, list.length - 1),
      writingSubphase: WEBB_WRITING_SUBPHASES.IDLE, writingDraft: '',
      writingAttempts, acceptedSentences, essay, essayMode: snapshot?.essayMode === true, pendingWritingReview: null,
    }
  }

  const allSentencesAccepted = list.length > 0 && acceptedCount === list.length
  const committedIndex = currentAccepted ? savedIndex : allSentencesAccepted ? list.length - 1 : null
  const committedGate = committedIndex !== null && (
    ((explicitStage === WEBB_SESSION_STAGES.WRITING || snapshot?.writingMode)
      && savedSubphase === WEBB_WRITING_SUBPHASES.COMMITTED)
    // Old snapshots could persist the accepted sentence before their writingMode flag.
    // Accepted learner prose is stronger evidence of composition than a stale false boolean.
    || (allSentencesAccepted && !snapshot?.essayMode)
  )
  if (committedGate) {
    return {
      webbStage: WEBB_SESSION_STAGES.WRITING,
      writingMode: true, writingIndex: committedIndex, writingSubphase: WEBB_WRITING_SUBPHASES.COMMITTED,
      writingDraft: '', writingAttempts, acceptedSentences, essay: snapshot?.essay || null, essayMode: false,
      pendingWritingReview: null,
    }
  }

  const hasIncompleteWritingArtifacts = nextIndex !== -1 && (
    explicitStage === WEBB_SESSION_STAGES.WRITING || snapshot?.writingMode
    || acceptedCount > 0 || attemptCount > 0 || hasDraft
    || ![WEBB_WRITING_SUBPHASES.IDLE, WEBB_WRITING_SUBPHASES.COMMITTED].includes(savedSubphase)
  )
  if (!hasIncompleteWritingArtifacts) {
    return {
      webbStage: WEBB_SESSION_STAGES.RESEARCH,
      writingMode: false, writingIndex: savedIndex ?? 0, writingSubphase: WEBB_WRITING_SUBPHASES.IDLE,
      writingDraft: String(snapshot?.writingDraft || ''), writingAttempts, acceptedSentences,
      essay: snapshot?.essay || null, essayMode: false, pendingWritingReview: null,
    }
  }

  const writingIndex = savedIndex !== null && list[savedIndex] && !validAcceptedWritingSentence(acceptedSentences?.[savedIndex])
    ? savedIndex : nextIndex
  const latestAttempt = latestWritingAttempt(writingAttempts, writingIndex)
  let writingSubphase = savedSubphase
  if (writingSubphase === WEBB_WRITING_SUBPHASES.COMMITTED || writingSubphase === WEBB_WRITING_SUBPHASES.IDLE) {
    writingSubphase = latestAttempt && !latestAttempt.accepted ? WEBB_WRITING_SUBPHASES.REVIEW : WEBB_WRITING_SUBPHASES.FOCUS
  } else if (writingSubphase === WEBB_WRITING_SUBPHASES.REVIEW && latestAttempt?.accepted) {
    writingSubphase = WEBB_WRITING_SUBPHASES.FOCUS
  }
  const pendingWritingReview = inferPendingWritingReview(snapshot, writingIndex)
  const writingDraft = pendingWritingReview?.text || String(snapshot?.writingDraft || '')

  return {
    webbStage: WEBB_SESSION_STAGES.WRITING,
    writingMode: true, writingIndex, writingSubphase, writingDraft,
    writingAttempts, acceptedSentences, essay: snapshot?.essay || null, essayMode: false, pendingWritingReview,
  }
}

function writingPositionRole(context = {}) {
  const index = Number(context?.objectiveIndex)
  const total = Number(context?.totalObjectives)
  if (!Number.isInteger(index) || index < 0) return 'unspecified'
  if (index === 0) return 'opening'
  if (Number.isInteger(total) && total > 0 && index === total - 1) return 'conclusion'
  return 'development'
}

function safeWritingRetry(evaluation = {}, context = {}) {
  if (evaluation.accuracy === 'correct' && evaluation.sentenceOk === true && evaluation.positionFit === false) {
    const role = writingPositionRole(context)
    if (role === 'opening') return "Your idea is accurate and complete, but the first sentence needs to introduce the essay's main thought. Look at what this essay is about overall, then try again in your own words."
    if (role === 'conclusion') return 'Your idea is accurate and complete, but the final sentence needs to close the essay instead of opening a new thought. Look back at what you already explained, then bring the essay to a finish in your own words.'
    return 'Your idea is accurate and complete, but this sentence does not connect cleanly to the essay so far. Look at the sentence before it and decide how this idea should follow from it, then try again in your own words.'
  }
  return 'Reread your sentence. Check that it says the same accurate idea as your note and is a complete thought, then try again in your own words.'
}

export function buildWritingGuidanceInstructions(note, evaluation = {}, context = {}) {
  const role = writingPositionRole(context)
  const index = Number(context?.objectiveIndex)
  const total = Number(context?.totalObjectives)
  const priorSentences = Array.isArray(context?.priorSentences)
    ? context.priorSentences.map(value => String(value || '').trim()).filter(Boolean).slice(0, Number.isInteger(index) && index >= 0 ? index : 0)
    : []
  return [
    `The research stage is finished. Guide the learner to transform this exact learner-authored note into an essay-ready sentence: "${String(note || '')}".`,
    context?.objective ? `The current ordered essay objective is: "${String(context.objective)}".` : '',
    `The evaluator found conceptual accuracy: ${evaluation.accuracy || 'partial'}; sentence readiness: ${evaluation.sentenceOk ? 'yes' : 'no'}; position fit: ${evaluation.positionFit === false ? 'no' : 'yes'}. Treat those judgments as authoritative.`,
    Number.isInteger(index) && Number.isInteger(total) && total > 0 ? `This is sentence ${index + 1} of ${total}; its structural role is ${role}.` : '',
    priorSentences.length ? `The accepted learner-written sentences before this one are context only: ${JSON.stringify(priorSentences)}.` : '',
    evaluation.accuracy === 'correct' && evaluation.sentenceOk === true && evaluation.positionFit === false
      ? `The content and sentence form are already acceptable. Focus only on structural fit: help the learner notice whether this sentence should introduce, develop, connect, synthesize, or close the surrounding thought. Do not require a particular transition word and do not supply one.`
      : `Guide the learner to notice and repair the problem, then ask for another attempt in their own words. You may identify an incomplete thought, missing subject or action, punctuation issue, ambiguity, misconception, or lost connection to the note.`,
    `Never write, dictate, complete, rewrite, or offer a model sentence for the learner. Do not say "write" followed by suggested prose. The words accepted into the essay must come from the learner.`,
    `Use 2-3 short, warm sentences, no markdown.`,
  ].filter(Boolean).join('\n')
}

/** Prevent a model-guidance failure from placing generated candidate prose in front of the learner. */
export function sanitizeWritingGuidance(reply, evaluation = {}, context = {}) {
  const fallback = safeWritingRetry(evaluation, context)
  const text = String(reply || '').trim()
  if (!text) return fallback
  const suppliesWording =
    /\b(?:you could|you can|try to|please)\s+(?:write|say|use)\b/i.test(text) ||
    /\b(?:write|say|try|use)\s*:\s*/i.test(text) ||
    /\b(?:here(?:'s| is)|for example)\b[^.!?]{0,40}["“]/i.test(text) ||
    /["“][^"”]*(?:\s+[^"”]+){5,}["”]/.test(text)
  return suppliesWording ? fallback : text
}

function findLegacySource(chatMessages, response) {
  const wanted = String(response ?? '')
  if (!wanted) return null
  for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
    const message = chatMessages[index]
    const text = String(message?.content ?? '')
    if (message?.role === 'user' && text.includes(wanted)) return { message, index, text }
  }
  return null
}

/**
 * Migrates v1 snapshots conservatively. An old completion is retained only when
 * its stored response can be traced to an actual learner message. Old responses
 * are notes, never silently promoted into accepted writing-stage sentences.
 */
function migrateWebbSnapshotLegacy(saved = {}) {
  if (saved.snapshotVersion >= 3) {
    return {
      ...saved,
      understoodObj: saved.understoodObj || [],
      coveredObj: saved.coveredObj || [],
      objectiveEvidence: saved.objectiveEvidence || {},
      learnerNotes: saved.learnerNotes || {},
      writingAttempts: saved.writingAttempts || {},
      acceptedSentences: saved.acceptedSentences || {},
      writingMode: !!saved.writingMode,
      writingIndex: asIndex(saved.writingIndex) ?? 0,
      writingSubphase: normalizeWritingSubphase(saved.writingSubphase, !!saved.writingMode),
      writingDraft: String(saved.writingDraft || ''),
    }
  }

  if (saved.snapshotVersion === 2) {
    const understoodObj = saved.understoodObj || []
    const objectiveEvidence = Object.fromEntries(understoodObj.map(index => [index, {
      objectiveIndex: index,
      objective: saved.objectives?.[index] || null,
      coverage: 'covered',
      comprehension: 'demonstrated',
      mastery: 'pending',
      retention: 'not_measured',
      currentSessionAssistance: [],
      attempts: [],
      migratedFrom: 2,
    }]))
    return {
      ...saved,
      snapshotVersion: WEBB_SNAPSHOT_VERSION,
      coveredObj: [...understoodObj],
      understoodObj,
      objectiveEvidence,
      learnerNotes: saved.learnerNotes || {},
      writingAttempts: saved.writingAttempts || {},
      acceptedSentences: saved.acceptedSentences || {},
      writingMode: !!saved.writingMode,
      writingIndex: asIndex(saved.writingIndex) ?? 0,
      writingSubphase: normalizeWritingSubphase(saved.writingSubphase, !!saved.writingMode),
      writingDraft: String(saved.writingDraft || ''),
    }
  }

  const chatMessages = Array.isArray(saved.chatMessages) ? saved.chatMessages : []
  const oldCompleted = Array.isArray(saved.completedObj) ? saved.completedObj : []
  const oldResponses = saved.objResponses || {}
  const understoodObj = []
  const learnerNotes = {}

  for (const rawIndex of oldCompleted) {
    const objectiveIndex = asIndex(rawIndex)
    if (objectiveIndex === null) continue
    const source = findLegacySource(chatMessages, oldResponses[objectiveIndex])
    if (!source) continue
    understoodObj.push(objectiveIndex)
    learnerNotes[objectiveIndex] = {
      objectiveIndex,
      text: source.text,
      sourceMessageIndex: source.index,
      sourceMessageId: source.message.id || null,
      sourceMessageCreatedAt: source.message.createdAt || null,
      accuracy: 'correct',
      sentenceReadyAtCapture: true,
      capturedAt: null,
      assistance: 'mrs-webb-research-conversation',
      provenance: 'learner-message',
      migratedFrom: 1,
    }
  }

  return {
    ...saved,
    snapshotVersion: WEBB_SNAPSHOT_VERSION,
    understoodObj,
    coveredObj: [...understoodObj],
    objectiveEvidence: Object.fromEntries(understoodObj.map(index => [index, {
      objectiveIndex: index,
      objective: saved.objectives?.[index] || null,
      coverage: 'covered',
      comprehension: 'demonstrated',
      mastery: 'pending',
      retention: 'not_measured',
      currentSessionAssistance: [],
      attempts: [],
      migratedFrom: 1,
    }])),
    learnerNotes,
    writingAttempts: {},
    acceptedSentences: {},
    writingMode: false,
    writingIndex: 0,
    writingSubphase: normalizeWritingSubphase('', false),
    writingDraft: '',
    essay: null,
    essayMode: false,
  }
}

/** v6 reconciles comprehension evidence and restores a durable research/writing/essay stage. */
export function migrateWebbSnapshot(saved = {}) {
  const restored = migrateWebbSnapshotLegacy(saved)
  const reconciled = {
    ...restored,
    ...(restored.objectives?.length ? reconcileWebbObjectiveState(restored.objectives, restored, restored.chatMessages || []) : {}),
  }
  const composition = reconciled.objectives?.length
    ? restoreWebbCompositionState(reconciled, reconciled.objectives)
    : { webbStage: reconciled.essayMode ? WEBB_SESSION_STAGES.ESSAY : reconciled.writingMode ? WEBB_SESSION_STAGES.WRITING : WEBB_SESSION_STAGES.RESEARCH }
  return { ...reconciled, ...composition, snapshotVersion: WEBB_SNAPSHOT_VERSION }
}
