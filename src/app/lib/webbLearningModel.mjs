import { WEBB_WRITING_SUBPHASES, latestWritingAttempt, normalizeWritingSubphase } from './webbWritingFlow.mjs'
import {
  assembleWebbCompositionEssay,
  buildWebbCompositionPlan,
  nextCompositionSlotIndex,
  OBJECTIVE_BLUEPRINT_WEBB_COMPOSITION_PROTOCOL_VERSION,
} from './webbCompositionModel.mjs'

export const WEBB_SNAPSHOT_VERSION = 10

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

function previousCompositionSlotIndex(index, objectiveCount) {
  const value = asIndex(index)
  if (value === null || objectiveCount < 2 || value >= objectiveCount) return null
  if (value === 0) return 0
  if (value === objectiveCount - 1) return objectiveCount + 1
  return value + 1
}

function remapPreviousCompositionRecord(record, slot, slotIndex) {
  if (!record || typeof record !== 'object' || !slot) return record
  const objectiveIndex = slot.role === 'body' && slot.sourceObjectiveIndices?.length === 1
    ? slot.sourceObjectiveIndices[0]
    : null
  return {
    ...record,
    objectiveIndex,
    slotIndex,
    slotId: slot.id,
    slotRole: slot.role,
  }
}

function upgradePreviousCompositionSnapshot(snapshot = {}, objectives = []) {
  const list = Array.isArray(objectives) ? objectives : []
  const plan = snapshot?.compositionPlan
  const protocolVersion = String(plan?.protocolVersion || plan?.protocol_version || '').trim()
  const finalized = normalizedWebbStage(snapshot?.webbStage) === WEBB_SESSION_STAGES.ESSAY
    || snapshot?.essayMode === true
    || String(snapshot?.essay || '').trim().length > 0
  if (finalized
    || protocolVersion !== OBJECTIVE_BLUEPRINT_WEBB_COMPOSITION_PROTOCOL_VERSION
    || !Array.isArray(plan?.slots)
    || plan.slots.length !== list.length) return snapshot

  let nextPlan
  try {
    nextPlan = buildWebbCompositionPlan(list, snapshot?.learnerNotes || {})
  } catch {
    return snapshot
  }

  const acceptedSentences = {}
  for (const [rawIndex, record] of Object.entries(snapshot?.acceptedSentences || {})) {
    const nextIndex = previousCompositionSlotIndex(rawIndex, list.length)
    if (nextIndex === null) continue
    acceptedSentences[nextIndex] = remapPreviousCompositionRecord(record, nextPlan.slots[nextIndex], nextIndex)
  }

  const writingAttempts = {}
  for (const [rawIndex, attempts] of Object.entries(snapshot?.writingAttempts || {})) {
    const nextIndex = previousCompositionSlotIndex(rawIndex, list.length)
    if (nextIndex === null || !Array.isArray(attempts)) continue
    writingAttempts[nextIndex] = attempts.map(attempt => remapPreviousCompositionRecord(attempt, nextPlan.slots[nextIndex], nextIndex))
  }

  const mappedWritingIndex = previousCompositionSlotIndex(snapshot?.writingIndex, list.length)
  const pending = snapshot?.pendingWritingReview && typeof snapshot.pendingWritingReview === 'object'
    ? snapshot.pendingWritingReview
    : null
  const pendingOldIndex = pending ? asIndex(pending.slotIndex ?? pending.objectiveIndex) : null
  const pendingNewIndex = pendingOldIndex === null ? null : previousCompositionSlotIndex(pendingOldIndex, list.length)
  const pendingWritingReview = pendingNewIndex === null ? null : {
    ...pending,
    objectiveIndex: pendingNewIndex,
    slotIndex: pendingNewIndex,
  }
  const writingIndex = mappedWritingIndex ?? 0
  const writingSubphase = acceptedSentences?.[writingIndex]
    ? WEBB_WRITING_SUBPHASES.IDLE
    : snapshot?.writingSubphase

  return {
    ...snapshot,
    compositionPlan: nextPlan,
    acceptedSentences,
    writingAttempts,
    writingIndex,
    writingSubphase,
    pendingWritingReview,
  }
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
  snapshot = upgradePreviousCompositionSnapshot(snapshot, list)
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
  const concept = String(evaluation.accuracy || evaluation.conceptFit || '').trim().toLowerCase()

  if (concept && concept !== 'correct') {
    if (role === 'topic') return "This opening does not show the paragraph's big idea yet. Think about what the whole paragraph is about, then try that one idea again."
    if (role === 'conclusion') return "This ending does not close the idea your paragraph developed yet. Think about the point you already explained, then try the ending again."
    return 'This sentence does not show the idea this part is about yet. Look at your research note, then try that one idea again in your own words.'
  }
  if (evaluation.sentenceOk === false) {
    return 'You have the idea. Now make just that idea one complete sentence in your own words.'
  }
  if (evaluation.addsNewInformation === false) {
    return 'This sentence repeats something you already said. What new idea does this part add? Try only that idea again.'
  }
  if (evaluation.slotFit === false || evaluation.positionFit === false) {
    if (role === 'topic') return "Your sentence is complete, but the opening needs to tell the reader the big idea of the whole paragraph. Try only that job again."
    if (role === 'conclusion') return "Your sentence is complete, but the ending needs to close the paragraph's big idea. Try only that job again."
    return 'Your idea is correct, but it is doing the wrong job in this part of the paragraph. Use the idea from this part of your research and try again.'
  }
  if (evaluation.paragraphFit === false) {
    return 'This sentence makes sense by itself, but it does not connect to the paragraph here. Think about the sentence just before it, then try this connection again.'
  }
  if (role === 'topic') return "Try the topic sentence again. Tell the reader the one big idea the whole paragraph will explain."
  if (role === 'conclusion') return "Try the conclusion again. Close the same big idea the paragraph already explained."
  return 'Try again in your own words. Use the one idea in this research note and make it one complete sentence.'
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
    slot?.rhetoricalJob ? `Its private rhetorical job is: "${String(slot.rhetoricalJob)}".` : '',
    slot?.connection ? `Its private connection to the preceding composition is: "${String(slot.connection)}".` : '',
    role === 'body'
      ? (sourceNotes.length ? `The planned body-unit focus is authoritative for WHAT this sentence needs to express. The learner-authored research note supplies the learner's evidence and wording source: ${JSON.stringify(sourceNotes)}. Do not substitute a different idea merely because the note contains an example.` : `This body slot has no bound learner note; do not invent factual content.`)
      : role === 'topic'
        ? `A topic sentence is a structural opening, not a conversion of one research note. Use the lesson context and paragraph's big idea to judge whether it tells the reader what the paragraph will explain.`
        : role === 'conclusion'
          ? `A conclusion is a structural ending, not a conversion of one research note. Use the accepted paragraph ideas to judge whether it closes the same thought without adding a new fact.`
          : (sourceNotes.length ? `The learner-authored research for this legacy writing slot is the authoritative content boundary: ${JSON.stringify(sourceNotes)}.` : `This legacy writing slot has no bound learner note; do not invent factual content.`),
    `The evaluator found concept fit: ${evaluation.accuracy || evaluation.conceptFit || 'unknown'}; sentence readiness: ${evaluation.sentenceOk === false ? 'no' : 'yes'}; slot fit: ${evaluation.slotFit === false || evaluation.positionFit === false ? 'no' : 'yes'}; adds distinct information: ${evaluation.addsNewInformation === false ? 'no' : 'yes'}; paragraph fit: ${evaluation.paragraphFit === false ? 'no' : 'yes'}. Treat those judgments as authoritative.`,
    `Choose exactly ONE problem to discuss, using this priority: concept accuracy first; then sentence completeness; then repetition; then rhetorical-role fit; then paragraph connection. Stop at the first failing item. Do not mention, hint at, or ask the learner to repair any lower-priority issue in the same response.`,
    Number.isInteger(index) && Number.isInteger(total) && total > 0 ? `This is sentence ${index + 1} of ${total}.` : '',
    priorSentences.length ? `The accepted learner-written sentences before this one are context only: ${JSON.stringify(priorSentences)}.` : '',
    `Guide the learner to notice only that one selected problem, then ask for another attempt in their own words. Ask for one thing only. For a topic sentence, help them identify the big idea the whole paragraph will explain; do not refer to a first research note. For a body sentence, keep the sentence anchored to its assigned learner note. For a conclusion, help them close the ideas already developed in the paragraph without introducing a new fact; do not refer to a final research note.`,
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

/** v10 preserves the retained Webb blueprint and upgrades in-progress v2 composition slots without rewriting completed essays. */
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
