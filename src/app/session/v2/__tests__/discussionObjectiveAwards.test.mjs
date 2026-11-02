import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreDiscussionAwards, queueDiscussionAwards, acknowledgeDiscussionAward } from '../discussionObjectiveAwards.mjs';

test('queues each newly earned objective once even for duplicate events', () => {
  const objectives = ['Explain the cause', 'Explain the effect', 'Give an example'];
  const awards = queueDiscussionAwards([], [0, 1, 1], objectives, [0, 1]);
  assert.deepEqual(awards.map(item => item.index), [0, 1]);
  assert.deepEqual(awards.map(item => item.completedCount), [1, 2]);
  assert.deepEqual(queueDiscussionAwards(awards, [0, 1], objectives, [0, 1]), awards);
});

test('acknowledgement never discards the other queued awards', () => {
  const queued = queueDiscussionAwards([], [0, 1], ['First', 'Second'], [0, 1]);
  assert.deepEqual(acknowledgeDiscussionAward(queued, 0).map(item => item.text), ['Second']);
});

test('refresh restores only pending valid awards, not previously acknowledged ones', () => {
  const queued = queueDiscussionAwards([], [1, 2], ['A', 'B', 'C'], [1, 2]);
  const afterAck = acknowledgeDiscussionAward(queued, 1);
  const restored = restoreDiscussionAwards(JSON.parse(JSON.stringify(afterAck)), 3);
  assert.deepEqual(restored.map(item => item.index), [2]);
  assert.deepEqual(restoreDiscussionAwards([{ index: -1 }, { index: 4 }, { index: 1 }, { index: 1 }], 3).map(a => a.index), [1]);
});
