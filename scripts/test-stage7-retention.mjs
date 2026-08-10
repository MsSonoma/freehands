import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  ASSESSMENT_ROLES,
  buildInstructionalLessonView,
  getReservedAssessmentItems,
} from '../src/app/lib/masteryEvidence/assessmentIsolation.js'
import { getBaselineItems } from '../src/app/lib/masteryEvidence/baseline.js'
import { buildItemIdentity, buildLessonIdentity } from '../src/app/lib/masteryEvidence/identity.js'
import { MASTERY_OUTCOMES } from '../src/app/lib/masteryEvidence/mastery.js'
import {
  RETENTION_MIN_DELAY_SECONDS,
  RETENTION_OUTCOMES,
  RETENTION_PROTOCOL_VERSION,
  RETENTION_QUALIFICATION_STATUSES,
  RETENTION_REASONS,
  buildRetentionPlan,
  classifyRetentionOutcome,
  getRetentionItems,
  isRetentionDelayEligible,
  isValidRetentionAnchor,
  qualifyRetentionOpportunity,
  selectRetentionAnchor,
} from '../src/app/lib/masteryEvidence/retention.js'
import { STAGE_2_EVIDENCE_EVENT_TYPES } from '../src/app/lib/masteryEvidence/constants.js'

const sessionSource = readFileSync(new URL('../src/app/session/v2/SessionPageV2.jsx', import.meta.url), 'utf8')
const evidenceRouteSource = readFileSync(new URL('../src/app/api/evidence/route.js', import.meta.url), 'utf8')
const generatorSource = readFileSync(new URL('../src/app/api/facilitator/lessons/generate/route.js', import.meta.url), 'utf8')
const incrementalSource = readFileSync(new URL('../src/app/api/ai/lesson-generate/route.js', import.meta.url), 'utf8')
const isolationSource = readFileSync(new URL('../src/app/lib/masteryEvidence/assessmentIsolation.js', import.meta.url), 'utf8')
const masterySource = readFileSync(new URL('../src/app/lib/masteryEvidence/mastery.js', import.meta.url), 'utf8')
const closingSource = readFileSync(new URL('../src/app/session/v2/ClosingPhase.jsx', import.meta.url), 'utf8')

const anchor = {
  event_id: 'anchor-event-1',
  session_id: 'session-old',
  mastery_check_id: 'mastery-check:independent-mastery-v1:anchor',
  mastery_cycle_id: 'mastery-cycle:independent-mastery-v1:cycle',
  mastery_outcome: MASTERY_OUTCOMES.INDEPENDENT_SUCCESS,
  concept_id: 'concept:item-identity-v1:half',
  occurred_at: '2026-08-01T12:00:00.000Z',
}

const recoveryAnchor = {
  ...anchor,
  event_id: 'anchor-event-2',
  mastery_check_id: 'mastery-check:independent-mastery-v1:after-recovery',
  mastery_outcome: MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY,
}

const lesson = {
  id: 'stage7-fractions',
  title: 'Fractions',
  baseline: [
    { id: 'baseline-a', question: 'What is one half?', expectedAny: ['one of two equal parts'] },
  ],
  multiplechoice: [
    { id: 'practice-a', question: 'Which shows one half?', choices: ['1/2', '1/3', '1/4', '2/3'], correct: 0, expectedAny: ['1/2'] },
  ],
  worksheet: [
    { id: 'worksheet-a', question: 'Explain a numerator.', expectedAny: ['top number'] },
  ],
  test: [
    { id: 'reserved-a', question: 'Which fraction equals one half?', choices: ['1/2', '1/3', '1/4', '3/4'], correct: 0, expectedAny: ['1/2'], concept_id: 'half' },
    { id: 'reserved-b', question: 'Which fraction is also one half?', choices: ['2/4', '1/3', '1/5', '3/5'], correct: 0, expectedAny: ['2/4'], concept_id: 'half' },
  ],
  retention: [
    { id: 'retention-a', question: 'Which fraction means one out of two equal parts?', choices: ['1/2', '1/3', '1/4', '3/4'], correct: 0, expectedAny: ['1/2'], concept_id: 'half' },
    { id: 'retention-b', question: 'True or false: 3/6 can equal one half.', answer: true, expectedAny: ['true'], concept_id: 'half' },
  ],
}

async function retentionIdentity(index = 0) {
  return buildItemIdentity({
    lessonKey: 'generated/stage7.json',
    lessonId: lesson.id,
    lessonData: lesson,
    item: getRetentionItems(lesson)[index],
  })
}

