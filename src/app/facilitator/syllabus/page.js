'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'
import LessonHistoryOverlay from '@/app/components/syllabus/LessonHistoryOverlay'
import SyllabusDocument from '@/app/components/syllabus/SyllabusDocument'
import SyllabusPlanningWorkspace from '@/app/components/syllabus/SyllabusPlanningWorkspace'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { ensurePinAllowed, ensureFacilitatorPinException, requestFacilitatorPinException } from '@/app/lib/pinGate'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import { addWeeklyPatternSlot, moveSyllabusWeek, removeWeeklyPatternSlot, syllabusEntitlementsFor, weeklyPatternCapacity } from '@/app/lib/syllabus/timeline.mjs'
import { buildForecastViewIdentity, isCurrentForecastResponse } from '@/app/lib/syllabus/forecastRequestIdentity.mjs'
import {
  normalizedTeachingGuidance,
  teachingGuidanceOverrideFrom,
  TEACHING_GUIDANCE_FIELDS,
  updateTeachingGuidanceList,
} from '@/app/lib/syllabus/teachingGuidance.mjs'
import { resolveEffectiveTier } from '@/app/lib/entitlements'
import { getWebbCompletionForLearner } from '@/app/lib/webbCompletionClient'
import styles from './syllabus.module.css'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS = Object.fromEntries(DAYS.map((day) => [day, day[0].toUpperCase() + day.slice(1)]))

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

function masteryChanges(items) {
  return (items || []).filter((item) => item?.origin === 'mastery_reforecast' && item?.metadata?.mastery_reforecast)
}

