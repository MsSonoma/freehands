'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import { countEducatorApprovedLessons, resolveFacilitatorHomeDecision } from '@/app/lib/facilitatorHome.mjs'
import {
  FACILITATOR_HOME_SHELL_STATES,
  loadFacilitatorHomeSchedules,
  resolveFacilitatorHomeShellState,
  settleFacilitatorHomeTask,
} from '@/app/lib/facilitatorHomeLoading.mjs'
import { readPreparationSnapshot } from './prepare/preparationSnapshot'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'
import styles from './facilitatorHome.module.css'

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
    { label: 'Learners', href: '/facilitator/learners', icon: '👥' },
    { label: 'Detailed lesson builder', href: '/facilitator/generator?advanced=1' },
    { label: 'Lesson Library', href: '/facilitator/lessons', icon: '📚' },
    { label: 'Calendar', href: '/facilitator/calendar', icon: '📅' },
    { label: 'Lesson Planner', href: '/facilitator/calendar?tab=planner', icon: '📅' },
    { label: 'Custom Subjects', href: '/facilitator/calendar?tab=subjects' },
    { label: 'Portfolio tools', href: '/facilitator/calendar?portfolio=1' },
    { label: 'Account', href: '/facilitator/account', icon: '⚙️' },
    { label: 'Mr. Mentor', href: '/facilitator/mr-mentor', icon: '🧠' },
  ]

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          {facilitatorName ? `Hi, ${facilitatorName}` : 'Facilitator Home'}
        </h1>
        <p className={styles.pageSubtitle}>Your next facilitator decision is first. Advanced tools stay available below.</p>
      </header>

      {scheduleWarning && <div role="status" className={styles.warning}>{scheduleWarning}</div>}

      <section className={styles.primaryCard}>
        <div className={styles.primaryLayout}>
          <div className={styles.primaryCopy}>
            <div className={styles.eyebrow}>Primary decision</div>
            <h2 className={styles.decisionTitle}>{decision.title}</h2>
            <p className={styles.decisionBody}>{decision.body}</p>
          </div>
          {decision.kind === 'LOAD_ERROR' && (
            <button type="button" onClick={() => setLearnerRetry((value) => value + 1)} className={styles.primaryAction}>
              Try again
            </button>
          )}
          {decision.href && (
            <Link href={decision.href} className={styles.primaryAction}>
              {decision.label}
            </Link>
          )}
        </div>
      </section>

      <section className={styles.statusGrid} aria-label="Facilitator status">
        <div className={styles.statusItem}>
          <strong className={styles.statusValue}>{learnerStatus === 'ready' ? learners.length : '—'}</strong>
          <div className={styles.statusLabel}>Learners</div>
        </div>
        <div className={styles.statusItem}>
          <strong className={styles.statusValue}>{lessonStatus === 'ready' ? countEducatorApprovedLessons(generatedLessons) : '—'}</strong>
          <div className={styles.statusLabel}>Approved lessons</div>
        </div>
        <div className={styles.statusItem}>
          <strong className={styles.statusValue}>{scheduleStatus === 'ready' ? Object.keys(scheduledKeys).length : '—'}</strong>
          <div className={styles.statusLabel}>Scheduled</div>
        </div>
        <div className={styles.statusItem}>
          <strong className={styles.statusValue}>{sessionStatus === 'ready' ? plan : '—'}</strong>
          <div className={styles.statusLabel}>Plan</div>
        </div>
      </section>

      <section aria-labelledby="advanced-tools-heading">
        <h2 id="advanced-tools-heading" className={styles.toolsHeading}>Advanced Tools</h2>
        <div className={styles.toolsGrid}>
          {advancedTools.map(({ label, href, icon }) => (
            <Link key={href} href={href} className={styles.toolCard}>
              {icon && <span aria-hidden="true" className={styles.toolIcon}>{icon}</span>}
              <span className={styles.toolName}>{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
