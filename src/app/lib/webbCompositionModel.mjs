export const WEBB_COMPOSITION_PROTOCOL_VERSION = 'webb-composition-v1'

function clean(value) {
  return String(value || '').trim()
}

function asIndex(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : null
}

export function normalizeWebbCompositionPlan(raw, objectiveCount = 0) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const controllingIdea = clean(input.controllingIdea || input.controlling_idea).slice(0, 500)
  const rows = Array.isArray(input.slots) ? input.slots : []
  const slots = rows.map((row, index) => {
    const role = clean(row?.role).toLowerCase()
    const sourceObjectiveIndices = [...new Set((Array.isArray(row?.sourceObjectiveIndices) ? row.sourceObjectiveIndices : row?.source_objective_indices || [])
      .map(asIndex).filter(value => value !== null && value < objectiveCount))]
    return {
      id: clean(row?.id || `${role || 'slot'}-${index + 1}`).slice(0, 100),
      role,
      focus: clean(row?.focus).slice(0, 320),
      connection: clean(row?.connection).slice(0, 500),
      sourceObjectiveIndices,
    }
  })
  return {
    protocolVersion: WEBB_COMPOSITION_PROTOCOL_VERSION,
    controllingIdea,
    slots,
  }
}

export function compositionPlanViolations(plan, objectiveCount = 0) {
  const normalized = normalizeWebbCompositionPlan(plan, objectiveCount)
  const violations = []
  const { slots } = normalized
  if (!normalized.controllingIdea) violations.push('missing controlling idea')
  if (slots.length < 4 || slots.length > 7) violations.push('composition must contain 4 to 7 sentences')
  if (slots[0]?.role !== 'topic') violations.push('first slot must be topic')
  if (slots.at(-1)?.role !== 'conclusion') violations.push('last slot must be conclusion')
  const bodies = slots.filter(slot => slot.role === 'body')
  if (bodies.length < 2 || bodies.length > 5) violations.push('composition must contain 2 to 5 body slots')
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]
    const expected = index === 0 ? 'topic' : (index === slots.length - 1 ? 'conclusion' : 'body')
    if (slot.role !== expected) violations.push(`slot ${index + 1} has invalid role`)
    if (!slot.id || !slot.focus || !slot.connection) violations.push(`slot ${index + 1} is incomplete`)
    if (slot.role === 'body' && slot.sourceObjectiveIndices.length === 0) violations.push(`body slot ${index + 1} has no source objective`)
    if (slot.role !== 'body' && slot.sourceObjectiveIndices.length > 0) violations.push(`${slot.role} slot must not be tied to a mastery objective`)
  }
  const bodySources = bodies.flatMap(slot => slot.sourceObjectiveIndices)
  if (new Set(bodySources).size < Math.min(2, objectiveCount || 2)) violations.push('body slots do not draw from enough distinct mastery objectives')
  if (new Set(slots.map(slot => slot.id)).size !== slots.length) violations.push('slot ids must be unique')
  return [...new Set(violations)]
}

export function compositionResearchSnapshot(objectives = [], learnerNotes = {}) {
  return (objectives || []).map((objective, objectiveIndex) => {
    const note = learnerNotes?.[objectiveIndex]
    return {
      objectiveIndex,
      objective: clean(objective),
      note: note?.provenance === 'learner-message' && clean(note?.text) ? {
        text: clean(note.text),
        sourceMessageId: note.sourceMessageId || null,
        sourceMessageCreatedAt: note.sourceMessageCreatedAt || null,
        provenance: 'learner-message',
      } : null,
    }
  })
}

export function compositionSlotSource(slot, objectives = [], learnerNotes = {}) {
  if (!slot || slot.role !== 'body') return { objectives: [], notes: [] }
  const sourceObjectiveIndices = Array.isArray(slot.sourceObjectiveIndices) ? slot.sourceObjectiveIndices : []
  const sourceObjectives = []
  const sourceNotes = []
  for (const objectiveIndex of sourceObjectiveIndices) {
    const objective = clean(objectives?.[objectiveIndex])
    const note = learnerNotes?.[objectiveIndex]
    if (objective) sourceObjectives.push({ objectiveIndex, objective })
    if (note?.provenance === 'learner-message' && clean(note?.text)) {
      sourceNotes.push({
        objectiveIndex,
        text: clean(note.text),
        sourceMessageId: note.sourceMessageId || null,
        sourceMessageCreatedAt: note.sourceMessageCreatedAt || null,
        provenance: 'learner-message',
      })
    }
  }
  return { objectives: sourceObjectives, notes: sourceNotes }
}

export function nextCompositionSlotIndex(plan, acceptedSentences = {}) {
  const slots = Array.isArray(plan?.slots) ? plan.slots : []
  return slots.findIndex((_, index) => !acceptedSentences?.[index])
}

export function assembleWebbCompositionEssay(plan, acceptedSentences = {}) {
  const slots = Array.isArray(plan?.slots) ? plan.slots : []
  if (!slots.length) return ''
  const sentences = slots.map((_, index) => acceptedSentences?.[index])
  if (sentences.some(sentence => sentence?.provenance !== 'learner-message' || !clean(sentence?.text))) return ''
  return sentences.map(sentence => clean(sentence.text)).join(' ')
}

function normalizedWords(value) {
  const stop = new Set(['a','an','and','are','as','at','be','because','but','by','for','from','has','have','in','is','it','of','on','or','that','the','their','there','they','this','to','was','were','when','with'])
  return clean(value).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(word => word && !stop.has(word))
}

export function writingSentenceSimilarity(left, right) {
  const leftWords = new Set(normalizedWords(left))
  const rightWords = new Set(normalizedWords(right))
  if (!leftWords.size || !rightWords.size) return 0
  let intersection = 0
  for (const word of leftWords) if (rightWords.has(word)) intersection += 1
  const union = new Set([...leftWords, ...rightWords]).size
  return union ? intersection / union : 0
}

export function findNearDuplicateAcceptedSentence(text, acceptedSentences = {}, currentIndex = null) {
  const wanted = clean(text)
  if (!wanted) return null
  const normalized = wanted.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
  for (const [rawIndex, sentence] of Object.entries(acceptedSentences || {})) {
    const index = Number(rawIndex)
    if (!Number.isInteger(index) || index === currentIndex) continue
    const other = clean(sentence?.text)
    if (!other) continue
    const otherNormalized = other.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
    const similarity = writingSentenceSimilarity(wanted, other)
    if (normalized === otherNormalized || (similarity >= 0.72 && normalized.split(' ').length >= 5 && otherNormalized.split(' ').length >= 5)) {
      return { index, similarity: normalized === otherNormalized ? 1 : similarity }
    }
  }
  return null
}

export function normalizeAcceptedCompositionSentences(raw = {}, plan = null) {
  const slots = Array.isArray(plan?.slots) ? plan.slots : []
  const accepted = {}
  for (const [rawIndex, value] of Object.entries(raw && typeof raw === 'object' ? raw : {})) {
    const index = asIndex(rawIndex)
    if (index === null || index >= slots.length || !value || typeof value !== 'object') continue
    const text = clean(value.text).slice(0, 4000)
    if (!text || value.provenance !== 'learner-message') continue
    accepted[index] = {
      ...value,
      text,
      slotId: slots[index]?.id || value.slotId || null,
      slotRole: slots[index]?.role || value.slotRole || null,
      provenance: 'learner-message',
    }
  }
  return accepted
}
