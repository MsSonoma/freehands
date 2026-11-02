import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyWebbObjectiveState, reconcileWebbObjectiveState, mergeWebbObjectiveResult,
  fulfillWebbObjectiveByFacilitator, webbObjectiveProgress,
} from '../webbObjectiveState.mjs';

const objectives = ['Identify the central idea', 'Explain the cause'];
test('facilitator fulfillment credits one objective without fabricating a research note', () => {
  const original = emptyWebbObjectiveState();
  const result = fulfillWebbObjectiveByFacilitator(objectives, original, 0, '2026-11-02T00:00:00.000Z');
  assert.deepEqual(result.understoodObj, [0]);
  assert.deepEqual(result.coveredObj, [0]);
  assert.deepEqual(result.learnerNotes, {});
  assert.equal(result.facilitatorOverrides[0].source, 'facilitator');
  assert.equal(result.facilitatorOverrides[0].objective, objectives[0]);
  assert.deepEqual(original.understoodObj, []);
  assert.deepEqual(webbObjectiveProgress(objectives, result).missingNoteIndices, [0]);
});
test('duplicate or invalid educator awards never produce additional credit', () => {
  const result = fulfillWebbObjectiveByFacilitator(objectives, emptyWebbObjectiveState(), 0);
  assert.equal(fulfillWebbObjectiveByFacilitator(objectives, result, 0), null);
  assert.equal(fulfillWebbObjectiveByFacilitator(objectives, result, 9), null);
});
test('AI checks and refresh preserve facilitator provenance and credit', () => {
  const initial = fulfillWebbObjectiveByFacilitator(objectives, emptyWebbObjectiveState(), 0);
  const next = mergeWebbObjectiveResult(objectives, initial, { newlyUnderstood: [], newlyCovered: [], objectiveEvidence: {}, learnerNotes: {} }, []);
  assert.deepEqual(next.understoodObj, [0]);
  assert.equal(next.facilitatorOverrides[0].source, 'facilitator');
  const restored = reconcileWebbObjectiveState(objectives, JSON.parse(JSON.stringify(next)), []);
  assert.equal(restored.facilitatorOverrides[0].source, 'facilitator');
});