test('delay boundary requires at least 24 hours and records exact later delay', () => {
  const tooEarly = isRetentionDelayEligible({
    anchorOccurredAt: '2026-08-01T12:00:00.000Z',
    now: '2026-08-02T11:59:00.000Z',
  })
  assert.equal(tooEarly.eligible, false)
  assert.equal(tooEarly.reason, RETENTION_REASONS.DELAY_TOO_SHORT)
  assert.equal(tooEarly.delaySeconds, RETENTION_MIN_DELAY_SECONDS - 60)

  const exact = isRetentionDelayEligible({
    anchorOccurredAt: '2026-08-01T12:00:00.000Z',
    now: '2026-08-02T12:00:00.000Z',
  })
  assert.equal(exact.eligible, true)
  assert.equal(exact.delaySeconds, RETENTION_MIN_DELAY_SECONDS)

  const later = isRetentionDelayEligible({
    anchorOccurredAt: '2026-08-01T12:00:00.000Z',
    now: '2026-08-15T12:00:30.000Z',
  })
  assert.equal(later.eligible, true)
  assert.equal(later.delaySeconds, (14 * 24 * 60 * 60) + 30)
})

test('valid anchors are Stage 6 independent success outcomes only and require a later session', () => {
  assert.equal(isValidRetentionAnchor(anchor), true)
  assert.equal(isValidRetentionAnchor(recoveryAnchor), true)
  for (const outcome of [
    MASTERY_OUTCOMES.ASSISTED_SUCCESS,
    MASTERY_OUTCOMES.NEEDS_RECOVERY,
    MASTERY_OUTCOMES.UNAVAILABLE,
  ]) {
    assert.equal(isValidRetentionAnchor({ ...anchor, mastery_outcome: outcome }), false)
  }

  const sameSession = selectRetentionAnchor({
    anchors: [anchor],
    now: '2026-08-02T12:01:00.000Z',
    currentSessionId: 'session-old',
  })
  assert.equal(sameSession, null)

  const laterSession = selectRetentionAnchor({
    anchors: [anchor],
    now: '2026-08-02T12:01:00.000Z',
    currentSessionId: 'session-new',
  })
  assert.equal(laterSession.anchor.mastery_check_id, anchor.mastery_check_id)
})

test('retention plan uses dedicated held-out pool and excludes baseline, Stage 6, instruction, and prior retention exposures', async () => {
  const phaseSets = {
    discussion: [],
    comprehension: lesson.multiplechoice,
    exercise: [],
    worksheet: lesson.worksheet,
    test: getReservedAssessmentItems(lesson),
  }
  const clean = await buildRetentionPlan({
    lessonKey: 'generated/stage7.json',
    lessonId: lesson.id,
    lessonData: lesson,
    phaseSets,
  })
  assert.equal(clean.status, RETENTION_QUALIFICATION_STATUSES.ELIGIBLE)
  assert.equal(clean.selectedItems.length, 1)
  assert.equal(clean.selectedItems[0].sourceRole, 'retention')

  const priorIdentity = await retentionIdentity(0)
  const filtered = await buildRetentionPlan({
    lessonKey: 'generated/stage7.json',
    lessonId: lesson.id,
    lessonData: lesson,
    phaseSets,
    priorExposedKeys: [`stable:${priorIdentity.stableItemId}`],
  })
  assert.equal(filtered.selectedItems[0].id, 'retention-b')

  const noPool = await buildRetentionPlan({ lessonData: { ...lesson, retention: [] }, phaseSets })
  assert.equal(noPool.status, RETENTION_QUALIFICATION_STATUSES.UNAVAILABLE)
  assert.equal(noPool.reason, RETENTION_REASONS.NO_RETENTION_POOL)

  const baselineOverlap = await buildRetentionPlan({
    lessonKey: 'generated/stage7.json',
    lessonId: lesson.id,
    lessonData: { ...lesson, retention: [lesson.baseline[0]] },
    phaseSets,
  })
  assert.equal(baselineOverlap.reason, RETENTION_REASONS.BASELINE_OVERLAP)

  const stage6Overlap = await buildRetentionPlan({
    lessonKey: 'generated/stage7.json',
    lessonId: lesson.id,
    lessonData: { ...lesson, retention: [lesson.test[0]] },
    phaseSets,
  })
  assert.equal(stage6Overlap.reason, RETENTION_REASONS.STAGE6_OVERLAP)
})

