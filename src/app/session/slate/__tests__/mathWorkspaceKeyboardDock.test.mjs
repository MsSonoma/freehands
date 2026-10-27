import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const keyboard = fs.readFileSync(new URL('../../../components/SonomaKeyboard.jsx', import.meta.url), 'utf8')
const dockStyles = fs.readFileSync(new URL('../../../components/SonomaKeyboardDock.module.css', import.meta.url), 'utf8')
const slate = fs.readFileSync(new URL('../SlateLiftoffExperience.jsx', import.meta.url), 'utf8')
const manual = fs.readFileSync(new URL('../SlateManualScratch.jsx', import.meta.url), 'utf8')

test('My Math Workspace appears once and only inside the Math keyboard tab', () => {
  assert.equal((slate.match(/<SlateManualScratch\b/g) || []).length, 1)
  assert.ok(slate.includes("sonomaKeyboard.active?.layout === 'math' && sonomaKeyboard.workspacePortal && createPortal("))
  const activeTail = slate.split('const activeMathTranscriptContent =')[1].split('const assessmentTranscriptContent =')[0]
  const assessmentTail = slate.split('const assessmentTranscriptContent =')[1].split('\n  return (')[0]
  assert.doesNotMatch(activeTail, /<SlateManualScratch/)
  assert.doesNotMatch(assessmentTail, /<SlateManualScratch/)
  assert.match(activeTail, /<VerticalMathWorkspace/)
  assert.match(assessmentTail, /<VerticalMathWorkspace/)
  assert.ok(keyboard.includes('const workspaceVisible = Boolean(active && workspaceDock && layout === "math")'))
  assert.ok(keyboard.includes('{workspaceVisible && <div id="sonoma-keyboard-workspace"'))
})

test('Math tab owns the workspace; there is no separate workspace show or hide control', () => {
  assert.match(slate, /data-slate-math-keyboard-tab/)
  assert.match(slate, /onClick=\{\(\) => sonomaKeyboard\.showMathTab\(/)
  assert.match(slate, /aria-label="Open Math keyboard tab"/)
  assert.match(keyboard, /const nextLayout = \{ "123": "number", "Math": "math", "More": "symbols", "ABC": "text" \}\[key\]/)
  assert.doesNotMatch(slate, /toggleManualScratch|data-slate-manual-math-toggle|data-slate-test-manual-math-toggle/)
  assert.doesNotMatch(keyboard, /toggleWorkspaceDock|Hide my math|My math workspace"<\/button>/)
  assert.doesNotMatch(slate, /manualScratchUi\.visible && .*createPortal/)
})

test('workspace and math keys are always side by side without increasing keyboard height', () => {
  assert.match(dockStyles, /\.layout \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 47fr\) minmax\(0, 53fr\)/)
  assert.match(dockStyles, /\.workspaceScroll \{[\s\S]*?position: absolute;[\s\S]*?inset: 0;/)
  assert.match(dockStyles, /\.pad \{[\s\S]*?overflow-x: auto/)
  assert.doesNotMatch(dockStyles, /flex-direction: column|orientation: landscape|grid-template-rows:/)
  assert.match(keyboard, /className=\{workspaceVisible \? dockStyles\.layout : undefined\}/)
  assert.match(keyboard, /className=\{workspaceVisible \? dockStyles\.pad : undefined\}/)
  assert.match(keyboard, /className=\{dockStyles\.workspaceScroll\}/)
  assert.doesNotMatch(keyboard, /maxHeight:"min\(86dvh, 720px\)"/)
})

test('selecting any scratch cell keeps the keyboard on the Math tab', () => {
  assert.match(manual, /const openScratchMathTab =/)
  assert.match(manual, /layout: 'math'/)
  assert.match(manual, /onOpenNumberPad=\{openScratchMathTab\}/)
  assert.equal((manual.match(/openScratchMathTab\(/g) || []).length, 2)
  assert.match(keyboard, /lastOutsideInputRef\.current = config/)
  assert.match(keyboard, /const leavingWorkspace = nextLayout !== "math" && workspacePortal\?\.contains/)
  assert.match(keyboard, /outside\?\.ref\?\.current\?\.isConnected/)
})

test('saved scratch work and teaching/test answer transfer remain unchanged', () => {
  assert.match(slate, /restoreSlateManualScratch\(/)
  assert.match(slate, /manualScratchUiRef\.current = next/)
  assert.match(slate, /scheduleMathSnapshot\(\)/)
  assert.match(slate, /phase=\{isAssessment \? 'test' : 'teaching'\}/)
  assert.match(slate, /questionType\(currentAssessment\) === 'shortanswer'/)
  assert.match(slate, /assessmentMathTextRef\.current = next/)
  assert.match(slate, /setAssessmentAnswer\(next\)/)
  assert.match(slate, /setAnswer\(\(current\) => insertSlateMathResult\(current, result\)\)/)
  assert.match(manual, /showCheck=\{false\}/)
})
