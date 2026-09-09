import test from 'node:test'
import assert from 'node:assert/strict'
import {
  WEBB_WRITING_SUBPHASES,
  acceptedWritingEntries,
  hasAllWritingReadyNotes,
  isWritingReadyNote,
  latestWritingAttempt,
  normalizeWritingSubphase,
  writingReadyNoteIndices,
} from '../webbWritingFlow.mjs'

test('writing readiness requires a correct source-verified learner note', () => {
  const valid = { text: 'learner idea', accuracy: 'correct', provenance: 'learner-message' }
  assert.equal(isWritingReadyNote(valid), true)
  assert.equal(isWritingReadyNote({ ...valid, text: '' }), false)
  assert.equal(isWritingReadyNote({ ...valid, accuracy: 'partial' }), false)
  assert.equal(isWritingReadyNote({ ...valid, provenance: 'generated' }), false)
})

test('writing gate is independent from coverage and requires one valid note per objective', () => {
  const objectives = ['one', 'two', 'three']
  const notes = {
    0: { text: 'A', accuracy: 'correct', provenance: 'learner-message' },
    2: { text: 'C', accuracy: 'correct', provenance: 'learner-message' },
  }
  assert.deepEqual(writingReadyNoteIndices(objectives, notes), [0, 2])
  assert.equal(hasAllWritingReadyNotes(objectives, notes), false)
  notes[1] = { text: 'B', accuracy: 'correct', provenance: 'learner-message' }
  assert.equal(hasAllWritingReadyNotes(objectives, notes), true)
})

test('review shows only the most recent prior attempt while the full history remains stored', () => {
  const attempts = { 1: [{ text: 'first' }, { text: 'second' }] }
  assert.equal(latestWritingAttempt(attempts, 1)?.text, 'second')
  assert.equal(latestWritingAttempt(attempts, 0), null)
})

test('writing subphase restoration is explicit and safe', () => {
  assert.equal(normalizeWritingSubphase('review', true), WEBB_WRITING_SUBPHASES.REVIEW)
  assert.equal(normalizeWritingSubphase('unknown', true), WEBB_WRITING_SUBPHASES.FOCUS)
  assert.equal(normalizeWritingSubphase('', false), WEBB_WRITING_SUBPHASES.IDLE)
})

test('essay-so-far entries contain only learner-authored accepted sentences in objective order', () => {
  const entries = acceptedWritingEntries(['a', 'b', 'c'], {
    2: { text: 'Third.', provenance: 'learner-message' },
    0: { text: 'First.', provenance: 'learner-message' },
    1: { text: 'Generated.', provenance: 'generated' },
  })
  assert.deepEqual(entries.map(entry => [entry.index, entry.sentence.text]), [[0, 'First.'], [2, 'Third.']])
})