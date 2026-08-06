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

test('Facilitator Home resolves the required primary decision states', () => {
  const learner = { id: 'learner-1', name: 'Ada', approved_lessons: {} }
  assert.equal(resolveFacilitatorHomeDecision().kind, 'NO_LEARNER')
  assert.equal(resolveFacilitatorHomeDecision({
    learners: [learner],
    preparationSnapshot: { version: 1, stage: FACILITATOR_PREPARATION_STAGES.PROPOSAL, learnerId: learner.id, proposal: {} },
  }).kind, 'CONTINUE_PREPARING')
  assert.equal(resolveFacilitatorHomeDecision({ learners: [learner], generatedLessons: [{ file: 'draft.json', approved: false }] }).kind, 'REVIEW_DRAFT')
  assert.equal(resolveFacilitatorHomeDecision({ learners: [learner], generatedLessons: [{ file: 'approved.json', approved: true }] }).kind, 'CHOOSE_DELIVERY')
  assert.equal(resolveFacilitatorHomeDecision({ learners: [learner] }).kind, 'PREPARE_NEXT')
  assert.equal(resolveFacilitatorHomeDecision({ learners: [{ ...learner, approved_lessons: { 'generated/ready.json': true } }] }).kind, 'PREPARE_AHEAD')
})