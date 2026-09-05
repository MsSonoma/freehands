import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  learnerNowViewportKey,
  resolveLearnerSyllabusPresentation,
  shouldEstablishLearnerNowViewport,
} from '../../lib/syllabus/learnerPresentation.mjs'

const real = (overrides = {}) => resolveLearnerSyllabusPresentation({
  learnerId: 'learner-a',
  syllabusDecisionLearnerId: '',
  syllabusStatus: 'idle',
  syllabusKind: 'fallback',
  ...overrides,
})

test('real learner idle state is an unresolved Syllabus decision', () => {
  assert.deepEqual(real(), {
    state: 'pending',
    showOpening: true,
    showActiveSyllabus: false,
    showFallbackMessage: false,
    showLegacyLibraryHeading: false,
    showSupportingLibrary: false,
    allowLegacyTutorial: false,
  })
})

test('real learner loading state keeps the compatibility library hidden', () => {
  const view = real({ syllabusStatus: 'loading' })
  assert.equal(view.state, 'pending')
  assert.equal(view.showSupportingLibrary, false)
})

test('lesson data resolving during a slow Syllabus request cannot change presentation', () => {
  const sequence = [
    real({ syllabusStatus: 'loading', lessonsResolved: false }),
    real({ syllabusStatus: 'loading', lessonsResolved: true }),
    real({ syllabusStatus: 'ready', syllabusDecisionLearnerId: 'learner-a', syllabusKind: 'active', lessonsResolved: true }),
  ]
  assert.deepEqual(sequence.map((view) => view.state), ['pending', 'pending', 'active'])
  assert.deepEqual(sequence.map((view) => view.showSupportingLibrary), [false, false, false])
})

test('active Syllabus becomes the primary surface', () => {
  const view = real({ syllabusStatus: 'ready', syllabusDecisionLearnerId: 'learner-a', syllabusKind: 'active' })
  assert.equal(view.showActiveSyllabus, true)
  assert.equal(view.showOpening, false)
  assert.equal(view.showSupportingLibrary, false)
})

test('active Syllabus can expose the library for the selected-lesson workflow', () => {
  const view = real({ syllabusStatus: 'ready', syllabusDecisionLearnerId: 'learner-a', syllabusKind: 'active', selectedLesson: true })
  assert.equal(view.showSupportingLibrary, true)
  assert.equal(view.showLegacyLibraryHeading, false)
})

test('resolved no-active-Syllabus result exposes the compatibility library', () => {
  const view = real({ syllabusStatus: 'ready', syllabusDecisionLearnerId: 'learner-a' })
  assert.equal(view.state, 'fallback')
  assert.equal(view.showFallbackMessage, true)
  assert.equal(view.showSupportingLibrary, true)
})

test('known request error fallback exposes the compatibility library', () => {
  const view = real({ syllabusStatus: 'ready', syllabusDecisionLearnerId: 'learner-a', syllabusKind: 'fallback', syllabusError: 'offline' })
  assert.equal(view.state, 'fallback')
  assert.equal(view.showSupportingLibrary, true)
})

test('response for a previous learner cannot resolve the current learner decision', () => {
  const view = real({ syllabusStatus: 'ready', syllabusDecisionLearnerId: 'learner-b', syllabusKind: 'active' })
  assert.equal(view.state, 'pending')
  assert.equal(view.showActiveSyllabus, false)
})

test('demo learner immediately retains compatibility presentation', () => {
  const view = resolveLearnerSyllabusPresentation({ learnerId: 'demo', demoLearner: true })
  assert.equal(view.state, 'fallback')
  assert.equal(view.showOpening, false)
  assert.equal(view.showSupportingLibrary, true)
})

test('active-Syllabus learner is ineligible for the legacy tutorial', () => {
  assert.equal(real({ syllabusStatus: 'ready', syllabusDecisionLearnerId: 'learner-a', syllabusKind: 'active' }).allowLegacyTutorial, false)
})

test('genuine fallback learner remains eligible for the legacy tutorial', () => {
  assert.equal(real({ syllabusStatus: 'ready', syllabusDecisionLearnerId: 'learner-a' }).allowLegacyTutorial, true)
})

