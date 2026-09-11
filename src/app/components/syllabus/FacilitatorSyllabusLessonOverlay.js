'use client'

import { useEffect, useState } from 'react'
import { acquirePageScrollLock } from '@/app/lib/scrollLock.mjs'
import { useRouter } from 'next/navigation'
import LessonHistoryOverlay from '@/app/components/syllabus/LessonHistoryOverlay'
import LessonRevisionDialog from '@/app/components/LessonRevisionDialog'
import SyllabusScheduleDialog from '@/app/components/syllabus/SyllabusScheduleDialog'
import { ensureFacilitatorPinException, requestFacilitatorPinException } from '@/app/lib/pinGate'
import { featuresForTier } from '@/app/lib/entitlements'
import { buildLessonSchedulePayload, postLessonScheduleWithCapacityPin } from '@/app/lib/syllabus/syllabusScheduling.mjs'
import { buildInstructionalSessionRoute, instructionalTeacherLabel, normalizeInstructionalTeacher } from '@/app/lib/syllabus/instructionalTeacher.mjs'
import styles from './FacilitatorSyllabusLessonOverlay.module.css'

function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function prettyDate(value) {
  const text = dateOnly(value)
  if (!text) return ''
  return new Date(`${text}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function splitLessonKey(lessonKey) {
  const [subject, ...rest] = String(lessonKey || '').split('/')
  return { subject: subject || 'generated', fileName: rest.join('/') }
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

export default function FacilitatorSyllabusLessonOverlay({
  selection,
  learnerId = '',
  accessToken = '',
  planTier = 'free',
  resolvedToday = '',
  activeRevisionId = '',
  onChanged = null,
  onClose,
  onOpenLesson,
  onTeacherAssignment,
  teacherBusy = false,
  onSchedule,
  canScheduleLessons = null,
  onReviewHistory,
  onRepeat,
  onScheduleSlate,
  onRemoveSlateSchedule,
  slateBusy = false,
  onEditConcept,
  onRemoveConcept,
  onUseExisting,
  onGenerate,
  onGenerateWithChanges,
  onCreateOwnLesson,
  canChangeIntent = false,
  onRecordHistoricalActivity,
  historicalActivityBusy = false,
  legacyWebbCompletion = null,
}) {
  const router = useRouter()
  const item = selection?.item
  const [assignedTeacher, setAssignedTeacher] = useState('sonoma')
  const [coreBusy, setCoreBusy] = useState('')
  const [message, setMessage] = useState('')
  const [coreError, setCoreError] = useState('')
  const [localAvailable, setLocalAvailable] = useState(false)
  const [localPlannedDate, setLocalPlannedDate] = useState('')
  const [localScheduleId, setLocalScheduleId] = useState('')
  const [localExplicitSchedule, setLocalExplicitSchedule] = useState(false)
  const [scheduleDialog, setScheduleDialog] = useState(null)
  const [scheduleError, setScheduleError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [slateEditorOpen, setSlateEditorOpen] = useState(false)
  const [slateDate, setSlateDate] = useState('')
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [forecastChangeOpen, setForecastChangeOpen] = useState(false)
  const [forecastChangeRequest, setForecastChangeRequest] = useState('')
  const [conceptEditMode, setConceptEditMode] = useState('')
  const [conceptTitle, setConceptTitle] = useState('')
  const [conceptDescription, setConceptDescription] = useState('')

  useEffect(() => acquirePageScrollLock(), [])

  useEffect(() => {
    if (!item) return
    setAssignedTeacher(normalizeInstructionalTeacher(selection.assignedTeacher || item.assigned_instructional_teacher || item.instructional_teacher) || 'sonoma')
    setLocalAvailable(item.readiness_state === 'available')
    setLocalPlannedDate(dateOnly(item.planned_date))
    setLocalScheduleId(item.is_explicit_schedule === true && item.id ? String(item.id) : '')
    setLocalExplicitSchedule(item.is_explicit_schedule === true)
    setMessage('')
    setCoreError('')
    setScheduleDialog(null)
    setScheduleError('')
    setHistoryOpen(false)
    setSlateEditorOpen(false)
    setSlateDate('')
    setRevisionOpen(false)
    setForecastChangeOpen(false)
    setForecastChangeRequest('')
    setConceptEditMode('')
    setConceptTitle('')
    setConceptDescription('')
  }, [item, selection?.assignedTeacher])

  if (!item) return null

  const itemType = item.item_type || 'lesson'
  const isLesson = itemType === 'lesson'
  const isSlateAssignment = itemType === 'slate_assignment'
  const isConcept = isLesson && !item.lesson_key
  const isForecastGhost = isConcept && selection.suggested === true && item.origin === 'learning_forecast'
  const readiness = String(item.readiness_state || '').replaceAll('_', ' ')
  const isDraft = item.readiness_state === 'draft'
  const isHistorical = item.historical_record === true || item.placement_kind === 'historical' || item.placement_kind === 'actual'
  const coreAuthority = Boolean(learnerId && accessToken && item.lesson_key)
  const effectiveCanSchedule = canScheduleLessons === null ? featuresForTier(planTier).lessonScheduling === true : canScheduleLessons === true
  const occurrenceId = String(item.occurrence_id || item.id || '').trim()
  const sourceOccurrenceId = String(item.source_occurrence_id || occurrenceId).trim()
  const historyOccurrenceId = occurrenceId.startsWith('actual:') || occurrenceId.startsWith('historical:') ? occurrenceId : ''
  const historyAvailable = Boolean(historyOccurrenceId) && (typeof onReviewHistory === 'function' || coreAuthority)
  const schedulingAvailable = effectiveCanSchedule && isLesson && item.lesson_key && item.historical_record !== true && item.placement_kind !== 'actual' && !isDraft && (typeof onSchedule === 'function' || coreAuthority)
  const teacherEditable = isLesson && item.lesson_key && selection.teacherEditable && (typeof onTeacherAssignment === 'function' || coreAuthority)
  const canDeliver = isLesson && item.lesson_key && !isDraft && !isHistorical && coreAuthority
  const canEditOwnedLesson = isLesson && String(item.lesson_key || '').startsWith('generated/') && !isHistorical
  const canRegenerateOwnedLesson = canEditOwnedLesson && coreAuthority
  const canScheduleSlateCore = isLesson && item.lesson_key && !isDraft && !isHistorical && coreAuthority
  const canRepeat = selection.syllabus_state === 'completed_historical' && isLesson && item.lesson_key && (typeof onRepeat === 'function' || coreAuthority)
  const availableToLearner = localAvailable || item.readiness_state === 'available'
  const displayedDate = localPlannedDate || dateOnly(item.planned_date)

  async function refreshAfterChange() {
    if (typeof onChanged === 'function') await onChanged()
  }

  async function setAvailability({ refresh = true, announce = true } = {}) {
    if (!coreAuthority || isDraft) return false
    const response = await fetch('/api/facilitator/learners/lesson-availability', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerId, lessonKey: item.lesson_key, available: true }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json.error || 'Could not make this lesson available')
    setLocalAvailable(true)
    if (announce) setMessage('This lesson is available to the learner.')
    if (refresh) await refreshAfterChange()
    return true
  }

  async function handleMakeAvailable() {
    setCoreBusy('availability')
    setCoreError('')
    setMessage('')
    try {
      await setAvailability()
    } catch (cause) {
      setCoreError(cause.message || 'Could not make this lesson available')
    } finally {
      setCoreBusy('')
    }
  }

  async function handleStartNow() {
    if (!canDeliver) return
    setCoreBusy('start')
    setCoreError('')
    setMessage('')
    try {
      await setAvailability({ refresh: false, announce: false })
      const { subject, fileName } = splitLessonKey(item.lesson_key)
      if (!fileName) throw new Error('This lesson does not have a launchable file.')
      router.push(buildInstructionalSessionRoute({
        learnerId,
        subject,
        fileName,
        instructionalTeacher: assignedTeacher,
        occurrenceId,
      }))
    } catch (cause) {
      setCoreError(cause.message || 'Could not start this lesson')
      setCoreBusy('')
    }
  }

  async function handleTeacherChange(nextTeacher) {
    const teacher = normalizeInstructionalTeacher(nextTeacher)
    if (!teacher || !teacherEditable) return
    setCoreError('')
    setMessage('')
    if (!coreAuthority && typeof onTeacherAssignment === 'function') {
      setAssignedTeacher(teacher)
      await onTeacherAssignment(item, teacher)
      return
    }
    setCoreBusy('teacher')
    try {
      const response = await fetch('/api/syllabus/lesson-associations', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, lessonKey: item.lesson_key, occurrenceId, instructionalTeacher: teacher }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not change the instructional teacher')
      setAssignedTeacher(teacher)
      setMessage(`${instructionalTeacherLabel(teacher)} is assigned to this lesson.`)
      await refreshAfterChange()
    } catch (cause) {
      setCoreError(cause.message || 'Could not change the instructional teacher')
    } finally {
      setCoreBusy('')
    }
  }

  function openSchedule() {
    if (!schedulingAvailable) return
    if (!coreAuthority && typeof onSchedule === 'function') {
      onSchedule(item)
      return
    }
    const moving = localExplicitSchedule && Boolean(localScheduleId)
    const scheduledDate = dateOnly(displayedDate || item.original_scheduled_date || resolvedToday)
    setScheduleError('')
    setScheduleDialog({ mode: moving ? 'reschedule' : 'schedule', scheduledDate, scheduleId: moving ? localScheduleId : '' })
  }

  async function saveSchedule() {
    if (!scheduleDialog || !coreAuthority) return
    setCoreBusy('schedule')
    setScheduleError('')
    try {
      const payload = buildLessonSchedulePayload({
        learnerId,
        lessonKey: item.lesson_key,
        scheduledDate: scheduleDialog.scheduledDate,
        scheduleId: scheduleDialog.scheduleId,
        forecastLineageId: item.forecast_lineage_id || item.lineage_id || '',
      })
      const { response, json } = await postLessonScheduleWithCapacityPin({
        payload,
        postSchedule: (body) => fetch('/api/lesson-schedule', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        requestPin: (text) => requestFacilitatorPinException({ message: text }),
      })
      if (!response.ok) throw new Error(json.error || 'Could not schedule the lesson')
      setLocalPlannedDate(dateOnly(scheduleDialog.scheduledDate))
      setLocalExplicitSchedule(true)
      setLocalScheduleId(String(json?.data?.id || scheduleDialog.scheduleId || localScheduleId || ''))
      setScheduleDialog(null)
      setMessage(scheduleDialog.mode === 'reschedule' ? 'This occurrence was rescheduled.' : 'This lesson was scheduled.')
      await refreshAfterChange()
    } catch (cause) {
      setScheduleError(cause.message || 'Could not schedule the lesson')
    } finally {
      setCoreBusy('')
    }
  }

  function openHistory() {
    if (!historyAvailable) return
    if (!coreAuthority && typeof onReviewHistory === 'function') onReviewHistory(item)
    else setHistoryOpen(true)
  }

  async function handleRepeat() {
    if (!canRepeat) return
    if (!coreAuthority && typeof onRepeat === 'function') {
      onRepeat(item)
      return
    }
    const allowed = await ensureFacilitatorPinException({
      message: `You already completed ${item.title || 'this lesson'}. Enter the Facilitator PIN to prepare it as a deliberate repeat.`,
    })
    if (!allowed) return
    router.push(`/facilitator/prepare?learnerId=${encodeURIComponent(learnerId)}&lessonKey=${encodeURIComponent(item.lesson_key)}&stage=DELIVERY&repeat=1`)
  }

  function openSlateScheduler() {
    if (!coreAuthority && typeof onScheduleSlate === 'function') {
      onScheduleSlate(item)
      return
    }
    if (!canScheduleSlateCore) return
    const earliest = [dateOnly(displayedDate), dateOnly(resolvedToday)].filter(Boolean).sort().at(-1) || ''
    setSlateDate(earliest)
    setSlateEditorOpen(true)
  }

  async function saveSlateSchedule() {
    if (!slateDate || !canScheduleSlateCore) return
    setCoreBusy('slate')
    setCoreError('')
    try {
      const response = await fetch('/api/syllabus/slate-assignments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, lessonKey: item.lesson_key, occurrenceId: sourceOccurrenceId, scheduledDate: slateDate, runPurpose: 'practice' }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not schedule Mr. Slate')
      setSlateEditorOpen(false)
      setMessage('Mr. Slate supplemental practice was scheduled.')
      await refreshAfterChange()
    } catch (cause) {
      setCoreError(cause.message || 'Could not schedule Mr. Slate')
    } finally {
      setCoreBusy('')
    }
  }

  async function removeSlateSchedule() {
    if (!coreAuthority && typeof onRemoveSlateSchedule === 'function') {
      onRemoveSlateSchedule(item)
      return
    }
    if (!coreAuthority || !item.assignment_id) return
    setCoreBusy('slate')
    setCoreError('')
    try {
      const response = await fetch('/api/syllabus/slate-assignments', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, assignmentId: item.assignment_id }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not remove the scheduled Mr. Slate session')
      onClose?.()
      await refreshAfterChange()
    } catch (cause) {
      setCoreError(cause.message || 'Could not remove the scheduled Mr. Slate session')
    } finally {
      setCoreBusy('')
    }
  }

  function reviewDraft() {
    if (!isDraft || !item.lesson_key) return
    if (typeof onOpenLesson === 'function') {
      onOpenLesson(item, selection)
      return
    }
    const occurrenceContext = occurrenceId
      ? `&occurrenceId=${encodeURIComponent(occurrenceId)}${activeRevisionId ? `&expectedActiveRevisionId=${encodeURIComponent(activeRevisionId)}` : ''}`
      : ''
    router.push(`/facilitator/prepare?learnerId=${encodeURIComponent(learnerId)}&lessonKey=${encodeURIComponent(item.lesson_key)}&stage=DRAFT${occurrenceContext}`)
  }

  function editLesson() {
    if (!canEditOwnedLesson) return
    router.push(`/facilitator/lessons/edit?key=${encodeURIComponent(item.lesson_key)}`)
  }

  async function removePlannedConcept() {
    if (!isConcept || isForecastGhost || !canChangeIntent || typeof onRemoveConcept !== 'function') return
    setCoreBusy('concept-remove')
    setCoreError('')
    setMessage('')
    try {
      const result = await onRemoveConcept(item)
      if (result === false) throw new Error('The planned concept could not be removed.')
      onClose?.()
    } catch (cause) {
      setCoreError(cause.message || 'The planned concept could not be removed.')
    } finally {
      setCoreBusy('')
    }
  }
  function beginConceptEdit(mode) {
    setCoreError('')
    setMessage('')
    setConceptEditMode(mode)
    setConceptTitle(item.title || '')
    setConceptDescription(item.description || '')
  }

  async function saveConceptEdit() {
    const title = conceptTitle.trim()
    const description = conceptDescription.trim()
    const handler = conceptEditMode === 'forecast-own' ? onCreateOwnLesson : onEditConcept
    if (!title || !description || typeof handler !== 'function') return
    setCoreBusy('concept-edit')
    setCoreError('')
    setMessage('')
    try {
      const result = await handler(item, { title, description })
      if (result === false) throw new Error('The lesson plan could not be updated.')
      setConceptEditMode('')
      onClose?.()
    } catch (cause) {
      setCoreError(cause.message || 'The lesson plan could not be updated.')
    } finally {
      setCoreBusy('')
    }
  }
  async function generateForecastWithChanges() {
    const request = forecastChangeRequest.trim()
    if (!isForecastGhost || !request || typeof onGenerateWithChanges !== 'function') return
    setCoreBusy('forecast-change')
    setCoreError('')
    setMessage('')
    try {
      const generated = await onGenerateWithChanges(item, request)
      if (!generated) throw new Error('The revised forecast lesson could not be generated.')
      onClose?.()
    } catch (cause) {
      setCoreError(cause.message || 'The revised forecast lesson could not be generated.')
    } finally {
      setCoreBusy('')
    }
  }
  return <>
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}>
      <section className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Lesson details for ${item.title || 'lesson'}`}>
        <header><div><p className={styles.subject}>{item.subject || 'Lesson'}</p><h2>{item.title || 'Untitled lesson'}</h2></div><button type="button" className={styles.close} onClick={onClose} aria-label="Close">Close</button></header>
        <div className={styles.body}>
          {item.description && <p className={styles.description}>{item.description}</p>}
          {message && <div className={styles.statusMessage} role="status">{message}</div>}
          {coreError && <div className={styles.errorMessage} role="alert">{coreError}</div>}
          <dl className={styles.meta}>
            {isLesson && item.lesson_key && <><div><dt>Teacher</dt><dd>{instructionalTeacherLabel(assignedTeacher)}</dd></div><div><dt>Status</dt><dd>{readiness || selection.syllabus_state?.replaceAll('_', ' ') || 'Ready'}</dd></div></>}
            {displayedDate && <div><dt>Date</dt><dd>{prettyDate(displayedDate)}</dd></div>}
            {canDeliver && <div><dt>Availability</dt><dd>{availableToLearner ? 'Available to learner' : 'Not yet available'}</dd></div>}
            {selection.currentLesson?.hasProgress && <div><dt>Progress</dt><dd>In progress</dd></div>}
            {isSlateAssignment && <div><dt>Type</dt><dd>Scheduled Mr. Slate supplemental session</dd></div>}
          </dl>
          {teacherEditable && <label className={styles.field}>Assigned teacher<select value={assignedTeacher} disabled={teacherBusy || coreBusy === 'teacher'} onChange={(event) => void handleTeacherChange(event.target.value)}><option value="sonoma">Ms. Sonoma</option><option value="webb">Mrs. Webb</option></select></label>}
          {isConcept && <section className={styles.detailSection}>
            {isForecastGhost ? <>
              <h3>AI forecast suggestion</h3>
              <p>{selection.recoveryRequired ? 'This forecast needs recovery before a lesson can be generated.' : 'This is a one-week-ahead AI suggestion inside the future plan. No lesson file has been generated yet.'}</p>
              <div className={styles.forecastChoices}>
                {typeof onGenerate === 'function' && <button type="button" className={styles.primary} disabled={selection.recoveryRequired || coreBusy === 'forecast-change'} onClick={() => onGenerate(item)}>Generate lesson</button>}
                {typeof onGenerateWithChanges === 'function' && <button type="button" disabled={selection.recoveryRequired || coreBusy === 'forecast-change'} onClick={() => setForecastChangeOpen((open) => !open)}>Generate with changes</button>}
                {canChangeIntent && typeof onCreateOwnLesson === 'function' && <button type="button" disabled={selection.recoveryRequired || coreBusy === 'forecast-change'} onClick={() => beginConceptEdit('forecast-own')}>Create your own lesson</button>}
              </div>
              {forecastChangeOpen && <div className={styles.forecastChange}>
                <label className={styles.field}>What would you like to change?<textarea autoFocus rows={4} value={forecastChangeRequest} onChange={(event) => setForecastChangeRequest(event.target.value)} placeholder="For example: make it more hands-on, or review cold fronts first." /></label>
                <div className={styles.secondaryActions}><button type="button" disabled={coreBusy === 'forecast-change'} onClick={() => { setForecastChangeOpen(false); setForecastChangeRequest('') }}>Cancel</button><button type="button" className={styles.primary} disabled={!forecastChangeRequest.trim() || coreBusy === 'forecast-change'} onClick={() => void generateForecastWithChanges()}>{coreBusy === 'forecast-change' ? 'Generating...' : 'Generate with changes'}</button></div>
              </div>}
            </> : <>
              <h3>Planned concept</h3>
              <p>{selection.recoveryRequired ? 'This concept needs recovery before a lesson can be generated or bound.' : 'This concept is part of the Syllabus but does not yet have a prepared lesson file.'}</p>
              <div className={styles.secondaryActions}>{canChangeIntent && typeof onEditConcept === 'function' && <button type="button" onClick={() => beginConceptEdit('active')}>Edit concept</button>}{canChangeIntent && typeof onRemoveConcept === 'function' && <button type="button" disabled={coreBusy === 'concept-remove'} onClick={() => void removePlannedConcept()}>Remove concept</button>}{canChangeIntent && typeof onUseExisting === 'function' && <button type="button" disabled={selection.recoveryRequired} onClick={() => onUseExisting(item)}>Use existing lesson</button>}{typeof onGenerate === 'function' && <button type="button" disabled={selection.recoveryRequired} onClick={() => onGenerate(item)}>Generate lesson</button>}</div>
            </>}
          </section>}
          {conceptEditMode && <section className={styles.detailSection}>
            <h3>{conceptEditMode === 'forecast-own' ? 'Create your own lesson' : 'Edit planned concept'}</h3>
            <p>{conceptEditMode === 'forecast-own' ? 'Your version becomes educator-authored intent in this exact Syllabus slot before the lesson is generated.' : 'Editing this concept preserves its Syllabus slot and educator ownership.'}</p>
            <div className={styles.forecastChange}>
              <label className={styles.field}>Title<input autoFocus value={conceptTitle} onChange={(event) => setConceptTitle(event.target.value)} /></label>
              <label className={styles.field}>Brief description<textarea rows={4} value={conceptDescription} onChange={(event) => setConceptDescription(event.target.value)} /></label>
              <div className={styles.secondaryActions}><button type="button" disabled={coreBusy === 'concept-edit'} onClick={() => setConceptEditMode('')}>Cancel</button><button type="button" className={styles.primary} disabled={!conceptTitle.trim() || !conceptDescription.trim() || coreBusy === 'concept-edit'} onClick={() => void saveConceptEdit()}>{coreBusy === 'concept-edit' ? 'Saving...' : conceptEditMode === 'forecast-own' ? 'Generate my lesson' : 'Save educator intent'}</button></div>
            </div>
          </section>}
          {slateEditorOpen && <section className={styles.detailSection}><h3>Schedule Mr. Slate</h3><p>Schedule a separate supplemental practice session. This does not change the instructional teacher or complete the lesson.</p><label className={styles.field}>Mr. Slate session date<input type="date" min={[dateOnly(displayedDate), dateOnly(resolvedToday)].filter(Boolean).sort().at(-1) || ''} value={slateDate} onChange={(event) => setSlateDate(event.target.value)} /></label><div className={styles.secondaryActions}><button type="button" onClick={() => setSlateEditorOpen(false)}>Cancel</button><button type="button" disabled={!slateDate || coreBusy === 'slate'} onClick={() => void saveSlateSchedule()}>{coreBusy === 'slate' ? 'Scheduling...' : 'Schedule supplemental session'}</button></div></section>}
          {isLesson && item.lesson_key && selection.historicalActivityAllowed && typeof onRecordHistoricalActivity === 'function' && <HistoricalActivityControl item={item} legacyWebbCompletion={legacyWebbCompletion} busy={historicalActivityBusy} onRecord={onRecordHistoricalActivity} />}
        </div>
        <footer>
          <div className={styles.secondaryActions}>
            {historyAvailable && <button type="button" onClick={openHistory}>Review history</button>}
            {schedulingAvailable && <button type="button" disabled={coreBusy === 'schedule'} onClick={openSchedule}>{localExplicitSchedule ? 'Reschedule' : 'Schedule'}</button>}
            {canDeliver && !availableToLearner && <button type="button" disabled={coreBusy === 'availability'} onClick={() => void handleMakeAvailable()}>{coreBusy === 'availability' ? 'Making available...' : 'Make available'}</button>}
            {canRegenerateOwnedLesson && <button type="button" onClick={() => setRevisionOpen(true)}>Regenerate with changes</button>}
            {canEditOwnedLesson && <button type="button" onClick={editLesson}>{isDraft ? 'Edit draft' : 'Edit lesson'}</button>}
            {isLesson && item.lesson_key && !isDraft && item.historical_record !== true && (typeof onScheduleSlate === 'function' || canScheduleSlateCore) && <button type="button" disabled={slateBusy || coreBusy === 'slate'} onClick={openSlateScheduler}>Schedule Mr. Slate</button>}
            {isSlateAssignment && (typeof onRemoveSlateSchedule === 'function' || coreAuthority) && <button type="button" disabled={slateBusy || coreBusy === 'slate'} onClick={() => void removeSlateSchedule()}>Remove scheduled session</button>}
            {canRepeat && <button type="button" onClick={() => void handleRepeat()}>Prepare repeat</button>}
          </div>
          {isDraft && item.lesson_key && <button type="button" className={styles.primary} onClick={reviewDraft}>Review & approve draft</button>}
          {canDeliver && <button type="button" className={styles.primary} disabled={coreBusy === 'start'} onClick={() => void handleStartNow()}>{coreBusy === 'start' ? 'Starting...' : 'Start now'}</button>}
        </footer>
      </section>
    </div>
    {scheduleDialog && <SyllabusScheduleDialog
      mode={scheduleDialog.mode}
      scheduledDate={scheduleDialog.scheduledDate}
      minimumDate={dateOnly(resolvedToday)}
      item={item}
      busy={coreBusy === 'schedule'}
      error={scheduleError}
      onClose={() => { setScheduleDialog(null); setScheduleError('') }}
      onDateChange={(scheduledDate) => setScheduleDialog((current) => ({ ...current, scheduledDate }))}
      onSubmit={() => void saveSchedule()}
    />}
    <LessonRevisionDialog
      open={revisionOpen}
      lessonKey={item.lesson_key}
      lessonTitle={item.title || 'lesson'}
      accessToken={accessToken}
      onClose={() => setRevisionOpen(false)}
      onRevised={async () => {
        setLocalAvailable(false)
        await refreshAfterChange()
        onClose?.()
      }}
    />
    {historyOpen && historyOccurrenceId && <LessonHistoryOverlay
      learnerId={learnerId}
      occurrenceId={historyOccurrenceId}
      accessToken={accessToken}
      pageIdentity={`${activeRevisionId}:${learnerId}`}
      onClose={() => setHistoryOpen(false)}
    />}
  </>
}