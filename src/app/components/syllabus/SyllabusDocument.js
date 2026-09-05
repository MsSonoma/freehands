'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  dateOnly,
  moveSyllabusWeek,
  projectLearningForecastForWeek,
  selectSyllabusWeek,
  startOfSyllabusWeek,
  syllabusDayPresentation,
  syllabusActionPresentation,
  syllabusItemActionsFor,
  syllabusItemState,
  weeklyPatternRows,
} from '@/app/lib/syllabus/timeline.mjs'
import { instructionalTeacherLabel, normalizeInstructionalTeacher, syllabusTeacherLabel } from '@/app/lib/syllabus/instructionalTeacher.mjs'
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

function HistoricalActivityControl({ item, legacyWebbCompletion, busy, onRecord }) {
  const [activityType, setActivityType] = useState('instructional_completion')
  const [instructionalTeacher, setInstructionalTeacher] = useState('sonoma')
  const [occurredAt, setOccurredAt] = useState('')
  const instructionalCompletionAllowed = item?.placement_kind !== 'actual'
  const selectedActivityType = instructionalCompletionAllowed ? activityType : 'slate_drill_completion'
  const validLegacyWebb = instructionalCompletionAllowed
    && legacyWebbCompletion?.completed === true
    && Number.isFinite(Date.parse(legacyWebbCompletion?.completedAt))
  const submit = () => {
    if (!occurredAt) return
    onRecord(item, {
      activityType: selectedActivityType,
      instructionalTeacher: selectedActivityType === 'instructional_completion' ? instructionalTeacher : undefined,
      occurredAt: new Date(occurredAt).toISOString(),
      provenance: 'facilitator_recorded_legacy_activity',
    })
  }
  return (
    <details className={styles.historicalControl}>
      <summary>Record historical activity</summary>
      {validLegacyWebb && <button type="button" disabled={busy} onClick={() => onRecord(item, {
        activityType: 'instructional_completion',
        instructionalTeacher: 'webb',
        occurredAt: new Date(legacyWebbCompletion.completedAt).toISOString(),
        provenance: 'facilitator_attested_webb_completion_v1_import',
        legacyCompletion: legacyWebbCompletion,
      })}>Import facilitator-attested legacy Webb completion from {prettyDate(legacyWebbCompletion.completedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</button>}
      {instructionalCompletionAllowed
        ? <label>Activity
          <select value={activityType} onChange={(event) => setActivityType(event.target.value)}>
            <option value="instructional_completion">Instructional lesson completed</option>
            <option value="slate_drill_completion">Mr. Slate drill completed</option>
          </select>
        </label>
        : <p>Activity: Mr. Slate drill completed</p>}
      {instructionalCompletionAllowed && selectedActivityType === 'instructional_completion' && <label>Teacher
        <select value={instructionalTeacher} onChange={(event) => setInstructionalTeacher(event.target.value)}>
          <option value="sonoma">Ms. Sonoma</option>
          <option value="webb">Mrs. Webb</option>
        </select>
      </label>}
      <label>Completed at<input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label>
      <button type="button" disabled={busy || !occurredAt} onClick={submit}>{busy ? 'Recording…' : 'Add historical record'}</button>
      <small>Historical records do not create transcripts, mastery, retention, or canonical lesson-session evidence.</small>
    </details>
  )
}

function ForecastSuggestion({ item, busy, replacing, recoveryRequired, onEdit, onReplace, onGenerate }) {
  return <div className={styles.suggestedEntry} data-forecast-lineage={item.lineage_id}>
    <div className={styles.entryBody}>
      <p className={styles.subject}>{item.subject}</p>
      <h4>{item.title}</h4>
      {item.description && <p className={styles.description}>{item.description}</p>}
      <span className={styles.suggestedLabel}>Suggested · not active</span>
    </div>
    <div className={styles.lessonActions}>
      <button type="button" className={styles.suggestionAction} disabled={busy} onClick={() => onEdit?.(item)}>Edit</button>
      <button type="button" className={styles.suggestionAction} disabled={busy || replacing} onClick={() => onReplace?.(item)}>{replacing ? 'Replacing…' : 'Replace'}</button>
      <button type="button" className={styles.suggestionAction} disabled={busy || recoveryRequired} onClick={() => onGenerate?.(item)}>{recoveryRequired ? 'Recovery required' : 'Generate lesson'}</button>
    </div>
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
  onOpenLesson = null,
  onLessonAction = null,
  onReviewHistory = null,
  resolveActionHref = null,
  isActionDisabled = () => false,
  onTeacherAssignment = null,
  teacherAssignmentBusy = '',
  onRecordHistoricalActivity = null,
  historicalActivityBusy = '',
  legacyWebbCompletions = {},
  onOpenPlanning = null,
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
  onEditForecast = null,
  onReplaceForecast = null,
  onGenerateForecast = null,
  onUseForecast = null,
  actionCapabilities = {},
  onWeekChange = null,
  restoreWeekStart = '',
  today = localCalendarDate(),
}) {
  const visibleItems = Array.isArray(timelineItems) ? timelineItems : forecastItems
  const startedOccurrenceIds = useMemo(() => new Set(visibleItems
    .filter((item) => item?.placement_kind === 'actual' && item?.historical_record !== true && item?.source_occurrence_id)
    .map((item) => String(item.source_occurrence_id))), [visibleItems])
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfSyllabusWeek(restoreWeekStart) || moveSyllabusWeek(null, 'now', today))
  useEffect(() => setSelectedWeekStart(startOfSyllabusWeek(restoreWeekStart) || moveSyllabusWeek(null, 'now', today)), [learnerId, restoreWeekStart, today])
  const week = useMemo(() => selectSyllabusWeek(visibleItems, { weekStart: selectedWeekStart, today }), [visibleItems, selectedWeekStart, today])
  const projectedForecast = useMemo(() => projectLearningForecastForWeek(proposedForecastItems, {
    selectedWeekStart: week.week_start,
    targetWeekStart: proposedForecastTargetWeek,
  }), [proposedForecastItems, proposedForecastTargetWeek, week.week_start])
  useEffect(() => { onWeekChange?.(week.week_start, week.state) }, [onWeekChange, week.week_start, week.state])
  const copy = STATE_COPY[week.state]
  const pattern = weeklyPatternRows(revision?.weekly_pattern)
  const guidanceSummary = teachingGuidanceSummary(revision?.teaching_guidance)
  const move = (action) => setSelectedWeekStart((weekStart) => moveSyllabusWeek(weekStart, action, today))
  const actionHref = (item, actionId) => {
    if (typeof resolveActionHref === 'function') return resolveActionHref(item, actionId)
    if (role !== 'facilitator' || !learnerId || !item.lesson_key) return null
    const key = encodeURIComponent(item.lesson_key)
    const learner = encodeURIComponent(learnerId)
    if (actionId === 'edit') return `/facilitator/lessons/edit?key=${key}`
    if (['view', 'execute', 'prepare', 'schedule', 'reschedule', 'make_available'].includes(actionId)) {
      const scheduleContext = actionId === 'reschedule'
        ? `&action=schedule&scheduleId=${encodeURIComponent(item.id || '')}&originalScheduledDate=${encodeURIComponent(item.original_scheduled_date || item.planned_date || '')}`
        : (actionId === 'schedule' ? '&action=schedule' : '')
      const occurrenceContext = typeof item.occurrence_id === 'string' && item.occurrence_id.trim()
        ? `&occurrenceId=${encodeURIComponent(item.occurrence_id)}${revision?.id !== undefined && revision?.id !== null && String(revision.id).trim() ? `&expectedActiveRevisionId=${encodeURIComponent(revision.id)}` : ''}`
        : ''
      return `/facilitator/prepare?learnerId=${learner}&lessonKey=${key}&stage=${item.readiness_state === 'draft' ? 'DRAFT' : 'DELIVERY'}${scheduleContext}${occurrenceContext}`
    }
    return null
  }

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

      <section className={`${styles.week} ${styles[week.state]}`} aria-live="polite">
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
            return <section className={styles.day} key={day.date} data-syllabus-day={day.date}>
            <header><time dateTime={day.date}>{prettyDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}</time>{day.date === dateOnly(today) && <span>Today</span>}</header>
            {presentations.length === 0 && <p className={styles.emptyDay}>No lessons</p>}
            {presentations.map(({ kind, item }) => {
            if (kind === 'suggested') return <ForecastSuggestion
              key={item.lineage_id || item.id}
              item={item}
              busy={forecastBusy || forecastActionBusy || Boolean(materializingForecastLineage)}
              replacing={replacingForecastLineage === item.lineage_id}
              recoveryRequired={isForecastRecoveryRequired(item)}
              onEdit={onEditForecast}
              onReplace={onReplaceForecast}
              onGenerate={onGenerateForecast}
            />
            const currentLesson = lessonState(item) || {}
            const state = syllabusItemState({ item, today, hasProgress: currentLesson.hasProgress })
            const actions = syllabusItemActionsFor({ item, role, state, hasLessonArtifact: currentLesson.hasLessonArtifact, readinessState: item.readiness_state, isScheduled: item.is_explicit_schedule, isToday: dateOnly(item.planned_date) === dateOnly(today) })
            const occurrenceKey = item.occurrence_id || item.id || `${item.lineage_id}-${item.planned_date}`
            const assignedTeacher = normalizeInstructionalTeacher(item.assigned_instructional_teacher || item.instructional_teacher) || 'sonoma'
            const historicalActivityAllowed = item.historical_record !== true
              && (item.placement_kind !== 'actual' || Boolean(item.source_occurrence_id))
            const teacherEditable = role === 'facilitator'
              && item.lesson_key
              && item.placement_kind !== 'actual'
              && item.historical_record !== true
              && !startedOccurrenceIds.has(String(occurrenceKey))
              && typeof onTeacherAssignment === 'function'
            return (
              <div className={styles.entryRow} key={occurrenceKey} data-syllabus-state={state}>
                <div className={styles.entryBody}>
                  <p className={styles.subject}>{item.subject}</p>
                  <h4>{item.title}</h4>
                  {item.description && <p className={styles.description}>{item.description}</p>}
                  {item.item_type === 'slate_assignment' && <span className={styles.statusLabel}>Scheduled Mr. Slate supplemental session</span>}
                  {(item.item_type || 'lesson') === 'lesson' && item.historical_record
                    ? (item.actual_instructional_teacher
                        ? <span className={styles.placementLabel}>Completed with {instructionalTeacherLabel(item.actual_instructional_teacher)} · historical record</span>
                        : null)
                    : (item.item_type || 'lesson') === 'lesson' && teacherEditable
                      ? <label className={styles.teacherControl}>Assigned teacher
                        <select aria-label={`Assigned teacher for ${item.title}`} value={assignedTeacher} disabled={teacherAssignmentBusy === occurrenceKey} onChange={(event) => onTeacherAssignment(item, event.target.value)}>
                          <option value="sonoma">Ms. Sonoma</option>
                          <option value="webb">Mrs. Webb</option>
                        </select>
                      </label>
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
                <div className={styles.lessonActions}>{actions.map((action) => {
                  const href = actionHref(item, action.id)
                  const disabled = isActionDisabled(item, action.id)
                  const presentation = syllabusActionPresentation({
                    action,
                    href,
                    role,
                    capabilities: {
                      reviewHistory: actionCapabilities.reviewHistory === true && typeof onReviewHistory === 'function',
                      lessonActions: actionCapabilities.lessonActions === true && (typeof onLessonAction === 'function' || typeof onOpenLesson === 'function'),
                      openLesson: actionCapabilities.openLesson === true && (Boolean(href) || typeof onLessonAction === 'function' || typeof onOpenLesson === 'function'),
                    },
                  })
                  if (presentation === 'hidden') return null
                  if (action.id === 'history') return <button key={action.id} type="button" className={styles.lessonAction} disabled={disabled} onClick={() => onReviewHistory?.(item)}>{action.label}</button>
                  if (disabled) return <button key={action.id} type="button" className={styles.lessonAction} disabled>{action.label}{action.requires_pin ? ' · PIN' : ''}</button>
                  if (presentation === 'link') return <a key={action.id} className={styles.lessonAction} href={href}>{action.label}</a>
                  return <button key={action.id} type="button" className={styles.lessonAction} onClick={() => (onLessonAction || onOpenLesson)?.(item, { ...action, syllabus_state: state })}>{action.label}{action.requires_pin ? ' · PIN' : ''}</button>
                })}</div>
                {role === 'learner' && week.state === 'now' && item.lesson_key && ['draft', 'approved', 'saved'].includes(item.readiness_state) && !currentLesson.hasLessonArtifact && <span className={styles.preparing}>Preparing</span>}
                {role === 'facilitator' && item.lesson_key && historicalActivityAllowed && typeof onRecordHistoricalActivity === 'function' && <HistoricalActivityControl
                  item={item}
                  legacyWebbCompletion={legacyWebbCompletions[item.lesson_key]}
                  busy={historicalActivityBusy === occurrenceKey}
                  onRecord={onRecordHistoricalActivity}
                />}
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
