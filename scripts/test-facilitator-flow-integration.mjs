import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FACILITATOR_PREPARATION_STAGES,
  buildCanonicalLessonIdentity,
  buildLessonProposal,
  normalizeGenerationRequest,
  normalizePreparationSnapshot,
} from '../src/app/lib/facilitatorPreparation.mjs'
import { resolveFacilitatorHomeDecision } from '../src/app/lib/facilitatorHome.mjs'
import { resolveCalendarLandingParams } from '../src/app/lib/facilitatorCalendarLanding.mjs'
import { applyLessonAvailability } from '../src/app/lib/lessonAvailability.mjs'
import { normalizeLessonKey } from '../src/app/lib/lessonKeyNormalization.js'

test('standard facilitator flow keeps draft, approval, and availability separate', () => {
  const learner = { id: 'learner-1', name: 'Mia', grade: '4' }
  const intent = {
    version: 1,
    learnerId: learner.id,
    need: 'Needs help identifying the main idea in short reading passages.',
  }

  const proposalResult = buildLessonProposal({ intent, learner })
  assert.equal(proposalResult.ok, true)

  const generation = normalizeGenerationRequest({ mode: 'proposal', proposal: proposalResult.proposal })
  assert.equal(generation.ok, true)
  assert.equal(generation.request.subject, 'language arts')

  const identity = buildCanonicalLessonIdentity({ file: 'main-idea.json', ownerId: 'facilitator-1' })
  const draftSnapshot = normalizePreparationSnapshot({
    version: 1,
    stage: FACILITATOR_PREPARATION_STAGES.DRAFT,
    learnerId: learner.id,
    intent,
    proposal: proposalResult.proposal,
    lessonIdentity: identity,
  })
  assert.equal(draftSnapshot.stage, FACILITATOR_PREPARATION_STAGES.DRAFT)
  assert.equal(Object.keys(applyLessonAvailability({}, identity.lessonKey, false).approvedLessons).length, 0)

  const approvedSnapshot = normalizePreparationSnapshot({ ...draftSnapshot, stage: FACILITATOR_PREPARATION_STAGES.DELIVERY })
  assert.equal(approvedSnapshot.stage, FACILITATOR_PREPARATION_STAGES.DELIVERY)

  const availability = applyLessonAvailability({}, identity.lessonKey, true)
  assert.deepEqual(availability.approvedLessons, { 'generated/main-idea.json': true })
})

test('refresh recovery can schedule with the same normalized learner-facing lesson key', () => {
  const identity = buildCanonicalLessonIdentity({ file: 'fractions.json', ownerId: 'facilitator-1' })
  const recovered = normalizePreparationSnapshot({
    version: 1,
    stage: FACILITATOR_PREPARATION_STAGES.DELIVERY,
    learnerId: 'learner-1',
    lessonIdentity: identity,
    updatedAt: '2026-08-06T00:00:00.000Z',
  })

  const schedulePayload = {
    learnerId: recovered.learnerId,
    lessonKey: normalizeLessonKey(recovered.lessonIdentity.lessonKey),
    scheduledDate: '2026-08-07',
  }

  assert.deepEqual(schedulePayload, {
    learnerId: 'learner-1',
    lessonKey: 'generated/fractions.json',
    scheduledDate: '2026-08-07',
  })
})

