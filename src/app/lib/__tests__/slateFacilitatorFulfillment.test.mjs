import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiftoffState, facilitatorFulfillLiftoffComponent, liftoffReleaseReady, liftoffStateForModel } from '../slateLiftoff.mjs';

function initial() {
  return createLiftoffState([{ id:'regroup', name:'Regroup in multiplication', essential:true }, { id:'add', name:'Add partial products', essential:true }]);
}

test('facilitator approval is separate from independent evidence, survives model serialization', () => {
  const before = initial();
  const after = facilitatorFulfillLiftoffComponent(before, 'regroup', '2026-11-02T00:00:00Z');
  assert.equal(after.facilitatorFulfillments.regroup.source, 'facilitator');
  assert.equal(after.components[0].evidenceState, 'unobserved');
  assert.equal(liftoffStateForModel(after).facilitatorFulfillments.regroup.source, 'facilitator');
  assert.equal(before.facilitatorFulfillments.regroup, undefined);
  assert.equal(facilitatorFulfillLiftoffComponent(after, 'regroup'), null);
  assert.equal(facilitatorFulfillLiftoffComponent(after, 'invalid'), null);
});

test('facilitator instructional approvals do not manufacture integration or variation', () => {
  const first = facilitatorFulfillLiftoffComponent(initial(), 'regroup');
  const both = facilitatorFulfillLiftoffComponent(first, 'add');
  assert.equal(liftoffReleaseReady(both), false);
  assert.equal(liftoffReleaseReady({ ...both, integrationConfirmed:true, variationConfirmed:true }), true);
});
