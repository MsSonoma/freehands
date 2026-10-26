import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const workspace = fs.readFileSync(new URL('../../../../components/math/VerticalMathWorkspace.jsx', import.meta.url), 'utf8')
const manual = fs.readFileSync(new URL('../SlateManualScratch.jsx', import.meta.url), 'utf8')
const liftoff = fs.readFileSync(new URL('../SlateLiftoffExperience.jsx', import.meta.url), 'utf8')
const publicTool = fs.readFileSync(new URL('../../../tools/vertical-division/page.jsx', import.meta.url), 'utf8')

test('embedded workspace numeric fields use the Sonoma number pad and suppress native mobile keyboard', () => {
  assert.match(workspace, /onOpenNumberPad = null/)
  assert.match(workspace, /inputMode: 'none'/)
  assert.match(workspace, /'data-sonoma-input': true/)
  assert.match(workspace, /onPointerDown: \(event\) => onOpenNumberPad\(event, onChange\)/)
  assert.match(workspace, /onFocus: \(event\) => onOpenNumberPad\(event, onChange\)/)
  assert.equal((workspace.match(/numberPadInputProps\(/g) || []).length, 7)
})

test('all editable math cell types preserve existing math update paths', () => {
  assert.match(workspace, /numberPadInputProps\(\(next\) => changeWorkingNote\(slot, next\)\)/)
  assert.match(workspace, /numberPadInputProps\(setCellValue\)/)
  assert.match(workspace, /enterVerticalMathCell\(problem, view, cell.id, value\)/)
  assert.match(workspace, /numberPadInputProps\(setPartialValue\)/)
  assert.match(workspace, /updateMultiplicationScratchEntry\(problem, scratchPartialEntries, cell.id, value\)/)
  assert.match(workspace, /numberPadInputProps\(\(next\) => setDivisionAnswer\(\(answer\) => \(\{ \.\.\.answer, quotient: next \}\)\)\)/)
  assert.match(workspace, /numberPadInputProps\(\(next\) => setDivisionAnswer\(\(answer\) => \(\{ \.\.\.answer, remainder: next \}\)\)\)/)
  assert.match(workspace, /numberPadInputProps\(setFullAnswer, 'decimal'\)/)
  assert.match(workspace, /onCellSelect\?\.\(cell.id\)/)
})

test('manual, guided and test Slate workspaces share their existing number-pad opener', () => {
  assert.match(manual, /onOpenNumberPad=\{openScratchNumberPad\}/)
  assert.match(manual, /layout: 'number'/)
  assert.equal((liftoff.match(/onOpenNumberPad=\{\(event, onChange\) => openSlateInput\(event, onChange, 'number'\)\}/g) || []).length, 2)
})

test('public math tools retain their original native numeric inputs', () => {
  assert.match(workspace, /if \(!onOpenNumberPad\) return \{ inputMode: nativeInputMode \}/)
  assert.doesNotMatch(publicTool, /onOpenNumberPad/)
})
