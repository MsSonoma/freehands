import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LIBRARY_PRIMARY_ACTIONS,
  LIBRARY_LESSON_STATES,
  buildPreparationActionHref,
  primaryActionCount,
  resolveInitialLibraryLearner,
  resolveLibraryLessonState,
} from '../src/app/lib/facilitatorLessonLibraryState.mjs'

const base = {
  lesson: { isGenerated: true, file: 'fractions.json', approved: false },
  lessonKey: 'generated/fractions.json',
  learnerId: 'learner-2',
}

test('generated unapproved draft resolves to Review lesson with DRAFT handoff', () => {
  const state = resolveLibraryLessonState(base)
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.DRAFT)
  assert.equal(state.label, 'Draft - needs your review')
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.REVIEW)
  assert.equal(state.preparationStage, 'DRAFT')
  assert.equal(state.href, '/facilitator/prepare?learnerId=learner-2&lessonKey=generated%2Ffractions.json&stage=DRAFT')
  assert.equal(primaryActionCount(state), 1)
})

test('approved undelivered lesson resolves to Choose delivery with DELIVERY handoff', () => {
  const state = resolveLibraryLessonState({ ...base, lesson: { ...base.lesson, approved: true } })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.APPROVED)
  assert.equal(state.label, 'Approved - choose delivery')
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.DELIVERY)
  assert.equal(state.preparationStage, 'DELIVERY')
  assert.equal(state.href, '/facilitator/prepare?learnerId=learner-2&lessonKey=generated%2Ffractions.json&stage=DELIVERY')
  assert.equal(primaryActionCount(state), 1)
})

test('available lesson suppresses publication actions', () => {
  const state = resolveLibraryLessonState({ ...base, availableLessons: { 'generated/fractions.json': true } })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.AVAILABLE)
  assert.equal(state.label, 'Available now')
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.NONE)
  assert.equal(primaryActionCount(state), 0)
})

test('lesson scheduled today suppresses publication actions', () => {
  const state = resolveLibraryLessonState({ ...base, scheduledToday: { 'generated/fractions.json': true } })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.SCHEDULED_TODAY)
  assert.equal(state.label, 'Scheduled for today')
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.NONE)
})

test('lesson scheduled in the future uses a parent-facing date label', () => {
  const state = resolveLibraryLessonState({
    ...base,
    futureScheduledLessons: { 'generated/fractions.json': '2026-08-12' },
    dateFormatter: (date) => `Scheduled for ${date}`,
  })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.SCHEDULED_FUTURE)
  assert.equal(state.label, 'Scheduled for 2026-08-12')
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.NONE)
})

test('in-progress lesson suppresses publication actions', () => {
  const state = resolveLibraryLessonState({ ...base, inProgressLessons: { 'generated/fractions.json': '2026-08-06T12:00:00Z' } })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.IN_PROGRESS)
  assert.equal(state.label, 'In progress')
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.NONE)
})

test('completed lesson suppresses publication actions', () => {
  const state = resolveLibraryLessonState({ ...base, completedLessons: { 'generated/fractions.json': '2026-08-06T12:00:00Z' } })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.COMPLETED)
  assert.equal(state.label, 'Completed')
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.NONE)
})

test('downloadable unowned lesson keeps Download as the only primary action', () => {
  const state = resolveLibraryLessonState({
    lesson: { title: 'Rivers', file: 'rivers.json' },
    lessonKey: 'science/rivers.json',
    isDownloadableNotOwned: true,
  })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.DOWNLOADABLE)
  assert.equal(state.label, 'Available to download')
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.DOWNLOAD)
  assert.equal(primaryActionCount(state), 1)
})

test('owned lesson without selected learner does not expose preparation actions', () => {
  const state = resolveLibraryLessonState({ ...base, learnerId: '' })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.SELECT_LEARNER)
  assert.equal(state.label, 'Choose a learner')
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.NONE)
  assert.equal(state.href, null)
  assert.equal(primaryActionCount(state), 0)
})

test('historical generated lesson without explicit approval evidence is not treated as active draft', () => {
  const state = resolveLibraryLessonState({ ...base, lesson: { isGenerated: true, file: 'old.json' }, lessonKey: 'generated/old.json' })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.SAVED)
  assert.equal(state.label, 'Saved lesson')
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.NONE)
})

