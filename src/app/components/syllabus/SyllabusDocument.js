'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  dateOnly,
  moveSyllabusWeek,
  projectLearningForecastForWeek,
  selectSyllabusWeek,
  startOfSyllabusWeek,
  syllabusDayPresentation,
  syllabusItemState,
  weeklyPatternRows,
} from '@/app/lib/syllabus/timeline.mjs'
import { instructionalTeacherLabel, normalizeInstructionalTeacher, syllabusTeacherLabel } from '@/app/lib/syllabus/instructionalTeacher.mjs'
import { canAddLessonToSyllabusDay } from '@/app/lib/syllabus/syllabusScheduling.mjs'
import { learnerNowViewportKey, shouldEstablishLearnerNowViewport } from '@/app/lib/syllabus/learnerPresentation.mjs'
import styles from './SyllabusDocument.module.css'

const STATE_COPY = {
  past: { eyebrow: 'PAST / SYLLABUS RECORD', title: 'Learning record', note: 'Actual learner starts, completions, and incomplete work appear here. Detailed evidence belongs in History and Portfolio.' },
  now: { eyebrow: 'NOW / YOU ARE HERE', title: 'This week', note: 'The current educational position.' },
  future: { eyebrow: 'FUTURE / FORECAST', title: 'A week ahead', note: 'This is an intention and may change as learning unfolds.' },
}

function prettyDate(value, options) {
  return new Date(`${dateOnly(value)}T12:00:00.000Z`).toLocaleDateString(undefined, { timeZone: 'UTC', ...options })
}

function localCalendarDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function subjectName(subject) {
  return String(typeof subject === 'string' ? subject : subject?.name || '').trim()
}

function teachingGuidanceSummary(guidance) {
  const preferences = guidance?.curriculum_preferences || {}
  const values = []
  for (const [key, value] of Object.entries(preferences)) {
    if (key === 'subject_preferences' || !Array.isArray(value)) continue
    if (value.length) values.push(`${key.replaceAll('_', ' ')}: ${value.join(', ')}`)
  }
  for (const [subject, fields] of Object.entries(preferences.subject_preferences || {})) {
    for (const [key, value] of Object.entries(fields || {})) if (Array.isArray(value) && value.length) values.push(`${subject} ${key.replaceAll('_', ' ')}: ${value.join(', ')}`)
  }
  return values
}

