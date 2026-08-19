'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import { preparationDeliveryActionsForTier, resolveEffectiveTier } from '@/app/lib/entitlements'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'
import {
  FACILITATOR_PREPARATION_STAGES,
  FACILITATOR_PREPARATION_VERSION,
  canTransitionPreparationStage,
  reassignPreparationSnapshotLearner,
  resolveConfirmedLessonApproval,
  resolvePreparationLearnerRecovery,
} from '@/app/lib/facilitatorPreparation.mjs'
import { clearPreparationSnapshot, readPreparationSnapshot, writePreparationSnapshot } from './preparationSnapshot'

const STAGES = FACILITATOR_PREPARATION_STAGES

const button = {
  border: '1px solid rgb(199, 68, 46)',
  background: 'rgb(199, 68, 46)',
  color: '#fff',
  borderRadius: 8,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButton = {
  ...button,
  background: '#fff',
  color: 'rgb(199, 68, 46)',
}

function todayDate() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function splitLessonKey(lessonKey) {
  const [subject, ...rest] = String(lessonKey || '').split('/')
  return { subject: subject || 'generated', file: rest.join('/') }
}

const INSTRUCTIONAL_REVIEW_SECTIONS = [
  { key: 'truefalse', title: 'True/False' },
  { key: 'multiplechoice', title: 'Multiple Choice' },
  { key: 'fillintheblank', title: 'Fill in the Blank' },
  { key: 'shortanswer', title: 'Short Answer' },
  { key: 'worksheet', title: 'Worksheet' },
]

const RESERVED_REVIEW_SECTIONS = [
  { key: 'baseline', title: 'Baseline Pool' },
  { key: 'test', title: 'Reserved Test Pool' },
  { key: 'retention', title: 'Delayed Retention Pool' },
  { key: 'dailyFollowup', title: 'Daily Follow-Up Pool' },
  { key: 'weeklyReview', title: 'Weekly Review Pool' },
]

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function textValue(value) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(', ')
  if (typeof value === 'object') return ''
  return String(value)
}

function questionText(item) {
  return textValue(item?.question ?? item?.prompt ?? item?.Q ?? item?.q)
}

function expectedAnswers(item) {
  const answers = []
  ;[
    item?.expectedAny,
    item?.acceptableAnswers,
    item?.acceptable_answers,
    item?.expected,
    item?.answer,
    item?.A,
    item?.a,
  ].forEach((value) => {
    if (Array.isArray(value)) answers.push(...value.map(textValue).filter(Boolean))
    else {
      const text = textValue(value)
      if (text) answers.push(text)
    }
  })
  if (Array.isArray(item?.choices) && Number.isInteger(item?.correct)) {
    const correctChoice = item.choices[item.correct]
    const text = textValue(correctChoice)
    if (text) answers.push(text)
  }
  return Array.from(new Set(answers))
}

function supportText(item) {
  const parts = []
  ;[item?.hint, item?.hints, item?.explanation, item?.rationale].forEach((value) => {
    const text = textValue(value)
    if (text) parts.push(text)
  })
  return Array.from(new Set(parts))
}

