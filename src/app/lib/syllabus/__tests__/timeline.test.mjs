import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  buildSyllabusTimeline,
  classifySyllabusWeek,
  matchMasteryAnnotations,
  moveSyllabusWeek,
  moveSyllabusTimeline,
  resolveSyllabusReadModel,
  selectSyllabusWeek,
  startOfSyllabusWeek,
  syllabusEntitlementsFor,
  syllabusItemActions,
  syllabusItemActionsFor,
  syllabusItemState,
  timelineItemAction,
} from '../timeline.mjs'
import { syllabusAccessFromProfile } from '../entitlements.server.mjs'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))

test('NOW grouping remains Monday-based across Sunday and Monday boundaries', () => {
  assert.equal(startOfSyllabusWeek('2026-08-23'), '2026-08-17')
  assert.equal(startOfSyllabusWeek('2026-08-24'), '2026-08-24')
  assert.equal(classifySyllabusWeek('2026-08-17', '2026-08-23'), 'now')
  assert.equal(classifySyllabusWeek('2026-08-17', '2026-08-24'), 'past')
})

test('timeline classifies past, NOW, and future and fills navigable empty weeks', () => {
  const timeline = buildSyllabusTimeline([
    { planned_date: '2026-08-17', title: 'Past' },
    { planned_date: '2026-08-25', title: 'Now' },
    { planned_date: '2026-09-08', title: 'Future' },
  ], { today: '2026-08-24' })
  assert.deepEqual(timeline.weeks.map((week) => week.state), ['past', 'now', 'future', 'future'])
  assert.equal(timeline.weeks[2].items.length, 0)
  assert.equal(timeline.now_index, 1)
})

test('Past capability does not fabricate historical Syllabus entries', () => {
  const timeline = buildSyllabusTimeline([{ planned_date: '2026-09-08', title: 'Future' }], { today: '2026-08-24' })
  assert.equal(timeline.weeks.some((week) => week.state === 'past'), false)
  assert.equal(timeline.weeks.flatMap((week) => week.items).length, 1)
})

test('Return to NOW restores the current-week index', () => {
  const state = { index: 3, nowIndex: 1, weekCount: 4 }
  assert.equal(moveSyllabusTimeline(state, 'now'), 1)
  assert.equal(moveSyllabusTimeline(state, 'earlier'), 2)
  assert.equal(moveSyllabusTimeline({ ...state, index: 0 }, 'earlier'), 0)
})

test('selected-week navigation moves exactly seven days across month and year boundaries', () => {
  assert.equal(moveSyllabusWeek('2026-12-28', 'later', '2026-12-30'), '2027-01-04')
  assert.equal(moveSyllabusWeek('2027-01-04', 'earlier', '2026-12-30'), '2026-12-28')
  assert.equal(moveSyllabusWeek('2027-02-01', 'now', '2026-12-30'), '2026-12-28')
})

