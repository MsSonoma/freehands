import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  buildSyllabusTimeline,
  classifySyllabusWeek,
  moveSyllabusWeek,
  moveSyllabusTimeline,
  projectLearningForecastForWeek,
  resolveSyllabusReadModel,
  selectSyllabusWeek,
  startOfSyllabusWeek,
  syllabusDayPresentation,
  syllabusEntitlementsFor,
  syllabusItemActions,
  syllabusItemActionsFor,
  syllabusItemState,
  timelineItemAction,
} from '../timeline.mjs'
import { syllabusAccessFromProfile } from '../entitlements.server.mjs'
import { bindSnapshotsToSyllabusOccurrences, selectSnapshotForRestore, snapshotCandidateLessons, snapshotHasMeaningfulProgress } from '../../../learn/snapshotProgress.mjs'

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

test('current read model omits retired mastery proposals while preserving activated legacy items', () => {
  const legacyItem = { id: 'legacy', planned_date: '2026-08-24', origin: 'mastery_reforecast', title: 'Historical review' }
  const model = resolveSyllabusReadModel({
    has_active_syllabus: true,
    active_revision: { id: 'active' },
    forecast_items: [legacyItem],
    timeline_items: [legacyItem],
    proposed_reforecast: { revision: { id: 'retired' }, forecast_items: [] },
  })
  assert.deepEqual(model.forecast_items, [legacyItem])
  assert.deepEqual(model.timeline_items, [legacyItem])
  assert.equal('proposed_reforecast' in model, false)
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

test('canonical incomplete lifecycle and resumable progress coexist as Continue', () => {
  for (const phase of ['discussion', 'teaching', 'comprehension', 'exercise', 'worksheet']) {
    const state = syllabusItemState({
      item: { actual_kind: 'incomplete', planned_date: '2026-08-20' },
      today: '2026-08-26',
      hasProgress: true,
    })
    assert.equal(state, 'in_progress', phase)
    assert.deepEqual(syllabusItemActions({ role: 'learner', state, hasLessonArtifact: true, isToday: false })[0], {
      id: 'execute', label: 'Continue', requires_pin: true,
    })
  }

  const noProgress = syllabusItemState({
    item: { actual_kind: 'incomplete', planned_date: '2026-08-20' },
    today: '2026-08-26',
    hasProgress: false,
  })
  assert.equal(noProgress, 'incomplete_historical')
  assert.equal(syllabusItemActions({ role: 'learner', state: noProgress, hasLessonArtifact: true })[1].label, 'Retry')
})

test('current V2 snapshots detect meaningful progress across instructional phases', () => {
  const snapshots = [
    { currentPhase: 'discussion', phaseData: { discussion: { turnCount: 2 } } },
    { currentPhase: 'teaching', phaseData: { teaching: { stage: 'examples', sentenceIndex: 1 } } },
    { currentPhase: 'comprehension', phaseData: { comprehension: { nextQuestionIndex: 1, answers: [{ isCorrect: true }] } } },
    { currentPhase: 'exercise', phaseData: { exercise: { nextQuestionIndex: 1, answers: [{ isCorrect: false }] } } },
    { currentPhase: 'worksheet', phaseData: { worksheet: { nextQuestionIndex: 1, answers: [{ isCorrect: true }] } } },
    { currentPhase: 'test', phaseData: { test: { nextQuestionIndex: 2, answers: [{ isCorrect: true }, { isCorrect: false }] } } },
  ]
  snapshots.forEach((snapshot) => assert.equal(snapshotHasMeaningfulProgress(snapshot), true, snapshot.currentPhase))
})

test('evidence snapshots mirror Session V2 baseline and retention restore gates', () => {
  assert.equal(snapshotHasMeaningfulProgress({
    currentPhase: 'baseline',
    phaseData: { baseline: { status: 'active', responses: [{ response: 'four' }] } },
  }), true)
  assert.equal(snapshotHasMeaningfulProgress({
    currentPhase: 'baseline',
    phaseData: { baseline: { status: 'complete', responses: [{ response: 'four' }], completedAt: '2026-08-20T11:00:00Z' } },
  }), false)
  assert.equal(snapshotHasMeaningfulProgress({
    currentPhase: 'retention',
    phaseData: { retention: { status: 'active', responses: [], plan: { selectedItems: [{ prompt: 'Recall it' }] } } },
  }), true)
  assert.equal(snapshotHasMeaningfulProgress({
    currentPhase: 'retention',
    phaseData: { retention: { status: 'eligible', responses: [{ response: 'answer' }], completedAt: '2026-08-20T11:00:00Z' } },
  }), false)
})

function resumableSnapshot({ sessionId, lessonKey = 'repeated', lastUpdated }) {
  return {
    sessionId,
    learnerId: 'learner-repeat',
    lessonKey,
    lastUpdated,
    currentPhase: 'exercise',
    phaseData: { exercise: { answers: [{ response: 'answer' }], nextQuestionIndex: 1 } },
  }
}

function repeatedOccurrenceFixture() {
  return {
    learnerId: 'learner-repeat',
    sessions: [
      { id: 'tracked-a', session_id: 'browser-a', learner_id: 'learner-repeat', lesson_id: 'math/repeated.json', started_at: '2026-08-20T10:00:00Z' },
      { id: 'tracked-b', session_id: 'browser-b', learner_id: 'learner-repeat', lesson_id: 'math/repeated.json', started_at: '2026-08-21T10:00:00Z' },
    ],
    timelineItems: [
      { occurrence_id: 'actual:tracked-a', source_occurrence_id: 'syllabus:a', placement_kind: 'actual', actual_kind: 'incomplete', lesson_key: 'math/repeated.json' },
      { occurrence_id: 'actual:tracked-b', source_occurrence_id: 'syllabus:b', placement_kind: 'actual', actual_kind: 'incomplete', lesson_key: 'math/repeated.json' },
    ],
  }
}

test('repeated lessons bind progress only to the snapshot browser session occurrence', () => {
  const fixture = repeatedOccurrenceFixture()
  const bind = (snapshot) => bindSnapshotsToSyllabusOccurrences({
    ...fixture,
    snapshotRecords: [{ lessonKey: 'math/repeated.json', snapshot }],
  })

  const boundA = bind(resumableSnapshot({ sessionId: 'browser-a', lastUpdated: '2026-08-20T10:30:00Z' }))
  const boundB = bind(resumableSnapshot({ sessionId: 'browser-b', lastUpdated: '2026-08-21T10:30:00Z' }))
  assert.deepEqual(boundA, { 'actual:tracked-a': true })
  assert.deepEqual(boundB, { 'actual:tracked-b': true })
  const stateA = syllabusItemState({ item: fixture.timelineItems[0], hasProgress: boundA['actual:tracked-a'] })
  const stateBWhileAOwnsSnapshot = syllabusItemState({ item: fixture.timelineItems[1], hasProgress: boundA['actual:tracked-b'] })
  assert.equal(syllabusItemActions({ role: 'learner', state: stateA, hasLessonArtifact: true })[0].label, 'Continue')
  assert.equal(syllabusItemActions({ role: 'learner', state: stateBWhileAOwnsSnapshot, hasLessonArtifact: true })[1].label, 'Retry')
  assert.deepEqual(bind(resumableSnapshot({ sessionId: 'missing-browser', lastUpdated: '2026-08-21T10:30:00Z' })), {})
  assert.deepEqual(bind(resumableSnapshot({ sessionId: 'browser-a', lessonKey: 'different', lastUpdated: '2026-08-20T10:30:00Z' })), {})
})

test('reused browser session identity binds to the latest session not later than the snapshot', () => {
  const fixture = repeatedOccurrenceFixture()
  fixture.sessions[0].session_id = 'reused-browser'
  fixture.sessions[1].session_id = 'reused-browser'

  const early = bindSnapshotsToSyllabusOccurrences({
    ...fixture,
    snapshotRecords: [{ lessonKey: 'math/repeated.json', snapshot: resumableSnapshot({ sessionId: 'reused-browser', lastUpdated: '2026-08-20T12:00:00Z' }) }],
  })
  const late = bindSnapshotsToSyllabusOccurrences({
    ...fixture,
    snapshotRecords: [{ lessonKey: 'math/repeated.json', snapshot: resumableSnapshot({ sessionId: 'reused-browser', lastUpdated: '2026-08-21T12:00:00Z' }) }],
  })
  assert.deepEqual(early, { 'actual:tracked-a': true })
  assert.deepEqual(late, { 'actual:tracked-b': true })
})

test('duplicate local and server facts bind one occurrence and auto-stale repeats stay isolated', () => {
  const fixture = repeatedOccurrenceFixture()
  const snapshot = resumableSnapshot({ sessionId: 'browser-a', lastUpdated: '2026-08-20T10:30:00Z' })
  const bound = bindSnapshotsToSyllabusOccurrences({
    ...fixture,
    snapshotRecords: [
      { lessonKey: 'math/repeated.json', snapshot },
      { lessonKey: 'math/repeated.json', snapshot: { ...snapshot } },
    ],
  })
  assert.deepEqual(bound, { 'actual:tracked-a': true })
  assert.equal(syllabusItemState({ item: fixture.timelineItems[0], hasProgress: bound['actual:tracked-a'] }), 'in_progress')
  assert.equal(syllabusItemState({ item: fixture.timelineItems[1], hasProgress: bound['actual:tracked-b'] }), 'incomplete_historical')
  assert.equal(fixture.timelineItems[0].source_occurrence_id, 'syllabus:a')
})

test('snapshot source selection mirrors SnapshotService local-first restore behavior', () => {
  const local = resumableSnapshot({ sessionId: 'browser-a', lastUpdated: '2026-08-20T10:30:00Z' })
  const server = resumableSnapshot({ sessionId: 'browser-b', lastUpdated: '2026-08-21T10:30:00Z' })
  assert.equal(selectSnapshotForRestore(local, server), local)
  assert.equal(selectSnapshotForRestore(null, server), server)
  assert.equal(selectSnapshotForRestore(null, null), null)
})

test('completed lesson and completed test checkpoints are not made resumable by stale snapshots', () => {
  const completedTest = {
    currentPhase: 'test',
    completedPhases: ['test'],
    phaseData: { test: { answers: [{ isCorrect: true }], completedAt: '2026-08-20T11:00:00Z' } },
  }
  assert.equal(snapshotHasMeaningfulProgress(completedTest), false)
  assert.equal(snapshotHasMeaningfulProgress({ currentPhase: 'closing', phaseData: {} }), false)
  assert.equal(syllabusItemState({
    item: { actual_kind: 'completed', planned_date: '2026-08-20' },
    today: '2026-08-26',
    hasProgress: true,
  }), 'completed_historical')
})

test('snapshot discovery includes historical Syllabus lessons outside the active library', () => {
  const active = {
    math: [{ lessonKey: 'math/current.json', file: 'current.json' }],
    demo: [{ lessonKey: 'demo/example.json', file: 'example.json' }],
  }
  const historical = { lessonKey: 'history/past.json', file: 'past.json' }
  const candidates = snapshotCandidateLessons(
    active,
    [{ lesson_key: 'history/past.json' }, { lesson_key: 'history/missing.json' }],
    { 'history/past.json': historical },
  )

  assert.deepEqual(candidates.map((lesson) => lesson.lessonKey).sort(), [
    'history/past.json',
    'math/current.json',
  ])
})

test('legacy auto-stale or explicit incomplete history cannot suppress independently valid progress', () => {
  for (const terminalEvent of [
    { event_type: 'incomplete', metadata: { reason: 'auto-marked-stale' } },
    { event_type: 'incomplete', metadata: { reason: 'learner-exit' } },
    { event_type: 'exited', metadata: {} },
  ]) {
    assert.equal(terminalEvent.event_type === 'completed', false)
    assert.equal(syllabusItemState({
      item: { actual_kind: 'incomplete', planned_date: '2026-08-20' },
      today: '2026-08-26',
      hasProgress: true,
    }), 'in_progress')
  }
})

test('learner continuation carries source occurrence while Retry and repeat keep a new-attempt identity', () => {
  const document = fs.readFileSync(path.resolve(TEST_DIR, '../../../components/syllabus/SyllabusDocument.js'), 'utf8')
  const learner = fs.readFileSync(path.resolve(TEST_DIR, '../../../learn/LearnerHome.js'), 'utf8')
  assert.match(document, /syllabus_state: state/)
  assert.match(learner, /resumeExistingWork && item\?\.source_occurrence_id[\s\S]*item\.source_occurrence_id[\s\S]*item\?\.occurrence_id/)
  assert.match(learner, /execution_occurrence_id \|\| syllabusOccurrence\?\.occurrence_id/)
  assert.match(learner, /syllabusPayload\?\.timeline_items[\s\S]*allHistoryKeys = \[\.\.\.new Set\(\[\.\.\.completedKeys, \.\.\.inProgressKeys, \.\.\.syllabusKeys\]\)\]/)
  assert.match(learner, /setSyllabusLaunchError/)
  assert.match(learner, /role="alert"/)
  assert.match(learner, /if \(!exceptionApproved\) return[\s\S]*const resumeExistingWork/)
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
  assert.match(learnerHome, /occurrenceId: syllabusOccurrence\?\.execution_occurrence_id \|\| syllabusOccurrence\?\.occurrence_id \|\| ''/)
})

test('new Syllabus UI source contains required readable labels and no mojibake', () => {
  const source = fs.readFileSync(path.resolve(TEST_DIR, '../../../components/syllabus/SyllabusDocument.js'), 'utf8')
  for (const label of ['PAST / SYLLABUS RECORD', 'NOW / YOU ARE HERE', 'FUTURE / FORECAST', 'Weekly learning plan', 'Previous week', 'This week', 'Next week', 'Plan ahead']) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.doesNotMatch(source, /\uFFFD|Ã|Â|â€|â€™|â†/u)
  assert.doesNotMatch(source, /Mastery proposals for general review|Mastery note|proposedReforecast/)
  assert.match(source, /week\.days\.map/)
  assert.doesNotMatch(source, /timeline\.weeks\.map/)
})

test('inactive learning forecast projects only into its exact selected target week without changing authority', () => {
  const items = [
    { id: 'a', lineage_id: 'lineage-a', origin: 'learning_forecast', lesson_key: null, planned_date: '2026-09-07', sort_order: 1 },
    { id: 'b', lineage_id: 'lineage-b', origin: 'learning_forecast', lesson_key: null, planned_date: '2026-09-08', sort_order: 0 },
    { id: 'active', lineage_id: 'active', origin: 'facilitator', lesson_key: null, planned_date: '2026-09-09', sort_order: 0 },
    { id: 'ready', lineage_id: 'ready', origin: 'learning_forecast', lesson_key: 'generated/ready.json', planned_date: '2026-09-10', sort_order: 0 },
  ]
  assert.deepEqual(projectLearningForecastForWeek(items, { selectedWeekStart: '2026-08-31', targetWeekStart: '2026-09-07' }), [])
  const projected = projectLearningForecastForWeek(items, { selectedWeekStart: '2026-09-09', targetWeekStart: '2026-09-07' })
  assert.deepEqual(projected.map((item) => item.lineage_id), ['lineage-a', 'lineage-b'])
  assert.ok(projected.every((item) => item.presentation_kind === 'suggested_inactive'))
  assert.equal(items[0].presentation_kind, undefined)
})

test('active and suggested entries share deterministic exact-slot ordering inside a Syllabus day', () => {
  const presentation = syllabusDayPresentation(
    [{ occurrence_id: 'active-1', sort_order: 1 }, { occurrence_id: 'active-0', sort_order: 0 }],
    [{ lineage_id: 'suggested-2', sort_order: 2 }, { lineage_id: 'suggested-1', sort_order: 1 }],
  )
  assert.deepEqual(presentation.map(({ kind, item }) => `${item.sort_order}:${kind}`), [
    '0:active', '1:active', '1:suggested', '2:suggested',
  ])
})

test('Free initial Syllabus establishment is review-only in the retained editor', () => {
  const source = fs.readFileSync(path.resolve(TEST_DIR, '../../../facilitator/syllabus/page.js'), 'utf8')
  assert.match(source, /draft && planningAccess\.can_change_intent \? <textarea/)
  assert.match(source, /draft && planningAccess\.can_change_intent \? <><ul/)
  assert.match(source, /disabled={!planningAccess\.can_change_intent}/)
  assert.match(source, /canActivateDraft = establishingFirstSyllabus \? planningAccess\.can_establish_syllabus : planningAccess\.can_change_intent/)
  assert.match(source, /establishFromCurrentPlan: true/)
})
