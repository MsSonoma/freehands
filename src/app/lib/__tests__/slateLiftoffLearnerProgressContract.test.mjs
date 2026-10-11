import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const learner = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
const facilitator = fs.readFileSync(path.resolve('src/app/components/syllabus/FacilitatorSyllabusLessonOverlay.js'), 'utf8')

test('learner Liftoff view hides the diagnostic responsibility map and reasons', () => {
  assert.doesNotMatch(learner, /RESPONSIBILITY MAP/)
  assert.doesNotMatch(learner, /Why this move/)
  assert.doesNotMatch(learner, /component\.description/)
  assert.doesNotMatch(learner, /component\.dependencies/)
})

test('learner Liftoff view shows phase and earned progress without percentage theater', () => {
  assert.match(learner, /YOUR PROGRESS/)
  assert.match(learner, /Liftoff/)
  assert.match(learner, /Test/)
  assert.match(learner, /Results/)
  const progress = learner.slice(learner.indexOf('const progressStages = ['), learner.indexOf('const learnerStageIndex'))
  assert.doesNotMatch(progress, /Worksheet/)
  assert.match(learner, /skills demonstrated/)
  assert.match(learner, /skills still to demonstrate/)
  assert.match(learner, /EARNED SKILLS/)
  assert.match(learner, /CHECKING AGAIN/)
  assert.doesNotMatch(learner, /progressPercent/)
})

test('facilitator Syllabus keeps the full Liftoff map and diagnostic trace', () => {
  assert.match(facilitator, /Mr\. Slate objectives/)
  assert.match(facilitator, /component\.description/)
  assert.match(facilitator, /component\.dependencies/)
  assert.match(facilitator, /Instructional trace/)
  assert.match(facilitator, /entry\.action\.reason/)
})
