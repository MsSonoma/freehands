import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createWorkTimerReward, restoreWorkTimerReward, recordWorkTimerStall,
  recordWebbWorkTurn, correctWorkTimerStall, getWorkTimerRewardStatus,
  normalizeWorkTimerSettings,
} from './workTimerModes.mjs';
import { sonomaReminderStageForElapsed } from '../v2/sonomaResponsePacing.mjs';

test('each teacher defaults to their historical timer style', () => {
  assert.equal(normalizeWorkTimerSettings({}, 'sonoma').style, 'countdown');
  assert.equal(normalizeWorkTimerSettings({}, 'webb').style, 'countup');
  assert.equal(normalizeWorkTimerSettings({}, 'sonoma').reminderIntervalMin, 2);
});

test('count-up stall threshold is inclusive and unique per response turn', () => {
  const run = createWorkTimerReward({ sonoma_work_timer_style: 'countup', sonoma_stall_allowance: 2 });
  const first = recordWorkTimerStall(run, { id: 'a', phase: 'exercise' }, 600);
  assert.equal(recordWorkTimerStall(first, { id: 'a', phase: 'exercise' }, 900), first, 'notification retry is not another stall');
  const two = recordWorkTimerStall(first, { id: 'b', phase: 'test' }, 600);
  assert.deepEqual(getWorkTimerRewardStatus(two).stallCount, 2);
  assert.equal(getWorkTimerRewardStatus(two).eligible, true);
  const three = recordWorkTimerStall(two, { id: 'c' }, 600);
  assert.equal(getWorkTimerRewardStatus(three).eligible, false);
});

test('facilitator correction retains source event and reason, but no longer counts it', () => {
  const reward = recordWorkTimerStall(createWorkTimerReward({ webb_stall_allowance: 0 }, 'webb'), { id: 'turn-1', stage: 'writing' }, 600);
  assert.equal(getWorkTimerRewardStatus(reward).eligible, false);
  assert.equal(correctWorkTimerStall(reward, 'turn-1', 'short'), reward, 'explanation required');
  const corrected = correctWorkTimerStall(reward, 'turn-1', 'Teacher audio interrupted the attempt');
  assert.equal(corrected.stalls.length, 1);
  assert.equal(corrected.corrections.length, 1);
  assert.equal(getWorkTimerRewardStatus(corrected).eligible, true);
  assert.equal(correctWorkTimerStall(corrected, 'turn-1', 'again'), corrected);
});

test('Webb countdown rewards only completed research and writing budgets', () => {
  const run = createWorkTimerReward({ webb_work_timer_style: 'countdown', webb_research_work_min: 2, webb_writing_work_min: 3 }, 'webb');
  assert.equal(getWorkTimerRewardStatus(run).eligible, false, 'no zero-work award');
  const a = recordWebbWorkTurn(run, { id: 'r1', stage: 'research' }, 120);
  assert.equal(getWorkTimerRewardStatus(a).eligible, false, 'writing checkpoint is required');
  const b = recordWebbWorkTurn(a, { id: 'w1', stage: 'writing' }, 180);
  assert.equal(getWorkTimerRewardStatus(b).eligible, true, 'exact boundary counts on time');
  assert.equal(recordWebbWorkTurn(b, { id: 'w1', stage: 'writing' }, 999), b, 'response retry must not double-count');
  const late = recordWebbWorkTurn(b, { id: 'w2', stage: 'writing' }, 1);
  assert.equal(getWorkTimerRewardStatus(late).eligible, false);
});

test('resume restores original lesson mode, allowance, and stall evidence', () => {
  const first = recordWorkTimerStall(createWorkTimerReward({ sonoma_work_timer_style: 'countup', sonoma_stall_allowance: 1 }), { id: 'a' });
  const restored = restoreWorkTimerReward(JSON.parse(JSON.stringify(first)), createWorkTimerReward({ sonoma_work_timer_style: 'countdown' }), 'sonoma');
  assert.equal(restored.settings.style, 'countup');
  assert.equal(restored.settings.stallAllowance, 1);
  assert.equal(getWorkTimerRewardStatus(restored).stallCount, 1);
});

test('Sonoma countdown still requires three on-time work phases', () => {
  const run = createWorkTimerReward({}, 'sonoma');
  assert.equal(getWorkTimerRewardStatus(run, { countdownOnTimePhases: 2 }).eligible, false);
  assert.equal(getWorkTimerRewardStatus(run, { countdownOnTimePhases: 3 }).eligible, true);
});

test('Sonoma reminder intervals stay configurable without changing the two-minute default', () => {
  assert.equal(sonomaReminderStageForElapsed(120), 1);
  assert.equal(sonomaReminderStageForElapsed(599), 4);
  assert.equal(sonomaReminderStageForElapsed(600), 5);
  assert.equal(sonomaReminderStageForElapsed(299, 1), 4);
  assert.equal(sonomaReminderStageForElapsed(300, 1), 5);
  assert.equal(sonomaReminderStageForElapsed(300, 3), 1);
});

test('Webb does not earn a response timer reward when pacing is disabled', () => {
  const reward = createWorkTimerReward({ webb_response_pacing_enabled: false, webb_work_timer_style: 'countup' }, 'webb');
  assert.equal(getWorkTimerRewardStatus(reward).eligible, false);
});

test('Sonoma count-up display uses the active work-phase ticker, not the delayed learner response clock', () => {
  const session = readFileSync(new URL('../v2/SessionPageV2.jsx', import.meta.url), 'utf8');
  assert.match(session, /countUp=\{currentTimerMode\[getCurrentPhaseName\(\)\] === 'work'/);
  assert.match(session, /elapsedSeconds=\{currentTimerMode\[getCurrentPhaseName\(\)\] === 'play' \? playTimerDisplayElapsed : workTimerDisplayElapsed\}/);
  assert.doesNotMatch(session, /sonomaResponseElapsedDisplay/, 'work clock must tick during teacher sentences');
});

test('Webb response clock arms on presentation rather than waiting until speech finishes', () => {
  const page = readFileSync(new URL('../webb/page.jsx', import.meta.url), 'utf8');
  const researchStart = page.indexOf("const signature = `research:");
  const researchEnd = page.indexOf("startWebbResponseTurn('research', signature)", researchStart);
  const writingStart = page.indexOf("const signature = `writing:");
  const writingEnd = page.indexOf("startWebbResponseTurn('writing', signature)", writingStart);
  assert.ok(researchStart > 0 && researchEnd > researchStart);
  assert.ok(writingStart > 0 && writingEnd > writingStart);
  assert.doesNotMatch(page.slice(researchStart, researchEnd), /await waitForTTSIdle\(\)/);
  assert.doesNotMatch(page.slice(writingStart, writingEnd), /await waitForTTSIdle\(\)/);
});
