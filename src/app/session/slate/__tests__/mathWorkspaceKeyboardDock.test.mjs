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

test('general keyboard toggle lives in the existing header without taking transcript or keyboard height', () => {
  assert.match(slate, /data-slate-keyboard-toggle/)
  assert.match(slate, /onClick=\{\(\) => sonomaKeyboard\.toggleKeyboard\(/)
  assert.match(slate, /aria-label=\{sonomaKeyboard\.active \? 'Hide keyboard' : 'Show keyboard'\}/)
  const headerStart = slate.indexOf('<header style={{ minHeight: 58')
  const headerEnd = slate.indexOf('</header>', headerStart)
  const toggle = slate.indexOf('data-slate-keyboard-toggle')
  assert.ok(headerStart >= 0 && toggle > headerStart && toggle < headerEnd,
    'toggle must be in the existing session header, not a separate transcript row')
  assert.doesNotMatch(slate, /data-slate-math-keyboard-tab|MATH KEYBOARD/)
  assert.match(keyboard, /const toggleKeyboard = useCallback/)
  assert.match(keyboard, /if \(activeRef\.current && \(!preferredEntry/)
  assert.match(keyboard, /activeRef\.current\.ref\?\.current === preferredEntry\.ref\?\.current/)
  assert.match(keyboard, /layout: previous\?\.layout \|\| "text"/)
  assert.match(keyboard, /value=\{\{ open, close, toggleKeyboard, insertMathResult, canUseMathResult, active, keyboardHeight/)

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


test('MMW has a single erasable multiplication carry row; lesson math keeps canonical carry rows', () => {
  const renderer = fs.readFileSync(new URL('../../../../components/math/VerticalMathWorkspace.jsx', import.meta.url), 'utf8')
  assert.match(manual, /phase=\{phase\} embeddedScratch paperCarry/)
  assert.match(renderer, /const singlePaperCarry = embeddedScratch && paperCarry && problem.operation === 'multiplication'/)
  assert.match(renderer, /if \(singlePaperCarry && row.role === 'multiplication_carry' && row.rowIndex !== 1\) return null/)
  assert.match(renderer, /singlePaperCarry \? 'Carry' : 'Carry ' \+ row.rowIndex/)
  assert.doesNotMatch(slate, /<VerticalMathWorkspace[^>]*paperCarry/)
})
