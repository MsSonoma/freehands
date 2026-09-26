import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createWebbResponseTurn,
  expectsLearnerResponse,
  learnerRequestedHelp,
  midpointThreshold,
  normalizeWebbPacingSettings,
  pauseWebbResponseTurn,
  reminderStageForElapsed,
  responseElapsedSeconds,
  resumeWebbResponseTurn,
  setWebbPlayGoldenKeyBonus,
  setWebbPlayPaused,
  setWebbPlayRemainingSeconds,
  webbPlayDurationSeconds,
  webbPlayRemainingSeconds,
} from '../webbPacing.mjs'

test('normalizes Webb pacing settings with learner defaults and overrides', () => {
  assert.deepEqual(normalizeWebbPacingSettings({}), {
    responsePacingEnabled: true,
    reminderIntervalMin: 2,
    playTimesEnabled: true,
    playTimeMin: 5,
    researchMidpointEnabled: true,
    transitionEnabled: true,
    writingMidpointEnabled: true,
  })
  const custom = normalizeWebbPacingSettings({
    webb_response_pacing_enabled: false,
    webb_response_reminder_interval_min: 4,
    webb_play_times_enabled: false,
    webb_play_time_min: 9,
    webb_play_research_midpoint_enabled: false,
  })
  assert.equal(custom.responsePacingEnabled, false)
  assert.equal(custom.reminderIntervalMin, 4)
  assert.equal(custom.playTimesEnabled, false)
  assert.equal(custom.playTimeMin, 9)
  assert.equal(custom.researchMidpointEnabled, false)
})

test('response elapsed time excludes paused time', () => {
  let turn = createWebbResponseTurn({ stage: 'research', turnId: 't1', nowMs: 1_000 })
  assert.equal(responseElapsedSeconds(turn, 61_000), 60)
  turn = pauseWebbResponseTurn(turn, 61_000)
  assert.equal(responseElapsedSeconds(turn, 121_000), 60)
  turn = resumeWebbResponseTurn(turn, 121_000)
  assert.equal(responseElapsedSeconds(turn, 181_000), 120)
})

test('reminder ladder reaches silent escalation at the fifth interval', () => {
  assert.equal(reminderStageForElapsed(119, 2), 0)
  assert.equal(reminderStageForElapsed(120, 2), 1)
  assert.equal(reminderStageForElapsed(240, 2), 2)
  assert.equal(reminderStageForElapsed(360, 2), 3)
  assert.equal(reminderStageForElapsed(480, 2), 4)
  assert.equal(reminderStageForElapsed(600, 2), 5)
  assert.equal(reminderStageForElapsed(900, 2), 5)
})

test('midpoints use ceil and skip one-item phases', () => {
  assert.equal(midpointThreshold(1), null)
  assert.equal(midpointThreshold(2), 1)
  assert.equal(midpointThreshold(5), 3)
  assert.equal(midpointThreshold(6), 3)
})

test('Golden Key bonus applies only when a key is active', () => {
  const settings = normalizeWebbPacingSettings({ webb_play_time_min: 5 })
  assert.equal(webbPlayDurationSeconds(settings, { goldenKeyActive: false, goldenKeyBonusMin: 3 }), 300)
  assert.equal(webbPlayDurationSeconds(settings, { goldenKeyActive: true, goldenKeyBonusMin: 3 }), 480)
})

test('response and help heuristics recognize learner-facing prompts without treating statements as turns', () => {
  assert.equal(expectsLearnerResponse('What do you already know about it?'), true)
  assert.equal(expectsLearnerResponse('Tell me what you noticed.'), true)
  assert.equal(expectsLearnerResponse("Let's save that to our notes."), false)
  assert.equal(learnerRequestedHelp("I don't know. Can you help me?"), true)
  assert.equal(learnerRequestedHelp('I think it means heat moves faster.'), false)
})

test('Webb play timer pause and resume preserve the same remaining time', () => {
  const playBreak = {
    id: 'play-1',
    durationSeconds: 300,
    endsAt: new Date(301_000).toISOString(),
    isPaused: false,
    goldenKeyBonusMin: 0,
  }
  const paused = setWebbPlayPaused(playBreak, true, 61_000)
  assert.equal(webbPlayRemainingSeconds(paused, 181_000), 240)
  assert.equal(paused.endsAt, null)

  const resumed = setWebbPlayPaused(paused, false, 181_000)
  assert.equal(webbPlayRemainingSeconds(resumed, 181_000), 240)
  assert.equal(webbPlayRemainingSeconds(resumed, 241_000), 180)
})

test('Webb play timer Golden Key changes the active break immediately without double-applying', () => {
  const playBreak = {
    id: 'play-2',
    durationSeconds: 300,
    endsAt: new Date(301_000).toISOString(),
    isPaused: false,
    goldenKeyBonusMin: 0,
  }
  const withKey = setWebbPlayGoldenKeyBonus(playBreak, 3, 61_000)
  assert.equal(withKey.durationSeconds, 480)
  assert.equal(withKey.goldenKeyBonusMin, 3)
  assert.equal(webbPlayRemainingSeconds(withKey, 61_000), 420)

  const sameKey = setWebbPlayGoldenKeyBonus(withKey, 3, 61_000)
  assert.equal(sameKey.durationSeconds, 480)
  assert.equal(webbPlayRemainingSeconds(sameKey, 61_000), 420)

  const suspended = setWebbPlayGoldenKeyBonus(sameKey, 0, 61_000)
  assert.equal(suspended.durationSeconds, 300)
  assert.equal(webbPlayRemainingSeconds(suspended, 61_000), 240)
})

test('Webb play timer remaining time can be adjusted while paused', () => {
  const playBreak = {
    id: 'play-3',
    durationSeconds: 300,
    endsAt: null,
    isPaused: true,
    pausedRemainingSeconds: 120,
    goldenKeyBonusMin: 0,
  }
  const adjusted = setWebbPlayRemainingSeconds(playBreak, 180, 10_000)
  assert.equal(adjusted.pausedRemainingSeconds, 180)
  assert.equal(adjusted.endsAt, null)
  assert.equal(webbPlayRemainingSeconds(adjusted, 99_000), 180)
})
