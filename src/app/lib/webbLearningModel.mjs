import { normalizeWritingSubphase } from './webbWritingFlow.mjs'

export const WEBB_SNAPSHOT_VERSION = 5

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

export function createWritingAttempt({ objectiveIndex, text, message, accuracy, sentenceOk, attemptedAt }) {
  return {
    objectiveIndex,
    text: String(text ?? ''),
    sourceMessageId: message?.id || null,
    sourceMessageCreatedAt: message?.createdAt || null,
    accuracy,
    sentenceOk: sentenceOk === true,
    accepted: accuracy === 'correct' && sentenceOk === true,
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

export function buildWritingGuidanceInstructions(note, evaluation = {}) {
  return [
    `The research stage is finished. Guide the learner to transform this exact learner-authored note into an essay-ready sentence: "${String(note || '')}".`,
    `The evaluator found conceptual accuracy: ${evaluation.accuracy || 'partial'}; sentence readiness: ${evaluation.sentenceOk ? 'yes' : 'no'}. Treat those judgments as authoritative.`,
    `Guide the learner to notice and repair the problem, then ask for another attempt in their own words. You may identify an incomplete thought, missing subject or action, punctuation issue, ambiguity, misconception, or lost connection to the note.`,
    `Never write, dictate, complete, rewrite, or offer a model sentence for the learner. Do not say "write" followed by suggested prose. The words accepted into the essay must come from the learner.`,
    `Use 2-3 short, warm sentences, no markdown.`,
  ].join('\n')
}

const SAFE_WRITING_RETRY = 'Reread your sentence. Check that it says the same accurate idea as your note and is a complete thought, then try again in your own words.'

/** Prevent a model-guidance failure from placing generated candidate prose in front of the learner. */
export function sanitizeWritingGuidance(reply) {
  const text = String(reply || '').trim()
  if (!text) return SAFE_WRITING_RETRY
  const suppliesWording =
    /\b(?:you could|you can|try to|please)\s+(?:write|say|use)\b/i.test(text) ||
    /\b(?:write|say|try|use)\s*:\s*/i.test(text) ||
    /\b(?:here(?:'s| is)|for example)\b[^.!?]{0,40}["“]/i.test(text) ||
    /["“][^"”]*(?:\s+[^"”]+){5,}["”]/.test(text)
  return suppliesWording ? SAFE_WRITING_RETRY : text
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

/** v5 repairs the comprehension-to-note handoff without generating new evidence. */
export function migrateWebbSnapshot(saved = {}) {
  const restored = migrateWebbSnapshotLegacy(saved)
  return {
    ...restored,
    ...(restored.objectives?.length ? reconcileWebbObjectiveState(restored.objectives, restored, restored.chatMessages || []) : {}),
    snapshotVersion: WEBB_SNAPSHOT_VERSION,
  }
}
