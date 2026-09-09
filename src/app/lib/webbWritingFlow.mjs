export const WEBB_WRITING_SUBPHASES = Object.freeze({
  IDLE: 'idle',
  BLANK: 'blank',
  FOCUS: 'focus',
  REVIEW: 'review',
  COMMITTED: 'committed',
})

const VALID_SUBPHASES = new Set(Object.values(WEBB_WRITING_SUBPHASES))

export function normalizeWritingSubphase(value, writingMode = false) {
  const normalized = String(value || '').trim().toLowerCase()
  if (VALID_SUBPHASES.has(normalized)) return normalized
  return writingMode ? WEBB_WRITING_SUBPHASES.FOCUS : WEBB_WRITING_SUBPHASES.IDLE
}

export function isWritingReadyNote(note) {
  if (!note || typeof note !== 'object' || Array.isArray(note)) return false
  return (
    note.provenance === 'learner-message'
    && note.accuracy === 'correct'
    && String(note.text || '').trim().length > 0
  )
}

export function writingReadyNoteIndices(objectives = [], learnerNotes = {}) {
  return (objectives || [])
    .map((_, index) => index)
    .filter(index => isWritingReadyNote(learnerNotes?.[index]))
}

export function hasAllWritingReadyNotes(objectives = [], learnerNotes = {}) {
  if (!Array.isArray(objectives) || objectives.length === 0) return false
  return writingReadyNoteIndices(objectives, learnerNotes).length === objectives.length
}

export function latestWritingAttempt(writingAttempts = {}, objectiveIndex = 0) {
  const attempts = Array.isArray(writingAttempts?.[objectiveIndex]) ? writingAttempts[objectiveIndex] : []
  return attempts.length ? attempts[attempts.length - 1] : null
}

export function acceptedWritingEntries(objectives = [], acceptedSentences = {}) {
  return (objectives || [])
    .map((_, index) => ({ index, sentence: acceptedSentences?.[index] || null }))
    .filter(entry => entry.sentence?.provenance === 'learner-message' && String(entry.sentence?.text || '').trim())
}