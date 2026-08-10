import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  ASSESSMENT_ISOLATION_STATUSES,
  analyzeAssessmentIsolation,
  buildInstructionalLessonView,
} from '../src/app/lib/masteryEvidence/assessmentIsolation.js'
import { buildLessonIdentity } from '../src/app/lib/masteryEvidence/identity.js'
import {
  BASELINE_EVIDENCE_PURPOSE,
  BASELINE_PROTOCOL_VERSION,
  BASELINE_STATUSES,
  BASELINE_UNAVAILABLE_REASONS,
  buildBaselinePlan,
  getBaselineItems,
  hasInstructionBegunFromSnapshot,
} from '../src/app/lib/masteryEvidence/baseline.js'
import { MasteryEvidenceClient } from '../src/app/lib/masteryEvidence/client.js'
import {
  MASTERY_EVIDENCE_STATUSES,
  STAGE_2_EVIDENCE_EVENT_TYPES,
} from '../src/app/lib/masteryEvidence/constants.js'

const lesson = Object.freeze({
  id: 'stage5-demo',
  title: 'Stage 5 Demo',
  subject: 'math',
  grade: '4',
  baseline: [
    { id: 'baseline-a', question: 'BASELINE_A: What does one half mean?', expectedAny: ['one of two equal parts', 'half'] },
    { id: 'baseline-b', question: 'BASELINE_B: What does the denominator show?', expectedAny: ['total equal parts', 'number of parts'] },
  ],
  sample: [
    { id: 'practice-b', question: 'INSTRUCTION_B: Practice one fourth.', expectedAny: ['1/4'] },
  ],
  test: [
    { id: 'reserved-c', question: 'RESERVED_C: Explain equivalent fractions.', expectedAny: ['same value'] },
  ],
})

function source(path) {
  return fs.readFileSync(path, 'utf8')
}

test('baseline pool is explicit, durable, and excluded from instructional projection', () => {
  const items = getBaselineItems(lesson)
  assert.equal(items.length, 2)
  assert.equal(items.every((item) => item.evidence_purpose === BASELINE_EVIDENCE_PURPOSE), true)

  const instructionalView = buildInstructionalLessonView(lesson)
  const serialized = JSON.stringify(instructionalView)
  assert.equal(serialized.includes('BASELINE_A'), false)
  assert.equal(serialized.includes('BASELINE_B'), false)
  assert.equal(serialized.includes('RESERVED_C'), false)
  assert.equal(serialized.includes('INSTRUCTION_B'), true)
})

test('baseline pool changes participate in deterministic lesson version identity', async () => {
  const first = await buildLessonIdentity({
    lessonKey: 'generated/stage5',
    lessonId: 'stage5-demo',
    lessonData: lesson,
  })
  const changedBaseline = await buildLessonIdentity({
    lessonKey: 'generated/stage5',
    lessonId: 'stage5-demo',
    lessonData: {
      ...lesson,
      baseline: [
        ...lesson.baseline.slice(0, 1),
        { id: 'baseline-b', question: 'BASELINE_B_CHANGED: What is a numerator?', expectedAny: ['top number'] },
      ],
    },
  })
  assert.notEqual(first.lessonContentHash, changedBaseline.lessonContentHash)
  assert.notEqual(first.lessonVersionId, changedBaseline.lessonVersionId)
})

test('baseline identities must not overlap instruction or reserved Test identities', async () => {
  const isolated = await buildBaselinePlan({
    lessonKey: 'generated/stage5',
    lessonId: 'stage5-demo',
    lessonData: lesson,
    phaseSets: {
      exercise: lesson.sample,
      worksheet: [],
      test: lesson.test,
    },
  })
  assert.equal(isolated.status, 'available')
  assert.equal(isolated.selectedItems.length, 2)

  const overlapsInstruction = await buildBaselinePlan({
    lessonKey: 'generated/stage5',
    lessonId: 'stage5-demo',
    lessonData: {
      ...lesson,
      baseline: [lesson.sample[0]],
    },
    phaseSets: {
      exercise: lesson.sample,
      worksheet: [],
      test: lesson.test,
    },
  })
  assert.equal(overlapsInstruction.status, BASELINE_STATUSES.UNAVAILABLE)
  assert.equal(overlapsInstruction.reason, BASELINE_UNAVAILABLE_REASONS.DETERMINISTIC_OVERLAP)

  const overlapsReserved = await buildBaselinePlan({
    lessonKey: 'generated/stage5',
    lessonId: 'stage5-demo',
    lessonData: {
      ...lesson,
      baseline: [lesson.test[0]],
    },
    phaseSets: {
      exercise: lesson.sample,
      worksheet: [],
      test: lesson.test,
    },
  })
  assert.equal(overlapsReserved.status, BASELINE_STATUSES.UNAVAILABLE)
  assert.equal(overlapsReserved.reason, BASELINE_UNAVAILABLE_REASONS.DETERMINISTIC_OVERLAP)

  const stage4 = await analyzeAssessmentIsolation({
    lessonKey: 'generated/stage5',
    lessonId: 'stage5-demo',
    lessonData: lesson,
    phaseSets: { exercise: lesson.sample, test: lesson.test },
  })
  assert.equal(stage4.status, ASSESSMENT_ISOLATION_STATUSES.ISOLATED)
})

