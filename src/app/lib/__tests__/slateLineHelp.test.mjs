import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  isSlateLineHelpDuplicate,
  resolveSlateLineHelpTarget,
  safeSlateLineHelpHistory,
  slateLineHelpHistory,
} from '../slateLineHelp.mjs'

const client = readFileSync('src/app/session/slate/SlateLiftoffExperience.jsx', 'utf8')
const api = readFileSync('src/app/api/slate-liftoff/route.js', 'utf8')

test('each consecutive rephrase remembers all earlier explanations of its original line', () => {
  const original = { role: 'assistant', text: 'Line up digits with the same place value.', kind: 'liftoff_teaching_sentence' }
  const other = { role: 'assistant', text: 'What does regrouping mean?', kind: 'liftoff_question' }
  const transcript = [original, other]
  const replies = [
    'Put ones under ones and tens under tens.',
    'Think of ones and tens as two separate columns.',
    'Each position is a different-sized place, so match places before adding.',
    'The position matters: a ten is not the same size as a one.',
  ]
  for (let i = 0; i < replies.length; i++) {
    const context = slateLineHelpHistory(transcript, 0)
    assert.equal(context.rephraseCount, i)
    assert.deepEqual(context.previousExplanations, replies.slice(0, i))
    transcript.push({ role: 'assistant', kind: 'line_help', sourceMessageIndex: 0, text: replies[i] })
  }
  assert.equal(slateLineHelpHistory(transcript, 1).rephraseCount, 0)
  assert.equal(slateLineHelpHistory(structuredClone(transcript), 0).rephraseCount, 4)
  assert.deepEqual(resolveSlateLineHelpTarget(transcript, transcript.at(-1), transcript.length - 1),
    { text: original.text, sourceIndex: 0 })
})

test('previous help survives resumed transcript, and context is bounded without capping requests', () => {
  const transcript = [{ role: 'assistant', text: 'Explain the word estimate.', kind: 'liftoff_question' }]
  for (let i = 0; i < 24; i++) {
    transcript.push({ role: 'assistant', text: 'Alternative wording ' + i, kind: 'line_help', sourceMessageIndex: 0 })
  }
  const reloaded = JSON.parse(JSON.stringify(transcript))
  const context = slateLineHelpHistory(reloaded, 0)
  assert.equal(context.rephraseCount, 24)
  assert.equal(context.previousExplanations.length, 16)
  assert.equal(context.previousExplanations[0], 'Alternative wording 8')
  assert.equal(context.previousExplanations.at(-1), 'Alternative wording 23')
  assert.deepEqual(safeSlateLineHelpHistory(context.previousExplanations), context.previousExplanations)
})

test('a math composer help thread is scoped by activity, not a different question', () => {
  const transcript = [
    { role: 'assistant', kind: 'line_help', activityId: 'math-a', text: 'First explanation.' },
    { role: 'assistant', kind: 'line_help', activityId: 'math-b', text: 'Wrong problem.' },
    { role: 'assistant', kind: 'line_help', activityId: 'math-a', text: 'Second explanation.' },
  ]
  assert.deepEqual(slateLineHelpHistory(transcript, null, { activityId: 'math-a' }), {
    previousExplanations: ['First explanation.', 'Second explanation.'], rephraseCount: 2,
  })
})

test('repeated or superficially reordered wording is identified before reaching the learner', () => {
  const earlier = ['It means putting the ones digits in the ones column.']
  assert.equal(isSlateLineHelpDuplicate('It means putting the ones digits in the ones column!', earlier), true)
  assert.equal(isSlateLineHelpDuplicate('Putting the ones digits in the ones column means it.', earlier), true)
  assert.equal(isSlateLineHelpDuplicate('Imagine each place as a different-sized box.', earlier), false)
  assert.equal(isSlateLineHelpDuplicate('', earlier), true)
})

test('only transcript help receives prior explanations; test help stays blocked', () => {
  assert.match(client, /resolveSlateLineHelpTarget\(transcriptRef\.current, line, sourceIndex\)/)
  assert.match(client, /slateLineHelpHistory\(transcriptRef\.current, lineHelpTarget\?\.sourceIndex\)/)
  assert.match(client, /slateLineHelpHistory\(transcriptRef\.current, null, \{ activityId: originalActivityId \}\)/)
  assert.match(client, /\.\.\.helpHistory/)
  assert.match(client, /appendTranscript\('assistant', reply, \{ kind: 'line_help', sourceMessageIndex:/)
  assert.match(api, /body\?\.phase === 'test'/)
  assert.match(api, /safeSlateLineHelpHistory\(body\?\.previousExplanations\)/)
  assert.match(api, /for \(let attempt = 0; attempt < 3; attempt\+\+\)/)
  assert.match(api, /isSlateLineHelpDuplicate\(spoken, \[sourceLine, \.\.\.previousExplanations, \.\.\.rejectedReplies\]\)/)
  assert.match(api, /Do not diagnose mastery, update evidence, choose a next Liftoff move, advance the lesson/)
  assert.match(api, /do not solve it, reveal its answer, or give a targeted hint/)
})
