import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSenseMakingGuidance, SENSE_MAKING_MODES } from '../sonomaSenseMaking.mjs';
import { normalizeLessonVocabulary, getVocabularyTerms, buildVocabularyPromptChunk } from '../lessonVocabulary.mjs';
import {
  COMPREHENSION_SIGNAL_PROTOCOL_VERSION,
  fallbackComprehensionDiagnostic,
  parseInstructionalJsonResponse,
} from '../comprehensionSignals.mjs';
import { STAGE_2_EVIDENCE_EVENT_TYPES } from '../masteryEvidence/constants.js';
import { aggregateFacilitatorEvidenceSession } from '../masteryEvidence/reporting.js';

test('sense-making first explanation anticipates misreadings without planting them', () => {
  const guidance = buildSenseMakingGuidance({ mode: SENSE_MAKING_MODES.FIRST_EXPLANATION });
  assert.match(guidance, /incorrectly construct/i);
  assert.match(guidance, /formal label/i);
  assert.match(guidance, /do not introduce a list of hypothetical misconceptions/i);
});

test('study reframe requires a materially different representation', () => {
  const guidance = buildSenseMakingGuidance({ mode: SENSE_MAKING_MODES.STUDY_REFRAME });
  assert.match(guidance, /change representation materially/i);
  assert.match(guidance, /do not merely simplify or paraphrase/i);
});

test('lesson vocabulary normalizes legacy field shapes and preserves definitions', () => {
  const lesson = {
    vocabulary: [
      { word: 'Benchmark Fraction', meaning: 'A familiar fraction used for comparison.' },
      { term: 'Numerator', definition: 'The top number.' },
      { title: 'benchmark fraction', description: '' },
    ],
  };
  assert.deepEqual(normalizeLessonVocabulary(lesson), [
    { term: 'Benchmark Fraction', definition: 'A familiar fraction used for comparison.' },
    { term: 'Numerator', definition: 'The top number.' },
  ]);
  assert.deepEqual(getVocabularyTerms(lesson), ['Benchmark Fraction', 'Numerator']);
  assert.match(buildVocabularyPromptChunk(lesson), /Benchmark Fraction: A familiar fraction used for comparison/);
});

test('instructional JSON keeps learner reply separate from conservative diagnostic', () => {
  const parsed = parseInstructionalJsonResponse(JSON.stringify({
    reply: 'Half means one of two equal parts. A benchmark uses that familiar amount to compare another fraction.',
    strategy: 'concrete_example',
    comprehension_signal: {
      status: 'partial',
      understood: ['1/2 means half'],
      unclear: ['why 1/2 can be used as a benchmark'],
      misconceptions: [],
      summary: 'The learner distinguished the fraction value from its comparison role.',
    },
  }));
  assert.equal(parsed.strategy, 'concrete_example');
  assert.equal(parsed.diagnostic.protocol_version, COMPREHENSION_SIGNAL_PROTOCOL_VERSION);
  assert.equal(parsed.diagnostic.status, 'partial');
  assert.deepEqual(parsed.diagnostic.understood, ['1/2 means half']);
});

test('self-reported understanding remains self-report, not mastery', () => {
  const diagnostic = fallbackComprehensionDiagnostic({ inputMode: 'understood' });
  assert.equal(diagnostic.status, 'self_reported_understanding');
  assert.equal('mastery' in diagnostic, false);
});

test('facilitator report groups multi-turn Study into one diagnostic episode and one help event', () => {
  const interactionId = 'study-1';
  const events = [
    {
      event_id: 'a1', event_sequence: 1, event_type: STAGE_2_EVIDENCE_EVENT_TYPES.ASK_USED,
      occurred_at: '2026-09-16T16:00:00.000Z', phase: 'teaching',
      payload: { interaction_id: interactionId, ask_mode: 'study_typed', strategy_used: 'concrete_example' },
    },
    {
      event_id: 'c1', event_sequence: 2, event_type: STAGE_2_EVIDENCE_EVENT_TYPES.COMPREHENSION_SIGNAL,
      occurred_at: '2026-09-16T16:00:01.000Z', phase: 'teaching',
      payload: {
        interaction_id: interactionId,
        source: 'study',
        learner_message: 'I understand half but not why it is a benchmark.',
        input_mode: 'typed',
        target_type: 'vocabulary',
        target_term: 'benchmark fraction',
        source_phase: 'teaching',
        source_stage: 'lecture',
      },
      result: {
        protocol_version: COMPREHENSION_SIGNAL_PROTOCOL_VERSION,
        status: 'partial',
        understood: ['1/2 means half'],
        unclear: ['why familiar fractions are used for comparison'],
        misconceptions: [],
        summary: 'The value of one-half is understood; the benchmark role is unclear.',
      },
    },
    {
      event_id: 'a2', event_sequence: 3, event_type: STAGE_2_EVIDENCE_EVENT_TYPES.ASK_USED,
      occurred_at: '2026-09-16T16:00:02.000Z', phase: 'teaching',
      payload: { interaction_id: interactionId, ask_mode: 'study_deepen', strategy_used: 'number_model' },
    },
    {
      event_id: 'c2', event_sequence: 4, event_type: STAGE_2_EVIDENCE_EVENT_TYPES.COMPREHENSION_SIGNAL,
      occurred_at: '2026-09-16T16:00:03.000Z', phase: 'teaching',
      payload: {
        interaction_id: interactionId,
        source: 'study',
        learner_message: "I still don't understand.",
        input_mode: 'deepen',
        observed_signal: 'self_reported_unresolved',
        target_type: 'vocabulary',
        target_term: 'benchmark fraction',
        source_phase: 'teaching',
        source_stage: 'lecture',
      },
      result: {
        protocol_version: COMPREHENSION_SIGNAL_PROTOCOL_VERSION,
        status: 'unresolved',
        understood: [], unclear: ['benchmark comparison role'], misconceptions: [], summary: 'The target remains unresolved.',
      },
    },
  ];

  const report = aggregateFacilitatorEvidenceSession({
    trackedSession: { id: 'session-1', started_at: '2026-09-16T15:59:00.000Z' },
    evidenceSession: { id: 'ev-1', session_id: 'session-1', evidence_status: 'complete', started_at: '2026-09-16T15:59:00.000Z' },
    events,
  });

  assert.equal(report.report_version, 'facilitator-evidence-v2');
  assert.equal(report.diagnostic_comprehension.state, 'observed');
  assert.equal(report.diagnostic_comprehension.episodes.length, 1);
  assert.equal(report.diagnostic_comprehension.episodes[0].observations.length, 2);
  assert.deepEqual(report.diagnostic_comprehension.episodes[0].strategies, ['concrete_example', 'number_model']);
  assert.equal(report.diagnostic_comprehension.episodes[0].resolution, 'unresolved_self_report');
  assert.equal(report.assistance.events.filter((event) => event.type === STAGE_2_EVIDENCE_EVENT_TYPES.ASK_USED).length, 1);
});
