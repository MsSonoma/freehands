import test from 'node:test'
import assert from 'node:assert/strict'
import { ASSESSMENT_ROLES } from '../masteryEvidence/assessmentIsolation.js'
import {
  qualifyConversationalMasteryOpportunity,
} from '../masteryEvidence/mastery.js'
import {
  aggregateFacilitatorEvidenceSession,
  summarizeWebbConceptEvidence,
} from '../masteryEvidence/reporting.js'
import {
  RETENTION_REASONS,
  qualifyRetentionOpportunity,
  selectRetentionAnchor,
} from '../masteryEvidence/retention.js'
import { selectDailyFollowUpAnchors } from '../masteryEvidence/followUps.js'
import { assembleLearnerEssay } from '../webbLearningModel.mjs'
import { summarizeWebbMastery } from '../webbMasteryModel.mjs'

function webbEvent({ conceptId, outcome, coverage, comprehension, sequence }) {
  return {
    event_type: 'mastery_check_result',
    event_sequence: sequence,
    occurred_at: `2026-08-2${sequence}T12:00:00.000Z`,
    concept_id: conceptId,
    stable_item_id: `item-${conceptId}`,
    item_exposure_id: `exposure-${conceptId}`,
    assessment_role: ASSESSMENT_ROLES.CONVERSATIONAL_OPPORTUNITY,
    mastery_outcome: outcome,
    mastery_check_id: `check-${conceptId}`,
    mastery_protocol_version: 'independent-mastery-v1',
    payload: { qualification: { interaction_model: 'webb_conversation', webb_classification: {
      coverage, comprehension, mastery: outcome === 'independent_success' ? 'mastered' : 'pending', retention: 'not_measured',
    } } },
  }
}

test('shared conversational qualification preserves first-response and assistance semantics', () => {
  assert.equal(qualifyConversationalMasteryOpportunity({ hasStableConceptIdentity: true }).eligible, true)
  assert.equal(qualifyConversationalMasteryOpportunity({ hasStableConceptIdentity: true, answerRequested: true }).eligible, false)
  assert.equal(qualifyConversationalMasteryOpportunity({ hasStableConceptIdentity: true, answerReproduction: true }).independenceReason, 'clear_answer_reproduction')
  assert.equal(qualifyConversationalMasteryOpportunity({ hasStableConceptIdentity: true, isFirstResponse: false }).eligible, false)
})

test('facilitator reporting preserves mixed completed Webb concepts and proposes—not schedules—a revisit', () => {
  const events = [
    webbEvent({ conceptId: 'a', outcome: 'independent_success', coverage: 'covered', comprehension: 'demonstrated', sequence: 1 }),
    webbEvent({ conceptId: 'b', outcome: 'assisted_success', coverage: 'covered', comprehension: 'demonstrated', sequence: 2 }),
    webbEvent({ conceptId: 'c', outcome: 'unavailable', coverage: 'covered', comprehension: 'not_demonstrated', sequence: 3 }),
  ]
  const concepts = summarizeWebbConceptEvidence(events)
  assert.deepEqual(concepts.map(concept => concept.mastery), ['mastered', 'pending', 'pending'])
  const report = aggregateFacilitatorEvidenceSession({
    trackedSession: { id: 'session', lesson_id: 'lesson', ended_at: '2026-08-28T13:00:00Z' },
    evidenceSession: { session_id: 'session', lesson_key: 'lesson', mastery_protocol_version: 'independent-mastery-v1', retention_protocol_version: 'retention-v1', evidence_status: 'complete' },
    events,
  })
  assert.equal(report.session.completion_state, 'ended')
  assert.equal(report.concept_evidence.filter(concept => concept.mastery === 'pending').length, 2)
  assert.equal(report.options[0].kind, 'consider_future_independent_check')
  assert.equal(report.options[0].evidence_kind, 'proposed')
})

test('retention remains unavailable in-session and without qualifying delay even after Webb mastery', () => {
  const anchor = webbEvent({ conceptId: 'a', outcome: 'independent_success', coverage: 'covered', comprehension: 'demonstrated', sequence: 1 })
  anchor.session_id = 'same-session'
  assert.equal(selectRetentionAnchor({ anchors: [anchor], currentSessionId: 'same-session', now: '2026-08-30T12:00:00Z' }), null)
  const qualification = qualifyRetentionOpportunity({
    anchor,
    delaySeconds: 60,
    itemIdentity: { stableItemId: 'fresh-retention-item' },
    itemExposureId: 'retention-exposure',
  })
  assert.equal(qualification.eligible, false)
  assert.equal(qualification.retentionQualificationReason, RETENTION_REASONS.DELAY_TOO_SHORT)
})

test('essay completion remains independent of pending mastery', () => {
  const objectives = ['A', 'B']
  const summary = summarizeWebbMastery(objectives, {
    0: { coverage: 'covered', comprehension: 'demonstrated', mastery: 'mastered' },
    1: { coverage: 'covered', comprehension: 'demonstrated', mastery: 'pending' },
  })
  const essay = assembleLearnerEssay(objectives, {
    0: { text: 'First learner sentence.', provenance: 'learner-message' },
    1: { text: 'Second learner sentence.', provenance: 'learner-message' },
  })
  assert.equal(essay, 'First learner sentence. Second learner sentence.')
  assert.deepEqual(summary.masteryPending, ['B'])
})

test('only delayed independent Webb mastery becomes eligible for shared follow-up selection', () => {
  const mastered = webbEvent({ conceptId: 'mastered', outcome: 'independent_success', coverage: 'covered', comprehension: 'demonstrated', sequence: 1 })
  mastered.occurred_at = '2026-08-20T12:00:00.000Z'
  const assisted = webbEvent({ conceptId: 'assisted', outcome: 'assisted_success', coverage: 'covered', comprehension: 'demonstrated', sequence: 2 })
  assisted.occurred_at = '2026-08-20T12:01:00.000Z'

  const selected = selectDailyFollowUpAnchors({
    evidenceEvents: [mastered, assisted],
    now: '2026-08-28T12:00:00.000Z',
  })
  assert.deepEqual(selected.map(anchor => anchor.concept_id), ['mastered'])
})
