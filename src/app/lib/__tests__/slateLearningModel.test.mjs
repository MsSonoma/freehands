import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { ASSESSMENT_ISOLATION_STATUSES } from '../masteryEvidence/assessmentIsolation.js'
import { MASTERY_OUTCOMES } from '../masteryEvidence/mastery.js'
import {
  SLATE_RUN_PURPOSES,
  buildSlatePool,
  canonicalSlateMastery,
  classifySlateMasteryResponse,
  createSlateRunState,
  markSlateRecoveryCompleted,
  markSlateRecoveryStarted,
  pointGoalMessage,
  slateCompletionAudioOptions,
} from '../slateLearningModel.mjs'

const lesson = {
  sample: [{ id: 'practice-1', conceptId: 'fractions', question: 'What is one half?', expectedAny: ['1/2'] }],
  test: [
    { id: 'held-1', conceptId: 'fractions', question: 'Which is one half?', choices: ['1/3', '1/2'], correct: 1 },
    { id: 'held-2', conceptId: 'fractions', question: 'Write one half.', expectedAny: ['1/2'] },
  ],
}

test('Slate keeps practice and held-out mastery pools separate while preserving stable identity', () => {
  const practice = buildSlatePool(lesson, SLATE_RUN_PURPOSES.PRACTICE)
  const mastery = buildSlatePool(lesson, SLATE_RUN_PURPOSES.MASTERY)
  assert.deepEqual(practice.map((item) => item.id), ['practice-1'])
  assert.deepEqual(mastery.map((item) => item.id), ['held-1', 'held-2'])
  assert.equal(practice[0].conceptId, 'fractions')
  assert.equal(mastery[0].assessmentRole, 'assessment_reserved')
})

test('point completion never invents mastery when evidence is missing or nonqualifying', () => {
  assert.equal(pointGoalMessage({ evidenceStatus: 'complete', masteryOutcome: null }), 'Drill complete.')
  assert.match(pointGoalMessage({ evidenceStatus: 'partial', masteryOutcome: MASTERY_OUTCOMES.INDEPENDENT_SUCCESS }), /record may be incomplete/)
})

test('score-goal completion audio cannot claim mastery without completed qualifying evidence', () => {
  for (const evidenceStatus of ['unavailable', 'partial', 'complete']) {
    const options = slateCompletionAudioOptions({ evidenceStatus, masteryOutcome: null })
    assert.ok(options.length > 0)
    for (const message of options) assert.doesNotMatch(message, /mastery|mastered|badge|unlocked/i)
  }
  for (const message of slateCompletionAudioOptions({ evidenceStatus: 'partial', masteryOutcome: MASTERY_OUTCOMES.INDEPENDENT_SUCCESS })) {
    assert.doesNotMatch(message, /mastery|mastered|badge|unlocked/i)
  }
})

test('answer reveal alone cannot become success after recovery on a fresh item', () => {
  let runState = createSlateRunState(SLATE_RUN_PURPOSES.MASTERY)
  const first = classifySlateMasteryResponse({
    runState, itemIdentity: { stableItemId: 'held-1' }, itemExposureId: 'exposure-1', isCorrect: false,
    assessmentIsolationStatus: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
  })
  assert.equal(first.masteryOutcome, MASTERY_OUTCOMES.NEEDS_RECOVERY)
  runState = { ...runState, recoveryNeeded: true }
  const contaminatedRetry = classifySlateMasteryResponse({
    runState, itemIdentity: { stableItemId: 'held-1' }, itemExposureId: 'exposure-2', isCorrect: true,
    preAssessmentExposed: true, assessmentIsolationStatus: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
  })
  assert.equal(contaminatedRetry.masteryOutcome, MASTERY_OUTCOMES.UNAVAILABLE)
  const freshWithoutRecovery = classifySlateMasteryResponse({
    runState, itemIdentity: { stableItemId: 'held-2' }, itemExposureId: 'exposure-3', isCorrect: true,
    assessmentIsolationStatus: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
  })
  assert.equal(freshWithoutRecovery.masteryOutcome, MASTERY_OUTCOMES.UNAVAILABLE)
})

