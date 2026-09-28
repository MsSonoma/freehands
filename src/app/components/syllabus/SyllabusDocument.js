'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addSyllabusDays,
  dateOnly,
  moveSyllabusWeek,
  selectSyllabusWeek,
  startOfSyllabusWeek,
  syllabusDayPresentation,
  syllabusItemState,
} from '@/app/lib/syllabus/timeline.mjs'
import { instructionalTeacherIcon, instructionalTeacherLabel, normalizeInstructionalTeacher } from '@/app/lib/syllabus/instructionalTeacher.mjs'
import { normalizeReviewTeacher, normalizeReviewTeacherSelection, reviewTeacherIcon, reviewTeacherLabel, reviewTeacherSelectionIcon, reviewTeacherSelectionLabel } from '@/app/lib/reviewTeacher.js'
import { canAddLessonToSyllabusDay } from '@/app/lib/syllabus/syllabusScheduling.mjs'
import { learnerNowViewportKey, shouldEstablishLearnerNowViewport } from '@/app/lib/syllabus/learnerPresentation.mjs'
import { noSchoolReasonMap } from '@/app/lib/syllabus/noSchoolDates.mjs'
import { buildFuturePlanningProjection } from '@/app/lib/syllabus/futurePlanningProjection.mjs'
import { instructionalForecastMode } from '@/app/lib/syllabus/forecastWindow.mjs'
import { isUngeneratedSyllabusLesson, lessonGenerationPresentation } from '@/app/lib/syllabus/lessonGenerationState.mjs'
import { groupSyllabusCalendarItems, syllabusCalendarItemCompleted } from '@/app/lib/syllabus/calendarProjection.mjs'
import { acquirePageScrollLock } from '@/app/lib/scrollLock.mjs'
import styles from './SyllabusDocument.module.css'

const STATE_COPY = {
  past: { eyebrow: 'PAST / SYLLABUS RECORD', title: 'Learning record' },
  now: { eyebrow: 'NOW / YOU ARE HERE', title: 'This week' },
  future: { eyebrow: 'FUTURE / SYLLABUS', title: 'Coming up' },
}


function prettyDate(value, options) {
  return new Date(`${dateOnly(value)}T12:00:00.000Z`).toLocaleDateString(undefined, { timeZone: 'UTC', ...options })
}

function localCalendarDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function monthStartFor(value) {
  const date = dateOnly(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(0, 7)}-01` : ''
}

function moveSyllabusMonth(value, offset) {
  const monthStart = monthStartFor(value)
  if (!monthStart) return ''
  const [year, month] = monthStart.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + Number(offset || 0), 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function monthEndFor(value) {
  const monthStart = monthStartFor(value)
  if (!monthStart) return ''
  const [year, month] = monthStart.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function monthCalendarSlots(value) {
  const monthStart = monthStartFor(value)
  if (!monthStart) return []
  const [year, month] = monthStart.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return [
    ...Array.from({ length: firstWeekday }, () => ''),
    ...Array.from({ length: totalDays }, (_, index) => `${monthStart.slice(0, 8)}${String(index + 1).padStart(2, '0')}`),
  ]
}

function monthStateFor(value, today) {
  const monthStart = monthStartFor(value)
  const currentMonth = monthStartFor(today)
  if (!monthStart || !currentMonth || monthStart === currentMonth) return 'now'
  return monthStart < currentMonth ? 'past' : 'future'
}

function isReviewProjectionItem(item = {}) {
  return ['review', 'review_history', 'slate_review_history'].includes(item.item_type)
}

function monthItemTitle(item = {}) {
  if (item.item_type === 'review_history' || item.item_type === 'slate_review_history') {
    if (item.item_type === 'slate_review_history') return 'Daily Review'
    const reviews = Array.isArray(item.reviews) ? item.reviews : []
    const types = new Set(reviews.map((review) => review?.review_type).filter(Boolean))
    if (types.size === 1 && types.has('weekly_review')) return 'Weekly Review'
    if (types.size === 1 && types.has('daily_review')) return 'Daily Review'
    if (types.size === 1 && types.has('daily_followup')) return 'Daily Follow-Up'
    return 'Reviews'
  }
  if (item.item_type === 'review') {
    if (item.review_type === 'weekly_review') return 'Weekly Review'
    if (item.review_type === 'daily_review') return 'Daily Review'
    return 'Daily Follow-Up'
  }
  if (item.item_type === 'slate_assignment') return 'Daily Review'
  return item.title || item.subject || 'Lesson'
}

function monthItemStatus(item = {}) {
  if (isReviewProjectionItem(item) || item.item_type === 'slate_assignment') return reviewCardStatus(item)
  if (isUngeneratedSyllabusLesson(item)) return lessonGenerationPresentation(item).label
  if (item.actual_kind === 'completed' || item.historical_record === true) return 'completed'
  if (item.actual_kind === 'in_progress') return 'in progress'
  if (item.actual_kind === 'incomplete') return 'incomplete'
  return item.readiness_state ? String(item.readiness_state).replaceAll('_', ' ') : 'planned'
}

function monthItemTeacherText(item = {}) {
  if (item.item_type === 'review_history' || item.item_type === 'slate_review_history') {
    const entries = item.item_type === 'slate_review_history' ? (item.slate_completions || []) : (item.reviews || [])
    return reviewTeacherText(entries)
  }
  if (item.item_type === 'review' || item.item_type === 'slate_assignment') return reviewTeacherTextForItem(item)
  const teacher = normalizeInstructionalTeacher(item.actual_instructional_teacher || item.assigned_instructional_teacher || item.instructional_teacher) || 'sonoma'
  return `${instructionalTeacherIcon(teacher)} ${instructionalTeacherLabel(teacher)}`
}

function reviewCardStatus(item = {}) {
  if (item.item_type === 'review_history' || item.item_type === 'slate_review_history') return 'completed'
  if (item.item_type === 'slate_assignment') return item.readiness_state === 'completed' || item.actual_kind === 'completed' ? 'ready' : 'planned'
  if (item.review_status === 'completed') return 'completed'
  return item.review_status === 'pending_lessons' ? 'planned' : 'ready'
}

function reviewTeacherText(entries = []) {
  const teachers = [...new Set((entries || []).map((entry) => normalizeReviewTeacher(entry?.review_teacher)))]
  return teachers.map((teacher) => `${reviewTeacherIcon(teacher)} ${reviewTeacherLabel(teacher)}`).join(' / ')
}

function reviewTeacherTextForItem(item = {}) {
  const teacher = normalizeReviewTeacherSelection(item.review_teacher)
  return `${reviewTeacherSelectionIcon(teacher)} ${reviewTeacherSelectionLabel(teacher)}`
}


function curriculumForecastLabel(item) {
  const guidance = item?.metadata?.learning_forecast?.curriculum_guidance
  if (!guidance) return ''
  const exposure = Number(guidance.exposure_number || 0)
  if (guidance.decision_kind === 'recovery') return exposure ? `Recovery follow-up ${exposure} of 3` : 'Recovery follow-up'
  if (guidance.decision_kind === 'return') return 'Intentional return'
  if (guidance.decision_kind === 'new_required') return 'Required curriculum'
  if (guidance.decision_kind === 'goal') return 'Personal goal'
  if (guidance.decision_kind === 'enrichment') return 'Enrichment'
  if (guidance.decision_kind === 'carry') return 'Unfinished lesson'
  return ''
}

function ForecastSuggestion({ item, generating, recoveryRequired, suggested = true, onSelect }) {
  const generation = lessonGenerationPresentation(item, { busy: generating, recoveryRequired })
  const curriculumLabel = curriculumForecastLabel(item)
  return <div
    className={`${styles.suggestedEntry} ${onSelect ? styles.selectableEntry : ''}`}
    data-forecast-lineage={item.lineage_id}
    role={onSelect ? 'button' : undefined}
    tabIndex={onSelect ? 0 : undefined}
    aria-label={onSelect ? `Open AI forecast suggestion details for ${item.title}` : undefined}
    onClick={onSelect ? () => onSelect(item, { suggested, recoveryRequired: recoveryRequired || item.generation_status === 'recovery_required' }) : undefined}
    onKeyDown={onSelect ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item, { suggested, recoveryRequired: recoveryRequired || item.generation_status === 'recovery_required' }) } } : undefined}
  >
    <div className={styles.entryBody}>
      <p className={styles.subject}>{item.subject}</p>
      <h4>{item.title}</h4>
      <span className={styles.suggestedLabel}>{curriculumLabel ? `${curriculumLabel} - ${generation.label}` : generation.label}</span>
    </div>
    {onSelect && <span className={styles.entryChevron} aria-hidden="true">&rsaquo;</span>}
  </div>
}
export default function SyllabusDocument({
  revision,
  forecastItems,
  timelineItems = null,
  role,
  learnerId = '',
  learnerName = '',
  onOpenLearners = null,
  lessonState = () => ({ hasLessonArtifact: false, hasProgress: false }),
  onSelectLesson = null,
  onSelectReview = null,
  onDayAction = null,
  onAddLesson = null,
  noSchoolDates = [],
  onEditSection = null,
  showPlanDetails = false,
  proposedForecastItems = [],
  proposedForecastTargetWeek = '',
  forecastWindowEnd = '',
  onRetryForecast = null,
  onForecastWeek = null,
  forecastBusy = false,
  forecastError = '',
  forecastMessage = '',
  materializingForecastLineage = '',
  isForecastRecoveryRequired = () => false,
  planningBusy = false,
  onWeekChange = null,
  restoreWeekStart = '',
  focusPlannedDate = '',
  focusLessonKey = '',
  focusOccurrenceId = '',
  openFocusedLesson = true,
  contentLoading = false,
  initialView = 'week',
  today = localCalendarDate(),
}) {
  const visibleItems = Array.isArray(timelineItems) ? timelineItems : (forecastItems || [])
  const noSchoolByDate = useMemo(() => noSchoolReasonMap(noSchoolDates), [noSchoolDates])
  const dayAction = onDayAction || onAddLesson
  const startedOccurrenceIds = useMemo(() => new Set(visibleItems
    .filter((item) => item?.placement_kind === 'actual' && item?.historical_record !== true && item?.source_occurrence_id)
    .map((item) => String(item.source_occurrence_id))), [visibleItems])
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfSyllabusWeek(restoreWeekStart) || moveSyllabusWeek(null, 'now', today))
  const [viewMode, setViewMode] = useState(() => initialView === 'month' ? 'month' : 'week')
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.dispatchEvent(new CustomEvent('ms:syllabus:view-changed', { detail: { view: viewMode } })) } catch {}
  }, [viewMode])
  const [selectedMonthStart, setSelectedMonthStart] = useState(() => monthStartFor(restoreWeekStart || today))
  const [selectedMonthDate, setSelectedMonthDate] = useState('')
  const selectedWeekRef = useRef(null)
  const establishedNowViewportKeyRef = useRef('')
  const resolvedFocusRef = useRef('')
  const initialViewRef = useRef(initialView)
  useEffect(() => setSelectedWeekStart(startOfSyllabusWeek(restoreWeekStart) || moveSyllabusWeek(null, 'now', today)), [learnerId, restoreWeekStart, today])
  useEffect(() => {
    if (initialViewRef.current === initialView) return
    initialViewRef.current = initialView
    setViewMode(initialView === 'month' ? 'month' : 'week')
    if (initialView === 'month') setSelectedMonthStart(monthStartFor(restoreWeekStart || today))
    setSelectedMonthDate('')
  }, [initialView, restoreWeekStart, today])
  useEffect(() => { setSelectedMonthDate('') }, [learnerId])
  useEffect(() => selectedMonthDate ? acquirePageScrollLock() : undefined, [selectedMonthDate])
  useEffect(() => {
    if (!selectedMonthDate) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') setSelectedMonthDate('') }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedMonthDate])
  const week = useMemo(() => selectSyllabusWeek(visibleItems, { weekStart: selectedWeekStart, today }), [visibleItems, selectedWeekStart, today])
  const nowViewportKey = learnerNowViewportKey({
    role,
    learnerId,
    revisionId: revision?.id || (revision?.revision_number ? `revision-${revision.revision_number}` : ''),
    weekState: week.state,
    weekStart: week.week_start,
  })
  useEffect(() => {
    if (!shouldEstablishLearnerNowViewport(nowViewportKey, establishedNowViewportKeyRef.current) || !selectedWeekRef.current) return
    establishedNowViewportKeyRef.current = nowViewportKey
    selectedWeekRef.current.scrollIntoView({ block: 'start', inline: 'nearest' })
  }, [nowViewportKey])
  const forecastStart = dateOnly(proposedForecastTargetWeek)
  const forecastEnd = dateOnly(forecastWindowEnd) || (forecastStart ? addSyllabusDays(forecastStart, 6) : '')
  const isForecastWeek = Boolean(forecastStart) && week.week_start <= forecastEnd && addSyllabusDays(week.week_start, 6) >= forecastStart
  const planningProjection = useMemo(() => buildFuturePlanningProjection({
    weeklyPattern: revision?.weekly_pattern,
    timelineItems: visibleItems,
    proposedForecastItems: proposedForecastItems.filter((item) => !forecastStart || (dateOnly(item.planned_date) >= forecastStart && dateOnly(item.planned_date) <= forecastEnd)),
    noSchoolDates,
    rangeStart: week.week_start,
    rangeEnd: addSyllabusDays(week.week_start, 6),
    today,
    includeOpenSlots: false,
  }), [revision?.weekly_pattern, visibleItems, proposedForecastItems, noSchoolDates, week.week_start, week.state, role, today, forecastStart, forecastEnd])
  const projectedForecast = planningProjection.forecast_items
  const monthStart = selectedMonthStart || monthStartFor(week.week_start || today)
  const monthEnd = monthEndFor(monthStart)
  const monthState = monthStateFor(monthStart, today)
  const monthSlots = useMemo(() => monthCalendarSlots(monthStart), [monthStart])
  const monthItemsByDate = useMemo(() => groupSyllabusCalendarItems(visibleItems, {
    proposedForecastItems: proposedForecastItems.filter((item) => !forecastStart || (dateOnly(item.planned_date) >= forecastStart && dateOnly(item.planned_date) <= forecastEnd)),
    noSchoolDates,
  }), [visibleItems, proposedForecastItems, noSchoolDates, forecastStart, forecastEnd])
  const selectedMonthItems = selectedMonthDate ? (monthItemsByDate[selectedMonthDate] || []) : []
  const openMonthView = () => {
    setSelectedMonthStart(monthStartFor(week.week_start || today))
    setSelectedMonthDate('')
    setViewMode('month')
  }
  const openWeekView = () => {
    setSelectedMonthDate('')
    setViewMode('week')
  }
  const moveMonth = (offset) => {
    setSelectedMonthDate('')
    setSelectedMonthStart((current) => moveSyllabusMonth(current || today, offset))
  }
  const selectMonthItem = (item) => {
    setSelectedMonthDate('')
    if (isReviewProjectionItem(item)) {
      onSelectReview?.(item)
      return
    }
    if (typeof onSelectLesson !== 'function') return
    if (isUngeneratedSyllabusLesson(item)) {
      onSelectLesson(item, {
        suggested: item?.planning_state === 'forecast' || item?.presentation_kind === 'suggested_inactive',
        recoveryRequired: isForecastRecoveryRequired(item) || item?.generation_status === 'recovery_required',
      })
      return
    }
    const lessonSnapshot = lessonState(item) || {}
    const currentLesson = {
      ...lessonSnapshot,
      hasProgress: item.actual_kind === 'in_progress' ? true : item.actual_kind === 'completed' ? false : Boolean(lessonSnapshot.hasProgress),
    }
    const state = syllabusItemState({ item, today, hasProgress: currentLesson.hasProgress })
    const occurrenceKey = item.occurrence_id || item.id || `${item.lineage_id}-${item.planned_date}`
    const assignedTeacher = normalizeInstructionalTeacher(item.actual_instructional_teacher || item.assigned_instructional_teacher || item.instructional_teacher) || 'sonoma'
    const historicalActivityAllowed = item.historical_record !== true && item.placement_kind !== 'actual'
    const teacherEditable = Boolean(item.lesson_key)
      && item.placement_kind !== 'actual'
      && item.historical_record !== true
      && !startedOccurrenceIds.has(String(occurrenceKey))
    onSelectLesson(item, { syllabus_state: state, currentLesson, teacherEditable, historicalActivityAllowed, occurrenceKey, assignedTeacher })
  }
  useEffect(() => {
    if (!openFocusedLesson || role !== 'facilitator' || typeof onSelectLesson !== 'function' || (!focusOccurrenceId && !focusLessonKey)) return
    const match = planningProjection.items.find((candidate) => {
      const candidateOccurrence = String(candidate?.occurrence_id || candidate?.id || '')
      const sourceOccurrence = String(candidate?.source_occurrence_id || '')
      if (focusOccurrenceId && (candidateOccurrence === String(focusOccurrenceId) || sourceOccurrence === String(focusOccurrenceId))) return true
      return focusLessonKey && String(candidate?.lesson_key || '') === String(focusLessonKey) && (!focusPlannedDate || dateOnly(candidate?.planned_date) === dateOnly(focusPlannedDate))
    })
    if (!match) return
    const signature = `${learnerId}:${week.week_start}:${focusPlannedDate}:${focusOccurrenceId}:${focusLessonKey}`
    if (resolvedFocusRef.current === signature) return
    resolvedFocusRef.current = signature
    const lessonSnapshot = lessonState(match) || {}
    const currentLesson = {
      ...lessonSnapshot,
      hasProgress: match.actual_kind === 'in_progress' ? true : match.actual_kind === 'completed' ? false : Boolean(lessonSnapshot.hasProgress),
    }
    const state = syllabusItemState({ item: match, today, hasProgress: currentLesson.hasProgress })
    const occurrenceKey = match.occurrence_id || match.id || `${match.lineage_id}-${match.planned_date}`
    const assignedTeacher = normalizeInstructionalTeacher(match.actual_instructional_teacher || match.assigned_instructional_teacher || match.instructional_teacher) || 'sonoma'
    const historicalActivityAllowed = match.historical_record !== true && match.placement_kind !== 'actual'
    const teacherEditable = Boolean(match.lesson_key)
      && match.placement_kind !== 'actual'
      && match.historical_record !== true
      && !startedOccurrenceIds.has(String(occurrenceKey))
    onSelectLesson(match, { syllabus_state: state, currentLesson, teacherEditable, historicalActivityAllowed, occurrenceKey, assignedTeacher })
  }, [focusLessonKey, focusOccurrenceId, focusPlannedDate, openFocusedLesson, learnerId, lessonState, onSelectLesson, planningProjection.items, role, startedOccurrenceIds, today, week.week_start])
  useEffect(() => { onWeekChange?.(week.week_start, week.state) }, [onWeekChange, week.week_start, week.state])
  const copy = STATE_COPY[week.state]
  const selectedForecastMode = instructionalForecastMode(today, week.week_start)
  const weekRangeLabel = `${prettyDate(week.days[0]?.date || week.week_start, { month: 'short', day: 'numeric' })} - ${prettyDate(week.days.at(-1)?.date || week.week_start, { month: 'short', day: 'numeric', year: 'numeric' })}`
  const move = (action) => setSelectedWeekStart((weekStart) => moveSyllabusWeek(weekStart, action, today))
  return (
    <article className={styles.document} aria-label={`${learnerName || 'Learner'} Syllabus`}>
      <header className={styles.documentHeader}>
        <div>
          <h2>{learnerName ? `${learnerName}'s Syllabus` : 'My Syllabus'}</h2>
          <p>Weekly learning plan</p>
        </div>
        {role === 'facilitator' && <div className={styles.documentHeaderActions}>
          {typeof onOpenLearners === 'function' && <div className={styles.changeLearnerControl}>
            <button type="button" className={styles.changeLearnerButton} aria-haspopup="dialog" onClick={onOpenLearners}>Learners</button>
          </div>}
          {showPlanDetails && <button type="button" className={styles.planDetailsButton} disabled={!onEditSection} onClick={onEditSection ? () => onEditSection('plan_details') : undefined}>Plan details</button>}
        </div>}
      </header>

      {viewMode === 'week' && <>
      <nav className={styles.timelineNav} aria-label="Syllabus timeline navigation">
        <button type="button" onClick={() => move('earlier')}>&larr; Previous week</button>
        <button type="button" className={week.state === 'now' ? styles.nowButton : ''} onClick={() => move('now')}>This week</button>
        <button type="button" onClick={() => move('later')}>Next week &rarr;</button>
      </nav>

      <section ref={selectedWeekRef} className={`${styles.week} ${styles[week.state]}`} data-syllabus-selected-week={week.week_start} aria-live="polite">
        <header className={styles.weekHeader}>
          <div>
            <p className={styles.stateLabel}>{copy.eyebrow}</p>
            <h3>{copy.title}</h3>
          </div>
          <div className={styles.weekHeaderActions}><time dateTime={week.week_start}>{weekRangeLabel}</time>{role === 'facilitator' && <button type="button" className={styles.viewToggleButton} onClick={openMonthView}>Month view</button>}{role === 'facilitator' && selectedForecastMode === 'manual' && onForecastWeek && <button type="button" className={styles.forecastButton} disabled={forecastBusy} onClick={() => onForecastWeek(week.week_start)}>Forecast</button>}</div>
        </header>
        {isForecastWeek && role === 'facilitator' && <div className={styles.forecastIntro}>
          <span>Grey lessons are Ms. Sonoma&apos;s suggestions for open dates in the coming seven days. Open a suggestion to generate it, change it, or create your own lesson.</span>
        </div>}

        <div className={styles.entries} data-selected-week={week.week_start} aria-busy={contentLoading ? 'true' : undefined}>
          {contentLoading && <div className={styles.loadingEntries} role="status" aria-live="polite"><strong>Loading Syllabus contents</strong><span>Bringing in this learner&apos;s current lessons and history.</span><i /><i /><i /></div>}
          {!contentLoading && week.days.map((day) => {
            const isNoSchool = Object.prototype.hasOwnProperty.call(noSchoolByDate, day.date)
            const suggestions = isNoSchool ? [] : projectedForecast.filter((item) => dateOnly(item.planned_date) === day.date)
            const presentations = syllabusDayPresentation(day.items, suggestions)
            const dayActionAllowed = canAddLessonToSyllabusDay({
              role,
              day: day.date,
              today,
              schedulingAllowed: typeof dayAction === 'function',
            })
            return <section className={`${styles.day} ${isNoSchool ? styles.dayOff : ''}`} key={day.date} data-syllabus-day={day.date} data-no-school={isNoSchool ? 'true' : undefined}>
            <header><time dateTime={day.date}>{prettyDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}</time>{day.date === dateOnly(today) && <span>Today</span>}{dayActionAllowed && <button type="button" className={styles.addLesson} aria-label={`Plan ${prettyDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}`} title="Add lesson or mark day off" onClick={() => dayAction(day.date)}>+</button>}</header>
            {isNoSchool && <div className={styles.dayOffNotice}><strong>{noSchoolByDate[day.date] || 'Day off'}</strong><span>{presentations.length ? `${presentations.length} existing ${presentations.length === 1 ? 'item remains' : 'items remain'}` : 'No lessons planned'}</span>{role === 'facilitator' && typeof dayAction === 'function' && <button type="button" className={styles.dayOffAction} onClick={() => dayAction(day.date)}>Remove day off</button>}</div>}
            {!isNoSchool && presentations.length === 0 && <p className={styles.emptyDay}>{forecastBusy && day.date >= forecastStart && day.date <= forecastEnd ? 'Preparing suggestions...' : 'No lessons'}</p>}
            {presentations.map(({ kind, item }) => {
            if (item.item_type === 'review_history' || item.item_type === 'slate_review_history') {
              const reviews = Array.isArray(item.reviews) ? item.reviews : []
              const slateCompletions = Array.isArray(item.slate_completions) ? item.slate_completions : []
              const isDailyReviewHistory = item.item_type === 'slate_review_history'
              const selectableReview = Boolean(onSelectReview)
              const entries = isDailyReviewHistory ? slateCompletions : reviews
              const count = entries.length
              const reviewTypes = new Set(reviews.map((review) => review?.review_type).filter(Boolean))
              const historyLabel = isDailyReviewHistory
                ? 'Daily Review'
                : reviewTypes.size === 1 && reviewTypes.has('weekly_review')
                  ? 'Weekly Review'
                  : reviewTypes.size === 1 && reviewTypes.has('daily_review')
                    ? 'Daily Review'
                    : reviewTypes.size === 1 && reviewTypes.has('daily_followup')
                      ? 'Daily Follow-Up'
                      : 'Reviews'
              const historySubjects = [...new Set(entries.map((entry) => String(entry?.subject || '').trim()).filter(Boolean))]
              const historySubject = historySubjects.join(' · ') || 'Review'
              return (
                <div
                  className={`${styles.entryRow} ${selectableReview ? styles.selectableEntry : ''}`}
                  key={item.occurrence_id || item.id}
                  role={selectableReview ? 'button' : undefined}
                  tabIndex={selectableReview ? 0 : undefined}
                  aria-label={count > 1 ? `Open ${count} completed ${historyLabel} entries` : `Open completed ${historyLabel} entry`}
                  onClick={selectableReview ? () => onSelectReview(item) : undefined}
                  onKeyDown={selectableReview ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectReview(item)
                    }
                  } : undefined}
                >
                  <div className={styles.entryBody}>
                    <p className={styles.subject}>{historySubject}</p>
                    <h4>{historyLabel}</h4>
                    <div className={styles.cardMetaRow}><span className={styles.teacherLabel}>{reviewTeacherText(entries)}</span><span className={styles.statusLabel}>{reviewCardStatus(item)}</span></div>
                  </div>
                  {selectableReview && <span className={styles.entryChevron} aria-hidden="true">&rsaquo;</span>}
                </div>
              )
            }
            if (item.item_type === 'review') {
              const selectableReview = Boolean(onSelectReview)
              return (
                <div
                  className={`${styles.entryRow} ${selectableReview ? styles.selectableEntry : ''}`}
                  key={item.occurrence_id || item.id}
                  data-review-type={item.review_type}
                  data-review-status={item.review_status}
                  role={selectableReview ? 'button' : undefined}
                  tabIndex={selectableReview ? 0 : undefined}
                  aria-label={selectableReview ? `Open ${item.title} details` : undefined}
                  onClick={selectableReview ? () => onSelectReview(item) : undefined}
                  onKeyDown={selectableReview ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectReview(item)
                    }
                  } : undefined}
                >
                  <div className={styles.entryBody}>
                    <p className={styles.subject}>{item.subject || 'Review'}</p>
                    <h4>{item.review_type === 'weekly_review' ? 'Weekly Review' : item.review_type === 'daily_review' ? 'Daily Review' : 'Daily Follow-Up'}</h4>
                    <div className={styles.cardMetaRow}><span className={styles.teacherLabel}>{reviewTeacherTextForItem(item)}</span><span className={styles.statusLabel}>{reviewCardStatus(item)}</span></div>
                  </div>
                  {selectableReview && <span className={styles.entryChevron} aria-hidden="true">&rsaquo;</span>}
                </div>
              )
            }
            if (kind === 'suggested' || isUngeneratedSyllabusLesson(item)) return <ForecastSuggestion
              key={item.lineage_id || item.id}
              item={item}
              suggested={kind === 'suggested'}
              generating={materializingForecastLineage === item.lineage_id}
              recoveryRequired={isForecastRecoveryRequired(item)}
              onSelect={role === 'facilitator' && onSelectLesson ? onSelectLesson : null}
            />
            const lessonSnapshot = lessonState(item) || {}
            const currentLesson = {
              ...lessonSnapshot,
              hasProgress: item.actual_kind === 'in_progress' ? true : item.actual_kind === 'completed' ? false : Boolean(lessonSnapshot.hasProgress),
            }
            const state = syllabusItemState({ item, today, hasProgress: currentLesson.hasProgress })
            const occurrenceKey = item.occurrence_id || item.id || `${item.lineage_id}-${item.planned_date}`
            const resolvedTeacher = normalizeInstructionalTeacher(item.actual_instructional_teacher || item.assigned_instructional_teacher || item.instructional_teacher)
            const assignedTeacher = resolvedTeacher || 'sonoma'
            const historicalActivityAllowed = item.historical_record !== true && item.placement_kind !== 'actual'
            const teacherEditable = role === 'facilitator'
              && item.lesson_key
              && item.placement_kind !== 'actual'
              && item.historical_record !== true
              && !startedOccurrenceIds.has(String(occurrenceKey))
              && role === 'facilitator'
            return (
              <div
                className={`${styles.entryRow} ${onSelectLesson ? styles.selectableEntry : ''}`}
                key={occurrenceKey}
                data-syllabus-state={state}
                role={onSelectLesson ? 'button' : undefined}
                tabIndex={onSelectLesson ? 0 : undefined}
                aria-label={onSelectLesson ? `Open details for ${item.title}` : undefined}
                onClick={onSelectLesson ? () => onSelectLesson(item, { syllabus_state: state, currentLesson, teacherEditable, historicalActivityAllowed, occurrenceKey, assignedTeacher }) : undefined}
                onKeyDown={onSelectLesson ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectLesson(item, { syllabus_state: state, currentLesson, teacherEditable, historicalActivityAllowed, occurrenceKey, assignedTeacher }) } } : undefined}
              >
                <div className={styles.entryBody}>
                  <p className={styles.subject}>{item.subject}</p>
                  <h4>{item.item_type === 'slate_assignment' ? 'Daily Review' : item.title}</h4>
                  {item.item_type === 'slate_assignment'
                    ? <div className={styles.cardMetaRow}><span className={styles.teacherLabel}>{reviewTeacherTextForItem(item)}</span><span className={styles.statusLabel}>{reviewCardStatus(item)}</span></div>
                    : <div className={styles.cardMetaRow}><span className={styles.teacherLabel}>{instructionalTeacherIcon(assignedTeacher)} {instructionalTeacherLabel(assignedTeacher)}</span>{item.readiness_state && <span className={styles.statusLabel}>{String(item.readiness_state).replace('_', ' ')}</span>}</div>}
                  {item.item_type !== 'slate_assignment' && <>
                  {(item.slate_annotations || []).filter((annotation) => annotation?.kind !== 'retention').map((annotation) => <span className={styles.placementLabel} key={`${annotation.kind}:${annotation.label}`}>{annotation.label}</span>)}
                  {(item.historical_activity_annotations || []).filter((annotation) => annotation?.kind !== 'slate_drill_history').map((annotation) => <span className={styles.placementLabel} key={annotation.kind + ':' + annotation.label}>{annotation.label}</span>)}
                  {item.placement_kind === 'scheduled' && <span className={styles.placementLabel}>Calendar date</span>}
                  {item.placement_kind === 'inferred' && <span className={styles.placementLabel}>Provisional weekly-pattern placement</span>}
                  {item.needs_placement && <span className={styles.placementLabel}>{role === 'facilitator' ? 'Needs placement' : 'Timing to be confirmed'}</span>}
                  {item.actual_kind === 'incomplete' && <span className={styles.placementLabel}>Incomplete</span>}
                  {item.capacity_conflict && <span className={styles.placementLabel}>Manual capacity exception</span>}
                  {item.requires_facilitator_carry && item.is_overdue_intent && <span className={styles.placementLabel}>Needs facilitator carry from {prettyDate(item.original_placement_date, { month: 'short', day: 'numeric' })}</span>}
                  {item.origin === 'mastery_reforecast' && <span className={styles.statusLabel}>Mastery follow-up</span>}
                  </>}
                </div>
                {onSelectLesson && <span className={styles.entryChevron} aria-hidden="true">&rsaquo;</span>}
                {item.item_type !== 'slate_assignment' && role === 'learner' && week.state === 'now' && item.lesson_key && ['draft', 'approved', 'saved'].includes(item.readiness_state) && !currentLesson.hasLessonArtifact && <span className={styles.preparing}>Preparing</span>}
              </div>
            )
          })}
          </section>
          })}
        </div>
        {!contentLoading && isForecastWeek && role === 'facilitator' && (forecastBusy || forecastError || (!forecastBusy && !forecastError && projectedForecast.length === 0 && forecastMessage)) && <div className={styles.forecastStatus}>
          {forecastBusy && <p role="status">Preparing lesson suggestions for the coming seven days...</p>}
          {!forecastBusy && forecastError && <div role="alert"><p>Lesson suggestions could not be prepared. Your existing lessons are unchanged.</p>{onRetryForecast && <button type="button" disabled={planningBusy} onClick={onRetryForecast}>Retry forecast</button>}</div>}
          {!forecastBusy && !forecastError && projectedForecast.length === 0 && forecastMessage && <p>{forecastMessage}</p>}
        </div>}
      </section>

      {week.state === 'future' && role === 'learner' && <p className={styles.learnerFuture}>You can see where learning may go next. Your facilitator manages future planning.</p>}
      </>}

      {viewMode === 'month' && <>
        <nav className={styles.timelineNav} aria-label="Syllabus month navigation">
          <button type="button" onClick={() => moveMonth(-1)}>&larr; Previous month</button>
          <button type="button" className={monthState === 'now' ? styles.nowButton : ''} onClick={() => { setSelectedMonthDate(''); setSelectedMonthStart(monthStartFor(today)) }}>This month</button>
          <button type="button" onClick={() => moveMonth(1)}>Next month &rarr;</button>
        </nav>

        <section className={`${styles.week} ${styles[monthState]} ${styles.monthView}`} data-syllabus-selected-month={monthStart} aria-live="polite">
          <header className={styles.weekHeader}>
            <div>
              <p className={styles.stateLabel}>{STATE_COPY[monthState].eyebrow}</p>
              <h3>{monthState === 'now' ? 'This month' : prettyDate(monthStart, { month: 'long', year: 'numeric' })}</h3>
            </div>
            <div className={styles.weekHeaderActions}>
              <time dateTime={monthStart}>{prettyDate(monthStart, { month: 'short', day: 'numeric' })} - {prettyDate(monthEnd, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
              <button type="button" className={styles.viewToggleButton} onClick={openWeekView}>Week view</button>
            </div>
          </header>

          {contentLoading && <div className={styles.loadingEntries} role="status" aria-live="polite"><strong>Loading Syllabus contents</strong><span>Bringing in this learner&apos;s current lessons and history.</span><i /><i /><i /></div>}
          {!contentLoading && <div className={styles.monthScroller}>
            <div className={styles.monthWeekdays} aria-hidden="true">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className={styles.monthGrid}>
              {monthSlots.map((day, index) => {
                if (!day) return <div className={styles.monthBlank} key={`blank-${index}`} />
                const items = monthItemsByDate[day] || []
                const isNoSchool = Object.prototype.hasOwnProperty.call(noSchoolByDate, day)
                const dayActionAllowed = canAddLessonToSyllabusDay({ role, day, today, schedulingAllowed: typeof dayAction === 'function' })
                return <section
                  className={`${styles.monthCell} ${isNoSchool ? styles.monthCellOff : ''} ${day === dateOnly(today) ? styles.monthCellToday : ''}`}
                  key={day}
                  data-syllabus-day={day}
                  data-no-school={isNoSchool ? 'true' : undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${prettyDate(day, { weekday: 'long', month: 'long', day: 'numeric' })}`}
                  onClick={() => setSelectedMonthDate(day)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedMonthDate(day) } }}
                >
                  <header className={styles.monthCellHeader}>
                    <time dateTime={day}>{Number(day.slice(-2))}</time>
                    <span>{isNoSchool ? 'Day off' : day === dateOnly(today) ? 'Today' : items.length ? String(items.length) : ''}</span>
                    {dayActionAllowed && <button type="button" className={styles.addLesson} aria-label={`Plan ${prettyDate(day, { weekday: 'long', month: 'short', day: 'numeric' })}`} title="Add lesson or mark day off" onClick={(event) => { event.stopPropagation(); dayAction(day) }}>+</button>}
                  </header>
                  <div className={styles.monthCellItems}>
                    {items.slice(0, 3).map((item) => <span
                      className={`${styles.monthItem} ${isUngeneratedSyllabusLesson(item) ? styles.monthItemForecast : ''} ${syllabusCalendarItemCompleted(item) ? styles.monthItemCompleted : ''}`}
                      key={item.occurrence_id || item.id || item.lineage_id || `${monthItemTitle(item)}-${item.sort_order}`}
                    >{monthItemTitle(item)}</span>)}
                    {items.length > 3 && <span className={styles.monthMore}>+{items.length - 3} more</span>}
                    {!isNoSchool && items.length === 0 && <span className={styles.monthEmpty}>No lessons</span>}
                  </div>
                </section>
              })}
            </div>
          </div>}
        </section>
      </>}

      {selectedMonthDate && <div className={styles.dayOverlayBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMonthDate('') }}>
        <section className={styles.dayOverlay} role="dialog" aria-modal="true" aria-label={`Syllabus day for ${prettyDate(selectedMonthDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}>
          <header className={styles.dayOverlayHeader}>
            <div><p className={styles.stateLabel}>Syllabus day</p><h3>{prettyDate(selectedMonthDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3><span>{selectedMonthItems.length} Syllabus {selectedMonthItems.length === 1 ? 'item' : 'items'}</span></div>
            <button type="button" onClick={() => setSelectedMonthDate('')}>Close</button>
          </header>
          <div className={styles.dayOverlayBody}>
            {Object.prototype.hasOwnProperty.call(noSchoolByDate, selectedMonthDate) && <div className={styles.dayOverlayOff}><span>{noSchoolByDate[selectedMonthDate] || 'Day off'} - this date is protected from new instructional planning.</span>{role === 'facilitator' && typeof dayAction === 'function' && <button type="button" className={styles.dayOffAction} onClick={() => dayAction(selectedMonthDate)}>Remove day off</button>}</div>}
            {selectedMonthItems.length === 0 && <p className={styles.dayOverlayEmpty}>Nothing is placed on this date in the active Syllabus.</p>}
            {selectedMonthItems.map((item) => <button
              type="button"
              className={`${styles.dayOverlayItem} ${isUngeneratedSyllabusLesson(item) ? styles.dayOverlayForecast : ''}`}
              key={item.occurrence_id || item.id || item.lineage_id || `${monthItemTitle(item)}-${item.sort_order}`}
              onClick={() => selectMonthItem(item)}
            >
              <span className={styles.dayOverlayItemTop}><strong>{item.subject || (isReviewProjectionItem(item) || item.item_type === 'slate_assignment' ? 'Review' : 'Lesson')}</strong><em>{monthItemStatus(item)}</em></span>
              <b>{monthItemTitle(item)}</b>
              <span className={styles.dayOverlayTeacher}>{monthItemTeacherText(item)}</span>
            </button>)}
          </div>
        </section>
      </div>}
    </article>
  )
}
