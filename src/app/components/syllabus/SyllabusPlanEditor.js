'use client'

import { useEffect, useMemo, useState } from 'react'
import { requestFacilitatorPinException } from '@/app/lib/pinGate'
import { addWeeklyPatternSlot, removeWeeklyPatternSlot } from '@/app/lib/syllabus/timeline.mjs'
import {
  normalizedTeachingGuidance,
  TEACHING_GUIDANCE_FIELDS,
  updateTeachingGuidanceList,
} from '@/app/lib/syllabus/teachingGuidance.mjs'
import styles from './SyllabusPlanEditor.module.css'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = Object.fromEntries(DAYS.map((day) => [day, day[0].toUpperCase() + day.slice(1, 3)]))

function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function subjectName(subject) {
  return String(typeof subject === 'string' ? subject : subject?.name || '').trim()
}

function sectionLabel(value) {
  return ({
    goals: 'Goals',
    subjects: 'Subjects',
    weekly_pattern: 'Weekly Pattern',
    teaching_guidance: 'Teaching Guidance',
  })[value] || 'Plan details'
}

function subjectLabel(value) {
  return String(value || '').split(' ').map((word) => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ')
}

function guidanceSubjectNames(guidance, subjects = []) {
  const names = new Map()
  for (const item of subjects || []) {
    const name = subjectName(item)
    if (name) names.set(name.toLocaleLowerCase(), name)
  }
  for (const name of Object.keys(guidance?.curriculum_preferences?.subject_preferences || {})) {
    if (name.trim() && !names.has(name.toLocaleLowerCase())) names.set(name.toLocaleLowerCase(), name)
  }
  return [...names.values()]
}

function guidanceValues(guidance, field, subject = null) {
  const preferences = guidance?.curriculum_preferences
  const values = subject === null
    ? preferences?.[field.globalKey]
    : preferences?.subject_preferences?.[subject]?.[field.subjectKey]
  return Array.isArray(values) ? values : []
}

function referencedSubjectKeys(weeklyPattern, forecastItems) {
  const keys = new Set()
  for (const entries of Object.values(weeklyPattern || {})) {
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      const subject = String(typeof entry === 'string' ? entry : entry?.subject || '').trim()
      if (subject) keys.add(subject.toLocaleLowerCase())
    }
  }
  for (const item of forecastItems || []) {
    const subject = String(item?.subject || '').trim()
    if (subject) keys.add(subject.toLocaleLowerCase())
  }
  return keys
}

function draftFromRevision(revision, forecastItems, today) {
  return {
    effective_from: dateOnly(today || revision?.effective_from),
    goals: structuredClone(revision?.goals || {}),
    subjects: structuredClone(revision?.subjects || []),
    weekly_pattern: structuredClone(revision?.weekly_pattern || {}),
    teaching_guidance: structuredClone(revision?.teaching_guidance || {}),
    planning_policy: structuredClone(revision?.planning_policy || {}),
    legacy_provenance: structuredClone(revision?.legacy_provenance || {}),
    forecast_items: structuredClone(forecastItems || []),
    change_reason: '',
  }
}

function GuidanceListEditor({ field, values, subject, onChange }) {
  return <div className={styles.guidanceField}>
    <strong>{field.label}</strong>
    {values.length === 0 && <span className={styles.muted}>None</span>}
    {values.map((value, index) => <div className={styles.guidanceItem} key={`${field.subjectKey}-${index}`}>
      <input
        aria-label={`${subject ? `${subjectLabel(subject)} ` : ''}${field.label} item ${index + 1}`}
        value={value}
        onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
      />
      <button type="button" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
    </div>)}
    <button type="button" className={styles.guidanceAdd} onClick={() => onChange([...values, ''])}>Add {field.label.toLocaleLowerCase()}</button>
  </div>
}

