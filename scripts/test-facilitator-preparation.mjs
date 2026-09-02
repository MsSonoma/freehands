import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FACILITATOR_PREPARATION_STAGES,
  buildCanonicalLessonIdentity,
  buildLessonProposal,
  canTransitionPreparationStage,
  normalizeGenerationRequest,
  normalizePreparationSnapshot,
  validateLessonIntent,
} from '../src/app/lib/facilitatorPreparation.mjs'
import { applyLessonAvailability } from '../src/app/lib/lessonAvailability.mjs'

test('validates versioned lesson intent with optional boundaries', () => {
  const result = validateLessonIntent({
    version: 1,
    learnerId: 'learner-1',
    need: 'Needs help understanding fractions with simple examples.',
    sourceReferences: ['last worksheet', '', 'chapter 4'],
    boundaries: {
      pace: 'slow and steady',
      additionalPractice: true,
      includeWorksheet: false,
      includeTest: true,
      avoidTimedWork: true,
      parentNotes: 'Gets anxious when rushed.',
      ignored: 'nope',
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.intent.version, 1)
  assert.equal(result.intent.learnerId, 'learner-1')
  assert.deepEqual(result.intent.sourceReferences, ['last worksheet', 'chapter 4'])
  assert.deepEqual(result.intent.boundaries, {
    pace: 'slow and steady',
    parentNotes: 'Gets anxious when rushed.',
    additionalPractice: true,
    includeWorksheet: false,
    includeTest: true,
    avoidTimedWork: true,
  })
})

test('rejects missing learner, short need, and unsupported versions', () => {
  assert.equal(validateLessonIntent({ version: 2, learnerId: 'x', need: 'fractions today' }).ok, false)
  assert.equal(validateLessonIntent({ version: 1, learnerId: '', need: 'fractions today' }).ok, false)
  assert.equal(validateLessonIntent({ version: 1, learnerId: 'x', need: 'short' }).ok, false)
})

test('normalizes a proposal into existing generator fields', () => {
  const { ok, proposal } = buildLessonProposal({
    intent: { version: 1, learnerId: 'learner-1', need: 'Needs help with reading paragraphs and finding the main idea.', boundaries: { avoidTimedWork: true } },
    learner: { name: 'Mia', grade: '4' },
  })

  assert.equal(ok, true)
  assert.equal(proposal.learnerId, 'learner-1')
  assert.equal(proposal.generationSpec.grade, '4')
  assert.equal(proposal.generationSpec.subject, 'language arts')
  assert.equal(proposal.generationSpec.difficulty, 'intermediate')
  assert.match(proposal.summary, /Mia/)
  assert.match(proposal.generationSpec.notes, /Avoid timed-work pressure/)
})

test('proposal generation mode normalizes to structured generation request', () => {
  const proposal = buildLessonProposal({
    intent: { version: 1, learnerId: 'learner-1', need: 'Needs multiplication facts practice.' },
    learner: { name: 'Ari', grade: '3' },
  }).proposal

  const normalized = normalizeGenerationRequest({ mode: 'proposal', proposal })
  assert.equal(normalized.ok, true)
  assert.equal(normalized.request.subject, 'math')
  assert.equal(normalized.request.grade, '3')
})

test('builds canonical generated lesson identity', () => {
  assert.deepEqual(buildCanonicalLessonIdentity({ file: 'lesson.json', ownerId: 'user-1' }), {
    file: 'lesson.json',
    storagePath: 'facilitator-lessons/user-1/lesson.json',
    lessonKey: 'generated/lesson.json',
    ownerId: 'user-1',
  })
})

test('separates approval and availability state transitions', () => {
  assert.equal(canTransitionPreparationStage(FACILITATOR_PREPARATION_STAGES.DRAFT, FACILITATOR_PREPARATION_STAGES.APPROVED), true)
  assert.equal(canTransitionPreparationStage(FACILITATOR_PREPARATION_STAGES.APPROVED, FACILITATOR_PREPARATION_STAGES.COMPLETE), false)
  assert.equal(canTransitionPreparationStage(FACILITATOR_PREPARATION_STAGES.APPROVED, FACILITATOR_PREPARATION_STAGES.DELIVERY), true)
})

test('recovers only versioned explicit preparation snapshot state', () => {
  const snapshot = normalizePreparationSnapshot({
    version: 1,
    stage: 'DRAFT',
    learnerId: 'learner-1',
    intent: { version: 1, learnerId: 'learner-1', need: 'Needs place value practice.' },
    hiddenMemory: 'ignored',
    updatedAt: '2026-08-06T00:00:00.000Z',
  })

  assert.equal(snapshot.stage, FACILITATOR_PREPARATION_STAGES.DRAFT)
  assert.equal(snapshot.learnerId, 'learner-1')
  assert.equal(snapshot.hiddenMemory, undefined)
  assert.equal(normalizePreparationSnapshot({ version: 0 }), null)
})

test('applies availability idempotently with canonical lesson keys', () => {
  const first = applyLessonAvailability({}, 'facilitator-lessons/user-1/Fractions.json', true)
  assert.equal(first.ok, true)
  assert.deepEqual(first.approvedLessons, { 'generated/user-1/Fractions.json': true })

  const second = applyLessonAvailability(first.approvedLessons, 'generated/user-1/Fractions.json', true)
  assert.deepEqual(second.approvedLessons, first.approvedLessons)
})

test('removes available lessons without disturbing unrelated keys', () => {
  const result = applyLessonAvailability({
    'generated/Fractions.json': true,
    'math/Add.json': true,
  }, 'generated/Fractions.json', false)

  assert.equal(result.ok, true)
  assert.deepEqual(result.approvedLessons, { 'math/Add.json': true })
})