import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['ComprehensionPhase.jsx', 'ExercisePhase.jsx', 'WorksheetPhase.jsx', 'TestPhase.jsx']) {
  test(`${file}: replacement changes only the current unanswered question, retaining earlier score`, () => {
    let source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    source = source.replace(/^import[^\n]*\n/gm, '').replace(/export class (\w+)/, 'class $1');
    source = source.replace('  get state() {', `  __testSetAwaiting() { this.#state = 'awaiting-answer'; }\n  get state() {`);
    const className = file.replace('.jsx','');
    const factory = new Function('isTrueFalse','isMultipleChoice','isFillInBlank',
      'deriveCorrectAnswerText','summarizeSlateTestResults','normalizeSavedSonomaTestAnswers',
      source + `\nreturn ${className};`);
    const Ctor = factory(() => false, () => false, () => false, () => '', () => ({}), () => []);
    let stops = 0;
    const audioEngine = { stop() { stops++; }, on() {}, off() {} };
    const phase = new Ctor({ audioEngine, eventBus: { emit() {} }, questions: [
      { id: 'q1', type: 'shortanswer', question: 'What is a plant?', answer: 'A living thing' },
      { id: 'q2', type: 'shortanswer', question: 'What do roots do?', answer: 'Absorb water' },
    ] });
    phase.__testSetAwaiting();
    const presented = [];
    phase.on('questionStart', detail => presented.push(detail.question));
    const replacement = { id: 'replacement-q1-uuid', type: 'shortanswer', question: 'Explain how a plant grows.', expectedAny: ['With light and water'], answer: 'With light and water' };
    assert.equal(phase.replacePendingQuestion('wrong', replacement), false);
    assert.equal(phase.replacePendingQuestion('q1', replacement), true);
    assert.equal(phase.currentQuestion.question, replacement.question);
    assert.equal(phase.questions[1].question, 'What do roots do?');
    assert.equal(phase.answers.length, 0);
    assert.equal(phase.score, 0);
    assert.equal(phase.currentQuestionIndex, 0);
    assert.equal(stops, 1);
    assert.equal(presented.length, 1);
    assert.equal(phase.replacePendingQuestion('q1', replacement), false);
    assert.equal(phase.replacePendingQuestion(replacement.id, { id:'q1', type:'shortanswer',question:'What is a plant?', answer:'A living thing'}), true, 'rollback can restore prior question');
  });
}

test('regeneration API requires authenticated facilitator PIN, returns preview only, and rejects source mutation', () => {
  const source = readFileSync(new URL('../../../api/facilitator/overrides/preview/route.js', import.meta.url), 'utf8');
  assert.match(source, /verifyFacilitatorPinForUser\(svc, user\.id/);
  assert.match(source, /body\?\.scope !== 'instance'/);
  assert.match(source, /normalizeFacilitatorQuestionCandidate/);
  assert.doesNotMatch(source, /\.update\(|\.upload\(|\.insert\(/);
});
