import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { clearLearnerTargetOverrides, normalizeHumorLevel, persistLearnerSelection } from '../learnerSelection.mjs'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

test('switching from learner A to B persists B complete identity and normalized humor', () => {
  const storage = memoryStorage({
    learner_id: 'learner-a',
    learner_name: 'Alex',
    learner_grade: '4',
    learner_humor_level: 'hilarious',
    'learner_humor_level_learner-a': 'hilarious',
  })

  const selected = persistLearnerSelection(storage, {
    id: 'learner-b', name: 'Bailey', grade: 7, humor_level: 'FUNNY',
  })

  assert.deepEqual(selected, { id: 'learner-b', name: 'Bailey', grade: 7, humor_level: 'funny' })
  assert.equal(storage.getItem('learner_id'), 'learner-b')
  assert.equal(storage.getItem('learner_name'), 'Bailey')
  assert.equal(storage.getItem('learner_grade'), '7')
  assert.equal(storage.getItem('learner_humor_level'), 'funny')
  assert.equal(storage.getItem('learner_humor_level_learner-b'), 'funny')
  assert.equal(storage.getItem('learner_humor_level_learner-a'), 'hilarious')
})

test('switching from hilarious A to calm B cannot leak global humor', () => {
  const storage = memoryStorage({ learner_id: 'a', learner_humor_level: 'hilarious' })
  persistLearnerSelection(storage, { id: 'b', name: 'B', grade: 5, humor_level: 'calm' })
  assert.equal(storage.getItem('learner_humor_level'), 'calm')
  assert.equal(storage.getItem('learner_humor_level_b'), 'calm')
})

test('missing or invalid humor resolves to calm', () => {
  for (const humorLevel of [undefined, null, '', 'wild']) {
    const storage = memoryStorage()
    assert.equal(normalizeHumorLevel(humorLevel), 'calm')
    persistLearnerSelection(storage, { id: 'b', name: 'B', grade: 5, humor_level: humorLevel })
    assert.equal(storage.getItem('learner_humor_level'), 'calm')
    assert.equal(storage.getItem('learner_humor_level_b'), 'calm')
  }
})

test('switching preserves target cleanup and unrelated learner state', () => {
  const protectedState = {
    learner_humor_level_a: 'hilarious',
    learner_humor_level_b: 'funny',
    'syllabus:a': 'unchanged',
    'lesson_history:a': 'unchanged',
    'evidence:a': 'unchanged',
    'atomic_snapshot:a:lesson': 'unchanged',
    'schedule:a': 'unchanged',
  }
  const storage = memoryStorage({
    learner_id: 'a',
    target_comprehension: '1', target_exercise: '1', target_worksheet: '1', target_test: '1',
    target_comprehension_a: '2', target_exercise_a: '2', target_worksheet_a: '2', target_test_a: '2',
    ...protectedState,
  })

  persistLearnerSelection(storage, { id: 'b', name: 'B', grade: 6, humor_level: 'calm' })

  for (const target of ['comprehension', 'exercise', 'worksheet', 'test']) {
    assert.equal(storage.getItem(`target_${target}`), null)
    assert.equal(storage.getItem(`target_${target}_a`), null)
  }
  for (const [key, value] of Object.entries(protectedState)) {
    assert.equal(storage.getItem(key), key === 'learner_humor_level_b' ? 'calm' : value)
  }
})

test('Demo switching retains the existing target cleanup contract', () => {
  const storage = memoryStorage({
    target_comprehension: '1', target_exercise: '1', target_worksheet: '1', target_test: '1',
    target_comprehension_a: '2', target_exercise_a: '2', target_worksheet_a: '2', target_test_a: '2',
  })
  clearLearnerTargetOverrides(storage, 'a', 'demo')
  for (const target of ['comprehension', 'exercise', 'worksheet', 'test']) {
    assert.equal(storage.getItem(`target_${target}`), null)
    assert.equal(storage.getItem(`target_${target}_a`), null)
  }
})

test('Learner Home exposes the existing selection route outside the hidden library sidebar', () => {
  const home = fs.readFileSync(path.resolve('src/app/learn/LearnerHome.js'), 'utf8')
  const switcher = home.indexOf('data-learner-switcher')
  const syllabus = home.indexOf('<section aria-label="My active Syllabus"')
  const library = home.indexOf('data-syllabus-supporting-library')

  assert.ok(switcher >= 0 && switcher < syllabus && syllabus < library)
  assert.match(home.slice(switcher, syllabus), /router\.push\('\/learners\/select'\)/)
  assert.match(home.slice(switcher, syllabus), />\s*Change learner\s*</)
  assert.equal((home.match(/\{learnerSwitcher\}/g) || []).length, 2)
})

test('existing learner selection page still returns to Learner Home', () => {
  const page = fs.readFileSync(path.resolve('src/app/learners/select/page.js'), 'utf8')
  assert.match(page, /<LearnerSelector/)
  assert.match(page, /r\.push\('\/learn'\)/)
})

test('selector payload carries humor without adding mutation services', () => {
  const selector = fs.readFileSync(path.resolve('src/app/learn/LearnerSelector.js'), 'utf8')
  assert.match(selector, /humor_level: l\.humor_level/)
  assert.doesNotMatch(selector, /syllabus|lesson.history|evidence|snapshot|schedule|updateLearner|delete/i)
})
