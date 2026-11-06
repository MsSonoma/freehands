import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SONOMA_RESPONSE_PACING_THRESHOLDS_SECONDS,
  SONOMA_PAPER_WRITING_DEFAULT_MINUTES,
  SONOMA_PAPER_WRITING_PROMPT,
  normalizeSonomaPaperWritingMinutes,
  createSonomaResponseTurn,
  isSameSonomaTurnScope,
  isSonomaActivitySnoozed,
  markSonomaLearnerActivity,
  pauseSonomaResponseTurn,
  resumeSonomaResponseTurn,
  sonomaReminderForStage,
  sonomaReminderStageForElapsed,
  sonomaResponseElapsedSeconds,
} from './sonomaResponsePacing.mjs'

test('response pacing thresholds progress through four reminders and a fifth escalation', () => {
  assert.deepEqual(SONOMA_RESPONSE_PACING_THRESHOLDS_SECONDS, [120, 240, 360, 480, 600])
  assert.equal(sonomaReminderStageForElapsed(119), 0)
  assert.equal(sonomaReminderStageForElapsed(120), 1)
  assert.equal(sonomaReminderStageForElapsed(240), 2)
  assert.equal(sonomaReminderStageForElapsed(360), 3)
  assert.equal(sonomaReminderStageForElapsed(480), 4)
  assert.equal(sonomaReminderStageForElapsed(600), 5)
  assert.equal(sonomaReminderStageForElapsed(900), 5)
})

test('paper writing grace defers normal reminder and escalation stages', () => {
  assert.equal(SONOMA_PAPER_WRITING_DEFAULT_MINUTES, 2)
  assert.match(SONOMA_PAPER_WRITING_PROMPT, /paper.*Next/i)
  assert.equal(sonomaReminderStageForElapsed(119, 2, 2), 0)
  assert.equal(sonomaReminderStageForElapsed(120, 2, 2), 0)
  assert.equal(sonomaReminderStageForElapsed(239, 2, 2), 0)
  assert.equal(sonomaReminderStageForElapsed(240, 2, 2), 1)
  assert.equal(sonomaReminderStageForElapsed(720, 2, 2), 5)
  assert.equal(sonomaReminderStageForElapsed(120, 2, 0), 1)
  assert.equal(normalizeSonomaPaperWritingMinutes(), 2)
  assert.equal(normalizeSonomaPaperWritingMinutes('0'), 0)
  assert.equal(normalizeSonomaPaperWritingMinutes('31'), 30)
  assert.equal(normalizeSonomaPaperWritingMinutes('invalid'), 2)
  const writingReminders = [1, 2, 3, 4].map(stage => sonomaReminderForStage(stage, 'test', 'paper-writing')).join(' ')
  assert.match(writingReminders, /Next/)
  assert.doesNotMatch(writingReminders, /answer when/)
})

test('blocked time is excluded from learner response elapsed time', () => {
  const start = Date.parse('2026-09-17T13:00:00.000Z')
  const turn = createSonomaResponseTurn({ phase: 'discussion', turnId: 'turn-a', nowMs: start })
  const paused = pauseSonomaResponseTurn(turn, start + 20_000)
  assert.equal(sonomaResponseElapsedSeconds(paused, start + 80_000), 20)
  const resumed = resumeSonomaResponseTurn(paused, start + 80_000)
  assert.equal(sonomaResponseElapsedSeconds(resumed, start + 100_000), 40)
})

test('test reminders never offer help with the assessed question', () => {
  const text = [1, 2, 3, 4].map(stage => sonomaReminderForStage(stage, 'test')).join(' ').toLowerCase()
  assert.ok(text.includes('answer'))
  assert.ok(!text.includes('help'))
  assert.ok(!text.includes('stuck'))
  assert.ok(!text.includes('explain'))
})

test('activity snoozes speech without resetting elapsed time', () => {
  const start = Date.parse('2026-09-17T13:00:00.000Z')
  const turn = createSonomaResponseTurn({ phase: 'worksheet', turnId: 'turn-b', nowMs: start })
  const active = markSonomaLearnerActivity(turn, start + 50_000)
  assert.equal(sonomaResponseElapsedSeconds(active, start + 55_000), 55)
  assert.equal(isSonomaActivitySnoozed(active, start + 55_000), true)
  assert.equal(isSonomaActivitySnoozed(active, start + 111_000), false)
})

test('restored question turns match the same phase and question without conflating later questions', () => {
  const turn = createSonomaResponseTurn({ phase: 'comprehension', questionIndex: 2, turnId: 'turn-c', nowMs: 0 })
  assert.equal(isSameSonomaTurnScope(turn, { phase: 'comprehension', questionIndex: 2, turnKind: 'retry' }), true)
  assert.equal(isSameSonomaTurnScope(turn, { phase: 'comprehension', questionIndex: 3 }), false)
  assert.equal(isSameSonomaTurnScope(turn, { phase: 'worksheet', questionIndex: 2 }), false)
  const writing = createSonomaResponseTurn({ phase: 'test', questionIndex: 1, turnKind: 'paper-writing', turnId: 'paper' })
  assert.equal(isSameSonomaTurnScope(writing, { phase: 'test', questionIndex: 1, turnKind: 'question' }), false)
  assert.equal(isSameSonomaTurnScope(writing, { phase: 'test', questionIndex: 1, turnKind: 'paper-writing' }), true)
})