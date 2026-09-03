import { addSyllabusDays, startOfSyllabusWeek } from './timeline.mjs'
import { aggregateFacilitatorEvidenceSession } from '../masteryEvidence/reporting.js'
import { instructionalEvidenceContext } from './evidenceProjection.mjs'

export const SYLLABUS_QA_TODAY = '2026-08-31'
export const SYLLABUS_QA_FACILITATOR_ID = 'qa-facilitator-local-only'
export const SYLLABUS_QA_LEARNER_ID = 'qa-learner-emma-local-only'

const week = startOfSyllabusWeek(SYLLABUS_QA_TODAY)
const date = (offset) => addSyllabusDays(week, offset)

const activeRevision = {
  id: 'qa-revision-7',
  revision_number: 7,
  effective_from: SYLLABUS_QA_TODAY,
  goals: { legacy_notes: 'Build confident independent reading, explain mathematical thinking, and connect science observations to evidence.' },
  subjects: [{ name: 'Mathematics' }, { name: 'Language Arts' }, { name: 'Science' }, { name: 'History' }],
  weekly_pattern: {
    monday: [{ subject: 'Mathematics' }],
    tuesday: [{ subject: 'Language Arts' }],
    wednesday: [{ subject: 'Science' }, { subject: 'Mathematics' }],
    thursday: [{ subject: 'History' }],
    friday: [{ subject: 'Language Arts' }],
  },
  teaching_guidance: {
    curriculum_preferences: {
      instructional_preferences: ['Use concrete examples before abstraction', 'Invite the learner to explain reasoning aloud'],
      resource_preferences: ['Prefer primary sources and hands-on materials'],
      subject_preferences: {
        Mathematics: { instructional_preferences: ['Use visual fraction models'], resource_preferences: [] },
        'Language Arts': { instructional_preferences: ['Connect close reading to the learner’s own questions'], resource_preferences: [] },
      },
    },
  },
  planning_policy: { mode: 'facilitator_directed' },
  legacy_provenance: { source: 'qa_fixture' },
}

const timelineItems = [
  {
    id: 'actual:qa-session-fractions-a', occurrence_id: 'actual:qa-session-fractions-a', source_occurrence_id: 'syllabus:fractions-a',
    lesson_key: 'generated/fraction-stories.json', title: 'Fraction Stories', description: 'Represent equivalent fractions with visual stories.',
    subject: 'Mathematics', planned_date: date(-14), sort_order: 0, placement_kind: 'actual', actual_kind: 'completed',
    actual_at: `${date(-14)}T15:00:00Z`, actual_instructional_teacher: 'webb', readiness_state: 'completed', origin: 'facilitator',
  },
  {
    id: 'actual:qa-session-fractions-b', occurrence_id: 'actual:qa-session-fractions-b', source_occurrence_id: 'syllabus:fractions-b',
    lesson_key: 'generated/fraction-stories.json', title: 'Fraction Stories', description: 'Revisit equivalent fractions using a different model.',
    subject: 'Mathematics', planned_date: date(-7), sort_order: 0, placement_kind: 'actual', actual_kind: 'completed',
    actual_at: `${date(-7)}T15:00:00Z`, actual_instructional_teacher: 'sonoma', readiness_state: 'completed', origin: 'facilitator',
  },
  {
    id: 'actual:qa-session-recovery', occurrence_id: 'actual:qa-session-recovery', source_occurrence_id: 'syllabus:recovery',
    lesson_key: 'generated/context-clues.json', title: 'Context Clues in Motion', description: 'Use surrounding sentences to test word meaning.',
    subject: 'Language Arts', planned_date: date(-6), sort_order: 0, placement_kind: 'actual', actual_kind: 'incomplete',
    actual_at: `${date(-6)}T15:00:00Z`, actual_instructional_teacher: 'sonoma', readiness_state: 'saved', origin: 'facilitator',
  },
  {
    id: 'actual:qa-session-current', occurrence_id: 'actual:qa-session-current', source_occurrence_id: 'syllabus:current',
    lesson_key: 'generated/local-ecosystems.json', title: 'A Tiny Ecosystem', description: 'Observe how living and nonliving parts interact.',
    subject: 'Science', planned_date: date(2), sort_order: 0, placement_kind: 'actual', actual_kind: 'in_progress',
    actual_at: `${date(2)}T14:00:00Z`, actual_instructional_teacher: 'sonoma', readiness_state: 'in_progress', origin: 'facilitator',
  },
  {
    id: 'qa-planned-ratios', occurrence_id: 'syllabus:qa-planned-ratios', lineage_id: 'qa-lineage-planned-ratios',
    lesson_key: null, title: 'Ratios in Recipes', description: 'Compare ingredient quantities and explain equivalent ratios.',
    subject: 'Mathematics', planned_date: date(7), sort_order: 0, placement_kind: 'syllabus', readiness_state: 'saved', origin: 'facilitator',
  },
  {
    id: 'qa-ready-biomes', occurrence_id: 'syllabus:qa-ready-biomes', lineage_id: 'qa-lineage-ready-biomes',
    lesson_key: 'fixture/generated/biome-field-notes.json', title: 'Biome Field Notes', description: 'Compare climate evidence across two biomes.',
    subject: 'Science', planned_date: date(9), sort_order: 0, placement_kind: 'syllabus', readiness_state: 'draft', origin: 'facilitator', assigned_instructional_teacher: 'sonoma',
  },
]