test('prior exposure removes same-learner cold baseline eligibility but leaves alternate items', async () => {
  const first = await buildBaselinePlan({
    lessonKey: 'generated/stage5',
    lessonId: 'stage5-demo',
    lessonData: lesson,
    phaseSets: { exercise: lesson.sample, test: lesson.test },
  })
  const exposedKeys = [
    `stable:${first.candidateIdentities[0].stableItemId}`,
    `content:${first.candidateIdentities[0].itemContentHash}`,
  ]
  const filtered = await buildBaselinePlan({
    lessonKey: 'generated/stage5',
    lessonId: 'stage5-demo',
    lessonData: lesson,
    phaseSets: { exercise: lesson.sample, test: lesson.test },
    priorExposedKeys: exposedKeys,
  })
  assert.equal(filtered.selectedItems.length, 1)
  assert.equal(filtered.selectedItems[0].id, 'baseline-b')

  const exhausted = await buildBaselinePlan({
    lessonKey: 'generated/stage5',
    lessonId: 'stage5-demo',
    lessonData: lesson,
    phaseSets: { exercise: lesson.sample, test: lesson.test },
    priorExposedKeys: first.candidateIdentities.flatMap((identity) => [
      `stable:${identity.stableItemId}`,
      `content:${identity.itemContentHash}`,
    ]),
  })
  assert.equal(exhausted.status, BASELINE_STATUSES.UNAVAILABLE)
  assert.equal(exhausted.reason, BASELINE_UNAVAILABLE_REASONS.PRIOR_EXPOSURE)
})

test('baseline event chain records one first response without mastery semantics', async () => {
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
          evidence_session: { id: 'evidence-session-stage5', evidence_status: MASTERY_EVIDENCE_STATUSES.PARTIAL },
        })
      }
      if (body.action === 'record_event') return Response.json({ ok: true, duplicate: false })
      if (body.action === 'update_baseline_status') return Response.json({ ok: true, evidence_session: { baseline_status: body.baseline_status } })
      return Response.json({ ok: true, exposed_keys: [] })
    },
  })
  const baselineItem = lesson.baseline[0]

  client.initialize({
    sessionId: 'session-stage5',
    learnerId: '22222222-2222-2222-2222-222222222222',
    lessonKey: 'generated/stage5',
    lessonData: lesson,
    baseline: { protocolVersion: BASELINE_PROTOCOL_VERSION },
    startedAt: '2026-08-09T12:00:00.000Z',
  })
  await client.recordItemPresented({
    phase: 'idle',
    itemPurpose: BASELINE_EVIDENCE_PURPOSE,
    itemExposureId: 'baseline-run1-q1',
    identityItem: baselineItem,
    evidencePurpose: BASELINE_EVIDENCE_PURPOSE,
    questionIndex: 0,
    totalQuestions: 2,
  })
  await client.recordLearnerResponse({
    phase: 'idle',
    itemPurpose: BASELINE_EVIDENCE_PURPOSE,
    itemExposureId: 'baseline-run1-q1',
    identityItem: baselineItem,
    evidencePurpose: BASELINE_EVIDENCE_PURPOSE,
    attemptNumber: 1,
    isFirstResponse: true,
    response: "I don't know",
  })
  await client.recordAnswerEvaluated({
    phase: 'idle',
    itemPurpose: BASELINE_EVIDENCE_PURPOSE,
    itemExposureId: 'baseline-run1-q1',
    identityItem: baselineItem,
    evidencePurpose: BASELINE_EVIDENCE_PURPOSE,
    attemptNumber: 1,
    isFirstResponse: true,
    isCorrect: false,
    evaluationMode: 'baseline_v1_current_app_judgment',
    response: "I don't know",
    correctAnswer: 'one of two equal parts',
  })
  await client.updateBaselineStatus({
    baselineStatus: BASELINE_STATUSES.COMPLETE,
    baselineItemCount: 1,
  })

  const events = posted.filter((body) => body.action === 'record_event')
  assert.deepEqual(events.map((event) => event.event_type), [
    STAGE_2_EVIDENCE_EVENT_TYPES.ITEM_PRESENTED,
    STAGE_2_EVIDENCE_EVENT_TYPES.LEARNER_RESPONSE,
    STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_EVALUATED,
  ])
  assert.equal(events.every((event) => event.evidence_purpose === BASELINE_EVIDENCE_PURPOSE), true)
  assert.equal(events[1].attempt_number, 1)
  assert.equal(events[1].is_first_response, true)
  assert.equal(events[2].result.correct, false)
  assert.equal(JSON.stringify(posted).includes('mastered'), false)
  assert.equal(JSON.stringify(posted).includes('retention'), false)
})

