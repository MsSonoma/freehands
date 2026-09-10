import { parseComprehensionEvaluations } from './webbLearningModel.mjs'
import { createLearnerNote } from './webbLearnerEvidence.mjs'
import { classifyWebbObjectiveAttempt } from './webbMasteryModel.mjs'
import { reconcileWebbObjectiveState } from './webbObjectiveState.mjs'

// Shared by Sonoma and Webb. Transport is injected so the complete handoff is testable.
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
  const incomplete = objectives.map((obj, i) => ({ obj, i }))
    .filter(({ i }) => !understood.has(i) || (recoverNotes && !state.learnerNotes[i]))
  const evaluationStatus = {}
  const sentenceQuality = {}
  const finish = () => {
    const newlyUnderstood = [...understood].filter(index => !suppliedUnderstood.includes(index))
    return {
      contractVersion: 'webb-objective-result-v2',
      newlyCovered: state.coveredObj.filter(index => !coveredIndices.includes(index)),
      newlyUnderstood,
      newlyCompleted: newlyUnderstood,
      learnerNotes: state.learnerNotes,
      qualifyingText: Object.fromEntries(Object.entries(state.learnerNotes).map(([index, note]) => [index, note.text])),
      objectiveEvidence: state.objectiveEvidence, evaluationStatus, sentenceQuality,
    }
  }
  if (!incomplete.length) return finish()
  const windowSize = recoverNotes ? conversation.length : (quick ? 8 : 30)
  const startIndex = Math.max(0, conversation.length - windowSize)
  const recentTurns = conversation.slice(startIndex).map((message, offset) => ({ message, idx: startIndex + offset }))
    .filter(({ message }) => ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string')
  if (!recentTurns.some(({ message }) => message.role === 'user' && message.content.trim())) return finish()

  const system =
    `You are evaluating whether a student has demonstrated comprehension of lesson concepts. ` +
    `Judge semantic meaning generously enough for normal child language, while keeping factual and conceptual correctness strict. ` +
    `The student may use any age-appropriate wording, paraphrase, short explanation, fragment, or valid example. NEVER require exact terminology, a memorized definition, a polished sentence, or wording that matches the lesson. ` +
    `Judge the CENTRAL CONCEPT, not clause-by-clause coverage. A response is ACCURACY "correct" when it accurately communicates the essential idea, relationship, process, or skill strongly enough to show understanding and contains no material misconception or contradiction. ` +
    `Do NOT require every modifier, example, consequence, application, condition, or secondary detail named in an objective. If an older objective accidentally combines several ideas, identify its primary concept and do not withhold credit merely because secondary detail was omitted. ` +
    `Use ACCURACY "partial" only when an ESSENTIAL part of the central concept is missing, ambiguous, or incomplete. A brief but semantically sufficient child answer is correct, not partial. ` +
    `Use the instructional lesson context to judge meaning and factual correctness, never as a required answer key. ` +
    `For each remaining objective that the recent student messages address enough to evaluate, output one line: OBJECTIVE_INDEX|ACCURACY|SENTENCE_OK|MESSAGE_INDEX|EVIDENCE_KIND ` +
    `where ACCURACY is exactly "correct", "partial", or "incorrect". Judge ACCURACY from conceptual meaning alone, independently of grammar or sentence form. A fragment may be ACCURACY "correct" when it contains the central concept; SENTENCE_OK must separately judge whether it is essay-ready. ` +
    `SENTENCE_OK is "yes" only when the student's full response is a complete, grammatically coherent sentence suitable for the child's essay with at most minor spelling, capitalization, or punctuation fixes. ` +
    `Use SENTENCE_OK "no" for a fragment, single word, phrase, materially broken grammar, garbled or repeated wording, or anything that would require rephrasing, restructuring, or adding missing words. ` +
    `MESSAGE_INDEX must be the integer index of one actual STUDENT message, WITHOUT brackets. For example: 0|correct|yes|1|fixed_fact. Judge that ENTIRE message, including any contradiction. Do not output, quote, edit, or paraphrase student text. When several messages are sufficient, prefer the earliest sufficient answer before teacher wording was supplied. Teacher turns are context only, never evidence. ` +
    `EVIDENCE_KIND is "fixed_fact" only when this objective asks the learner to identify a name, title, date, quantity, or other single fixed factual answer. Such answers naturally share wording with teaching and do not need synonyms. Use "meaning" for definitions, explanations, reasoning, processes, comparisons, or applications. This distinction never changes factual accuracy. ` +
    `If a response contains a material contradiction or misconception, do not cherry-pick one correct phrase and call the objective correct. ` +
    `If no remaining objective is addressed enough to evaluate, return "none".`


  const objList = incomplete.map(({ obj, i }) => i + ': ' + obj).join('\n')
  const dialogue = recentTurns.map(({ message, idx }) => '[' + idx + '] ' + (message.role === 'user' ? 'STUDENT' : 'TEACHER') + ': ' + JSON.stringify(message.content)).join('\n')
  const raw = await callModel(system,
    'Instructional lesson context (not required wording):\n' + JSON.stringify(lesson)
      + '\n\nRemaining objectives (number: text):\n' + objList + '\n\nConversation:\n' + dialogue,
    400, 0)
  if (!String(raw || '').trim()) throw new Error('The learning evaluator returned no result.')
  const parsed = parseComprehensionEvaluations({
    raw, objectives, understoodIndices: recoverNotes ? [] : [...understood], conversation,
  })
  if (parsed.invalidLines.length) throw new Error('The learning evaluator returned invalid source evidence.')
  Object.assign(evaluationStatus, parsed.evaluationStatus)
  Object.assign(sentenceQuality, parsed.sentenceQuality)
  for (const [rawIndex, evaluation] of Object.entries(parsed.evaluationDetails)) {
    const index = Number(rawIndex)
    const classification = classifyWebbObjectiveAttempt({
      objectiveIndex: index, objective: objectives[index], evaluation, conversation,
      previousEvidence: state.objectiveEvidence[index] || {},
      priorPromptExposed: priorPromptExposure[index] !== false,
    })
    if (!classification) throw new Error('The learning result did not refer to a learner message.')
    state.objectiveEvidence[index] = classification
    if (classification.coverage === 'covered' && !state.coveredObj.includes(index)) state.coveredObj.push(index)
    if (classification.latestAttempt?.reproduction && classification.latestAttempt?.comprehension !== 'demonstrated') evaluationStatus[index] = 'reproduced'
    if (classification.latestAttempt?.comprehension === 'demonstrated') {
      // The same verified source creates the note and supports the judgment.
      // No second model-generated quote can veto this transition.
      const note = createLearnerNote({ objectiveIndex: index, evaluation, conversation })
      if (!note) throw new Error('The qualified learner response could not be captured.')
      understood.add(index)
      state.learnerNotes[index] = note
    }
  }
  return finish()
}
