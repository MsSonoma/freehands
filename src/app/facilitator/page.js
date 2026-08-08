'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import { resolveFacilitatorHomeDecision } from '@/app/lib/facilitatorHome.mjs'
import {
  FACILITATOR_HOME_SHELL_STATES,
  loadFacilitatorHomeSchedules,
  resolveFacilitatorHomeShellState,
  settleFacilitatorHomeTask,
} from '@/app/lib/facilitatorHomeLoading.mjs'
import { readPreparationSnapshot } from './prepare/preparationSnapshot'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'

const PREPARE_PATH = '/facilitator/prepare'

export default function FacilitatorPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: 'required' })
  const [pinChecked, setPinChecked] = useState(false)
  const [facilitatorName, setFacilitatorName] = useState('')
  const [plan, setPlan] = useState('free')
  const [learners, setLearners] = useState([])
  const [generatedLessons, setGeneratedLessons] = useState([])
  const [scheduledKeys, setScheduledKeys] = useState({})
  const [preparationSnapshot, setPreparationSnapshot] = useState(null)
  const [sessionStatus, setSessionStatus] = useState('idle')
  const [learnerStatus, setLearnerStatus] = useState('idle')
  const [lessonStatus, setLessonStatus] = useState('idle')
  const [scheduleStatus, setScheduleStatus] = useState('idle')
  const [authToken, setAuthToken] = useState('')
  const [learnerError, setLearnerError] = useState('')
  const [scheduleWarning, setScheduleWarning] = useState('')
  const [learnerRetry, setLearnerRetry] = useState(0)

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
    setSessionStatus('loading')
    ;(async () => {
      const sessionResult = await settleFacilitatorHomeTask(async () => {
        const supabase = getSupabaseClient()
        return supabase.auth.getSession()
      }, { fallback: null, label: 'Facilitator session' })
      if (cancelled) return

      const authSession = sessionResult.value?.data?.session || null
      const token = authSession?.access_token || ''
      setAuthToken(token)
      setSessionStatus('ready')

      if (authSession?.user) {
        const meta = authSession.user.user_metadata || {}
        setFacilitatorName((meta.full_name || meta.display_name || meta.name || '').trim())

        const profileResult = await settleFacilitatorHomeTask(async () => {
          const supabase = getSupabaseClient()
          return supabase
              .from('profiles')
              .select('full_name, subscription_tier, plan_tier')
              .eq('id', authSession.user.id)
              .maybeSingle()
        }, { fallback: null, label: 'Facilitator profile' })
        if (!cancelled && profileResult.ok) {
          const profile = profileResult.value?.data
          if (profile?.full_name) setFacilitatorName(profile.full_name)
          setPlan((profile?.plan_tier || profile?.subscription_tier || 'free').toString().toLowerCase())
        }
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, pinChecked])

  useEffect(() => {
    if (!pinChecked || !isAuthenticated) return
    let cancelled = false
    setLearnerStatus('loading')
    setLearnerError('')
    try {
      setPreparationSnapshot(readPreparationSnapshot())
    } catch {
      setPreparationSnapshot(null)
    }

    ;(async () => {
      const result = await settleFacilitatorHomeTask(() => listLearners(), {
        fallback: [],
        label: 'Learner list',
      })
      if (cancelled) return
      setLearners(Array.isArray(result.value) ? result.value : [])
      if (!result.ok) {
        setLearnerError('We could not load learner information. You can still use Advanced Tools or try again.')
        setLearnerStatus('error')
        return
      }
      setLearnerStatus('ready')
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, learnerRetry, pinChecked])

  useEffect(() => {
    if (!pinChecked || !isAuthenticated || sessionStatus !== 'ready') return
    let cancelled = false
    if (!authToken) {
      setGeneratedLessons([])
      setLessonStatus('ready')
      return
    }
    setLessonStatus('loading')

    ;(async () => {
      const result = await settleFacilitatorHomeTask(async ({ signal }) => {
        const response = await fetch('/api/facilitator/lessons/list', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${authToken}` },
          signal,
        })
        if (!response.ok) throw new Error(`Lesson list returned ${response.status}`)
        const lessons = await response.json()
        return Array.isArray(lessons) ? lessons : []
      }, { fallback: [], label: 'Lesson list' })
      if (!cancelled) {
        setGeneratedLessons(result.value)
        setLessonStatus('ready')
      }
    })()
    return () => { cancelled = true }
  }, [authToken, isAuthenticated, pinChecked, sessionStatus])

  useEffect(() => {
    if (!pinChecked || !isAuthenticated || sessionStatus !== 'ready') return
    if (learnerStatus !== 'ready' && learnerStatus !== 'error') return
    let cancelled = false

    if (!authToken || learnerStatus === 'error' || learners.length === 0) {
      setScheduledKeys({})
      setScheduleWarning('')
      setScheduleStatus('ready')
      return
    }

    setScheduleStatus('loading')
    setScheduleWarning('')
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    const endDate = future.toISOString().slice(0, 10)

    ;(async () => {
      const result = await loadFacilitatorHomeSchedules({
        learners,
        loadSchedule: async (learner, { signal }) => {
          const response = await fetch(`/api/lesson-schedule?learnerId=${encodeURIComponent(learner.id)}&startDate=${today}&endDate=${endDate}&includeAll=1`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${authToken}` },
            signal,
          })
          if (!response.ok) throw new Error(`Schedule returned ${response.status}`)
          return response.json()
        },
      })
      if (!cancelled) {
        setScheduledKeys(result.scheduledKeys)
        setScheduleWarning(result.failures > 0
          ? `Some schedule information is unavailable (${result.failures} request${result.failures === 1 ? '' : 's'}).`
          : '')
        setScheduleStatus('ready')
      }
    })()
    return () => { cancelled = true }
  }, [authToken, isAuthenticated, learnerStatus, learners, pinChecked, sessionStatus])

  const decision = useMemo(() => {
    if (learnerStatus === 'idle' || learnerStatus === 'loading' || sessionStatus !== 'ready' || scheduleStatus === 'idle' || scheduleStatus === 'loading') {
      return {
        kind: 'LOADING',
        title: 'Loading your next decision…',
        body: 'The Home page is ready while learner and schedule information finishes loading.',
      }
    }
    if (learnerError) {
      return {
        kind: 'LOAD_ERROR',
        title: 'Learner information is unavailable',
        body: learnerError,
      }
    }
    return resolveFacilitatorHomeDecision({ learners, scheduledKeys, preparationSnapshot, preparePath: PREPARE_PATH })
  }, [learnerError, learnerStatus, learners, preparationSnapshot, scheduleStatus, scheduledKeys, sessionStatus])

  const shellState = resolveFacilitatorHomeShellState({ authLoading, isAuthenticated, pinChecked })

  if (shellState === FACILITATOR_HOME_SHELL_STATES.LOADING) {
    return <main style={{ padding: '12px 24px' }}><p style={{ color: '#6b7280' }}>Loading...</p></main>
  }

  if (shellState === FACILITATOR_HOME_SHELL_STATES.AUTH_GATE) {
    return (
      <main style={{ minHeight: 320 }}>
        <GatedOverlay
          show
          gateType={gateType || 'auth'}
          feature="Facilitator Home"
          emoji="🔒"
          description="Sign in to manage learners, prepare lessons, schedule learning, and review progress."
          benefits={[
            'Create and manage learner profiles',
            'Prepare and approve personalized lessons',
            'Schedule lessons and review saved progress',
          ]}
        />
      </main>
    )
  }

  const advancedTools = [
    ['Learners', '/facilitator/learners'],
    ['Detailed lesson builder', '/facilitator/generator?advanced=1'],
    ['Lesson Library', '/facilitator/lessons'],
    ['Calendar', '/facilitator/calendar'],
    ['Lesson Planner', '/facilitator/calendar?tab=planner'],
    ['Custom Subjects', '/facilitator/calendar?tab=subjects'],
    ['Portfolio tools', '/facilitator/calendar?portfolio=1'],
    ['Account', '/facilitator/account'],
    ['Mr. Mentor', '/facilitator/mr-mentor'],
  ]

  return (
    <main style={{ padding: '18px 12px 44px', maxWidth: 860, margin: '0 auto', fontFamily: 'Roboto, sans-serif' }}>
      <h1 style={{ margin: '0 0 4px', fontFamily: 'Montserrat, sans-serif', fontSize: 24 }}>
        {facilitatorName ? `Hi, ${facilitatorName}` : 'Facilitator Home'}
      </h1>
      <p style={{ margin: '0 0 18px', color: '#6b7280' }}>Your next facilitator decision is first. Advanced tools stay available below.</p>

      {scheduleWarning && <div role="status" style={{ marginBottom: 14, padding: 12, border: '1px solid #f3d7a6', borderRadius: 8, background: '#fffbeb', color: '#78350f' }}>{scheduleWarning}</div>}

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ color: 'rgb(199, 68, 46)', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Primary decision</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>{decision.title}</h2>
            <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.5 }}>{decision.body}</p>
          </div>
          {decision.kind === 'LOAD_ERROR' && (
            <button type="button" onClick={() => setLearnerRetry((value) => value + 1)} style={{ minWidth: 150, padding: '11px 16px', borderRadius: 8, border: '1px solid rgb(199, 68, 46)', background: 'rgb(199, 68, 46)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
              Try again
            </button>
          )}
          {decision.href && (
            <Link href={decision.href} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 150, padding: '11px 16px', borderRadius: 8, border: '1px solid rgb(199, 68, 46)', background: 'rgb(199, 68, 46)', color: '#fff', fontWeight: 800, textDecoration: 'none' }}>
              {decision.label}
            </Link>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <strong>{learnerStatus === 'ready' ? learners.length : '—'}</strong>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Learners</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <strong>{lessonStatus === 'ready' ? generatedLessons.filter((lesson) => lesson.approved === true).length : '—'}</strong>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Approved lessons</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <strong>{scheduleStatus === 'ready' ? Object.keys(scheduledKeys).length : '—'}</strong>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Scheduled</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <strong>{sessionStatus === 'ready' ? plan : '—'}</strong>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Plan</div>
        </div>
      </section>

      <section>
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Advanced Tools</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {advancedTools.map(([label, href]) => (
            <Link key={href} href={href} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff', color: '#111827', textDecoration: 'none', fontWeight: 700 }}>
              {label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