const forecastItems = [
  {
    id: 'qa-proposal-voice', lineage_id: 'qa-lineage-voice', lesson_key: null, title: 'Voice in Historical Letters',
    description: 'Notice how word choice reveals a writer’s perspective.', subject: 'History', planned_date: date(10), sort_order: 0,
    origin: 'learning_forecast', metadata: { qa_fixture: true },
  },
  {
    id: 'qa-proposal-poetry', lineage_id: 'qa-lineage-poetry', lesson_key: null, title: 'Sound Patterns in Poetry',
    description: 'Compare rhythm and repetition across two short poems.', subject: 'Language Arts', planned_date: date(11), sort_order: 0,
    origin: 'learning_forecast', metadata: { qa_fixture: true },
  },
]

const productionEvidenceReport = aggregateFacilitatorEvidenceSession({
  trackedSession: { id: 'qa-production-evidence-session', lesson_id: 'generated/fraction-stories.json', lesson_title: 'Fraction Stories', subject: 'Mathematics', ended_at: '2026-08-28T15:00:00Z' },
  evidenceSession: { session_id: 'qa-production-evidence-session', lesson_key: 'generated/fraction-stories.json', mastery_protocol_version: 'independent-mastery-v1', retention_protocol_version: 'retention-v1', evidence_status: 'complete' },
  events: [{
    event_type: 'mastery_check_result', event_sequence: 1, occurred_at: '2026-08-28T14:45:00.000Z',
    concept_id: 'equivalent-fractions', stable_item_id: 'qa-equivalent-fractions', item_exposure_id: 'qa-equivalent-fractions-1',
    assessment_role: 'conversational_mastery_opportunity', mastery_outcome: 'independent_success', mastery_check_id: 'qa-check-equivalent-fractions',
    mastery_protocol_version: 'independent-mastery-v1', payload: { qualification: { interaction_model: 'webb_conversation', webb_classification: { coverage: 'covered', comprehension: 'demonstrated', mastery: 'mastered', retention: 'not_measured' } } },
  }],
})
const productionForecastEvidence = instructionalEvidenceContext([productionEvidenceReport])

function evidenceReport({ sessionId, state, label, detail, retention = 'not_measured', authority = 'instructional_session', startedAt = '2026-08-17T14:00:00Z' }) {
  const retentionSummary = retention === 'retained'
    ? null
    : { label: 'Not yet measured', detail: 'No delayed retention result is linked to this occurrence.' }
  return {
    authority,
    session: { id: sessionId, started_at: startedAt, ended_at: startedAt },
    baseline: { state: 'not_demonstrated', label: 'Not yet demonstrated', detail: 'The opening check did not yet show the target independently.' },
    assistance: { state: 'recorded', label: 'Guidance recorded', detail: 'Hints and a worked visual model were recorded.' },
    independent_evidence: { state, label, detail },
    retention: retention === 'retained'
      ? { state: 'retained', label: 'Retained', detail: 'A later independent review was successful.' }
      : { state: 'not_measured', label: 'Not yet measured', detail: 'No delayed retention result is linked to this occurrence.' },
    learning_summary: {
      headline: label,
      narrative: detail,
      unresolved: retentionSummary,
      planning_meaning: state === 'needs_recovery' ? 'Consider recovery before another independent check.' : null,
      assistance_counts: { hints: 0, retries: 0 },
    },
  }
}

