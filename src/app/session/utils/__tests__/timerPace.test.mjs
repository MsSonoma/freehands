import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getTimerPaceColor, TIMER_PACE_COLORS } from '../timerPace.mjs';

const timerSource = fs.readFileSync(new URL('../../components/SessionTimer.jsx', import.meta.url), 'utf8');
const sessionSource = fs.readFileSync(new URL('../../v2/SessionPageV2.jsx', import.meta.url), 'utf8');

test('play timers stay green regardless of pace', () => {
  assert.equal(
    getTimerPaceColor({ timerType: 'play', elapsedSeconds: 590, totalSeconds: 600, phaseProgress: 0 }),
    TIMER_PACE_COLORS.green,
  );
});

test('work timer is green when its own phase work is on pace or ahead', () => {
  assert.equal(
    getTimerPaceColor({ timerType: 'work', elapsedSeconds: 240, totalSeconds: 600, remainingSeconds: 360, phaseProgress: 50 }),
    TIMER_PACE_COLORS.green,
  );
});

test('warning depends on percentage pace rather than a fixed number of minutes', () => {
  assert.equal(
    getTimerPaceColor({ timerType: 'work', elapsedSeconds: 360, totalSeconds: 1800, remainingSeconds: 1440, phaseProgress: 10 }),
    TIMER_PACE_COLORS.yellow,
  );
  assert.equal(
    getTimerPaceColor({ timerType: 'work', elapsedSeconds: 360, totalSeconds: 600, remainingSeconds: 240, phaseProgress: 10 }),
    TIMER_PACE_COLORS.red,
  );
});

test('work timer turns red when phase work is materially behind or time expires', () => {
  assert.equal(
    getTimerPaceColor({ timerType: 'work', elapsedSeconds: 480, totalSeconds: 600, remainingSeconds: 120, phaseProgress: 50 }),
    TIMER_PACE_COLORS.red,
  );
  assert.equal(
    getTimerPaceColor({ timerType: 'work', elapsedSeconds: 600, totalSeconds: 600, remainingSeconds: 0, phaseProgress: 100 }),
    TIMER_PACE_COLORS.red,
  );
});

test('session timer consumes phase-local progress and no whole-lesson progress', () => {
  assert.match(timerSource, /phaseProgress/);
  assert.doesNotMatch(timerSource, /lessonProgress/);
  assert.match(sessionSource, /calculateTimerProgress/);
  assert.match(sessionSource, /Timer pace must never use whole-lesson phase weights/);
  assert.doesNotMatch(sessionSource, /const phaseWeights =/);
  assert.match(sessionSource, /phaseProgress=\{calculateTimerProgress\(getCurrentPhaseName\(\)\)\}/);
});