import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import sourceCorrectZeroQuestions from './__fixtures__/sourceCorrectZeroQuestions.mjs'
import { randomizeMultipleChoiceAnswerOrder } from './assessmentChoiceOrder.mjs'
import { buildAcceptableList, judgeAnswer } from './judging.js'
import { deriveCorrectAnswerText } from '../utils/questionFormatting.js'

const zeroRng = () => 0

function optionsOf(question) {
  return question.options || question.choices || []
}

test('controlled permutations remap every numeric correct index to the same semantic choice', () => {
  for (const sourceCorrect of [0, 1, 2, 3]) {
    const source = {
      id: `correct-${sourceCorrect}`,
      type: 'mc',
      question: 'Pick the target',
      choices: ['red', 'blue', 'green', 'yellow'],
      correct: sourceCorrect,
      expectedAny: [['red', 'blue', 'green', 'yellow'][sourceCorrect]],
    }
    const original = structuredClone(source)
    const [dealt] = randomizeMultipleChoiceAnswerOrder([source], zeroRng)

    assert.equal(optionsOf(dealt)[dealt.correct], source.choices[sourceCorrect])
    assert.deepEqual(source, original)
  }
})

test('grading and review/evidence use the remapped semantic answer', async () => {
  const source = { type: 'mc', question: 'Color?', options: ['red', 'blue', 'green', 'yellow'], correct: 0, expectedAny: ['red'] }
  const [dealt] = randomizeMultipleChoiceAnswerOrder([source], zeroRng)
  const acceptable = buildAcceptableList(dealt)

  assert.equal(dealt.correct, 3)
  assert.equal(dealt.options[dealt.correct], 'red')
  assert.equal(dealt.expectedAny[0], 'red')
  assert.equal(await judgeAnswer('D', acceptable, dealt), true)
  assert.equal(await judgeAnswer('A', acceptable, dealt), false)
  assert.equal(deriveCorrectAnswerText(dealt, acceptable), 'D. red')
})

test('regression fixture does not preserve A as correct across source-correct-zero questions', () => {
  const dealt = randomizeMultipleChoiceAnswerOrder(sourceCorrectZeroQuestions, zeroRng)
  assert.deepEqual(dealt.map((question) => question.correct), [3, 3, 3])
  assert.deepEqual(
    dealt.map((question) => optionsOf(question)[question.correct]),
    sourceCorrectZeroQuestions.map((question) => question.expectedAny[0]),
  )
})

test('true/false, fill-in, and short-answer semantics are not shuffled', () => {
  const questions = [
    { type: 'tf', question: 'True?', options: ['True', 'False'], correct: 0, expectedAny: ['true'] },
    { type: 'fib', question: 'The ___', expectedAny: ['answer'] },
    { type: 'short', question: 'Explain', expectedAny: ['answer'] },
  ]
  assert.deepEqual(randomizeMultipleChoiceAnswerOrder(questions, zeroRng), questions)
})

test('SessionPage deals once before persistence and restores snapshot mappings verbatim', () => {
  const source = fs.readFileSync(path.resolve('src/app/session/v2/SessionPageV2.jsx'), 'utf8')
  assert.match(source, /if \(!savedTestQuestions\) \{\s*questions = randomizeMultipleChoiceAnswerOrder\(questions\);\s*\}/)
  assert.ok(source.indexOf('randomizeMultipleChoiceAnswerOrder(questions)') < source.indexOf("saveProgress('test-init'"))
  assert.match(source, /const savedTestQuestions = Array\.isArray\(savedTest\?\.questions\)/)
  assert.match(source, /questions: questions,\s*resumeState: savedTest \? \{\s*questions,/)
})

test('TestPhase grades and records review/evidence from the remapped question', () => {
  const source = fs.readFileSync(path.resolve('src/app/session/v2/TestPhase.jsx'), 'utf8')
  assert.match(source, /const question = this\.#questions\[this\.#currentQuestionIndex\];\s*const acceptable = buildAcceptableList\(question\);\s*const isCorrect = await judgeAnswer\(answer, acceptable, question\);/)
  assert.match(source, /const correctText = deriveCorrectAnswerText\(question, acceptable\)/)
  assert.match(source, /options: question\.options,\s*userAnswer: answer,\s*correctAnswer: correctText/)
})
