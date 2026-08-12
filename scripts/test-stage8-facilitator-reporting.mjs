import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { GET } from '../src/app/api/facilitator/learners/[id]/evidence/route.js';
import {
  FACILITATOR_EVIDENCE_REPORT_VERSION,
  aggregateFacilitatorEvidenceSession,
  decodeReportCursor,
  encodeReportCursor,
  formatRetentionDelay,
  isSessionBeforeCursor,
} from '../src/app/lib/masteryEvidence/reporting.js';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LEARNER_A = '11111111-1111-4111-8111-111111111111';
const LEARNER_B = '22222222-2222-4222-8222-222222222222';
const TRACKED_1 = '33333333-3333-4333-8333-333333333331';
const TRACKED_2 = '33333333-3333-4333-8333-333333333332';
const EVIDENCE_1 = '44444444-4444-4444-8444-444444444441';
const EVIDENCE_2 = '44444444-4444-4444-8444-444444444442';

function tracked(overrides = {}) {
  return {
    id: TRACKED_1,
    session_id: 'browser-session-1',
    learner_id: LEARNER_A,
    lesson_id: 'generated/fractions.json',
    started_at: '2026-08-01T12:00:00.000Z',
    ended_at: '2026-08-01T12:30:00.000Z',
    ...overrides,
  };
}

function evidenceSession(overrides = {}) {
  return {
    id: EVIDENCE_1,
    schema_version: 'mastery-evidence-v1',
    session_id: TRACKED_1,
    browser_session_id: 'browser-session-1',
    facilitator_id: USER_A,
    learner_id: LEARNER_A,
    lesson_key: 'generated/fractions.json',
    stable_lesson_key: 'generated/fractions.json',
    lesson_id: 'fractions',
    lesson_identity_version: 'lesson-identity-v1',
    lesson_version_id: '55555555-5555-4555-8555-555555555555',
    teaching_protocol_version: 'session-v2-conversational-v1',
    assessment_isolation_version: 'assessment-isolation-v1',
    baseline_protocol_version: 'baseline-v1',
    baseline_status: 'complete',
    baseline_item_count: 1,
    mastery_protocol_version: 'independent-mastery-v1',
    retention_protocol_version: 'retention-v1',
    evidence_status: 'complete',
    started_at: '2026-08-01T12:00:00.000Z',
    ended_at: '2026-08-01T12:30:00.000Z',
    ...overrides,
  };
}

function event(eventType, overrides = {}) {
  return {
    event_id: `event-${Math.random()}`,
    event_type: eventType,
    evidence_session_id: EVIDENCE_1,
    session_id: TRACKED_1,
    facilitator_id: USER_A,
    learner_id: LEARNER_A,
    occurred_at: '2026-08-01T12:05:00.000Z',
    event_sequence: 1,
    phase: 'test',
    stable_item_id: 'item:one',
    item_content_hash: 'sha256:one',
    item_exposure_id: 'exposure:one',
    concept_id: 'fractions-half',
    result: null,
    payload: null,
    ...overrides,
  };
}

function baselineEvaluation(correct, overrides = {}) {
  return event('answer_evaluated', {
    phase: 'idle',
    evidence_purpose: 'baseline',
    is_first_response: true,
    result: { correct },
    ...overrides,
  });
}

function masteryResult(outcome, overrides = {}) {
  const correct = ['independent_success', 'independent_success_after_recovery', 'assisted_success'].includes(outcome);
  return event('mastery_check_result', {
    mastery_protocol_version: 'independent-mastery-v1',
    mastery_check_id: `mastery:${outcome}`,
    mastery_check_role: outcome === 'independent_success_after_recovery' ? 'recovery_verification' : 'initial',
    mastery_outcome: outcome,
    independence_status: outcome === 'assisted_success' ? 'hint' : 'independent',
    independence_reason: outcome === 'assisted_success' ? 'hint_before_first_response' : 'eligible',
    is_first_response: true,
    result: { correct },
    ...overrides,
  });
}

