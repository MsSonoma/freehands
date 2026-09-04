'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildPlanAhead } from '@/app/lib/syllabus/planning.mjs'
import styles from './SyllabusPlanningWorkspace.module.css'

export default function SyllabusPlanningWorkspace({ revision, items, today, busy, error = '', canPlan = true, canGenerate = true, canSuggest = true, onClose, onCreate, onEdit, onRemove, onGenerate, onSuggest }) {
  const [weeks, setWeeks] = useState(2)
  const [editor, setEditor] = useState(null)
  const plan = useMemo(() => buildPlanAhead({ weeklyPattern: revision.weekly_pattern, forecastItems: items, today, weeks }), [revision.weekly_pattern, items, today, weeks])
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') editor ? setEditor(null) : onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editor, onClose])
  const startEditor = (slot, item = null) => setEditor({ slot, item, title: item?.title || '', description: item?.description || '' })
  const save = async () => {
    if (!editor?.title.trim() || !editor?.description.trim()) return
    const result = editor.item ? await onEdit(editor.item, editor) : await onCreate(editor.slot, editor)
    if (result) setEditor(null)
  }
  const suggest = async (slot) => {
    const suggestion = await onSuggest(slot)
    if (suggestion) setEditor({ slot, item: null, title: suggestion.title, description: suggestion.description })
  }
  return <section className={styles.workspace} aria-label="Plan ahead in the Syllabus">
      <header><div><p>SYLLABUS / PLAN AHEAD</p><h2>Plan intended progression</h2><span>The automatic evidence-informed forecast stays one week ahead. Farther weeks are explicit facilitator planning and do not assume future mastery.</span></div><button type="button" onClick={onClose}>&larr; Back to week view</button></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <label className={styles.horizon}>Horizon<select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))}>{[1, 2, 3, 4].map((value) => <option value={value} key={value}>{value} week{value === 1 ? '' : 's'}</option>)}</select></label>
      <div className={styles.weeks}>{plan.map((week) => <section key={week.week_start}><h3>Week of {week.week_start}</h3>{week.slots.map((slot) => <article key={slot.slot_key}>
        <div><strong>{slot.subject}</strong><small>{slot.planned_date}</small></div>
        {slot.item ? <div className={styles.concept}><span>{slot.item.title}</span><p>{slot.item.description}</p><small>{slot.item.lesson_key ? 'Lesson ready' : slot.item.origin === 'learning_forecast' ? 'Provisional forecast' : 'Planned concept'}</small></div> : <p className={styles.empty}>Open weekly-pattern slot</p>}
        <div className={styles.rowActions}>{slot.item ? <>
          {!slot.item.lesson_key && <button type="button" disabled={busy || !canPlan} onClick={() => startEditor(slot, slot.item)}>Edit</button>}
          {!slot.item.lesson_key && slot.item.origin !== 'learning_forecast' && <button type="button" disabled={busy || !canPlan} onClick={() => onRemove(slot.item)}>Remove</button>}
          {!slot.item.lesson_key && slot.item.origin !== 'learning_forecast' && <button type="button" disabled={busy || !canGenerate} onClick={() => onGenerate(slot.item)}>Generate lesson</button>}
        </> : <><button type="button" disabled={busy || !canPlan} onClick={() => startEditor(slot)}>Create your own</button><button type="button" disabled={busy || !canSuggest} onClick={() => suggest(slot)}>Suggest with AI</button></>}</div>
      </article>)}</section>)}</div>
      {editor && <div className={styles.editor}><h3>{editor.item ? 'Edit planned concept' : 'Create lesson concept'}</h3><p>{editor.slot.subject} · {editor.slot.planned_date}</p><label>Title<input value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></label><label>Brief description<textarea rows={4} value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} /></label><div><button type="button" onClick={() => setEditor(null)}>Cancel</button><button type="button" disabled={busy || !editor.title.trim() || !editor.description.trim()} onClick={save}>Save to Syllabus</button></div></div>}
  </section>
}
