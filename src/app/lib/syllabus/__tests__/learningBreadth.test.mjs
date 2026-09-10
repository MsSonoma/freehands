import test from 'node:test'
import assert from 'node:assert/strict'

import { subjectBalancedInstructionalEvidenceContext } from '../evidenceProjection.mjs'
import { broadInstructionalStrands, buildSubjectBreadthContext } from '../learningBreadth.mjs'
import { generateInstructionalForecastItems, validateInstructionalForecastItems } from '../learningForecastModel.server.mjs'

const VERSION = 'facilitator-evidence-v1'

function report(subject, title, { completeness = 'complete', unresolved = 'None', independent = 'independent_success' } = {}) {
  return {
    report_version: VERSION,
    lesson: { key: `${subject}/${title.toLowerCase().replaceAll(' ', '-')}.json`, title, subject },
    completeness: { state: completeness },
    baseline: { state: 'established' },
    independent_evidence: { state: independent },
    retention: { state: 'not_measured' },
    learning_summary: { headline: 'Learning evidence', narrative: `Evidence for ${title}.`, unresolved: { label: unresolved } },
    transcript: 'SECRET RAW TRANSCRIPT',
    events: [{ secret: true }],
  }
}

test('subject-balanced planning history does not let the newest subject crowd older requested subjects out', () => {
  const reports = [
    ...Array.from({ length: 12 }, (_, index) => report('science', `Science ${index + 1}`)),
    report('math', 'Division with Decimals'),
    report('math', 'Whole Number Division'),
    report('math', 'Decimal Addition and Subtraction'),
  ]
  const projected = subjectBalancedInstructionalEvidenceContext(reports, ['math', 'science'], { perSubjectLimit: 3 })
  assert.deepEqual(projected.map((row) => row.lesson.subject), ['math', 'math', 'math', 'science', 'science', 'science'])
  assert.deepEqual(projected.slice(0, 3).map((row) => row.lesson.title), ['Division with Decimals', 'Whole Number Division', 'Decimal Addition and Subtraction'])
  assert.doesNotMatch(JSON.stringify(projected), /SECRET|events|transcript/i)
})

test('subject aliases share planning history instead of creating false empty subjects', () => {
  const reports = [report('social studies', 'Local Government'), report('language arts', 'Main Idea') ]
  const projected = subjectBalancedInstructionalEvidenceContext(reports, ['history', 'ELA'], { perSubjectLimit: 2 })
  assert.deepEqual(projected.map((row) => row.lesson.title), ['Local Government', 'Main Idea'])
  const history = buildSubjectBreadthContext({ learnerGrade: '4th', slots: [{ subject: 'history' }], reports })
  assert.equal(history.subjects[0].recent_learning[0].lesson.title, 'Local Government')
  assert.ok(history.subjects[0].broad_strands.includes('civics and government'))
})

test('breadth context gives grade, broad domains, recent territory and a branch default after a completed sequence', () => {
  const reports = [
    report('math', 'Division with Decimals'),
    report('math', 'Whole Number Division'),
    report('math', 'Decimal Addition and Subtraction'),
  ]
  const context = buildSubjectBreadthContext({
    learnerGrade: '4th',
    slots: [{ subject: 'math', planned_date: '2026-09-21', sort_order: 0 }],
    reports,
    forecastItems: [{
      subject: 'math', planned_date: '2026-09-28', title: 'Equivalent Fractions',
      metadata: { learning_forecast: { strand: 'fractions, decimals, and rational-number reasoning' } },
    }],
    today: '2026-09-10',
  })
  assert.equal(context.learner_grade, '4th')
  assert.match(context.planning_principle, /history is evidence/i)
  assert.ok(broadInstructionalStrands('math').includes('geometry and spatial reasoning'))
  assert.equal(context.subjects[0].default_planning_move, 'branch')
  assert.deepEqual(context.subjects[0].recent_learning.map((row) => row.lesson.title), ['Division with Decimals', 'Whole Number Division', 'Decimal Addition and Subtraction'])
  assert.equal(context.subjects[0].future_intent[0].strand, 'fractions, decimals, and rational-number reasoning')
})

