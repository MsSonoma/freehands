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

test('all lesson-creation entry points converge on the unified generator while review remains in Prepare', () => {
  const dialog = source('components/syllabus/SyllabusDayActionDialog.js')
  const syllabus = source('facilitator/syllabus/page.js')
  const calendar = source('facilitator/calendar/page.js')
  const prepare = source('facilitator/prepare/page.js')
  const lessons = source('facilitator/lessons/page.js')
  const home = source('facilitator/page.js')
  const legacyGeneratorCard = source('facilitator/generator/ClientGenerator.jsx')

  assert.doesNotMatch(dialog, /Lesson title|Brief description|What should this lesson teach/)
  for (const page of [syllabus, calendar]) {
    assert.match(page, /\/facilitator\/generator\?/)
    assert.match(page, /plannedDate/)
    assert.match(page, /expectedActiveRevisionId/)
  }
  assert.match(prepare, /stage !== STAGES\.NEED/)
  assert.match(prepare, /router\.replace\(`\/facilitator\/generator\?/)
  assert.doesNotMatch(lessons, /Detailed lesson builder/)
  assert.doesNotMatch(home, /Detailed lesson builder/)
  assert.match(legacyGeneratorCard, /href="\/facilitator\/generator"/)
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
