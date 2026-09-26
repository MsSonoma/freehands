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
import { instructionalTeacherLabel, normalizeInstructionalTeacher, syllabusTeacherLabel } from '@/app/lib/syllabus/instructionalTeacher.mjs'
import { canAddLessonToSyllabusDay } from '@/app/lib/syllabus/syllabusScheduling.mjs'
import { learnerNowViewportKey, shouldEstablishLearnerNowViewport } from '@/app/lib/syllabus/learnerPresentation.mjs'
import { noSchoolReasonMap } from '@/app/lib/syllabus/noSchoolDates.mjs'
import { buildFuturePlanningProjection } from '@/app/lib/syllabus/futurePlanningProjection.mjs'
import { instructionalForecastMode } from '@/app/lib/syllabus/forecastWindow.mjs'
import { isUngeneratedSyllabusLesson, lessonGenerationPresentation } from '@/app/lib/syllabus/lessonGenerationState.mjs'
import styles from './SyllabusDocument.module.css'

const STATE_COPY = {
  past: { eyebrow: 'PAST / SYLLABUS RECORD', title: 'Learning record' },
  now: { eyebrow: 'NOW / YOU ARE HERE', title: 'This week' },
  future: { eyebrow: 'FUTURE / SYLLABUS', title: 'Coming up' },
}

const PLAN_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const PLAN_DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }

function prettyDate(value, options) {
  return new Date(`${dateOnly(value)}T12:00:00.000Z`).toLocaleDateString(undefined, { timeZone: 'UTC', ...options })
}

function localCalendarDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function subjectName(subject) {
  return String(typeof subject === 'string' ? subject : subject?.name || '').trim()
}