test('conflicting learner evidence follows documented precedence', () => {
  const state = resolveLibraryLessonState({
    ...base,
    lesson: { ...base.lesson, approved: true },
    availableLessons: { 'generated/fractions.json': true },
    scheduledToday: { 'generated/fractions.json': true },
    futureScheduledLessons: { 'generated/fractions.json': '2026-08-12' },
    inProgressLessons: { 'generated/fractions.json': '2026-08-06T10:00:00Z' },
    completedLessons: { 'generated/fractions.json': '2026-08-06T11:00:00Z' },
  })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.COMPLETED)
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.NONE)
})

test('each learner-state collision follows the resolver precedence independently', () => {
  const collisions = [
    {
      label: 'completed beats available',
      evidence: {
        completedLessons: { 'generated/fractions.json': '2026-08-06T11:00:00Z' },
        availableLessons: { 'generated/fractions.json': true },
      },
      expected: LIBRARY_LESSON_STATES.COMPLETED,
    },
    {
      label: 'in progress beats available',
      evidence: {
        inProgressLessons: { 'generated/fractions.json': '2026-08-06T10:00:00Z' },
        availableLessons: { 'generated/fractions.json': true },
      },
      expected: LIBRARY_LESSON_STATES.IN_PROGRESS,
    },
    {
      label: 'scheduled today beats available',
      evidence: {
        scheduledToday: { 'generated/fractions.json': true },
        availableLessons: { 'generated/fractions.json': true },
      },
      expected: LIBRARY_LESSON_STATES.SCHEDULED_TODAY,
    },
    {
      label: 'scheduled future beats available',
      evidence: {
        futureScheduledLessons: { 'generated/fractions.json': '2026-08-12' },
        availableLessons: { 'generated/fractions.json': true },
      },
      expected: LIBRARY_LESSON_STATES.SCHEDULED_FUTURE,
    },
    {
      label: 'available beats approved delivery',
      evidence: {
        lesson: { ...base.lesson, approved: true },
        availableLessons: { 'generated/fractions.json': true },
      },
      expected: LIBRARY_LESSON_STATES.AVAILABLE,
    },
  ]

  for (const collision of collisions) {
    const state = resolveLibraryLessonState({ ...base, ...collision.evidence })
    assert.equal(state.stateKey, collision.expected, collision.label)
    assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.NONE, collision.label)
    assert.equal(state.href, null, collision.label)
  }
})

test('downloadable ownership state beats every learner delivery and outcome state', () => {
  const state = resolveLibraryLessonState({
    ...base,
    isDownloadableNotOwned: true,
    availableLessons: { 'generated/fractions.json': true },
    scheduledToday: { 'generated/fractions.json': true },
    inProgressLessons: { 'generated/fractions.json': true },
    completedLessons: { 'generated/fractions.json': true },
  })
  assert.equal(state.stateKey, LIBRARY_LESSON_STATES.DOWNLOADABLE)
  assert.equal(state.primaryActionType, LIBRARY_PRIMARY_ACTIONS.DOWNLOAD)
  assert.equal(state.href, null)
})

test('legacy general generated key resolves to the same availability state as canonical key', () => {
  const canonical = resolveLibraryLessonState({
    ...base,
    availableLessons: { 'generated/fractions.json': true },
  })
  const legacy = resolveLibraryLessonState({
    ...base,
    availableLessons: { 'general/fractions.json': true },
  })
  assert.equal(canonical.stateKey, LIBRARY_LESSON_STATES.AVAILABLE)
  assert.equal(legacy.stateKey, canonical.stateKey)
  assert.equal(legacy.primaryActionType, canonical.primaryActionType)
  assert.equal(legacy.lessonKey, canonical.lessonKey)
})

test('initial library learner selection is automatic only for exactly one learner', () => {
  assert.equal(resolveInitialLibraryLearner([{ id: 'one' }])?.id, 'one')
  assert.equal(resolveInitialLibraryLearner([]), null)
  assert.equal(resolveInitialLibraryLearner([{ id: 'one' }, { id: 'two' }]), null)
})

test('preparation href carries canonical learner and lesson identity', () => {
  assert.equal(
    buildPreparationActionHref({ learnerId: 'learner-2', lessonKey: 'facilitator-lessons/user/Fractions.json', stage: 'DELIVERY' }),
    '/facilitator/prepare?learnerId=learner-2&lessonKey=generated%2Fuser%2FFractions.json&stage=DELIVERY'
  )
})