test('broader completed timeline supplies topic history beyond the bounded mastery window', () => {
  const timelineItems = [
    { subject: 'math', title: 'Geometry: Lines and Angles', planned_date: '2026-04-01', actual_kind: 'completed', readiness_state: 'completed', placement_kind: 'actual' },
    { subject: 'math', title: 'Area and Perimeter', planned_date: '2026-05-01', actual_kind: 'completed', readiness_state: 'completed', placement_kind: 'actual' },
    { subject: 'math', title: 'Mr. Slate: Area and Perimeter', planned_date: '2026-05-02', supplemental: true, placement_kind: 'slate_assignment', readiness_state: 'completed' },
    { subject: 'math', title: 'Decimal Division Today', planned_date: '2026-09-10', actual_kind: 'completed', readiness_state: 'completed', placement_kind: 'actual' },
    { subject: 'science', title: 'Weather Systems', planned_date: '2026-06-01', actual_kind: 'completed', readiness_state: 'completed', placement_kind: 'actual' },
  ]
  const context = buildSubjectBreadthContext({ learnerGrade: '4th', slots: [{ subject: 'math' }], reports: [], timelineItems, today: '2026-09-10' })
  assert.deepEqual(context.subjects[0].recent_topic_history.map((row) => row.title), ['Decimal Division Today', 'Area and Perimeter', 'Geometry: Lines and Angles'])
  assert.equal(context.subjects[0].recent_topic_history.some((row) => /Slate/.test(row.title)), false)
  assert.equal(context.subjects[0].future_intent.some((row) => row.title === 'Decimal Division Today'), false)
})

test('unresolved instructional evidence permits continuation without turning mastery state itself into repetition authority', () => {
  const context = buildSubjectBreadthContext({
    learnerGrade: '4th',
    slots: [{ subject: 'math' }],
    reports: [
      report('math', 'Whole Number Division', { unresolved: 'Needs one more prerequisite explanation before decimal division.', independent: 'needs_recovery' }),
      report('math', 'Area Models', { unresolved: 'None', independent: 'needs_recovery' }),
    ],
  })
  assert.equal(context.subjects[0].default_planning_move, 'evaluate_continue_or_return_then_branch')
  assert.equal(context.subjects[0].unresolved_instructional_signals.length, 1)
  assert.equal(context.subjects[0].unresolved_instructional_signals[0].title, 'Whole Number Division')
})

test('custom subjects receive an inference boundary instead of a fake built-in curriculum', () => {
  const context = buildSubjectBreadthContext({ learnerGrade: '7th', slots: [{ subject: 'robotics' }], reports: [] })
  assert.equal(context.subjects[0].map_source, 'infer_for_custom_subject')
  assert.deepEqual(context.subjects[0].broad_strands, [])
})

test('production model request receives learner grade and subject breadth and requires explicit planning fields', async () => {
  const priorKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'offline-test'
  let requestBody
  try {
    const items = await generateInstructionalForecastItems({
      slots: [{ subject: 'math' }],
      context: {
        learner: { grade: '4th' },
        syllabus: { goals: {}, subjects: [{ name: 'math' }], teaching_guidance: {}, planning_policy: {} },
        subject_breadth: { learner_grade: '4th', subjects: [{ subject: 'math', broad_strands: ['geometry and spatial reasoning'], default_planning_move: 'branch' }] },
        evidence_summaries: [],
      },
      fetchImpl: async (_url, init) => {
        requestBody = JSON.parse(init.body)
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [{ planning_move: 'branch', strand: 'geometry and spatial reasoning', planning_reason: '', title: 'Angles Around Us', description: 'Identify and compare angles in familiar shapes.' }] }) } }] }) }
      },
    })
    const userPayload = JSON.parse(requestBody.messages[1].content)
    assert.equal(userPayload.learner.grade, '4th')
    assert.equal(userPayload.subject_breadth.subjects[0].default_planning_move, 'branch')
    assert.match(requestBody.messages[0].content, /Learning history is evidence, not a command to continue/i)
    assert.match(requestBody.messages[0].content, /Actively maintain subject breadth across weeks/i)
    assert.equal(items[0].planning_move, 'branch')
    assert.equal(items[0].strand, 'geometry and spatial reasoning')
  } finally {
    if (priorKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = priorKey
  }
})

test('forecast item validation makes the planning decision explicit and rejects false branching', () => {
  const slots = [{ subject: 'math' }, { subject: 'math' }]
  const valid = validateInstructionalForecastItems([
    { planning_move: 'branch', strand: 'geometry and spatial reasoning', planning_reason: '', title: 'Angles Around Us', description: 'Identify and compare angles.' },
    { planning_move: 'continue', strand: 'geometry and spatial reasoning', planning_reason: 'Angle comparison is the prerequisite for classifying shapes by angle properties.', title: 'Angles in Shapes', description: 'Use angle knowledge to classify shapes.' },
  ], slots)
  assert.deepEqual(valid.map((item) => item.planning_move), ['branch', 'continue'])
  assert.throws(() => validateInstructionalForecastItems([
    { planning_move: 'branch', strand: 'geometry', planning_reason: '', title: 'Angles', description: 'Study angles.' },
    { planning_move: 'branch', strand: 'geometry', planning_reason: '', title: 'Shapes', description: 'Study shapes.' },
  ], slots), /repeated a strand/)
  assert.throws(() => validateInstructionalForecastItems([
    { planning_move: 'continue', strand: 'number operations', planning_reason: '', title: 'More Division', description: 'Continue division.' },
  ], [{ subject: 'math' }]), /explicit instructional reason/)
})
