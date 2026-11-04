import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  SLATE_REMINDER_ACTIVITY_GRACE_MS,
  SLATE_REMINDER_MAX_EXTENSION_MS,
  slateReminderIsDue,
  slateWorkspaceContentChanged,
} from '../../../lib/slateReminderPacing.mjs'

const liftoff = fs.readFileSync(new URL('../SlateLiftoffExperience.jsx', import.meta.url), 'utf8')
const workspace = fs.readFileSync(new URL('../SlateManualScratch.jsx', import.meta.url), 'utf8')

function due(nowMs, overrides = {}) {
  return slateReminderIsDue({
    nowMs,
    turnStartedAtMs: 0,
    lastReminderAtMs: 0,
    lastActivityAtMs: 0,
    intervalMs: 120_000,
    ...overrides,
  })
}

test('the configured two-minute reminder is delayed by genuine recent activity', () => {
  assert.equal(SLATE_REMINDER_ACTIVITY_GRACE_MS, 60_000)
  assert.equal(due(119_999), false)
  assert.equal(due(120_000), true)
  assert.equal(due(120_000, { lastActivityAtMs: 119_000 }), false)
  assert.equal(due(178_999, { lastActivityAtMs: 119_000 }), false)
  assert.equal(due(179_000, { lastActivityAtMs: 119_000 }), true)
})

test('continuous workspace edits cannot keep postponing the same question forever', () => {
  assert.equal(SLATE_REMINDER_MAX_EXTENSION_MS, 180_000)
  assert.equal(due(299_999, { lastActivityAtMs: 299_000 }), false)
  assert.equal(due(300_000, { lastActivityAtMs: 299_999 }), true)
  assert.equal(due(301_000, { lastActivityAtMs: 301_000 }), true)
  // Later reminders keep their ordinary cadence rather than accumulating a
  // new extension budget each time.
  assert.equal(due(419_999, { lastReminderAtMs: 300_000, lastActivityAtMs: 419_999, stage: 1 }), false)
  assert.equal(due(420_000, { lastReminderAtMs: 300_000, lastActivityAtMs: 419_999, stage: 1 }), true)
})

test('submitted answers, live recording, and exhausted stages never trigger warnings', () => {
  assert.equal(due(300_000, { submitted: true }), false)
  assert.equal(due(300_000, { microphoneCapturing: true }), false)
  assert.equal(due(300_000, { stage: 4 }), false)
  assert.equal(due(300_000, { intervalMs: 0 }), false)
  assert.equal(due(300_000, { lastActivityAtMs: NaN }), false)
  assert.equal(due(300_000, { lastReminderAtMs: 250_000 }), false)
})

const working = {
  operation: 'multiplication',
  operands: ['36', '12'],
  session: { revision: 4, view: { entries: { ones: '2' }, regrouping: {} } },
  notes: { carry: '1' },
  partialEntries: { row1: '6' },
}
const clone = () => structuredClone(working)

test('real changes in every My Math Workspace input type count as learner activity', () => {
  const edits = [
    { ...clone(), operands: ['37', '12'] },
    { ...clone(), operation: 'addition' },
    { ...clone(), session: { ...working.session, view: { entries: { ones: '3' }, regrouping: {} } } },
    { ...clone(), session: { ...working.session, view: { entries: { ones: '2' }, regrouping: { tens: '1' } } } },
    { ...clone(), notes: { carry: '2' } },
    { ...clone(), partialEntries: { row1: '7' } },
    { ...clone(), partialEntries: {} }, // erasing work counts too
  ]
  for (const changed of edits) assert.equal(slateWorkspaceContentChanged(working, changed), true)
  assert.equal(slateWorkspaceContentChanged(working, clone()), false)
  assert.equal(slateWorkspaceContentChanged(working, { ...clone(), visible: true }), false)
  assert.equal(slateWorkspaceContentChanged(working, { ...clone(), session: { ...working.session, revision: 5 } }), false)
  assert.equal(slateWorkspaceContentChanged(null, clone()), false)
})

test('all scratch edits flow through one activity-aware parent handler', () => {
  assert.match(liftoff, /slateWorkspaceContentChanged\(manualScratchUiRef\.current, next\)/)
  assert.match(liftoff, /reminderActivityRef\.current = Date\.now\(\)\s+stopReminderSpeech\(\)\s+}\s+manualScratchUiRef\.current = next/)
  assert.match(liftoff, /onChange=\{commitManualScratchUi\}/)
  assert.match(workspace, /onViewChange=\{setView\}/)
  assert.match(workspace, /onNotesChange=\{\(notes\) =>\s+onChange\(/)
  assert.match(workspace, /onScratchPartialEntriesChange=\{\(entries\) => onChange\(/)
  assert.match(workspace, /onChange=\{\(event\) => setOperand\(0, event\.target\.value\)\}/)
  assert.match(workspace, /onChange=\{\(event\) => setOperand\(1, event\.target\.value\)\}/)
  assert.match(workspace, /onChange=\{\(event\) => setOperation\(event\.target\.value\)\}/)
  assert.match(liftoff, /setAnswer\(\(current\) => insertSlateMathResult\(current, result\)\)/)
})

test('submit locks the reminder synchronously, cancels pending TTS, and rearms only for retry', () => {
  assert.match(liftoff, /submitLockRef\.current = true\s+reminderSubmittedRef\.current = true\s+stopReminderSpeech\(\)\s+setBusy\(true\)/)
  assert.match(liftoff, /submitted: submitLockRef\.current \|\| reminderSubmittedRef\.current/)
  assert.match(liftoff, /void speak\(message, \{ reminder: true \}\)/)
  assert.match(liftoff, /reminderSpeechRequestRef\.current = reminder \? requestId : 0/)
  assert.match(liftoff, /speechRequestRef\.current \+= 1\s+reminderSpeechRequestRef\.current = 0\s+audioRef\.current\?\.pause\(\)/)
  assert.match(liftoff, /if \(!pendingAdvanceRef\.current && liftoffRef\.current\?\.turnNumber === currentLiftoff\.turnNumber\) \{\s+reminderSubmittedRef\.current = false/)
  assert.match(liftoff, /reminderSubmittedRef\.current = false/)
  assert.match(liftoff, /onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitLiftoffAnswer\(\) \}\}/)
  assert.match(liftoff, /event\.preventDefault\(\)\s+void submitLiftoffAnswer\(\)/)
})
