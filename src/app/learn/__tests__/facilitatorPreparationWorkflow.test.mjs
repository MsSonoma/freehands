import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  FACILITATOR_PREPARATION_STAGES,
  canTransitionPreparationStage,
} from '../../lib/facilitatorPreparation.mjs'
import {
  countEducatorApprovedLessons,
  countLearnerActiveLessons,
  resolveFacilitatorHomeDecision,
} from '../../lib/facilitatorHome.mjs'

test('approval can advance from draft content review to session choice', () => {
  assert.equal(
    canTransitionPreparationStage(
      FACILITATOR_PREPARATION_STAGES.DRAFT,
      FACILITATOR_PREPARATION_STAGES.DELIVERY,
    ),
    true,
  )
})

test('facilitator home no longer describes an approved lesson as pending review', () => {
  const decision = resolveFacilitatorHomeDecision({
    learners: [{ id: 'learner-1', approved_lessons: {} }],
    scheduledKeys: {},
    preparationSnapshot: {
      version: 1,
      stage: FACILITATOR_PREPARATION_STAGES.DELIVERY,
      learnerId: 'learner-1',
      lessonIdentity: { lessonKey: 'generated/fractions.json', file: 'fractions.json' },
    },
  })

  assert.equal(decision.label, 'Choose session option')
  assert.equal(decision.title, 'An approved lesson is waiting')
  assert.doesNotMatch(`${decision.label} ${decision.title}`, /delivery|review/i)
})

test('dashboard approved lesson count is educator approval, not learner-active availability', () => {
  const generatedLessons = [
    { file: 'approved-not-active.json', approved: true },
    { file: 'draft-active-elsewhere.json', approved: false },
    { file: 'missing-approval-flag.json' },
  ]
  const learners = [
    {
      id: 'learner-1',
      approved_lessons: {
        'generated/draft-active-elsewhere.json': true,
        'generated/another-active.json': true,
      },
    },
    {
      id: 'learner-2',
      approved_lessons: {
        'generated/another-active.json': true,
      },
    },
  ]

  assert.equal(countEducatorApprovedLessons(generatedLessons), 1)
  assert.equal(countLearnerActiveLessons(learners), 2)
})

test('review settings ownership does not use a hard facilitator_id OR query', () => {
  const source = fs.readFileSync(
    path.resolve('src', 'app', 'lib', 'masteryEvidence', 'followUps.server.js'),
    'utf8',
  )

  assert.doesNotMatch(source, /\.or\(`facilitator_id\.eq\.\$\{userId\},owner_id\.eq\.\$\{userId\},user_id\.eq\.\$\{userId\}`\)/)
  assert.match(source, /LEARNER_OWNER_COLUMNS = \['facilitator_id', 'owner_id', 'user_id'\]/)
  assert.match(source, /isUndefinedColumnOrTable/)
})

test('approval route confirms persisted approved state before returning success', () => {
  const source = fs.readFileSync(
    path.resolve('src', 'app', 'api', 'facilitator', 'lessons', 'approve', 'route.js'),
    'utf8',
  )

  assert.match(source, /confirmedLesson\?\.approved !== true/)
  assert.match(source, /approved: true/)
})

test('approval page renders lesson content review before the approve action', () => {
  const source = fs.readFileSync(
    path.resolve('src', 'app', 'facilitator', 'prepare', 'page.js'),
    'utf8',
  )
  const contentIndex = source.indexOf('<LessonContentReview lesson={lessonDraft} />')
  const buttonIndex = source.indexOf('Approve lesson content')

  assert.ok(contentIndex > 0)
  assert.ok(buttonIndex > 0)
  assert.ok(contentIndex < buttonIndex)
})

test('approval page keeps long lesson review scrollable above visible controls', () => {
  const source = fs.readFileSync(
    path.resolve('src', 'app', 'facilitator', 'prepare', 'page.js'),
    'utf8',
  )

  assert.match(source, /maxHeight: 'calc\(100vh - 120px\)'/)
  assert.match(source, /overflowY: 'auto'/)
  assert.match(source, /flexShrink: 0/)
})