test('selected Syllabus week defaults to current Monday and represents exactly seven days', () => {
  const week = selectSyllabusWeek([
    { id: 'past', planned_date: '2026-08-23' },
    { id: 'inside', planned_date: '2026-08-26' },
    { id: 'future', planned_date: '2026-08-31' },
  ], { today: '2026-08-26' })
  assert.equal(week.week_start, '2026-08-24')
  assert.equal(week.days.length, 7)
  assert.deepEqual(week.days.map((day) => day.date), ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'])
  assert.deepEqual(week.items.map((item) => item.id), ['inside'])
})

test('history-only completion is discoverable by navigating backward and empty weeks remain seven-day pages', () => {
  const items = [{ id: 'history', actual_kind: 'completed', planned_date: '2026-08-19' }]
  const previousStart = moveSyllabusWeek('2026-08-24', 'earlier', '2026-08-26')
  const historyWeek = selectSyllabusWeek(items, { weekStart: previousStart, today: '2026-08-26' })
  assert.deepEqual(historyWeek.items.map((item) => item.id), ['history'])
  const emptyWeek = selectSyllabusWeek([], { weekStart: '2026-09-07', today: '2026-08-26' })
  assert.equal(emptyWeek.days.length, 7)
  assert.equal(emptyWeek.items.length, 0)
})

test('canonical active Syllabus ignores legacy planner-shaped input', () => {
  const model = resolveSyllabusReadModel({
    has_active_syllabus: true,
    active_revision: { id: 'active' },
    forecast_items: [{ title: 'Canonical intention' }],
    planned_lessons: [{ title: 'Legacy planner row' }],
  })
  assert.equal(model.source, 'canonical_syllabus')
  assert.deepEqual(model.forecast_items, [{ title: 'Canonical intention' }])
  assert.equal('planned_lessons' in model, false)
})

test('no active Syllabus selects compatibility fallback without fabricating a plan', () => {
  assert.deepEqual(resolveSyllabusReadModel({ has_active_syllabus: false }), {
    kind: 'fallback', source: 'legacy_compatibility', revision: null, forecast_items: [], timeline_items: [],
  })
})

test('Free can establish a Syllabus while future intent manipulation remains unavailable', () => {
  const access = syllabusEntitlementsFor({ role: 'facilitator', planTier: 'free' })
  assert.equal(access.can_establish_syllabus, true)
  assert.equal(access.can_change_intent, false)
})

test('temporary planning access follows canonical tiers and fails closed', () => {
  for (const planTier of ['free', 'trial', 'standard', 'starter', 'unknown', '', null]) {
    assert.equal(syllabusEntitlementsFor({ role: 'facilitator', planTier }).can_change_intent, false, String(planTier))
  }
  for (const planTier of ['pro', 'lifetime', 'premium', 'premium-plus']) {
    assert.equal(syllabusEntitlementsFor({ role: 'facilitator', planTier }).can_change_intent, true, planTier)
  }
  assert.equal(syllabusEntitlementsFor({ role: 'facilitator', subscriptionTier: 'beta', planTier: 'free' }).can_change_intent, true)
  assert.equal(syllabusAccessFromProfile({ subscription_tier: 'beta', plan_tier: 'free' }).can_change_intent, true)
  assert.equal(syllabusAccessFromProfile({ subscription_tier: 'unexpected', plan_tier: 'malformed' }).can_change_intent, false)
})

test('learner presentation never receives facilitator mutation authority', () => {
  assert.equal(syllabusEntitlementsFor({ role: 'learner', planTier: 'pro' }).can_change_intent, false)
  assert.equal(syllabusEntitlementsFor({ role: 'learner', planTier: 'pro' }).can_establish_syllabus, false)
  assert.equal(syllabusEntitlementsFor({ role: 'facilitator', planTier: 'free' }).can_change_intent, false)
  assert.equal(syllabusEntitlementsFor({ role: 'facilitator', planTier: 'pro' }).can_change_intent, true)
})

function masteryFixture() {
  const forecast = [
    { id: 'first', lineage_id: 'lineage-a', planned_date: '2026-08-24', subject: 'math', lesson_key: 'math/a.json', title: 'A' },
    { id: 'second', lineage_id: 'lineage-b', planned_date: '2026-08-24', subject: 'math', lesson_key: 'math/b.json', title: 'B' },
  ]
  const note = {
    id: 'note', lineage_id: 'note-lineage', planned_date: '2026-08-24', subject: 'math', lesson_key: 'math/a.json', title: 'Review A', origin: 'mastery_reforecast',
    metadata: { mastery_reforecast: { anchor_lineage_id: 'lineage-b' } },
  }
  return { forecast, note }
}

test('mastery annotations prefer an exact lineage match', () => {
  const { forecast, note } = masteryFixture()
  const { assignments, unmatched } = matchMasteryAnnotations(forecast, [note])
  assert.equal(assignments.has('first'), false)
  assert.deepEqual(assignments.get('second'), [note])
  assert.deepEqual(unmatched, [])
})

test('missing lineage uses a unique supported lesson identity', () => {
  const { forecast, note } = masteryFixture()
  const supported = { ...note, metadata: { mastery_reforecast: {} }, lesson_key: 'math/a.json' }
  const { assignments, unmatched } = matchMasteryAnnotations(forecast, [supported])
  assert.deepEqual(assignments.get('first'), [supported])
  assert.equal(assignments.has('second'), false)
  assert.deepEqual(unmatched, [])
})

test('same-subject same-day ambiguity remains unmatched instead of selecting the first item', () => {
  const { forecast, note } = masteryFixture()
  const ambiguous = { ...note, metadata: { mastery_reforecast: {} }, lesson_key: null }
  const { assignments, unmatched } = matchMasteryAnnotations(forecast, [ambiguous])
  assert.equal(assignments.size, 0)
  assert.deepEqual(unmatched, [ambiguous])
})

test('mastery notes are neither duplicated nor falsely attached', () => {
  const { forecast, note } = masteryFixture()
  const lineage = { ...note, id: 'lineage-note' }
  const supported = { ...note, id: 'supported-note', metadata: { mastery_reforecast: {} }, lesson_key: 'math/a.json' }
  const ambiguous = { ...note, id: 'ambiguous-note', metadata: { mastery_reforecast: {} }, lesson_key: null }
  const { assignments, unmatched } = matchMasteryAnnotations(forecast, [lineage, supported, ambiguous])
  const accountedFor = [...assignments.values()].flat().concat(unmatched)
  assert.equal(accountedFor.length, 3)
  assert.equal(new Set(accountedFor).size, 3)
  assert.deepEqual(unmatched, [ambiguous])
})

test('only a current lesson artifact receives Start or Continue', () => {
  assert.equal(timelineItemAction({ role: 'learner', weekState: 'now', hasLessonArtifact: true, hasProgress: false }), 'start')
  assert.equal(timelineItemAction({ role: 'learner', weekState: 'now', hasLessonArtifact: true, hasProgress: true }), 'continue')
  assert.equal(timelineItemAction({ role: 'learner', weekState: 'future', hasLessonArtifact: true, hasProgress: false }), null)
  assert.equal(timelineItemAction({ role: 'facilitator', weekState: 'now', hasLessonArtifact: true, hasProgress: false }), null)
})

test('today ready Syllabus artifact starts without legacy availability while unready material does not', () => {
  assert.deepEqual(syllabusItemActions({ role: 'learner', state: 'today_unfinished', hasLessonArtifact: true, readinessState: 'available' }), [
    { id: 'execute', label: 'Start', requires_pin: false },
  ])
  assert.deepEqual(syllabusItemActions({ role: 'learner', state: 'today_unfinished', hasLessonArtifact: false, readinessState: 'draft' }), [
    { id: 'view', label: 'View' },
  ])
  const learnerPage = fs.readFileSync(path.resolve(TEST_DIR, '../../../learn/LearnerHome.js'), 'utf8')
  const stateStart = learnerPage.indexOf('function syllabusLessonState')
  const stateEnd = learnerPage.indexOf('async function openSyllabusLesson', stateStart)
  const stateSource = learnerPage.slice(stateStart, stateEnd)
  assert.match(stateSource, /recentMetaLookup\[lessonKey\]/)
  assert.doesNotMatch(stateSource, /activeSet/)
})

test('role action matrix keeps learner exceptions PIN-gated and facilitator controls distinct', () => {
  const completed = syllabusItemState({ item: { actual_kind: 'completed', planned_date: '2026-08-20' }, today: '2026-08-26' })
  assert.equal(completed, 'completed_historical')
  assert.deepEqual(syllabusItemActions({ role: 'learner', state: completed, hasLessonArtifact: true }), [
    { id: 'review', label: 'View / Review' }, { id: 'repeat', label: 'Do again', requires_pin: true },
  ])
  assert.equal(syllabusItemActions({ role: 'facilitator', state: completed }).find((action) => action.id === 'repeat').requires_pin, true)
  assert.equal(syllabusItemActions({ role: 'learner', state: 'today_unfinished', hasLessonArtifact: true, isToday: true })[0].requires_pin, false)
  assert.equal(syllabusItemActions({ role: 'learner', state: 'future_unfinished', hasLessonArtifact: true })[1].requires_pin, true)
  assert.ok(syllabusItemActions({ role: 'facilitator', state: 'future_unfinished', readinessState: 'approved' }).some((action) => action.id === 'schedule'))
  assert.equal(syllabusItemActions({ role: 'learner', state: 'future_unfinished', hasLessonArtifact: true }).some((action) => action.id === 'schedule'), false)
  assert.equal(syllabusItemActions({ role: 'learner', state: 'incomplete_historical', hasLessonArtifact: true })[1].label, 'Retry')
})

test('recovered instructional history receives completed actions while standalone Slate history remains actionless', () => {
  const recoveredWebb = {
    item_type: 'lesson',
    lesson_key: 'generated/grammar.json',
    placement_kind: 'historical',
    planned_date: '2026-08-27',
    actual_kind: 'completed',
    actual_instructional_teacher: 'webb',
    historical_record: true,
    historical_activity_only: false,
    historical_provenance: 'server_verified_legacy_transcript_v1',
  }
  const recoveredState = syllabusItemState({ item: recoveredWebb, today: '2026-08-31' })
  assert.equal(recoveredState, 'completed_historical')
  assert.deepEqual(syllabusItemActionsFor({ item: recoveredWebb, role: 'facilitator', state: recoveredState }), [
    { id: 'view', label: 'View' },
    { id: 'history', label: 'Review history' },
    { id: 'repeat', label: 'Repeat', requires_pin: true },
  ])
  assert.deepEqual(syllabusItemActionsFor({ item: recoveredWebb, role: 'learner', state: recoveredState, hasLessonArtifact: true }), [
    { id: 'review', label: 'View / Review' },
    { id: 'repeat', label: 'Do again', requires_pin: true },
    { id: 'practice_slate', label: 'Practice with Mr. Slate' },
  ])
  assert.equal(recoveredWebb.historical_provenance, 'server_verified_legacy_transcript_v1')
  assert.equal(recoveredWebb.actual_instructional_teacher, 'webb')

  const standaloneSlate = {
    item_type: 'lesson',
    lesson_key: 'generated/grammar.json',
    placement_kind: 'historical',
    planned_date: '2026-08-27',
    actual_kind: null,
    actual_instructional_teacher: null,
    historical_record: true,
    historical_activity_only: true,
    historical_provenance: 'server_verified_legacy_transcript_v1',
    historical_activity_annotations: [{ kind: 'slate_drill_history' }],
    slate_annotations: [],
  }
  const slateState = syllabusItemState({ item: standaloneSlate, today: '2026-08-31' })
  assert.deepEqual(syllabusItemActionsFor({ item: standaloneSlate, role: 'facilitator', state: slateState }), [])
  assert.deepEqual(syllabusItemActionsFor({ item: standaloneSlate, role: 'learner', state: slateState, hasLessonArtifact: true }), [])
  assert.equal(standaloneSlate.actual_kind, null)
  assert.equal(standaloneSlate.actual_instructional_teacher, null)
  assert.deepEqual(standaloneSlate.slate_annotations, [])
})

test('canonical actions are preserved while eligible lessons gain supplemental Slate actions', () => {
  const cases = [
    { item: { actual_kind: 'completed' }, role: 'facilitator', state: 'completed_historical' },
    { item: { actual_kind: 'incomplete' }, role: 'learner', state: 'incomplete_historical', hasLessonArtifact: true },
    { item: {}, role: 'learner', state: 'today_unfinished', hasLessonArtifact: true, isToday: true },
    { item: {}, role: 'facilitator', state: 'future_unfinished', readinessState: 'approved' },
  ]
  for (const entry of cases) {
    const { item, ...context } = entry
    const actions = syllabusItemActionsFor({ item, ...context })
    assert.deepEqual(actions.slice(0, syllabusItemActions(context).length), syllabusItemActions(context))
    const supplemental = actions.slice(syllabusItemActions(context).length)
    if (context.hasLessonArtifact && context.role === 'learner') {
      assert.deepEqual(supplemental, [{ id: 'practice_slate', label: 'Practice with Mr. Slate' }])
    } else if (item.lesson_key && context.role === 'facilitator' && item.historical_record !== true) {
      assert.deepEqual(supplemental, [{ id: 'schedule_slate', label: 'Schedule Mr. Slate' }])
    } else {
      assert.deepEqual(supplemental, [])
    }
  }
})

test('an instructional occurrence with existing Slate sessions can schedule another session', () => {
  const item = {
    item_type: 'lesson',
    lesson_key: 'math/fractions.json',
    has_slate_sessions: true,
    slate_session_count: 2,
  }
  const actions = syllabusItemActionsFor({ item, role: 'facilitator', state: 'future_unfinished' })
  assert.ok(actions.some((action) => action.id === 'schedule_slate'))
})

test('historical instructional actions preserve non-editable provenance and existing fail-closed handlers', () => {
  const document = fs.readFileSync(path.resolve(TEST_DIR, '../../../components/syllabus/SyllabusDocument.js'), 'utf8')
  const facilitatorPage = fs.readFileSync(path.resolve(TEST_DIR, '../../../facilitator/syllabus/page.js'), 'utf8')
  const learnerHome = fs.readFileSync(path.resolve(TEST_DIR, '../../../learn/LearnerHome.js'), 'utf8')
  assert.match(document, /syllabusItemActionsFor\(\{ item, role, state/)
  assert.doesNotMatch(document, /item\.historical_record \? \[\] : syllabusItemActions/)
  assert.match(document, /const historicalActivityAllowed = item\.historical_record !== true/)
  assert.match(document, /const teacherEditable = role === 'facilitator'[\s\S]*item\.historical_record !== true/)
  assert.match(facilitatorPage, /action\?\.id !== 'repeat'/)
  assert.match(facilitatorPage, /ensureFacilitatorPinException/)
  assert.match(learnerHome, /if \(action\?\.requires_pin\)/)
  assert.match(learnerHome, /occurrenceId: syllabusOccurrence\?\.occurrence_id \|\| ''/)
})

test('new Syllabus UI source contains required readable labels and no mojibake', () => {
  const source = fs.readFileSync(path.resolve(TEST_DIR, '../../../components/syllabus/SyllabusDocument.js'), 'utf8')
  for (const label of ['PAST / SYLLABUS RECORD', 'NOW / YOU ARE HERE', 'FUTURE / FORECAST', 'Ms. Sonoma / Living Syllabus', 'Previous week', 'This week', 'Next week', 'Locked / Upgrade to plan']) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.doesNotMatch(source, /\uFFFD|Ã|Â|â€|â€™|â†/u)
  assert.match(source, /could not be linked confidently to one specific Syllabus lesson/)
  assert.match(source, /week\.days\.map/)
  assert.doesNotMatch(source, /timeline\.weeks\.map/)
})

test('Free initial Syllabus establishment is review-only in the retained editor', () => {
  const source = fs.readFileSync(path.resolve(TEST_DIR, '../../../facilitator/syllabus/page.js'), 'utf8')
  assert.match(source, /draft && planningAccess\.can_change_intent \? <textarea/)
  assert.match(source, /draft && planningAccess\.can_change_intent \? <><ul/)
  assert.match(source, /disabled={!planningAccess\.can_change_intent}/)
  assert.match(source, /canActivateDraft = establishingFirstSyllabus \? planningAccess\.can_establish_syllabus : planningAccess\.can_change_intent/)
  assert.match(source, /establishFromCurrentPlan: true/)
})
