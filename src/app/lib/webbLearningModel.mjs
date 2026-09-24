import { WEBB_WRITING_SUBPHASES, latestWritingAttempt, normalizeWritingSubphase } from './webbWritingFlow.mjs'
import { assembleWebbCompositionEssay, nextCompositionSlotIndex } from './webbCompositionModel.mjs'

export const WEBB_SNAPSHOT_VERSION = 8

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

export function createWritingAttempt({ objectiveIndex = null, slotIndex = objectiveIndex, slotId = null, slotRole = null, text, message, accuracy, sentenceOk, positionFit = true, slotFit = positionFit, addsNewInformation = true, paragraphFit = true, attemptedAt }) {
  const fitsSlot = slotFit !== false && positionFit !== false
  const adds = addsNewInformation !== false
  const fitsParagraph = paragraphFit !== false
  const normalizedRole = String(slotRole || '').trim().toLowerCase()
  const requiresDistinctInformation = !['topic', 'conclusion'].includes(normalizedRole)
  const addsForAcceptance = requiresDistinctInformation ? adds : true
  return {
    objectiveIndex,
    slotIndex,
    slotId,
    slotRole,
    text: String(text ?? ''),
    sourceMessageId: message?.id || null,
    sourceMessageCreatedAt: message?.createdAt || null,
    accuracy,
    sentenceOk: sentenceOk === true,
    positionFit: fitsSlot && addsForAcceptance && fitsParagraph,
    slotFit: fitsSlot,
    addsNewInformation: adds,
    paragraphFit: fitsParagraph,
    accepted: accuracy === 'correct' && sentenceOk === true && fitsSlot && addsForAcceptance && fitsParagraph,
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
  const compositionPlan = snapshot?.compositionPlan?.slots?.length ? snapshot.compositionPlan : null
  const writingUnits = compositionPlan ? compositionPlan.slots : list
  const acceptedSentences = snapshot?.acceptedSentences || {}
  const writingAttempts = snapshot?.writingAttempts || {}
  const savedIndex = asIndex(snapshot?.writingIndex)
  const savedSubphase = normalizeWritingSubphase(snapshot?.writingSubphase, !!snapshot?.writingMode)
  const explicitStage = normalizedWebbStage(snapshot?.webbStage)
  const savedEssay = String(snapshot?.essay || '').trim() ? snapshot.essay : null
  const essay = savedEssay || (compositionPlan ? assembleWebbCompositionEssay(compositionPlan, acceptedSentences) : assembleLearnerEssay(list, acceptedSentences)) || null
  const nextIndex = compositionPlan ? nextCompositionSlotIndex(compositionPlan, acceptedSentences) : nextWritingObjectiveIndex(list, acceptedSentences)
  const acceptedCount = writingUnits.filter((_, index) => validAcceptedWritingSentence(acceptedSentences?.[index])).length
  const attemptCount = Object.values(writingAttempts).reduce((count, attempts) => count + (Array.isArray(attempts) ? attempts.length : 0), 0)
  const hasDraft = String(snapshot?.writingDraft || '').trim().length > 0
  const currentAccepted = savedIndex !== null && validAcceptedWritingSentence(acceptedSentences?.[savedIndex])

  const completedEssayStage = explicitStage === WEBB_SESSION_STAGES.ESSAY || snapshot?.essayMode === true || !!savedEssay
  if (completedEssayStage && essay && nextIndex === -1) {
    return {
      webbStage: WEBB_SESSION_STAGES.ESSAY,
      writingMode: false, writingIndex: savedIndex ?? Math.max(0, writingUnits.length - 1),
      writingSubphase: WEBB_WRITING_SUBPHASES.IDLE, writingDraft: '',
      writingAttempts, acceptedSentences, essay, essayMode: snapshot?.essayMode === true, pendingWritingReview: null, compositionPlan,
    }
  }

  const allSentencesAccepted = writingUnits.length > 0 && acceptedCount === writingUnits.length
  const committedIndex = currentAccepted ? savedIndex : allSentencesAccepted ? writingUnits.length - 1 : null
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
      pendingWritingReview: null, compositionPlan,
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
      essay: snapshot?.essay || null, essayMode: false, pendingWritingReview: null, compositionPlan,
    }
  }

  const writingIndex = savedIndex !== null && writingUnits[savedIndex] && !validAcceptedWritingSentence(acceptedSentences?.[savedIndex])
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
    writingAttempts, acceptedSentences, essay: snapshot?.essay || null, essayMode: false, pendingWritingReview, compositionPlan,
  }
}