const historyByOccurrence = {
  'actual:qa-session-fractions-a': {
    ok: true,
    occurrence: { id: 'actual:qa-session-fractions-a', lessonTitle: 'Fraction Stories', subject: 'Mathematics', occurrenceDate: date(-14), completionState: 'completed', actualInstructionalTeacher: { id: 'webb', label: 'Mrs. Webb' } },
    evidence: {
      status: 'available',
      primary: evidenceReport({ sessionId: 'qa-session-fractions-a', state: 'independent_success', label: 'Demonstrated independently', detail: 'The learner explained two equivalent representations without assistance.', retention: 'retained' }),
      slate: [evidenceReport({ sessionId: 'slate:qa-fractions-practice', state: 'assisted_success', label: 'Correct with assistance', detail: 'The learner completed the supplemental practice after one hint.', authority: 'slate', startedAt: '2026-08-19T14:00:00Z' })],
    },
    reviews: { daily: [], weekly: [] },
    sessionRecords: [{ kind: 'instructional_transcript', teacher: 'webb', teacherName: 'Mrs. Webb', startedAt: `${date(-14)}T14:00:00Z`, endedAt: `${date(-14)}T15:00:00Z`, transcript: { kind: 'txt', url: 'qa-fixture://fraction-a' } }],
    transcriptStatus: 'available',
  },
  'actual:qa-session-fractions-b': {
    ok: true,
    occurrence: { id: 'actual:qa-session-fractions-b', lessonTitle: 'Fraction Stories', subject: 'Mathematics', occurrenceDate: date(-7), completionState: 'completed', actualInstructionalTeacher: { id: 'sonoma', label: 'Ms. Sonoma' } },
    evidence: { status: 'available', primary: evidenceReport({ sessionId: 'qa-session-fractions-b', state: 'needs_recovery', label: 'Needs recovery', detail: 'The fresh check did not yet establish independent use of the model.' }), slate: [] },
    reviews: { daily: [], weekly: [] }, sessionRecords: [], transcriptStatus: 'unavailable',
  },
  'actual:qa-session-recovery': {
    ok: true,
    occurrence: { id: 'actual:qa-session-recovery', lessonTitle: 'Context Clues in Motion', subject: 'Language Arts', occurrenceDate: date(-6), completionState: 'incomplete', actualInstructionalTeacher: { id: 'sonoma', label: 'Ms. Sonoma' } },
    evidence: { status: 'unavailable', primary: null, slate: [] }, reviews: { daily: [], weekly: [] }, sessionRecords: [], transcriptStatus: 'unavailable',
  },
  'actual:qa-session-current': {
    ok: true,
    occurrence: { id: 'actual:qa-session-current', lessonTitle: 'A Tiny Ecosystem', subject: 'Science', occurrenceDate: date(2), completionState: 'in_progress', actualInstructionalTeacher: { id: 'sonoma', label: 'Ms. Sonoma' } },
    evidence: { status: 'unavailable', primary: null, slate: [] }, reviews: { daily: [], weekly: [] }, sessionRecords: [], transcriptStatus: 'unavailable',
  },
}

export function createSyllabusQaFixture() {
  return structuredClone({
    facilitator: { id: SYLLABUS_QA_FACILITATOR_ID, name: 'QA Facilitator' },
    learner: { id: SYLLABUS_QA_LEARNER_ID, name: 'Emma QA', grade: '5' },
    activeRevision,
    timelineItems,
    forecastProposal: { id: 'qa-proposal-revision-8', revision_number: 8, forecast_items: forecastItems },
    historyByOccurrence,
    transcriptText: {
      'qa-fixture://fraction-a': 'Mrs. Webb: Show two ways to represent one half.\nEmma QA: Two fourths and three sixths are both one half.\nMrs. Webb: Explain how you know.\nEmma QA: The parts change size, but the same amount of the whole is shaded.',
    },
    productionEvidenceReport,
    productionForecastEvidence,
    resolvedToday: SYLLABUS_QA_TODAY,
  })
}