test('clean first retention response yields retained or needs_review and same-item retry cannot rewrite it', async () => {
  const identity = await retentionIdentity(0)
  const clean = qualifyRetentionOpportunity({
    anchor,
    delaySeconds: RETENTION_MIN_DELAY_SECONDS,
    itemIdentity: identity,
    itemExposureId: 'retention-q1',
    isFirstResponse: true,
  })
  assert.equal(clean.eligible, true)
  assert.equal(classifyRetentionOutcome({ qualification: clean, isCorrect: true }), RETENTION_OUTCOMES.RETAINED)
  assert.equal(classifyRetentionOutcome({ qualification: clean, isCorrect: false }), RETENTION_OUTCOMES.NEEDS_REVIEW)

  const retry = qualifyRetentionOpportunity({
    anchor,
    delaySeconds: RETENTION_MIN_DELAY_SECONDS,
    itemIdentity: identity,
    itemExposureId: 'retention-q1',
    isFirstResponse: false,
  })
  assert.equal(retry.eligible, false)
  assert.equal(retry.retentionQualificationReason, RETENTION_REASONS.NOT_FIRST_RESPONSE)
  assert.equal(classifyRetentionOutcome({ qualification: retry, isCorrect: true }), RETENTION_OUTCOMES.ASSISTED_REVIEW)
})

test('hint, Ask, reveal, and generated visual aid before response disqualify clean retention; Repeat/TTS does not', async () => {
  const identity = await retentionIdentity(0)
  const cases = [
    STAGE_2_EVIDENCE_EVENT_TYPES.HINT_GIVEN,
    STAGE_2_EVIDENCE_EVENT_TYPES.ASK_USED,
    STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_REVEALED,
    STAGE_2_EVIDENCE_EVENT_TYPES.VISUAL_AID_USED,
  ]
  for (const eventType of cases) {
    const q = qualifyRetentionOpportunity({
      anchor,
      delaySeconds: RETENTION_MIN_DELAY_SECONDS,
      itemIdentity: identity,
      itemExposureId: 'retention-q1',
      assistanceEventsBeforeResponse: [{ eventType }],
    })
    assert.equal(q.eligible, false)
    assert.equal(q.retentionQualificationReason, RETENTION_REASONS.ASSISTANCE_BEFORE_RESPONSE)
  }

  const repeat = qualifyRetentionOpportunity({
    anchor,
    delaySeconds: RETENTION_MIN_DELAY_SECONDS,
    itemIdentity: identity,
    itemExposureId: 'retention-q1',
    assistanceEventsBeforeResponse: [{ eventType: STAGE_2_EVIDENCE_EVENT_TYPES.REPEAT_USED }],
  })
  assert.equal(repeat.eligible, true)
})

test('prior same-learner exposure and intervening same-target instruction contaminate retention, while unrelated target can remain clean', async () => {
  const identity = await retentionIdentity(0)
  const prior = qualifyRetentionOpportunity({
    anchor,
    delaySeconds: RETENTION_MIN_DELAY_SECONDS,
    itemIdentity: identity,
    itemExposureId: 'retention-q1',
    priorExposedKeys: [`stable:${identity.stableItemId}`],
  })
  assert.equal(prior.retentionQualificationReason, RETENTION_REASONS.PRIOR_EXPOSURE)

  const intervening = qualifyRetentionOpportunity({
    anchor,
    delaySeconds: RETENTION_MIN_DELAY_SECONDS,
    itemIdentity: identity,
    itemExposureId: 'retention-q1',
    interveningSameTargetInstruction: true,
  })
  assert.equal(intervening.retentionQualificationReason, RETENTION_REASONS.INTERVENING_SAME_TARGET_INSTRUCTION)

  const unrelated = qualifyRetentionOpportunity({
    anchor,
    delaySeconds: RETENTION_MIN_DELAY_SECONDS,
    itemIdentity: identity,
    itemExposureId: 'retention-q1',
    interveningSameTargetInstruction: false,
  })
  assert.equal(unrelated.eligible, true)
})

test('pre-threshold revisit does not consume anchor; later new Stage 6 success can become fresh anchor', () => {
  const early = selectRetentionAnchor({
    anchors: [anchor],
    now: '2026-08-02T00:00:00.000Z',
    currentSessionId: 'session-new',
  })
  assert.equal(early, null)

  const oldConsumed = selectRetentionAnchor({
    anchors: [anchor, { ...anchor, mastery_check_id: 'new-anchor', occurred_at: '2026-08-02T01:00:00.000Z' }],
    consumedAnchorIds: [anchor.mastery_check_id],
    now: '2026-08-03T02:00:00.000Z',
    currentSessionId: 'session-later',
  })
  assert.equal(oldConsumed.anchor.mastery_check_id, 'new-anchor')
})