test('Session V2 baseline ordering prevents teaching before baseline response', () => {
  const session = source('src/app/session/v2/SessionPageV2.jsx')
  const baselineActivation = session.indexOf('await activateBaseline(plan, null, savedBaseline)')
  const beginInstruction = session.indexOf('await beginInstruction(null)')
  const submitHandler = session.indexOf('const handleBaselineSubmit')
  const completion = session.indexOf('completeBaselineAndBeginInstruction', submitHandler)
  const prefetch = session.indexOf('teachingControllerRef.current.prefetchAll()')

  assert.ok(baselineActivation > -1)
  assert.ok(beginInstruction > -1)
  assert.ok(submitHandler > -1)
  assert.ok(completion > submitHandler)
  assert.ok(prefetch > -1)
  assert.ok(session.includes("if (baselineState === 'awaiting-response') return null"))
  assert.ok(session.includes('recordLearnerResponse'))
  assert.ok(session.includes('recordAnswerEvaluated'))
  assert.equal(session.includes('baseline_result'), false)
})

test('baseline source and incremental generation are explicit and projected away from instructional prompts', () => {
  const generator = source('src/app/api/facilitator/lessons/generate/route.js')
  const incremental = source('src/app/api/ai/lesson-generate/route.js')
  const session = source('src/app/session/v2/SessionPageV2.jsx')

  assert.ok(generator.includes('"baseline"'))
  assert.ok(generator.includes('exactly 2 short, low-pressure pre-instruction questions'))
  assert.ok(incremental.includes("'baseline'"))
  assert.ok(incremental.includes('buildInstructionalLessonView(lesson)'))
  assert.ok(session.includes('BASELINE_UNAVAILABLE_REASONS.RESUME_AFTER_INSTRUCTION'))
  assert.ok(session.includes('hasInstructionBegunFromSnapshot(snapshot)'))
  assert.ok(session.includes('checkPriorExposure'))
})

test('snapshot semantics distinguish baseline resume from instruction already begun', () => {
  assert.equal(hasInstructionBegunFromSnapshot({
    currentPhase: BASELINE_EVIDENCE_PURPOSE,
    completedPhases: [],
    phaseData: { baseline: { responses: [{ response: 'half' }] } },
  }), false)
  assert.equal(hasInstructionBegunFromSnapshot({
    currentPhase: 'discussion',
    completedPhases: [],
  }), true)
  assert.equal(hasInstructionBegunFromSnapshot({
    currentPhase: 'idle',
    completedPhases: ['exercise'],
  }), true)
})

test('legacy lesson without baseline pool remains baseline-unavailable without blocking instruction', async () => {
  const plan = await buildBaselinePlan({
    lessonKey: 'math/legacy',
    lessonId: 'legacy',
    lessonData: { title: 'Legacy', sample: lesson.sample },
    phaseSets: { exercise: lesson.sample },
  })
  assert.equal(plan.status, BASELINE_STATUSES.UNAVAILABLE)
  assert.equal(plan.reason, BASELINE_UNAVAILABLE_REASONS.NO_BASELINE_POOL)

  const session = source('src/app/session/v2/SessionPageV2.jsx')
  assert.ok(session.includes('await beginInstruction(null)'))
  assert.ok(session.includes('plan.reason || BASELINE_UNAVAILABLE_REASONS.NO_BASELINE_POOL'))
})
