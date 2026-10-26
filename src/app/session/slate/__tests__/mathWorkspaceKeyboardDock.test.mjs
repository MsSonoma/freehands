import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const keyboard = fs.readFileSync(new URL('../../../components/SonomaKeyboard.jsx', import.meta.url), 'utf8')
const dockStyles = fs.readFileSync(new URL('../../../components/SonomaKeyboardDock.module.css', import.meta.url), 'utf8')
const slate = fs.readFileSync(new URL('../SlateLiftoffExperience.jsx', import.meta.url), 'utf8')
const manual = fs.readFileSync(new URL('../SlateManualScratch.jsx', import.meta.url), 'utf8')

test('My Math Workspace is rendered once in the Sonoma Keyboard portal, not in the transcript', () => {
  assert.equal((slate.match(/<SlateManualScratch\b/g) || []).length, 1)
  assert.match(slate, /manualScratchUi\.visible && \(phase === 'active' \|\| phase === 'test'\) && sonomaKeyboard\.workspacePortal && createPortal\(/)
  const activeTail = slate.split('const activeMathTranscriptContent =')[1].split('const assessmentTranscriptContent =')[0]
  const assessmentTail = slate.split('const assessmentTranscriptContent =')[1].split('\n  return (')[0]
  assert.doesNotMatch(activeTail, /<SlateManualScratch/)
  assert.doesNotMatch(assessmentTail, /<SlateManualScratch/)
  assert.match(activeTail, /<VerticalMathWorkspace/)
  assert.match(assessmentTail, /<VerticalMathWorkspace/)
})

test('both teaching and independent test can open the same saved scratch workspace outside the transcript', () => {
  assert.match(slate, /restoreSlateManualScratch\(/)
  assert.match(slate, /manualScratchUiRef\.current = next/)
  assert.match(slate, /scheduleMathSnapshot\(\)/)
  assert.match(slate, /data-slate-manual-math-toggle=\{!isAssessment/)
  assert.match(slate, /data-slate-test-manual-math-toggle=\{isAssessment/)
  assert.match(slate, /data-sonoma-keyboard-toggle/)
  assert.match(slate, /onClick=\{toggleManualScratch\}/)
  assert.match(slate, /onHide: \(\) =>/)
})

test('test mode preserves independent work and existing answer-transfer boundary', () => {
  assert.match(slate, /phase=\{isAssessment \? 'test' : 'teaching'\}/)
  assert.match(slate, /questionType\(currentAssessment\) === 'shortanswer'/)
  assert.match(slate, /assessmentMathTextRef\.current = next/)
  assert.match(slate, /setAssessmentAnswer\(next\)/)
  assert.match(slate, /setAnswer\(\(current\) => insertSlateMathResult\(current, result\)\)/)
  assert.match(manual, /showCheck=\{false\}/)
})

test('keyboard hosts the workspace and keeps the number pad accessible', () => {
  assert.match(keyboard, /\(active \|\| workspaceVisible\)/)
  assert.match(keyboard, /data-sonoma-keyboard-workspace/)
  assert.match(keyboard, /ref=\{setWorkspacePortal\}/)
  assert.match(keyboard, /data-sonoma-keyboard-toggle/)
  assert.match(keyboard, /disabled=\{!active && key !== "Done"\}/)
  assert.match(keyboard, /const layout = active\?\.layout \|\| \(workspaceVisible \? "number" : "text"\)/)
  assert.match(keyboard, /if \(!active && !workspaceDock\?\.visible\) setKeyboardHeight\(0\)/)
  assert.match(keyboard, /workspaceDockRef\.current\.onHide\?\.\(\)/)
  assert.match(dockStyles, /overflow-y: auto/)
  assert.match(dockStyles, /orientation: landscape/)
})
