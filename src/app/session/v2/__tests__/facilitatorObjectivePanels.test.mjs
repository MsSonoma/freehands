import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sonoma = readFileSync(new URL('../SessionPageV2.jsx', import.meta.url), 'utf8');
const webb = readFileSync(new URL('../../webb/page.jsx', import.meta.url), 'utf8');
const slate = readFileSync(new URL('../../slate/SlateLiftoffExperience.jsx', import.meta.url), 'utf8');
const shared = readFileSync(new URL('../../../components/FacilitatorOverrideModal.jsx', import.meta.url), 'utf8');

test('shared facilitator overlay requests server-verified PIN before revealing goals or applying decisions', () => {
  assert.match(shared, /requestFacilitatorPinException\(/);
  assert.match(shared, /if \(pin\) \{ pinRef.current = pin; setAuthorized\(true\); \}/);
  assert.match(shared, /if \(!authorized \|\| working \|\| busy \|\| !selected\) return;/);
  assert.match(shared, /'What went wrong\? \(required\)'|What went wrong\? \(required\)/);
  assert.match(shared, /Proposed replacement, not yet applied/);
});

test('Sonoma objectives use shared modal and preserve native award handler', () => {
  assert.match(sonoma, /onClick=\{\(\) => setDiscussionUniversalOverride\(i\)\}/);
  assert.match(sonoma, /<FacilitatorOverrideModal/);
  assert.match(sonoma, /onOutcome=\{facilitatorFulfillDiscussionObjective\}/);
  assert.match(sonoma, /fulfillObjectiveByFacilitator\(index\)/);
  assert.match(sonoma, /setShowDiscussionObjectives\(false\)/);
});

test('Webb objectives use shared modal without inventing a learner note', () => {
  assert.match(webb, /onClick=\{\(\) => setWebbUniversalOverride\(i\)\}/);
  assert.match(webb, /onOutcome=\{facilitatorFulfillWebbObjective\}/);
  assert.match(webb, /fulfillWebbObjectiveByFacilitator\(objectives, learningStateRef.current, index\)/);
  assert.match(webb, /objectiveQueueRef\.current\.invalidate\(\)/);
});

test('Slate objectives use the same modal and distinct educator provenance', () => {
  assert.match(slate, /setSlateOverrideIndex\(0\)/);
  assert.match(slate, /facilitatorFulfillLiftoffComponent\(current, selected.id\)/);
  assert.match(slate, /onOutcome=\{fulfillSlateObjective\}/);
  assert.match(slate, /persistLiftoffSnapshot\(\{ phase: 'active', liftoff: next \}\)/);
});