test('pending learner is ineligible for the legacy tutorial', () => {
  assert.equal(real({ syllabusStatus: 'loading' }).allowLegacyTutorial, false)
})

test('learner NOW presentation receives a stable viewport key', () => {
  assert.equal(learnerNowViewportKey({ role: 'learner', learnerId: 'a', revisionId: 'r1', weekState: 'now', weekStart: '2026-08-31' }), 'a:r1:2026-08-31')
})

test('initial learner NOW presentation requests viewport establishment', () => {
  assert.equal(shouldEstablishLearnerNowViewport('a:r1:2026-08-31', ''), true)
})

test('same learner revision does not repeatedly request a scroll', () => {
  const key = 'a:r1:2026-08-31'
  assert.equal(shouldEstablishLearnerNowViewport(key, key), false)
})

test('learner future navigation does not produce a NOW viewport key', () => {
  assert.equal(learnerNowViewportKey({ role: 'learner', learnerId: 'a', revisionId: 'r1', weekState: 'future', weekStart: '2026-09-07' }), '')
})

test('learner past navigation does not produce a NOW viewport key', () => {
  assert.equal(learnerNowViewportKey({ role: 'learner', learnerId: 'a', revisionId: 'r1', weekState: 'past', weekStart: '2026-08-24' }), '')
})

test('facilitator NOW view never receives an automatic viewport key', () => {
  assert.equal(learnerNowViewportKey({ role: 'facilitator', learnerId: 'a', revisionId: 'r1', weekState: 'now', weekStart: '2026-08-31' }), '')
})

test('changing learner permits a new initial NOW viewport establishment', () => {
  const prior = learnerNowViewportKey({ role: 'learner', learnerId: 'a', revisionId: 'r1', weekState: 'now', weekStart: '2026-08-31' })
  const next = learnerNowViewportKey({ role: 'learner', learnerId: 'b', revisionId: 'r1', weekState: 'now', weekStart: '2026-08-31' })
  assert.equal(shouldEstablishLearnerNowViewport(next, prior), true)
})

test('changing revision permits a new initial NOW viewport establishment', () => {
  const prior = learnerNowViewportKey({ role: 'learner', learnerId: 'a', revisionId: 'r1', weekState: 'now', weekStart: '2026-08-31' })
  const next = learnerNowViewportKey({ role: 'learner', learnerId: 'a', revisionId: 'r2', weekState: 'now', weekStart: '2026-08-31' })
  assert.equal(shouldEstablishLearnerNowViewport(next, prior), true)
})

test('Syllabus document keeps current-week initialization and a selected-week anchor', () => {
  const source = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
  assert.match(source, /moveSyllabusWeek\(null, 'now', today\)/)
  assert.match(source, /ref=\{selectedWeekRef\}/)
  assert.match(source, /data-syllabus-selected-week=\{week\.week_start\}/)
})

test('Syllabus document has exactly one Next week control', () => {
  const source = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
  assert.equal((source.match(/Next week/g) || []).length, 1)
})

test('NOW viewport effect is guarded and uses the selected-week DOM node', () => {
  const source = fs.readFileSync(path.resolve('src/app/components/syllabus/SyllabusDocument.js'), 'utf8')
  assert.match(source, /establishedNowViewportKeyRef = useRef\(''\)/)
  assert.match(source, /selectedWeekRef\.current\.scrollIntoView\(\{ block: 'start', inline: 'nearest' \}\)/)
})

test('tutorial is only marked seen by the existing explicit close action', () => {
  const source = fs.readFileSync(path.resolve('src/app/learn/LearnerHome.js'), 'utf8')
  assert.equal((source.match(/localStorage\.setItem\('ms_lessons_tutorial_seen', '1'\)/g) || []).length, 1)
  assert.match(source, /showTutorial && syllabusPresentation\.allowLegacyTutorial/)
})

test('passive presentation helper contains no lifecycle or persistence authority', () => {
  const source = fs.readFileSync(path.resolve('src/app/lib/syllabus/learnerPresentation.mjs'), 'utf8')
  assert.doesNotMatch(source, /fetch\(|getSupabase|createSession|startLesson|actualize|createHistory|createEvidence|mutateForecast|scheduleLesson|\.insert\(|\.update\(|\.delete\(/i)
})
