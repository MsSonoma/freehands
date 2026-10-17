import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceSlateIntroTeaching, createSlateIntroTeaching, restoreSlateIntroTeaching } from '../slateIntroTeaching.mjs'

test('Slate opening is split into discrete sentences like Ms. Sonoma', () => {
  const intro = createSlateIntroTeaching('First, line up the digits. Carry the ten to the next column.\nThen add the tens.', 'What is 36 + 27?')
  assert.deepEqual(intro, {
    sentences: ['First, line up the digits.', 'Carry the ten to the next column.', 'Then add the tens.'],
    index: 0,
    question: 'What is 36 + 27?',
  })
  const second = advanceSlateIntroTeaching(intro)
  assert.equal(second.kind, 'sentence')
  assert.equal(second.sentence, 'Carry the ten to the next column.')
  const third = advanceSlateIntroTeaching(second.stage)
  assert.equal(third.sentence, 'Then add the tens.')
  assert.deepEqual(advanceSlateIntroTeaching(third.stage), { kind: 'question', question: 'What is 36 + 27?' })
})

test('empty opening does not create a pointless next-sentence step', () => {
  assert.equal(createSlateIntroTeaching('', 'What is 2 + 2?'), null)
})

test('snapshot restore keeps the exact sentence cursor without revealing a future sentence', () => {
  const intro = createSlateIntroTeaching('Watch the ones column. Regroup when the sum reaches ten. Try another example.', 'Try 48 + 27.')
  const atSecond = advanceSlateIntroTeaching(intro)
  const stored = JSON.parse(JSON.stringify(atSecond.stage))
  assert.deepEqual(restoreSlateIntroTeaching(stored), atSecond.stage)
  assert.equal(advanceSlateIntroTeaching(stored).sentence, 'Try another example.')
  assert.equal(restoreSlateIntroTeaching({ ...stored, index: 999 }), null)
  assert.equal(restoreSlateIntroTeaching({ ...stored, sentences: [''] }), null)
})

test('sentence splitting keeps decimals and numbered steps together', () => {
  const intro = createSlateIntroTeaching('Start with 1.25. Then estimate.\n1. Check the ones first.', 'What is the estimate?')
  assert.deepEqual(intro.sentences, ['Start with 1.25.', 'Then estimate.', '1. Check the ones first.'])
})

test('Mr. Slate keeps common teacher titles attached to names in transcript captions', () => {
  const intro = createSlateIntroTeaching(
    'Mr. Slate helps Mrs. Webb and Ms. Sonoma. Dr. Seuss wrote stories. Prof. Oak agrees.',
    'Who is helping?'
  )
  assert.deepEqual(intro.sentences, [
    'Mr. Slate helps Mrs. Webb and Ms. Sonoma.',
    'Dr. Seuss wrote stories.',
    'Prof. Oak agrees.',
  ])
  assert.equal(advanceSlateIntroTeaching(intro).sentence, 'Dr. Seuss wrote stories.')
})

test('common abbreviations stay joined without hiding actual sentence boundaries', () => {
  const intro = createSlateIntroTeaching(
    'Mr. and Mrs. Green traveled to St. Petersburg. The U.S. has many states. We met at 3 p.m. yesterday. It ended at 4 p.m. Then we went home.',
    'Where did they travel?'
  )
  assert.deepEqual(intro.sentences, [
    'Mr. and Mrs. Green traveled to St. Petersburg.',
    'The U.S. has many states.',
    'We met at 3 p.m. yesterday.',
    'It ended at 4 p.m.',
    'Then we went home.',
  ])
})

test('examples, issue numbers, true sentence endings, and list labels still segment correctly', () => {
  const intro = createSlateIntroTeaching(
    'Use a small example, e.g. 12. See No. 4 for that rule. Bring pens, pencils, etc. Now begin.\n1. Read the prompt. 2. Answer the question.',
    'Ready?'
  )
  assert.deepEqual(intro.sentences, [
    'Use a small example, e.g. 12.',
    'See No. 4 for that rule.',
    'Bring pens, pencils, etc.',
    'Now begin.',
    '1. Read the prompt.',
    '2. Answer the question.',
  ])
})
