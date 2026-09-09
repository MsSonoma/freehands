'use client'

import { useState } from 'react'
import { instructionalTeacherLabel, normalizeInstructionalTeacher } from '@/app/lib/syllabus/instructionalTeacher.mjs'
import styles from './FacilitatorSyllabusLessonOverlay.module.css'

function prettyDate(value) {
  const text = String(value || '').slice(0, 10)
  if (!text) return ''
  return new Date(`${text}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function HistoricalActivityControl({ item, legacyWebbCompletion, busy, onRecord }) {
  const [activityType, setActivityType] = useState('instructional_completion')
  const [instructionalTeacher, setInstructionalTeacher] = useState('sonoma')
  const [occurredAt, setOccurredAt] = useState('')
  const instructionalCompletionAllowed = item?.placement_kind !== 'actual'
  const selectedActivityType = instructionalCompletionAllowed ? activityType : 'slate_drill_completion'
  const validLegacyWebb = instructionalCompletionAllowed && legacyWebbCompletion?.completed === true && Number.isFinite(Date.parse(legacyWebbCompletion?.completedAt))
  const submit = () => {
    if (!occurredAt) return
    onRecord(item, {
      activityType: selectedActivityType,
      instructionalTeacher: selectedActivityType === 'instructional_completion' ? instructionalTeacher : undefined,
      occurredAt: new Date(occurredAt).toISOString(),
      provenance: 'facilitator_recorded_legacy_activity',
    })
  }
  return <details className={styles.historicalControl}>
    <summary>Record historical activity</summary>
    {validLegacyWebb && <button type="button" disabled={busy} onClick={() => onRecord(item, {
      activityType: 'instructional_completion', instructionalTeacher: 'webb', occurredAt: new Date(legacyWebbCompletion.completedAt).toISOString(), provenance: 'facilitator_attested_webb_completion_v1_import', legacyCompletion: legacyWebbCompletion,
    })}>Import legacy Webb completion from {prettyDate(legacyWebbCompletion.completedAt)}</button>}
    {instructionalCompletionAllowed ? <label>Activity<select value={activityType} onChange={(event) => setActivityType(event.target.value)}><option value="instructional_completion">Instructional lesson completed</option><option value="slate_drill_completion">Mr. Slate drill completed</option></select></label> : <p>Activity: Mr. Slate drill completed</p>}
    {instructionalCompletionAllowed && selectedActivityType === 'instructional_completion' && <label>Teacher<select value={instructionalTeacher} onChange={(event) => setInstructionalTeacher(event.target.value)}><option value="sonoma">Ms. Sonoma</option><option value="webb">Mrs. Webb</option></select></label>}
    <label>Completed at<input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label>
    <button type="button" disabled={busy || !occurredAt} onClick={submit}>{busy ? 'Recording...' : 'Add historical record'}</button>
    <small>Historical records do not create transcripts, mastery, retention, or canonical lesson-session evidence.</small>
  </details>
}

export default function FacilitatorSyllabusLessonOverlay({ selection, onClose, onOpenLesson, onTeacherAssignment, teacherBusy = false, onSchedule, canScheduleLessons = false, onReviewHistory, onRepeat, onScheduleSlate, onRemoveSlateSchedule, slateBusy = false, onEditConcept, onReplace, onUseExisting, onGenerate, replacing = false, canChangeIntent = false, onRecordHistoricalActivity, historicalActivityBusy = false, legacyWebbCompletion = null }) {
  if (!selection?.item) return null
  const { item } = selection
  const itemType = item.item_type || 'lesson'
  const isLesson = itemType === 'lesson'
  const isSlateAssignment = itemType === 'slate_assignment'
  const isConcept = isLesson && !item.lesson_key
  const assignedTeacher = normalizeInstructionalTeacher(selection.assignedTeacher || item.assigned_instructional_teacher || item.instructional_teacher) || 'sonoma'
  const readiness = String(item.readiness_state || '').replaceAll('_', ' ')
  const primaryLabel = item.readiness_state === 'draft' ? 'Prepare lesson' : 'Review lesson'
  const historyAvailable = typeof onReviewHistory === 'function' && ['completed_historical', 'incomplete_historical', 'in_progress'].includes(selection.syllabus_state)
  const schedulingAvailable = canScheduleLessons && typeof onSchedule === 'function' && isLesson && item.lesson_key && item.historical_record !== true

  return <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}>
    <section className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Lesson details for ${item.title || 'lesson'}`}>
      <header><div><p className={styles.subject}>{item.subject || 'Lesson'}</p><h2>{item.title || 'Untitled lesson'}</h2></div><button type="button" className={styles.close} onClick={onClose} aria-label="Close">Close</button></header>
      <div className={styles.body}>
        {item.description && <p className={styles.description}>{item.description}</p>}
        <dl className={styles.meta}>
          {isLesson && item.lesson_key && <><div><dt>Teacher</dt><dd>{instructionalTeacherLabel(assignedTeacher)}</dd></div><div><dt>Status</dt><dd>{readiness || selection.syllabus_state?.replaceAll('_', ' ') || 'Ready'}</dd></div></>}
          {item.planned_date && <div><dt>Date</dt><dd>{prettyDate(item.planned_date)}</dd></div>}
          {selection.currentLesson?.hasProgress && <div><dt>Progress</dt><dd>In progress</dd></div>}
          {isSlateAssignment && <div><dt>Type</dt><dd>Scheduled Mr. Slate supplemental session</dd></div>}
        </dl>
        {isLesson && item.lesson_key && selection.teacherEditable && typeof onTeacherAssignment === 'function' && <label className={styles.field}>Assigned teacher<select value={assignedTeacher} disabled={teacherBusy} onChange={(event) => onTeacherAssignment?.(item, event.target.value)}><option value="sonoma">Ms. Sonoma</option><option value="webb">Mrs. Webb</option></select></label>}
                {isConcept && <section className={styles.detailSection}><h3>Planned concept</h3><p>{selection.recoveryRequired ? 'This concept needs recovery before a lesson can be generated or bound.' : 'This concept is part of the Syllabus but does not yet have a prepared lesson file.'}</p><div className={styles.secondaryActions}>{canChangeIntent && typeof onEditConcept === 'function' && <button type="button" onClick={() => onEditConcept(item)}>Edit concept</button>}{selection.suggested && typeof onReplace === 'function' && <button type="button" disabled={replacing} onClick={() => onReplace(item)}>{replacing ? 'Replacing...' : 'Replace suggestion'}</button>}{canChangeIntent && typeof onUseExisting === 'function' && <button type="button" disabled={selection.recoveryRequired} onClick={() => onUseExisting(item)}>Use existing lesson</button>}{typeof onGenerate === 'function' && <button type="button" disabled={selection.recoveryRequired} onClick={() => onGenerate(item)}>Generate lesson</button>}</div></section>}
        {isLesson && item.lesson_key && selection.historicalActivityAllowed && typeof onRecordHistoricalActivity === 'function' && <HistoricalActivityControl item={item} legacyWebbCompletion={legacyWebbCompletion} busy={historicalActivityBusy} onRecord={onRecordHistoricalActivity} />}
      </div>
      <footer>
        <div className={styles.secondaryActions}>
          {historyAvailable && <button type="button" onClick={() => onReviewHistory(item)}>Review history</button>}
          {schedulingAvailable && <button type="button" onClick={() => onSchedule?.(item)}>{item.is_explicit_schedule ? 'Reschedule' : 'Schedule'}</button>}
          {isLesson && item.lesson_key && item.historical_record !== true && typeof onScheduleSlate === 'function' && <button type="button" disabled={slateBusy} onClick={() => onScheduleSlate(item)}>Schedule Mr. Slate</button>}
          {isSlateAssignment && typeof onRemoveSlateSchedule === 'function' && <button type="button" disabled={slateBusy} onClick={() => onRemoveSlateSchedule(item)}>Remove scheduled session</button>}
          {selection.syllabus_state === 'completed_historical' && isLesson && item.lesson_key && typeof onRepeat === 'function' && <button type="button" onClick={() => onRepeat(item)}>Prepare repeat</button>}
        </div>
        {isLesson && item.lesson_key && typeof onOpenLesson === 'function' && <button type="button" className={styles.primary} onClick={() => onOpenLesson(item, selection)}>{primaryLabel}</button>}
      </footer>
    </section>
  </div>
}
