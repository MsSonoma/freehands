'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'
import LessonHistoryOverlay from '@/app/components/syllabus/LessonHistoryOverlay'
import FacilitatorSyllabusLessonOverlay from '@/app/components/syllabus/FacilitatorSyllabusLessonOverlay'
import SyllabusPlanEditor from '@/app/components/syllabus/SyllabusPlanEditor'
import SyllabusDocument from '@/app/components/syllabus/SyllabusDocument'
import SyllabusScheduleDialog from '@/app/components/syllabus/SyllabusScheduleDialog'
import SyllabusDayActionDialog from '@/app/components/syllabus/SyllabusDayActionDialog'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { requestFacilitatorPinException } from '@/app/lib/pinGate'
import { acquirePageScrollLock } from '@/app/lib/scrollLock.mjs'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import { addWeeklyPatternSlot, moveSyllabusWeek, removeWeeklyPatternSlot, startOfSyllabusWeek, syllabusEntitlementsFor, weeklyPatternCapacity } from '@/app/lib/syllabus/timeline.mjs'
import { buildAutomaticForecastAttemptIdentity, buildForecastViewIdentity, isCurrentForecastResponse } from '@/app/lib/syllabus/forecastRequestIdentity.mjs'
import { buildLessonSchedulePayload, buildSchedulableLessonOptions, postLessonScheduleWithCapacityPin } from '@/app/lib/syllabus/syllabusScheduling.mjs'
import { noSchoolReasonMap } from '@/app/lib/syllabus/noSchoolDates.mjs'
import {
  normalizedTeachingGuidance,
  teachingGuidanceOverrideFrom,
  TEACHING_GUIDANCE_FIELDS,
  updateTeachingGuidanceList,
} from '@/app/lib/syllabus/teachingGuidance.mjs'
import { featuresForTier, resolveEffectiveTier } from '@/app/lib/entitlements'
import { CORE_SUBJECTS } from '@/app/lib/subjects'
import { getWebbCompletionForLearner } from '@/app/lib/webbCompletionClient'
import { buildLessonGeneratorReviewHref, buildLessonWorkflowReturnHref } from '@/app/lib/facilitatorLessonWorkflow.mjs'
import styles from './syllabus.module.css'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS = Object.fromEntries(DAYS.map((day) => [day, day[0].toUpperCase() + day.slice(1)]))

function yieldToBrowser() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve()
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setTimeout(resolve, 0))
      return
    }
    setTimeout(resolve, 0)
  })
}