export default function SyllabusPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: 'required' })
  const [pinChecked, setPinChecked] = useState(false)
  const [learners, setLearners] = useState([])
  const [learnerId, setLearnerId] = useState('')
  const [token, setToken] = useState('')
  const [planTier, setPlanTier] = useState('free')
  const [syllabus, setSyllabus] = useState(null)
  const [masteryProposal, setMasteryProposal] = useState(null)
  const [masteryMessage, setMasteryMessage] = useState('')
  const [learningProposal, setLearningProposal] = useState(null)
  const [learningMessage, setLearningMessage] = useState('')
  const [forecastError, setForecastError] = useState('')
  const [materializingLineage, setMaterializingLineage] = useState('')
  const [recoveryRequiredLineages, setRecoveryRequiredLineages] = useState(() => new Set())
  const [draft, setDraft] = useState(null)
  const [newSubject, setNewSubject] = useState('')
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [slotSubjects, setSlotSubjects] = useState({})
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [teacherAssignmentBusy, setTeacherAssignmentBusy] = useState('')
  const [slateAssignmentBusy, setSlateAssignmentBusy] = useState('')
  const [historicalActivityBusy, setHistoricalActivityBusy] = useState('')
  const [legacyWebbCompletions, setLegacyWebbCompletions] = useState({})
  const [error, setError] = useState('')
  const [selectedWeekStart, setSelectedWeekStart] = useState('')
  const [editingSection, setEditingSection] = useState('')
  const [planAheadOpen, setPlanAheadOpen] = useState(false)
  const [conceptEditor, setConceptEditor] = useState(null)
  const [replacingLineage, setReplacingLineage] = useState('')
  const [historyOccurrenceId, setHistoryOccurrenceId] = useState('')
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
    selectedWeekStart,
  })
  const planningAccess = syllabusEntitlementsFor({ role: 'facilitator', planTier })

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    let cancelled = false
    ;(async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-syllabus')
        if (!allowed) return router.push('/')
      } finally {
        if (!cancelled) setPinChecked(true)
      }
    })()
    return () => { cancelled = true }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!pinChecked || !isAuthenticated) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const [{ data: { session } }, items] = await Promise.all([supabase.auth.getSession(), listLearners()])
        if (cancelled) return
        const safeItems = Array.isArray(items) ? items.filter((item) => /^[0-9a-f-]{36}$/i.test(String(item.id))) : []
        const remembered = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : ''
        setToken(session?.access_token || '')
        if (session?.user) {
          const { data: profile } = await supabase.from('profiles').select('plan_tier,subscription_tier').eq('id', session.user.id).maybeSingle()
          if (!cancelled) setPlanTier(resolveEffectiveTier(profile?.subscription_tier, profile?.plan_tier))
        }
        setLearners(safeItems)
        setLearnerId(safeItems.some((item) => String(item.id) === remembered) ? remembered : (safeItems[0]?.id || ''))
      } catch (cause) {
        if (!cancelled) setError(cause.message || 'Could not load learners')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, pinChecked])

  async function loadCurrent(id = learnerId) {
    if (!id || !token) return
    const sequence = ++loadSequence.current
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/syllabus?learnerId=${encodeURIComponent(id)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not load Syllabus')
      if (sequence !== loadSequence.current || !pageIdentity.current.startsWith(`${id}:`)) return
      setSyllabus(json)
      setLegacyWebbCompletions(getWebbCompletionForLearner(id))
      setMasteryProposal(json.proposed_reforecast ? {
        proposal_revision: json.proposed_reforecast.revision,
        forecast_items: json.proposed_reforecast.forecast_items,
        changes: masteryChanges(json.proposed_reforecast.forecast_items),
      } : null)
      setMasteryMessage('')
      setLearningProposal(json.proposed_learning_forecast ? {
        proposal_revision: json.proposed_learning_forecast.revision,
        forecast_items: json.proposed_learning_forecast.forecast_items,
      } : null)
      setLearningMessage('')
      setDraft(null)
      setNewSubject('')
      setAvailableSubjects([])
    } catch (cause) {
      if (sequence === loadSequence.current) setError(cause.message)
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }

  useEffect(() => { if (learnerId && token) loadCurrent(learnerId) }, [learnerId, token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const activeId = syllabus?.active_revision?.id
    const targetWeek = currentTargetForecastWeek
    if (!activeId || selectedWeekStart !== targetWeek || !planningAccess.can_change_intent) return
    const identity = `${learnerId}:${activeId}:${targetWeek}`
    if (forecastAttempt.current === identity) return
    forecastAttempt.current = identity
    createLearningForecast({ automatic: true })
  }, [selectedWeekStart, syllabus?.active_revision?.id, syllabus?.resolved_today, learningProposal, learnerId, planningAccess.can_change_intent]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editingSection && !conceptEditor) return
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (conceptEditor) setConceptEditor(null)
      else { setEditingSection(''); setDraft(null) }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = priorOverflow; document.removeEventListener('keydown', onKeyDown) }
  }, [editingSection, conceptEditor])

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

  async function checkMasteryEvidence() {
    setWorking(true)
    setError('')
    setMasteryMessage('')
    try {
      const response = await fetch('/api/syllabus/reforecast', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, expectedActiveRevisionId: syllabus.active_revision.id }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not check mastery evidence')
      if (json.kind === 'no_action') {
        setMasteryMessage(json.message)
        return
      }
      setMasteryProposal(json)
      setMasteryMessage('A proposed reforecast is ready for review. The current active Syllabus has not changed.')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setWorking(false)
    }
  }

  async function activateMasteryProposal() {
    setWorking(true)
    setError('')
    try {
      const postActivation = (exceptionPin) => fetch('/api/syllabus/activate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          proposalRevisionId: masteryProposal.proposal_revision.id,
          expectedActiveRevisionId: syllabus.active_revision.id,
          ...(exceptionPin ? { exceptionPin } : {}),
        }),
      })
      let response = await postActivation()
      let json = await response.json()
      if (response.status === 409 && json?.code === 'SYLLABUS_CAPACITY_PIN_REQUIRED') {
        const pin = await requestFacilitatorPinException({ message: json.error })
        if (!pin) throw new Error('The placement exception was not approved.')
        response = await postActivation(pin)
        json = await response.json()
      }
      if (!response.ok) throw new Error(json.error || 'Could not activate proposed reforecast')
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
    setWorking(true)
    setError('')
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
      if (!response.ok) throw new Error(json.error || 'Could not prepare the instructional forecast')
      if (json.kind === 'no_action') {
        setLearningMessage(json.message)
        return
      }
      setLearningProposal(json)
      setLearningMessage(json.reused
        ? 'The current instructional forecast already reflects the authoritative Syllabus and evidence inputs.'
        : 'A one-week instructional forecast is ready for review. The active Syllabus has not changed.')
    } catch (cause) {
      if (!responseIsCurrent()) return
      setError(cause.message)
      setForecastError(cause.message)
      if (!automatic) forecastAttempt.current = ''
    } finally {
      if (responseIsCurrent()) setWorking(false)
    }
  }

  function openSectionEditor(section) {
    setDraft(activeToDraft(syllabus.active_revision, syllabus.forecast_items, syllabus.resolved_today))
    setEditingSection(section)
    setNewSubject('')
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

  async function saveConceptEditor() {
    if (!conceptEditor) return
    const result = conceptEditor.source === 'forecast'
      ? await planningPost('edit_forecast', { proposalRevisionId: learningProposal.proposal_revision.id, lineageId: conceptEditor.item.lineage_id, title: conceptEditor.title, description: conceptEditor.description })
      : await planningPost('edit', { lineageId: conceptEditor.item.lineage_id, title: conceptEditor.title, description: conceptEditor.description })
    if (result) setConceptEditor(null)
  }

  async function replaceForecast(item) {
    if (!item?.lineage_id || replacingLineage) return null
    setReplacingLineage(item.lineage_id)
    try { return await planningPost('replace_forecast', { proposalRevisionId: learningProposal.proposal_revision.id, lineageId: item.lineage_id }) }
    finally { setReplacingLineage('') }
  }

  async function activateLearningProposal() {
    setWorking(true)
    setError('')
    try {
      const response = await fetch('/api/syllabus/activate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          proposalRevisionId: learningProposal.proposal_revision.id,
          expectedActiveRevisionId: syllabus.active_revision.id,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not adopt the instructional forecast')
      await loadCurrent()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setWorking(false)
    }
  }

  async function materializeForecast(item, { proposal = null } = {}) {
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
          expectedActiveRevisionId: syllabus.active_revision.id,
          ...(proposal ? { proposalRevisionId: proposal.proposal_revision.id } : {}),
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        if (json?.code === 'MATERIALIZATION_RECOVERY_REQUIRED') {
          setRecoveryRequiredLineages((current) => new Set(current).add(lineageId))
        }
        throw new Error(json.error || 'Could not generate this forecast lesson')
      }
      await loadCurrent()
    } catch (cause) {
      setError(cause.message)
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

  function addPatternSlot(day) {
    const subject = slotSubjects[day] || draft?.subjects?.[0]?.name || ''
    if (!draft || !subject) return
    setDraft({ ...draft, weekly_pattern: addWeeklyPatternSlot(draft.weekly_pattern, day, subject) })
  }

  function removePatternSlot(day, index) {
    if (!draft) return
    setDraft({ ...draft, weekly_pattern: removeWeeklyPatternSlot(draft.weekly_pattern, day, index) })
  }

  async function handleLessonAction(item, action) {
    if (action?.id === 'assign_slate' || action?.id === 'unassign_slate') {
      const occurrenceKey = item?.source_occurrence_id || item?.occurrence_id || item?.id || ''
      setSlateAssignmentBusy(occurrenceKey)
      setError('')
      try {
        const response = await fetch('/api/syllabus/slate-assignments', {
          method: action.id === 'assign_slate' ? 'POST' : 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(action.id === 'assign_slate'
            ? { learnerId, lessonKey: item.lesson_key, occurrenceId: occurrenceKey }
            : { learnerId, assignmentId: item.assignment_id }),
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Could not update the Mr. Slate assignment')
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
    if (action?.id === 'edit_concept' && item?.lineage_id) {
      setConceptEditor({ source: 'active', item, title: item.title, description: item.description || '' })
      return
    }
    if (!item?.lesson_key || action?.id !== 'repeat') return
    const allowed = await ensureFacilitatorPinException({
      message: `You already completed ${item.title || 'this lesson'}. Enter the Facilitator PIN to prepare it as a deliberate repeat.`,
    })
    if (!allowed) return
    router.push(`/facilitator/prepare?learnerId=${encodeURIComponent(learnerId)}&lessonKey=${encodeURIComponent(item.lesson_key)}&stage=DELIVERY&repeat=1`)
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
    setMasteryProposal(null)
    setSelectedWeekStart('')
    setEditingSection('')
    setConceptEditor(null)
    setPlanAheadOpen(false)
    setHistoryOccurrenceId('')
    setRecoveryRequiredLineages(new Set())
    setError('')
    setForecastError('')
    localStorage.setItem('learner_id', nextLearnerId)
  }

  function openReviewHistory(item) {
    const occurrenceId = String(item?.occurrence_id || '').trim()
    if (!occurrenceId || (!occurrenceId.startsWith('actual:') && !occurrenceId.startsWith('historical:'))) return
    setEditingSection('')
    setDraft(null)
    setConceptEditor(null)
    setPlanAheadOpen(false)
    setHistoryOccurrenceId(occurrenceId)
  }

  if (authLoading || (isAuthenticated && !pinChecked)) return <main className={styles.page}><p>Loading…</p></main>
  if (!isAuthenticated) return <main className={styles.page}><GatedOverlay show gateType={gateType || 'auth'} feature="Syllabus" emoji="🧭" description="Sign in to view and activate a learner's educational plan." /></main>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Facilitator forecast</p>
          <h1>Syllabus</h1>
          <p>The learner&apos;s current educational plan and forecast.</p>
        </div>
        <label className={styles.learnerPicker}>Learner
          <select value={learnerId} onChange={(event) => switchLearner(event.target.value)}>
            {learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name}</option>)}
          </select>
        </label>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {!planningAccess.can_change_intent && <p className={styles.masteryMessage}>{establishingFirstSyllabus ? 'Every plan can establish an initial Syllabus through explicit facilitator activation. Future replanning remains locked.' : 'The complete Syllabus remains visible. Future replanning and mastery proposal actions are locked for this plan.'}</p>}
      {!loading && learners.length === 0 && <section className={styles.empty}><h2>No learners yet</h2><p>Add a learner before building a Syllabus.</p></section>}
      {loading && <p className={styles.muted}>Loading {selectedLearner?.name || 'learner'}&apos;s Syllabus…</p>}

      {!loading && learnerId && !syllabus?.has_active_syllabus && !draft && (
        <section className={styles.empty}>
          <h2>This learner does not have an active Syllabus yet.</h2>
          <p>Build a proposal from the current weekly pattern, planning guidance, goals notes, and future planned lessons. Nothing is changed until you activate it.</p>
          <button className={styles.primaryButton} onClick={buildSeed} disabled={working}>{working ? 'Building…' : 'Build from current plan'}</button>
        </section>
      )}

      {!loading && displayRevision && (
        <>
          <section className={styles.statusBar}>
            <div><strong>{draft && !editingActiveSyllabus ? 'Proposal' : 'Current active Syllabus'}</strong><span>{draft && !editingActiveSyllabus ? 'Not active yet' : `Revision ${displayRevision.revision_number}`}</span></div>
            <div><strong>Effective</strong><span>{dateOnly(displayRevision.effective_from)}</span></div>
            {!draft && <div className={styles.statusActions}>{forecastError && <button className={styles.secondaryButton} onClick={() => { forecastAttempt.current = ''; createLearningForecast() }} disabled={working || !planningAccess.can_change_intent}>Retry forecast</button>}<button className={styles.secondaryButton} onClick={checkMasteryEvidence} disabled={working || !planningAccess.can_change_intent}>{working ? 'Checking…' : 'Check mastery evidence'}</button><button className={styles.secondaryButton} disabled={!planningAccess.can_change_intent} onClick={() => setPlanAheadOpen(true)}>Plan ahead</button></div>}
          </section>

          {!draft && masteryMessage && <p className={styles.masteryMessage}>{masteryMessage}</p>}
          {!draft && learningMessage && <p className={styles.masteryMessage}>{learningMessage}</p>}

          {!draft && learningProposal && <section className={styles.learningProposal}>
            <div className={styles.proposalHeading}><div><p className={styles.eyebrow}>Proposed instructional forecast</p><h2>Next week&apos;s open Syllabus slots</h2><p>Dates, subjects, and slot count come from the active weekly pattern. These title-and-description concepts remain inactive until you adopt them.</p></div><span>Revision {learningProposal.proposal_revision.revision_number}</span></div>
            <div className={styles.changeList}>{learningProposal.forecast_items.filter((item) => item.origin === 'learning_forecast').map((item) => <article key={item.lineage_id}>
              <strong>{item.subject}: {item.title}</strong>
              <p>{item.description}</p>
              <small>Planned for {dateOnly(item.planned_date)}.</small>
              <div className={styles.conceptActions}><button className={styles.secondaryButton} disabled={working} onClick={() => setConceptEditor({ source: 'forecast', item, title: item.title, description: item.description || '' })}>Edit</button><button className={styles.secondaryButton} disabled={working || Boolean(replacingLineage)} onClick={() => replaceForecast(item)}>{replacingLineage === item.lineage_id ? 'Replacing…' : 'Replace'}</button></div>
              <button className={styles.secondaryButton} disabled={Boolean(materializingLineage) || working || recoveryRequiredLineages.has(item.lineage_id)} onClick={() => materializeForecast(item, { proposal: learningProposal })}>{materializingLineage === item.lineage_id ? 'Generating…' : recoveryRequiredLineages.has(item.lineage_id) ? 'Recovery required' : 'Adopt forecast and generate lesson'}</button>
            </article>)}</div>
            <div className={styles.proposalDecision}><p>Adoption creates an immutable active Syllabus revision. It does not generate or schedule lessons.</p><button className={styles.primaryButton} onClick={activateLearningProposal} disabled={working || Boolean(materializingLineage) || !planningAccess.can_change_intent}>{working ? 'Adopting…' : 'Adopt instructional forecast'}</button></div>
          </section>}

          {!draft && masteryProposal && <section className={styles.masteryProposal}>
            <div className={styles.proposalHeading}><div><p className={styles.eyebrow}>Proposed reforecast</p><h2>Mastery evidence suggests a small future-plan change</h2><p>The current active Syllabus has not changed. Review this inactive proposal before deciding whether to activate it.</p></div><span>Revision {masteryProposal.proposal_revision.revision_number}</span></div>
            <div className={styles.changeList}>{(masteryProposal.changes || masteryChanges(masteryProposal.forecast_items)).map((item) => {
              const evidence = item.metadata?.mastery_reforecast || item
              return <article key={`${item.lineage_id || item.title}-${item.planned_date}`}><strong>{item.subject}: {item.title}</strong><p>{evidence.finding?.label || 'Mastery reporting identified a supported follow-up.'}</p><small>{evidence.recommendation?.label} Planned for {dateOnly(item.planned_date)}.</small></article>
            })}</div>
            <details className={styles.proposedForecast}><summary>Compare the complete proposed forecast</summary>{groupForecast(masteryProposal.forecast_items).map(([label, items]) => <div className={styles.forecastWeek} key={label}><h3>{label}</h3><ul>{items.map((item) => <li key={item.id || `${item.lineage_id}-${item.planned_date}`}><span className={styles.forecastDate}>{dateOnly(item.planned_date)}</span><div><strong>{item.subject}:</strong> {item.title}{item.origin === 'mastery_reforecast' && <em> Proposed from mastery evidence</em>}</div></li>)}</ul></div>)}</details>
            <div className={styles.proposalDecision}><p>Activation uses the existing explicit Syllabus activation path and makes this immutable revision active today.</p><button className={styles.primaryButton} onClick={activateMasteryProposal} disabled={working || !planningAccess.can_change_intent}>{working ? 'Activating…' : 'Activate proposed reforecast'}</button></div>
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
                  return <li key={subject.name}><span>{subject.name}{referenced && <small>Used in this plan</small>}</span><button type="button" disabled={referenced} title={referenced ? 'Reconcile weekly pattern and forecast references before removing this subject.' : `Remove ${subject.name}`} onClick={() => removeDraftSubject(subject.name)}>Remove</button></li>
                })}</ul><div className={styles.addSubject}><input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addDraftSubject() } }} aria-label="New subject name" placeholder="Add a subject" /><button type="button" className={styles.secondaryButton} onClick={addDraftSubject}>Add</button></div><p className={styles.hint}>Subjects used by the weekly pattern or forecast cannot be removed here. Available catalog: {availableSubjects.map((item) => item.name).join(', ') || 'none'}</p></> : <ul className={styles.simpleList}>{(displayRevision.subjects || []).map((item) => <li key={item.name}>{item.name}</li>)}</ul>}
              </section>

              <section className={styles.section}>
                <h2>Weekly Pattern</h2>
                <p className={styles.sectionIntro}>Each entry is one automatic lesson slot. Duplicate subjects are allowed; two Math entries means two Math slots that day.</p>
                <div className={styles.weekPattern}>{DAYS.map((day) => {
                  const subjects = displayRevision.weekly_pattern?.[day] || []
                  const capacity = weeklyPatternCapacity(displayRevision.weekly_pattern, day)
                  return <div key={day} className={styles.patternDay}><strong>{DAY_LABELS[day]} <small>{capacity} automatic lesson slot{capacity === 1 ? '' : 's'}</small></strong>
                    {draft && planningAccess.can_change_intent ? <>
                      <ul>{subjects.map((item, index) => <li key={`${day}-${index}`}><span>{typeof item === 'string' ? item : item.subject}</span><button type="button" onClick={() => removePatternSlot(day, index)}>Remove</button></li>)}</ul>
                      <div className={styles.patternAdd}><select aria-label={`Subject slot for ${DAY_LABELS[day]}`} value={slotSubjects[day] || draft.subjects?.[0]?.name || ''} onChange={(event) => setSlotSubjects({ ...slotSubjects, [day]: event.target.value })}>{(draft.subjects || []).map((subject) => <option key={subject.name} value={subject.name}>{subject.name}</option>)}</select><button type="button" onClick={() => addPatternSlot(day)}>Add slot</button></div>
                    </> : <span>{subjects.map((item) => typeof item === 'string' ? item : item.subject).join(', ') || 'No automatic lessons'}</span>}
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
              <div className={styles.forecastHeader}><div><p className={styles.eyebrow}>{draft ? 'Future direction' : 'Educational record and forecast'}</p><h2>{draft ? 'Forecast' : 'Lesson timeline'}</h2></div><span>{displayForecast.length} item{displayForecast.length === 1 ? '' : 's'}</span></div>
              {forecastGroups.length ? forecastGroups.map(([label, items]) => <div className={styles.forecastWeek} key={label}><h3>{label}</h3><ul>{items.map((item) => <li key={item.id || `${item.lineage_id}-${item.planned_date}`}><span className={styles.forecastDate}>{new Date(`${dateOnly(item.planned_date)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><div><strong>{item.subject}:</strong> {item.title}{item.description && <p>{item.description}</p>}{!draft && item.placement_kind === 'inferred' && <em> Provisional weekly-pattern forecast</em>}{!draft && item.placement_kind === 'scheduled' && <em> Explicit calendar date</em>}{!draft && item.lesson_key && ['draft', 'approved', 'saved'].includes(item.readiness_state) && <><br /><a href={`/facilitator/prepare?learnerId=${encodeURIComponent(learnerId)}&lessonKey=${encodeURIComponent(item.lesson_key)}&stage=${item.readiness_state === 'draft' ? 'DRAFT' : 'DELIVERY'}`}>{item.readiness_state === 'draft' ? 'Prepare / review draft' : 'Open lesson details'}</a></>}</div></li>)}</ul></div>) : <p className={styles.muted}>No learner-specific lessons are recorded yet.</p>}
            </section>
          </div> : <SyllabusDocument
              revision={syllabus.active_revision}
              forecastItems={syllabus.forecast_items}
              timelineItems={syllabus.timeline_items}
              role="facilitator"
              learnerId={learnerId}
              planTier={planTier}
              learnerName={selectedLearner?.name || ''}
              proposedReforecast={syllabus.proposed_reforecast}
              onLessonAction={handleLessonAction}
              onReviewHistory={openReviewHistory}
              actionCapabilities={{ reviewHistory: true, lessonActions: true }}
              isActionDisabled={(item, actionId) => (actionId === 'materialize' && recoveryRequiredLineages.has(item.lineage_id)) || (['assign_slate', 'unassign_slate'].includes(actionId) && slateAssignmentBusy === (item.source_occurrence_id || item.occurrence_id || item.id))}
              onOpenPlanning={() => setPlanAheadOpen(true)}
              onEditSection={planningAccess.can_change_intent ? openSectionEditor : null}
              onWeekChange={(weekStart) => setSelectedWeekStart(weekStart)}
              onTeacherAssignment={handleTeacherAssignment}
              teacherAssignmentBusy={teacherAssignmentBusy}
              onRecordHistoricalActivity={handleRecordHistoricalActivity}
              historicalActivityBusy={historicalActivityBusy}
              legacyWebbCompletions={legacyWebbCompletions}
              today={syllabus.resolved_today}
            />}

          {editingSection && draft && syllabus?.has_active_syllabus && <div className={styles.editorBackdrop}><section className={styles.sectionEditor} role="dialog" aria-modal="true" aria-label={`Edit ${sectionLabel(editingSection)}`}><header><h2>{sectionLabel(editingSection)}</h2><button type="button" onClick={() => { setEditingSection(''); setDraft(null) }}>Close</button></header>
            {error && <div className={styles.error} role="alert">{error}</div>}
            {editingSection === 'goals' && <label>Goals<textarea rows={8} value={draft.goals?.legacy_notes || ''} onChange={(event) => setDraft({ ...draft, goals: { ...draft.goals, legacy_notes: event.target.value } })} /></label>}
            {editingSection === 'subjects' && <><ul className={styles.subjectEditor}>{draft.subjects.map((subject) => { const referenced = referencedSubjects.has(subject.name.toLocaleLowerCase()); return <li key={subject.name}><span>{subject.name}{referenced && <small>Used by weekly pattern or future intent</small>}</span><button type="button" disabled={referenced} onClick={() => removeDraftSubject(subject.name)}>Remove</button></li> })}</ul><div className={styles.addSubject}><input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} placeholder="Custom subject" /><button type="button" className={styles.secondaryButton} onClick={addDraftSubject}>Add</button></div></>}
            {editingSection === 'weekly_pattern' && <div className={styles.weekPattern}>{DAYS.map((day) => <div key={day} className={styles.patternDay}><strong>{DAY_LABELS[day]}</strong><ul>{(draft.weekly_pattern?.[day] || []).map((item, index) => <li key={`${day}-${index}`}><select value={typeof item === 'string' ? item : item.subject} onChange={(event) => { const next = structuredClone(draft.weekly_pattern); next[day][index] = { subject: event.target.value }; setDraft({ ...draft, weekly_pattern: next }) }}>{draft.subjects.map((subject) => <option key={subject.name}>{subject.name}</option>)}</select><button type="button" onClick={() => removePatternSlot(day, index)}>Remove</button></li>)}</ul><div className={styles.patternAdd}><select value={slotSubjects[day] || draft.subjects?.[0]?.name || ''} onChange={(event) => setSlotSubjects({ ...slotSubjects, [day]: event.target.value })}>{draft.subjects.map((subject) => <option key={subject.name}>{subject.name}</option>)}</select><button type="button" onClick={() => addPatternSlot(day)}>Add slot</button></div></div>)}</div>}
            {editingSection === 'teaching_guidance' && <div className={styles.guidanceEditor}><section><h3>All subjects</h3>{TEACHING_GUIDANCE_FIELDS.map((field) => <GuidanceListEditor key={field.globalKey} field={field} values={guidanceValues(draft.teaching_guidance, field)} onChange={(values) => updateDraftGuidance(field, values)} />)}</section>{guidanceSubjects.map((subject) => <section key={subject}><h3>{subjectLabel(subject)}</h3>{TEACHING_GUIDANCE_FIELDS.map((field) => <GuidanceListEditor key={field.subjectKey} field={field} subject={subject} values={guidanceValues(draft.teaching_guidance, field, subject)} onChange={(values) => updateDraftGuidance(field, values, subject)} />)}</section>)}</div>}
            <footer><button type="button" className={styles.secondaryButton} onClick={() => { setEditingSection(''); setDraft(null) }}>Cancel</button><button type="button" className={styles.primaryButton} disabled={working} onClick={activate}>{working ? 'Saving…' : 'Save Syllabus revision'}</button></footer>
          </section></div>}

          {conceptEditor && <div className={styles.editorBackdrop}><section className={styles.sectionEditor} role="dialog" aria-modal="true" aria-label="Edit forecast concept"><header><h2>Edit forecast concept</h2><button type="button" onClick={() => setConceptEditor(null)}>Close</button></header>{error && <div className={styles.error} role="alert">{error}</div>}<label>Title<input autoFocus value={conceptEditor.title} onChange={(event) => setConceptEditor({ ...conceptEditor, title: event.target.value })} /></label><label>Brief description<textarea rows={5} value={conceptEditor.description} onChange={(event) => setConceptEditor({ ...conceptEditor, description: event.target.value })} /></label><footer><button type="button" className={styles.secondaryButton} onClick={() => setConceptEditor(null)}>Cancel</button><button type="button" className={styles.primaryButton} disabled={working} onClick={saveConceptEditor}>Save as educator intent</button></footer></section></div>}

          {planAheadOpen && <SyllabusPlanningWorkspace revision={syllabus.active_revision} items={[...(syllabus.forecast_items || []), ...(learningProposal?.forecast_items || [])]} today={syllabus.resolved_today} busy={working || Boolean(materializingLineage)} error={error} onClose={() => setPlanAheadOpen(false)} onCreate={(slot, values) => planningPost('create', { plannedDate: slot.planned_date, sortOrder: slot.sort_order, title: values.title, description: values.description })} onEdit={(item, values) => item.origin === 'learning_forecast' ? planningPost('edit_forecast', { proposalRevisionId: learningProposal.proposal_revision.id, lineageId: item.lineage_id, title: values.title, description: values.description }) : planningPost('edit', { lineageId: item.lineage_id, title: values.title, description: values.description })} onRemove={(item) => planningPost('remove', { lineageId: item.lineage_id })} onGenerate={materializeForecast} onSuggest={(slot) => planningPost('suggest', { slots: [{ planned_date: slot.planned_date, sort_order: slot.sort_order }] })} />}

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
