'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'
import SyllabusDocument from '@/app/components/syllabus/SyllabusDocument'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { ensurePinAllowed, ensureFacilitatorPinException, requestFacilitatorPinException } from '@/app/lib/pinGate'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import { addWeeklyPatternSlot, removeWeeklyPatternSlot, syllabusEntitlementsFor, weeklyPatternCapacity } from '@/app/lib/syllabus/timeline.mjs'
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
  const [materializingLineage, setMaterializingLineage] = useState('')
  const [draft, setDraft] = useState(null)
  const [newSubject, setNewSubject] = useState('')
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [slotSubjects, setSlotSubjects] = useState({})
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [teacherAssignmentBusy, setTeacherAssignmentBusy] = useState('')
  const [historicalActivityBusy, setHistoricalActivityBusy] = useState('')
  const [legacyWebbCompletions, setLegacyWebbCompletions] = useState({})
  const [error, setError] = useState('')

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
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/syllabus?learnerId=${encodeURIComponent(id)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not load Syllabus')
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
      setError(cause.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (learnerId && token) loadCurrent(learnerId) }, [learnerId, token]) // eslint-disable-line react-hooks/exhaustive-deps

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
          ? { learnerId, snapshot: { ...draft, teaching_guidance: normalizedGuidance } }
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

  async function createLearningForecast() {
    setWorking(true)
    setError('')
    setLearningMessage('')
    try {
      const response = await fetch('/api/syllabus/forecast', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, expectedActiveRevisionId: syllabus.active_revision.id }),
      })
      const json = await response.json()
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
      setError(cause.message)
    } finally {
      setWorking(false)
    }
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
    if (!lineageId) return
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
      if (!response.ok) throw new Error(json.error || 'Could not generate this forecast lesson')
      await loadCurrent()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setMaterializingLineage('')
    }
  }

  const selectedLearner = learners.find((item) => String(item.id) === String(learnerId))
  const planningAccess = syllabusEntitlementsFor({ role: 'facilitator', planTier })
  const establishingFirstSyllabus = !syllabus?.has_active_syllabus
  const canActivateDraft = establishingFirstSyllabus ? planningAccess.can_establish_syllabus : planningAccess.can_change_intent
  const displayRevision = draft || syllabus?.active_revision
  const displayForecast = useMemo(() => draft?.forecast_items || syllabus?.timeline_items || syllabus?.forecast_items || [], [draft?.forecast_items, syllabus?.timeline_items, syllabus?.forecast_items])
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
    if (action?.id === 'materialize' && item?.lineage_id) {
      await materializeForecast(item)
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
          <select value={learnerId} onChange={(event) => { setLearnerId(event.target.value); localStorage.setItem('learner_id', event.target.value) }}>
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
            <div><strong>{draft ? 'Proposal' : 'Current active Syllabus'}</strong><span>{draft ? 'Not active yet' : `Revision ${displayRevision.revision_number}`}</span></div>
            <div><strong>Effective</strong><span>{dateOnly(displayRevision.effective_from)}</span></div>
            {!draft && <div className={styles.statusActions}><button className={styles.secondaryButton} onClick={createLearningForecast} disabled={working || !planningAccess.can_change_intent}>{working ? 'Forecasting…' : 'Forecast next week'}</button><button className={styles.secondaryButton} onClick={checkMasteryEvidence} disabled={working || !planningAccess.can_change_intent}>{working ? 'Checking…' : 'Check mastery evidence'}</button><button className={styles.secondaryButton} disabled={!planningAccess.can_change_intent} onClick={() => { setDraft(activeToDraft(syllabus.active_revision, syllabus.forecast_items, syllabus.resolved_today)); setNewSubject('') }}>Edit Syllabus</button></div>}
          </section>

          {!draft && masteryMessage && <p className={styles.masteryMessage}>{masteryMessage}</p>}
          {!draft && learningMessage && <p className={styles.masteryMessage}>{learningMessage}</p>}

          {!draft && learningProposal && <section className={styles.learningProposal}>
            <div className={styles.proposalHeading}><div><p className={styles.eyebrow}>Proposed instructional forecast</p><h2>Next week&apos;s open Syllabus slots</h2><p>Dates, subjects, and slot count come from the active weekly pattern. These title-and-description concepts remain inactive until you adopt them.</p></div><span>Revision {learningProposal.proposal_revision.revision_number}</span></div>
            <div className={styles.changeList}>{learningProposal.forecast_items.filter((item) => item.origin === 'learning_forecast').map((item) => <article key={item.lineage_id}>
              <strong>{item.subject}: {item.title}</strong>
              <p>{item.description}</p>
              <small>Planned for {dateOnly(item.planned_date)}.</small>
              <button className={styles.secondaryButton} disabled={Boolean(materializingLineage) || working} onClick={() => materializeForecast(item, { proposal: learningProposal })}>{materializingLineage === item.lineage_id ? 'Generating…' : 'Adopt forecast and generate lesson'}</button>
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

          {draft && <section className={styles.proposalBanner}><div><strong>Syllabus proposal</strong><p>Review the complete plan. Activation creates a new immutable revision effective today.</p></div><div className={styles.effectiveDate}><strong>Effective today</strong><span>{dateOnly(draft.effective_from)}</span></div></section>}

          {draft ? <div className={styles.contentGrid}>
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
              onTeacherAssignment={handleTeacherAssignment}
              teacherAssignmentBusy={teacherAssignmentBusy}
              onRecordHistoricalActivity={handleRecordHistoricalActivity}
              historicalActivityBusy={historicalActivityBusy}
              legacyWebbCompletions={legacyWebbCompletions}
              today={syllabus.resolved_today}
            />}

          {draft && <section className={styles.actions}><label>Reason for this revision<input value={draft.change_reason || ''} disabled={!planningAccess.can_change_intent} onChange={(event) => setDraft({ ...draft, change_reason: event.target.value })} placeholder={planningAccess.can_change_intent ? 'Optional' : 'Initial seed retained as proposed'} /></label><div><button className={styles.secondaryButton} onClick={() => setDraft(null)} disabled={working}>Cancel proposal</button><button className={styles.primaryButton} onClick={activate} disabled={working || !canActivateDraft}>{working ? 'Activating…' : 'Activate Syllabus'}</button></div></section>}
        </>
      )}
    </main>
  )
}
