import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  ASSESSMENT_ISOLATION_STATUSES,
  ASSESSMENT_ROLES,
  analyzeAssessmentIsolation,
  getReservedAssessmentItems,
} from '../src/app/lib/masteryEvidence/assessmentIsolation.js'
import { buildItemIdentity } from '../src/app/lib/masteryEvidence/identity.js'
import {
  INDEPENDENCE_REASONS,
  INDEPENDENCE_STATUSES,
  MASTERY_CHECK_ROLES,
  MASTERY_OUTCOMES,
  buildMasteryEligibilityContext,
  buildRecoveryTeachingPayload,
  classifyMasteryOutcome,
  qualifyMasteryOpportunity,
  selectRecoveryVerificationItem,
} from '../src/app/lib/masteryEvidence/mastery.js'
import { STAGE_2_EVIDENCE_EVENT_TYPES } from '../src/app/lib/masteryEvidence/constants.js'

const sessionSource = readFileSync(new URL('../src/app/session/v2/SessionPageV2.jsx', import.meta.url), 'utf8')
const clientSource = readFileSync(new URL('../src/app/lib/masteryEvidence/client.js', import.meta.url), 'utf8')
const evidenceRouteSource = readFileSync(new URL('../src/app/api/evidence/route.js', import.meta.url), 'utf8')
const masterySource = readFileSync(new URL('../src/app/lib/masteryEvidence/mastery.js', import.meta.url), 'utf8')
const generatorSource = readFileSync(new URL('../src/app/api/facilitator/lessons/generate/route.js', import.meta.url), 'utf8')
const incrementalSource = readFileSync(new URL('../src/app/api/ai/lesson-generate/route.js', import.meta.url), 'utf8')
const closingSource = readFileSync(new URL('../src/app/session/v2/ClosingPhase.jsx', import.meta.url), 'utf8')

const lesson = {
  id: 'stage6-fractions',
  title: 'Fractions',
  baseline: [
    { id: 'baseline-a', question: 'What is one half?', expectedAny: ['one of two equal parts'] },
  ],
  multiplechoice: [
    { id: 'practice-a', question: 'Which shows one half?', choices: ['1/2', '1/3', '1/4', '2/3'], correct: 0, expectedAny: ['1/2'] },
  ],
  shortanswer: [
    { id: 'practice-b', question: 'Explain a numerator.', expectedAny: ['top number'] },
  ],
  test: [
    { id: 'reserved-a', question: 'Which fraction equals one half?', choices: ['1/2', '1/3', '1/4', '3/4'], correct: 0, expectedAny: ['1/2'], concept_id: 'half' },
    { id: 'reserved-b', question: 'Which fraction is also one half?', choices: ['2/4', '1/3', '1/5', '3/5'], correct: 0, expectedAny: ['2/4'], concept_id: 'half' },
    { id: 'reserved-c', question: 'What does denominator mean?', expectedAny: ['total equal parts'], concept_id: 'denominator' },
  ],
}

async function testContext(overrides = {}) {
  const phaseSets = {
    discussion: [],
    comprehension: lesson.multiplechoice,
    exercise: [],
    worksheet: lesson.shortanswer,
    test: getReservedAssessmentItems(lesson),
  }
  const isolation = await analyzeAssessmentIsolation({
    lessonKey: 'generated/stage6.json',
    lessonId: lesson.id,
    lessonData: lesson,
    phaseSets,
  })
  const identity = await buildItemIdentity({
    lessonKey: 'generated/stage6.json',
    lessonId: lesson.id,
    lessonData: lesson,
    item: getReservedAssessmentItems(lesson)[0],
  })
  const eligibility = await buildMasteryEligibilityContext({
    lessonKey: 'generated/stage6.json',
    lessonId: lesson.id,
    lessonData: lesson,
    phaseSets,
    priorExposedKeys: overrides.priorExposedKeys || [],
  })
  return { phaseSets, isolation, identity, eligibility }
}

function qualify({ identity, isolation, eligibility, events = [], first = true, role = ASSESSMENT_ROLES.ASSESSMENT_RESERVED, exposureId = 'test-run1-q1' }) {
  return qualifyMasteryOpportunity({
    itemIdentity: identity,
    assessmentRole: role,
    assessmentIsolationStatus: isolation.status,
    itemExposureId: exposureId,
    isFirstResponse: first,
    priorExposedKeys: eligibility.priorExposedKeys,
    baselineIdentityKeys: eligibility.baselineIdentityKeys,
    instructionalExposureKeys: eligibility.instructionalExposureKeys,
    assistanceEventsBeforeResponse: events,
  })
}

