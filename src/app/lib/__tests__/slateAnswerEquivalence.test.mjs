import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  parseSlateMathAnswer,
  slateMathAnswersEquivalent,
} from '../slateAnswerEquivalence.mjs'

test('equivalent fraction, decimal, percent, and number-word forms compare by value', () => {
  const equivalents = ['one tenth', '1/10', '0.1', '10%']
  for (const learner of equivalents) {
    for (const expected of equivalents) {
      assert.equal(
        slateMathAnswersEquivalent(learner, [expected], { question: 'What value is shown?' }),
        true,
        `${learner} should equal ${expected}`,
      )
    }
  }
})

test('fraction words parse as mathematical values instead of surface text', () => {
  assert.deepEqual(parseSlateMathAnswer('one tenth'), {
    value: 0.1,
    representation: 'fraction',
    numerator: 1,
    denominator: 10,
  })
  assert.equal(parseSlateMathAnswer('three fourths')?.value, 0.75)
  assert.equal(parseSlateMathAnswer('twenty five hundredths')?.value, 0.25)
})

test('equivalent reduced and unreduced fractions are accepted', () => {
  assert.equal(slateMathAnswersEquivalent('2/20', ['1/10'], { question: 'What value is shown?' }), true)
  assert.equal(slateMathAnswersEquivalent('50/100', ['0.5'], { question: 'What value is shown?' }), true)
})

test('representation requirements are respected when the question explicitly asks for a form', () => {
  assert.equal(
    slateMathAnswersEquivalent('one tenth', ['1/10'], { question: 'Write one tenth as a fraction.' }),
    true,
  )
  assert.equal(
    slateMathAnswersEquivalent('0.1', ['1/10'], { question: 'Write one tenth as a fraction.' }),
    false,
  )
  assert.equal(
    slateMathAnswersEquivalent('10%', ['0.1'], { question: 'Express 0.1 as a percent.' }),
    true,
  )
  assert.equal(
    slateMathAnswersEquivalent('0.1', ['10%'], { question: 'Express 0.1 as a percent.' }),
    false,
  )
  assert.equal(
    slateMathAnswersEquivalent('0.1', ['1/10'], { question: 'Write one tenth as a decimal.' }),
    true,
  )
  assert.equal(
    slateMathAnswersEquivalent('1/10', ['0.1'], { question: 'Write one tenth as a decimal.' }),
    false,
  )
})

test('different mathematical values are not accepted just because wording is similar', () => {
  assert.equal(slateMathAnswersEquivalent('one tenth', ['one hundredth']), false)
  assert.equal(slateMathAnswersEquivalent('1/10', ['1/100']), false)
  assert.equal(slateMathAnswersEquivalent('10%', ['1%']), false)
})

test('Slate review/drill checks math equivalence before semantic AI judging', () => {
  const source = fs.readFileSync(path.resolve('src/app/session/slate/page.jsx'), 'utf8')
  const equivalenceIndex = source.indexOf('slateMathAnswersEquivalent(learnerAnswer')
  const judgeIndex = source.indexOf("fetch('/api/judge-short-answer'", equivalenceIndex)
  assert.ok(equivalenceIndex >= 0)
  assert.ok(judgeIndex > equivalenceIndex)
})

test('Slate Liftoff checks math equivalence before semantic AI judging', () => {
  const source = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
  const equivalenceIndex = source.indexOf('slateMathAnswersEquivalent(learnerAnswer')
  const judgeIndex = source.indexOf("fetch('/api/judge-short-answer'", equivalenceIndex)
  assert.ok(equivalenceIndex >= 0)
  assert.ok(judgeIndex > equivalenceIndex)
})
