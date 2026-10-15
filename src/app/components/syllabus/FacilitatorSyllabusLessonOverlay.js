'use client'

import { forecastCarryLessonKey, lessonGenerationPresentation } from '@/app/lib/syllabus/lessonGenerationState.mjs'
import { useEffect, useState } from 'react'
import { acquirePageScrollLock } from '@/app/lib/scrollLock.mjs'
import { useRouter } from 'next/navigation'
import LessonHistoryOverlay from '@/app/components/syllabus/LessonHistoryOverlay'
import LessonRevisionDialog from '@/app/components/LessonRevisionDialog'
import SyllabusScheduleDialog from '@/app/components/syllabus/SyllabusScheduleDialog'
import { ensureFacilitatorPinException, requestFacilitatorPinException } from '@/app/lib/pinGate'
import { featuresForTier } from '@/app/lib/entitlements'
import { buildLessonSchedulePayload, postLessonScheduleWithCapacityPin } from '@/app/lib/syllabus/syllabusScheduling.mjs'
import { buildInstructionalSessionRoute, instructionalTeacherIcon, instructionalTeacherLabel, normalizeInstructionalTeacher } from '@/app/lib/syllabus/instructionalTeacher.mjs'
import { REVIEW_TEACHER_SELECTION_IDS, REVIEW_TEACHERS, normalizeReviewTeacherSelection, reviewTeacherSelectionIcon, reviewTeacherSelectionLabel } from '@/app/lib/reviewTeacher.js'
import { buildLessonGeneratorReviewHref } from '@/app/lib/facilitatorLessonWorkflow.mjs'
import { getLearner } from '@/app/facilitator/learners/clientApi'
import { getStoredAssessments, saveAssessments } from '@/app/session/assessment/assessmentStore'
import { buildSlateLiftoffTestItems, slateLiftoffPrintableTestItems } from '@/app/lib/slateLiftoffTest.mjs'
import { validateSlateTestAlignment } from '@/app/lib/slateTestAlignment.mjs'
import SlateIndependentTestReport from '@/app/session/slate/SlateIndependentTestReport'
import { buildAssessmentPhaseSets, resolveLearnerAssessmentTargets } from '@/app/session/assessment/assessmentSets'
import { loadLesson } from '@/app/session/v2/services'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import styles from './FacilitatorSyllabusLessonOverlay.module.css'

