import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const source = (relative) => fs.readFileSync(new URL(relative, root), 'utf8')

test('lesson generation is one surface with Simple and Detailed modes and shared state', () => {
  const generator = source('facilitator/generator/page.js')
  assert.match(generator, /aria-label="Lesson generator mode"/)
  assert.match(generator, />Simple<\/button>/)
  assert.match(generator, />Detailed<\/button>/)
  assert.match(generator, /What should this lesson be about\?/)
  assert.match(generator, /Lesson Setup/)
  assert.match(generator, /Teaching Notes/)
  assert.match(generator, /Vocabulary/)
  assert.match(generator, /setForm\(\(current\) => \(\{ \.\.\.current, \.\.\.json\.proposal\.generationSpec \}\)\)/)
  assert.match(generator, /switchGeneratorMode\('detailed'\)/)
  assert.match(generator, /generateFromSpec\(form/)
  assert.match(generator, /disabled=\{isDayGenerator\}/)
  assert.match(generator, /dayMaterializationContext\?\.lineageId/)
  assert.match(generator, /setDayMaterializationContext\(\{ lineageId, activeRevisionId \}\)/)
})

test('lesson creation and draft approval converge on Generator while Prepare is compatibility-only', () => {
  const dialog = source('components/syllabus/SyllabusDayActionDialog.js')
  const syllabus = source('facilitator/syllabus/page.js')
  const calendar = source('facilitator/calendar/page.js')
  const prepare = source('facilitator/prepare/page.js')
  const generator = source('facilitator/generator/page.js')
  const lessons = source('facilitator/lessons/page.js')
  const home = source('facilitator/page.js')
  const legacyGeneratorCard = source('facilitator/generator/ClientGenerator.jsx')

  assert.doesNotMatch(dialog, /Lesson title|Brief description|What should this lesson teach/)
  for (const page of [syllabus, calendar]) {
    assert.ok(page.includes('/facilitator/generator?'))
    assert.match(page, /plannedDate/)
    assert.match(page, /expectedActiveRevisionId/)
  }
  assert.match(generator, /data-testid="generated-lesson-review"/)
  assert.match(generator, /Approve lesson/)
  assert.ok(generator.includes('/api/facilitator/lessons/approve'))
  assert.match(generator, /refreshGeneratedLessonAssociation/)
  assert.ok(!generator.includes('/facilitator/prepare'))
  assert.doesNotMatch(generator, /writePreparationSnapshot/)
  assert.match(prepare, /LegacyPrepareCompatibilityPage/)
  assert.ok(prepare.includes('router.replace(target)'))
  assert.match(prepare, /buildLessonGeneratorReviewHref/)
  for (const retired of ['/api/facilitator/lessons/approve', '/api/facilitator/lessons/generate', '/api/lesson-schedule', 'Approve lesson', 'Start now', 'Make available']) assert.ok(!prepare.includes(retired), retired)
  assert.match(lessons, /Use in Syllabus/)
  assert.match(lessons, /addApprovedLessonToSyllabus/)
  assert.match(lessons, /\/api\/syllabus\/lesson-associations/)
  assert.doesNotMatch(lessons, /Detailed lesson builder/)
  assert.doesNotMatch(home, /Detailed lesson builder/)
  assert.ok(legacyGeneratorCard.includes('href="/facilitator/generator"'))
})
test('Syllabus day generation keeps canonical lineage materialization instead of becoming a separate generator', () => {
  const generator = source('facilitator/generator/page.js')
  const planning = source('lib/syllabus/planning.server.mjs')
  const materialization = source('lib/syllabus/materialization.server.mjs')

  assert.match(generator, /action: 'create_day'/)
  assert.match(generator, /\/api\/syllabus\/materialize/)
  assert.match(generator, /generationSpec:/)
  assert.match(planning, /generation_spec: facilitatorGenerationSpec\(generationSpec\)/)
  assert.match(materialization, /facilitator_generation_spec/)
  assert.match(materialization, /facilitatorSpec\.vocab/)
})