function LessonContentReview({ lesson }) {
  const title = lesson?.title || 'Lesson content'
  const vocab = asArray(lesson?.vocab)
  const instructionalSections = INSTRUCTIONAL_REVIEW_SECTIONS
    .map((section) => ({ ...section, items: asArray(lesson?.[section.key]) }))
    .filter((section) => section.items.length > 0)
  const reservedSections = RESERVED_REVIEW_SECTIONS
    .map((section) => ({ ...section, count: asArray(lesson?.[section.key]).length }))
    .filter((section) => section.count > 0)

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: 12, background: '#fff' }}>
        <strong>{title}</strong>
        {lesson?.blurb && <p style={{ margin: '6px 0 0', color: '#4b5563', lineHeight: 1.5 }}>{lesson.blurb}</p>}
        {lesson?.teachingNotes && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>Teaching Notes</div>
            <p style={{ margin: '4px 0 0', color: '#4b5563', lineHeight: 1.5 }}>{lesson.teachingNotes}</p>
          </div>
        )}
      </div>

      {vocab.length > 0 && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Vocabulary</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {vocab.map((entry, index) => (
              <div key={`${entry?.term || 'term'}-${index}`} style={{ borderTop: index ? '1px solid #f3f4f6' : 'none', paddingTop: index ? 8 : 0 }}>
                <strong>{entry?.term || `Term ${index + 1}`}</strong>
                {entry?.definition && <p style={{ margin: '3px 0 0', color: '#4b5563' }}>{entry.definition}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {instructionalSections.map((section) => (
        <section key={section.key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{section.title}</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {section.items.map((item, index) => {
              const answers = expectedAnswers(item)
              const support = supportText(item)
              return (
                <div key={`${section.key}-${index}`} style={{ borderTop: index ? '1px solid #f3f4f6' : 'none', paddingTop: index ? 10 : 0 }}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{index + 1}. {questionText(item) || 'Question text unavailable'}</div>
                  {Array.isArray(item?.choices) && item.choices.length > 0 && (
                    <ol style={{ margin: '6px 0 0', paddingLeft: 22, color: '#374151' }}>
                      {item.choices.map((choice, choiceIndex) => (
                        <li key={`${section.key}-${index}-${choiceIndex}`}>{textValue(choice)}</li>
                      ))}
                    </ol>
                  )}
                  {answers.length > 0 && (
                    <p style={{ margin: '6px 0 0', color: '#065f46' }}>
                      <strong>Expected answer:</strong> {answers.join('; ')}
                    </p>
                  )}
                  {support.length > 0 && (
                    <p style={{ margin: '6px 0 0', color: '#4b5563' }}>
                      <strong>Hint/explanation:</strong> {support.join(' ')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {reservedSections.length > 0 && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Reserved Assessment Pools</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {reservedSections.map((section) => (
              <span key={section.key} style={{ border: '1px solid #d1d5db', borderRadius: 999, padding: '4px 8px', background: '#fff', fontSize: 13 }}>
                {section.title}: {section.count}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function FacilitatorPreparePage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: 'required' })
  const [pinChecked, setPinChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [learners, setLearners] = useState([])
  const [stage, setStage] = useState(STAGES.NEED)
  const [learnerId, setLearnerId] = useState('')
  const [need, setNeed] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [boundaries, setBoundaries] = useState({
    pace: '',
    additionalPractice: false,
    includeWorksheet: false,
    includeTest: false,
    avoidTimedWork: false,
    parentNotes: '',
  })
  const [proposal, setProposal] = useState(null)
  const [intentSnapshot, setIntentSnapshot] = useState(null)
  const [lessonIdentity, setLessonIdentity] = useState(null)
  const [lessonDraft, setLessonDraft] = useState(null)
  const [lessonContentLoading, setLessonContentLoading] = useState(false)
  const [lessonContentError, setLessonContentError] = useState('')
  const [scheduleDate, setScheduleDate] = useState(todayDate())
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [recoveryStage, setRecoveryStage] = useState('')
  const [missingLearnerId, setMissingLearnerId] = useState('')
  const [effectiveTier, setEffectiveTier] = useState('free')
  const deliveryActions = useMemo(() => preparationDeliveryActionsForTier(effectiveTier), [effectiveTier])
  const canScheduleLesson = deliveryActions.schedule

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    let cancelled = false
    ;(async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page')
        if (!allowed) {
          router.push('/')
          return
        }
        if (!cancelled) setPinChecked(true)
      } catch {
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
        const list = await listLearners()
        if (cancelled) return
        setLearners(list || [])

        try {
          const supabase = getSupabaseClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('subscription_tier, plan_tier')
              .eq('id', session.user.id)
              .maybeSingle()
            if (!cancelled) setEffectiveTier(resolveEffectiveTier(profile?.subscription_tier, profile?.plan_tier))
          }
        } catch {
          if (!cancelled) setEffectiveTier('free')
        }

        const params = new URLSearchParams(window.location.search)
        const paramLearnerId = params.get('learnerId') || ''
        const paramLessonKey = params.get('lessonKey') || ''
        const paramStage = params.get('stage') || ''
        if (paramLearnerId) setLearnerId(paramLearnerId)
        if (paramLessonKey) {
          const file = paramLessonKey.replace(/^generated\//, '')
          const identity = { file, lessonKey: paramLessonKey, storagePath: '', ownerId: '' }
          setLessonIdentity(identity)
          setStage(paramStage === STAGES.DELIVERY ? STAGES.DELIVERY : STAGES.DRAFT)
          writePreparationSnapshot({
            version: 1,
            stage: paramStage === STAGES.DELIVERY ? STAGES.DELIVERY : STAGES.DRAFT,
            learnerId: paramLearnerId,
            lessonIdentity: identity,
          })
          setLoading(false)
          return
        }

        const snapshot = readPreparationSnapshot()
        if (snapshot) {
          const recovery = resolvePreparationLearnerRecovery(snapshot, list || [])
          setStage(snapshot.stage || STAGES.NEED)
          setLearnerId(recovery ? '' : (snapshot.learnerId || snapshot.intent?.learnerId || ''))
          setNeed(snapshot.intent?.need || '')
          setBoundaries((prev) => ({ ...prev, ...(snapshot.intent?.boundaries || {}) }))
          setIntentSnapshot(snapshot.intent || null)
          setProposal(snapshot.proposal || null)
          setLessonIdentity(snapshot.lessonIdentity || null)
          setRecoveryStage(recovery?.stage || '')
          setMissingLearnerId(recovery?.missingLearnerId || '')
        } else if (list?.[0]?.id) {
          setLearnerId(list[0].id)
        }
      } catch (error) {
        setMessage(error?.message || 'Could not load learners')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, pinChecked])

  useEffect(() => {
    if (!pinChecked || !isAuthenticated || !lessonIdentity?.file) return
    if (![STAGES.DRAFT, STAGES.DELIVERY].includes(stage)) return
    if (lessonDraft?.__file === lessonIdentity.file) return
    let cancelled = false
    ;(async () => {
      setLessonContentLoading(true)
      setLessonContentError('')
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error('Sign in required')
        const params = new URLSearchParams({ file: lessonIdentity.file })
        const response = await fetch(`/api/facilitator/lessons/get?${params}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json?.error || 'Could not load lesson content')
        if (!cancelled) setLessonDraft({ ...json, __file: lessonIdentity.file })
      } catch (error) {
        if (!cancelled) setLessonContentError(error?.message || 'Could not load lesson content')
      } finally {
        if (!cancelled) setLessonContentLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, lessonDraft?.__file, lessonIdentity?.file, pinChecked, stage])

  const selectedLearner = useMemo(() => learners.find((learner) => learner.id === learnerId) || null, [learners, learnerId])
  const hasLearnerRecovery = !!recoveryStage && !!missingLearnerId

  function snapshotIntentFor(nextLearnerId = learnerId) {
    if (intentSnapshot) return { ...intentSnapshot, learnerId: nextLearnerId }
    return need ? { version: 1, learnerId: nextLearnerId, need, boundaries: activeBoundaries() } : null
  }

  function persist(nextStage, extras = {}) {
    const next = {
      version: FACILITATOR_PREPARATION_VERSION,
      stage: nextStage,
      learnerId,
      intent: extras.intent || snapshotIntentFor(learnerId),
      proposal: extras.proposal ?? proposal,
      lessonIdentity: extras.lessonIdentity ?? lessonIdentity,
    }
    writePreparationSnapshot(next)
  }

  function activeBoundaries() {
    const out = {}
    if (boundaries.pace.trim()) out.pace = boundaries.pace.trim()
    if (boundaries.parentNotes.trim()) out.parentNotes = boundaries.parentNotes.trim()
    ;['additionalPractice', 'includeWorksheet', 'includeTest', 'avoidTimedWork'].forEach((key) => {
      if (boundaries[key]) out[key] = true
    })
    return out
  }

  function moveStage(nextStage, extras = {}) {
    if (!canTransitionPreparationStage(stage, nextStage) && nextStage !== STAGES.NEED) return
    setStage(nextStage)
    persist(nextStage, extras)
  }

  async function getToken() {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Sign in required')
    return token
  }

  async function proposeLesson(event) {
    event?.preventDefault()
    setMessage('')
    setBusy(true)
    try {
      const token = await getToken()
      const intent = { version: 1, learnerId, need, boundaries: activeBoundaries() }
      const response = await fetch('/api/facilitator/lessons/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ intent }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.proposal) throw new Error(json?.error || 'Ms. Sonoma could not prepare a proposal')
      setIntentSnapshot(intent)
      setProposal(json.proposal)
      moveStage(STAGES.PROPOSAL, { intent, proposal: json.proposal })
    } catch (error) {
      setMessage(error?.message || 'Proposal failed')
    } finally {
      setBusy(false)
    }
  }

  async function generateLesson() {
    setMessage('')
    setBusy(true)
    setStage(STAGES.GENERATING)
    persist(STAGES.GENERATING)
    try {
      const token = await getToken()
      const response = await fetch('/api/facilitator/lessons/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'proposal', proposal }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.identity) throw new Error(json?.error || 'Lesson generation failed')
      setLessonIdentity(json.identity)
      setLessonDraft(json.lesson ? { ...json.lesson, __file: json.identity.file } : null)
      setStage(STAGES.DRAFT)
      persist(STAGES.DRAFT, { lessonIdentity: json.identity })
    } catch (error) {
      setStage(STAGES.PROPOSAL)
      setMessage(error?.message || 'Lesson generation failed')
      persist(STAGES.PROPOSAL)
    } finally {
      setBusy(false)
    }
  }

  async function approveLesson() {
    if (!selectedLearner) {
      setMessage('Choose a learner before approving this lesson.')
      return
    }
    if (!lessonIdentity?.file) return
    setMessage('')
    setBusy(true)
    try {
      const token = await getToken()
      const response = await fetch('/api/facilitator/lessons/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ file: lessonIdentity.file }),
      })
      const json = await response.json().catch(() => ({}))
      const approval = resolveConfirmedLessonApproval(json, lessonIdentity)
      if (!response.ok || !approval) throw new Error(json?.error || 'Approval failed')
      setLessonIdentity(approval.lessonIdentity)
      setLessonDraft({ ...approval.lesson, __file: approval.lessonIdentity.file })
      moveStage(approval.stage, { lessonIdentity: approval.lessonIdentity })
    } catch (error) {
      setMessage(error?.message || 'Approval failed')
    } finally {
      setBusy(false)
    }
  }

  async function setAvailability(available = true) {
    if (!selectedLearner) throw new Error('Choose a learner before choosing a session option.')
    const token = await getToken()
    const response = await fetch('/api/facilitator/learners/lesson-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ learnerId, lessonKey: lessonIdentity.lessonKey, available }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json?.error || 'Could not update lesson availability')
    return json
  }

  async function makeAvailable() {
    setBusy(true)
    setMessage('')
    try {
      await setAvailability(true)
      setMessage('The lesson is now available to the learner.')
      finishFlow()
    } catch (error) {
      setMessage(error?.message || 'Could not make the lesson available')
    } finally {
      setBusy(false)
    }
  }

  async function startNow() {
    setBusy(true)
    setMessage('')
    try {
      await setAvailability(true)
      try {
        localStorage.setItem('learner_id', learnerId)
        if (selectedLearner?.name) localStorage.setItem('learner_name', selectedLearner.name)
      } catch {}
      clearPreparationSnapshot()
      const { subject, file } = splitLessonKey(lessonIdentity.lessonKey)
      router.push(`/session?subject=${encodeURIComponent(subject)}&lesson=${encodeURIComponent(file)}`)
    } catch (error) {
      setMessage(error?.message || 'Could not start the lesson')
      setBusy(false)
    }
  }

  async function scheduleLesson() {
    if (!canScheduleLesson) {
      setMessage('Scheduling is available on Standard. You can start this lesson now, make it available, or save it for later.')
      return
    }
    if (!selectedLearner) {
      setMessage('Choose a learner before scheduling this lesson.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const token = await getToken()
      const response = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ learnerId, lessonKey: lessonIdentity.lessonKey, scheduledDate: scheduleDate }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json?.error || 'Could not schedule the lesson')
      setMessage(`The lesson is scheduled for ${scheduleDate}.`)
      finishFlow()
    } catch (error) {
      setMessage(error?.message || 'Could not schedule the lesson')
    } finally {
      setBusy(false)
    }
  }

  function saveForLater() {
    if (!selectedLearner) {
      setMessage('Choose a learner before saving this session choice.')
      return
    }
    setMessage('The lesson is approved and saved. It is not available or scheduled yet.')
    persist(STAGES.DELIVERY, { lessonIdentity })
    router.push('/facilitator')
  }

  function saveDraftAndLeave() {
    if (!selectedLearner) {
      setMessage('Choose a learner before saving this draft.')
      return
    }
    persist(STAGES.DRAFT, { lessonIdentity })
    router.push('/facilitator')
  }

  function finishFlow() {
    clearPreparationSnapshot()
    setStage(STAGES.COMPLETE)
    setTimeout(() => router.push('/facilitator'), 650)
  }

  function abandonFlow() {
    clearPreparationSnapshot()
    setStage(STAGES.NEED)
    setProposal(null)
    setIntentSnapshot(null)
    setLessonIdentity(null)
    setLessonDraft(null)
    setRecoveryStage('')
    setMissingLearnerId('')
    setMessage('Preparation cleared.')
  }

  function assignReplacementLearner(event) {
    event?.preventDefault()
    if (!learnerId || !learners.some((learner) => learner.id === learnerId)) {
      setMessage('Choose a learner before continuing.')
      return
    }
    const reassigned = reassignPreparationSnapshotLearner({
      version: FACILITATOR_PREPARATION_VERSION,
      stage: recoveryStage,
      learnerId: missingLearnerId,
      intent: intentSnapshot,
      proposal,
      lessonIdentity,
    }, learnerId)
    if (!reassigned) {
      setMessage('Could not update the saved preparation. Please choose a learner again.')
      return
    }
    writePreparationSnapshot(reassigned)
    setIntentSnapshot(reassigned.intent)
    setProposal(reassigned.proposal)
    setLessonIdentity(reassigned.lessonIdentity)
    setStage(reassigned.stage)
    setRecoveryStage('')
    setMissingLearnerId('')
    setMessage('Learner selected. The saved lesson is ready to continue.')
  }

  if (authLoading || (isAuthenticated && (!pinChecked || loading))) {
    return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>Loading...</p></main>
  }

  if (!isAuthenticated) {
    return (
      <main style={{ minHeight: 320 }}>
        <GatedOverlay
          show
          gateType={gateType || 'auth'}
          feature="Lesson Preparation"
          emoji="🔒"
          description="Sign in to prepare, approve, and start learning sessions for your learners."
          benefits={[
            'Restore saved lesson preparation',
            'Generate and review learner-specific lessons',
            'Choose a session option after approving lesson content',
          ]}
        />
      </main>
    )
  }

  return (
    <main style={{ padding: '20px 16px 44px', maxWidth: 820, margin: '0 auto', fontFamily: 'Roboto, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontSize: 24 }}>Prepare a guided learning session</h1>
          <p style={{ margin: '6px 0 0', color: '#6b7280', lineHeight: 1.5 }}>Describe what the learner needs. Ms. Sonoma will propose an approach before anything is generated.</p>
        </div>
        <Link href="/facilitator" style={{ ...secondaryButton, textDecoration: 'none', whiteSpace: 'nowrap' }}>Home</Link>
      </div>

      {message && <div style={{ border: '1px solid #f0c9c0', background: '#fff7f5', color: '#7f1d1d', borderRadius: 8, padding: 12, marginBottom: 14 }}>{message}</div>}

      {learners.length === 0 ? (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 18, background: '#fff' }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Add a learner first</h2>
          <p style={{ color: '#4b5563' }}>Ms. Sonoma needs the learner name and grade before preparing a lesson.</p>
          <Link href="/facilitator/learners/add" style={{ ...button, display: 'inline-block', textDecoration: 'none' }}>Add learner</Link>
        </section>
      ) : null}

      {learners.length > 0 && stage === STAGES.NEED && !hasLearnerRecovery && (
        <form onSubmit={proposeLesson} style={{ display: 'grid', gap: 14, border: '1px solid #e5e7eb', borderRadius: 8, padding: 18, background: '#fff' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Learner</span>
            <select value={learnerId} onChange={(event) => setLearnerId(event.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} required>
              {learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name} - grade {learner.grade}</option>)}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>What does the learner need?</span>
            <textarea value={need} onChange={(event) => setNeed(event.target.value)} rows={6} placeholder="Example: She understands basic fractions but gets stuck comparing fractions with different denominators." style={{ padding: 12, border: '1px solid #d1d5db', borderRadius: 8, resize: 'vertical' }} required />
          </label>

          <button type="button" onClick={() => setAdvancedOpen((open) => !open)} style={{ ...secondaryButton, justifySelf: 'start' }}>{advancedOpen ? 'Hide optional boundaries' : 'Optional boundaries'}</button>
          {advancedOpen && (
            <div style={{ display: 'grid', gap: 10, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
              <input value={boundaries.pace} onChange={(event) => setBoundaries((prev) => ({ ...prev, pace: event.target.value }))} placeholder="Pace, if important" style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} />
              {['additionalPractice', 'includeWorksheet', 'includeTest', 'avoidTimedWork'].map((key) => (
                <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={!!boundaries[key]} onChange={(event) => setBoundaries((prev) => ({ ...prev, [key]: event.target.checked }))} />
                  <span>{key === 'additionalPractice' ? 'Add extra practice' : key === 'includeWorksheet' ? 'Include worksheet emphasis' : key === 'includeTest' ? 'Include test-style review' : 'Avoid timed work'}</span>
                </label>
              ))}
              <textarea value={boundaries.parentNotes} onChange={(event) => setBoundaries((prev) => ({ ...prev, parentNotes: event.target.value }))} placeholder="Parent notes" rows={3} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} />
            </div>
          )}

          <button type="submit" disabled={busy || !learnerId || need.trim().length < 8} style={{ ...button, opacity: busy ? 0.7 : 1 }}>{busy ? 'Preparing...' : 'Review Ms. Sonoma\'s approach'}</button>
        </form>
      )}

      {hasLearnerRecovery && (
        <form onSubmit={assignReplacementLearner} style={{ display: 'grid', gap: 14, border: '1px solid #f0c9c0', borderRadius: 8, padding: 18, background: '#fff7f5' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Choose a learner to continue</h2>
          <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.55 }}>The previously selected learner is no longer available. This lesson has not been reassigned. Choose a learner before continuing with the saved {recoveryStage === STAGES.DELIVERY ? 'approved lesson' : 'draft lesson'}.</p>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Learner</span>
            <select value={learnerId} onChange={(event) => setLearnerId(event.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} required>
              <option value="">Choose a learner</option>
              {learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name} - grade {learner.grade}</option>)}
            </select>
          </label>
          <div style={{ border: '1px solid #f0c9c0', borderRadius: 8, padding: 12, background: '#fff' }}>
            <strong>{proposal?.generationSpec?.title || lessonIdentity?.file || 'Saved lesson'}</strong>
            <p style={{ marginBottom: 0, color: '#4b5563' }}>{recoveryStage === STAGES.DELIVERY ? 'Session choices, scheduling, and Start now are disabled until a learner is selected.' : 'Approval is disabled until a learner is selected.'}</p>
          </div>
          <button type="submit" disabled={busy || !learnerId} style={{ ...button, opacity: busy || !learnerId ? 0.7 : 1 }}>Continue with selected learner</button>
        </form>
      )}

      {stage === STAGES.PROPOSAL && proposal && !hasLearnerRecovery && (
        <section style={{ display: 'grid', gap: 14, border: '1px solid #e5e7eb', borderRadius: 8, padding: 18, background: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Proposed approach</h2>
          <p style={{ margin: 0, lineHeight: 1.55 }}>{proposal.summary}</p>
          <div>
            <strong>Assumptions</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>{proposal.assumptions?.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={generateLesson} disabled={busy} style={button}>{busy ? 'Generating...' : 'Use this approach'}</button>
            <button type="button" onClick={() => moveStage(STAGES.NEED)} style={secondaryButton}>Adjust approach</button>
            <button type="button" onClick={abandonFlow} style={secondaryButton}>Cancel</button>
          </div>
        </section>
      )}

      {stage === STAGES.GENERATING && !hasLearnerRecovery && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 18, background: '#fff' }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Generating lesson</h2>
          <p style={{ color: '#4b5563' }}>Ms. Sonoma is creating the draft lesson now.</p>
        </section>
      )}

      {stage === STAGES.DRAFT && lessonIdentity && !hasLearnerRecovery && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(100vh - 120px)', minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8, padding: 18, background: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Review draft</h2>
          {selectedLearner && <p style={{ margin: 0, color: '#374151', fontWeight: 700 }}>Learner: {selectedLearner.name}</p>}
          <p style={{ margin: 0, color: '#4b5563' }}>This lesson is a draft. The learner will not see it until you approve the content and choose a session option.</p>
          {lessonContentLoading && <p style={{ margin: 0, color: '#6b7280' }}>Loading lesson content...</p>}
          {lessonContentError && <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{lessonContentError}</p>}
          <div style={{ minHeight: 180, overflowY: 'auto', paddingRight: 4, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
            <div style={{ padding: 12 }}>
              {lessonDraft ? (
                <LessonContentReview lesson={lessonDraft} />
              ) : (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
                  <strong>{proposal?.generationSpec?.title || lessonIdentity.file}</strong>
                  <p style={{ marginBottom: 0 }}>{proposal?.generationSpec?.description || 'Lesson content is still loading.'}</p>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flexShrink: 0, borderTop: '1px solid #e5e7eb', paddingTop: 14, background: '#fff' }}>
            <button type="button" onClick={approveLesson} disabled={busy || !selectedLearner || lessonContentLoading || !lessonDraft} style={button}>{busy ? 'Approving...' : 'Approve lesson content'}</button>
            <Link href={`/facilitator/lessons/edit?key=${encodeURIComponent(lessonIdentity.lessonKey)}`} style={{ ...secondaryButton, textDecoration: 'none' }}>Edit draft</Link>
            <button type="button" onClick={saveDraftAndLeave} style={secondaryButton}>Save and leave</button>
            <button type="button" onClick={abandonFlow} style={secondaryButton}>Discard draft setup</button>
          </div>
        </section>
      )}

      {stage === STAGES.DELIVERY && lessonIdentity && !hasLearnerRecovery && (
        <section style={{ display: 'grid', gap: 14, border: '1px solid #e5e7eb', borderRadius: 8, padding: 18, background: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Choose session option</h2>
          {selectedLearner && <p style={{ margin: 0, color: '#374151', fontWeight: 700 }}>Learner: {selectedLearner.name}</p>}
          <p style={{ margin: 0, color: '#4b5563' }}>The lesson content is approved. Choose when the learner receives it.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {deliveryActions.startNow && <button type="button" onClick={startNow} disabled={busy || !selectedLearner} style={button}>Start now</button>}
            {deliveryActions.makeAvailable && <button type="button" onClick={makeAvailable} disabled={busy || !selectedLearner} style={secondaryButton}>Make available</button>}
            {deliveryActions.saveForLater && <button type="button" onClick={saveForLater} disabled={busy} style={secondaryButton}>Save for later</button>}
          </div>
          {canScheduleLesson ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontWeight: 700 }}>Schedule date</span>
                <input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} />
              </label>
              <button type="button" onClick={scheduleLesson} disabled={busy || !scheduleDate || !selectedLearner} style={button}>Schedule</button>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, color: '#4b5563', lineHeight: 1.5 }}>
              Scheduling is available on Standard. You can start this lesson now, make it available, or save it for later.{' '}
              <Link href="/facilitator/account/plan" style={{ color: 'rgb(199, 68, 46)', fontWeight: 700 }}>View plans</Link>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