function writingPositionRole(context = {}) {
  const explicitRole = String(context?.slot?.role || context?.role || '').trim().toLowerCase()
  if (['topic', 'body', 'conclusion'].includes(explicitRole)) return explicitRole
  const index = Number(context?.objectiveIndex)
  const total = Number(context?.totalObjectives)
  if (!Number.isInteger(index) || index < 0) return 'unspecified'
  if (index === 0) return 'topic'
  if (Number.isInteger(total) && total > 0 && index === total - 1) return 'conclusion'
  return 'body'
}

function safeWritingRetry(evaluation = {}, context = {}) {
  const role = writingPositionRole(context)
  if (evaluation.sentenceOk === true && evaluation.addsNewInformation === false) {
    return 'This sentence is complete, but it repeats work the paragraph already did. Look at what this part still needs to add, then try again in your own words.'
  }
  if (evaluation.sentenceOk === true && evaluation.paragraphFit === false) {
    return 'This sentence works by itself, but it does not connect cleanly to the paragraph around it yet. Look at the ideas before it and try again in your own words.'
  }
  if (evaluation.accuracy === 'correct' && evaluation.sentenceOk === true && evaluation.positionFit === false) {
    if (role === 'topic') return "Your sentence is complete, but the topic sentence needs to introduce what the whole paragraph will explain. Think about the big idea that connects your research, then try again in your own words."
    if (role === 'conclusion') return 'Your sentence is complete, but the conclusion needs to close the paragraph instead of opening a new thought. Look back at what you actually explained, then finish that same thought in your own words.'
    return 'Your idea is accurate and complete, but this sentence does not add a distinct, connected step to the paragraph so far. Look at what you have already said and decide what this part needs to add, then try again in your own words.'
  }
  if (role === 'topic') return 'Try the topic sentence again. Make it one complete thought that tells the reader what the whole paragraph will explain, using your own words.'
  if (role === 'conclusion') return 'Try the conclusion again. Make it one complete thought that closes the ideas you already developed, using your own words.'
  return 'Reread your sentence. Check that it accurately uses the research for this part, adds a new connected idea, and is a complete thought, then try again in your own words.'
}

export function buildWritingGuidanceInstructions(note, evaluation = {}, context = {}) {
  const role = writingPositionRole(context)
  const index = Number(context?.objectiveIndex)
  const total = Number(context?.totalObjectives)
  const priorSentences = Array.isArray(context?.priorSentences)
    ? context.priorSentences.map(value => String(value || '').trim()).filter(Boolean)
    : []
  const sourceNotes = Array.isArray(context?.sourceNotes)
    ? context.sourceNotes.map(value => String(value?.text || value || '').trim()).filter(Boolean)
    : (String(note || '').trim() ? [String(note).trim()] : [])
  const slot = context?.slot || null
  const controllingIdea = String(context?.controllingIdea || '').trim()
  return [
    `The research stage is finished. You are coaching one learner-authored sentence in a planned paragraph.`,
    controllingIdea ? `The paragraph's private controlling idea is: "${controllingIdea}". Do not give this wording to the learner; use it only to guide questions.` : '',
    slot?.focus ? `This sentence's private composition focus is: "${String(slot.focus)}". Its role is ${role}.` : `The structural role is ${role}.`,
    sourceNotes.length ? `The learner-authored research available for this slot is context only: ${JSON.stringify(sourceNotes)}.` : `This ${role} sentence is a writing-structure sentence and is not required to restate a mastery objective.`,
    `The evaluator found concept fit: ${evaluation.accuracy || evaluation.conceptFit || 'partial'}; sentence readiness: ${evaluation.sentenceOk ? 'yes' : 'no'}; slot fit: ${evaluation.slotFit === false || evaluation.positionFit === false ? 'no' : 'yes'}; adds distinct information: ${evaluation.addsNewInformation === false ? 'no' : 'yes'}; paragraph fit: ${evaluation.paragraphFit === false ? 'no' : 'yes'}. Treat those judgments as authoritative.`,
    Number.isInteger(index) && Number.isInteger(total) && total > 0 ? `This is sentence ${index + 1} of ${total}.` : '',
    priorSentences.length ? `The accepted learner-written sentences before this one are context only: ${JSON.stringify(priorSentences)}.` : '',
    `Guide the learner to notice the specific problem, then ask for another attempt in their own words. For a topic sentence, help them identify the paragraph's big idea. For a body sentence, help them decide what distinct information this slot should add. For a conclusion, help them close what they already explained.`,
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
  const normalizePrivate = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const normalizedReply = normalizePrivate(text)
  const privatePhrases = [context?.controllingIdea, context?.slot?.focus]
    .map(normalizePrivate).filter(value => value.split(/\s+/).length >= 4)
  const leaksPrivatePlan = privatePhrases.some(value => normalizedReply.includes(value))
  return suppliesWording || leaksPrivatePlan ? fallback : text
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

/** v7 preserves durable research/writing/essay state and adds additive Mrs. Webb pacing/play snapshot fields. */
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
