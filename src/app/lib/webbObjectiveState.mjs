import { isSourceVerifiedNote, learnerMessageIndex, noteFromQualifiedAttempt } from './webbLearnerEvidence.mjs'
import { isWritingReadyNote, hasAllWritingReadyNotes } from './webbWritingFlow.mjs'

export function emptyWebbObjectiveState() {
  return { coveredObj: [], understoodObj: [], objectiveEvidence: {}, learnerNotes: {} }
}

function validIndices(values, objectives) {
  return (Array.isArray(values) ? values : []).map(learnerMessageIndex)
    .filter(index => index !== null && typeof objectives[index] === 'string')
}

/** Repair notes from recorded evidence, without regrading or rewriting history. */
export function reconcileWebbObjectiveState(objectives = [], state = {}, conversation = []) {
  const understood = new Set(validIndices(state.understoodObj, objectives))
  const covered = new Set(validIndices(state.coveredObj, objectives))
  const learnerNotes = { ...(state.learnerNotes || {}) }
  const objectiveEvidence = { ...(state.objectiveEvidence || {}) }
  objectives.forEach((objective, index) => {
    const evidence = objectiveEvidence[index]
    if (evidence?.objective && evidence.objective !== objective) return
    if (evidence?.coverage === 'covered') covered.add(index)
    if (evidence?.comprehension === 'demonstrated') understood.add(index)
    const attempts = [...(evidence?.attempts || []), ...(evidence?.latestAttempt ? [evidence.latestAttempt] : [])]
    for (const attempt of attempts) {
      const note = noteFromQualifiedAttempt({ objectiveIndex: index, objective, attempt, conversation })
      if (!note) continue
      understood.add(index)
      covered.add(index)
      if (!isWritingReadyNote(learnerNotes[index])) learnerNotes[index] = note
      break
    }
    // Existing source-verified notes from older snapshots retain their meaning.
    if (isWritingReadyNote(learnerNotes[index])) understood.add(index)
  })
  for (const index of understood) covered.add(index)
  return {
    coveredObj: [...covered].sort((a, b) => a - b),
    understoodObj: [...understood].sort((a, b) => a - b),
    learnerNotes, objectiveEvidence,
  }
}

function attemptKey(attempt) {
  return `${attempt?.sourceMessageId || attempt?.sourceMessageIndex}:${attempt?.text || ''}`
}

/** Merge results, never replacing newer learner work with a stale response. */
export function mergeWebbObjectiveResult(objectives, current, result, conversation) {
  if (!result || result.error || !Array.isArray(result.newlyUnderstood)
    || !Array.isArray(result.newlyCovered) || !result.objectiveEvidence || !result.learnerNotes) {
    throw new Error('The learning check did not return a usable result.')
  }
  const evidence = { ...(current.objectiveEvidence || {}) }
  for (const [rawIndex, incoming] of Object.entries(result.objectiveEvidence)) {
    const index = learnerMessageIndex(rawIndex)
    if (index === null || !objectives[index] || incoming?.objective !== objectives[index]) continue
    const prior = evidence[index] || {}
    const attempts = new Map((prior.attempts || []).map(attempt => [attemptKey(attempt), attempt]))
    for (const attempt of incoming.attempts || []) {
      if (!attempts.has(attemptKey(attempt))) attempts.set(attemptKey(attempt), attempt)
    }
    const assistance = new Map([...(prior.currentSessionAssistance || []), ...(incoming.currentSessionAssistance || [])]
      .map(entry => [`${entry.type}:${entry.sourceMessageId || entry.sourceMessageIndex}:${entry.occurredAt || ''}`, entry]))
    evidence[index] = {
      ...incoming,
      coverage: prior.coverage === 'covered' ? 'covered' : incoming.coverage,
      comprehension: prior.comprehension === 'demonstrated' ? 'demonstrated' : incoming.comprehension,
      mastery: prior.mastery === 'mastered' ? 'mastered' : incoming.mastery,
      attempts: [...attempts.values()], currentSessionAssistance: [...assistance.values()],
    }
  }
  const notes = { ...(current.learnerNotes || {}) }
  for (const [rawIndex, note] of Object.entries(result.learnerNotes)) {
    const index = learnerMessageIndex(rawIndex)
    if (index === null || !objectives[index] || isWritingReadyNote(notes[index])) continue
    if (isSourceVerifiedNote(note, conversation, index)) notes[index] = note
  }
  return reconcileWebbObjectiveState(objectives, {
    coveredObj: [...(current.coveredObj || []), ...result.newlyCovered],
    understoodObj: [...(current.understoodObj || []), ...result.newlyUnderstood],
    objectiveEvidence: evidence, learnerNotes: notes,
  }, conversation)
}

export function webbObjectiveProgress(objectives = [], state = {}) {
  const understood = new Set(validIndices(state.understoodObj, objectives))
  const remainingIndices = objectives.map((_, index) => index).filter(index => !understood.has(index))
  const missingNoteIndices = [...understood].filter(index => !isWritingReadyNote(state.learnerNotes?.[index]))
  return {
    understoodIndices: [...understood],
    understoodCount: understood.size,
    remainingIndices,
    remainingObjectives: remainingIndices.map(index => objectives[index]),
    completedObjectives: [...understood].map(index => objectives[index]),
    missingNoteIndices,
    allObjectivesMet: objectives.length > 0 && remainingIndices.length === 0,
    writingReady: objectives.length > 0 && remainingIndices.length === 0
      && hasAllWritingReadyNotes(objectives, state.learnerNotes),
  }
}

/** All foreground/background checks share one queue; invalidated runs cannot publish. */
export function createWebbObjectiveQueue() {
  let tail = Promise.resolve()
  let generation = 0
  return {
    invalidate() { generation += 1; tail = Promise.resolve() },
    run(task) {
      const current = generation
      const isCurrent = () => current === generation
      const result = tail.then(() => isCurrent() ? task(isCurrent) : null)
      tail = result.catch(() => {})
      return result
    },
  }
}