function retentionResult(outcome, delaySeconds = 259200, overrides = {}) {
  return event('retention_check_result', {
    occurred_at: '2026-08-04T12:00:00.000Z',
    retention_protocol_version: 'retention-v1',
    retention_check_id: `retention:${outcome}`,
    retention_anchor_mastery_check_id: 'mastery:independent_success',
    retention_delay_seconds: delaySeconds,
    retention_qualification_status: outcome === 'assisted_review' ? 'assisted' : 'eligible',
    retention_qualification_reason: outcome === 'assisted_review' ? 'assistance_before_first_response' : 'eligible',
    retention_outcome: outcome,
    independence_status: outcome === 'assisted_review' ? 'hint' : 'independent',
    result: { correct: outcome === 'retained' || outcome === 'assisted_review' },
    ...overrides,
  });
}

function report(events = [], sessionOverrides = {}) {
  return aggregateFacilitatorEvidenceSession({
    trackedSession: tracked(),
    evidenceSession: evidenceSession(sessionOverrides),
    events,
  });
}

test('baseline correct reports prior knowledge without causal learning attribution', () => {
  const summary = report([
    baselineEvaluation(true),
    masteryResult('independent_success', { event_sequence: 2 }),
  ]);
  assert.equal(summary.report_version, FACILITATOR_EVIDENCE_REPORT_VERSION);
  assert.equal(summary.baseline.state, 'demonstrated');
  assert.equal(summary.baseline.label, 'Prior knowledge observed');
  assert.equal(summary.independent_evidence.state, 'independent_success');
  assert.match(summary.interpretations[0].label, /before instruction and again/i);
  assert.doesNotMatch(JSON.stringify(summary), /Ms\. Sonoma (taught|caused)|learned during/i);
});
test('baseline incorrect plus independent success infers improvement without claiming cause', () => {
  const summary = report([
    baselineEvaluation(false),
    masteryResult('independent_success', { event_sequence: 2 }),
  ]);
  assert.equal(summary.baseline.state, 'not_demonstrated');
  assert.equal(summary.interpretations[0].kind, 'performance_improved');
  assert.match(summary.interpretations[0].label, /improved between the baseline/i);
  assert.doesNotMatch(JSON.stringify(summary), /caused the learning|taught this successfully/i);
});

test('baseline incomplete and unavailable remain distinct from difficulty', () => {
  const incomplete = report([], { baseline_status: 'partial', baseline_item_count: 2 });
  assert.equal(incomplete.baseline.state, 'incomplete');
  assert.equal(incomplete.baseline.label, 'Baseline incomplete');

  const unavailable = report([], {
    baseline_status: 'unavailable',
    baseline_unavailable_reason: 'prior_exposure',
  });
  assert.equal(unavailable.baseline.state, 'unavailable');
  assert.match(unavailable.baseline.detail, /already been shown/i);
  assert.doesNotMatch(unavailable.baseline.detail, /did not know|failed/i);
});

test('independent outcomes keep immediate, recovery, assisted, needs-recovery, and unavailable semantics separate', () => {
  const immediate = report([baselineEvaluation(false), masteryResult('independent_success', { event_sequence: 2 })]);
  assert.equal(immediate.independent_evidence.label, 'Demonstrated independently');

  const recovered = report([
    baselineEvaluation(false),
    masteryResult('needs_recovery', { event_sequence: 2, mastery_check_id: 'mastery:first' }),
    masteryResult('independent_success_after_recovery', { event_sequence: 3, mastery_check_id: 'mastery:fresh' }),
  ]);
  assert.equal(recovered.independent_evidence.state, 'independent_success_after_recovery');
  assert.equal(recovered.independent_evidence.recovery_chain.length, 3);
  assert.match(recovered.interpretations.map((item) => item.label).join(' '), /required recovery/i);

  const assisted = report([masteryResult('assisted_success')]);
  assert.equal(assisted.independent_evidence.label, 'Correct with assistance');

  const needsRecovery = report([masteryResult('needs_recovery')]);
  assert.equal(needsRecovery.independent_evidence.label, 'Independent demonstration not yet established');
  assert.doesNotMatch(needsRecovery.independent_evidence.detail, /failed mastery|forever/i);

  const unavailable = report([masteryResult('unavailable', { independence_status: 'unavailable', independence_reason: 'prior_exposure' })]);
  assert.equal(unavailable.independent_evidence.state, 'unavailable');
  assert.match(unavailable.independent_evidence.detail, /earlier session/i);
});

