import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  ASSESSMENT_ISOLATION_STATUSES,
  ASSESSMENT_ISOLATION_VERSION,
  ASSESSMENT_ROLES,
  analyzeAssessmentIsolation,
  buildInstructionalLessonView,
  getReservedAssessmentItems,
  roleForPhase,
  tagItemsForPhase,
} from '../src/app/lib/masteryEvidence/assessmentIsolation.js'
import {
  MasteryEvidenceClient,
} from '../src/app/lib/masteryEvidence/client.js'
import {
  MASTERY_EVIDENCE_STATUSES,
} from '../src/app/lib/masteryEvidence/constants.js'

const contaminatedLesson = Object.freeze({
  id: 'stage4-demo',
  title: 'Stage 4 Demo',
  grade: '4',
  subject: 'math',
  sample: [
    { id: 'practice-q1', question: 'PRACTICE_PROMPT: What is 2 + 2?', answer: '4' },
  ],
  test: [
    {
      id: 'reserved-test-q1',
      question: 'SECRET_TEST_PROMPT: Explain the assessment-only idea.',
      options: ['SECRET_OPTION', 'safe distractor'],
      answer: 'SECRET_ANSWER',
      expectedAny: ['SECRET_EXPECTED_ANY'],
    },
  ],
  raw: {
    test: [
      {
        id: 'reserved-raw-q2',
        question: 'SECRET_RAW_TEST_PROMPT',
        answer: 'SECRET_RAW_ANSWER',
      },
    ],
  },
})

function serialized(value) {
  return JSON.stringify(value)
}

function assertNoReservedText(value) {
  const text = serialized(value)
  for (const forbidden of [
    'SECRET_TEST_PROMPT',
    'SECRET_OPTION',
    'SECRET_ANSWER',
    'SECRET_EXPECTED_ANY',
    'SECRET_RAW_TEST_PROMPT',
    'SECRET_RAW_ANSWER',
  ]) {
    assert.equal(text.includes(forbidden), false, `${forbidden} leaked into instructional payload`)
  }
}

test('instructional lesson view excludes source-backed reserved test content', () => {
  const instructionalView = buildInstructionalLessonView(contaminatedLesson)
  assert.equal(instructionalView.assessmentIsolationVersion, ASSESSMENT_ISOLATION_VERSION)
  assertNoReservedText(instructionalView)
  assert.equal(serialized(instructionalView).includes('PRACTICE_PROMPT'), true)

  const reservedItems = getReservedAssessmentItems(contaminatedLesson)
  assert.equal(reservedItems.length, 2)
  assert.equal(reservedItems.every((item) => item.assessmentRole === ASSESSMENT_ROLES.ASSESSMENT_RESERVED), true)
  assert.equal(serialized(reservedItems).includes('SECRET_TEST_PROMPT'), true)
})

test('instructional API and controller source use the centralized instructional projection', () => {
  const discussionRoute = fs.readFileSync('src/app/api/sonoma-discussion/route.js', 'utf8')
  const exerciseRoute = fs.readFileSync('src/app/api/sonoma-exercise/route.js', 'utf8')
  const objectivesRoute = fs.readFileSync('src/app/api/webb-objectives/route.js', 'utf8')
  const discussionPhase = fs.readFileSync('src/app/session/v2/DiscussionPhase.jsx', 'utf8')
  const exercisePhase = fs.readFileSync('src/app/session/v2/ExerciseConversationPhase.jsx', 'utf8')
  const sessionPage = fs.readFileSync('src/app/session/v2/SessionPageV2.jsx', 'utf8')

  for (const source of [discussionRoute, exerciseRoute, objectivesRoute, discussionPhase, exercisePhase, sessionPage]) {
    assert.equal(source.includes('buildInstructionalLessonView'), true)
  }
  assert.match(discussionRoute, /const lesson = buildInstructionalLessonView\(rawLesson\)/)
  assert.match(exerciseRoute, /const lesson = buildInstructionalLessonView\(rawLesson\)/)
  assert.match(sessionPage, /lessonData: instructionalLessonView \|\| lessonData/)
})

test('instructional payload projection excludes reserved test data before Test phase', () => {
  const instructionalPayload = {
    action: 'overview',
    lesson: buildInstructionalLessonView(contaminatedLesson),
    vocab: [],
    learnerName: 'Jordan',
  }
  assertNoReservedText(instructionalPayload)
  assert.equal(serialized(instructionalPayload).includes('PRACTICE_PROMPT'), true)
})

test('reserved assessment items remain available for Test phase only', () => {
  const testItems = tagItemsForPhase(getReservedAssessmentItems(contaminatedLesson), 'test')
  assert.equal(roleForPhase('test'), ASSESSMENT_ROLES.ASSESSMENT_RESERVED)
  assert.equal(testItems.length, 2)
  assert.equal(testItems.every((item) => item.assessmentRole === ASSESSMENT_ROLES.ASSESSMENT_RESERVED), true)
  assert.equal(serialized(testItems).includes('SECRET_TEST_PROMPT'), true)
})

