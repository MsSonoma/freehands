import { createLearnerNote, sourceLearnerMessage } from './webbLearnerEvidence.mjs'
import { classifyWebbObjectiveAttempt } from './webbMasteryModel.mjs'
import { reconcileWebbObjectiveState } from './webbObjectiveState.mjs'

// The application chooses ONE learner response. The model only judges its meaning.
// There is deliberately no generated quote or message number in this contract.
const JUDGMENT_INSTRUCTIONS = [
  'Evaluate only learner_response. The conversation before it is context, never substitute evidence. Judge that ENTIRE message, including any contradiction.',
  'Judge semantic meaning generously enough for normal child language, while keeping factual and conceptual correctness strict.',
  'The student may use age-appropriate wording, paraphrases, short explanations, fragments, or valid examples. Never require a memorized definition or wording that matches the lesson.',
  'Judge the CENTRAL CONCEPT, not clause-by-clause coverage. Accuracy is correct when the essential idea is accurately communicated with no material misconception.',
  'Do not require every modifier, example, consequence, application, condition, or secondary detail. When an older objective combines ideas, assess its primary concept; do not withhold credit merely because secondary detail was omitted.',
  'Use partial only when an ESSENTIAL part of the central concept is missing, ambiguous, or incomplete. A brief but semantically sufficient child answer is correct, not partial.',
  'A fragment may be ACCURACY "correct" when it contains the central concept. A name alone can answer who, using the preceding question as context.',
  'Independently set sentenceOk true only for a complete, coherent sentence usable verbatim in the essay with at most minor spelling, capitalization or punctuation issues. Fragments and single names have sentenceOk false. Do not repair or supply prose.',
  'Use evidenceKind fixed_fact only for identification of a name, title, date, quantity, or another single fixed factual answer. Such tasks do not require synonyms. Use meaning for definitions, reasoning, comparisons, explanations, processes and applications.',
  'Do not change an incorrect answer to correct based on the kind of task. Do not cherry-pick a true fragment out of a materially contradictory response.',
  'Return only JSON: {"evaluations":[{"objectiveIndex":0,"accuracy":"correct","sentenceOk":true,"evidenceKind":"fixed_fact"}]}. Use the exact objectiveIndex supplied in remaining_objectives. Include only objectives addressed by learner_response, once each. Return {"evaluations":[]} when none is addressed.',
].join(' ')

function parseJudgments(raw, candidates, sourceMessageIndex) {
  let parsed
  try { parsed = JSON.parse(raw) } catch { throw new Error('The learning evaluator returned invalid judgments.') }
  if (!parsed || !Array.isArray(parsed.evaluations)) throw new Error('The learning evaluator returned no judgments.')
  const allowed = new Set(candidates.map(({ i }) => i))
  const seen = new Set()
  return parsed.evaluations.map(row => {
    if (!row || !Number.isInteger(row.objectiveIndex) || !allowed.has(row.objectiveIndex)
      || seen.has(row.objectiveIndex) || !['correct', 'partial', 'incorrect'].includes(row.accuracy)
      || typeof row.sentenceOk !== 'boolean' || !['fixed_fact', 'meaning'].includes(row.evidenceKind)) {
      throw new Error('The learning evaluator returned invalid judgments.')
    }
    seen.add(row.objectiveIndex)
    // The trusted source is bound here, never chosen or rewritten by the model.
    return { objectiveIndex: row.objectiveIndex, accuracy: row.accuracy,
      sentenceOk: row.sentenceOk, evidenceKind: row.evidenceKind, sourceMessageIndex }
  })
}

