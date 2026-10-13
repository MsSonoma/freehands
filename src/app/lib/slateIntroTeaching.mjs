import { splitIntoSentences } from '../session/utils/textProcessing.js'

export function createSlateIntroTeaching(response, question) {
  const sentences = splitIntoSentences(response).map((text) => String(text).trim()).filter(Boolean)
  if (!sentences.length) return null
  return { sentences, index: 0, question: String(question || '').trim() }
}

// Lesson snapshots may be resumed on another device. Only restore a bounded,
// well-formed cursor, never generate or silently reveal unread sentences.
export function restoreSlateIntroTeaching(raw) {
  if (!raw || !Array.isArray(raw.sentences) || !raw.sentences.length || raw.sentences.length > 100) return null
  if (raw.sentences.some((text) => typeof text !== 'string' || !text.trim() || text.length > 1800)) return null
  if (!Number.isInteger(raw.index) || raw.index < 0 || raw.index >= raw.sentences.length) return null
  return {
    sentences: raw.sentences.map((text) => text.trim()),
    index: raw.index,
    question: String(raw.question || '').trim(),
  }
}

export function advanceSlateIntroTeaching(stage) {
  const restored = restoreSlateIntroTeaching(stage)
  if (!restored) return null
  const index = restored.index + 1
  if (index < restored.sentences.length) {
    return { kind: 'sentence', sentence: restored.sentences[index], stage: { ...restored, index } }
  }
  return { kind: 'question', question: restored.question }
}
