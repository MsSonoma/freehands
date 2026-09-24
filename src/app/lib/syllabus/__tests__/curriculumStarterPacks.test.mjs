import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCurriculumStarterRecommendations,
  mergeFrameworkAndStarterRecommendations,
  normalizeStarterGrade,
} from '../curriculumStarterPacks.mjs'

test('starter packs normalize common learner grade formats', () => {
  assert.equal(normalizeStarterGrade('4'), '4')
  assert.equal(normalizeStarterGrade('4th'), '4')
  assert.equal(normalizeStarterGrade('Grade 4'), '4')
  assert.equal(normalizeStarterGrade('K'), 'K')
})

test('Grade 4 core subjects receive editable Ms. Sonoma starter recommendations', () => {
  const rows = buildCurriculumStarterRecommendations({
    grade: '4',
    subjects: ['Math', 'Language Arts', 'Science', 'Social Studies'],
  })

  assert.ok(rows.length >= 20)
  assert.ok(rows.some((item) => item.subject === 'Math' && /fraction/i.test(item.statement)))
  assert.ok(rows.some((item) => item.subject === 'Language Arts' && /writ/i.test(item.statement)))
  assert.ok(rows.some((item) => item.subject === 'Science' && /investigation/i.test(item.statement)))
  assert.ok(rows.some((item) => item.subject === 'Social Studies' && /civic/i.test(item.statement)))
  assert.ok(rows.every((item) => item.recommendation_kind === 'ms_sonoma'))
  assert.ok(rows.every((item) => item.framework_id === null))
})

test('custom subjects receive a small safe starter structure instead of an empty recommendation list', () => {
  const rows = buildCurriculumStarterRecommendations({
    grade: '4th',
    subjects: ['Art History'],
  })

  assert.equal(rows.length, 3)
  assert.ok(rows.every((item) => item.subject === 'Art History'))
  assert.ok(rows.every((item) => /^[A-Za-z0-9._:/-]+$/.test(item.planning_group_key)))
})

test('imported framework recommendations take precedence for that subject while starter packs fill uncovered subjects', () => {
  const starter = buildCurriculumStarterRecommendations({
    grade: '4',
    subjects: ['Math', 'Science'],
  })
  const framework = [{
    id: 'framework-item-1',
    framework_id: 'framework-1',
    subject: 'Math',
    statement: 'Authoritative math requirement.',
    planning_group_key: 'math:official',
  }]

  const merged = mergeFrameworkAndStarterRecommendations({
    frameworkItems: framework,
    starterItems: starter,
    subjects: ['Math', 'Science'],
  })

  assert.equal(merged.filter((item) => item.subject === 'Math').length, 1)
  assert.equal(merged.find((item) => item.subject === 'Math')?.statement, 'Authoritative math requirement.')
  assert.ok(merged.some((item) => item.subject === 'Science' && item.recommendation_kind === 'ms_sonoma'))
})
