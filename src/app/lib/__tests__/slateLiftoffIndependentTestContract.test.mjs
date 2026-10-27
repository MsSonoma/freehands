import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { buildSlateLiftoffTestItems, slateLiftoffPrintableTestItems } from '../slateLiftoffTest.mjs'

const slate = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
const syllabus = fs.readFileSync(path.resolve('src/app/components/syllabus/FacilitatorSyllabusLessonOverlay.js'), 'utf8')

test('test questions use reserved JSON material while excluding teaching examples', () => {
  const lesson = {
    worksheet: [{ question: 'Practice overlap', answer: '2' }],
    test: [
      { question: 'Practice overlap', answer: '2' },
      { question: 'Independent A', expected: '4' },
      { question: 'Independent A', expected: '4' },
      { question: 'Independent B', choices: [{ letter: 'A', text: 'three' }, { letter: 'B', text: 'four' }], correct: 'B' },
    ],
  }
  const items = buildSlateLiftoffTestItems(lesson)
  assert.deepEqual(items.map((item) => item.question), ['Independent A', 'Independent B'])
  assert.deepEqual(slateLiftoffPrintableTestItems(items).map((item) => item.prompt), items.map((item) => item.question))
})

test('fallback test uses word problems and short answers rather than instructional multiple choice', () => {
  const lesson = {
    multiplechoice: [{ question: 'Teach me', choices: ['A', 'B'], correct: 'A' }],
    wordProblems: [{ question: 'Problem one', expectedAny: ['5'] }],
    shortanswer: [{ question: 'Explain one', expected: 'yes' }],
  }
  assert.deepEqual(buildSlateLiftoffTestItems(lesson).map((item) => item.question), ['Problem one', 'Explain one'])
})

test('printable Slate test includes screen choices without exposing answer keys', () => {
  const items = [
    { question: 'Choose the number', choices: [{ letter: 'A', text: 'three' }, { letter: 'B', text: 'four' }], correct: 'B' },
    { prompt: 'The earth is round', answer: true },
    { question: 'What is the result?', expectedAny: ['42'] },
  ]
  const printable = slateLiftoffPrintableTestItems(items)
  assert.deepEqual(printable.map((item) => item.prompt), ['Choose the number', 'The earth is round', 'What is the result?'])
  assert.deepEqual(printable[0].choices, ['three', 'four'])
  assert.equal(printable[1].sourceType, 'tf')
  assert.deepEqual(printable.map((item) => item.number), [1, 2, 3])
  assert.doesNotMatch(JSON.stringify(printable), /"correct"|"answer"|"expectedAny"/)
})

test('Slate transitions straight from mastery-qualified Liftoff into independent test', () => {
  const start = slate.indexOf('const beginIndependentAssessment = useCallback')
  const end = slate.indexOf('const submitLiftoffAnswer = useCallback', start)
  assert.ok(start >= 0 && end > start)
  const transition = slate.slice(start, end)
  assert.match(transition, /buildAssessmentSets\(loadedLesson\)/)
  assert.match(transition, /setPhase\('test'\)/)
  assert.match(transition, /kind: 'test_start'/)
  assert.doesNotMatch(transition, /setPhase\('worksheet'\)/)
  assert.match(slate, /nextState\.procedureReleased && liftoffReleaseReady\(nextState\)/)
  const phases = slate.slice(slate.indexOf('const progressStages = ['), slate.indexOf('const learnerStageIndex'))
  assert.match(phases, /label: 'Liftoff'/)
  assert.match(phases, /label: 'Test'/)
  assert.match(phases, /label: 'Results'/)
  assert.doesNotMatch(phases, /Worksheet/)
})


test('misaligned reserved questions are replaced before testing and the accepted pool survives resume', () => {
  const slateRoute = fs.readFileSync(path.resolve('src/app/api/slate-liftoff/route.js'), 'utf8')
  assert.match(slate, /mode: 'prepare_test'/)
  assert.match(slate, /validateSlateTestAlignment\(\{ lesson: loadedLesson, liftoff: liftoffState, testItems: alignedTestItems \}\)/)
  assert.match(slate, /testItems: alignedTestItems, assessmentIndex: 0/)
  assert.match(slate, /testItemsRef\.current = restoredTestItems/)
  assert.match(slate, /const needsReplacement = resumedPhase === 'test'/)
  assert.match(slate, /results\.length !== testItemsRef\.current\.length/)
  assert.match(slateRoute, /requestedMode === 'prepare_test'/)
  assert.match(slateRoute, /const alignment = validateSlateTestAlignment/)
})

test('old worksheet snapshots resume at the independent test instead of returning to worksheet', () => {
  assert.match(slate, /const oldWorksheetSnapshot = feature\.phase === 'worksheet'/)
  assert.match(slate, /feature\.phase === 'test' \|\| oldWorksheetSnapshot \? 'test' : 'active'/)
  assert.match(slate, /if \(oldWorksheetSnapshot\) restoredLines\.push\(\{ role: 'assistant'/)
  assert.match(slate, /kind: 'test_start'/)
})

test('independent test is help-free and hides correctness until results', () => {
  assert.match(slate, /studyEnabled=\{!busy && !lineHelpBusy && phase !== 'test'\}/)
  assert.match(slate, /lineHelpTarget && phase !== 'test'/)
  assert.match(slate, /const nextResults = \[\.\.\.testResults, result\]/)
  assert.match(slate, /await finishLesson\(nextResults\)/)
  assert.match(slate, /Independent Test Results/)
  assert.match(slate, /Lesson complete\. Your independent test score is/)
})

test('Slate lesson and facilitator printing use the same fixed test source', () => {
  assert.match(slate, /buildSlateLiftoffTestItems\(lesson\)/)
  assert.match(slate, /slateLiftoffPrintableTestItems\(testItems\)/)
  assert.match(slate, /phase === 'test' && <button type="button" onClick=\{\(\) => void printIndependentTest\(\)\}/)
  assert.match(syllabus, /source = buildSlateLiftoffTestItems\(lesson\)/)
  assert.match(syllabus, /items: slateTest \? slateLiftoffPrintableTestItems\(source\)/)
  assert.match(syllabus, /displayTeacher !== 'slate' && <button/)
  assert.match(syllabus, /buildAssessmentPhaseSets/)
})


test('independent test uses the learner-language and single-operation contracts', () => {
  const slateRoute = fs.readFileSync(path.resolve('src/app/api/slate-liftoff/route.js'), 'utf8')
  const alignment = fs.readFileSync(path.resolve('src/app/lib/slateTestAlignment.mjs'), 'utf8')
  assert.match(slateRoute, /buildLearnerLanguageGuidance\(\{ grade: lesson\?\.grade \|\| lesson\?\.gradeLevel \}\)/)
  assert.match(slateRoute, /Each test item asks for exactly ONE primary cognitive operation/)
  assert.match(slateRoute, /split them across separate held-out items mapped to the SAME objectiveId/)
  assert.match(slateRoute, /"demandType":"one allowed cognitive operation"/)
  assert.match(alignment, /validateSlateCognitiveDemand/)
  assert.match(alignment, /reasoningCovered/)
})
