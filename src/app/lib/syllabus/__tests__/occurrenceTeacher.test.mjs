import assert from 'node:assert/strict'
import test from 'node:test'
import { instructionalTeacherForOccurrence } from '../occurrenceTeacher.mjs'

test('started Sonoma attempt overrides the old Slate lesson association on reload', () => {
  assert.equal(instructionalTeacherForOccurrence({
    placement_kind: 'actual', actual_instructional_teacher: 'sonoma',
    assigned_instructional_teacher: 'slate', source_occurrence_id: 'restart:example',
  }, { instructional_teacher: 'slate' }), 'sonoma')
})

test('the persisted restart teacher overrides the association before the first attempt', () => {
  assert.equal(instructionalTeacherForOccurrence({
    placement_kind: 'restart', assigned_instructional_teacher: 'webb',
    instructional_teacher: 'slate',
  }), 'webb')
})
