import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveFacilitatorQuestionSource, canCreateFacilitatorSourceRevision } from '../facilitatorOverrideProvenance.mjs';

test('source provenance matches only exact authored question and field', () => {
  const lesson = { multiplechoice: [{ id: 'one', question: 'Which gas do plants use?', choices:['Carbon dioxide','Oxygen','Hydrogen','Neon'] }],
    shortanswer: [{ id: 'two', question: 'Explain how plants use sunlight.' }] };
  assert.deepEqual(resolveFacilitatorQuestionSource(lesson, { id:'one', question:'Which gas do plants use?' }).field, 'multiplechoice');
  assert.equal(resolveFacilitatorQuestionSource(lesson, { id:'one', question:'What gas do plants use?' }), null);
  assert.equal(resolveFacilitatorQuestionSource(lesson, { id:'different', question:'Which gas do plants use?' }), null);
  assert.equal(canCreateFacilitatorSourceRevision('generated/lesson.json', { field:'multiplechoice', index:0 }), true);
  assert.equal(canCreateFacilitatorSourceRevision('science/lesson.json', { field:'multiplechoice', index:0 }), false);
});

test('source revision endpoint creates a new draft and never overwrites the historical file', () => {
  const source = requireSource();
  assert.match(source, /verifyFacilitatorPinForUser\(svc, user\.id/);
  assert.match(source, /originalItem\.question/);
  assert.match(source, /upsert: false/);
  assert.match(source, /revisionOf: lessonKey/);
  assert.match(source, /approved: false/);
  assert.match(source, /storage\.upload\(nextPath/);
  assert.doesNotMatch(source, /storage\.update\(path/);
});
function requireSource() {
  return readFileSync(new URL('../../api/facilitator/overrides/source-revision/route.js', import.meta.url), 'utf8');
}
