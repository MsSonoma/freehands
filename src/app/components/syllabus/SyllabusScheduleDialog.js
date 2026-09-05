'use client'

import { useMemo, useState } from 'react'
import styles from './SyllabusScheduleDialog.module.css'

function subjectLabel(value) {
  return String(value || '').split(' ').map((word) => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ')
}

export default function SyllabusScheduleDialog({
  mode,
  scheduledDate,
  minimumDate,
  item = null,
  lessons = [],
  loading = false,
  busy = false,
  error = '',
  onClose,
  onDateChange,
  onChooseLesson,
  onSubmit,
}) {
  const [search, setSearch] = useState('')
  const visibleLessons = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return lessons
    return lessons.filter((lesson) => `${lesson.title} ${lesson.subject} ${lesson.grade}`.toLocaleLowerCase().includes(query))
  }, [lessons, search])
  const binding = mode === 'bind'
  const adding = mode === 'add' || binding
  const moving = mode === 'reschedule'
  const title = binding ? `Use existing lesson for ${item?.title || 'concept'}` : adding ? `Add lesson · ${scheduledDate}` : `${moving ? 'Move' : 'Schedule'} ${item?.title || 'lesson'}`
  return <div className={styles.backdrop}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={title}>
      <header><div><p>Syllabus planning</p><h2>{title}</h2></div><button type="button" onClick={onClose} disabled={busy}>Close</button></header>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {adding ? <>
        <label className={styles.search}>{binding ? 'Choose a ready lesson' : 'Find a ready lesson'}
          <input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, subject, or grade" />
        </label>
        {loading ? <p className={styles.muted}>Loading ready lessons…</p> : visibleLessons.length ? <ul className={styles.lessons}>
          {visibleLessons.map((lesson) => <li key={lesson.lessonKey}><button type="button" disabled={busy} onClick={() => onChooseLesson(lesson)}><strong>{lesson.title}</strong><span>{subjectLabel(lesson.subject)}{lesson.grade ? ` · Grade ${lesson.grade}` : ''}</span></button></li>)}
        </ul> : <p className={styles.muted}>No schedulable lessons match this search.</p>}
      </> : <>
        <p className={styles.context}>{moving ? 'Move this exact scheduled occurrence. Other occurrences of the same lesson will not change.' : 'Choose the explicit Syllabus date for this lesson.'}</p>
        <label className={styles.search}>{moving ? 'New date' : 'Schedule date'}
          <input autoFocus type="date" min={minimumDate} value={scheduledDate} onChange={(event) => onDateChange(event.target.value)} />
        </label>
        <footer><button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>Cancel</button><button type="button" className={styles.primary} onClick={onSubmit} disabled={busy || !scheduledDate}>{busy ? 'Saving…' : (moving ? 'Move lesson' : 'Schedule lesson')}</button></footer>
      </>}
    </section>
  </div>
}
