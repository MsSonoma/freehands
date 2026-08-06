'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import {
  FACILITATOR_PREPARATION_STAGES,
  FACILITATOR_PREPARATION_VERSION,
  canTransitionPreparationStage,
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

export default function FacilitatorPreparePage() {
  const router = useRouter()
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
  const [lessonIdentity, setLessonIdentity] = useState(null)
  const [lessonDraft, setLessonDraft] = useState(null)
  const [scheduleDate, setScheduleDate] = useState(todayDate())
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
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
  }, [router])

  useEffect(() => {
    if (!pinChecked) return
    let cancelled = false
    ;(async () => {
      try {
        const list = await listLearners()
        if (cancelled) return
        setLearners(list || [])

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
          setStage(snapshot.stage || STAGES.NEED)
          setLearnerId(snapshot.learnerId || snapshot.intent?.learnerId || '')
          setNeed(snapshot.intent?.need || '')
          setBoundaries((prev) => ({ ...prev, ...(snapshot.intent?.boundaries || {}) }))
          setProposal(snapshot.proposal || null)
          setLessonIdentity(snapshot.lessonIdentity || null)
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
  }, [pinChecked])

  const selectedLearner = useMemo(() => learners.find((learner) => learner.id === learnerId) || null, [learners, learnerId])

  function persist(nextStage, extras = {}) {
    const next = {
      version: FACILITATOR_PREPARATION_VERSION,
      stage: nextStage,
      learnerId,
      intent: extras.intent || (need ? { version: 1, learnerId, need, boundaries: activeBoundaries() } : null),
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
      setLessonDraft(json.lesson || null)
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
      if (!response.ok) throw new Error(json?.error || 'Approval failed')
      const identity = json.identity || lessonIdentity
      setLessonIdentity(identity)
      moveStage(STAGES.DELIVERY, { lessonIdentity: identity })
    } catch (error) {
      setMessage(error?.message || 'Approval failed')
    } finally {
      setBusy(false)
    }
  }

  async function setAvailability(available = true) {
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
    setMessage('The lesson is approved and saved. It is not available or scheduled yet.')
    persist(STAGES.DELIVERY, { lessonIdentity })
    router.push('/facilitator')
  }

  function saveDraftAndLeave() {
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
    setLessonIdentity(null)
    setLessonDraft(null)
    setMessage('Preparation cleared.')
  }

  if (!pinChecked || loading) {
    return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>Loading...</p></main>
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

      {learners.length > 0 && stage === STAGES.NEED && (
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

      {stage === STAGES.PROPOSAL && proposal && (
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

      {stage === STAGES.GENERATING && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 18, background: '#fff' }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Generating lesson</h2>
          <p style={{ color: '#4b5563' }}>Ms. Sonoma is creating the draft lesson now.</p>
        </section>
      )}

      {stage === STAGES.DRAFT && lessonIdentity && (
        <section style={{ display: 'grid', gap: 14, border: '1px solid #e5e7eb', borderRadius: 8, padding: 18, background: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Review draft</h2>
          {selectedLearner && <p style={{ margin: 0, color: '#374151', fontWeight: 700 }}>Learner: {selectedLearner.name}</p>}
          <p style={{ margin: 0, color: '#4b5563' }}>This lesson is a draft. The learner will not see it until you approve the content and choose delivery.</p>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
            <strong>{lessonDraft?.title || proposal?.generationSpec?.title || lessonIdentity.file}</strong>
            <p style={{ marginBottom: 0 }}>{lessonDraft?.blurb || proposal?.generationSpec?.description}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={approveLesson} disabled={busy} style={button}>{busy ? 'Approving...' : 'Approve lesson content'}</button>
            <Link href={`/facilitator/lessons/edit?key=${encodeURIComponent(lessonIdentity.lessonKey)}`} style={{ ...secondaryButton, textDecoration: 'none' }}>Edit draft</Link>
            <button type="button" onClick={saveDraftAndLeave} style={secondaryButton}>Save and leave</button>
            <button type="button" onClick={abandonFlow} style={secondaryButton}>Discard draft setup</button>
          </div>
        </section>
      )}

      {stage === STAGES.DELIVERY && lessonIdentity && (
        <section style={{ display: 'grid', gap: 14, border: '1px solid #e5e7eb', borderRadius: 8, padding: 18, background: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Choose delivery</h2>
          {selectedLearner && <p style={{ margin: 0, color: '#374151', fontWeight: 700 }}>Learner: {selectedLearner.name}</p>}
          <p style={{ margin: 0, color: '#4b5563' }}>The lesson content is approved. Choose when the learner receives it.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <button type="button" onClick={startNow} disabled={busy} style={button}>Start now</button>
            <button type="button" onClick={makeAvailable} disabled={busy} style={secondaryButton}>Make available</button>
            <button type="button" onClick={saveForLater} disabled={busy} style={secondaryButton}>Save for later</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontWeight: 700 }}>Schedule date</span>
              <input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} />
            </label>
            <button type="button" onClick={scheduleLesson} disabled={busy || !scheduleDate} style={button}>Schedule</button>
          </div>
        </section>
      )}
    </main>
  )
}