test('clean held-out first response can produce independent success and clean failure needs recovery', async () => {
  const { isolation, identity, eligibility } = await testContext()
  assert.equal(isolation.status, ASSESSMENT_ISOLATION_STATUSES.ISOLATED)

  const clean = qualify({ identity, isolation, eligibility })
  assert.equal(clean.eligible, true)
  assert.equal(clean.independenceStatus, INDEPENDENCE_STATUSES.INDEPENDENT)
  assert.equal(classifyMasteryOutcome({ qualification: clean, isCorrect: true }), MASTERY_OUTCOMES.INDEPENDENT_SUCCESS)
  assert.equal(classifyMasteryOutcome({ qualification: clean, isCorrect: false }), MASTERY_OUTCOMES.NEEDS_RECOVERY)
})

test('same-item retry cannot become independent mastery', async () => {
  const { isolation, identity, eligibility } = await testContext()
  const retry = qualify({ identity, isolation, eligibility, first: false })
  assert.equal(retry.eligible, false)
  assert.equal(retry.independenceReason, INDEPENDENCE_REASONS.NOT_FIRST_RESPONSE)
  assert.equal(classifyMasteryOutcome({ qualification: retry, isCorrect: true }), MASTERY_OUTCOMES.ASSISTED_SUCCESS)
})

test('hint, Ask, answer reveal, and generated visual aid before first response disqualify independence', async () => {
  const { isolation, identity, eligibility } = await testContext()
  const cases = [
    [STAGE_2_EVIDENCE_EVENT_TYPES.HINT_GIVEN, INDEPENDENCE_REASONS.HINT_BEFORE_RESPONSE],
    [STAGE_2_EVIDENCE_EVENT_TYPES.ASK_USED, INDEPENDENCE_REASONS.ASK_ASSISTANCE_BEFORE_RESPONSE],
    [STAGE_2_EVIDENCE_EVENT_TYPES.ANSWER_REVEALED, INDEPENDENCE_REASONS.ANSWER_REVEAL_BEFORE_RESPONSE],
    [STAGE_2_EVIDENCE_EVENT_TYPES.VISUAL_AID_USED, INDEPENDENCE_REASONS.VISUAL_ASSISTANCE_BEFORE_RESPONSE],
  ]
  for (const [eventType, reason] of cases) {
    const q = qualify({ identity, isolation, eligibility, events: [{ eventType }] })
    assert.equal(q.eligible, false)
    assert.equal(q.independenceReason, reason)
  }
})

test('verbatim Repeat and normal TTS do not disqualify an otherwise clean response', async () => {
  const { isolation, identity, eligibility } = await testContext()
  const q = qualify({
    identity,
    isolation,
    eligibility,
    events: [{ eventType: STAGE_2_EVIDENCE_EVENT_TYPES.REPEAT_USED }],
  })
  assert.equal(q.eligible, true)
  assert.equal(q.independenceReason, INDEPENDENCE_REASONS.ELIGIBLE)
})

test('prior exposure, baseline overlap, instructional exposure, and Stage 4 isolation failure prevent independent evidence', async () => {
  const { isolation, identity, eligibility } = await testContext({ priorExposedKeys: [`stable:${(await testContext()).identity.stableItemId}`] })
  const prior = qualify({ identity, isolation, eligibility })
  assert.equal(prior.eligible, false)
  assert.equal(prior.independenceReason, INDEPENDENCE_REASONS.PRIOR_EXPOSURE)

  const baselineIdentity = await buildItemIdentity({ lessonKey: 'generated/stage6.json', lessonId: lesson.id, lessonData: lesson, item: lesson.baseline[0] })
  const baseline = qualifyMasteryOpportunity({
    itemIdentity: baselineIdentity,
    assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
    assessmentIsolationStatus: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
    itemExposureId: 'test-run1-q2',
    baselineIdentityKeys: [`stable:${baselineIdentity.stableItemId}`],
  })
  assert.equal(baseline.independenceReason, INDEPENDENCE_REASONS.BASELINE_OVERLAP)

  const practiceIdentity = await buildItemIdentity({ lessonKey: 'generated/stage6.json', lessonId: lesson.id, lessonData: lesson, item: lesson.multiplechoice[0] })
  const instructional = qualifyMasteryOpportunity({
    itemIdentity: practiceIdentity,
    assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
    assessmentIsolationStatus: ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
    itemExposureId: 'test-run1-q3',
    instructionalExposureKeys: [`stable:${practiceIdentity.stableItemId}`],
  })
  assert.equal(instructional.independenceReason, INDEPENDENCE_REASONS.INSTRUCTIONAL_EXPOSURE)

  const notIsolated = qualifyMasteryOpportunity({
    itemIdentity: identity,
    assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
    assessmentIsolationStatus: ASSESSMENT_ISOLATION_STATUSES.UNAVAILABLE,
    itemExposureId: 'test-run1-q1',
  })
  assert.equal(notIsolated.independenceReason, INDEPENDENCE_REASONS.ISOLATION_NOT_TRUSTWORTHY)
})

