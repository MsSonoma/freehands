'use client'

import { useEffect, useMemo, useState } from 'react'
import { acquirePageScrollLock } from '@/app/lib/scrollLock.mjs'
import styles from './SyllabusDayActionDialog.module.css'

function prettyDate(value) {
  const date = String(value || '').slice(0, 10)
  if (!date) return ''
  return new Date(date + 'T12:00:00.000Z').toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function subjectName(value) { return String(typeof value === 'string' ? value : value?.name || '').trim() }

export default function SyllabusDayActionDialog({
  date,
  subjects = [],
  isNoSchool = false,
  noSchoolReason = '',
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
  const availableSubjects = useMemo(() => subjects.map(subjectName).filter(Boolean), [subjects])
  const [mode, setMode] = useState('menu')
  const [subject, setSubject] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dayKind, setDayKind] = useState('Day off')
  const [dayLabel, setDayLabel] = useState('')

  useEffect(() => acquirePageScrollLock(), [])
  useEffect(() => {
    setMode('menu')
    setSubject(availableSubjects[0] || '')
    setTitle('')
    setDescription('')
    setDayKind('Day off')
    setDayLabel('')
  }, [date, availableSubjects])
  useEffect(() => {
    const handler = (event) => { if (event.key === 'Escape' && !busy) onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [busy, onClose])

  const submitGeneration = () => onGenerate?.({ date, subject, title: title.trim(), description: description.trim() })
  const submitNoSchool = () => {
    const label = dayLabel.trim()
    onMarkNoSchool?.({ date, reason: label ? dayKind + ': ' + label : dayKind })
  }

  return <div className={styles.backdrop}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={'Plan ' + prettyDate(date)}>
      <header><div><p>Syllabus day</p><h2>{prettyDate(date)}</h2></div><button type="button" onClick={onClose} disabled={busy}>Close</button></header>
      {error && <div className={styles.error} role="alert">{error}</div>}

      {isNoSchool ? <div className={styles.noSchool}>
        <strong>{noSchoolReason || 'Day off'}</strong>
        <p>This date is protected from new instructional planning. Existing explicit commitments are preserved until you move or remove them.</p>
        <button type="button" className={styles.danger} disabled={busy} onClick={() => onClearNoSchool?.({ date })}>{busy ? 'Saving...' : 'Remove day-off mark'}</button>
      </div> : mode === 'menu' ? <div className={styles.actions}>
        <button type="button" disabled={!canGenerate || busy} onClick={() => setMode('generate')}><strong>Generate a new lesson</strong><span>Create educator-authored intent for this exact date, then generate the full lesson.</span></button>
        <button type="button" disabled={!canUseExisting || busy} onClick={() => onUseExisting?.({ date })}><strong>Use an existing lesson</strong><span>Place a ready lesson on this exact date.</span></button>
        <button type="button" disabled={busy} onClick={() => setMode('off')}><strong>Mark day off / holiday</strong><span>Keep automatic forecasts and inferred lessons off this date.</span></button>
      </div> : mode === 'generate' ? <form className={styles.form} onSubmit={(event) => { event.preventDefault(); submitGeneration() }}>
        <label>Subject<select autoFocus value={subject} onChange={(event) => setSubject(event.target.value)}>{availableSubjects.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label>Lesson title<input value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} placeholder="What should this lesson teach?" /></label>
        <label>Brief description<textarea rows={5} value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what the learner should understand or practice." /></label>
        <footer><button type="button" onClick={() => setMode('menu')} disabled={busy}>Back</button><button type="submit" className={styles.primary} disabled={busy || !subject || !title.trim() || !description.trim()}>{busy ? 'Generating...' : 'Generate lesson'}</button></footer>
      </form> : <div className={styles.form}>
        <label>Type<select autoFocus value={dayKind} onChange={(event) => setDayKind(event.target.value)}><option>Day off</option><option>Holiday</option></select></label>
        <label>Name or reason <span>(optional)</span><input value={dayLabel} maxLength={260} onChange={(event) => setDayLabel(event.target.value)} placeholder={dayKind === 'Holiday' ? 'Thanksgiving' : 'Vacation, appointment, travel...' } /></label>
        <p className={styles.note}>New forecasts, inferred lessons, and new scheduling will avoid this date. Anything already explicitly scheduled will remain visible so you can move or remove it deliberately.</p>
        <footer><button type="button" onClick={() => setMode('menu')} disabled={busy}>Back</button><button type="button" className={styles.primary} onClick={submitNoSchool} disabled={busy}>{busy ? 'Saving...' : 'Mark day off'}</button></footer>
      </div>}
    </section>
  </div>
}
