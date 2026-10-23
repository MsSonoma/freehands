import {
  ASSESSMENT_ROLES,
  getReservedAssessmentItems,
  tagItemsForPhase,
} from '../../lib/masteryEvidence/assessmentIsolation.js'

const PHASES = Object.freeze(['comprehension', 'exercise', 'worksheet', 'test'])

function asPositiveInteger(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null
}

function parsedTargets(learnerProfile) {
  const targets = learnerProfile?.targets
  if (!targets) return null
  if (typeof targets === 'object') return targets
  if (typeof targets === 'string') {
    try { return JSON.parse(targets) } catch { return null }
  }
  return null
}

export function resolveLearnerAssessmentTarget(learnerProfile, phaseName, { learnerId = '', storage = null } = {}) {
  const nested = parsedTargets(learnerProfile)
  const fromFlat = asPositiveInteger(learnerProfile?.[phaseName])
  const fromNested = asPositiveInteger(nested?.[phaseName])
  const fromLegacy = phaseName === 'comprehension'
    ? (asPositiveInteger(learnerProfile?.discussion) ?? asPositiveInteger(nested?.discussion))
    : null

  let fromOverride = null
  const targetStorage = storage || (typeof window !== 'undefined' ? window.localStorage : null)
  if (targetStorage?.getItem) {
    const pinnedLearnerId = learnerId || learnerProfile?.id || ''
    const keys = []
    if (pinnedLearnerId && pinnedLearnerId !== 'demo') keys.push(`target_${phaseName}_${pinnedLearnerId}`)
    keys.push(`target_${phaseName}`)
    for (const key of keys) {
      try {
        const value = asPositiveInteger(targetStorage.getItem(key))
        if (value) {
          fromOverride = value
          break
        }
      } catch {}
    }
  }

  return [fromFlat, fromNested, fromLegacy, fromOverride].find((value) => Number.isFinite(value) && value > 0) ?? null
}

export function resolveLearnerAssessmentTargets(learnerProfile, { learnerId = '', storage = null } = {}) {
  return Object.fromEntries(PHASES.map((phase) => [
    phase,
    resolveLearnerAssessmentTarget(learnerProfile, phase, { learnerId, storage }),
  ]))
}

function questionKey(question) {
  return (question?.prompt || question?.question || question?.Q || question?.q || '').toString().trim().toLowerCase()
}

// Only the Test deck uses this stronger normalized key; the instructional
// question-selection strategy is unchanged.
function testQuestionKey(question) {
  return questionKey(question).replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim()
}

function shuffle(items, random) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function buildAssessmentPhaseSets({ lessonData, targets = {}, random = Math.random } = {}) {
  if (!lessonData) return null

  const tf = Array.isArray(lessonData.truefalse)
    ? lessonData.truefalse.map((question) => ({ ...question, sourceType: 'tf', type: 'tf' }))
    : []
  const mc = Array.isArray(lessonData.multiplechoice)
    ? lessonData.multiplechoice.map((question) => ({ ...question, sourceType: 'mc', type: 'mc' }))
    : []
  const fib = Array.isArray(lessonData.fillintheblank)
    ? lessonData.fillintheblank.map((question) => ({ ...question, sourceType: 'fib', type: 'fib' }))
    : []
  const sa = Array.isArray(lessonData.shortanswer)
    ? lessonData.shortanswer.map((question) => ({ ...question, sourceType: 'short', type: 'short' }))
    : []
  const reservedTestSource = getReservedAssessmentItems(lessonData)

  const seen = new Set()
  const uniquePool = []
  for (const question of [...tf, ...mc, ...fib, ...sa]) {
    const key = questionKey(question)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    uniquePool.push(question)
  }
  if (!uniquePool.length) return null

  const comprehensionTarget = asPositiveInteger(targets.comprehension) || 5
  const exerciseTarget = asPositiveInteger(targets.exercise) || 10
  const worksheetTarget = asPositiveInteger(targets.worksheet) || 15
  const testTarget = asPositiveInteger(targets.test) || 10
  const totalNeeded = comprehensionTarget + exerciseTarget + worksheetTarget + testTarget

  const primaryItems = shuffle(uniquePool.filter((question) => question.sourceType === 'tf' || question.sourceType === 'mc'), random)
  const secondaryItems = shuffle(uniquePool.filter((question) => question.sourceType === 'fib' || question.sourceType === 'short'), random)
  const maxSecondary = Math.max(0, Math.round(totalNeeded * 0.2))
  const cappedPool = shuffle([...primaryItems, ...secondaryItems.slice(0, maxSecondary)], random)
  if (!cappedPool.length) return null

  const dealPhase = (pool, target) => {
    const result = []
    while (result.length < target) {
      const batch = shuffle(pool, random)
      result.push(...batch.slice(0, Math.min(batch.length, target - result.length)))
    }
    return result
  }

  const usedKeys = new Set()
  const buildPhase = (target) => {
    const fresh = cappedPool.filter((question) => !usedKeys.has(questionKey(question)))
    const pool = fresh.length >= target ? fresh : cappedPool
    const questions = dealPhase(pool, target)
    questions.forEach((question) => usedKeys.add(questionKey(question)))
    return questions.map((question, index) => ({ ...question, number: question.number || index + 1 }))
  }

  const buildReservedTestPhase = () => {
    if (!reservedTestSource.length) return buildPhase(testTarget)
    const shuffled = shuffle(reservedTestSource, random)
    const picked = []
    const pickedKeys = new Set()
    const take = (question) => {
      const key = testQuestionKey(question)
      if (!key || pickedKeys.has(key) || picked.length >= testTarget) return
      pickedKeys.add(key)
      picked.push(question)
    }

    // Honor existing objective mapping before adding other unique held-out items.
    const objectives = Array.isArray(lessonData.learningObjectives) ? lessonData.learningObjectives : []
    for (const objective of objectives) {
      const item = shuffled.find((candidate) =>
        String(candidate?.objectiveId || candidate?.objective_id || '') === String(objective?.id || '')
        && !pickedKeys.has(testQuestionKey(candidate)))
      if (item) take(item)
    }
    // Prefer varied formats if the lesson already contains them in its Test pool.
    const testKind = (item) => {
      const type = String(item?.sourceType || item?.type || item?.questionType || '').toLowerCase()
      if (type === 'tf' || type === 'truefalse' || typeof item?.answer === 'boolean') return 'tf'
      if (Array.isArray(item?.choices) && item.choices.length >= 2 || Array.isArray(item?.options) && item.options.length >= 2) return 'mc'
      if (type === 'fib' || /_{3,}/.test(testQuestionKey(item))) return 'fib'
      return 'short'
    }
    for (const kind of ['mc', 'tf', 'fib']) {
      const item = shuffled.find((candidate) => testKind(candidate) === kind
        && !pickedKeys.has(testQuestionKey(candidate)))
      if (item) take(item)
    }
    for (const question of shuffled) take(question)
    return picked.map((question, index) => ({
      ...question,
      assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
      assessment_role: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
      sourceRole: question.sourceRole || 'test',
      evidence_purpose: question.evidence_purpose || 'test',
      number: index + 1,
    }))
  }

  return {
    comprehension: tagItemsForPhase(buildPhase(comprehensionTarget), 'comprehension'),
    exercise: tagItemsForPhase(buildPhase(exerciseTarget), 'exercise'),
    worksheet: tagItemsForPhase(buildPhase(worksheetTarget), 'worksheet'),
    test: buildReservedTestPhase(),
  }
}