test('Facilitator Home resolves snapshot-stage primary decision states', () => {
  const learner = { id: 'learner-1', name: 'Ada', approved_lessons: {} }
  const identity = buildCanonicalLessonIdentity({ file: 'draft.json', ownerId: 'facilitator-1' })
  assert.equal(resolveFacilitatorHomeDecision().kind, 'NO_LEARNER')
  assert.equal(resolveFacilitatorHomeDecision({
    learners: [learner],
    preparationSnapshot: { version: 1, stage: FACILITATOR_PREPARATION_STAGES.PROPOSAL, learnerId: learner.id, proposal: {} },
  }).kind, 'CONTINUE_PREPARING')
  assert.equal(resolveFacilitatorHomeDecision({
    learners: [learner],
    preparationSnapshot: { version: 1, stage: FACILITATOR_PREPARATION_STAGES.DRAFT, learnerId: learner.id, lessonIdentity: identity },
  }).kind, 'REVIEW_DRAFT')
  assert.equal(resolveFacilitatorHomeDecision({
    learners: [learner],
    preparationSnapshot: { version: 1, stage: FACILITATOR_PREPARATION_STAGES.DELIVERY, learnerId: learner.id, lessonIdentity: identity },
  }).kind, 'CHOOSE_DELIVERY')
  assert.equal(resolveFacilitatorHomeDecision({ learners: [learner] }).kind, 'PREPARE_NEXT')
  assert.equal(resolveFacilitatorHomeDecision({ learners: [{ ...learner, approved_lessons: { 'generated/ready.json': true } }] }).kind, 'PREPARE_AHEAD')
})

test('DELIVERY snapshot preserves selected learner with multiple learners', () => {
  const learners = [
    { id: 'learner-1', name: 'First', approved_lessons: {} },
    { id: 'learner-2', name: 'Second', approved_lessons: {} },
  ]
  const identity = buildCanonicalLessonIdentity({ file: 'second.json', ownerId: 'facilitator-1' })
  const decision = resolveFacilitatorHomeDecision({
    learners,
    preparationSnapshot: { version: 1, stage: FACILITATOR_PREPARATION_STAGES.DELIVERY, learnerId: 'learner-2', lessonIdentity: identity },
  })
  assert.equal(decision.kind, 'CHOOSE_DELIVERY')
  assert.match(decision.href, /learnerId=learner-2/)
  assert.doesNotMatch(decision.href, /learnerId=learner-1/)
})

test('generated lesson history does not hijack primary home decision without active snapshot', () => {
  const learner = { id: 'learner-1', name: 'Ada', approved_lessons: {} }
  assert.equal(resolveFacilitatorHomeDecision({
    learners: [learner],
    generatedLessons: [{ file: 'legacy.json' }],
  }).kind, 'PREPARE_NEXT')
})

test('unrelated generated draft does not replace active DELIVERY decision', () => {
  const learner = { id: 'learner-1', name: 'Ada', approved_lessons: {} }
  const identity = buildCanonicalLessonIdentity({ file: 'active.json', ownerId: 'facilitator-1' })
  const decision = resolveFacilitatorHomeDecision({
    learners: [learner],
    generatedLessons: [{ file: 'unrelated.json', approved: false }],
    preparationSnapshot: { version: 1, stage: FACILITATOR_PREPARATION_STAGES.DELIVERY, learnerId: learner.id, lessonIdentity: identity },
  })
  assert.equal(decision.kind, 'CHOOSE_DELIVERY')
  assert.match(decision.href, /active\.json/)
  assert.doesNotMatch(decision.href, /unrelated\.json/)
})

test('missing snapshot learner returns selection state instead of substituting another learner', () => {
  const identity = buildCanonicalLessonIdentity({ file: 'missing.json', ownerId: 'facilitator-1' })
  const decision = resolveFacilitatorHomeDecision({
    learners: [{ id: 'learner-1', name: 'First', approved_lessons: {} }],
    preparationSnapshot: { version: 1, stage: FACILITATOR_PREPARATION_STAGES.DELIVERY, learnerId: 'learner-2', lessonIdentity: identity },
  })
  assert.equal(decision.kind, 'SELECT_LEARNER')
  assert.match(decision.body, /no longer available/)
})

test('calendar query parameters select existing advanced calendar controls', () => {
  assert.deepEqual(resolveCalendarLandingParams('tab=planner'), { activeTab: 'planner', openPortfolio: false })
  assert.deepEqual(resolveCalendarLandingParams('tab=subjects'), { activeTab: 'subjects', openPortfolio: false })
  assert.deepEqual(resolveCalendarLandingParams('portfolio=1'), { activeTab: 'scheduler', openPortfolio: true })
  assert.deepEqual(resolveCalendarLandingParams('tab=not-real&portfolio=0'), { activeTab: 'scheduler', openPortfolio: false })
})