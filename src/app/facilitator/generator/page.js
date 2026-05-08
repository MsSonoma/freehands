'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import GatedOverlay from '@/app/components/GatedOverlay'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import Toast from '@/components/Toast'
import { validateLessonQuality, buildValidationChangeRequest } from '@/app/lib/lessonValidation'
import AIRewriteButton from '@/components/AIRewriteButton'
import { useFacilitatorSubjects } from '@/app/hooks/useFacilitatorSubjects'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import OnboardingBanner from '@/app/components/OnboardingBanner'
import { useOnboarding } from '@/app/hooks/useOnboarding'

const difficulties = ['beginner','intermediate','advanced']
const grades = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

export default function LessonMakerPage(){
  const router = useRouter()
  // Read ?onboarding=1 and ?grade=X client-side to avoid Suspense boundary requirement
  const [isOnboardingParam, setIsOnboardingParam] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      const params = new URLSearchParams(window.location.search)
      setIsOnboardingParam(params.get('onboarding') === '1')
      const gradeParam = params.get('grade')
      if (gradeParam) {
        setForm(f => ({ ...f, grade: gradeParam }))
      }
    }
  }, [])
  const { step, advanceStep, STEPS } = useOnboarding()
  const showOnboarding = isOnboardingParam || step === STEPS.GENERATE_LESSON
  const { loading, hasAccess, gateType, tier, isAuthenticated } = useAccessControl({
    requiredAuth: 'required',
     requiredFeature: 'lessonGenerator'
  })
  const { subjectsWithoutGenerated: subjects } = useFacilitatorSubjects()
  const [pinChecked, setPinChecked] = useState(false)
  const [form, setForm] = useState({
    grade:'', difficulty:'intermediate', subject:'math', title:'', description:'', notes:'', vocab:''
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [quotaInfo, setQuotaInfo] = useState(null)
  const [quotaLoading, setQuotaLoading] = useState(true)
  const [toast, setToast] = useState(null) // { message, type }
  const [generatedLessonKey, setGeneratedLessonKey] = useState(null) // Track last generated lesson
  const [learners, setLearners] = useState([])
  const [makeActiveFor, setMakeActiveFor] = useState('none')

  // AI Rewrite loading states
  const [rewritingTitle, setRewritingTitle] = useState(false)
  const [rewritingDescription, setRewritingDescription] = useState(false)
  const [rewritingVocab, setRewritingVocab] = useState(false)
  const [rewritingNotes, setRewritingNotes] = useState(false)

  // The quota API uses the service role key, immune to client-side RLS issues.
  // Use its plan_tier as the authoritative tier; fall back to useAccessControl's if higher.
  const TIER_RANK = { free: 0, trial: 1, standard: 2, pro: 3, lifetime: 4 }
  const effectiveTier = useMemo(() => {
    if (quotaLoading || !quotaInfo?.plan_tier) return tier
    const qRank = TIER_RANK[quotaInfo.plan_tier] ?? 0
    const cRank = TIER_RANK[tier] ?? 0
    return qRank > cRank ? quotaInfo.plan_tier : tier
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotaLoading, quotaInfo, tier])

  const ent = featuresForTier(effectiveTier)

  // hasAccess may be false when the client-side profiles query is blocked by RLS.
  // If the quota API (service role) confirms lessonGenerator entitlement, honour that.
  const resolvedHasAccess = hasAccess || (!quotaLoading && ent.lessonGenerator)

  const quotaAllowed = useMemo(() => {
    if (!quotaInfo) return true
    if (typeof quotaInfo.allowed === 'boolean') return quotaInfo.allowed
    // -1 = unlimited sentinel
    if (quotaInfo.remaining === -1 || quotaInfo.limit === -1) return true
    if (typeof quotaInfo.remaining === 'number') return quotaInfo.remaining > 0
    if (typeof quotaInfo.limit === 'number' && typeof quotaInfo.count === 'number') {
      return quotaInfo.count < quotaInfo.limit
    }
    return true
  }, [quotaInfo])

  // Check PIN requirement on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page');
        if (!allowed) {
          router.push('/');
          return;
        }
        if (!cancelled) setPinChecked(true);
      } catch (e) {
        if (!cancelled) setPinChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Load quota info — check session directly, NOT via isAuthenticated from useAccessControl.
  // useAccessControl resets isAuthenticated=false in its catch block (e.g. on RLS errors),
  // which would prevent this effect from ever running. We go to Supabase directly instead.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        if (!token) {
          if (!cancelled) setQuotaLoading(false)
          return
        }

        const res = await fetch('/api/lessons/quota', {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (res.ok && !cancelled) {
          const data = await res.json()
          setQuotaInfo(data)
        }
      } catch (e) {
        // Silent — leave quotaInfo null, quotaAllowed defaults to true
      } finally {
        if (!cancelled) setQuotaLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Load learners for "Make Active for" dropdown
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listLearners()
        if (!cancelled) setLearners(list || [])
      } catch {
        // Silent — dropdown just stays empty
      }
    })()
    return () => { cancelled = true }
  }, [])

  // AI Rewrite handlers
  const handleRewriteTitle = async () => {
    if (!form.title.trim()) return
    setRewritingTitle(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: form.title,
          context: `${form.subject} lesson for grade ${form.grade}`,
          purpose: 'lesson-title'
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.rewritten) {
          setForm(f => ({ ...f, title: data.rewritten }))
        }
      }
    } catch (err) {
      // Silent error handling
    } finally {
      setRewritingTitle(false)
    }
  }

  const handleRewriteDescription = async () => {
    if (!form.description.trim()) return
    setRewritingDescription(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: form.description,
          purpose: 'lesson-description'
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.rewritten) {
          setForm(f => ({ ...f, description: data.rewritten }))
        }
      }
    } catch (err) {
      // Silent error handling
    } finally {
      setRewritingDescription(false)
    }
  }

  const handleRewriteVocab = async () => {
    if (!form.vocab.trim()) return
    setRewritingVocab(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: form.vocab,
          context: form.title || 'vocabulary terms',
          purpose: 'vocabulary-terms'
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.rewritten) {
          setForm(f => ({ ...f, vocab: data.rewritten }))
        }
      }
    } catch (err) {
      // Silent error handling
    } finally {
      setRewritingVocab(false)
    }
  }

  const handleRewriteNotes = async () => {
    if (!form.notes.trim()) return
    setRewritingNotes(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: form.notes,
          context: form.title || 'additional notes',
          purpose: 'lesson-notes'
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.rewritten) {
          setForm(f => ({ ...f, notes: data.rewritten }))
        }
      }
    } catch (err) {
      // Silent error handling
    } finally {
      setRewritingNotes(false)
    }
  }

  async function handleGenerate(e){
    e.preventDefault()
     if (!ent.lessonGenerator) {
       setMessage('Upgrade required to generate lessons.')
       return
     }
    
    // Check quota before generating
    if (quotaInfo && !quotaAllowed) {
      setMessage('Generation limit reached. Upgrade to increase your quota.')
      return
    }
    
    setBusy(true); setMessage(''); setToast(null)
    setGeneratedLessonKey(null) // Reset previous lesson
    let generatedFile = null
    let generatedUserId = null
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      // STEP 1: Generate the lesson
      setToast({ message: 'Generating lesson...', type: 'info' })
      const res = await fetch('/api/facilitator/lessons/generate', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
        body: JSON.stringify(form)
      })
      const js = await res.json().catch(()=>null)
      if (!res.ok) { 
        setMessage(`Error ${res.status}: ${js?.error || 'Failed to generate'}`)
        setToast({ message: 'Generation failed', type: 'error' })
        return
      }

      generatedFile = js?.file
      generatedUserId = js?.userId
      if (js?.lessonKey) {
        setGeneratedLessonKey(js.lessonKey)
      } else if (generatedFile) {
        setGeneratedLessonKey(`generated/${generatedFile}`)
      }

      // STEP 2: Validate lesson quality
      setToast({ message: 'Validating lesson quality...', type: 'info' })
      const validation = validateLessonQuality(js?.lesson)
      if (validation?.issues?.length) {
        setToast({ message: 'Improving lesson quality...', type: 'info' })

        const changes = buildValidationChangeRequest(validation.issues)
        const fixRes = await fetch('/api/facilitator/lessons/request-changes', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
          body: JSON.stringify({
            file: generatedFile,
            userId: generatedUserId,
            changeRequest: changes
          })
        })
        const fixJs = await fixRes.json().catch(()=>null)
        if (!fixRes.ok) {
          setMessage(fixJs?.error || 'Lesson generated, but quality improvements failed')
          setToast({ message: 'Lesson generated with warnings', type: 'error' })
          return
        }
      }

      setToast({ message: 'Lesson ready!', type: 'success' })
      setMessage('')

      // Activate for selected learner(s) — run regardless of onboarding so we don't skip it
      const lessonKeyToActivate = js?.lessonKey || (generatedFile ? `generated/${generatedFile}` : null)
      const didActivate = lessonKeyToActivate && makeActiveFor !== 'none'
      if (didActivate) {
        try {
          const supabase = getSupabaseClient()
          const targetIds = makeActiveFor === 'all'
            ? learners.map(l => l.id)
            : [makeActiveFor]
          await Promise.all(targetIds.map(async (lid) => {
            const { data: row } = await supabase
              .from('learners')
              .select('approved_lessons')
              .eq('id', lid)
              .maybeSingle()
            const current = row?.approved_lessons || {}
            await supabase
              .from('learners')
              .update({ approved_lessons: { ...current, [lessonKeyToActivate]: true } })
              .eq('id', lid)
          }))
        } catch {
          // Silent — generation succeeded; activation failure is non-critical
        }
      }

      // If in onboarding flow, advance wizard and navigate
      if (showOnboarding) {
        // If the user already activated the lesson here, skip straight to calendar tour step
        const nextStep = didActivate ? STEPS.CALENDAR_TOUR : STEPS.ACTIVATE_LESSON
        const nextPath = didActivate ? '/facilitator/calendar?onboarding=1' : '/facilitator/lessons?onboarding=1'
        await advanceStep(nextStep)
        router.push(nextPath)
        return
      }
    } catch (err) {
      setMessage(`Generation error: ${err?.message || String(err) || 'Unknown error'}`)
      setToast({ message: 'Generation failed', type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const showGate = (!loading && !quotaLoading && (!resolvedHasAccess || !ent.lessonGenerator))

  const canGenerate = useMemo(() => {
    if (busy) return false
    if (!resolvedHasAccess || !ent.lessonGenerator) return false
    if (!form.grade || !form.title || !form.subject || !form.difficulty) return false
    if (quotaInfo && !quotaAllowed) return false
    return true
  }, [busy, form, quotaInfo, resolvedHasAccess, ent.lessonGenerator, quotaAllowed])

  if (loading || !pinChecked) {
    return (
      <main style={{ padding: 24, minHeight: '60vh' }}>
        <p style={{ color: '#6b7280' }}>Loading...</p>
      </main>
    )
  }

  return (
    <>
    <main style={{ padding: '24px 24px 48px', maxWidth: 860, margin: '0 auto' }}>
      {showOnboarding && (
        <OnboardingBanner
          step={2}
          title="Generate your first lesson"
          message="Fill in the subject, grade, and topic below. Ms. Sonoma will write a complete lesson with questions for each phase. You can edit it afterward."
        />
      )}

      {/* ── Header banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 50%, #faf5ff 100%)',
        border: '1px solid #e0e7ff',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>✨</span>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.01em' }}>
              Lesson Generator
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 36px', fontSize: 13, color: '#6366f1', fontWeight: 500 }}>
            AI-powered lessons, built in seconds
          </p>
        </div>
        <button
          onClick={() => router.push('/facilitator/lessons')}
          style={{
            padding: '9px 16px',
            borderRadius: 8,
            border: '1px solid #c7d2fe',
            background: '#fff',
            color: '#4338ca',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
            whiteSpace: 'nowrap',
          }}
        >
          ← Back to Lessons
        </button>
      </div>

      {toast && (
        <div style={{ marginBottom: 16 }}>
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}

      <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Card: Lesson Setup ── */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            padding: '11px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>🎓</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#374151', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Lesson Setup
            </span>
          </div>
          <div style={{
            padding: '18px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
          }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Grade <span style={{ color: '#ef4444' }}>*</span></span>
              <select
                value={form.grade}
                onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#f9fafb', color: '#111827' }}
                required
              >
                <option value="">Select grade</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Difficulty <span style={{ color: '#ef4444' }}>*</span></span>
              <select
                value={form.difficulty}
                onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#f9fafb', color: '#111827' }}
                required
              >
                {difficulties.map(d => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Subject <span style={{ color: '#ef4444' }}>*</span></span>
              <select
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#f9fafb', color: '#111827' }}
                required
              >
                {subjects.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ── Card: Lesson Content ── */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            padding: '11px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>📝</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#374151', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Lesson Content
            </span>
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
                Title <span style={{ color: '#ef4444' }}>*</span>
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#f9fafb', color: '#111827' }}
                  placeholder="e.g., Fractions: Adding Like Denominators"
                  required
                />
                <AIRewriteButton text={form.title} onRewrite={handleRewriteTitle} loading={rewritingTitle} />
              </div>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Description</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, minHeight: 88, fontSize: 14, background: '#f9fafb', color: '#111827', resize: 'vertical' }}
                  placeholder="What should the learner learn?"
                />
                <AIRewriteButton text={form.description} onRewrite={handleRewriteDescription} loading={rewritingDescription} />
              </div>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Teaching Notes</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, minHeight: 108, fontSize: 14, background: '#f9fafb', color: '#111827', resize: 'vertical' }}
                  placeholder="Facilitator notes, examples, reminders..."
                />
                <AIRewriteButton text={form.notes} onRewrite={handleRewriteNotes} loading={rewritingNotes} />
              </div>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
                Vocabulary
                <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6, fontSize: 12 }}>(optional)</span>
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea
                  value={form.vocab}
                  onChange={e => setForm(f => ({ ...f, vocab: e.target.value }))}
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, minHeight: 80, fontSize: 14, background: '#f9fafb', color: '#111827', resize: 'vertical' }}
                  placeholder="Comma-separated terms, or term: definition pairs"
                />
                <AIRewriteButton text={form.vocab} onRewrite={handleRewriteVocab} loading={rewritingVocab} />
              </div>
            </label>
          </div>
        </div>

        {/* ── Card: Generate ── */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {learners.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>Make Active for</span>
                <select
                  value={makeActiveFor}
                  onChange={e => setMakeActiveFor(e.target.value)}
                  style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#f9fafb', color: '#111827' }}
                >
                  <option value="none">None</option>
                  {learners.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                  <option value="all">All learners</option>
                </select>
              </label>
            )}

            {quotaLoading ? (
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Checking quota...</span>
            ) : quotaInfo ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 11px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: quotaAllowed ? '#f0fdf4' : '#fef3c7',
                color: quotaAllowed ? '#166534' : '#92400e',
                border: `1px solid ${quotaAllowed ? '#bbf7d0' : '#fde68a'}`,
              }}>
                {quotaAllowed
                  ? (quotaInfo.remaining === -1 ? '∞ Unlimited' : `${quotaInfo.remaining} left today`)
                  : '⚠ Limit reached'}
              </span>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type={generatedLessonKey ? 'button' : 'submit'}
              disabled={generatedLessonKey ? false : !canGenerate}
              onClick={generatedLessonKey ? () => router.push(`/facilitator/lessons/edit?key=${encodeURIComponent(generatedLessonKey)}`) : undefined}
              style={{
                padding: '12px 28px',
                borderRadius: 10,
                border: 'none',
                background: generatedLessonKey
                  ? 'linear-gradient(135deg, #059669, #10b981)'
                  : (canGenerate
                    ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                    : '#c4b5fd'),
                color: '#fff',
                cursor: (generatedLessonKey || canGenerate) ? 'pointer' : 'not-allowed',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '0.01em',
                boxShadow: (generatedLessonKey || canGenerate) ? '0 2px 10px rgba(99,102,241,0.25)' : 'none',
              }}
            >
              {busy
                ? '⏳ Generating…'
                : generatedLessonKey
                  ? '✏️ Open Lesson Editor'
                  : '✨ Generate Lesson'}
            </button>

            {generatedLessonKey && (
              <button
                type="button"
                onClick={() => {
                  setGeneratedLessonKey(null)
                  setForm({ grade: '', difficulty: 'intermediate', subject: 'math', title: '', description: '', notes: '', vocab: '' })
                  setMessage('')
                  setToast(null)
                  setMakeActiveFor('none')
                }}
                style={{
                  background: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '8px 14px',
                }}
              >
                + New Lesson
              </button>
            )}
          </div>

          {message && (
            <div style={{
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#b91c1c',
              fontSize: 13,
              fontWeight: 600,
            }}>
              {message}
            </div>
          )}
        </div>
      </form>

      {/* ── Planner promo card ── */}
      <div
        onClick={() => router.push('/facilitator/calendar')}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && router.push('/facilitator/calendar')}
        style={{
          marginTop: 20,
          padding: '16px 22px',
          border: '1px solid #bfdbfe',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          boxShadow: '0 1px 4px rgba(59,130,246,0.07)',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e40af', marginBottom: 3 }}>
            📅 Want to generate whole weeks of lessons at once?
          </div>
          <div style={{ fontSize: 13, color: '#4b5563' }}>
            The Lesson Planner builds a full curriculum calendar for you — automatically.
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>
          Open Planner →
        </div>
      </div>
    </main>

    <GatedOverlay
      show={showGate}
      gateType={gateType}
      requiredTier="standard"
      currentTier={tier}
      feature="Lesson Generator"
      benefits={["Generate custom lessons instantly","Edit and assign lessons", "Build a full curriculum over time"]}
      emoji="✨"
    />
    </>
  )
}
