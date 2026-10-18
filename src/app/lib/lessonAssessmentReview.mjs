import { validateSlateTestAlignment } from './slateTestAlignment.mjs'

// This checks generated assessment coverage, not learner mastery. A deficiency
// belongs to lesson production and must never prevent saving a usable draft.
function assessment(lesson) {
  return validateSlateTestAlignment({ lesson, testItems: lesson?.test })
}

function question(item) {
  return String(item?.question || item?.prompt || item?.text || '').trim()
}

export function assessmentRepairTargets(lesson, errors = []) {
  const test = Array.isArray(lesson?.test) ? lesson.test : []
  const objectives = Array.isArray(lesson?.learningObjectives) ? lesson.learningObjectives : []
  const targetIndices = new Set()
  const missingObjectiveIds = new Set()
  let addItems = false
  for (const error of errors) {
    const [code, ...parts] = String(error || '').split(':')
    const value = parts.join(':')
    if (['duplicate_or_empty_test_question', 'exposed_test_question', 'repeated_math_instance', 'unmapped_test_question', 'missing_answer_key', 'invalid_choices'].includes(code)) {
      const index = Number(value)
      if (Number.isInteger(index) && index > 0 && index <= test.length) targetIndices.add(index)
    } else if (code === 'reasoning_not_assessed' || code === 'reasoning_reference_missing') {
      test.forEach((item, index) => {
        if (String(item?.objectiveId || item?.objective_id) !== value) return
        // Reuse the existing validator for this individual item, so good
        // explanations under the same objective are never rewritten.
        if (assessment({ ...lesson, test: [item] }).errors.includes(error)) targetIndices.add(index + 1)
      })
    } else if (code === 'objective_not_assessed') {
      if (objectives.some((item) => String(item?.id) === value)) missingObjectiveIds.add(value)
      addItems = true
    } else if (code === 'insufficient_test_items') {
      addItems = true
    } else if (code === 'lesson_reasoning_missing_from_test') {
      test.forEach((item, index) => {
        const related = objectives.find((obj) => String(obj?.id) === String(item?.objectiveId || item?.objective_id))
        if (related?.evidenceType === 'reasoned_explanation') targetIndices.add(index + 1)
      })
    }
  }
  const desired = Math.max(6, objectives.length)
  const additionalCount = addItems ? Math.min(12, Math.max(desired - test.length, missingObjectiveIds.size)) : 0
  return {
    indices: [...targetIndices].sort((a, b) => a - b),
    missingObjectiveIds: [...missingObjectiveIds],
    additionalCount,
  }
}

export function assessmentRepairPrompt(lesson, alignment) {
  const targets = assessmentRepairTargets(lesson, alignment.errors)
  if (!Array.isArray(lesson?.learningObjectives) || !lesson.learningObjectives.length) return null
  if (!targets.indices.length && !targets.additionalCount) return null
  const instructional = ['baseline', 'truefalse', 'multiplechoice', 'fillintheblank', 'shortanswer', 'worksheet', 'exercise', 'comprehension']
    .flatMap((name) => (Array.isArray(lesson?.[name]) ? lesson[name] : []).map(question))
    .filter(Boolean).slice(0, 30)
  const context = {
    title: lesson.title, subject: lesson.subject, grade: lesson.grade, difficulty: lesson.difficulty,
    objectives: lesson.learningObjectives, originalTest: lesson.test,
    previousInstructionalQuestions: instructional,
    problemsToFix: alignment.errors,
    replaceQuestionIndices: targets.indices,
    objectivesMissingTestQuestions: targets.missingObjectiveIds,
    numberOfAdditionalItems: targets.additionalCount,
  }
  return `Improve ONLY the held-out independent test items identified below. Preserve the educator's lesson title, teaching content, objectives, instructional examples, and every unaffected test item. An objective requiring reasoning must be tested with an open-ended question that explicitly asks the learner to explain why, defend, or justify a method; provide a complete reference explanation in expectedAny, not merely a number. Do not repeat instructional questions, disclose test answers to the learner, or change an objective to make an inadequate question appear aligned. Return ONLY a JSON object in this format: {"repairs":[{"index":1,"item":{"id":"...", "objectiveId":"...", "question":"...", "expectedAny":["..."]}}], "additions":[{"id":"...", "objectiveId":"...", "question":"...", "expectedAny":["..."]}]}. Indices are 1-based. Replace ONLY the listed indices, and add questions ONLY when asked. For each replacement preserve its original objectiveId unless it is unmapped. Include one addition for each missing objective. Valid independent questions may be calculations, applications, or reasoning depending on the objectives. If reasoning is required do not use choices or a true/false answer. All additions must be different from every existing instructional and test question.\n\n${JSON.stringify(context)}`
}