test('retention pool participates in lesson identity and is excluded from instructional projection', async () => {
  assert.equal(getBaselineItems(lesson).length, 1)
  assert.equal(getRetentionItems(lesson).length, 2)
  const view = buildInstructionalLessonView(lesson)
  const serialized = JSON.stringify(view)
  assert.equal(serialized.includes('retention-a'), false)
  assert.equal(serialized.includes('Which fraction means one out of two equal parts?'), false)

  const original = await buildLessonIdentity({ lessonKey: 'generated/stage7.json', lessonData: lesson })
  const changed = await buildLessonIdentity({
    lessonKey: 'generated/stage7.json',
    lessonData: {
      ...lesson,
      retention: [{ ...lesson.retention[0], question: 'Changed retention item?' }],
    },
  })
  assert.notEqual(original.lessonContentHash, changed.lessonContentHash)
})

test('Session V2 wires retention before baseline/instruction and preserves resume, Start Over, timeline, and legacy behavior', () => {
  const retentionActivation = sessionSource.indexOf('await activateRetention(retentionPlanCandidate, eligibility, savedRetention)')
  const baselineActivation = sessionSource.indexOf('await activateBaseline(plan, null, savedBaseline)')
  assert.ok(retentionActivation > -1)
  assert.ok(baselineActivation > -1)
  assert.ok(retentionActivation < baselineActivation)
  assert.ok(sessionSource.includes("if (target && target !== 'idle')"))
  assert.ok(sessionSource.includes("hasInstructionBegunFromSnapshot(snapshot)"))
  assert.ok(sessionSource.includes("retentionState === 'awaiting-response'"))
  assert.ok(sessionSource.includes('TIMELINE_JUMP'))
  assert.ok(sessionSource.includes('QUESTION_SET_REFRESHED'))
  assert.ok(sessionSource.includes('retentionPlanRef.current = null'))
})

test('API and client use server-readable history, anchor consumption, exact delay, and retention result metadata', () => {
  assert.ok(evidenceRouteSource.includes('check_retention_eligibility'))
  assert.ok(evidenceRouteSource.includes('RETENTION_MIN_DELAY_SECONDS'))
  assert.ok(evidenceRouteSource.includes('retention_anchor_mastery_check_id'))
  assert.ok(evidenceRouteSource.includes('retention_delay_seconds'))
  assert.ok(evidenceRouteSource.includes('retention_outcome'))
  assert.ok(evidenceRouteSource.includes('INTERVENING_SAME_TARGET_INSTRUCTION') || evidenceRouteSource.includes('interveningSameTargetInstruction'))
})

test('payload isolation and Stage 6/7 pool separation are source-enforced', () => {
  assert.ok(isolationSource.includes("'retention'"))
  assert.ok(masterySource.includes('buildInstructionalLessonView(lessonData)'))
  assert.equal(masterySource.includes('retentionPool'), false)
  assert.equal(JSON.stringify(getReservedAssessmentItems(lesson)).includes('retention-a'), false)
})

test('lesson generation creates persisted retention substrate separate from baseline and Stage 6 Test', () => {
  assert.ok(generatorSource.includes('"retention"'))
  assert.ok(generatorSource.includes('exactly 2 delayed-retention-reserved questions'))
  assert.ok(incrementalSource.includes("'retention'"))
  assert.ok(incrementalSource.includes('delayed-retention-reserved questions'))
})

test('evidence API failure, legacy lessons, and insufficient pools are nonblocking/unavailable, not fake retained outcomes', async () => {
  const legacyPlan = await buildRetentionPlan({ lessonData: { id: 'legacy', title: 'Legacy' }, phaseSets: {} })
  assert.equal(legacyPlan.status, RETENTION_QUALIFICATION_STATUSES.UNAVAILABLE)
  assert.equal(legacyPlan.reason, RETENTION_REASONS.NO_RETENTION_POOL)
  assert.ok(sessionSource.includes('continue with the existing pre-instruction path'))
  assert.equal(sessionSource.includes('retentionOutcome = RETENTION_OUTCOMES.RETAINED'), false)
})

test('Closing stays positive without false retained/mastery language', () => {
  assert.equal(/retained|retention|master(ed|y)/i.test(closingSource), false)
  assert.ok(/Great work|Nice job|Excellent work|Way to go/.test(closingSource))
})

test('protocol and observable-practice boundary are explicit in source constants', () => {
  assert.equal(RETENTION_PROTOCOL_VERSION, 'retention-v1')
  assert.equal(RETENTION_MIN_DELAY_SECONDS, 86400)
})