test('assistance timeline excludes Repeat from dependency and preserves it as an accessibility action', () => {
  const summary = report([
    event('hint_given', { assistance_level: 'hinted' }),
    event('ask_used', { event_sequence: 2, assistance_level: 'reteach_or_scaffolded' }),
    event('answer_revealed', { event_sequence: 3, assistance_level: 'answer_revealed' }),
    event('visual_aid_used', { event_sequence: 4 }),
    event('repeat_used', { event_sequence: 5, payload: { repeat_mode: 'verbatim_baseline_item' } }),
  ]);
  assert.deepEqual(summary.assistance.events.map((item) => item.label), [
    'Hint used',
    'Asked for help',
    'Answer revealed',
    'Visual aid used',
  ]);
  assert.equal(summary.assistance.accessibility_actions.length, 1);
  assert.equal(summary.assistance.accessibility_actions[0].classification, 'accessibility_or_control');
});

test('retained result formats exact three-day delay without permanent language', () => {
  const summary = report([
    masteryResult('independent_success'),
    retentionResult('retained', 259200, { event_sequence: 2 }),
  ]);
  assert.equal(formatRetentionDelay(259200), '3 days');
  assert.equal(summary.retention.label, 'Retained after 3 days');
  assert.equal(summary.retention.delay_seconds, 259200);
  assert.ok(summary.retention.prior_independent_evidence);
  assert.doesNotMatch(JSON.stringify(summary.retention), /permanent|forever|guaranteed/i);
});

test('retention failure keeps the earlier independent anchor visible', () => {
  const summary = report([retentionResult('needs_review')]);
  assert.equal(summary.retention.state, 'needs_review');
  assert.equal(summary.retention.label, 'Review recommended after 3 days');
  assert.equal(summary.retention.prior_independent_evidence.state, 'observed');
  assert.equal(summary.retention.prior_independent_evidence.mastery_check_id, 'mastery:independent_success');
  assert.doesNotMatch(summary.retention.detail, /lost mastery|forgot everything/i);
});

test('assisted retention, not-yet-measured, and unavailable retention remain distinct', () => {
  const assisted = report([retentionResult('assisted_review')]);
  assert.equal(assisted.retention.label, 'Retention not independently established');

  const notMeasured = report([masteryResult('independent_success')]);
  assert.equal(notMeasured.retention.state, 'not_measured');
  assert.match(notMeasured.retention.detail, /No future check is implied or scheduled/i);

  const unavailable = report([retentionResult('unavailable', 86340, {
    retention_qualification_status: 'unavailable',
    retention_qualification_reason: 'delay_too_short',
  })]);
  assert.equal(unavailable.retention.state, 'unavailable');
  assert.equal(unavailable.retention.delay_seconds, 86340);
  assert.match(unavailable.retention.detail, /did not meet/i);
});

test('100 percent score remains separate from assisted evidence', () => {
  const summary = report([
    masteryResult('assisted_success'),
    event('session_ended', {
      event_sequence: 2,
      phase: 'complete',
      payload: { test_percentage: 100, secret_token: 'must-not-leak' },
    }),
  ]);
  assert.equal(summary.score.value, 100);
  assert.equal(summary.score.label, 'Test score');
  assert.equal(summary.independent_evidence.state, 'assisted_success');
  assert.doesNotMatch(JSON.stringify(summary), /mastery.{0,10}100%|secret_token/i);
});