export function applyTargetedAssessmentRepair(lesson, proposal, targets) {
  if (!proposal || typeof proposal !== 'object') return lesson
  const test = Array.isArray(lesson?.test) ? [...lesson.test] : []
  let changed = false
  const allowed = new Set(targets.indices)
  for (const entry of Array.isArray(proposal.repairs) ? proposal.repairs : []) {
    const index = Number(entry?.index)
    if (!Number.isInteger(index) || !allowed.has(index) || !entry?.item || typeof entry.item !== 'object' || Array.isArray(entry.item)) continue
    if (!question(entry.item)) continue
    const previous = test[index - 1] || {}
    const currentId = String(previous.objectiveId || previous.objective_id || '')
    const candidateId = String(entry.item.objectiveId || entry.item.objective_id || '')
    // A repair must not claim to assess a different objective.
    if (currentId && candidateId !== currentId) continue
    test[index - 1] = { ...entry.item, objectiveId: currentId || candidateId }
    changed = true
  }
  const additions = Array.isArray(proposal.additions) ? proposal.additions : []
  const allowedIds = new Set((lesson.learningObjectives || []).map((obj) => String(obj.id)))
  let appended = 0
  for (const item of additions) {
    if (appended >= targets.additionalCount) break
    if (!item || typeof item !== 'object' || Array.isArray(item) || !question(item)) continue
    const id = String(item.objectiveId || item.objective_id || '')
    if (!allowedIds.has(id)) continue
    test.push({ ...item, objectiveId: id })
    appended++
    changed = true
  }
  return changed ? { ...lesson, test } : lesson
}

export function generatedAssessmentReview(lesson, { repairAttempted = false, repaired = false } = {}) {
  const check = assessment(lesson)
  const questions = Array.isArray(lesson?.test) ? lesson.test : []
  const need = new Set()
  for (const issue of check.errors) {
    const [kind, ...rest] = issue.split(':')
    const detail = rest.join(':')
    if (['reasoning_not_assessed', 'reasoning_reference_missing', 'objective_not_assessed', 'invalid_evidence_type'].includes(kind)) {
      if (detail) need.add(detail)
    } else if (['duplicate_or_empty_test_question', 'exposed_test_question', 'repeated_math_instance', 'unmapped_test_question', 'missing_answer_key', 'invalid_choices'].includes(kind)) {
      const index = Number(detail)
      const objective = questions[index - 1]
      if (objective?.objectiveId || objective?.objective_id) need.add(String(objective.objectiveId || objective.objective_id))
    }
  }
  // A missing or structurally incomplete test provides no verified coverage.
  if (check.errors.some((issue) => ['no_objectives', 'insufficient_test_items', 'duplicate_objective_ids', 'lesson_reasoning_missing_from_objectives'].includes(issue))) {
    for (const id of check.objectiveIds) need.add(id)
  }
  return {
    version: 1,
    scope: 'generated_test_alignment',
    status: check.ok ? 'aligned' : 'needs_review',
    issues: check.errors,
    objectivesNeedingAssessment: [...need],
    repairAttempted,
    repaired,
  }
}

export async function improveGeneratedLessonAssessment(lesson, { repairTest = null } = {}) {
  const original = generatedAssessmentReview(lesson)
  if (original.status === 'aligned' || typeof repairTest !== 'function') {
    return { ...lesson, assessmentReadiness: original }
  }
  const prompt = assessmentRepairPrompt(lesson, { errors: original.issues })
  if (!prompt) return { ...lesson, assessmentReadiness: original }
  let best = lesson
  let repaired = false
  try {
    const proposal = await repairTest(prompt)
    const candidate = applyTargetedAssessmentRepair(lesson, proposal, assessmentRepairTargets(lesson, original.issues))
    if (candidate !== lesson) {
      const candidateReview = generatedAssessmentReview(candidate)
      if (candidateReview.issues.length < original.issues.length) {
        best = candidate
        repaired = true
      }
    }
  } catch {
    // A provider timeout or invalid repair is an AI production problem, not a
    // reason to erase the original lesson or charge another generation.
  }
  return { ...best, assessmentReadiness: generatedAssessmentReview(best, { repairAttempted: true, repaired }) }
}