test('durably started and completed recovery permits a different clean held-out verification item', () => {
  let runState = { ...createSlateRunState(SLATE_RUN_PURPOSES.MASTERY), recoveryNeeded: true }
  runState = markSlateRecoveryStarted(runState, true)
  assert.equal(runState.recoveryCompleted, false)
  runState = markSlateRecoveryCompleted(runState, true)
  const fresh = classifySlateMasteryResponse({
    runState, itemIdentity: { stableItemId: 'held-2' }, itemExposureId: 'exposure-3', isCorrect: true,
    assessmentIsolationStatus: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
  })
  assert.equal(fresh.masteryOutcome, MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY)
})

test('Slate records shared recovery boundaries without exposing a future held-out item to teaching', () => {
  const slate = fs.readFileSync(path.resolve('src/app/session/slate/page.jsx'), 'utf8')
  const start = slate.indexOf('const teachingPayload = buildRecoveryTeachingPayload')
  const end = slate.indexOf('const ok = writesBeforeRecovery', start)
  const recoveryStart = slate.slice(start, end)
  assert.match(recoveryStart, /failedItem: q/)
  assert.match(recoveryStart, /learnerResponse:/)
  assert.match(recoveryStart, /RECOVERY_STARTED/)
  assert.doesNotMatch(recoveryStart, /poolRef|deckRef|nextItem|candidateItems/)
  assert.match(slate, /RECOVERY_COMPLETED/)
  assert.match(slate, /markSlateRecoveryCompleted\(runStateRef\.current, write\?\.ok === true\)/)
})

test('canonical Slate mastery ignores point caches, partial sessions, and non-Slate evidence', () => {
  const events = [
    { session_id: 'sonoma:1', lesson_key: 'math/a.json', mastery_outcome: 'independent_success' },
    { session_id: 'slate:partial', lesson_key: 'math/a.json', mastery_outcome: 'independent_success', evidence_status: 'partial' },
    { session_id: 'slate:complete', lesson_key: 'math/a.json', mastery_outcome: 'independent_success', evidence_status: 'complete', occurred_at: '2026-08-29T12:00:00Z' },
  ]
  assert.deepEqual(canonicalSlateMastery(events), {
    'math/a.json': { mastered: true, masteredAt: '2026-08-29T12:00:00Z', source: 'canonical_evidence' },
  })
})

test('Daily and Weekly runs route into Slate while protected APIs remain authoritative', () => {
  const learn = fs.readFileSync(path.resolve('src/app/learn/LearnerHome.js'), 'utf8')
  const slateReview = fs.readFileSync(path.resolve('src/app/session/slate/SlateReviewExperience.jsx'), 'utf8')
  const slate = fs.readFileSync(path.resolve('src/app/session/slate/page.jsx'), 'utf8')
  const legacy = fs.readFileSync(path.resolve('src/app/learn/follow-ups/[runId]/page.js'), 'utf8')
  assert.match(learn, /\/session\/slate\?reviewRunId=/)
  assert.match(slate, /reviewRunId[\s\S]*SlateReviewExperience/)
  assert.match(slateReview, /getFollowUpRun[\s\S]*actOnFollowUp/)
  assert.doesNotMatch(slateReview, /localStorage|expectedAny|correctAnswer/)
  assert.match(legacy, /redirect\(`\/session\/slate\?reviewRunId=/)
  assert.doesNotMatch(legacy, /getFollowUpRun|actOnFollowUp|useEffect/)
})

test('legacy point mastery fails closed and Slate never calls instructional completion', () => {
  const client = fs.readFileSync(path.resolve('src/app/lib/masteryClient.js'), 'utf8')
  const slate = fs.readFileSync(path.resolve('src/app/session/slate/page.jsx'), 'utf8')
  assert.match(client, /legacy_point_mastery_disabled/)
  assert.doesNotMatch(client, /localStorage\.setItem/)
  assert.doesNotMatch(slate, /saveMastery|startLessonSession|endLessonSession|complete_lesson_session/)
})
