'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  dateOnly,
  matchMasteryAnnotations,
  moveSyllabusWeek,
  selectSyllabusWeek,
  syllabusEntitlementsFor,
  syllabusItemActions,
  syllabusItemState,
  weeklyPatternRows,
} from '@/app/lib/syllabus/timeline.mjs'
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

export default function SyllabusDocument({
  revision,
  forecastItems,
  timelineItems = null,
  role,
  learnerId = '',
  planTier = 'free',
  learnerName = '',
  proposedReforecast = null,
  lessonState = () => ({ hasLessonArtifact: false, hasProgress: false }),
  onOpenLesson = null,
  onLessonAction = null,
  proposalHref = '/facilitator/syllabus',
  planningHref = '/facilitator/syllabus',
  today = localCalendarDate(),
}) {
  const visibleItems = Array.isArray(timelineItems) ? timelineItems : forecastItems
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => moveSyllabusWeek(null, 'now', today))
  useEffect(() => setSelectedWeekStart(moveSyllabusWeek(null, 'now', today)), [revision?.id, today])
  const week = useMemo(() => selectSyllabusWeek(visibleItems, { weekStart: selectedWeekStart, today }), [visibleItems, selectedWeekStart, today])
  const copy = STATE_COPY[week.state]
  const entitlements = syllabusEntitlementsFor({ role, planTier })
  const pattern = weeklyPatternRows(revision?.weekly_pattern)
  const proposalItems = proposedReforecast?.forecast_items || []
  const { assignments: proposalAnnotations, unmatched: unmatchedProposals } = matchMasteryAnnotations(forecastItems, proposalItems)
  const move = (action) => setSelectedWeekStart((weekStart) => moveSyllabusWeek(weekStart, action, today))
  const actionHref = (item, actionId) => {
    if (role !== 'facilitator' || !learnerId || !item.lesson_key) return null
    const key = encodeURIComponent(item.lesson_key)
    const learner = encodeURIComponent(learnerId)
    if (actionId === 'edit') return `/facilitator/lessons/edit?key=${key}`
    if (actionId === 'history') return `/facilitator/learners/${learner}/transcripts?lessonKey=${key}`
    if (['view', 'execute', 'prepare', 'schedule', 'reschedule', 'make_available'].includes(actionId)) {
      const scheduleContext = actionId === 'reschedule'
        ? `&action=schedule&scheduleId=${encodeURIComponent(item.id || '')}&originalScheduledDate=${encodeURIComponent(item.original_scheduled_date || item.planned_date || '')}`
        : (actionId === 'schedule' ? '&action=schedule' : '')
      return `/facilitator/prepare?learnerId=${learner}&lessonKey=${key}&stage=${item.readiness_state === 'draft' ? 'DRAFT' : 'DELIVERY'}${scheduleContext}`
    }
    return null
  }

  return (
    <article className={styles.document} aria-label={`${learnerName || 'Learner'} Syllabus`}>
      <header className={styles.documentHeader}>
        <div>
          <p className={styles.kicker}>Ms. Sonoma / Living Syllabus</p>
          <h2>{learnerName ? `${learnerName}'s Syllabus` : 'My Syllabus'}</h2>
          <p>Past is a record. NOW is active. Future is a forecast.</p>
        </div>
        <div className={styles.revisionMark}>Active revision {revision?.revision_number || '—'}</div>
      </header>

      <div className={styles.summaryRule}>
        <section>
          <h3>Goals</h3>
          <p>{revision?.goals?.legacy_notes || 'No goal notes are recorded yet.'}</p>
        </section>
        <section>
          <h3>Subjects</h3>
          <p>{(revision?.subjects || []).map(subjectName).filter(Boolean).join(' / ') || 'No subjects declared.'}</p>
        </section>
      </div>

      <details className={styles.pattern}>
        <summary>Weekly pattern</summary>
        <div>{pattern.map((row) => <p key={row.day}><strong>{row.day}</strong><span>{row.subjects.join(' / ')}</span></p>)}</div>
      </details>

      <nav className={styles.timelineNav} aria-label="Syllabus timeline navigation">
        <button type="button" onClick={() => move('earlier')}>&larr; Previous week</button>
        <button type="button" className={week.state === 'now' ? styles.nowButton : ''} onClick={() => move('now')}>This week</button>
        <button type="button" onClick={() => move('later')}>Next week &rarr;</button>
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
          {week.days.map((day) => <section className={styles.day} key={day.date} data-syllabus-day={day.date}>
            <header><time dateTime={day.date}>{prettyDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}</time>{day.date === dateOnly(today) && <span>Today</span>}</header>
            {day.items.length === 0 && <p className={styles.emptyDay}>No lessons</p>}
            {day.items.map((item) => {
            const currentLesson = lessonState(item) || {}
            const state = syllabusItemState({ item, today, hasProgress: currentLesson.hasProgress })
            const actions = syllabusItemActions({ role, state, hasLessonArtifact: currentLesson.hasLessonArtifact, readinessState: item.readiness_state, isScheduled: item.is_explicit_schedule, isToday: dateOnly(item.planned_date) === dateOnly(today) })
            const notes = proposalAnnotations.get(item.id || item.lineage_id || `${dateOnly(item.planned_date)}:${item.subject}:${item.title}`) || []
            return (
              <div className={styles.entryRow} key={item.occurrence_id || item.id || `${item.lineage_id}-${item.planned_date}`} data-syllabus-state={state}>
                <div className={styles.entryBody}>
                  <p className={styles.subject}>{item.subject}</p>
                  <h4>{item.title}</h4>
                  {item.readiness_state && <span className={styles.statusLabel}>{String(item.readiness_state).replace('_', ' ')}</span>}
                  {item.placement_kind === 'scheduled' && <span className={styles.placementLabel}>Calendar date</span>}
                  {item.placement_kind === 'inferred' && <span className={styles.placementLabel}>Provisional weekly-pattern forecast</span>}
                  {item.needs_placement && <span className={styles.placementLabel}>{role === 'facilitator' ? 'Needs placement' : 'Timing to be confirmed'}</span>}
                  {item.actual_kind === 'incomplete' && <span className={styles.placementLabel}>Incomplete</span>}
                  {item.capacity_conflict && <span className={styles.placementLabel}>Manual capacity exception</span>}
                  {item.is_overdue_intent && <span className={styles.placementLabel}>Carried into NOW from {prettyDate(item.original_placement_date, { month: 'short', day: 'numeric' })}</span>}
                  {item.origin === 'mastery_reforecast' && <span className={styles.statusLabel}>Mastery follow-up</span>}
                </div>
                <div className={styles.lessonActions}>{actions.map((action) => {
                  const href = actionHref(item, action.id)
                  if (href && !action.requires_pin) return <a key={action.id} className={styles.lessonAction} href={href}>{action.label}</a>
                  return <button key={action.id} type="button" className={styles.lessonAction} onClick={() => (onLessonAction || onOpenLesson)?.(item, action)}>{action.label}{action.requires_pin ? ' · PIN' : ''}</button>
                })}</div>
                {role === 'learner' && week.state === 'now' && item.lesson_key && ['draft', 'approved', 'saved'].includes(item.readiness_state) && !currentLesson.hasLessonArtifact && <span className={styles.preparing}>Preparing</span>}
                {role === 'facilitator' && notes.length > 0 && <aside className={styles.marginNote}><strong>Mastery note</strong>{notes.map((note) => <span key={note.id || note.lineage_id}>{note.title}</span>)}<a href={proposalHref}>Review proposed change</a></aside>}
              </div>
            )
          })}
          </section>)}
        </div>
      </section>

      {role === 'facilitator' && unmatchedProposals.length > 0 && (
        <aside className={styles.unmatchedNotes}>
          <strong>Mastery proposals for general review</strong>
          <p>These proposals could not be linked confidently to one specific Syllabus lesson.</p>
          {unmatchedProposals.map((note) => <span key={note.id || note.lineage_id}>{note.subject}: {note.title}</span>)}
          <a href={proposalHref}>Review proposed change</a>
        </aside>
      )}

      {week.state === 'future' && role === 'facilitator' && (
        <div className={styles.futurePlanning}>
          <div><strong>Future planning</strong><span>{entitlements.can_change_intent ? 'Use the current planning workflow while Syllabus editing matures.' : 'Visible on the free plan; planning changes are locked.'}</span></div>
          {entitlements.can_change_intent ? <a href={planningHref}>Open planning</a> : <span className={styles.locked}>Locked / Upgrade to plan</span>}
        </div>
      )}
      {week.state === 'future' && role === 'learner' && <p className={styles.learnerFuture}>You can see where learning may go next. Your facilitator manages changes to this forecast.</p>}
    </article>
  )
}
