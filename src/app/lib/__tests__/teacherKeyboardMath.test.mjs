import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  teacherKeyboardMathKey, teacherKeyboardMathActivityId, restoreTeacherKeyboardMath,
} from '../teacherKeyboardMath.mjs'
import { buildSlateManualScratch } from '../slateManualScratch.mjs'
import { enterVerticalMathCell } from '../../../lib/math/verticalMath.mjs'
import { updateMathSessionView } from '../../../lib/math/mathSession.mjs'

test('teacher scratch keys isolate teacher, learner, lesson and syllabus occurrence', () => {
  const base = { teacher: 'sonoma', learnerId: 'learner-A', lessonKey: 'math/fractions.json', occurrenceId: 'repeat:1' }
  const key = teacherKeyboardMathKey(base)
  assert.ok(key?.startsWith('keyboard-math-workspace:v1:sonoma:'))
  for (const field of ['teacher', 'learnerId', 'lessonKey', 'occurrenceId']) {
    const different = field === 'teacher' ? 'webb' : field + ':other'
    assert.notEqual(teacherKeyboardMathKey({ ...base, [field]: different }), key)
  }
  assert.notEqual(teacherKeyboardMathKey({ ...base, phase: 'test' }), key,
    'independent test work must not inherit teaching scratch')
  assert.equal(teacherKeyboardMathKey({ ...base, learnerId: '' }), null)
  assert.equal(teacherKeyboardMathKey({ ...base, lessonKey: '' }), null)
  assert.equal(teacherKeyboardMathKey({ ...base, teacher: 'slate' }), null)
})

test('scratch restores the learner-entered answer, notes and partial entries in the correct occurrence', () => {
  const key = teacherKeyboardMathKey({ teacher: 'webb', learnerId: 'A', lessonKey: 'math/test', occurrenceId: 'repeat:two' })
  const raw = { operands: ['47', '26'], operation: 'multiplication', session: null, notes: {}, partialEntries: {} }
  const activityId = teacherKeyboardMathActivityId(key)
  const model = buildSlateManualScratch(raw, activityId, 'teaching')
  assert.ok(model)
  const cell = model.session.view.editable.find((id) => id === 'result.ones')
  assert.ok(cell)
  const entered = enterVerticalMathCell(model.problem, model.session.view, cell, '2')
  const updated = updateMathSessionView(model.session, entered.view, {
    activityId, expectedRevision: model.session.revision, requestId: 'entry',
  })
  assert.equal(updated.ok, true)
  const saved = JSON.parse(JSON.stringify({ ...raw, session: updated.state, notes: {}, partialEntries: { 'partial.1.ones': '2' } }))
  const restored = restoreTeacherKeyboardMath(saved, key, 'teaching')
  assert.equal(restored.session.view.entries[cell], '2')
  assert.equal(restored.partialEntries['partial.1.ones'], '2')
  assert.equal(buildSlateManualScratch(restored, activityId, 'teaching').problem.operation, 'multiplication')
})

test('invalid scratch data is sanitized before restoration', () => {
  const key = teacherKeyboardMathKey({ teacher: 'sonoma', learnerId: 'A', lessonKey: 'math/1' })
  assert.deepEqual(restoreTeacherKeyboardMath({ operands: ['not math', '1'] }, key).operands, ['', ''])
  assert.equal(restoreTeacherKeyboardMath(null, key).operation, 'addition')
})

test('both teacher pages mount the existing keyboard dock and transfer only into answer input', () => {
  const root = new URL('../../', import.meta.url)
  const read = path => readFileSync(new URL(path, root), 'utf8')
  const keyboard = read('components/SonomaKeyboard.jsx')
  const page = read('session/v2/SessionPageV2.jsx')
  const webb = read('session/webb/page.jsx')
  const scratch = read('session/slate/SlateManualScratch.jsx')
  const shared = read('components/TeacherKeyboardMathWorkspace.jsx')
  assert.match(page, /<TeacherKeyboardMathWorkspace[\s\S]*?teacher="sonoma"/)
  assert.match(page, /theme: \{ label: 'Ms\. Sonoma Keyboard', background: '#f8e9e5'/)
  assert.match(webb, /<TeacherKeyboardMathWorkspace[\s\S]*?teacher="webb"/)
  assert.match(shared, /keyboard\.setWorkspaceDock\(\{ label: theme\.label \}\)/)
  assert.match(shared, /keyboard\.workspacePortal/)
  assert.match(shared, /createPortal\(/)
  assert.match(shared, /keyboard\.insertMathResult/)
  assert.match(shared, /localStorage\.setItem\(storageKey/)
  assert.match(shared, /keyboardTheme=\{theme\}/)
  assert.match(scratch, /transferEnabled = true/)
  assert.match(keyboard, /panelRef\.current\?\.contains\(field\)/)
  assert.match(keyboard, /lastOutsideInputRef\.current/)
  assert.match(keyboard, /insertSlateMathResult\(field\.value, result\)/)
  assert.match(keyboard, /workspaceVisible = Boolean\(active && workspaceDock && layout === "math"\)/)
})
