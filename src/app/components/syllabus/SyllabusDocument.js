'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildSyllabusTimeline,
  dateOnly,
  matchMasteryAnnotations,
  moveSyllabusTimeline,
  syllabusEntitlementsFor,
  timelineItemAction,
  weeklyPatternRows,
} from '@/app/lib/syllabus/timeline.mjs'
import styles from './SyllabusDocument.module.css'

const STATE_COPY = {
  past: { eyebrow: 'PAST / SYLLABUS RECORD', title: 'Earlier Syllabus intentions', note: 'Only retained canonical Syllabus entries appear here. Detailed learning evidence belongs in History and Portfolio.' },
  now: { eyebrow: 'NOW / YOU ARE HERE', title: 'This week', note: 'The current educational position.' },
  future: { eyebrow: 'FUTURE / FORECAST', title: 'A week ahead', note: 'This is an intention and may change as learning unfolds.' },
}

function prettyDate(value, options) {
  return new Date(`${dateOnly(value)}T12:00:00.000Z`).toLocaleDateString(undefined, { timeZone: 'UTC', ...options })
}

function subjectName(subject) {
  return String(typeof subject === 'string' ? subject : subject?.name || '').trim()
}

export default function SyllabusDocument({
  revision,
  forecastItems,
  role,
  planTier = 'free',
  learnerName = '',
  proposedReforecast = null,
  lessonState = () => ({ hasLessonArtifact: false, hasProgress: false }),
  onOpenLesson = null,
  proposalHref = '/facilitator/syllabus',
  planningHref = '/facilitator/syllabus',
  today = new Date().toISOString().slice(0, 10),
}) {
  const timeline = useMemo(() => buildSyllabusTimeline(forecastItems, { today }), [forecastItems, today])
  const [viewIndex, setViewIndex] = useState(timeline.now_index)
  useEffect(() => setViewIndex(timeline.now_index), [revision?.id, timeline.now_index])
  const week = timeline.weeks[viewIndex] || timeline.weeks[timeline.now_index]
  const copy = STATE_COPY[week.state]
  const entitlements = syllabusEntitlementsFor({ role, planTier })
  const pattern = weeklyPatternRows(revision?.weekly_pattern)
  const proposalItems = proposedReforecast?.forecast_items || []
  const { assignments: proposalAnnotations, unmatched: unmatchedProposals } = matchMasteryAnnotations(forecastItems, proposalItems)
  const move = (action) => setViewIndex((index) => moveSyllabusTimeline({
    index,
    nowIndex: timeline.now_index,
    weekCount: timeline.weeks.length,
  }, action))

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
        <button type="button" onClick={() => move('earlier')} disabled={viewIndex === 0}>&lt; Earlier</button>
        <button type="button" className={week.state === 'now' ? styles.nowButton : ''} onClick={() => move('now')}>NOW</button>
        <button type="button" onClick={() => move('later')} disabled={viewIndex === timeline.weeks.length - 1}>Later &gt;</button>
      </nav>
      {week.state !== 'now' && <button type="button" className={styles.returnNow} onClick={() => move('now')}>Return to NOW</button>}

      <section className={`${styles.week} ${styles[week.state]}`} aria-live="polite">
        <header className={styles.weekHeader}>
          <div>
            <p className={styles.stateLabel}>{copy.eyebrow}</p>
            <h3>{copy.title}</h3>
            <p>{copy.note}</p>
          </div>
          <time dateTime={week.week_start}>Week of {prettyDate(week.week_start, { month: 'long', day: 'numeric', year: 'numeric' })}</time>
        </header>

        <div className={styles.entries}>
          {week.items.length === 0 && <p className={styles.emptyWeek}>{week.state === 'past' ? 'No retained Syllabus entries are available for this week. This view does not create a historical record.' : 'No Syllabus intentions are recorded for this week.'}</p>}
          {week.items.map((item) => {
            const currentLesson = lessonState(item) || {}
            const action = timelineItemAction({ role, weekState: week.state, ...currentLesson })
            const notes = proposalAnnotations.get(item.id || item.lineage_id || `${dateOnly(item.planned_date)}:${item.subject}:${item.title}`) || []
            return (
              <div className={styles.entryRow} key={item.id || `${item.lineage_id}-${item.planned_date}`}>
                <time dateTime={dateOnly(item.planned_date)}>{prettyDate(item.planned_date, { weekday: 'long', month: 'short', day: 'numeric' })}</time>
                <div className={styles.entryBody}>
                  <p className={styles.subject}>{item.subject}</p>
                  <h4>{item.title}</h4>
                  {item.origin === 'mastery_reforecast' && <span className={styles.statusLabel}>Mastery follow-up</span>}
                </div>
                {action && <button type="button" className={styles.lessonAction} onClick={() => onOpenLesson?.(item)}>{action === 'continue' ? 'Continue' : 'Start'}</button>}
                {role === 'learner' && week.state === 'now' && item.lesson_key && !currentLesson.hasLessonArtifact && <span className={styles.preparing}>Preparing</span>}
                {role === 'facilitator' && notes.length > 0 && <aside className={styles.marginNote}><strong>Mastery note</strong>{notes.map((note) => <span key={note.id || note.lineage_id}>{note.title}</span>)}<a href={proposalHref}>Review proposed change</a></aside>}
              </div>
            )
          })}
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