test('recovery verification uses a distinct clean item and records after-recovery success or continued recovery need', async () => {
  const reserved = getReservedAssessmentItems(lesson)
  const identities = []
  for (const item of reserved) {
    identities.push(await buildItemIdentity({ lessonKey: 'generated/stage6.json', lessonId: lesson.id, lessonData: lesson, item }))
  }
  const failed = identities[0]
  const used = new Set([`stable:${failed.stableItemId}`, `content:${failed.itemContentHash}`])
  const next = selectRecoveryVerificationItem({
    failedItemIdentity: failed,
    candidateItems: reserved,
    candidateIdentities: identities,
    alreadyUsedIdentityKeys: used,
  })
  assert.equal(next.index, 1)
  assert.notEqual(next.identity.stableItemId, failed.stableItemId)

  const clean = { eligible: true, independenceStatus: INDEPENDENCE_STATUSES.INDEPENDENT, independenceReason: INDEPENDENCE_REASONS.ELIGIBLE }
  assert.equal(
    classifyMasteryOutcome({ qualification: clean, isCorrect: true, checkRole: MASTERY_CHECK_ROLES.RECOVERY_VERIFICATION }),
    MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY,
  )
  assert.equal(
    classifyMasteryOutcome({ qualification: clean, isCorrect: false, checkRole: MASTERY_CHECK_ROLES.RECOVERY_VERIFICATION }),
    MASTERY_OUTCOMES.NEEDS_RECOVERY,
  )

  const insufficient = selectRecoveryVerificationItem({
    failedItemIdentity: failed,
    candidateItems: [reserved[0]],
    candidateIdentities: [identities[0]],
    alreadyUsedIdentityKeys: used,
  })
  assert.equal(insufficient, null)
})

test('recovery teaching payload includes failed item A and excludes future verification item B', () => {
  const payload = buildRecoveryTeachingPayload({
    lessonData: lesson,
    failedItem: lesson.test[0],
    learnerResponse: '1/3',
    correctAnswer: '1/2',
  })
  const serialized = JSON.stringify(payload)
  assert.ok(serialized.includes('Which fraction equals one half?'))
  assert.ok(serialized.includes('1/3'))
  assert.ok(serialized.includes('1/2'))
  assert.equal(serialized.includes('Which fraction is also one half?'), false)
  assert.equal(serialized.includes('2/4'), false)
})

test('Stage 6 is wired as append-only evidence, not a score or medal interpretation', () => {
  assert.ok(clientSource.includes('recordMasteryCheckResult'))
  assert.ok(clientSource.includes('MASTERY_CHECK_RESULT'))
  assert.ok(evidenceRouteSource.includes('mastery_protocol_version'))
  assert.ok(evidenceRouteSource.includes('mastery_outcome'))
  assert.ok(sessionSource.includes("recordMasteryCheckResult('test', data)"))
  assert.equal(sessionSource.includes('testGrade.percentage') && sessionSource.includes('masteryOutcome = testGrade'), false)
})

test('runtime preserves help access and records disqualifying assistance without hiding Repeat/TTS', () => {
  assert.ok(sessionSource.includes('addMasteryAssistanceForItem(itemContext'))
  assert.ok(sessionSource.includes('VISUAL_AID_USED'))
  assert.ok(sessionSource.includes('ASK_USED'))
  assert.ok(sessionSource.includes('ANSWER_REVEALED'))
  assert.ok(sessionSource.includes('REPEAT_USED'))
  assert.ok(sessionSource.includes('audioEngineRef.current.replay()'))
})

test('resume, Start Over, timeline jump, refresh, and legacy lessons do not manufacture fresh mastery evidence', () => {
  assert.ok(sessionSource.includes('snapshot?.phaseData?.test'))
  assert.ok(sessionSource.includes('masteryEligibilityRef.current = null'))
  assert.ok(sessionSource.includes('TIMELINE_JUMP'))
  assert.ok(sessionSource.includes('QUESTION_SET_REFRESHED'))
  assert.ok(sessionSource.includes('assessmentIsolationRef.current = null'))
  assert.ok(sessionSource.includes('getReservedAssessmentItems(lessonData)'))
  assert.ok(masterySource.includes('assessment_isolation_not_trustworthy'))
})

test('generated lessons persist deeper reserved Test pools at generation time', () => {
  assert.ok(generatorSource.includes('"test"'))
  assert.ok(generatorSource.includes('at least 6 reserved held-out Test questions'))
  assert.ok(generatorSource.includes('reserved-test-6'))
  assert.ok(incrementalSource.includes("'test'"))
  assert.ok(incrementalSource.includes('reserved held-out Test questions'))
})

test('Closing remains positive without false mastery language', () => {
  assert.equal(/master(ed|y)/i.test(closingSource), false)
  assert.ok(/Great work|Nice job|Excellent work|Way to go/.test(closingSource))
})
