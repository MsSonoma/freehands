import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assembleLearnerEssay,
  buildWritingGuidanceInstructions,
  createLearnerNote,
  createWritingAttempt,
  migrateWebbSnapshot,
  nextWritingObjectiveIndex,
  parseComprehensionEvaluations,
  sanitizeWritingGuidance,
} from '../webbLearningModel.mjs'

test('correct fragment becomes an exact learner note independent of sentence quality', () => {
  const conversation = [{ role: 'user', content: 'I think: taxes with no say', id: 'm1', createdAt: '2026-01-01T00:00:00Z' }]
  const note = createLearnerNote({
    objectiveIndex: 0,
    evaluation: { accuracy: 'correct', sentenceOk: false, sourceMessageIndex: 0, quote: 'taxes with no say' },
    conversation,
    capturedAt: '2026-01-01T00:00:01Z',
  })
  assert.equal(note.text, 'I think: taxes with no say')
  assert.equal(note.sentenceReadyAtCapture, false)
  assert.equal(note.sourceMessageId, 'm1')
})

test('partial, incorrect, manufactured, and wrong-source notes are rejected', () => {
  const conversation = [{ role: 'user', content: 'taxes', id: 'm1' }]
  for (const accuracy of ['partial', 'incorrect']) {
    assert.equal(createLearnerNote({ objectiveIndex: 0, evaluation: { accuracy, sourceMessageIndex: 0 }, conversation }), null)
  }
  assert.equal(createLearnerNote({ objectiveIndex: 0, evaluation: { accuracy: 'correct', sourceMessageIndex: 0, quote: 'taxation without representation' }, conversation }), null)
  assert.equal(createLearnerNote({ objectiveIndex: 0, evaluation: { accuracy: 'correct', sourceMessageIndex: 4, quote: 'taxes' }, conversation }), null)
})

test('evaluator parsing advances only strict correct comprehension while retaining separate sentence quality', () => {
  const conversation = [
    { role: 'user', content: 'taxes with no say', id: 'm1' },
    { role: 'user', content: 'taxes', id: 'm2' },
    { role: 'user', content: 'Britain gave every colonist a vote.', id: 'm3' },
  ]
  const parsed = parseComprehensionEvaluations({
    raw: [
      '0|correct|no|0|taxes with no say',
      '1|partial|no|1|taxes',
      '2|incorrect|yes|2|Britain gave every colonist a vote.',
    ].join('\n'),
    objectives: ['taxation', 'protest', 'representation'],
    conversation,
    capturedAt: '2026-01-01T00:00:00Z',
  })
  assert.deepEqual(parsed.newlyUnderstood, [0])
  assert.equal(parsed.learnerNotes[0].text, 'taxes with no say')
  assert.equal(parsed.sentenceQuality[0], false)
  assert.equal(parsed.evaluationStatus[1], 'partial')
  assert.equal(parsed.evaluationStatus[2], 'incorrect')
})

test('writing attempts preserve exact text and only accept accurate complete sentences', () => {
  const broken = createWritingAttempt({ objectiveIndex: 0, text: 'The colonists Britain taxes no say.', message: { id: 'm2' }, accuracy: 'correct', sentenceOk: false })
  assert.equal(broken.accepted, false)
  assert.equal(broken.text, 'The colonists Britain taxes no say.')
  const goodText = 'The colonists were angry because Britain taxed them but they did not have a say.'
  const good = createWritingAttempt({ objectiveIndex: 0, text: goodText, message: { id: 'm3' }, accuracy: 'correct', sentenceOk: true })
  assert.equal(good.accepted, true)
  assert.equal(good.text, goodText)
  assert.equal(nextWritingObjectiveIndex(['one', 'two'], { 0: good }), 1)
  assert.equal(nextWritingObjectiveIndex(['one', 'two'], { 0: good, 1: good }), -1)
})

test('writing guidance contract asks for learner retry and forbids supplied prose', () => {
  const instructions = buildWritingGuidanceInstructions('taxes with no say', { accuracy: 'correct', sentenceOk: false })
  assert.match(instructions, /another attempt in their own words/i)
  assert.match(instructions, /Never write, dictate, complete, rewrite, or offer a model sentence/i)
  assert.match(instructions, /taxes with no say/)
  const unsafe = sanitizeWritingGuidance('You could write: “The colonists opposed taxation without representation.”')
  assert.doesNotMatch(unsafe, /colonists opposed/i)
  assert.match(unsafe, /try again in your own words/i)
  assert.equal(sanitizeWritingGuidance('Who is your sentence about? Add that, then try again.'), 'Who is your sentence about? Add that, then try again.')
})

test('essay assembly is deterministic and requires traceable learner-authored sentences', () => {
  const objectives = ['one', 'two']
  const accepted = {
    0: { text: 'First learner sentence.', provenance: 'learner-message' },
    1: { text: 'Second learner sentence!', provenance: 'learner-message' },
  }
  assert.equal(assembleLearnerEssay(objectives, accepted), 'First learner sentence. Second learner sentence!')
  assert.equal(assembleLearnerEssay(objectives, { 0: accepted[0] }), '')
  assert.equal(assembleLearnerEssay(objectives, { ...accepted, 1: { text: 'AI sentence.', provenance: 'generated' } }), '')
})

test('v1 resume migration keeps only responses traceable to learner messages and requires writing', () => {
  const migrated = migrateWebbSnapshot({
    completedObj: [0, 1],
    objResponses: { 0: 'taxes with no say', 1: 'manufactured quote' },
    chatMessages: [{ role: 'user', content: 'taxes with no say', id: 'old-m1' }],
    essay: 'AI edited essay',
    essayMode: true,
  })
  assert.deepEqual(migrated.understoodObj, [0])
  assert.equal(migrated.learnerNotes[0].text, 'taxes with no say')
  assert.deepEqual(migrated.acceptedSentences, {})
  assert.equal(migrated.essay, null)
  assert.equal(migrated.essayMode, false)
})

test('v2 resume restores comprehension, notes, attempts, accepted sentences, and writing position separately', () => {
  const snapshot = {
    snapshotVersion: 2,
    understoodObj: [0, 1],
    learnerNotes: { 0: { text: 'rough note', provenance: 'learner-message' } },
    writingAttempts: { 0: [{ text: 'broken attempt', accepted: false }] },
    acceptedSentences: { 0: { text: 'Learner sentence.', provenance: 'learner-message' } },
    writingMode: true,
    writingIndex: 1,
    essay: null,
    essayMode: false,
  }
  const restored = migrateWebbSnapshot(snapshot)
  assert.deepEqual(restored.understoodObj, [0, 1])
  assert.equal(restored.learnerNotes[0].text, 'rough note')
  assert.equal(restored.writingAttempts[0][0].text, 'broken attempt')
  assert.equal(restored.acceptedSentences[0].text, 'Learner sentence.')
  assert.equal(restored.writingMode, true)
  assert.equal(restored.writingIndex, 1)
})
