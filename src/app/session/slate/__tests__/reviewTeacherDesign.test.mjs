import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewTeacherDesign } from '../../../lib/reviewTeacherDesign.mjs'

test('teacher review designs use the session visual identities', () => {
  assert.equal(reviewTeacherDesign('sonoma').accent, '#c7442e')
  assert.equal(reviewTeacherDesign('sonoma').page, '#ffffff')
  assert.equal(reviewTeacherDesign('webb').header, '#0f766e')
  assert.equal(reviewTeacherDesign('webb').accent, '#0d9488')
  assert.equal(reviewTeacherDesign('slate').page, '#0d1117')
  assert.equal(reviewTeacherDesign('slate').accent, '#58a6ff')
})

test('design objects do not contain teacher behavior configuration', () => {
  for (const id of ['sonoma', 'webb', 'slate']) {
    const design = reviewTeacherDesign(id)
    for (const key of ['tts', 'video', 'prompt', 'scoreGoal', 'questionSecs', 'runPurpose', 'tone']) {
      assert.equal(Object.hasOwn(design, key), false)
    }
  }
})
