import { normalizeSlateCognitiveDemandType, validateSlateCognitiveDemand } from './slateCognitiveDemand.mjs'

// Objective coverage is distinct from topical relevance. A question about the
// same subject does not necessarily assess the skill taught in Liftoff.
const REASONING_SKILL = /\b(defend(?:ing|s|ed)?|justif(?:y|ies|ied|ication)|explain(?:ing|s|ed)?|prov(?:e|ing|es)|reasonab(?:le|leness)|compar(?:e|ing)|interpret|choose.{0,45}strateg|plan and solve)\b/i
const REASONING_QUESTION = /\b(explain(?:ing)?|justif(?:y|ying)|defend(?:ing)?|prov(?:e|ing)|why|reasoning|describe.{0,35}how|show.{0,20}why|compar(?:e|ing).{0,35}strateg|interpret)\b/i

function text(value) { return String(value ?? '').trim() }
function question(item = {}) { return text(item?.question || item?.prompt || item?.text) }
function fingerprint(value) { return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function items(value) {
  return Array.isArray(value) ? value : (Array.isArray(value?.questions) ? value.questions : [])
}

function assessmentObjectives(lesson, liftoff) {
  const components = Array.isArray(liftoff?.components) ? liftoff.components.filter(c => c?.essential !== false) : []
  const authored = items(lesson?.learningObjectives || lesson?.objectives)
  return (components.length ? components : authored).map(row => ({
    id: text(row.id),
    name: text(row.name || row.title),
    description: text(row.description || row.demonstration || row.objective),
    evidenceType: text(row.evidenceType),
  })).filter(row => row.id)
}

function numericSignature(value) {
  const digits = text(value).match(/[0-9][0-9,.]*/g) || []
  const normalized = digits.map(token => token.replace(/,/g, '')).filter(Boolean)
  return normalized.length >= 2 ? normalized.sort().join(':') : ''
}

function priorQuestions(lesson, liftoff) {
  const fields = ['baseline', 'sample', 'truefalse', 'multiplechoice', 'fillintheblank', 'shortanswer', 'wordProblems', 'worksheet', 'discussion', 'comprehension', 'exercise']
  const fromLesson = fields.flatMap(key => items(lesson?.[key]).map(question))
  const history = Array.isArray(liftoff?.problemHistory) ? liftoff.problemHistory.map(x => text(x?.prompt)) : []
  return new Set([...fromLesson, ...history].map(fingerprint).filter(Boolean))
}

export function validateSlateTestAlignment({ lesson = {}, liftoff = null, testItems = [] } = {}) {
  const objectives = assessmentObjectives(lesson, liftoff)
  const problems = items(testItems)
  const errors = []
  const liftoffAssessment = Array.isArray(liftoff?.components) && liftoff.components.length > 0
  if (!objectives.length) errors.push('no_objectives')
  if (problems.length < Math.max(6, objectives.length)) errors.push('insufficient_test_items')
  const objectiveIds = new Set(objectives.map(x => x.id))
  if (objectiveIds.size !== objectives.length) errors.push('duplicate_objective_ids')
  if (!liftoffAssessment) {
    const modes = new Set(['reasoned_explanation', 'calculation', 'application', 'recognition'])
    for (const objective of objectives) {
      if (!modes.has(objective.evidenceType)) errors.push(`invalid_evidence_type:${objective.id}`)
    }
  }

  const seenObjectives = new Set()
  const reasoningCovered = new Set()
  const seenQuestions = new Set()
  const exposedQuestions = priorQuestions(lesson, liftoff)
  const taughtMathInstances = new Set((Array.isArray(liftoff?.problemHistory) ? liftoff.problemHistory : [])
    .map(problem => numericSignature(problem?.prompt)).filter(Boolean))

  for (let index = 0; index < problems.length; index++) {
    const item = problems[index] || {}
    const prompt = question(item)
    const key = fingerprint(prompt)
    const id = text(item.objectiveId || item.objective_id)
    const objective = objectives.find(x => x.id === id)

    if (!key || seenQuestions.has(key)) errors.push(`duplicate_or_empty_test_question:${index + 1}`)
    if (key && exposedQuestions.has(key)) errors.push(`exposed_test_question:${index + 1}`)
    const mathSignature = numericSignature(prompt)
    if (mathSignature && taughtMathInstances.has(mathSignature)) errors.push(`repeated_math_instance:${index + 1}`)
    seenQuestions.add(key)

    if (!id || !objectiveIds.has(id)) errors.push(`unmapped_test_question:${index + 1}`)
    else seenObjectives.add(id)

    if (liftoffAssessment && prompt) {
      const cognitive = validateSlateCognitiveDemand({
        prompt,
        criterion: text(item.criterion),
        demandType: text(item.demandType),
      })
      if (!cognitive.ok) errors.push(`${cognitive.reason}:${index + 1}`)
    }

    const choices = Array.isArray(item.choices) ? item.choices : []
    const isChoice = choices.length > 0
    const isBoolean = typeof item.answer === 'boolean' || typeof item.correct === 'boolean'
    const expected = items(item.expectedAny).map(text).filter(Boolean)
    const hasAnswer = expected.length || text(item.expected) || text(item.answer) || isBoolean ||
      (isChoice && (Number.isInteger(item.correct) || text(item.correct)))
    if (!hasAnswer) errors.push(`missing_answer_key:${index + 1}`)
    if (isChoice && (choices.length !== 4 || !Number.isInteger(item.correct) || item.correct < 0 || item.correct > 3)) {
      errors.push(`invalid_choices:${index + 1}`)
    }

    const mustExplain = objective && (objective.evidenceType === 'reasoned_explanation' ||
      REASONING_SKILL.test([objective.name, objective.description].join(' ')))
    const demandType = normalizeSlateCognitiveDemandType(item.demandType)
    const itemExplains = !isChoice && !isBoolean && (demandType === 'explain' || REASONING_QUESTION.test(prompt))
    const hasReasoningReference = [...expected, text(item.expected)]
      .some(answer => (answer.match(/[a-z]+/gi) || []).length >= 4)

    if (mustExplain && liftoffAssessment) {
      if (itemExplains) {
        reasoningCovered.add(id)
        if (!hasReasoningReference) errors.push(`reasoning_reference_missing:${id || index + 1}`)
      }
    } else if (mustExplain) {
      if (!itemExplains) errors.push(`reasoning_not_assessed:${id || index + 1}`)
      if (!hasReasoningReference) errors.push(`reasoning_reference_missing:${id || index + 1}`)
    }
  }

  for (const obj of objectives) {
    if (!seenObjectives.has(obj.id)) errors.push(`objective_not_assessed:${obj.id}`)
    const mustExplain = obj.evidenceType === 'reasoned_explanation' ||
      REASONING_SKILL.test([obj.name, obj.description].join(' '))
    if (liftoffAssessment && mustExplain && !reasoningCovered.has(obj.id)) {
      errors.push(`reasoning_not_assessed:${obj.id}`)
    }
  }

  const lessonDemandsReasoning = /\b(defend(?:ing|s|ed)?|justif(?:y|ies|ied|ication)|explain(?:ing|s|ed)?|reasonab(?:le|leness)|prov(?:e|ing))\b/i.test(
    [lesson?.title, lesson?.blurb, lesson?.description].map(text).join(' '))
  if (lessonDemandsReasoning && !objectives.some(obj =>
    obj.evidenceType === 'reasoned_explanation' || REASONING_SKILL.test([obj.name, obj.description].join(' ')))) {
    errors.push('lesson_reasoning_missing_from_objectives')
  }
  if (lessonDemandsReasoning && !problems.some(item =>
    !items(item?.choices).length && REASONING_QUESTION.test(question(item)))) {
    errors.push('lesson_reasoning_missing_from_test')
  }

  return { ok: errors.length === 0, errors, objectiveIds: objectives.map(x => x.id), coveredIds: [...seenObjectives] }
}
