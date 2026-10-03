import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  reviewTeacherCompletionAudioOptions,
  reviewTeacherCorrectAnswerLine,
  reviewTeacherDialogue,
  reviewTeacherRecoveryLine,
} from '../../../lib/reviewTeacherTone.mjs'

test('review teachers keep distinct correction tone', () => {
  const sonomaWrong = reviewTeacherDialogue('sonoma').wrong.join(' ')
  const webbWrong = reviewTeacherDialogue('webb').wrong.join(' ')
  const slateWrong = reviewTeacherDialogue('slate').wrong.join(' ')

  assert.doesNotMatch(sonomaWrong, /wrong answer|error code|score deducted|incorrect response|negative\./i)
  assert.doesNotMatch(webbWrong, /wrong answer|error code|score deducted|incorrect response|negative\./i)
  assert.match(slateWrong, /wrong answer|score deducted|incorrect response/i)
})

test('answer reveal and recovery language follow the selected teacher', () => {
  assert.equal(reviewTeacherCorrectAnswerLine('sonoma', '42'), 'The answer is 42.')
  assert.equal(reviewTeacherCorrectAnswerLine('webb', '42'), 'The correct answer is 42.')
  assert.equal(reviewTeacherCorrectAnswerLine('slate', '42'), 'The correct answer was 42.')

  assert.match(reviewTeacherRecoveryLine('sonoma', { question: 'Q?', correctAnswer: 'A' }), /make sure this one makes sense/i)
  assert.match(reviewTeacherRecoveryLine('webb', { question: 'Q?', correctAnswer: 'A' }), /review that one carefully/i)
  assert.match(reviewTeacherRecoveryLine('slate', { question: 'Q?', correctAnswer: 'A' }), /next query/i)
})

test('completion audio is teacher-specific', () => {
  assert.match(reviewTeacherCompletionAudioOptions('sonoma')[0], /nice work/i)
  assert.match(reviewTeacherCompletionAudioOptions('webb')[0], /well done/i)
  assert.match(reviewTeacherCompletionAudioOptions('slate')[0], /daily review complete/i)
})

test('learner-started Daily Review no longer hardcodes Mr. Slate', () => {
  const source = readFileSync(new URL('../../../learn/LearnerHome.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /purpose=practice&reviewTeacher=slate/)
  assert.match(source, /const selfReviewTeacher = isReviewTeacher\(learnerReviewTeacherChoice\)/)
  assert.match(source, /REVIEW_TEACHER_IDS\.map/)
  assert.match(source, /Start Daily Review with \{reviewTeacherLabel\(selfReviewTeacher\)\}/)
})
