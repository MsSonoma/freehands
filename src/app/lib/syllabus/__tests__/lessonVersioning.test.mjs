import assert from 'node:assert/strict'
import test from 'node:test'
import { makeEditableLessonVersion } from '../lessonVersioning.mjs'

test('revising a started lesson creates a separate draft and preserves the original lesson and receipt', () => {
  const original = {
    id: 'original', title: 'Fractions', subject: 'math', grade: '4', difficulty: 'beginner',
    approved: true, needsUpdate: true, materialization_operation: { id: 'old-generation' },
    objectives: [{ id: 'obj1', description: 'Compare fractions' }],
  }
  const before = structuredClone(original)
  const copy = makeEditableLessonVersion(original, 'generated/fractions.json', new Date('2026-11-02T15:00:00Z'))
  assert.deepEqual(original, before)
  assert.equal(copy.revisionOfLessonKey, 'generated/fractions.json')
  assert.equal(copy.approved, false)
  assert.equal(copy.needsUpdate, false)
  assert.equal(copy.materialization_operation, undefined)
  assert.notEqual(copy.id, original.id)
  assert.deepEqual(copy.objectives, original.objectives)
})