function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function weekLabel(dateString) {
  const date = new Date(`${dateOnly(dateString)}T12:00:00`)
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  return `Week of ${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
}

function groupForecast(items) {
  const groups = new Map()
  for (const item of items || []) {
    const label = weekLabel(item.planned_date)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(item)
  }
  return [...groups.entries()]
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

function activeToDraft(active, items, resolvedToday) {
  const today = dateOnly(resolvedToday || active?.effective_from)
  return {
    effective_from: today,
    goals: structuredClone(active.goals),
    subjects: structuredClone(active.subjects),
    weekly_pattern: structuredClone(active.weekly_pattern),
    teaching_guidance: structuredClone(active.teaching_guidance),
    planning_policy: structuredClone(active.planning_policy),
    legacy_provenance: structuredClone(active.legacy_provenance),
    forecast_items: structuredClone((items || []).filter((item) => dateOnly(item.planned_date) >= today)),
    change_reason: '',
  }
}

function subjectLabel(value) {
  return String(value || '').split(' ').map((word) => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ')
}

function sectionLabel(value) {
  return ({ goals: 'Goals', subjects: 'Subjects', weekly_pattern: 'Weekly Pattern', teaching_guidance: 'Teaching Guidance' })[value]
    || subjectLabel(String(value || '').replaceAll('_', ' '))
}

function guidanceSubjectNames(guidance, subjects = []) {
  const names = new Map()
  for (const item of subjects || []) {
    const name = String(typeof item === 'string' ? item : item?.name || '').trim()
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

function GuidanceListEditor({ field, values, subject, onChange }) {
  return (
    <div className={styles.guidanceField}>
      <strong>{field.label}</strong>
      {values.length === 0 && <span className={styles.muted}>None</span>}
      {values.map((value, index) => (
        <div className={styles.guidanceItem} key={`${field.subjectKey}-${index}`}>
          <input
            aria-label={`${subject ? `${subjectLabel(subject)} ` : ''}${field.label} item ${index + 1}`}
            value={value}
            onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
          />
          <button type="button" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
        </div>
      ))}
      <button type="button" className={styles.guidanceAdd} onClick={() => onChange([...values, ''])}>Add {field.label.toLocaleLowerCase()}</button>
    </div>
  )
}

function GuidanceReadOnly({ guidance }) {
  const globalRows = TEACHING_GUIDANCE_FIELDS.map((field) => ({ field, values: guidanceValues(guidance, field) }))
    .filter(({ values }) => values.length)
  const subjectGroups = guidanceSubjectNames(guidance).map((subject) => ({
    subject,
    rows: TEACHING_GUIDANCE_FIELDS.map((field) => ({ field, values: guidanceValues(guidance, field, subject) }))
      .filter(({ values }) => values.length),
  })).filter(({ rows }) => rows.length)
  if (!globalRows.length && !subjectGroups.length) return <p className={styles.muted}>No curriculum preferences are currently saved.</p>
  return (
    <div className={styles.guidanceReadOnly}>
      {globalRows.length > 0 && <section><h3>All subjects</h3><dl>{globalRows.map(({ field, values }) => <div key={field.globalKey}><dt>{field.label}</dt><dd>{values.join(', ')}</dd></div>)}</dl></section>}
      {subjectGroups.map(({ subject, rows }) => <section key={subject}><h3>{subjectLabel(subject)}</h3><dl>{rows.map(({ field, values }) => <div key={field.subjectKey}><dt>{field.label}</dt><dd>{values.join(', ')}</dd></div>)}</dl></section>)}
    </div>
  )
}

export default function SyllabusPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: 'required' })
  const [learners, setLearners] = useState([])
  const [learnerId, setLearnerId] = useState('')
  const [token, setToken] = useState('')
  const [planTier, setPlanTier] = useState('free')
  const [syllabus, setSyllabus] = useState(null)
  const [learningProposal, setLearningProposal] = useState(null)
  const [learningMessage, setLearningMessage] = useState('')
  const [forecastError, setForecastError] = useState('')
  const [forecastBusy, setForecastBusy] = useState(false)
  const [materializingLineage, setMaterializingLineage] = useState('')
  const [recoveryRequiredLineages, setRecoveryRequiredLineages] = useState(() => new Set())
  const [draft, setDraft] = useState(null)
  const [newSubject, setNewSubject] = useState('')
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [slotSubjects, setSlotSubjects] = useState({})
  const [loading, setLoading] = useState(true)
  const [contentLoading, setContentLoading] = useState(false)
  const [syllabusHydrated, setSyllabusHydrated] = useState(false)
  const [working, setWorking] = useState(false)
  const [teacherAssignmentBusy, setTeacherAssignmentBusy] = useState('')
  const [slateAssignmentBusy, setSlateAssignmentBusy] = useState('')
  const [slateScheduler, setSlateScheduler] = useState(null)
  const [historicalActivityBusy, setHistoricalActivityBusy] = useState('')
  const [legacyWebbCompletions, setLegacyWebbCompletions] = useState({})
  const [error, setError] = useState('')
  const [selectedWeekStart, setSelectedWeekStart] = useState('')
  const [returnFocus, setReturnFocus] = useState({ plannedDate: '', lessonKey: '', occurrenceId: '' })
  const [editingSection, setEditingSection] = useState('')
  const [conceptEditor, setConceptEditor] = useState(null)
  const [replacingLineage, setReplacingLineage] = useState('')
  const [historyOccurrenceId, setHistoryOccurrenceId] = useState('')
  const [selectedSyllabusLesson, setSelectedSyllabusLesson] = useState(null)
  const [scheduleDialog, setScheduleDialog] = useState(null)
  const [scheduleLessons, setScheduleLessons] = useState([])
  const [scheduleCatalogLoading, setScheduleCatalogLoading] = useState(false)
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [dayActionDate, setDayActionDate] = useState('')
  const [dayActionError, setDayActionError] = useState('')
  const [forecastRefreshSequence, setForecastRefreshSequence] = useState(0)
  const forecastAttempt = useRef('')
  const forecastRequestSequence = useRef(0)
  const forecastViewIdentity = useRef('')
  const loadSequence = useRef(0)
  const planningRequest = useRef('')
  const pageIdentity = useRef('')
  const currentPageIdentity = `${learnerId}:${syllabus?.active_revision?.id || ''}`
  pageIdentity.current = currentPageIdentity
  const currentTargetForecastWeek = syllabus?.resolved_today ? moveSyllabusWeek(null, 'later', syllabus.resolved_today) : ''
  forecastViewIdentity.current = buildForecastViewIdentity({
    learnerId,
    activeRevisionId: syllabus?.active_revision?.id,
    targetWeek: currentTargetForecastWeek,
  })
  const planningAccess = syllabusEntitlementsFor({ role: 'facilitator', planTier })
  const canScheduleLessons = featuresForTier(planTier).lessonScheduling === true
  const noSchoolByDate = useMemo(() => noSchoolReasonMap(syllabus?.no_school_dates || []), [syllabus?.no_school_dates])
  const inlineModalOpen = Boolean(conceptEditor || slateScheduler)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const [{ data: { session } }, items] = await Promise.all([supabase.auth.getSession(), listLearners()])
        if (cancelled) return
        const safeItems = Array.isArray(items) ? items.filter((item) => /^[0-9a-f-]{36}$/i.test(String(item.id))) : []
        const remembered = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : ''
        const returnParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
        const requestedLearner = returnParams.get('learnerId') || ''
        const returnDate = returnParams.get('date') || ''
        const preferredLearner = safeItems.some((item) => String(item.id) === String(requestedLearner)) ? requestedLearner : remembered
        if (returnDate) setSelectedWeekStart(startOfSyllabusWeek(returnDate))
        setReturnFocus({ plannedDate: returnDate, lessonKey: returnParams.get('lessonKey') || '', occurrenceId: returnParams.get('occurrenceId') || '' })
        setToken(session?.access_token || '')
        setLearners(safeItems)
        setLearnerId(safeItems.some((item) => String(item.id) === String(preferredLearner)) ? preferredLearner : (safeItems[0]?.id || ''))
        if (session?.user) {
          const { data: profile } = await supabase.from('profiles').select('plan_tier,subscription_tier').eq('id', session.user.id).maybeSingle()
          if (!cancelled) setPlanTier(resolveEffectiveTier(profile?.subscription_tier, profile?.plan_tier))
        }
      } catch (cause) {
        if (!cancelled) setError(cause.message || 'Could not load learners')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated])

  async function loadCurrent(id = learnerId) {
    if (!id || !token) return
    const sequence = ++loadSequence.current
    const requestIsCurrent = () => sequence === loadSequence.current && pageIdentity.current.startsWith(`${id}:`)
    const preserveVisibleContent = Boolean(syllabus && pageIdentity.current.startsWith(`${id}:`))
    setLoading(!preserveVisibleContent)
    setContentLoading(true)
    setSyllabusHydrated(false)
    setError('')
    try {
      const shellResponse = await fetch(`/api/syllabus?learnerId=${encodeURIComponent(id)}&view=shell`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const shell = await shellResponse.json()
      if (!shellResponse.ok) throw new Error(shell.error || 'Could not load Syllabus')
      if (!requestIsCurrent()) return

      forecastRequestSequence.current++
      setForecastBusy(false)
      setLegacyWebbCompletions(getWebbCompletionForLearner(id))
      setLearningMessage('')
      setDraft(null)
      setNewSubject('')
      setAvailableSubjects([])
      setSyllabus((current) => {
        const sameRevision = current?.active_revision?.id && current.active_revision.id === shell.active_revision?.id
        if (!sameRevision || !Array.isArray(current.timeline_items)) return shell
        return {
          ...shell,
          forecast_items: current.forecast_items || [],
          timeline_items: current.timeline_items,
          proposed_learning_forecast: current.proposed_learning_forecast || null,
        }
      })
      setLoading(false)

      if (!shell.has_active_syllabus) {
        setLearningProposal(null)
        setSyllabusHydrated(true)
        return
      }

      await yieldToBrowser()
      if (!requestIsCurrent()) return

      const response = await fetch(`/api/syllabus?learnerId=${encodeURIComponent(id)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not load Syllabus contents')
      if (!requestIsCurrent()) return

      setSyllabus(json)
      setLearningProposal(json.proposed_learning_forecast ? {
        proposal_revision: json.proposed_learning_forecast.revision,
        forecast_items: json.proposed_learning_forecast.forecast_items,
      } : null)
      setForecastRefreshSequence((current) => current + 1)
      setSyllabusHydrated(true)
    } catch (cause) {
      if (sequence === loadSequence.current) setError(cause.message)
    } finally {
      if (sequence === loadSequence.current) {
        setLoading(false)
        setContentLoading(false)
      }
    }
  }

  useEffect(() => { if (learnerId && token) loadCurrent(learnerId) }, [learnerId, token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!syllabusHydrated) return undefined
    const activeId = syllabus?.active_revision?.id
    if (!activeId || !currentTargetForecastWeek || !planningAccess.can_change_intent) return undefined
    const identity = buildAutomaticForecastAttemptIdentity({
      requestIdentity: forecastViewIdentity.current,
      refreshSequence: forecastRefreshSequence,
    })
    if (!identity || forecastAttempt.current === identity) return undefined
    let cancelled = false
    ;(async () => {
      await yieldToBrowser()
      if (cancelled || forecastAttempt.current === identity) return
      forecastAttempt.current = identity
      void createLearningForecast({ automatic: true })
    })()
    return () => { cancelled = true }
  }, [forecastRefreshSequence, syllabus?.active_revision?.id, syllabus?.resolved_today, learnerId, planningAccess.can_change_intent, syllabusHydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!inlineModalOpen) return undefined
    return acquirePageScrollLock()
  }, [inlineModalOpen])

  useEffect(() => {
    if (!inlineModalOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (slateScheduler) setSlateScheduler(null)
      else if (conceptEditor) setConceptEditor(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [conceptEditor, inlineModalOpen, slateScheduler])

  async function buildSeed() {
    setWorking(true)
    setError('')
    try {
      const response = await fetch(`/api/syllabus/seed?learnerId=${encodeURIComponent(learnerId)}`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not build draft')
      const { available_subjects = [], learner, ...snapshot } = json.seed
      setAvailableSubjects(available_subjects)
      setDraft(snapshot)
      setNewSubject('')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setWorking(false)
    }
  }

  async function activate() {
    setWorking(true)
    setError('')
    try {
      const normalizedGuidance = normalizedTeachingGuidance(draft?.teaching_guidance)
      const activationBody = planningAccess.can_change_intent
          ? { learnerId, expectedActiveRevisionId: syllabus?.active_revision?.id, snapshot: { ...draft, teaching_guidance: normalizedGuidance } }
          : {
              learnerId,
              establishFromCurrentPlan: true,
              teachingGuidanceOverride: teachingGuidanceOverrideFrom(normalizedGuidance),
            }
      const postActivation = (exceptionPin) => fetch('/api/syllabus/activate', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...activationBody, ...(exceptionPin ? { exceptionPin } : {}) }),
      })
      let response = await postActivation()
      let json = await response.json()
      if (response.status === 409 && json?.code === 'SYLLABUS_CAPACITY_PIN_REQUIRED') {
        const pin = await requestFacilitatorPinException({ message: json.error })
        if (!pin) throw new Error('The placement exception was not approved.')
        response = await postActivation(pin)
        json = await response.json()
      }
      if (!response.ok) throw new Error(json.error || 'Could not activate Syllabus')
      await loadCurrent()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setWorking(false)
    }
  }

  async function createLearningForecast({ automatic = false } = {}) {
    const requestIdentity = forecastViewIdentity.current
    const requestSequence = ++forecastRequestSequence.current
    const responseIsCurrent = () => isCurrentForecastResponse({
      requestIdentity,
      currentIdentity: forecastViewIdentity.current,
      requestSequence,
      currentSequence: forecastRequestSequence.current,
    })
    setForecastBusy(true)
    setForecastError('')
    setLearningMessage('')
    try {
      const response = await fetch('/api/syllabus/forecast', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, expectedActiveRevisionId: syllabus.active_revision.id }),
      })
      const json = await response.json()
      if (!responseIsCurrent()) return
      if (!response.ok) throw new Error(json.error || 'Could not prepare the forecast')
      if (json.kind === 'no_action') {
        setLearningMessage(json.message)
        return
      }
      setLearningProposal(json)
      setLearningMessage(json.reused
        ? 'The current forecast already reflects the authoritative Syllabus and evidence inputs.'
        : 'A one-week forecast is ready for review. The active Syllabus has not changed.')
    } catch (cause) {
      if (!responseIsCurrent()) return
      setForecastError(cause.message)
      if (!automatic) forecastAttempt.current = ''
    } finally {
      if (responseIsCurrent()) setForecastBusy(false)
    }
  }

  function openSectionEditor(section) {
    setEditingSection(section)
  }

  async function planningPost(action, payload = {}) {
    const requestIdentity = pageIdentity.current
    const requestLearnerId = learnerId
    const requestKey = `${requestIdentity}:${action}`
    if (planningRequest.current) return null
    planningRequest.current = requestKey
    setWorking(true)
    setError('')
    try {
      const response = await fetch('/api/syllabus/planning', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ learnerId, expectedActiveRevisionId: syllabus.active_revision.id, action, ...payload }) })
      const json = await response.json()
      if (!pageIdentity.current.startsWith(`${requestLearnerId}:`)) return null
      if (!response.ok) throw new Error(json.error || 'Could not update Syllabus planning')
      if (action === 'replace_forecast') {
        setLearningProposal(json)
        return json
      }
      if (action === 'suggest') return json.suggestions?.[0] || null
      await loadCurrent()
      return json
    } catch (cause) {
      if (pageIdentity.current.startsWith(`${requestLearnerId}:`)) setError(cause.message)
      return null
    } finally {
      if (planningRequest.current === requestKey) planningRequest.current = ''
      if (pageIdentity.current.startsWith(`${requestLearnerId}:`)) setWorking(false)
    }
  }

  function planFutureSlot(slot) {
    if (!planningAccess.can_change_intent || !slot) return
    setConceptEditor({ source: 'slot', slot, title: '', description: '' })
  }

  async function suggestFutureSlot(slot) {
    if (!planningAccess.can_change_intent || !slot) return
    const suggestion = await planningPost('suggest', { slots: [{ planned_date: slot.planned_date, sort_order: slot.sort_order }] })
    if (!suggestion) return
    setConceptEditor({ source: 'slot', slot, title: suggestion.title || '', description: suggestion.description || '' })
  }
  async function saveConceptEditor() {
    if (!conceptEditor?.slot) return
    const result = await planningPost('create', {
      plannedDate: conceptEditor.slot.planned_date,
      sortOrder: conceptEditor.slot.sort_order,
      title: conceptEditor.title,
      description: conceptEditor.description,
    })
    if (result) setConceptEditor(null)
  }

  async function editPlannedConcept(item, values) {
    if (!item?.lineage_id || !values?.title?.trim() || !values?.description?.trim()) return false
    const result = await planningPost('edit', {
      lineageId: item.lineage_id,
      title: values.title,
      description: values.description,
    })
    return Boolean(result)
  }

  async function createOwnForecastLesson(item, values) {
    const proposalRevisionId = learningProposal?.proposal_revision?.id
    if (!item?.lineage_id || !proposalRevisionId || !values?.title?.trim() || !values?.description?.trim()) return false
    const result = await planningPost('edit_forecast', {
      proposalRevisionId,
      lineageId: item.lineage_id,
      title: values.title,
      description: values.description,
    })
    const edited = result?.forecast_items?.find((candidate) => String(candidate.lineage_id) === String(item.lineage_id))
    if (!result?.active_revision?.id || !edited) return false
    return materializeForecast(edited, { expectedActiveRevisionId: result.active_revision.id })
  }
  async function generateForecastWithChanges(item, changeRequest) {
    if (!item?.lineage_id || replacingLineage || !learningProposal?.proposal_revision?.id) return false
    setReplacingLineage(item.lineage_id)
    try {
      const replacement = await planningPost('replace_forecast', { proposalRevisionId: learningProposal.proposal_revision.id, lineageId: item.lineage_id, changeRequest })
      const revised = replacement?.forecast_items?.find((candidate) => String(candidate.lineage_id) === String(item.lineage_id))
      if (!replacement?.proposal_revision?.id || !revised) return false
      return await materializeForecast(revised, {
        proposal: { proposal_revision: replacement.proposal_revision, forecast_items: replacement.forecast_items || [] },
        expectedActiveRevisionId: replacement.active_revision_id || syllabus.active_revision.id,
      })
    } finally {
      setReplacingLineage('')
    }
  }

  async function materializeForecast(item, { proposal = null, existingLessonKey = '', expectedActiveRevisionId = syllabus?.active_revision?.id } = {}) {
    const lineageId = item?.lineage_id
    if (!lineageId || recoveryRequiredLineages.has(lineageId)) return
    setMaterializingLineage(lineageId)
    setError('')
    try {
      const response = await fetch('/api/syllabus/materialize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          lineageId,
          expectedActiveRevisionId,
          ...(proposal ? { proposalRevisionId: proposal.proposal_revision.id } : {}),
          ...(existingLessonKey ? { existingLessonKey } : {}),
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        if (json?.code === 'MATERIALIZATION_RECOVERY_REQUIRED') {
          setRecoveryRequiredLineages((current) => new Set(current).add(lineageId))
        }
        throw new Error(json.error || (existingLessonKey ? 'Could not bind this lesson to the forecast concept' : 'Could not generate this forecast lesson'))
      }
      await loadCurrent()
      return true
    } catch (cause) {
      setError(cause.message)
      return false
    } finally {
      setMaterializingLineage('')
    }
  }

  const selectedLearner = learners.find((item) => String(item.id) === String(learnerId))
  const establishingFirstSyllabus = !syllabus?.has_active_syllabus
  const editingActiveSyllabus = Boolean(draft && syllabus?.has_active_syllabus)
  const canActivateDraft = establishingFirstSyllabus ? planningAccess.can_establish_syllabus : planningAccess.can_change_intent
  const displayRevision = editingActiveSyllabus ? syllabus?.active_revision : (draft || syllabus?.active_revision)
  const displayForecast = useMemo(() => editingActiveSyllabus ? (syllabus?.timeline_items || syllabus?.forecast_items || []) : (draft?.forecast_items || syllabus?.timeline_items || syllabus?.forecast_items || []), [editingActiveSyllabus, draft?.forecast_items, syllabus?.timeline_items, syllabus?.forecast_items])
  const forecastGroups = useMemo(() => groupForecast(displayForecast), [displayForecast])
  const guidanceSubjects = guidanceSubjectNames(displayRevision?.teaching_guidance, displayRevision?.subjects)
  const referencedSubjects = useMemo(() => referencedSubjectKeys(draft?.weekly_pattern, draft?.forecast_items), [draft?.weekly_pattern, draft?.forecast_items])

  function addDraftSubject() {
    const name = newSubject.trim()
    if (!name || !draft) return
    const exists = draft.subjects.some((subject) => subject.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    if (!exists) setDraft({ ...draft, subjects: [...draft.subjects, { name, source: 'facilitator' }] })
    setNewSubject('')
  }

  function removeDraftSubject(name) {
    if (!draft || referencedSubjects.has(name.toLocaleLowerCase())) return
    setDraft({ ...draft, subjects: draft.subjects.filter((subject) => subject.name.toLocaleLowerCase() !== name.toLocaleLowerCase()) })
  }

  function updateDraftGuidance(field, values, subject = null) {
    setDraft((current) => current ? {
      ...current,
      teaching_guidance: updateTeachingGuidanceList(current.teaching_guidance, { field, subject, values }),
    } : current)
  }

  function beginPatternSlot(day) {
    setSlotSubjects((current) => ({ ...current, [day]: '' }))
  }

  function cancelPatternSlot(day) {
    setSlotSubjects((current) => {
      const next = { ...current }
      delete next[day]
      return next
    })
  }

  function addPatternSlot(day) {
    const subject = String(slotSubjects[day] || '').trim()
    if (!draft || !subject) return
    setDraft({ ...draft, weekly_pattern: addWeeklyPatternSlot(draft.weekly_pattern, day, subject) })
    cancelPatternSlot(day)
  }

  function removePatternSlot(day, index) {
    if (!draft) return
    setDraft({ ...draft, weekly_pattern: removeWeeklyPatternSlot(draft.weekly_pattern, day, index) })
  }

  function openDayAction(date) {
    setDayActionError('')
    setDayActionDate(dateOnly(date))
  }

  async function setNoSchoolDate({ date, reason }) {
    if (!learnerId || !token || !date) return
    setWorking(true)
    setDayActionError('')
    try {
      const response = await fetch('/api/no-school-dates', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ learnerId, date, reason }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not mark this day off')
      setDayActionDate('')
      forecastAttempt.current = ''
      await loadCurrent(learnerId)
    } catch (cause) {
      setDayActionError(cause.message || 'Could not mark this day off')
    } finally { setWorking(false) }
  }

  async function clearNoSchoolDate({ date }) {
    if (!learnerId || !token || !date) return
    setWorking(true)
    setDayActionError('')
    try {
      const response = await fetch(`/api/no-school-dates?learnerId=${encodeURIComponent(learnerId)}&date=${encodeURIComponent(date)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not remove the day-off mark')
      setDayActionDate('')
      forecastAttempt.current = ''
      await loadCurrent(learnerId)
    } catch (cause) {
      setDayActionError(cause.message || 'Could not remove the day-off mark')
    } finally { setWorking(false) }
  }

  function createGeneratedDayLesson({ date }) {
    if (!planningAccess.can_change_intent || !learnerId || !syllabus?.active_revision?.id || !date) return
    setDayActionDate('')
    setDayActionError('')
    const params = new URLSearchParams({
      mode: 'simple',
      source: 'syllabus',
      learnerId,
      plannedDate: date,
      expectedActiveRevisionId: syllabus.active_revision.id,
    })
    router.push(`/facilitator/generator?${params.toString()}`)
  }

  async function openLessonPicker(scheduledDate, { mode = 'add', item = null, proposal = null } = {}) {
    if (mode === 'add' ? !canScheduleLessons : !planningAccess.can_change_intent) return
    setScheduleDialog({ mode, item, proposal, scheduledDate: dateOnly(scheduledDate) })
    setScheduleCatalogLoading(true)
    setScheduleError('')
    try {
      const [publicResults, ownedResponse] = await Promise.all([
        Promise.all(CORE_SUBJECTS.map(async (subject) => {
          const response = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { cache: 'no-store' })
          return [subject, response.ok ? await response.json() : []]
        })),
        fetch('/api/facilitator/lessons/list', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }),
      ])
      const publicLessonsBySubject = Object.fromEntries(publicResults.map(([subject, lessons]) => [subject, Array.isArray(lessons) ? lessons : []]))
      const facilitatorLessons = ownedResponse.ok ? await ownedResponse.json() : []
      setScheduleLessons(buildSchedulableLessonOptions({ publicLessonsBySubject, facilitatorLessons }))
    } catch (cause) {
      setScheduleLessons([])
      setScheduleError(cause.message || 'Could not load ready lessons')
    } finally {
      setScheduleCatalogLoading(false)
    }
  }

  async function saveLessonSchedule({ lessonKey, scheduledDate, scheduleId = '', forecastLineageId = '' }) {
    if (!canScheduleLessons || !learnerId || !lessonKey || !dateOnly(scheduledDate)) return
    const requestLearnerId = learnerId
    const basePayload = buildLessonSchedulePayload({ learnerId: requestLearnerId, lessonKey, scheduledDate, scheduleId, forecastLineageId })
    setScheduleBusy(true)
    setScheduleError('')
    try {
      const { response, json } = await postLessonScheduleWithCapacityPin({
        payload: basePayload,
        postSchedule: (payload) => fetch('/api/lesson-schedule', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        requestPin: (message) => requestFacilitatorPinException({ message }),
      })
      if (!response.ok) throw new Error(json.error || 'Could not schedule the lesson')
      setScheduleDialog(null)
      await loadCurrent(requestLearnerId)
    } catch (cause) {
      setScheduleError(cause.message || 'Could not schedule the lesson')
    } finally {
      setScheduleBusy(false)
    }
  }

  async function handleLessonAction(item, action) {
    if (['schedule', 'reschedule'].includes(action?.id)) {
      const moving = action.id === 'reschedule'
      const scheduledDate = dateOnly(item?.original_scheduled_date || item?.planned_date)
      const scheduleId = moving ? String(item?.id || '').trim() : ''
      const eligible = canScheduleLessons
        && item?.lesson_key
        && scheduledDate >= dateOnly(syllabus?.resolved_today)
        && (!moving || (item?.is_explicit_schedule === true && item?.placement_kind === 'scheduled' && scheduleId))
      if (!eligible) return
      setScheduleError('')
      setScheduleDialog({ mode: action.id, item, scheduledDate, scheduleId })
      return
    }
    if (action?.id === 'schedule_slate') {
      setError('')
      setSlateScheduler({ item, learnerId, resolvedToday: syllabus?.resolved_today, scheduledDate: '' })
      return
    }
    if (action?.id === 'remove_slate_schedule') {
      const occurrenceKey = item?.source_occurrence_id || item?.occurrence_id || item?.id || ''
      setSlateAssignmentBusy(occurrenceKey)
      setError('')
      try {
        const response = await fetch('/api/syllabus/slate-assignments', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ learnerId, assignmentId: item.assignment_id }),
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Could not remove the scheduled Mr. Slate session')
        await loadCurrent()
      } catch (cause) {
        setError(cause.message)
      } finally {
        setSlateAssignmentBusy('')
      }
      return
    }
    if (action?.id === 'materialize' && item?.lineage_id) {
      await materializeForecast(item)
      return
    }
    if (action?.id === 'use_existing' && item?.lineage_id && !recoveryRequiredLineages.has(item.lineage_id)) {
      await openLessonPicker(item.planned_date, { mode: 'bind', item })
      return
    }

    return
  }

  async function scheduleSlateSession() {
    const item = slateScheduler?.item
    const scheduledLearnerId = slateScheduler?.learnerId
    const scheduledDate = dateOnly(slateScheduler?.scheduledDate)
    const occurrenceKey = item?.source_occurrence_id || item?.occurrence_id || item?.id || ''
    if (!scheduledLearnerId || !item?.lesson_key || !occurrenceKey || !scheduledDate) return
    setSlateAssignmentBusy(occurrenceKey)
    setError('')
    try {
      const response = await fetch('/api/syllabus/slate-assignments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId: scheduledLearnerId,
          lessonKey: item.lesson_key,
          occurrenceId: occurrenceKey,
          scheduledDate,
          runPurpose: 'practice',
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not schedule the Mr. Slate session')
      setSlateScheduler(null)
      await loadCurrent()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setSlateAssignmentBusy('')
    }
  }

  async function handleTeacherAssignment(item, instructionalTeacher) {
    const occurrenceKey = item?.occurrence_id || item?.id || ''
    if (!occurrenceKey || !item?.lesson_key) return
    setTeacherAssignmentBusy(occurrenceKey)
    setError('')
    try {
      const response = await fetch('/api/syllabus/lesson-associations', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          lessonKey: item.lesson_key,
          occurrenceId: occurrenceKey,
          instructionalTeacher,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not assign the instructional teacher')
      await loadCurrent()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setTeacherAssignmentBusy('')
    }
  }

  async function handleRecordHistoricalActivity(item, activity) {
    const occurrenceKey = item?.source_occurrence_id || item?.occurrence_id || item?.id || ''
    if (!occurrenceKey || !item?.lesson_key) return
    setHistoricalActivityBusy(occurrenceKey)
    setError('')
    try {
      const response = await fetch('/api/syllabus/historical-activities', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          lessonKey: item.lesson_key,
          occurrenceId: occurrenceKey,
          ...activity,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not record historical activity')
      await loadCurrent()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setHistoricalActivityBusy('')
    }
  }

  function switchLearner(nextLearnerId) {
    loadSequence.current++
    forecastAttempt.current = ''
    planningRequest.current = ''
    setLearnerId(nextLearnerId)
    setSyllabus(null)
    setLearningProposal(null)
    setLoading(true)
    setContentLoading(false)
    setSyllabusHydrated(false)
    setForecastBusy(false)
    setSelectedWeekStart('')
    setReturnFocus({ plannedDate: '', lessonKey: '', occurrenceId: '' })
    setEditingSection('')
    setConceptEditor(null)
    setHistoryOccurrenceId('')
    setSelectedSyllabusLesson(null)
    setScheduleDialog(null)
    setScheduleError('')
    setRecoveryRequiredLineages(new Set())
    setError('')
    setForecastError('')
    localStorage.setItem('learner_id', nextLearnerId)
  }

  function openFacilitatorLessonWorkflow(item) {
    if (!item?.lesson_key) return
    router.push(buildLessonGeneratorReviewHref({
      learnerId,
      lessonKey: item.lesson_key,
      source: 'syllabus',
      plannedDate: dateOnly(item.planned_date),
      occurrenceId: String(item.occurrence_id || '').trim(),
      expectedActiveRevisionId: String(syllabus?.active_revision?.id || '').trim(),
    }))
  }

  function openReviewHistory(item) {
    const occurrenceId = String(item?.occurrence_id || '').trim()
    if (!occurrenceId || (!occurrenceId.startsWith('actual:') && !occurrenceId.startsWith('historical:'))) return
    setEditingSection('')
    setDraft(null)
    setConceptEditor(null)
    setSelectedSyllabusLesson(null)
    setHistoryOccurrenceId(occurrenceId)
  }

  if (authLoading) return <main className={styles.page}><p>Loading…</p></main>
  if (!isAuthenticated) return <main className={styles.page}><GatedOverlay show gateType={gateType || 'auth'} feature="Syllabus" emoji="🧭" description="Sign in to view and activate a learner's educational plan." /></main>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        {!syllabus?.has_active_syllabus && <div>
          <p className={styles.eyebrow}>Facilitator planning</p>
          <h1>Syllabus</h1>
          <p>Create this learner&apos;s weekly learning plan.</p>
        </div>}
        <label className={styles.learnerPicker}>Learner
          <select value={learnerId} onChange={(event) => switchLearner(event.target.value)}>
            {learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name}</option>)}
          </select>
        </label>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {!planningAccess.can_change_intent && <p className={styles.statusMessage}>{establishingFirstSyllabus ? 'Every plan can establish an initial Syllabus through explicit facilitator activation. Future replanning remains locked.' : 'The complete Syllabus remains visible. Future replanning is locked for this plan.'}</p>}
      {!loading && learners.length === 0 && <section className={styles.empty}><h2>No learners yet</h2><p>Add a learner before building a Syllabus.</p></section>}
      {loading && <p className={styles.muted}>Loading {selectedLearner?.name || 'learner'}&apos;s Syllabus…</p>}
      {learnerId && !displayRevision && (loading || contentLoading) && <SyllabusDocument
        revision={null}
        forecastItems={[]}
        timelineItems={[]}
        role="facilitator"
        learnerId={learnerId}
        learnerName={selectedLearner?.name || ''}
        contentLoading
      />}

      {!loading && learnerId && !syllabus?.has_active_syllabus && !draft && (
        <section className={styles.empty}>
          <h2>This learner does not have an active Syllabus yet.</h2>
          <p>Build a proposal from the current weekly pattern, planning guidance, goals notes, and future planned lessons. Nothing is changed until you activate it.</p>
          <button className={styles.primaryButton} onClick={buildSeed} disabled={working}>{working ? 'Building…' : 'Build from current plan'}</button>
        </section>
      )}

      {!loading && displayRevision && (
        <>
          {draft && <section className={styles.statusBar}>
            <div><strong>{draft && !editingActiveSyllabus ? 'Proposal' : 'Current active Syllabus'}</strong><span>{draft && !editingActiveSyllabus ? 'Not active yet' : `Revision ${displayRevision.revision_number}`}</span></div>
            <div><strong>Effective</strong><span>{dateOnly(displayRevision.effective_from)}</span></div>
          </section>}

          {draft && !editingActiveSyllabus && <section className={styles.proposalBanner}><div><strong>Syllabus proposal</strong><p>Review the complete plan. Activation creates a new immutable revision effective today.</p></div><div className={styles.effectiveDate}><strong>Effective today</strong><span>{dateOnly(draft.effective_from)}</span></div></section>}

          {draft && !editingActiveSyllabus ? <div className={styles.contentGrid}>
            <div className={styles.sideColumn}>
              <section className={styles.section}>
                <h2>Goals</h2>
                <p className={styles.sectionIntro}>Current learner goals notes, preserved as legacy seed material.</p>
                {draft && planningAccess.can_change_intent ? <textarea rows={6} value={draft.goals?.legacy_notes || ''} onChange={(event) => setDraft({ ...draft, goals: { ...draft.goals, legacy_notes: event.target.value } })} placeholder="Goals and notes for this learner" /> : <p className={styles.prewrap}>{displayRevision.goals?.legacy_notes || 'No goals notes yet.'}</p>}
              </section>

              <section className={styles.section}>
                <h2>Subjects</h2>
                {draft && planningAccess.can_change_intent ? <><ul className={styles.subjectEditor}>{draft.subjects.map((subject) => {
                  const referenced = referencedSubjects.has(subject.name.toLocaleLowerCase())
                  return <li key={subject.name}><span>{subject.name}{referenced && <small>Used in this plan</small>}</span><button type="button" disabled={referenced} title={referenced ? 'Remove this subject from the weekly pattern and prepared future lessons first.' : `Remove ${subject.name}`} onClick={() => removeDraftSubject(subject.name)}>Remove</button></li>
                })}</ul><div className={styles.addSubject}><input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addDraftSubject() } }} aria-label="New subject name" placeholder="Add a subject" /><button type="button" className={styles.secondaryButton} onClick={addDraftSubject}>Add</button></div><p className={styles.hint}>Subjects used by the weekly pattern or prepared future lessons cannot be removed here. Available catalog: {availableSubjects.map((item) => item.name).join(', ') || 'none'}</p></> : <ul className={styles.simpleList}>{(displayRevision.subjects || []).map((item) => <li key={item.name}>{item.name}</li>)}</ul>}
              </section>

              <section className={styles.section}>
                <h2>Weekly Pattern</h2>
                <p className={styles.sectionIntro}>The weekly pattern is the recurring schedule. Days can be empty. Add multiple lessons only when that is the pattern you want every week.</p>
                <div className={styles.weekPattern}>{DAYS.map((day) => {
                  const subjects = displayRevision.weekly_pattern?.[day] || []
                  const capacity = weeklyPatternCapacity(displayRevision.weekly_pattern, day)
                  return <div key={day} className={styles.patternDay}><strong>{DAY_LABELS[day]} <small>{capacity} automatic lesson slot{capacity === 1 ? '' : 's'}</small></strong>
                    {draft && planningAccess.can_change_intent ? <>
                      {subjects.length === 0 && <span className={styles.patternEmpty}>No lessons</span>}
                      <ul>{subjects.map((item, index) => <li key={`${day}-${index}`}><span>{typeof item === 'string' ? item : item.subject}</span><button type="button" onClick={() => removePatternSlot(day, index)}>Remove</button></li>)}</ul>
                      {Object.prototype.hasOwnProperty.call(slotSubjects, day) ? <div className={styles.patternAdd}><select autoFocus aria-label={`Subject slot for ${DAY_LABELS[day]}`} value={slotSubjects[day]} onChange={(event) => setSlotSubjects({ ...slotSubjects, [day]: event.target.value })}><option value="">Choose subject</option>{(draft.subjects || []).map((subject) => <option key={subject.name} value={subject.name}>{subject.name}</option>)}</select><button type="button" disabled={!slotSubjects[day]} onClick={() => addPatternSlot(day)}>Add</button><button type="button" onClick={() => cancelPatternSlot(day)}>Cancel</button></div> : <button type="button" disabled={(draft.subjects || []).length === 0} onClick={() => beginPatternSlot(day)}>{subjects.length ? 'Add another lesson' : 'Add lesson'}</button>}
                    </> : <span>{subjects.map((item) => typeof item === 'string' ? item : item.subject).join(', ') || 'No lessons'}</span>}
                  </div>
                })}</div>
              </section>

              <details className={styles.guidance} open>
                <summary>Teaching Guidance</summary>
                <p className={styles.sectionIntro}>Facilitator-facing curriculum and source guidance, kept separate from learner goals.</p>
                {draft ? <div className={styles.guidanceEditor}>
                  <section><h3>All subjects</h3>{TEACHING_GUIDANCE_FIELDS.map((field) => <GuidanceListEditor key={field.globalKey} field={field} values={guidanceValues(draft.teaching_guidance, field)} onChange={(values) => updateDraftGuidance(field, values)} />)}</section>
                  {guidanceSubjects.map((subject) => <section key={subject}><h3>{subjectLabel(subject)}</h3>{TEACHING_GUIDANCE_FIELDS.map((field) => <GuidanceListEditor key={field.subjectKey} field={field} subject={subject} values={guidanceValues(draft.teaching_guidance, field, subject)} onChange={(values) => updateDraftGuidance(field, values, subject)} />)}</section>)}
                </div> : <GuidanceReadOnly guidance={displayRevision.teaching_guidance} />}
              </details>
            </div>

            <section className={`${styles.section} ${styles.forecast}`}>
              <div className={styles.forecastHeader}><div><p className={styles.eyebrow}>{draft ? 'Future direction' : 'Educational record and future plan'}</p><h2>{draft ? 'Future plan' : 'Lesson timeline'}</h2></div><span>{displayForecast.length} item{displayForecast.length === 1 ? '' : 's'}</span></div>
              {forecastGroups.length ? forecastGroups.map(([label, items]) => <div className={styles.forecastWeek} key={label}><h3>{label}</h3><ul>{items.map((item) => <li key={item.id || `${item.lineage_id}-${item.planned_date}`}><span className={styles.forecastDate}>{new Date(`${dateOnly(item.planned_date)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><div><strong>{item.subject}:</strong> {item.title}{item.description && <p>{item.description}</p>}{!draft && item.placement_kind === 'inferred' && <em> Provisional weekly-pattern placement</em>}{!draft && item.placement_kind === 'scheduled' && <em> Explicit calendar date</em>}{!draft && item.lesson_key && ['draft', 'approved', 'saved'].includes(item.readiness_state) && <><br /><a href={item.readiness_state === 'draft' ? buildLessonGeneratorReviewHref({ learnerId, lessonKey: item.lesson_key, source: 'syllabus', plannedDate: item.planned_date, occurrenceId: item.occurrence_id || '', expectedActiveRevisionId: syllabus?.active_revision?.id || '' }) : buildLessonWorkflowReturnHref({ source: 'syllabus', learnerId })}>{item.readiness_state === 'draft' ? 'Review draft' : 'Open in Syllabus'}</a></>}</div></li>)}</ul></div>) : <p className={styles.muted}>No learner-specific lessons are recorded yet.</p>}
            </section>
          </div> : <SyllabusDocument
              revision={syllabus.active_revision}
              forecastItems={syllabus.forecast_items}
              timelineItems={syllabus.timeline_items}
              role="facilitator"
              learnerId={learnerId}
              planTier={planTier}
              learnerName={selectedLearner?.name || ''}
              onSelectLesson={(item, context) => setSelectedSyllabusLesson({ item, ...context })}
              canScheduleLessons={canScheduleLessons && syllabusHydrated}
              noSchoolDates={syllabus.no_school_dates || []}
              onDayAction={syllabusHydrated ? openDayAction : null}
              onEditSection={planningAccess.can_change_intent && syllabusHydrated ? openSectionEditor : null}
              proposedForecastItems={learningProposal?.forecast_items || []}
              proposedForecastTargetWeek={currentTargetForecastWeek}
              forecastBusy={forecastBusy}
              forecastError={forecastError}
              forecastMessage={learningMessage}
              materializingForecastLineage={materializingLineage}
              isForecastRecoveryRequired={(item) => recoveryRequiredLineages.has(item.lineage_id)}
              planningBusy={working || Boolean(materializingLineage)}
              onPlanSlot={planningAccess.can_change_intent && syllabusHydrated ? planFutureSlot : null}
              onSuggestSlot={planningAccess.can_change_intent && syllabusHydrated ? suggestFutureSlot : null}
              onWeekChange={(weekStart) => setSelectedWeekStart(weekStart)}
              restoreWeekStart={selectedWeekStart}
              focusPlannedDate={returnFocus.plannedDate}
              focusLessonKey={returnFocus.lessonKey}
              focusOccurrenceId={returnFocus.occurrenceId}
              today={syllabus.resolved_today}
              contentLoading={contentLoading && !Array.isArray(syllabus.timeline_items)}
            />}

          {selectedSyllabusLesson && <FacilitatorSyllabusLessonOverlay
            selection={selectedSyllabusLesson}
            learnerId={learnerId}
            accessToken={token}
            planTier={planTier}
            resolvedToday={syllabus?.resolved_today || ''}
            activeRevisionId={syllabus?.active_revision?.id || ''}
            workflowSource="syllabus"
            onChanged={() => loadCurrent()}
            onClose={() => setSelectedSyllabusLesson(null)}
            onOpenLesson={(item) => openFacilitatorLessonWorkflow(item)}
            onTeacherAssignment={(item, teacher) => handleTeacherAssignment(item, teacher)}
            teacherBusy={teacherAssignmentBusy === selectedSyllabusLesson.occurrenceKey}
            canScheduleLessons={canScheduleLessons}
            onSchedule={(item) => { void handleLessonAction(item, { id: item.is_explicit_schedule ? 'reschedule' : 'schedule' }) }}
            onReviewHistory={(item) => openReviewHistory(item)}
            onScheduleSlate={(item) => { void handleLessonAction(item, { id: 'schedule_slate' }) }}
            onRemoveSlateSchedule={(item) => { void handleLessonAction(item, { id: 'remove_slate_schedule' }) }}
            slateBusy={slateAssignmentBusy === selectedSyllabusLesson.occurrenceKey}
            onEditConcept={editPlannedConcept}
            onRemoveConcept={async (item) => Boolean(await planningPost('remove', { lineageId: item.lineage_id }))}
            onUseExisting={(item) => {
              setSelectedSyllabusLesson(null)
              void handleLessonAction(item, { id: 'use_existing' })
            }}
            onGenerate={(item) => {
              setSelectedSyllabusLesson(null)
              void materializeForecast(item, { proposal: item.origin === 'learning_forecast' ? learningProposal : null })
            }}
            onGenerateWithChanges={(item, changeRequest) => generateForecastWithChanges(item, changeRequest)}
            onCreateOwnLesson={createOwnForecastLesson}
            canChangeIntent={planningAccess.can_change_intent}
            onRecordHistoricalActivity={async (item, activity) => { setSelectedSyllabusLesson(null); await handleRecordHistoricalActivity(item, activity) }}
            historicalActivityBusy={historicalActivityBusy === selectedSyllabusLesson.occurrenceKey}
            legacyWebbCompletion={legacyWebbCompletions[selectedSyllabusLesson.item?.lesson_key]}
          />}

          {editingSection && syllabus?.has_active_syllabus && <SyllabusPlanEditor
            section={editingSection}
            revision={syllabus.active_revision}
            forecastItems={syllabus.forecast_items || []}
            learnerId={learnerId}
            accessToken={token}
            today={syllabus.resolved_today || ''}
            onClose={() => setEditingSection('')}
            onSaved={() => loadCurrent()}
          />}

          {conceptEditor && <div className={styles.editorBackdrop}><section className={styles.sectionEditor} role="dialog" aria-modal="true" aria-label="Plan future lesson"><header><h2>Plan future lesson</h2><button type="button" onClick={() => setConceptEditor(null)}>Close</button></header>{error && <div className={styles.error} role="alert">{error}</div>}<label>Title<input autoFocus value={conceptEditor.title} onChange={(event) => setConceptEditor({ ...conceptEditor, title: event.target.value })} /></label><label>Brief description<textarea rows={5} value={conceptEditor.description} onChange={(event) => setConceptEditor({ ...conceptEditor, description: event.target.value })} /></label><footer><button type="button" className={styles.secondaryButton} onClick={() => setConceptEditor(null)}>Cancel</button><button type="button" className={styles.primaryButton} disabled={working || !conceptEditor.title.trim() || !conceptEditor.description.trim()} onClick={saveConceptEditor}>Save planned concept</button></footer></section></div>}

          {dayActionDate && <SyllabusDayActionDialog
            date={dayActionDate}
            subjects={syllabus?.active_revision?.subjects || []}
            isNoSchool={Object.prototype.hasOwnProperty.call(noSchoolByDate, dayActionDate)}
            noSchoolReason={noSchoolByDate[dayActionDate] || ''}
            canGenerate={planningAccess.can_change_intent}
            canUseExisting={canScheduleLessons}
            busy={working}
            error={dayActionError}
            onClose={() => { setDayActionDate(''); setDayActionError('') }}
            onGenerate={createGeneratedDayLesson}
            onUseExisting={({ date }) => { setDayActionDate(''); void openLessonPicker(date) }}
            onMarkNoSchool={setNoSchoolDate}
            onClearNoSchool={clearNoSchoolDate}
          />}

          {scheduleDialog && <SyllabusScheduleDialog
            mode={scheduleDialog.mode}
            scheduledDate={scheduleDialog.scheduledDate}
            minimumDate={syllabus.resolved_today}
            item={scheduleDialog.item}
            lessons={scheduleLessons}
            loading={scheduleCatalogLoading}
            busy={scheduleBusy || Boolean(materializingLineage)}
            error={scheduleError}
            onClose={() => { setScheduleDialog(null); setScheduleError('') }}
            onDateChange={(scheduledDate) => setScheduleDialog((current) => ({ ...current, scheduledDate }))}
            onChooseLesson={(lesson) => scheduleDialog.mode === 'bind'
              ? materializeForecast(scheduleDialog.item, { proposal: scheduleDialog.proposal, existingLessonKey: lesson.lessonKey }).then((bound) => { if (bound) setScheduleDialog(null) })
              : saveLessonSchedule({ lessonKey: lesson.lessonKey, scheduledDate: scheduleDialog.scheduledDate })}
            onSubmit={() => saveLessonSchedule({ lessonKey: scheduleDialog.item?.lesson_key, scheduledDate: scheduleDialog.scheduledDate, scheduleId: scheduleDialog.scheduleId, forecastLineageId: scheduleDialog.item?.forecast_lineage_id || scheduleDialog.item?.lineage_id || '' })}
          />}

          {slateScheduler && (() => {
            const earliestDate = [dateOnly(slateScheduler.item?.planned_date), dateOnly(slateScheduler.resolvedToday)].filter(Boolean).sort().at(-1) || ''
            const occurrenceKey = slateScheduler.item?.source_occurrence_id || slateScheduler.item?.occurrence_id || slateScheduler.item?.id || ''
            return <div className={styles.editorBackdrop}><section className={styles.sectionEditor} role="dialog" aria-modal="true" aria-label={`Schedule Mr. Slate for ${slateScheduler.item?.title || 'lesson'}`}><header><h2>Schedule Mr. Slate</h2><button type="button" onClick={() => setSlateScheduler(null)}>Close</button></header>{error && <div className={styles.error} role="alert">{error}</div>}<p>Schedule a separate supplemental practice session for <strong>{slateScheduler.item?.title}</strong>. This does not change the instructional teacher or complete the lesson.</p><label>Mr. Slate session date<input autoFocus type="date" min={earliestDate} value={slateScheduler.scheduledDate} onChange={(event) => setSlateScheduler({ ...slateScheduler, scheduledDate: event.target.value })} /></label><footer><button type="button" className={styles.secondaryButton} onClick={() => setSlateScheduler(null)}>Cancel</button><button type="button" className={styles.primaryButton} disabled={!slateScheduler.scheduledDate || slateAssignmentBusy === occurrenceKey} onClick={scheduleSlateSession}>{slateAssignmentBusy === occurrenceKey ? 'Scheduling…' : 'Schedule supplemental session'}</button></footer></section></div>
          })()}

          {historyOccurrenceId && <LessonHistoryOverlay
            learnerId={learnerId}
            occurrenceId={historyOccurrenceId}
            accessToken={token}
            pageIdentity={currentPageIdentity}
            onClose={() => setHistoryOccurrenceId('')}
          />}

          {draft && !editingActiveSyllabus && <section className={styles.actions}><label>Reason for this revision<input value={draft.change_reason || ''} disabled={!planningAccess.can_change_intent} onChange={(event) => setDraft({ ...draft, change_reason: event.target.value })} placeholder={planningAccess.can_change_intent ? 'Optional' : 'Initial seed retained as proposed'} /></label><div><button className={styles.secondaryButton} onClick={() => setDraft(null)} disabled={working}>Cancel proposal</button><button className={styles.primaryButton} onClick={activate} disabled={working || !canActivateDraft}>{working ? 'Activating…' : 'Activate Syllabus'}</button></div></section>}
        </>
      )}
    </main>
  )
}
