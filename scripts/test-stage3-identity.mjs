import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildItemIdentity,
  buildLessonIdentity,
  buildTeachingProtocolIdentity,
  deriveConceptId,
  hashCanonicalValue,
  ITEM_IDENTITY_VERSION,
  LESSON_IDENTITY_VERSION,
  MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
  TEACHING_PROTOCOL_DESCRIPTOR,
  TEACHING_PROTOCOL_VERSION,
} from '../src/app/lib/masteryEvidence/identity.js'
import { createLegacyItemFingerprint } from '../src/app/lib/masteryEvidence/items.js'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

test('lesson identity is deterministic and ignores non-content metadata', async () => {
  const first = await buildLessonIdentity({
    lessonKey: 'math/fractions.json',
    lessonData: {
      title: ' Fractions ',
      grade: '4',
      updated_at: '2026-08-01T00:00:00.000Z',
      worksheet: [{ question: ' 2 + 2 = ___ ', answer: '4' }],
      analyticsOnly: { should: 'not affect identity' },
    },
  })
  const second = await buildLessonIdentity({
    lessonKey: 'math/fractions',
    lessonData: {
      worksheet: [{ answer: '4', question: '2 + 2 = ___' }],
      grade: '4',
      title: 'Fractions',
      updated_at: '2026-08-09T00:00:00.000Z',
    },
  })

  assert.equal(first.identitySchemaVersion, MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION)
  assert.equal(first.lessonIdentityVersion, LESSON_IDENTITY_VERSION)
  assert.equal(first.stableLessonKey, 'math/fractions')
  assert.equal(first.stableLessonKey, second.stableLessonKey)
  assert.equal(first.lessonContentHash, second.lessonContentHash)
  assert.equal(first.lessonVersionId, second.lessonVersionId)
  assert.match(first.lessonVersionId, uuidPattern)
})

test('lesson content changes create a new deterministic lesson version id', async () => {
  const before = await buildLessonIdentity({
    lessonKey: 'math/fractions',
    lessonData: { title: 'Fractions', worksheet: [{ question: '2 + 2 = ___', answer: '4' }] },
  })
  const after = await buildLessonIdentity({
    lessonKey: 'math/fractions',
    lessonData: { title: 'Fractions', worksheet: [{ question: '2 + 3 = ___', answer: '5' }] },
  })

  assert.equal(before.stableLessonKey, after.stableLessonKey)
  assert.notEqual(before.lessonContentHash, after.lessonContentHash)
  assert.notEqual(before.lessonVersionId, after.lessonVersionId)
})

test('teaching protocol identity is deterministic and behavior-scoped', async () => {
  const first = await buildTeachingProtocolIdentity()
  const second = await buildTeachingProtocolIdentity()
  const changedDescriptorHash = await hashCanonicalValue({
    identity_schema_version: MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
    descriptor: {
      ...TEACHING_PROTOCOL_DESCRIPTOR,
      normal_path: [...TEACHING_PROTOCOL_DESCRIPTOR.normal_path, 'future_stage'],
    },
  })

  assert.equal(first.protocolVersion, TEACHING_PROTOCOL_VERSION)
  assert.equal(first.protocolVersion, second.protocolVersion)
  assert.equal(first.protocolHash, second.protocolHash)
  assert.notEqual(first.protocolHash, changedDescriptorHash)
})

test('stable item identity survives repeated exposures and excludes runtime position', async () => {
  const lessonData = {
    title: 'Fractions',
    worksheet: [{ id: 'w1', type: 'fib', question: '2 + 2 = ___', answer: '4' }],
  }
  const sourceItem = { id: 'w1', type: 'fib', question: '2 + 2 = ___', answer: '4', number: 1 }
  const repeatedItem = { id: 'w1', type: 'fib', question: '2 + 2 = ___', answer: '4', number: 9 }
  const first = await buildItemIdentity({ lessonKey: 'math/fractions', lessonData, item: sourceItem })
  const second = await buildItemIdentity({ lessonKey: 'math/fractions', lessonData, item: repeatedItem })

  assert.equal(first.itemIdentityVersion, ITEM_IDENTITY_VERSION)
  assert.equal(first.stableItemId, second.stableItemId)
  assert.equal(first.itemContentHash, second.itemContentHash)
  assert.notEqual('worksheet-run1-q1-legacy', 'worksheet-run2-q1-legacy')
  assert.match(first.stableItemId, /^item:item-identity-v1:[0-9a-f]{64}$/)
})

test('item content changes update content identity without depending on learner state', async () => {
  const original = await buildItemIdentity({
    lessonKey: 'math/fractions',
    item: { id: 'w1', type: 'fib', question: '2 + 2 = ___', answer: '4' },
  })
  const revised = await buildItemIdentity({
    lessonKey: 'math/fractions',
    item: { id: 'w1', type: 'fib', question: '2 + 3 = ___', answer: '5' },
  })

  assert.equal(original.stableItemId, revised.stableItemId)
  assert.notEqual(original.itemContentHash, revised.itemContentHash)
})

test('concept identity is source-backed only', () => {
  assert.equal(
    deriveConceptId({ objectiveId: ' Webb Level 2: compare fractions ' }),
    'concept:item-identity-v1:webb-level-2:-compare-fractions',
  )
  assert.equal(deriveConceptId({ question: 'What is a numerator?' }), null)
})

test('legacy item fingerprint remains available beside Stage 3 item identity', async () => {
  const item = { id: 'w1', type: 'fib', question: '2 + 2 = ___', answer: '4' }
  const legacy = createLegacyItemFingerprint({
    lessonKey: 'math/fractions',
    phase: 'worksheet',
    item,
    questionIndex: 0,
  })
  const stage3 = await buildItemIdentity({ lessonKey: 'math/fractions', item })

  assert.match(legacy, /^legacy:[0-9a-f]{8}$/)
  assert.match(stage3.stableItemId, /^item:item-identity-v1:[0-9a-f]{64}$/)
  assert.notEqual(stage3.stableItemId, legacy)
})

test('same lesson and item identity can span distinct evidence sessions', async () => {
  const lesson = { title: 'Fractions', worksheet: [{ id: 'w1', question: '2 + 2 = ___', answer: '4' }] }
  const item = lesson.worksheet[0]
  const sessionA = {
    evidenceSessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    itemExposureId: 'worksheet-run1-q1-aaa',
  }
  const sessionB = {
    evidenceSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    itemExposureId: 'worksheet-run1-q1-bbb',
  }

  const lessonA = await buildLessonIdentity({ lessonKey: 'math/fractions', lessonData: lesson })
  const lessonB = await buildLessonIdentity({ lessonKey: 'math/fractions', lessonData: lesson })
  const itemA = await buildItemIdentity({ lessonKey: 'math/fractions', lessonData: lesson, item })
  const itemB = await buildItemIdentity({ lessonKey: 'math/fractions', lessonData: lesson, item })

  assert.notEqual(sessionA.evidenceSessionId, sessionB.evidenceSessionId)
  assert.notEqual(sessionA.itemExposureId, sessionB.itemExposureId)
  assert.equal(lessonA.lessonVersionId, lessonB.lessonVersionId)
  assert.equal(lessonA.lessonContentHash, lessonB.lessonContentHash)
  assert.equal(itemA.stableItemId, itemB.stableItemId)
  assert.equal(itemA.itemContentHash, itemB.itemContentHash)
})