function ForecastSuggestion({ item, busy, replacing, recoveryRequired, onSelect }) {
  const disabled = busy || replacing
  return <div
    className={`${styles.suggestedEntry} ${onSelect && !disabled ? styles.selectableEntry : ''}`}
    data-forecast-lineage={item.lineage_id}
    role={onSelect && !disabled ? 'button' : undefined}
    tabIndex={onSelect && !disabled ? 0 : undefined}
    aria-label={onSelect && !disabled ? `Open details for suggested ${item.title}` : undefined}
    onClick={onSelect && !disabled ? () => onSelect(item, { suggested: true, recoveryRequired }) : undefined}
    onKeyDown={onSelect && !disabled ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item, { suggested: true, recoveryRequired }) } } : undefined}
  >
    <div className={styles.entryBody}>
      <p className={styles.subject}>{item.subject}</p>
      <h4>{item.title}</h4>
      <span className={styles.suggestedLabel}>{recoveryRequired ? 'Recovery required' : 'Suggested ? not active'}</span>
    </div>
    {onSelect && !disabled && <span className={styles.entryChevron} aria-hidden="true">&rsaquo;</span>}
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
  canScheduleLessons = false,
  onOpenPlanning = null,
  onAddLesson = null,
  onEditSection = null,
  proposedForecastItems = [],
  proposedForecastTargetWeek = '',
  proposalRevision = null,
  forecastBusy = false,
  forecastActionBusy = false,
  forecastError = '',
  forecastMessage = '',
  replacingForecastLineage = '',
  materializingForecastLineage = '',
  isForecastRecoveryRequired = () => false,
  onRetryForecast = null,
  onUseForecast = null,
  onWeekChange = null,
  restoreWeekStart = '',
  today = localCalendarDate(),
}) {
  const visibleItems = Array.isArray(timelineItems) ? timelineItems : forecastItems
  const startedOccurrenceIds = useMemo(() => new Set(visibleItems
    .filter((item) => item?.placement_kind === 'actual' && item?.historical_record !== true && item?.source_occurrence_id)
    .map((item) => String(item.source_occurrence_id))), [visibleItems])
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfSyllabusWeek(restoreWeekStart) || moveSyllabusWeek(null, 'now', today))
  const selectedWeekRef = useRef(null)
  const establishedNowViewportKeyRef = useRef('')
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
  const projectedForecast = useMemo(() => projectLearningForecastForWeek(proposedForecastItems, {
    selectedWeekStart: week.week_start,
    targetWeekStart: proposedForecastTargetWeek,
  }), [proposedForecastItems, proposedForecastTargetWeek, week.week_start])
  useEffect(() => { onWeekChange?.(week.week_start, week.state) }, [onWeekChange, week.week_start, week.state])
  const copy = STATE_COPY[week.state]
  const pattern = weeklyPatternRows(revision?.weekly_pattern)
  const guidanceSummary = teachingGuidanceSummary(revision?.teaching_guidance)
  const move = (action) => setSelectedWeekStart((weekStart) => moveSyllabusWeek(weekStart, action, today))
  return (
    <article className={styles.document} aria-label={`${learnerName || 'Learner'} Syllabus`}>
      <header className={styles.documentHeader}>
        <div>
          <h2>{learnerName ? `${learnerName}'s Syllabus` : 'My Syllabus'}</h2>
          <p>Weekly learning plan</p>
        </div>
        <div className={styles.revisionMark}>Revision {revision?.revision_number || '—'}</div>
      </header>

      <div className={styles.summaryRule}>
        <section>
          <h3>Goals {role === 'facilitator' && onEditSection && <button type="button" onClick={() => onEditSection('goals')}>Edit</button>}</h3>
          <p>{revision?.goals?.legacy_notes || 'No goal notes are recorded yet.'}</p>
        </section>
        <section>
          <h3>Subjects {role === 'facilitator' && onEditSection && <button type="button" onClick={() => onEditSection('subjects')}>Manage</button>}</h3>
          <p>{(revision?.subjects || []).map(subjectName).filter(Boolean).join(' / ') || 'No subjects declared.'}</p>
        </section>
      </div>

      <details className={styles.pattern}>
        <summary>Weekly pattern {role === 'facilitator' && onEditSection && <button type="button" onClick={(event) => { event.preventDefault(); onEditSection('weekly_pattern') }}>Edit</button>}</summary>
        <div>{pattern.map((row) => <p key={row.day}><strong>{row.day}</strong><span>{row.subjects.join(' / ')}</span></p>)}</div>
      </details>

      <details className={styles.pattern}>
        <summary>Teaching guidance {role === 'facilitator' && onEditSection && <button type="button" onClick={(event) => { event.preventDefault(); onEditSection('teaching_guidance') }}>Edit</button>}</summary>
        <div>{guidanceSummary.length ? guidanceSummary.map((value) => <p key={value}>{value}</p>) : <p>No curriculum preferences are currently saved.</p>}</div>
      </details>

      <nav className={styles.timelineNav} aria-label="Syllabus timeline navigation">
        <button type="button" onClick={() => move('earlier')}>&larr; Previous week</button>
        <button type="button" className={week.state === 'now' ? styles.nowButton : ''} onClick={() => move('now')}>This week</button>
        <button type="button" onClick={() => move('later')}>Next week &rarr;</button>
        {role === 'facilitator' && onOpenPlanning && <button type="button" className={styles.planAheadButton} onClick={onOpenPlanning}>Plan ahead</button>}
      </nav>

      <section ref={selectedWeekRef} className={`${styles.week} ${styles[week.state]}`} data-syllabus-selected-week={week.week_start} aria-live="polite">
        <header className={styles.weekHeader}>
          <div>
            <p className={styles.stateLabel}>{copy.eyebrow}</p>
            <h3>{copy.title}</h3>
            <p>{copy.note}</p>
          </div>
          <time dateTime={week.week_start}>Week of {prettyDate(week.week_start, { month: 'long', day: 'numeric', year: 'numeric' })}</time>
        </header>

        <div className={styles.entries} data-selected-week={week.week_start}>
          {week.days.map((day) => {
            const suggestions = projectedForecast.filter((item) => dateOnly(item.planned_date) === day.date)
            const presentations = syllabusDayPresentation(day.items, suggestions)
            const addLessonAllowed = canAddLessonToSyllabusDay({
              role,
              day: day.date,
              today,
              schedulingAllowed: canScheduleLessons === true && typeof onAddLesson === 'function',
            })
            return <section className={styles.day} key={day.date} data-syllabus-day={day.date}>
            <header><time dateTime={day.date}>{prettyDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}</time>{day.date === dateOnly(today) && <span>Today</span>}{addLessonAllowed && <button type="button" className={styles.addLesson} onClick={() => onAddLesson(day.date)}>Add lesson</button>}</header>
            {presentations.length === 0 && <p className={styles.emptyDay}>No lessons</p>}
            {presentations.map(({ kind, item }) => {
            if (kind === 'suggested') return <ForecastSuggestion
              key={item.lineage_id || item.id}
              item={item}
              busy={forecastBusy || forecastActionBusy || Boolean(materializingForecastLineage)}
              replacing={replacingForecastLineage === item.lineage_id}
              recoveryRequired={isForecastRecoveryRequired(item)}
              onSelect={role === 'facilitator' && onSelectLesson ? onSelectLesson : null}
            />
            const currentLesson = lessonState(item) || {}
            const state = syllabusItemState({ item, today, hasProgress: currentLesson.hasProgress })
            const occurrenceKey = item.occurrence_id || item.id || `${item.lineage_id}-${item.planned_date}`
            const assignedTeacher = normalizeInstructionalTeacher(item.assigned_instructional_teacher || item.instructional_teacher) || 'sonoma'
            const historicalActivityAllowed = item.historical_record !== true
              && (item.placement_kind !== 'actual' || Boolean(item.source_occurrence_id))
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
                  {(item.historical_activity_annotations || []).map((annotation) => <span className={styles.placementLabel} key={`${annotation.kind}:${annotation.label}`}>{annotation.label}</span>)}
                  {item.readiness_state && <span className={styles.statusLabel}>{String(item.readiness_state).replace('_', ' ')}</span>}
                  {item.placement_kind === 'scheduled' && <span className={styles.placementLabel}>Calendar date</span>}
                  {item.placement_kind === 'inferred' && <span className={styles.placementLabel}>Provisional weekly-pattern forecast</span>}
                  {item.needs_placement && <span className={styles.placementLabel}>{role === 'facilitator' ? 'Needs placement' : 'Timing to be confirmed'}</span>}
                  {item.actual_kind === 'incomplete' && <span className={styles.placementLabel}>Incomplete</span>}
                  {item.capacity_conflict && <span className={styles.placementLabel}>Manual capacity exception</span>}
                  {item.is_overdue_intent && <span className={styles.placementLabel}>Carried into NOW from {prettyDate(item.original_placement_date, { month: 'short', day: 'numeric' })}</span>}
                  {item.origin === 'mastery_reforecast' && <span className={styles.statusLabel}>Mastery follow-up</span>}
                  {item.origin === 'learning_forecast' && !item.lesson_key && <span className={styles.statusLabel}>Planned concept</span>}
                </div>
                {onSelectLesson && <span className={styles.entryChevron} aria-hidden="true">&rsaquo;</span>}
                {role === 'learner' && week.state === 'now' && item.lesson_key && ['draft', 'approved', 'saved'].includes(item.readiness_state) && !currentLesson.hasLessonArtifact && <span className={styles.preparing}>Preparing</span>}
              </div>
            )
          })}
          </section>
          })}
        </div>

        {week.week_start === startOfSyllabusWeek(proposedForecastTargetWeek) && role === 'facilitator' && <div className={styles.forecastStatus} data-proposal-revision={proposalRevision?.id || ''}>
          {forecastBusy && <p role="status">Preparing suggestions for this week…</p>}
          {!forecastBusy && forecastError && <div role="alert"><p>{forecastError}</p>{onRetryForecast && <button type="button" onClick={onRetryForecast}>Retry forecast</button>}</div>}
          {!forecastBusy && !forecastError && projectedForecast.length === 0 && <p>{forecastMessage || 'No new suggestions are needed for this week.'}</p>}
          {!forecastBusy && !forecastError && projectedForecast.length > 0 && <div className={styles.forecastDecision}>
            <p><strong>Suggested weekly forecast</strong><span>Changeable until you use it.</span></p>
            <button type="button" disabled={forecastActionBusy || Boolean(materializingForecastLineage) || typeof onUseForecast !== 'function'} onClick={onUseForecast}>Use this forecast</button>
          </div>}
        </div>}
      </section>

      {week.state === 'future' && role === 'learner' && <p className={styles.learnerFuture}>You can see where learning may go next. Your facilitator manages changes to this forecast.</p>}
    </article>
  )
}
