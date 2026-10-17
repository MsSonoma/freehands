'use client'

import { useEffect, useState } from 'react'
import { acquirePageScrollLock } from '@/app/lib/scrollLock.mjs'
import styles from './SyllabusDayActionDialog.module.css'

function prettyDate(value) {
  const date = String(value || '').slice(0, 10)
  if (!date) return ''
  return new Date(date + 'T12:00:00.000Z').toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function SyllabusDayActionDialog({
  date,
  isNoSchool = false,
  noSchoolReason = '',
  existingMoveToDate = '',
  minimumMoveDate = '',
  canGenerate = false,
  canUseExisting = false,
  busy = false,
  error = '',
  onClose,
  onGenerate,
  onUseExisting,
  onMarkNoSchool,
  onClearNoSchool,
}) {
  const [mode, setMode] = useState('menu')
  const [dayKind, setDayKind] = useState('Day off')
  const [dayLabel, setDayLabel] = useState('')
  const [includeMove, setIncludeMove] = useState(false)
  const [destinationDate, setDestinationDate] = useState('')

  useEffect(() => acquirePageScrollLock(), [])
  useEffect(() => {
    setMode('menu')
    setDayKind('Day off')
    setDayLabel('')
    setIncludeMove(false)
    setDestinationDate('')
  }, [date])
  useEffect(() => {
    const handler = (event) => { if (event.key === 'Escape' && !busy) onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [busy, onClose])

  const destinationValid = !includeMove
    || (Boolean(destinationDate) && destinationDate !== date && (!minimumMoveDate || destinationDate >= minimumMoveDate))

  const submitNoSchool = () => {
    if (!destinationValid) return
    const label = dayLabel.trim()
    const reason = isNoSchool
      ? noSchoolReason
      : (label ? dayKind + ': ' + label : dayKind)
    onMarkNoSchool?.({ date, reason, moveToDate: includeMove ? destinationDate : '' })
  }

  return <div className={styles.backdrop}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={'Plan ' + prettyDate(date)}>
      <header><div><p>Syllabus day</p><h2>{prettyDate(date)}</h2></div><button type="button" onClick={onClose} disabled={busy}>Close</button></header>
      {error && <div className={styles.error} role="alert">{error}</div>}

      {isNoSchool && mode === 'menu' ? <div className={styles.noSchool}>
        <strong>{noSchoolReason || 'Day off'}</strong>
        <p>This date is protected from new instructional planning. Existing explicit commitments are preserved unless you choose to move them.</p>
        {existingMoveToDate
          ? <p>Lessons were moved once to {prettyDate(existingMoveToDate)}. Removing this Day Off mark will not undo that move.</p>
          : <button type="button" className={styles.danger} disabled={busy} onClick={() => { setIncludeMove(true); setMode('off') }}>Move existing lessons to another day</button>}
        <button type="button" className={styles.danger} disabled={busy} onClick={() => onClearNoSchool?.({ date })}>{busy ? 'Saving...' : 'Remove day-off mark'}</button>
      </div> : mode === 'menu' ? <div className={styles.actions}>
        <button type="button" disabled={!canGenerate || busy} onClick={() => onGenerate?.({ date })}><strong>Generate a new lesson</strong><span>Open the Lesson Generator with this learner and date already attached.</span></button>
        <button type="button" disabled={!canUseExisting || busy} onClick={() => onUseExisting?.({ date })}><strong>Use an existing lesson</strong><span>Place a ready lesson on this exact date.</span></button>
        <button type="button" disabled={busy} onClick={() => setMode('off')}><strong>Mark day off / holiday</strong><span>Keep automatic forecasts and inferred lessons off this date.</span></button>
      </div> : <div className={styles.form}>
        {!isNoSchool && <>
          <label>Type<select autoFocus value={dayKind} onChange={(event) => setDayKind(event.target.value)}><option>Day off</option><option>Holiday</option></select></label>
          <label>Name or reason <span>(optional)</span><input value={dayLabel} maxLength={260} onChange={(event) => setDayLabel(event.target.value)} placeholder={dayKind === 'Holiday' ? 'Thanksgiving' : 'Vacation, appointment, travel...'} /></label>
        </>}
        <p className={styles.note}>New forecasts, inferred lessons, and new scheduling will avoid this date.</p>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={includeMove} disabled={busy} onChange={(event) => setIncludeMove(event.target.checked)} />
          Move this day&apos;s forecasted and scheduled lessons to another date (one time only)
        </label>
        {includeMove && <div className={styles.moveOptions}>
          <label>Move lessons to
            <input type="date" value={destinationDate} min={minimumMoveDate || undefined} disabled={busy} onChange={(event) => setDestinationDate(event.target.value)} />
          </label>
          <p className={styles.note}>These lessons will be added after anything already on the destination day. Their original subject forecast remains satisfied. The weekly pattern will not change.</p>
          {!destinationValid && destinationDate && <p className={styles.validation}>Choose a different current or future date.</p>}
        </div>}
        {!includeMove && <p className={styles.note}>Anything already explicitly scheduled will remain visible so you can move or remove it deliberately.</p>}
        <footer><button type="button" onClick={() => setMode('menu')} disabled={busy}>Back</button><button type="button" className={styles.primary} onClick={submitNoSchool} disabled={busy || !destinationValid}>{busy ? 'Saving...' : isNoSchool ? 'Move lessons' : 'Mark day off'}</button></footer>
      </div>}
    </section>
  </div>
}