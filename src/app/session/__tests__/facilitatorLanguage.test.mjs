import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../../', import.meta.url)
const sonoma = readFileSync(new URL('session/v2/SessionPageV2.jsx', root), 'utf8')
const webb = readFileSync(new URL('session/webb/page.jsx', root), 'utf8')
const slate = readFileSync(new URL('session/slate/SlateIndependentTestReport.jsx', root), 'utf8')

test('learner-facing facilitator correction buttons do not expose internal FacOR terminology', () => {
  for (const source of [sonoma, webb, slate]) {
    assert.doesNotMatch(source, /FacOR\s*:/i)
  }
  assert.match(sonoma, /Facilitator: Correct work time/)
  assert.match(webb, /Facilitator: Correct work time/)
  assert.match(slate, /Facilitator: Correct grade/)
  assert.match(slate, /Facilitator: Review question/)
})

test('facilitator correction actions retain their existing handlers', () => {
  assert.match(sonoma, /onClick=\{\(\) => setSonomaStallOverrideOpen\(true\)\}/)
  assert.match(webb, /onClick=\{\(\) => setWebbStallOverrideOpen\(true\)\}/)
  assert.match(slate, /onClick=\{\(\) => onGradeReview\(entry, index\)\}/)
  assert.match(slate, /onClick=\{\(\) => onQuestionReview\(entry, index\)\}/)
})