test('timeline jump is neutral context and prevents a false mastery fallback', () => {
  const summary = report([
    event('timeline_jump', {
      phase: 'discussion',
      payload: { from_phase: 'discussion', target_phase: 'test' },
    }),
  ]);
  assert.equal(summary.interventions[0].label, 'Facilitator moved from discussion to test.');
  assert.equal(summary.independent_evidence.state, 'unavailable');
  assert.match(summary.independent_evidence.detail, /changed the session path/i);
  assert.doesNotMatch(JSON.stringify(summary), /mistake|blame/i);
});

test('legacy session preserves useful session data and truthful unavailable evidence', () => {
  const summary = aggregateFacilitatorEvidenceSession({
    trackedSession: tracked(),
    evidenceSession: null,
    events: [],
  });
  assert.equal(summary.session.completion_state, 'ended');
  assert.equal(summary.lesson.source_key, 'generated/fractions.json');
  assert.equal(summary.completeness.state, 'unavailable');
  assert.equal(summary.baseline.state, 'unavailable');
  assert.equal(summary.independent_evidence.state, 'unavailable');
  assert.equal(summary.retention.state, 'unavailable');
});

test('partial and unknown future protocols use safe interpretation fallbacks', () => {
  const partial = report([], { evidence_status: 'partial' });
  assert.equal(partial.completeness.state, 'partial');

  const future = report([
    masteryResult('independent_success', { mastery_protocol_version: 'independent-mastery-v99' }),
  ], { mastery_protocol_version: 'independent-mastery-v99' });
  assert.equal(future.independent_evidence.state, 'unknown_protocol');
  assert.match(future.independent_evidence.detail, /interpretation is unavailable/i);
  assert.equal(future.completeness.state, 'partial');
});

function makeRepository({ owned = true } = {}) {
  const trackedRows = [
    tracked(),
    tracked({
      id: TRACKED_2,
      session_id: 'browser-session-2',
      started_at: '2026-07-28T12:00:00.000Z',
      ended_at: '2026-07-28T12:20:00.000Z',
    }),
  ];
  const evidenceRows = [
    evidenceSession({ provider: 'private-provider', model: 'private-model' }),
    evidenceSession({
      id: EVIDENCE_2,
      session_id: TRACKED_2,
      browser_session_id: 'browser-session-2',
      started_at: '2026-07-28T12:00:00.000Z',
      ended_at: '2026-07-28T12:20:00.000Z',
    }),
  ];
  const events = [
    baselineEvaluation(false, { event_id: 'api-event-1' }),
    masteryResult('independent_success', { event_id: 'api-event-2', event_sequence: 2, payload: { raw_secret: 'nope' } }),
    event('session_ended', { event_id: 'api-event-3', event_sequence: 3, phase: 'complete', payload: { test_percentage: 90 } }),
    masteryResult('independent_success', {
      event_id: 'malicious-other-user',
      facilitator_id: USER_B,
      learner_id: LEARNER_B,
      event_sequence: 4,
    }),
  ];

  return {
    async findOwnedLearner({ userId, learnerId }) {
      return owned && userId === USER_A && learnerId === LEARNER_A ? { id: learnerId } : null;
    },
    async listTrackedSessions({ sessionId, lessonKey, cursor, limit }) {
      let rows = trackedRows;
      if (sessionId) rows = rows.filter((row) => row.id === sessionId);
      if (lessonKey) rows = rows.filter((row) => row.lesson_id === lessonKey);
      if (cursor) rows = rows.filter((row) => isSessionBeforeCursor(row, cursor));
      return rows.slice(0, limit);
    },
    async listEvidenceSessions({ sessionIds }) {
      return evidenceRows.filter((row) => sessionIds.includes(row.session_id));
    },
    async listEvidenceEvents({ evidenceSessionIds }) {
      return events.filter((row) => evidenceSessionIds.includes(row.evidence_session_id));
    },
  };
}

async function getApi({ learnerId = LEARNER_A, search = '', userId = USER_A, repository = makeRepository() } = {}) {
  const request = new Request(`http://localhost/api/facilitator/learners/${learnerId}/evidence${search}`, {
    headers: { Authorization: 'Bearer test-token' },
  });
  return GET(request, {
    params: Promise.resolve({ id: learnerId }),
    deps: {
      enabled: true,
      authenticate: async () => ({ user: { id: userId } }),
      repository,
    },
  });
}