function weeklyPatternSubjects(pattern, day) {
  const entries = Array.isArray(pattern?.[day]) ? pattern[day] : []
  return entries.map((entry) => String(typeof entry === 'string' ? entry : entry?.subject || '').trim()).filter(Boolean)
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
  lessonState = () => ({ hasLessonArtifact: false, hasProgress: false }),
  onSelectLesson = null,
  onSelectReview = null,
  onDayAction = null,
  onAddLesson = null,
  noSchoolDates = [],
  onEditSection = null,
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
  today = localCalendarDate(),
}) {
  const visibleItems = Array.isArray(timelineItems) ? timelineItems : (forecastItems || [])
  const noSchoolByDate = useMemo(() => noSchoolReasonMap(noSchoolDates), [noSchoolDates])
  const dayAction = onDayAction || onAddLesson
  const startedOccurrenceIds = useMemo(() => new Set(visibleItems
    .filter((item) => item?.placement_kind === 'actual' && item?.historical_record !== true && item?.source_occurrence_id)
    .map((item) => String(item.source_occurrence_id))), [visibleItems])
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfSyllabusWeek(restoreWeekStart) || moveSyllabusWeek(null, 'now', today))
  const selectedWeekRef = useRef(null)
  const establishedNowViewportKeyRef = useRef('')
  const resolvedFocusRef = useRef('')
  useEffect(() => setSelectedWeekStart(startOfSyllabusWeek(restoreWeekStart) || moveSyllabusWeek(null, 'now', today)), [learnerId, restoreWeekStart, today])
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
      </header>
      <details className={styles.planDetails}>
        <summary>Plan details</summary>
        <div className={styles.planDetailsBody}>
          <section className={styles.planSection}>
            <div className={styles.planSectionHeading}><h3>Goals</h3>{role === 'facilitator' && onEditSection && <button type="button" onClick={() => onEditSection('goals')}>Edit</button>}</div>
            <p>{revision?.goals?.legacy_notes || 'No goal notes are recorded yet.'}</p>
          </section>
          <section className={styles.planSection}>
            <div className={styles.planSectionHeading}><h3>Subjects</h3>{role === 'facilitator' && onEditSection && <button type="button" onClick={() => onEditSection('subjects')}>Edit</button>}</div>
            <p>{(revision?.subjects || []).map(subjectName).filter(Boolean).join(' / ') || 'No subjects declared.'}</p>
          </section>
          <section className={`${styles.planSection} ${styles.planPatternSection}`}>
            <div className={styles.planSectionHeading}><h3>Weekly pattern</h3>{role === 'facilitator' && onEditSection && <button type="button" onClick={() => onEditSection('weekly_pattern')}>Edit</button>}</div>
            <div className={styles.planPatternScroller}><div className={styles.planPatternGrid}>
              {PLAN_DAYS.map((day) => {
                const subjects = weeklyPatternSubjects(revision?.weekly_pattern, day)
                return <div className={styles.planPatternDay} key={day}><strong>{PLAN_DAY_LABELS[day]}</strong><span>{subjects.length ? subjects.join(' / ') : <>&mdash;</>}</span></div>
              })}
            </div></div>
          </section>
          <section className={styles.planSection}>
            <div className={styles.planSectionHeading}><h3>Curriculum guidance</h3>{role === 'facilitator' && onEditSection && <button type="button" onClick={() => onEditSection('teaching_guidance')}>Edit</button>}</div>
            <div className={styles.guidanceSummary}>{revision?.planning_policy?.curriculum_contract_version_id ? <p>Requirements, personal goals, and adaptive curriculum planning are active for this Syllabus.</p> : <p>No Curriculum Guidance contract is linked yet.</p>}</div>
          </section>
        </div>
      </details>

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
          <div className={styles.weekHeaderActions}><time dateTime={week.week_start}>{weekRangeLabel}</time>{role === 'facilitator' && selectedForecastMode === 'manual' && onForecastWeek && <button type="button" className={styles.forecastButton} disabled={forecastBusy} onClick={() => onForecastWeek(week.week_start)}>Forecast</button>}</div>
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
            {isNoSchool && <div className={styles.dayOffNotice}><strong>{noSchoolByDate[day.date] || 'Day off'}</strong><span>{presentations.length ? `${presentations.length} existing ${presentations.length === 1 ? 'item remains' : 'items remain'}` : 'No lessons planned'}</span></div>}
            {!isNoSchool && presentations.length === 0 && <p className={styles.emptyDay}>{forecastBusy && day.date >= forecastStart && day.date <= forecastEnd ? 'Preparing suggestions...' : 'No lessons'}</p>}
            {presentations.map(({ kind, item }) => {
            if (item.item_type === 'review_history') {
              const reviews = Array.isArray(item.reviews) ? item.reviews : []
              const slateCompletions = Array.isArray(item.slate_completions) ? item.slate_completions : []
              const selectableReview = Boolean(onSelectReview)
              const count = reviews.length + slateCompletions.length
              return (
                <div
                  className={`${styles.entryRow} ${selectableReview ? styles.selectableEntry : ''} ${styles.reviewHistoryCard}`}
                  key={item.occurrence_id || item.id}
                  role={selectableReview ? 'button' : undefined}
                  tabIndex={selectableReview ? 0 : undefined}
                  aria-label={count > 1 ? `Open ${count} completed Mr. Slate reviews` : 'Open completed Mr. Slate review'}
                  onClick={selectableReview ? () => onSelectReview(item) : undefined}
                  onKeyDown={selectableReview ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectReview(item)
                    }
                  } : undefined}
                >
                  <div className={styles.reviewHistoryContent}>
                    <span className={styles.reviewHistoryIcon} aria-hidden="true">&#129302;</span>
                    <span className={styles.reviewHistoryLabel}>Mr. Slate{count > 1 ? ` (${count})` : ''}</span>
                  </div>
                </div>
              )
            }
            if (item.item_type === 'review') {
              const selectableReview = Boolean(onSelectReview)
              const reviewStatus = item.review_status === 'completed'
                ? 'Completed'
                : item.review_status === 'in_progress'
                  ? 'In progress'
                  : item.review_status === 'available'
                    ? 'Ready'
                    : item.review_status === 'waiting_review_material'
                      ? 'Preparing'
                      : 'Planned'
              return (
                <div
                  className={`${styles.entryRow} ${styles.reviewEntry} ${selectableReview ? styles.selectableEntry : ''}`}
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
                    <p className={styles.subject}>Review</p>
                    <h4>{item.title}</h4>
                    <span className={styles.statusLabel}>{reviewStatus}</span>
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
            const assignedTeacher = normalizeInstructionalTeacher(item.actual_instructional_teacher || item.assigned_instructional_teacher || item.instructional_teacher) || 'sonoma'
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
                  <h4>{item.title}</h4>
                  {item.item_type === 'slate_assignment' && <span className={styles.statusLabel}>Scheduled Mr. Slate supplemental session</span>}
                  {(item.item_type || 'lesson') === 'lesson' && item.historical_record
                    ? (item.actual_instructional_teacher
                        ? <span className={styles.placementLabel}>Completed with {instructionalTeacherLabel(item.actual_instructional_teacher)} historical record</span>
                        : null)
                    : (item.item_type || 'lesson') === 'lesson' && <span className={styles.placementLabel}>{role === 'learner' && item.placement_kind !== 'actual' ? `Your teacher: ${instructionalTeacherLabel(assignedTeacher)}` : syllabusTeacherLabel(item)}</span>}
                  {(item.slate_annotations || []).map((annotation) => <span className={styles.placementLabel} key={`${annotation.kind}:${annotation.label}`}>{annotation.label}</span>)}
                  {(item.historical_activity_annotations || []).filter((annotation) => annotation?.kind !== 'slate_drill_history').map((annotation) => <span className={styles.placementLabel} key={annotation.kind + ':' + annotation.label}>{annotation.label}</span>)}
                  {item.readiness_state && <span className={styles.statusLabel}>{String(item.readiness_state).replace('_', ' ')}</span>}
                  {item.placement_kind === 'scheduled' && <span className={styles.placementLabel}>Calendar date</span>}
                  {item.placement_kind === 'inferred' && <span className={styles.placementLabel}>Provisional weekly-pattern placement</span>}
                  {item.needs_placement && <span className={styles.placementLabel}>{role === 'facilitator' ? 'Needs placement' : 'Timing to be confirmed'}</span>}
                  {item.actual_kind === 'incomplete' && <span className={styles.placementLabel}>Incomplete</span>}
                  {item.capacity_conflict && <span className={styles.placementLabel}>Manual capacity exception</span>}
                  {item.requires_facilitator_carry && item.is_overdue_intent && <span className={styles.placementLabel}>Needs facilitator carry from {prettyDate(item.original_placement_date, { month: 'short', day: 'numeric' })}</span>}
                  {item.origin === 'mastery_reforecast' && <span className={styles.statusLabel}>Mastery follow-up</span>}
                </div>
                {onSelectLesson && <span className={styles.entryChevron} aria-hidden="true">&rsaquo;</span>}
                {role === 'learner' && week.state === 'now' && item.lesson_key && ['draft', 'approved', 'saved'].includes(item.readiness_state) && !currentLesson.hasLessonArtifact && <span className={styles.preparing}>Preparing</span>}
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
    </article>
  )
}