function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function prettyDate(value) {
  const text = dateOnly(value)
  if (!text) return ''
  return new Date(`${text}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function prettyDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return prettyDate(value)
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function liftoffOccurrenceId(item) {
  return String(item?.source_occurrence_id || item?.occurrence_id || item?.id || '').trim()
}

function liftoffProgressFromSnapshot(snapshot, expectedOccurrenceId = '') {
  const feature = snapshot?.featureState
  if (!feature || feature.kind !== 'slate-liftoff-v1') return null
  if (expectedOccurrenceId && String(feature.occurrenceId || '') !== String(expectedOccurrenceId)) return null
  const liftoff = feature.liftoff
  if (!liftoff || typeof liftoff !== 'object') return null
  return {
    source: 'live_snapshot',
    phase: String(feature.phase || 'active'),
    updated_at: snapshot?.savedAt || null,
    component_state: Array.isArray(liftoff.components) ? liftoff.components : [],
    responsibility_trace: Array.isArray(liftoff.trace) ? liftoff.trace : [],
    integration_confirmed: liftoff.integrationConfirmed === true,
    variation_confirmed: liftoff.variationConfirmed === true,
    procedure_released: liftoff.procedureReleased === true,
    independent_test_percentage: Number.isFinite(Number(feature.finalPercentage)) ? Number(feature.finalPercentage) : null,
    assessment_index: Math.max(0, Number(feature.assessmentIndex) || 0),
  }
}

function liftoffProgressFromRecord(record) {
  if (!record || typeof record !== 'object') return null
  return {
    source: 'completed_record',
    phase: 'completed',
    updated_at: record.completed_at || record.created_at || null,
    component_state: Array.isArray(record.component_state) ? record.component_state : [],
    responsibility_trace: Array.isArray(record.responsibility_trace) ? record.responsibility_trace : [],
    integration_confirmed: record.integration_confirmed === true,
    variation_confirmed: record.variation_confirmed === true,
    procedure_released: record.procedure_released === true,
    independent_test_percentage: Number.isFinite(Number(record.independent_test_percentage)) ? Number(record.independent_test_percentage) : null,
    assessment_index: null,
  }
}

function RecordedLessonActivity({ item, teacherName, historyAvailable, onOpenHistory }) {
  const actualKind = String(item?.actual_kind || '')
  const completedAt = item?.completed_at || (actualKind === 'completed' ? item?.actual_at : null)
  const startedAt = item?.started_at || (actualKind === 'in_progress' ? item?.actual_at : null)
  const attemptedAt = actualKind === 'incomplete' ? item?.actual_at : null
  return <details className={styles.historicalControl}>
    <summary>Lesson record</summary>
    {actualKind === 'completed' && completedAt && <p><strong>Completed:</strong> {prettyDateTime(completedAt)}</p>}
    {actualKind === 'in_progress' && startedAt && <p><strong>Started:</strong> {prettyDateTime(startedAt)}</p>}
    {actualKind === 'incomplete' && attemptedAt && <p><strong>Attempted:</strong> {prettyDateTime(attemptedAt)}</p>}
    {teacherName && <p><strong>Teacher:</strong> {teacherName}</p>}
    {actualKind === 'completed'
      ? (historyAvailable
          ? <button type="button" onClick={onOpenHistory}>View transcript &amp; lesson history</button>
          : <small>Transcript access is not available for this completed record.</small>)
      : <small>Transcript access becomes available when the lesson is completed.</small>}
  </details>
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
    {instructionalCompletionAllowed ? <label>Activity<select value={activityType} onChange={(event) => setActivityType(event.target.value)}><option value="instructional_completion">Instructional lesson completed</option><option value="slate_drill_completion">Daily Review completed</option></select></label> : <p>Activity: Daily Review completed</p>}
    {instructionalCompletionAllowed && selectedActivityType === 'instructional_completion' && <label>Teacher<select value={instructionalTeacher} onChange={(event) => setInstructionalTeacher(event.target.value)}><option value="sonoma">Ms. Sonoma</option><option value="webb">Mrs. Webb</option><option value="slate">Mr. Slate</option></select></label>}
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
  workflowSource = 'syllabus',
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
  generationBusy = false,
  actionBlockReason = '',
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
  const [localPlannedDate, setLocalPlannedDate] = useState('')
  const [localScheduleId, setLocalScheduleId] = useState('')
  const [localExplicitSchedule, setLocalExplicitSchedule] = useState(false)
  const [scheduleDialog, setScheduleDialog] = useState(null)
  const [scheduleError, setScheduleError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [slateEditorOpen, setSlateEditorOpen] = useState(false)
  const [slateDate, setSlateDate] = useState('')
  const [slateTeacher, setSlateTeacher] = useState('slate')
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [repeatMode, setRepeatMode] = useState(false)
  const [learnerLessonBound, setLearnerLessonBound] = useState(false)
  const [removalBusy, setRemovalBusy] = useState('')
  const [forecastChangeOpen, setForecastChangeOpen] = useState(false)
  const [forecastChangeRequest, setForecastChangeRequest] = useState('')
  const [conceptEditMode, setConceptEditMode] = useState('')
  const [conceptTitle, setConceptTitle] = useState('')
  const [conceptDescription, setConceptDescription] = useState('')
  const [printOpen, setPrintOpen] = useState(false)
  const [printBusy, setPrintBusy] = useState('')
  const [printError, setPrintError] = useState('')
  const [liftoffRecord, setLiftoffRecord] = useState(null)
  const [liftoffRecordLoading, setLiftoffRecordLoading] = useState(false)
  const [liftoffProgress, setLiftoffProgress] = useState(null)
  const [liftoffProgressLoading, setLiftoffProgressLoading] = useState(false)
  const [liftoffRealtimeStatus, setLiftoffRealtimeStatus] = useState('idle')

  useEffect(() => acquirePageScrollLock(), [])

  useEffect(() => {
    if (!item) return
    setAssignedTeacher(normalizeInstructionalTeacher(selection.assignedTeacher || item.assigned_instructional_teacher || item.instructional_teacher) || 'sonoma')
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
    setSlateTeacher(normalizeReviewTeacherSelection(item.review_teacher))
    setRevisionOpen(false)
    setRepeatMode(false)
    setLearnerLessonBound(false)
    setRemovalBusy('')
    setForecastChangeOpen(false)
    setForecastChangeRequest('')
    setConceptEditMode('')
    setConceptTitle('')
    setConceptDescription('')
    setPrintOpen(false)
    setPrintBusy('')
    setPrintError('')
  }, [learnerId, item?.lineage_id, item?.occurrence_id, item?.lesson_key, selection?.assignedTeacher]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLearnerLessonBound(false)
    if (!learnerId || !accessToken || !item?.lesson_key) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams({ learnerId, lessonKey: item.lesson_key })
        const response = await fetch(`/api/facilitator/learners/lesson-availability?${params}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await response.json().catch(() => ({}))
        if (!cancelled && response.ok) setLearnerLessonBound(json?.currentlyBound === true)
      } catch {
        if (!cancelled) setLearnerLessonBound(false)
      }
    })()
    return () => { cancelled = true }
  }, [accessToken, item?.lesson_key, learnerId])

  useEffect(() => {
    setLiftoffRecord(null)
    setLiftoffRecordLoading(false)
    if (!learnerId || !accessToken || !item?.lesson_key) return undefined
    const teacher = normalizeInstructionalTeacher(item.actual_instructional_teacher || item.instructional_teacher || item.assigned_instructional_teacher || selection?.assignedTeacher)
    if (teacher !== 'slate') return undefined
    const sourceId = liftoffOccurrenceId(item)
    if (!sourceId) return undefined
    let cancelled = false
    setLiftoffRecordLoading(true)
    ;(async () => {
      try {
        const params = new URLSearchParams({ learnerId, lessonKey: item.lesson_key, occurrenceId: sourceId })
        const response = await fetch(`/api/slate-liftoff/records?${params}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await response.json().catch(() => ({}))
        if (!cancelled && response.ok) setLiftoffRecord(Array.isArray(json?.records) ? (json.records[0] || null) : null)
      } catch {
        if (!cancelled) setLiftoffRecord(null)
      } finally {
        if (!cancelled) setLiftoffRecordLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [accessToken, item?.actual_instructional_teacher, item?.assigned_instructional_teacher, item?.id, item?.instructional_teacher, item?.lesson_key, item?.occurrence_id, item?.source_occurrence_id, learnerId, selection?.assignedTeacher])

  useEffect(() => {
    setLiftoffProgress(null)
    setLiftoffProgressLoading(false)
    setLiftoffRealtimeStatus('idle')
    if (!learnerId || !accessToken || !item?.lesson_key) return undefined
    const teacher = normalizeInstructionalTeacher(item.actual_instructional_teacher || item.instructional_teacher || item.assigned_instructional_teacher || selection?.assignedTeacher)
    if (teacher !== 'slate') return undefined
    const sourceId = liftoffOccurrenceId(item)
    if (!sourceId) return undefined

    let cancelled = false
    let channel = null
    const supabase = getSupabaseClient()

    const applySnapshot = (snapshot) => {
      const progress = liftoffProgressFromSnapshot(snapshot, sourceId)
      if (!cancelled && progress) setLiftoffProgress(progress)
      return progress
    }

    setLiftoffProgressLoading(true)
    ;(async () => {
      try {
        const params = new URLSearchParams({ learnerId, lessonKey: item.lesson_key })
        const response = await fetch(`/api/snapshots?${params}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await response.json().catch(() => ({}))
        if (!cancelled && response.ok) applySnapshot(json?.snapshot || null)
      } catch {
        // Realtime can still supply the next snapshot update.
      } finally {
        if (!cancelled) setLiftoffProgressLoading(false)
      }

      if (cancelled || !supabase) return
      try {
        await supabase.realtime.setAuth(accessToken)
      } catch {
        if (!cancelled) setLiftoffRealtimeStatus('auth_error')
        return
      }
      if (cancelled) return

      channel = supabase
        .channel(`liftoff-progress:${learnerId}:${item.lesson_key}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'learner_snapshots',
          filter: `learner_id=eq.${learnerId}`,
        }, (payload) => {
          const row = payload?.new && typeof payload.new === 'object' ? payload.new : null
          if (!row || String(row.lesson_key || '') !== String(item.lesson_key || '')) return
          const progress = liftoffProgressFromSnapshot(row.data, sourceId)
          if (progress && row.updated_at) progress.updated_at = row.updated_at
          if (!cancelled && progress) setLiftoffProgress(progress)
        })
        .subscribe((status) => {
          if (!cancelled) setLiftoffRealtimeStatus(String(status || '').toLowerCase())
        })
    })()

    return () => {
      cancelled = true
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [accessToken, item?.actual_instructional_teacher, item?.assigned_instructional_teacher, item?.id, item?.instructional_teacher, item?.lesson_key, item?.occurrence_id, item?.source_occurrence_id, learnerId, selection?.assignedTeacher])

  if (!item) return null

  const itemType = item.item_type || 'lesson'
  const isLesson = itemType === 'lesson'
  const isSlateAssignment = itemType === 'slate_assignment'
  const isConcept = isLesson && !item.lesson_key
  const isForecastGhost = isConcept && selection.suggested === true && item.origin === 'learning_forecast'
  const generation = lessonGenerationPresentation(item, { busy: generationBusy, recoveryRequired: selection.recoveryRequired })
  const carryLessonKey = forecastCarryLessonKey(item)
  const readiness = String(item.readiness_state || '').replaceAll('_', ' ')
  const isDraft = item.readiness_state === 'draft'
  const isHistorical = item.historical_record === true || item.placement_kind === 'historical' || item.placement_kind === 'actual'
  const coreAuthority = Boolean(learnerId && accessToken && item.lesson_key)
  const effectiveCanSchedule = canScheduleLessons === null ? featuresForTier(planTier).lessonScheduling === true : canScheduleLessons === true
  const occurrenceId = String(item.occurrence_id || item.id || '').trim()
  const sourceOccurrenceId = String(item.source_occurrence_id || occurrenceId).trim()
  const historyOccurrenceId = occurrenceId.startsWith('actual:') || occurrenceId.startsWith('historical:') ? occurrenceId : ''
  const exactOccurrenceIsProtected = sourceOccurrenceId.startsWith('actual:') || sourceOccurrenceId.startsWith('historical:')
  const canRemoveExactOccurrence = coreAuthority && canChangeIntent && !isHistorical && Boolean(sourceOccurrenceId) && !exactOccurrenceIsProtected
  const canRemoveFromLearner = coreAuthority && learnerLessonBound === true && !isHistorical
  const historyAvailable = Boolean(historyOccurrenceId) && (typeof onReviewHistory === 'function' || coreAuthority)
  const repeatDeliveryActive = repeatMode && selection.syllabus_state === 'completed_historical'
  const schedulingAvailable = effectiveCanSchedule && isLesson && item.lesson_key && !isDraft && (!isHistorical || repeatDeliveryActive) && (typeof onSchedule === 'function' || coreAuthority)
  const teacherEditable = isLesson && item.lesson_key && selection.teacherEditable && (typeof onTeacherAssignment === 'function' || coreAuthority)
  const canDeliver = isLesson && item.lesson_key && !isDraft && (!isHistorical || repeatDeliveryActive) && coreAuthority
  const canEditOwnedLesson = isLesson && String(item.lesson_key || '').startsWith('generated/') && !isHistorical
  const canRegenerateOwnedLesson = canEditOwnedLesson && coreAuthority
  const canScheduleSlateCore = isLesson && item.lesson_key && !isDraft && !isHistorical && coreAuthority
  const canRepeat = !repeatDeliveryActive && selection.syllabus_state === 'completed_historical' && isLesson && item.lesson_key && (typeof onRepeat === 'function' || coreAuthority)
  const canPrintMaterials = coreAuthority && isLesson && Boolean(item.lesson_key) && !isDraft
  const displayedDate = localPlannedDate || dateOnly(item.planned_date)
  const actualKind = String(item.actual_kind || '')
  const completedAt = item.completed_at || (actualKind === 'completed' ? item.actual_at : null)
  const startedAt = item.started_at || (actualKind === 'in_progress' ? item.actual_at : null)
  const attemptedAt = actualKind === 'incomplete' ? item.actual_at : null
  const scheduledDate = dateOnly(item.scheduled_date || (!isHistorical ? displayedDate : ''))
  const displayTeacher = normalizeInstructionalTeacher(item.actual_instructional_teacher || (isHistorical ? item.instructional_teacher : null) || assignedTeacher) || 'sonoma'
  const historicalInstructionalTeacher = normalizeInstructionalTeacher(item.actual_instructional_teacher || item.instructional_teacher || item.assigned_instructional_teacher)
  const headerInstructionalTeacher = isLesson && item.lesson_key ? (isHistorical ? historicalInstructionalTeacher : assignedTeacher) : null
  const displayStatus = repeatDeliveryActive ? 'Retry ready' : actualKind === 'completed' ? 'Completed' : actualKind === 'in_progress' ? 'In progress' : actualKind === 'incomplete' ? 'Incomplete' : (readiness || selection.syllabus_state?.replaceAll('_', ' ') || 'Ready')
  const retentionAnnotation = (item.slate_annotations || []).find((annotation) => annotation?.kind === 'retention') || null
  const completedLiftoffProgress = liftoffProgressFromRecord(liftoffRecord)
  const displayedLiftoffProgress = actualKind === 'completed' && completedLiftoffProgress
    ? completedLiftoffProgress
    : (liftoffProgress || completedLiftoffProgress)
  const liftoffComponents = displayedLiftoffProgress?.component_state || []
  const liftoffEssentialComponents = liftoffComponents.filter((component) => component?.essential !== false)
  const liftoffIndependentCount = liftoffEssentialComponents.filter((component) => ['independent', 'retained'].includes(String(component?.evidenceState || ''))).length
  const liftoffEssentialCount = liftoffEssentialComponents.length || liftoffComponents.length
  const liftoffLive = displayedLiftoffProgress?.source === 'live_snapshot' && actualKind !== 'completed'

  async function refreshAfterChange() {
    if (typeof onChanged === 'function') await onChanged()
  }

  async function ensureStartAccess() {
    if (!coreAuthority || isDraft) return false
    const response = await fetch('/api/facilitator/learners/lesson-availability', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerId, lessonKey: item.lesson_key, available: true }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json.error || 'Could not prepare this lesson to start')
    return true
  }

  async function handleStartNow() {
    if (!canDeliver) return
    setCoreBusy('start')
    setCoreError('')
    setMessage('')
    try {
      await ensureStartAccess()
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
      message: `You already completed ${item.title || 'this lesson'}. Enter the Facilitator PIN to retry this completed lesson.`,
    })
    if (!allowed) return
    setRepeatMode(true)
    setMessage('Retry ready. Choose Start now or Schedule.')
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
        body: JSON.stringify({ learnerId, lessonKey: item.lesson_key, occurrenceId: sourceOccurrenceId, scheduledDate: slateDate, runPurpose: 'practice', reviewTeacher: slateTeacher }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not schedule Daily Review')
      setSlateEditorOpen(false)
      setMessage(slateTeacher === 'learner' ? 'Daily Review was scheduled so the learner will choose the teacher.' : `Daily Review was scheduled with ${reviewTeacherSelectionLabel(slateTeacher)}.`)
      await refreshAfterChange()
    } catch (cause) {
      setCoreError(cause.message || 'Could not schedule Daily Review')
    } finally {
      setCoreBusy('')
    }
  }

  async function updateScheduledReviewTeacher(nextTeacher) {
    if (!coreAuthority || !item.assignment_id) return
    const reviewTeacher = normalizeReviewTeacherSelection(nextTeacher)
    setCoreBusy('slate')
    setCoreError('')
    try {
      const response = await fetch('/api/syllabus/slate-assignments', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, assignmentId: item.assignment_id, reviewTeacher }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not update the Daily Review teacher')
      setSlateTeacher(reviewTeacher)
      setMessage(reviewTeacher === 'learner' ? 'Daily Review teacher changed so the learner will choose.' : `Daily Review teacher changed to ${reviewTeacherSelectionLabel(reviewTeacher)}.`)
      await refreshAfterChange()
    } catch (cause) {
      setCoreError(cause.message || 'Could not update the Daily Review teacher')
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
      if (!response.ok) throw new Error(json.error || 'Could not remove the scheduled Daily Review')
      onClose?.()
      await refreshAfterChange()
    } catch (cause) {
      setCoreError(cause.message || 'Could not remove the scheduled Daily Review')
    } finally {
      setCoreBusy('')
    }
  }

  function reviewDraft() {
    if (!isDraft || !item.lesson_key) return
    onClose?.()
    if (typeof onOpenLesson === 'function') {
      onOpenLesson(item, selection)
      return
    }
    router.push(buildLessonGeneratorReviewHref({
      learnerId,
      lessonKey: item.lesson_key,
      source: workflowSource,
      plannedDate: dateOnly(item.planned_date),
      occurrenceId,
      expectedActiveRevisionId: activeRevisionId,
    }))
  }

  async function loadPrintableLesson() {
    const { subject, fileName } = splitLessonKey(item.lesson_key)
    if (!fileName) throw new Error('This lesson does not have printable content.')
    if (subject.toLowerCase() === 'generated') {
      const response = await fetch(`/api/facilitator/lessons/get?${new URLSearchParams({ file: item.lesson_key })}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const lesson = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(lesson?.error || 'Could not load this lesson for printing.')
      return lesson
    }
    return loadLesson(fileName, subject)
  }

  async function loadSlatePrintableLesson() {
    // Use Mr. Slate's lesson loader, not the other teachers' assessment generator.
    const response = await fetch('/api/lessons/meta', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: [item.lesson_key], learner_id: learnerId }),
    })
    const data = await response.json().catch(() => null)
    const lesson = data?.lessons?.find((entry) => entry.lessonKey === item.lesson_key)
    if (!response.ok || !lesson) throw new Error('Mr. Slate could not load the independent test for printing.')
    return lesson
  }
  async function handlePrintMaterial(kind) {
    if (!canPrintMaterials || !['worksheet', 'test'].includes(kind) || (displayTeacher === 'slate' && kind !== 'test')) return
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null
    setPrintBusy(kind)
    setPrintError('')
    try {
      const slateTest = displayTeacher === 'slate'
      const stored = slateTest ? null : await getStoredAssessments(item.lesson_key, { learnerId })
      let source = Array.isArray(stored?.[kind]) && stored[kind].length ? stored[kind] : null
      let lesson = null

      if (slateTest) {
        lesson = await loadSlatePrintableLesson()
        source = buildSlateLiftoffTestItems(lesson)
        if (!validateSlateTestAlignment({ lesson, testItems: source }).ok) {
          throw new Error("The stored test does not verify every lesson objective. Print Mr. Slate's verified independent test from the learner session after Liftoff.")
        }
      } else if (!source) {
        const [loadedLesson, learner] = await Promise.all([
          loadPrintableLesson(),
          getLearner(learnerId),
        ])
        if (!learner) throw new Error('Could not load the learner settings needed for this worksheet and test.')
        lesson = loadedLesson
        const targets = resolveLearnerAssessmentTargets(learner, { learnerId })
        const sets = buildAssessmentPhaseSets({ lessonData: lesson, targets })
        if (!sets) throw new Error('Worksheet and test content are unavailable for this lesson.')
        await saveAssessments(item.lesson_key, sets, { learnerId })
        source = sets[kind]
      }

      if (!Array.isArray(source) || !source.length) {
        throw new Error(`${kind === 'worksheet' ? 'Worksheet' : 'Test'} content is unavailable for this lesson.`)
      }

      const { createAssessmentPdf } = await import('@/app/session/assessment/printPdf')
      await createAssessmentPdf({
        items: slateTest ? slateLiftoffPrintableTestItems(source) : source.map((question, index) => ({ ...question, number: question.number || index + 1 })),
        label: kind,
        lessonTitle: lesson?.title || item.title || 'Lesson',
        fileBase: slateTest ? String(item.lesson_key).replace(/[\\/]/g, '-') : item.lesson_key,
        previewWin,
      })
    } catch (cause) {
      try {
        if (previewWin && !previewWin.closed && previewWin.location?.href === 'about:blank') previewWin.close()
      } catch {}
      setPrintError(cause?.message || `Could not print the ${kind}.`)
    } finally {
      setPrintBusy('')
    }
  }

  async function removeExactSyllabusOccurrence() {
    if (!canRemoveExactOccurrence) return
    const confirmed = window.confirm('This removes only this occurrence from the Syllabus. The lesson, other occurrences, and existing learning history remain.')
    if (!confirmed) return
    setRemovalBusy('occurrence')
    setCoreError('')
    setMessage('')
    try {
      const payload = { learnerId, lessonKey: item.lesson_key, occurrenceId: sourceOccurrenceId }
      if (activeRevisionId) payload.expectedActiveRevisionId = activeRevisionId
      const response = await fetch('/api/syllabus/lesson-occurrences', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json?.error || 'Could not remove this Syllabus occurrence')
      onClose?.()
      await refreshAfterChange()
    } catch (cause) {
      // The server may have completed the removal before a late transport/readback
      // failure. Reconcile the Syllabus before presenting an error so a removed
      // occurrence never remains stuck on screen until a manual browser refresh.
      await refreshAfterChange()
      setCoreError(cause?.message || 'Could not remove this Syllabus occurrence')
    } finally {
      setRemovalBusy('')
    }
  }

  async function removeLessonFromLearner() {
    if (!canRemoveFromLearner) return
    const confirmed = window.confirm("This removes the lesson from this learner's current and future plan and availability. The lesson itself and existing learning history remain.")
    if (!confirmed) return
    setRemovalBusy('learner')
    setCoreError('')
    setMessage('')
    try {
      const response = await fetch('/api/facilitator/learners/lesson-availability', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, lessonKey: item.lesson_key, available: false }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json?.error || 'Could not remove this lesson from the learner')
      setLearnerLessonBound(false)
      onClose?.()
      await refreshAfterChange()
    } catch (cause) {
      await refreshAfterChange()
      setCoreError(cause?.message || 'Could not remove this lesson from the learner')
    } finally {
      setRemovalBusy('')
    }
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
    if (actionBlockReason || generationBusy || !title || !description || typeof handler !== 'function') return
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
    if (actionBlockReason || generationBusy || !isConcept || !generation.canEdit || !request || typeof onGenerateWithChanges !== 'function') return
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
        <header><div><p className={styles.subject}>{item.subject || 'Lesson'}</p><h2>{isSlateAssignment ? `${reviewTeacherSelectionIcon(slateTeacher)} Daily Review` : `${headerInstructionalTeacher ? `${instructionalTeacherIcon(headerInstructionalTeacher)} ` : ''}${item.title || 'Untitled lesson'}`}</h2></div><button type="button" className={styles.close} onClick={onClose} aria-label="Close">Close</button></header>
        <div className={styles.body}>
          {printOpen ? <section className={styles.detailSection}>
            <h3>Print lesson materials</h3>
            {displayTeacher === 'slate' ? <p>Open Mr. Slate&apos;s independent test in a printable PDF preview. Printing here does not start the lesson.</p> : <p>Open the learner&apos;s worksheet or test in a printable PDF preview. Printing here does not start the lesson.</p>}
            {printError && <div className={styles.errorMessage} role="alert">{printError}</div>}
            <div className={styles.secondaryActions}>
              {displayTeacher !== 'slate' && <button type="button" className={styles.primary} disabled={Boolean(printBusy)} onClick={() => void handlePrintMaterial('worksheet')}>{printBusy === 'worksheet' ? 'Opening worksheet...' : 'Print Worksheet'}</button>}
              <button type="button" className={styles.primary} disabled={Boolean(printBusy)} onClick={() => void handlePrintMaterial('test')}>{printBusy === 'test' ? 'Opening test...' : 'Print Test'}</button>
            </div>
          </section> : <>
          {item.description && <p className={styles.description}>{item.description}</p>}
          {message && <div className={styles.statusMessage} role="status">{message}</div>}
          {coreError && <div className={styles.errorMessage} role="alert">{coreError}</div>}
          <dl className={styles.meta}>
            {isLesson && item.lesson_key && <><div><dt>Teacher</dt><dd>{instructionalTeacherLabel(displayTeacher)}</dd></div><div><dt>Status</dt><dd>{displayStatus}</dd></div></>}
            {isLesson && item.lesson_key && retentionAnnotation && <div><dt>Retention</dt><dd>{['retained', 'demonstrated'].includes(String(retentionAnnotation.state || '')) ? 'Completed' : (retentionAnnotation.label || 'Recorded')}</dd></div>}
            {!isHistorical && displayedDate && <div><dt>Scheduled</dt><dd>{prettyDate(displayedDate)}</dd></div>}
            {isHistorical && scheduledDate && <div><dt>Scheduled</dt><dd>{prettyDate(scheduledDate)}</dd></div>}
            {actualKind === 'completed' && completedAt && <div><dt>Completed</dt><dd>{prettyDateTime(completedAt)}</dd></div>}
            {actualKind === 'in_progress' && startedAt && <div><dt>Started</dt><dd>{prettyDateTime(startedAt)}</dd></div>}
            {actualKind === 'incomplete' && attemptedAt && <div><dt>Attempted</dt><dd>{prettyDateTime(attemptedAt)}</dd></div>}
            {actualKind !== 'completed' && selection.currentLesson?.hasProgress && <div><dt>Progress</dt><dd>In progress</dd></div>}
            {isSlateAssignment && <><div><dt>Type</dt><dd>Daily Review</dd></div><div><dt>Review teacher</dt><dd>{reviewTeacherSelectionIcon(slateTeacher)} {reviewTeacherSelectionLabel(slateTeacher)}</dd></div></>}
          </dl>
          {displayTeacher === 'slate' && isLesson && item.lesson_key && <section className={styles.detailSection}>
            <h3>Mr. Slate objectives</h3>
            {(liftoffProgressLoading || liftoffRecordLoading) && !displayedLiftoffProgress ? <p>Loading objectives...</p> : displayedLiftoffProgress ? <>
              <p><strong>{liftoffIndependentCount}/{liftoffEssentialCount} complete</strong>{liftoffLive ? ' · Live' : ' · Recorded'}</p>
              {liftoffComponents.length > 0 && <ul style={{ listStyle: 'none', paddingLeft: 0, margin: '10px 0 14px' }}>{liftoffComponents.map((component) => {
                const evidenceState = String(component?.evidenceState || 'unobserved')
                const demonstrated = ['independent', 'retained'].includes(evidenceState)
                const evidenceLabel = evidenceState.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
                return <li key={component.id || component.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                  <input type="checkbox" checked={demonstrated} readOnly tabIndex={-1} aria-label={`${component.name || component.id || 'Objective'} ${demonstrated ? 'complete' : 'not complete'}`} style={{ marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <strong>{component.name || component.id || 'Objective'}</strong>
                    <small style={{ display: 'block', marginTop: 2, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>{evidenceLabel}</small>
                  </div>
                </li>
              })}</ul>}
              <details>
                <summary>Instructional details</summary>
                <p><strong>Phase:</strong> {String(displayedLiftoffProgress.phase || 'active').replaceAll('_', ' ')}{displayedLiftoffProgress.updated_at ? <span> · Updated {prettyDateTime(displayedLiftoffProgress.updated_at)}</span> : null}</p>
                <p><strong>Integrated use:</strong> {displayedLiftoffProgress.integration_confirmed ? 'Confirmed' : 'Not confirmed'} · <strong>Variation:</strong> {displayedLiftoffProgress.variation_confirmed ? 'Confirmed' : 'Not confirmed'} · <strong>Procedure released:</strong> {displayedLiftoffProgress.procedure_released ? 'Yes' : 'No'}</p>
                {displayedLiftoffProgress.independent_test_percentage != null && Number.isFinite(Number(displayedLiftoffProgress.independent_test_percentage)) && <p><strong>Independent test:</strong> {Math.round(Number(displayedLiftoffProgress.independent_test_percentage))}%</p>}
                {liftoffComponents.some((component) => component.description || (Array.isArray(component.dependencies) && component.dependencies.length > 0)) && <ul>{liftoffComponents.map((component) => <li key={`detail-${component.id || component.name}`}><strong>{component.name || component.id || 'Objective'}:</strong> {String(component.evidenceState || 'unobserved').replaceAll('_', ' ')}{component.description ? <div>{component.description}</div> : null}{Array.isArray(component.dependencies) && component.dependencies.length > 0 ? <small>Depends on: {component.dependencies.join(', ')}</small> : null}</li>)}</ul>}
                {(displayedLiftoffProgress.responsibility_trace || []).length > 0 && <details><summary>Instructional trace</summary><ol>{displayedLiftoffProgress.responsibility_trace.map((entry, index) => <li key={String(entry.turn || index) + '-' + index}><strong>Turn {entry.turn || index + 1}:</strong> {String(entry.diagnosis || 'unknown').replaceAll('_', ' ')}{entry.evidence ? <span> - {entry.evidence}</span> : null}{entry.action?.type ? <div><strong>Next move:</strong> {String(entry.action.type).replaceAll('_', ' ')}{entry.action.reason ? <span> - {entry.action.reason}</span> : null}</div> : null}</li>)}</ol></details>}
              </details>
              {liftoffRecord?.test_report_unavailable && <p role="status">The grading report could not be loaded. The recorded score remains unchanged.</p>}
              {liftoffRecord && !liftoffRecord.test_report && !liftoffRecord.test_report_unavailable && <p>No question-level grading evidence is available for this historical test.</p>}
              {liftoffRecord?.test_report?.items?.length > 0 && <details style={{ marginTop: 12 }}>
                <summary style={{ fontWeight: 800, cursor: 'pointer' }}>
                  View independent test grading report ({liftoffRecord.test_report.items.length} questions)
                </summary>
                <SlateIndependentTestReport
                  items={liftoffRecord.test_report.items}
                  percentage={liftoffRecord.test_report.percentage}
                  legacy={liftoffRecord.test_report.legacy}
                  compact
                />
              </details>}
              {liftoffLive && <small>{liftoffRealtimeStatus === 'subscribed' ? 'Live updates connected.' : 'Connecting live updates...'}</small>}
              {!liftoffLive && <small>This is observed instructional process evidence from Liftoff. It does not by itself establish delayed retention.</small>}
            </> : <p>No Liftoff objectives yet. They will appear here as soon as the learner begins with Mr. Slate.</p>}
          </section>}          {isSlateAssignment && <label className={styles.field}>Review teacher<select value={slateTeacher} disabled={coreBusy === 'slate'} onChange={(event) => void updateScheduledReviewTeacher(event.target.value)}>{REVIEW_TEACHER_SELECTION_IDS.map((id) => <option key={id} value={id}>{REVIEW_TEACHERS[id].icon} {REVIEW_TEACHERS[id].label}</option>)}</select></label>}
          {teacherEditable && <label className={styles.field}>Assigned teacher<select value={assignedTeacher} disabled={teacherBusy || coreBusy === 'teacher'} onChange={(event) => void handleTeacherChange(event.target.value)}><option value="sonoma">Ms. Sonoma</option><option value="webb">Mrs. Webb</option><option value="slate">Mr. Slate</option></select></label>}
          {isConcept && <section className={styles.detailSection}>
            <h3>{generation.label}</h3>
            {actionBlockReason && <p role="status">{actionBlockReason}</p>}
            <p>{generation.blocked ? 'This lesson needs recovery before it can be generated.' : carryLessonKey ? 'This Forecast suggestion keeps the unfinished lesson provisional. Carrying it forward places that same lesson on this date only after you choose to do so.' : item.generation_status === 'generation_failed' ? 'The lesson has not been generated yet. Retry will continue this same dated entry.' : 'This is the same dated lesson from the Syllabus. Generate its content, then review and approve it.'}</p>
            <div className={styles.forecastChoices}>
              {typeof onGenerate === 'function' && <button type="button" className={styles.primary} disabled={generation.blocked || Boolean(coreBusy) || Boolean(actionBlockReason)} onClick={() => onGenerate(item)}>{generation.action}</button>}
              {canChangeIntent && typeof onGenerateWithChanges === 'function' && <button type="button" disabled={!generation.canEdit || Boolean(coreBusy) || Boolean(actionBlockReason)} onClick={() => setForecastChangeOpen((open) => !open)}>Generate with changes</button>}
              {canChangeIntent && typeof onCreateOwnLesson === 'function' && <button type="button" disabled={!generation.canEdit || Boolean(coreBusy) || Boolean(actionBlockReason)} onClick={() => beginConceptEdit('forecast-own')}>Create your own lesson</button>}
            </div>
            {forecastChangeOpen && <div className={styles.forecastChange}>
              <label className={styles.field}>What would you like to change?<textarea autoFocus rows={4} value={forecastChangeRequest} onChange={(event) => setForecastChangeRequest(event.target.value)} placeholder="For example: make it more hands-on, or review cold fronts first." /></label>
              <div className={styles.secondaryActions}><button type="button" disabled={Boolean(coreBusy)} onClick={() => { setForecastChangeOpen(false); setForecastChangeRequest('') }}>Cancel</button><button type="button" className={styles.primary} disabled={!forecastChangeRequest.trim() || Boolean(coreBusy) || !generation.canEdit} onClick={() => void generateForecastWithChanges()}>{coreBusy === 'forecast-change' ? 'Generating...' : 'Generate with changes'}</button></div>
            </div>}
            {!isForecastGhost && <div className={styles.secondaryActions}>{canChangeIntent && typeof onRemoveConcept === 'function' && <button type="button" disabled={Boolean(coreBusy) || !generation.canEdit} onClick={() => void removePlannedConcept()}>Remove lesson</button>}{canChangeIntent && typeof onUseExisting === 'function' && <button type="button" disabled={generation.blocked || Boolean(coreBusy) || Boolean(actionBlockReason)} onClick={() => onUseExisting(item)}>Use existing lesson</button>}</div>}
          </section>}
          {conceptEditMode && <section className={styles.detailSection}>
            <h3>{conceptEditMode === 'forecast-own' ? 'Create your own lesson' : 'Edit planned concept'}</h3>
            <p>{conceptEditMode === 'forecast-own' ? 'Your version becomes educator-authored intent in this exact Syllabus slot before the lesson is generated.' : 'Editing this concept preserves its Syllabus slot and educator ownership.'}</p>
            <div className={styles.forecastChange}>
              <label className={styles.field}>Title<input autoFocus value={conceptTitle} onChange={(event) => setConceptTitle(event.target.value)} /></label>
              <label className={styles.field}>Brief description<textarea rows={4} value={conceptDescription} onChange={(event) => setConceptDescription(event.target.value)} /></label>
              <div className={styles.secondaryActions}><button type="button" disabled={coreBusy === 'concept-edit'} onClick={() => setConceptEditMode('')}>Cancel</button><button type="button" className={styles.primary} disabled={!conceptTitle.trim() || !conceptDescription.trim() || coreBusy === 'concept-edit' || Boolean(actionBlockReason) || !generation.canEdit} onClick={() => void saveConceptEdit()}>{coreBusy === 'concept-edit' ? 'Saving...' : conceptEditMode === 'forecast-own' ? 'Generate my lesson' : 'Save educator intent'}</button></div>
            </div>
          </section>}
          {slateEditorOpen && <section className={styles.detailSection}>
            <h3>Schedule Daily Review</h3>
            <p>Choose who will present this review. The review teacher does not replace the instructional teacher or complete the lesson.</p>
            <label className={styles.field}>Review teacher<select value={slateTeacher} onChange={(event) => setSlateTeacher(normalizeReviewTeacherSelection(event.target.value))}>{REVIEW_TEACHER_SELECTION_IDS.map((id) => <option key={id} value={id}>{REVIEW_TEACHERS[id].icon} {REVIEW_TEACHERS[id].label}</option>)}</select></label>
            <label className={styles.field}>Daily Review date<input type="date" min={[dateOnly(displayedDate), dateOnly(resolvedToday)].filter(Boolean).sort().at(-1) || ''} value={slateDate} onChange={(event) => setSlateDate(event.target.value)} /></label>
            <div className={styles.secondaryActions}><button type="button" onClick={() => setSlateEditorOpen(false)}>Cancel</button><button type="button" disabled={!slateDate || coreBusy === 'slate'} onClick={() => void saveSlateSchedule()}>{coreBusy === 'slate' ? 'Scheduling...' : 'Schedule Daily Review'}</button></div>
          </section>}
          {isLesson && item.lesson_key && isHistorical && !repeatDeliveryActive && <RecordedLessonActivity
            item={item}
            teacherName={instructionalTeacherLabel(displayTeacher)}
            historyAvailable={historyAvailable}
            onOpenHistory={openHistory}
          />}
          {isLesson && item.lesson_key && !isHistorical && selection.historicalActivityAllowed && typeof onRecordHistoricalActivity === 'function' && <HistoricalActivityControl item={item} legacyWebbCompletion={legacyWebbCompletion} busy={historicalActivityBusy} onRecord={onRecordHistoricalActivity} />}
          </>}
        </div>
        <footer>
          {printOpen ? <div className={styles.secondaryActions}><button type="button" disabled={Boolean(printBusy)} onClick={() => { setPrintOpen(false); setPrintError('') }}>Back</button></div> : <>
          <div className={styles.secondaryActions}>
            {historyAvailable && <button type="button" onClick={openHistory}>Review history</button>}
            {canPrintMaterials && <button type="button" onClick={() => { setPrintOpen(true); setPrintError('') }}>Print</button>}
            {schedulingAvailable && <button type="button" disabled={coreBusy === 'schedule'} onClick={openSchedule}>{localExplicitSchedule ? 'Reschedule' : 'Schedule'}</button>}
            {canRegenerateOwnedLesson && <button type="button" onClick={() => setRevisionOpen(true)}>Regenerate with changes</button>}
            {canEditOwnedLesson && <button type="button" onClick={editLesson}>{isDraft ? 'Edit draft' : 'Edit lesson'}</button>}
            {isLesson && item.lesson_key && !isDraft && item.historical_record !== true && (typeof onScheduleSlate === 'function' || canScheduleSlateCore) && <button type="button" disabled={slateBusy || coreBusy === 'slate'} onClick={openSlateScheduler}>Schedule Daily Review</button>}
            {isSlateAssignment && (typeof onRemoveSlateSchedule === 'function' || coreAuthority) && <button type="button" disabled={slateBusy || coreBusy === 'slate'} onClick={() => void removeSlateSchedule()}>Remove scheduled session</button>}
            {canRepeat && <button type="button" onClick={() => void handleRepeat()}>Retry lesson</button>}
            {canRemoveExactOccurrence && <button type="button" disabled={Boolean(removalBusy)} onClick={() => void removeExactSyllabusOccurrence()}>{removalBusy === 'occurrence' ? 'Removing...' : 'Remove this occurrence'}</button>}
            {canRemoveFromLearner && <button type="button" disabled={Boolean(removalBusy)} onClick={() => void removeLessonFromLearner()}>{removalBusy === 'learner' ? 'Removing...' : 'Remove lesson from learner'}</button>}
          </div>
          {isDraft && item.lesson_key && <button type="button" className={styles.primary} onClick={reviewDraft}>Review & approve draft</button>}
          {canDeliver && <button type="button" className={styles.primary} disabled={coreBusy === 'start'} onClick={() => void handleStartNow()}>{coreBusy === 'start' ? 'Starting...' : 'Start now'}</button>}
          </>}
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
