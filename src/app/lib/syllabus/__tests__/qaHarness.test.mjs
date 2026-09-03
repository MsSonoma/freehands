import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { createSyllabusQaFixture, SYLLABUS_QA_FACILITATOR_ID, SYLLABUS_QA_LEARNER_ID } from '../qaFixtures.mjs'
import { isSyllabusQaEnabled } from '../qaGuard.mjs'

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8')

test('QA mode requires development plus both explicit opt-in flags', () => {
  assert.equal(isSyllabusQaEnabled({ NODE_ENV: 'development', SYLLABUS_QA_ENABLED: 'true', NEXT_PUBLIC_SYLLABUS_QA_ENABLED: 'true' }), true)
  assert.equal(isSyllabusQaEnabled({ NODE_ENV: 'development', SYLLABUS_QA_ENABLED: 'true' }), false)
  assert.equal(isSyllabusQaEnabled({ NODE_ENV: 'development', NEXT_PUBLIC_SYLLABUS_QA_ENABLED: 'true' }), false)
  assert.equal(isSyllabusQaEnabled({ NODE_ENV: 'test', SYLLABUS_QA_ENABLED: 'false', NEXT_PUBLIC_SYLLABUS_QA_ENABLED: 'true' }), false)
})

test('production cannot enable the QA harness even when every fixture flag is present', () => {
  assert.equal(isSyllabusQaEnabled({ NODE_ENV: 'production', SYLLABUS_QA_ENABLED: 'true', NEXT_PUBLIC_SYLLABUS_QA_ENABLED: 'true' }), false)
})

test('QA page fails closed at the server route before rendering fixture identities', () => {
  const page = read('src/app/qa/syllabus/page.js')
  assert.match(page, /if \(!isSyllabusQaEnabled\(process\.env\)\) notFound\(\)/)
  assert.doesNotMatch(page, /use client/)
  assert.doesNotMatch(page, /Supabase|useAccessControl|getSupabaseClient/)
})

test('fixture identities and repeated occurrences are deterministic and non-production', () => {
  const first = createSyllabusQaFixture()
  const second = createSyllabusQaFixture()
  assert.deepEqual(first, second)
  assert.equal(first.facilitator.id, SYLLABUS_QA_FACILITATOR_ID)
  assert.equal(first.learner.id, SYLLABUS_QA_LEARNER_ID)
  assert.match(first.facilitator.id, /^qa-/)
  assert.match(first.learner.id, /^qa-/)
  const repeats = first.timelineItems.filter((item) => item.title === 'Fraction Stories')
  assert.equal(repeats.length, 2)
  assert.notEqual(repeats[0].occurrence_id, repeats[1].occurrence_id)
  assert.notEqual(first.historyByOccurrence[repeats[0].occurrence_id].evidence.primary.session.id, first.historyByOccurrence[repeats[1].occurrence_id].evidence.primary.session.id)
  assert.equal(first.historyByOccurrence[repeats[0].occurrence_id].evidence.slate[0].learning_summary.headline, 'Correct with assistance')
})

test('QA harness uses actual Syllabus components and has no production-capable data adapter', () => {
  const harness = read('src/app/qa/syllabus/SyllabusQaHarness.js')
  assert.match(harness, /components\/syllabus\/SyllabusDocument/)
  assert.match(harness, /components\/syllabus\/SyllabusPlanningWorkspace/)
  assert.match(harness, /components\/syllabus\/LessonHistoryOverlay/)
  assert.match(harness, /resolveActionHref=\{\(\) => null\}/)
  assert.match(harness, /loadHistory=\{loadHistory\}/)
  assert.match(harness, /loadTranscript=\{loadTranscript\}/)
  assert.doesNotMatch(harness, /getSupabaseClient|useAccessControl|createClient|OpenAI|\/api\//)
  assert.doesNotMatch(harness, /\bfetch\s*\(/)
  assert.doesNotMatch(harness, /localStorage|sessionStorage|document\.cookie/)
})

test('production auth and API defaults remain intact and separate from QA injection seams', () => {
  const facilitator = read('src/app/facilitator/syllabus/page.js')
  const overlay = read('src/app/components/syllabus/LessonHistoryOverlay.js')
  assert.match(facilitator, /useAccessControl\(\{ requiredAuth: 'required' \}\)/)
  assert.match(facilitator, /getSupabaseClient\(\)/)
  assert.match(facilitator, /fetch\(`\/api\/syllabus/)
  assert.doesNotMatch(facilitator, /qaGuard|SYLLABUS_QA_ENABLED|qa\/syllabus/)
  assert.match(overlay, /loadHistory\s*\?/) 
  assert.match(overlay, /fetch\(`\/api\/facilitator\/learners/)
})

test('explicit npm script is the only documented activation path', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.match(pkg.scripts['dev:syllabus-qa'], /SYLLABUS_QA_ENABLED=true/)
  assert.match(pkg.scripts['dev:syllabus-qa'], /NEXT_PUBLIC_SYLLABUS_QA_ENABLED=true/)
  assert.match(pkg.scripts['dev:syllabus-qa'], /next dev/)
  assert.doesNotMatch(pkg.scripts.dev, /SYLLABUS_QA/)
})
