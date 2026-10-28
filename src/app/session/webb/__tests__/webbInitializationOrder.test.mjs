import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../page.jsx', import.meta.url), 'utf8')

test('Webb initializes objective state before transcript scroll effect reads objectives.length', () => {
  const initial = page.indexOf('const [objectives,         setObjectives]        = useState([])')
  const scrollEffect = page.indexOf('useEffect(() => {\n    const el = transcriptRef.current')
  const dependency = page.indexOf('}, [sonomaKeyboard.keyboardHeight, transcript.length, objectives.length, phase])')
  assert.ok(initial > 0, 'objective state declaration must exist')
  assert.equal((page.match(/const \[objectives,\s+setObjectives\]/g) || []).length, 1)
  assert.ok(scrollEffect > initial, 'the hook must not read objectives before initialization')
  assert.ok(dependency > scrollEffect, 'keyboard height, transcript, objective and phase dependencies are preserved')
})

test('transcript scroll follow remains bounded to user browsing and cleaned up', () => {
  assert.match(page, /if \(transcriptManualScrollRef\.current\) return/)
  assert.match(page, /resizeObserver\?\.observe\(el\)/)
  assert.match(page, /resizeObserver\?\.disconnect\(\)/)
  assert.match(page, /window\.removeEventListener\('resize', follow\)/)
})