// Shared by Sonoma and Webb. Injected transport keeps the real handoff testable.
export async function evaluateWebbObjectives({
  callModel, objectives = [], completedIndices = [], understoodIndices = null,
  coveredIndices = [], legacyNoteReadyIndices = null, conversation = [], lesson = {},
  quick = false, objectiveEvidence: priorObjectiveEvidence = {}, priorPromptExposure = {},
  recoverNotes = false,
} = {}) {
  const suppliedUnderstood = Array.isArray(understoodIndices) ? understoodIndices
    : (Array.isArray(legacyNoteReadyIndices) ? legacyNoteReadyIndices : completedIndices)
  const state = reconcileWebbObjectiveState(objectives, {
    coveredObj: coveredIndices, understoodObj: suppliedUnderstood, objectiveEvidence: priorObjectiveEvidence,
  }, conversation)
  const understood = new Set(state.understoodObj)
  const candidates = () => objectives.map((obj, i) => ({ obj, i }))
    .filter(({ i }) => !understood.has(i) || (recoverNotes && !state.learnerNotes[i]))
  const evaluationStatus = {}
  const sentenceQuality = {}
  const finish = () => {
    const newlyUnderstood = [...understood].filter(index => !suppliedUnderstood.includes(index))
    return {
      contractVersion: 'webb-objective-result-v2',
      newlyCovered: state.coveredObj.filter(index => !coveredIndices.includes(index)),
      newlyUnderstood, newlyCompleted: newlyUnderstood,
      learnerNotes: state.learnerNotes,
      qualifyingText: Object.fromEntries(Object.entries(state.learnerNotes).map(([index, note]) => [index, note.text])),
      objectiveEvidence: state.objectiveEvidence, evaluationStatus, sentenceQuality,
    }
  }
  if (!candidates().length) return finish()
  const learnerIndices = conversation.map((_, index) => index).filter(index => sourceLearnerMessage(conversation, index))
  // Foreground checks evaluate the actual current response, not a model-selected turn.
  // Explicit legacy recovery examines a bounded recent history chronologically.
  // Earlier confirmed responses are already recovered above without model calls.
  const targets = recoverNotes ? learnerIndices.slice(-12) : learnerIndices.slice(-1)
  for (const sourceMessageIndex of targets) {
    const remaining = candidates()
    if (!remaining.length) break
    const source = sourceLearnerMessage(conversation, sourceMessageIndex)
    const contextStart = Math.max(0, sourceMessageIndex - (quick ? 8 : 30))
    const raw = await callModel(JUDGMENT_INSTRUCTIONS, JSON.stringify({
      instructional_context: lesson,
      remaining_objectives: remaining.map(({ obj, i }) => ({ objectiveIndex: i, objective: obj })),
      context_before_response: conversation.slice(contextStart, sourceMessageIndex)
        .filter(message => ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string')
        .map(({ role, content }) => ({ role, content })),
      learner_response: source.text,
    }), 800, 0, { type: 'json_object' })
    if (!String(raw || '').trim()) throw new Error('The learning evaluator returned no result.')
    for (const evaluation of parseJudgments(raw, remaining, sourceMessageIndex)) {
      const index = evaluation.objectiveIndex
      const classification = classifyWebbObjectiveAttempt({
        objectiveIndex: index, objective: objectives[index], evaluation, conversation,
        previousEvidence: state.objectiveEvidence[index] || {},
        priorPromptExposed: priorPromptExposure[index] !== false,
      })
      if (!classification) throw new Error('The learning result did not refer to a learner message.')
      state.objectiveEvidence[index] = classification
      const attempt = classification.attempts.find(item => item.sourceMessageIndex === sourceMessageIndex
        && item.text === source.text && (!source.message.id || item.sourceMessageId === source.message.id))
      if (!attempt) throw new Error('The learner judgment did not retain its source.')
      evaluationStatus[index] = attempt.reproduction && attempt.comprehension !== 'demonstrated' ? 'reproduced' : attempt.accuracy
      sentenceQuality[index] = attempt.sentenceOk === true
      if (classification.coverage === 'covered' && !state.coveredObj.includes(index)) state.coveredObj.push(index)
      if (attempt.comprehension === 'demonstrated') {
        const note = createLearnerNote({ objectiveIndex: index,
          evaluation: { ...evaluation, accuracy: attempt.accuracy, sentenceOk: attempt.sentenceOk }, conversation })
        if (!note) throw new Error('The qualified learner response could not be captured.')
        understood.add(index)
        state.learnerNotes[index] = note
      }
    }
  }
  return finish()
}