test('authorized reporting API returns a stable whitelist and filters foreign rows and secrets', async () => {
  const response = await getApi();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.enabled, true);
  assert.equal(body.learner.id, LEARNER_A);
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].independent_evidence.state, 'independent_success');
  assert.equal(body.items[0].score.value, 90);
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /private-provider|private-model|raw_secret|malicious-other-user|response_value|correct_answer/i);
  assert.deepEqual(Object.keys(body).sort(), ['enabled', 'items', 'learner', 'ok', 'pagination']);
});

test('cross-account learner and lesson-key tampering fail before evidence reads', async () => {
  const response = await getApi({
    learnerId: LEARNER_B,
    userId: USER_A,
    search: '?lesson_key=generated%2Ffractions.json',
    repository: makeRepository({ owned: false }),
  });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /unauthorized/i);
});

test('session-id tampering returns not found and never substitutes another session', async () => {
  const response = await getApi({ search: '?session_id=not-owned-session' });
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /Session not found/i);
});

test('cursor pagination has stable boundaries without duplicate sessions', async () => {
  const firstResponse = await getApi({ search: '?limit=1' });
  const first = await firstResponse.json();
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].session.id, TRACKED_1);
  assert.equal(first.pagination.has_more, true);
  assert.ok(first.pagination.next_cursor);

  const decoded = decodeReportCursor(first.pagination.next_cursor);
  assert.equal(decoded.id, TRACKED_1);
  const secondResponse = await getApi({ search: `?limit=1&cursor=${encodeURIComponent(first.pagination.next_cursor)}` });
  const second = await secondResponse.json();
  assert.equal(second.items.length, 1);
  assert.equal(second.items[0].session.id, TRACKED_2);
  assert.notEqual(first.items[0].session.id, second.items[0].session.id);
});

test('feature-disabled API returns a calm empty state without database access', async () => {
  const request = new Request(`http://localhost/api/facilitator/learners/${LEARNER_A}/evidence`);
  const response = await GET(request, {
    params: Promise.resolve({ id: LEARNER_A }),
    deps: { enabled: false },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.enabled, false);
  assert.deepEqual(body.items, []);
});

test('cursor helpers retain exact timestamp and reject malformed input', () => {
  const cursor = encodeReportCursor(tracked());
  assert.deepEqual(decodeReportCursor(cursor), { started_at: tracked().started_at, id: TRACKED_1 });
  assert.throws(() => decodeReportCursor('not-a-cursor'), /Invalid evidence history cursor/);
});

test('facilitator UI source covers complete, partial, unavailable, not measured, retained, needs review, loading, failure, empty, and mobile states', () => {
  const component = readFileSync(new URL('../src/app/facilitator/learners/[id]/transcripts/EvidenceHistorySection.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/app/facilitator/learners/[id]/transcripts/evidenceHistory.module.css', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/app/facilitator/learners/[id]/transcripts/page.js', import.meta.url), 'utf8');
  for (const required of [
    'Learning evidence',
    'Loading learning evidence',
    'temporarily unavailable',
    'No learning-evidence sessions yet',
    'Before instruction',
    'Independent evidence',
    'Retention',
    'Interpretation',
    'Options',
    'Why this summary?',
    'Open session transcript',
  ]) {
    assert.match(component, new RegExp(required.replace(/[?]/g, '\\?')));
  }
  assert.match(component, /report\.completeness/);
  assert.match(component, /report\.retention/);
  assert.match(page, /EvidenceHistorySection/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
});

test('reporting source contains no forbidden claim vocabulary or synthetic mastery metrics', () => {
  const source = readFileSync(new URL('../src/app/lib/masteryEvidence/reporting.js', import.meta.url), 'utf8');
  for (const forbidden of [
    'permanent mastery',
    'better than humans',
    'AI confidence',
    'mastery percentage',
    'learning IQ',
    'percentile',
    'dyslexia',
    'ADHD',
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden, 'i'));
  }
});