test('assessment isolation classifies distinct, overlapping, and legacy unavailable lessons', async () => {
  const distinct = await analyzeAssessmentIsolation({
    lessonKey: 'generated/stage4',
    lessonId: 'stage4-demo',
    lessonData: contaminatedLesson,
    phaseSets: {
      discussion: [],
      comprehension: [],
      exercise: contaminatedLesson.sample,
      worksheet: [],
      test: contaminatedLesson.test,
    },
  })
  assert.equal(distinct.status, ASSESSMENT_ISOLATION_STATUSES.ISOLATED)
  assert.equal(distinct.reservedAssessmentCount, 2)

  const overlap = await analyzeAssessmentIsolation({
    lessonKey: 'generated/stage4',
    lessonId: 'stage4-demo',
    lessonData: contaminatedLesson,
    phaseSets: {
      discussion: [],
      comprehension: [],
      exercise: contaminatedLesson.test,
      worksheet: [],
      test: contaminatedLesson.test,
    },
  })
  assert.equal(overlap.status, ASSESSMENT_ISOLATION_STATUSES.NOT_ISOLATED)
  assert.equal(overlap.reason, 'deterministic_instructional_assessment_overlap')
  assert.ok(overlap.overlaps.length >= 1)

  const legacy = await analyzeAssessmentIsolation({
    lessonKey: 'built-in/legacy',
    lessonId: 'legacy',
    lessonData: { title: 'Legacy', sample: contaminatedLesson.sample },
    phaseSets: { exercise: contaminatedLesson.sample },
  })
  assert.equal(legacy.status, ASSESSMENT_ISOLATION_STATUSES.UNAVAILABLE)
  assert.equal(legacy.reason, 'no_separable_reserved_assessment_pool')
})

test('Ask and visual-aid source paths do not require whole lesson/test payloads before Test', () => {
  const openingActions = fs.readFileSync('src/app/session/v2/OpeningActionsController.jsx', 'utf8')
  const visualAidRoute = fs.readFileSync('src/app/api/visual-aids/generate/route.js', 'utf8')

  assert.match(openingActions, /problemChunk/)
  assert.doesNotMatch(openingActions, /lessonData/)
  assert.doesNotMatch(openingActions, /lesson:\s*lesson/)
  assert.match(visualAidRoute, /teachingNotes/)
  assert.doesNotMatch(visualAidRoute, /body\.lesson/)
  assert.doesNotMatch(visualAidRoute, /\btest\b.*body/s)
})

test('question refresh preserves isolation by reanalyzing the current lesson source', async () => {
  const refreshedLesson = {
    ...contaminatedLesson,
    test: [
      { id: 'reserved-test-q2', question: 'SECRET_REFRESHED_TEST_PROMPT', answer: 'SECRET_REFRESHED_ANSWER' },
    ],
    raw: {},
  }

  const before = getReservedAssessmentItems(contaminatedLesson)
  const after = getReservedAssessmentItems(refreshedLesson)
  assert.notEqual(serialized(before), serialized(after))
  assertNoReservedText(buildInstructionalLessonView(refreshedLesson))

  const analysis = await analyzeAssessmentIsolation({
    lessonKey: 'generated/stage4',
    lessonId: 'stage4-demo',
    lessonData: refreshedLesson,
    phaseSets: { exercise: contaminatedLesson.sample, test: refreshedLesson.test },
  })
  assert.equal(analysis.status, ASSESSMENT_ISOLATION_STATUSES.ISOLATED)
})

test('event evidence preserves reserved exposure truth across timeline revisits', async () => {
  const posted = []
  const client = new MasteryEvidenceClient({
    enabled: true,
    getAuthToken: async () => 'valid-token',
    now: () => '2026-08-09T12:00:00.000Z',
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      posted.push(body)
      if (body.action === 'create_session') {
        return Response.json({
          ok: true,
          evidence_session: { id: 'evidence-session-stage4', evidence_status: MASTERY_EVIDENCE_STATUSES.PARTIAL },
        })
      }
      return Response.json({ ok: true, duplicate: false })
    },
  })
  const item = contaminatedLesson.test[0]

  client.initialize({
    sessionId: 'stage4-session',
    learnerId: '22222222-2222-2222-2222-222222222222',
    lessonKey: 'generated/stage4',
    lessonData: contaminatedLesson,
    assessmentIsolation: {
      version: ASSESSMENT_ISOLATION_VERSION,
      status: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
      reservedAssessmentCount: 1,
    },
    startedAt: '2026-08-09T12:00:00.000Z',
  })
  await client.recordItemPresented({
    phase: 'test',
    itemPurpose: 'test',
    itemExposureId: 'test-run1-q1',
    identityItem: item,
    assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
  })
  await client.recordItemPresented({
    phase: 'test',
    itemPurpose: 'test',
    itemExposureId: 'test-run2-q1',
    identityItem: item,
    assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
  })

  const events = posted.filter((body) => body.action === 'record_event')
  assert.equal(events[0].pre_assessment_exposed, false)
  assert.equal(events[1].pre_assessment_exposed, true)
})
