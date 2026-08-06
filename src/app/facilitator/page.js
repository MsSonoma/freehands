'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import { normalizeApprovedLessons, resolveFacilitatorHomeDecision } from '@/app/lib/facilitatorHome.mjs'
import { readPreparationSnapshot } from './prepare/preparationSnapshot'

const PREPARE_PATH = '/facilitator/prepare'

export default function FacilitatorPage() {
  const router = useRouter()
  const [pinChecked, setPinChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [facilitatorName, setFacilitatorName] = useState('')
  const [plan, setPlan] = useState('free')
  const [learners, setLearners] = useState([])
  const [generatedLessons, setGeneratedLessons] = useState([])
  const [scheduledKeys, setScheduledKeys] = useState({})
  const [preparationSnapshot, setPreparationSnapshot] = useState(null)
  const [loadError, setLoadError] = useState('')

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
        const supabase = getSupabaseClient()
        const { data: { session: authSession } } = await supabase.auth.getSession()
        if (cancelled) return
        setSession(authSession || null)

        const token = authSession?.access_token
        if (authSession?.user) {
          const meta = authSession.user.user_metadata || {}
          setFacilitatorName((meta.full_name || meta.display_name || meta.name || '').trim())

          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, subscription_tier, plan_tier')
              .eq('id', authSession.user.id)
              .maybeSingle()
            if (!cancelled) {
              if (profile?.full_name) setFacilitatorName(profile.full_name)
              setPlan((profile?.plan_tier || profile?.subscription_tier || 'free').toString().toLowerCase())
            }
          } catch {}
        }

        const learnerList = await listLearners()
        if (cancelled) return
        setLearners(learnerList || [])
        setPreparationSnapshot(readPreparationSnapshot())

        if (token) {
          const lessonsResponse = await fetch('/api/facilitator/lessons/list', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
          })
          if (lessonsResponse.ok) {
            const lessons = await lessonsResponse.json().catch(() => [])
            if (!cancelled) setGeneratedLessons(Array.isArray(lessons) ? lessons : [])
          }

          const scheduleEntries = {}
          const today = new Date().toISOString().slice(0, 10)
          const future = new Date()
          future.setFullYear(future.getFullYear() + 1)
          await Promise.all((learnerList || []).map(async (learner) => {
            try {
              const response = await fetch(`/api/lesson-schedule?learnerId=${encodeURIComponent(learner.id)}&startDate=${today}&endDate=${future.toISOString().slice(0, 10)}&includeAll=1`, {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
              })
              if (!response.ok) return
              const json = await response.json().catch(() => ({}))
              for (const row of json.schedule || []) {
                if (row?.lesson_key) scheduleEntries[row.lesson_key] = row.scheduled_date || true
              }
            } catch {}
          }))
          if (!cancelled) setScheduledKeys(scheduleEntries)
        }

      } catch (error) {
        if (!cancelled) setLoadError(error?.message || 'Could not load facilitator home')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [pinChecked])

  const decision = useMemo(() => {
    return resolveFacilitatorHomeDecision({ learners, generatedLessons, scheduledKeys, preparationSnapshot, preparePath: PREPARE_PATH })
  }, [generatedLessons, learners, preparationSnapshot, scheduledKeys])

  if (!pinChecked || loading) {
    return <main style={{ padding: '12px 24px' }}><p style={{ color: '#6b7280' }}>Loading...</p></main>
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

      {loadError && <div style={{ marginBottom: 14, padding: 12, border: '1px solid #f0c9c0', borderRadius: 8, background: '#fff7f5', color: '#7f1d1d' }}>{loadError}</div>}

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ color: 'rgb(199, 68, 46)', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Primary decision</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>{decision.title}</h2>
            <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.5 }}>{decision.body}</p>
          </div>
          <Link href={decision.href} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 150, padding: '11px 16px', borderRadius: 8, border: '1px solid rgb(199, 68, 46)', background: 'rgb(199, 68, 46)', color: '#fff', fontWeight: 800, textDecoration: 'none' }}>
            {decision.label}
          </Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <strong>{learners.length}</strong>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Learners</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <strong>{generatedLessons.filter((lesson) => lesson.approved === true).length}</strong>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Approved lessons</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <strong>{Object.keys(scheduledKeys).length}</strong>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Scheduled</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <strong>{session ? plan : 'guest'}</strong>
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