export default function SyllabusPlanEditor({
  section,
  revision,
  forecastItems = [],
  learnerId,
  accessToken,
  today = '',
  onClose,
  onSaved,
}) {
  const [draft, setDraft] = useState(() => draftFromRevision(revision, forecastItems, today))
  const [newSubject, setNewSubject] = useState('')
  const [slotSubjects, setSlotSubjects] = useState({})
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(draftFromRevision(revision, forecastItems, today))
    setNewSubject('')
    setSlotSubjects({})
    setError('')
  }, [forecastItems, revision, section, today])

  useEffect(() => {
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => { if (event.key === 'Escape' && !working) onClose?.() }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = priorOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, working])

  const referencedSubjects = useMemo(
    () => referencedSubjectKeys(draft.weekly_pattern, draft.forecast_items),
    [draft.forecast_items, draft.weekly_pattern],
  )
  const guidanceSubjects = useMemo(
    () => guidanceSubjectNames(draft.teaching_guidance, draft.subjects),
    [draft.subjects, draft.teaching_guidance],
  )

  function addSubject() {
    const name = newSubject.trim()
    if (!name) return
    if (!(draft.subjects || []).some((subject) => subjectName(subject).toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setDraft((current) => ({ ...current, subjects: [...(current.subjects || []), { name, source: 'facilitator' }] }))
    }
    setNewSubject('')
  }

  function removeSubject(name) {
    if (referencedSubjects.has(name.toLocaleLowerCase())) return
    setDraft((current) => ({
      ...current,
      subjects: (current.subjects || []).filter((subject) => subjectName(subject).toLocaleLowerCase() !== name.toLocaleLowerCase()),
    }))
  }

  function updateGuidance(field, values, subject = null) {
    setDraft((current) => ({
      ...current,
      teaching_guidance: updateTeachingGuidanceList(current.teaching_guidance, { field, subject, values }),
    }))
  }

  function updatePatternSlot(day, index, subject) {
    setDraft((current) => {
      const weeklyPattern = structuredClone(current.weekly_pattern || {})
      weeklyPattern[day] = Array.isArray(weeklyPattern[day]) ? weeklyPattern[day] : []
      weeklyPattern[day][index] = { subject }
      return { ...current, weekly_pattern: weeklyPattern }
    })
  }

  function addPatternSlot(day) {
    const subject = slotSubjects[day] || subjectName(draft.subjects?.[0])
    if (!subject) return
    setDraft((current) => ({ ...current, weekly_pattern: addWeeklyPatternSlot(current.weekly_pattern, day, subject) }))
  }

  function removePatternSlot(day, index) {
    setDraft((current) => ({ ...current, weekly_pattern: removeWeeklyPatternSlot(current.weekly_pattern, day, index) }))
  }

  async function save() {
    if (!learnerId || !accessToken || !revision?.id) return
    setWorking(true)
    setError('')
    try {
      const activationBody = {
        learnerId,
        expectedActiveRevisionId: revision.id,
        snapshot: { ...draft, teaching_guidance: normalizedTeachingGuidance(draft.teaching_guidance) },
      }
      const postActivation = (exceptionPin) => fetch('/api/syllabus/activate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...activationBody, ...(exceptionPin ? { exceptionPin } : {}) }),
      })
      let response = await postActivation()
      let json = await response.json().catch(() => ({}))
      if (response.status === 409 && json?.code === 'SYLLABUS_CAPACITY_PIN_REQUIRED') {
        const pin = await requestFacilitatorPinException({ message: json.error })
        if (!pin) throw new Error('The placement exception was not approved.')
        response = await postActivation(pin)
        json = await response.json().catch(() => ({}))
      }
      if (!response.ok) throw new Error(json.error || 'Could not save Syllabus plan details')
      await onSaved?.(json)
      onClose?.()
    } catch (cause) {
      setError(cause.message || 'Could not save Syllabus plan details')
    } finally {
      setWorking(false)
    }
  }

  return <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose?.() }}>
    <section className={styles.editor} role="dialog" aria-modal="true" aria-label={`Edit ${sectionLabel(section)}`}>
      <header><div><p>Syllabus plan details</p><h2>{sectionLabel(section)}</h2></div><button type="button" onClick={onClose} disabled={working}>Close</button></header>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.body}>
        {section === 'goals' && <label className={styles.fullField}>Goals<textarea rows={7} value={draft.goals?.legacy_notes || ''} onChange={(event) => setDraft((current) => ({ ...current, goals: { ...current.goals, legacy_notes: event.target.value } }))} /></label>}

        {section === 'subjects' && <>
          <ul className={styles.subjectEditor}>{(draft.subjects || []).map((subject) => {
            const name = subjectName(subject)
            const referenced = referencedSubjects.has(name.toLocaleLowerCase())
            return <li key={name}><span>{name}{referenced && <small>Used by the weekly pattern or future intent</small>}</span><button type="button" disabled={referenced} onClick={() => removeSubject(name)}>Remove</button></li>
          })}</ul>
          <div className={styles.addSubject}><input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSubject() } }} placeholder="Add a subject" /><button type="button" onClick={addSubject}>Add</button></div>
        </>}

        {section === 'weekly_pattern' && <>
          <p className={styles.help}>Each entry is one automatic lesson slot. Duplicate subjects are allowed, so two Math entries means two Math slots that day.</p>
          <div className={styles.weekScroller}>
            <div className={styles.weekGrid}>
              {DAYS.map((day) => <section className={styles.dayCell} key={day}>
                <strong>{DAY_LABELS[day]}</strong>
                <ul>{(draft.weekly_pattern?.[day] || []).map((item, index) => <li key={`${day}-${index}`}>
                  <select value={typeof item === 'string' ? item : item.subject} onChange={(event) => updatePatternSlot(day, index, event.target.value)}>{(draft.subjects || []).map((subject) => { const name = subjectName(subject); return <option key={name} value={name}>{name}</option> })}</select>
                  <button type="button" onClick={() => removePatternSlot(day, index)} aria-label={`Remove ${DAY_LABELS[day]} slot ${index + 1}`}>×</button>
                </li>)}</ul>
                <div className={styles.patternAdd}><select value={slotSubjects[day] || subjectName(draft.subjects?.[0]) || ''} onChange={(event) => setSlotSubjects((current) => ({ ...current, [day]: event.target.value }))}>{(draft.subjects || []).map((subject) => { const name = subjectName(subject); return <option key={name} value={name}>{name}</option> })}</select><button type="button" onClick={() => addPatternSlot(day)}>Add</button></div>
              </section>)}
            </div>
          </div>
        </>}

        {section === 'teaching_guidance' && <div className={styles.guidanceEditor}>
          <section><h3>All subjects</h3>{TEACHING_GUIDANCE_FIELDS.map((field) => <GuidanceListEditor key={field.globalKey} field={field} values={guidanceValues(draft.teaching_guidance, field)} onChange={(values) => updateGuidance(field, values)} />)}</section>
          {guidanceSubjects.map((subject) => <section key={subject}><h3>{subjectLabel(subject)}</h3>{TEACHING_GUIDANCE_FIELDS.map((field) => <GuidanceListEditor key={field.subjectKey} field={field} subject={subject} values={guidanceValues(draft.teaching_guidance, field, subject)} onChange={(values) => updateGuidance(field, values, subject)} />)}</section>)}
        </div>}
      </div>
      <footer><button type="button" className={styles.secondary} onClick={onClose} disabled={working}>Cancel</button><button type="button" className={styles.primary} onClick={save} disabled={working}>{working ? 'Saving...' : 'Save changes'}</button></footer>
    </section>
  </div>
}