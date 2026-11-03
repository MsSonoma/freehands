import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFacilitatorQuestionCandidate as normalize } from '../facilitatorOverrideQuestion.mjs';

test('replacement retains objective binding and identifies new exposure', () => {
  const original = { id: 'test-1', objectiveId: 'objective-a', type: 'shortanswer', question: 'Why does the water cycle occur?', expectedAny: ['Water changes state'] };
  const next = normalize(original, { question: 'Explain why water moves between clouds and the ground.', expectedAny: ['Evaporation and precipitation', 'Water evaporates, condenses, and falls'], replacementId: 'abc' });
  assert.equal(next?.id, 'replacement-test-1-abc');
  assert.equal(next?.replacesQuestionId, 'test-1');
  assert.equal(next?.objectiveId, 'objective-a');
  assert.equal(next?.expectedAny[0], 'Evaporation and precipitation');
  assert.equal(original.question, 'Why does the water cycle occur?');
});

test('rejects same question, missing answer keys and invalid multiple choice options', () => {
  const original = { id: 'mc-1', type: 'mc', question: 'Which animal is a mammal?', choices: ['Cat','Snake','Fish','Frog'], correct: 0 };
  assert.equal(normalize(original, { question: original.question, choices: original.choices, correct: 0 }), null);
  assert.equal(normalize(original, { question: 'Which animal feeds its baby milk?', choices: ['Cat','Cat','Fish','Frog'], correct: 0 }), null);
  assert.equal(normalize(original, { question: 'Which animal feeds its baby milk?', choices: ['Cat','Snake','Fish','Frog'], correct: 7 }), null);
  assert.equal(normalize({ type: 'shortanswer', question: 'What is this?' }, { question: 'Describe how photosynthesis makes food.', expectedAny: [] }), null);
});

test('correct answer shape is required for true/false and fill-in-blank', () => {
  assert.equal(normalize({ type: 'truefalse', question: 'A fact?' }, { question: 'Water freezes at normal room temperature.', answer: 'false' }), null);
  assert.equal(normalize({ type: 'fib', question: 'Fill _____.' }, { question: 'The Earth orbits the Sun.', expectedAny: ['Sun'] }), null);
  const valid = normalize({ type: 'fib', id: 'a', question: 'Fill _____.' }, { question: 'The Earth travels around the _____.', expectedAny: ['Sun','our star'] });
  assert.equal(valid?.answer, 'Sun');
});

test('replacement cannot change original objective or assessment metadata', () => {
  const original = { id: 'item7', objectiveId: 'skill7', assessmentRole: 'assessment_reserved',
    sourceRole: 'test', sourceRevision: 'revision1', type: 'shortanswer',
    question: 'Describe how animals grow.', expectedAny: ['Food helps'] };
  const proposal = { question: 'Explain how animals use food to grow.', expectedAny: ['Food provides energy'],
    objectiveId: 'other-skill', sourceRole: 'practice', sourceRevision: 'revision2',
    assessmentRole: 'instructional', replacementId: 'r1' };
  const changed = normalize(original, proposal);
  assert.equal(changed.objectiveId, 'skill7');
  assert.equal(changed.sourceRole, 'test');
  assert.equal(changed.sourceRevision, 'revision1');
  assert.equal(changed.assessmentRole, 'assessment_reserved');
});
