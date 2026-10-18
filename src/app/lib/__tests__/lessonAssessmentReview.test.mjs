import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assessmentRepairTargets,
  assessmentRepairPrompt,
  applyTargetedAssessmentRepair,
  generatedAssessmentReview,
  improveGeneratedLessonAssessment,
} from '../lessonAssessmentReview.mjs'
import { validateSlateTestAlignment } from '../slateTestAlignment.mjs'

function sampleLesson() {
  return {
    title: 'Choose and defend a multiplication strategy', grade: '5th', subject: 'math',
    learningObjectives: [
      { id: 'calculate', name: 'Calculate products', evidenceType: 'calculation' },
      { id: 'defend', name: 'Defend a strategy', description: 'Explain why the method works', evidenceType: 'reasoned_explanation' },
    ],
    multiplechoice: [{ question: 'Which product equals twenty?', choices: ['20', '18', '12', '14'], correct: 0 }],
    test: [
      ...[21, 24, 28].map((n) => ({
        objectiveId: 'calculate', question: `Calculate ${n} × 4.`, expectedAny: [String(n * 4)],
      })),
      ...[31, 32, 33].map((n) => ({
        objectiveId: 'defend', question: `What is ${n} × 5?`, expectedAny: [String(n * 5)],
      })),
    ],
  }
}

function repairs() {
  return {
    repairs: [31, 32, 33].map((n, index) => ({
      index: index + 4,
      item: {
        id: `test-defend-${index + 1}`,
        objectiveId: 'defend',
        question: `For ${n} × 5, choose an efficient method and explain why it works.`,
        expectedAny: ['Multiplying by ten and halving works because five is half of ten, so the result stays the same.'],
      },
    })),
    additions: [],
  }
}

test('a failed wording check becomes a specific review note, not an invented learner failure', () => {
  const lesson = sampleLesson()
  const review = generatedAssessmentReview(lesson)
  assert.equal(review.status, 'needs_review')
  assert.equal(review.scope, 'generated_test_alignment')
  assert.deepEqual(review.objectivesNeedingAssessment, ['defend'])
  assert.ok(review.issues.includes('reasoning_not_assessed:defend'))
  assert.equal(lesson.approved, undefined)
  assert.equal(review.mastered, undefined)
})

test('targeted repair changes only inadequate independent items and preserves all teaching', async () => {
  const original = sampleLesson()
  const originalClone = structuredClone(original)
  let instructions
  const result = await improveGeneratedLessonAssessment(original, {
    repairTest: async (prompt) => { instructions = prompt; return repairs() },
  })
  assert.match(instructions, /Improve ONLY the held-out independent test items/)
  assert.match(instructions, /previousInstructionalQuestions/)
  assert.equal(result.assessmentReadiness.status, 'aligned')
  assert.equal(result.assessmentReadiness.repairAttempted, true)
  assert.equal(result.assessmentReadiness.repaired, true)
  assert.deepEqual(result.learningObjectives, original.learningObjectives)
  assert.deepEqual(result.multiplechoice, original.multiplechoice)
  assert.deepEqual(result.test.slice(0, 3), original.test.slice(0, 3))
  assert.deepEqual(original, originalClone)
  assert.deepEqual(validateSlateTestAlignment({ lesson: result, testItems: result.test }).errors, [])
})

test('reasoning repairs leave already adequate questions under the same objective untouched', async () => {
  const lesson = sampleLesson()
  const goodItem = {
    ...lesson.test[3],
    question: 'For 31 × 5, explain why your chosen method gives the correct result.',
    expectedAny: ['Thirty-one groups of five can be rearranged into five groups of thirty-one, giving the same product.'],
  }
  lesson.test[3] = goodItem
  const report = generatedAssessmentReview(lesson)
  const targets = assessmentRepairTargets(lesson, report.issues)
  assert.deepEqual(targets.indices, [5, 6])
  const repaired = await improveGeneratedLessonAssessment(lesson, {
    repairTest: async () => repairs(),
  })
  assert.deepEqual(repaired.test[3], goodItem)
  assert.equal(repaired.assessmentReadiness.status, 'aligned')
})

test('a rejected, invalid, or timed-out repair keeps the original usable content as a reviewable draft', async () => {
  const original = sampleLesson()
  const rejected = await improveGeneratedLessonAssessment(original, {
    repairTest: async () => { throw new Error('Provider timeout') },
  })
  assert.equal(rejected.assessmentReadiness.status, 'needs_review')
  assert.equal(rejected.assessmentReadiness.repairAttempted, true)
  assert.deepEqual(rejected.test, original.test)
  const unrelated = await improveGeneratedLessonAssessment(original, {
    repairTest: async () => ({ repairs: [{ index: 1, item: { objectiveId: 'calculate', question: 'Replaced without permission' } }] }),
  })
  assert.deepEqual(unrelated.test, original.test)
  assert.equal(unrelated.assessmentReadiness.status, 'needs_review')
})

test('missing evidence can be repaired with additions without erasing existing test items', () => {
  const original = sampleLesson()
  original.test = original.test.slice(0, 5).map((item) => ({ ...item, objectiveId: 'calculate' }))
  const alignment = validateSlateTestAlignment({ lesson: original, testItems: original.test })
  const target = assessmentRepairTargets(original, alignment.errors)
  assert.deepEqual(target.missingObjectiveIds, ['defend'])
  assert.equal(target.additionalCount, 1)
  assert.ok(assessmentRepairPrompt(original, alignment))
  const candidate = applyTargetedAssessmentRepair(original, {
    repairs: [],
    additions: [{
      objectiveId: 'defend',
      question: 'Choose a method for 47 × 5 and explain why the result is correct.',
      expectedAny: ['I can multiply forty-seven by ten and halve the result, because five is half of ten.'],
    }],
  }, target)
  assert.equal(candidate.test.length, 6)
  assert.deepEqual(candidate.test.slice(0, 5), original.test)
  assert.equal(generatedAssessmentReview(candidate).status, 'aligned')
})

test('without objectives to repair, keep a draft and do not make a needless model call', async () => {
  const original = { title: 'A useful draft with notes', teachingNotes: 'Show and explain examples.', test: [] }
  let calls = 0
  const result = await improveGeneratedLessonAssessment(original, {
    repairTest: async () => { calls++; return {} },
  })
  assert.equal(calls, 0)
  assert.equal(result.assessmentReadiness.status, 'needs_review')
  assert.equal(result.teachingNotes, original.teachingNotes)
})
