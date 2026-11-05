import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startResponseInterval,
  pauseResponseInterval,
  resumeResponseInterval,
  responseIntervalElapsedSeconds,
  responseIntervalRemainingSeconds,
} from './responseIntervalClock.mjs';

test('the visible clock measures one response interval, not the sum of a phase', () => {
  let turn = startResponseInterval(1_000);
  assert.equal(responseIntervalElapsedSeconds(turn, 4_000), 3);
  assert.equal(responseIntervalElapsedSeconds(turn, 61_000), 60);
  // A new spoken sentence or learner response starts another small clock.
  turn = startResponseInterval(61_000);
  assert.equal(responseIntervalElapsedSeconds(turn, 61_000), 0);
  assert.equal(responseIntervalElapsedSeconds(turn, 63_000), 2);
});

test('play and facilitator pauses do not inflate the learner-facing interval', () => {
  let turn = startResponseInterval(1_000);
  turn = pauseResponseInterval(turn, 4_000);
  assert.equal(responseIntervalElapsedSeconds(turn, 84_000), 3);
  assert.equal(pauseResponseInterval(turn, 90_000), turn, 'repeated pause is idempotent');
  turn = resumeResponseInterval(turn, 84_000);
  assert.equal(responseIntervalElapsedSeconds(turn, 86_000), 5);
});

test('countdown style resets its short response window without changing phase limits', () => {
  let turn = startResponseInterval(0);
  assert.equal(responseIntervalRemainingSeconds(turn, 120, 45_000), 75);
  assert.equal(responseIntervalRemainingSeconds(turn, 120, 130_000), 0);
  turn = startResponseInterval(130_000);
  assert.equal(responseIntervalRemainingSeconds(turn, 120, 130_000), 120);
  assert.equal(responseIntervalRemainingSeconds(turn, 120, 132_000), 118);
});
