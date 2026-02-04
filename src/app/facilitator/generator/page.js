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

const difficulties = ['beginner','intermediate','advanced']
const grades = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

export default function LessonMakerPage(){
  const router = useRouter()
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
  
  // AI Rewrite loading states
  const [rewritingTitle, setRewritingTitle] = useState(false)
  const [rewritingDescription, setRewritingDescription] = useState(false)
  const [rewritingVocab, setRewritingVocab] = useState(false)
  const [rewritingNotes, setRewritingNotes] = useState(false)

  const ent = featuresForTier(tier)

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

  // Load quota info
  useEffect(() => {
    if (!isAuthenticated || !hasAccess) {
      setQuotaLoading(false)
      return
    }
    
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        
        const res = await fetch('/api/lessons/quota', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        
        if (res.ok && !cancelled) {
          const data = await res.json()
          setQuotaInfo(data)
        }
      } catch (e) {
        // Silent error
      } finally {
        if (!cancelled) setQuotaLoading(false)
      }
    })()
    
    return () => { cancelled = true }
  }, [isAuthenticated, hasAccess])

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
    if (quotaInfo && !quotaInfo.allowed) {
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
        setMessage(js?.error || 'Failed to generate')
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

        const changes = buildValidationChangeRequest(validation)
        const fixRes = await fetch('/api/facilitator/lessons/request-changes', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
          body: JSON.stringify({
            file: generatedFile,
            userId: generatedUserId,
            changes
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
    } catch (err) {
      setMessage(err?.message || 'Failed to generate')
      setToast({ message: 'Generation failed', type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const showGate = (!loading && (!hasAccess || !ent.lessonGenerator))

  const canGenerate = useMemo(() => {
    if (busy) return false
    if (!hasAccess || !ent.lessonGenerator) return false
    if (!form.grade || !form.title || !form.subject || !form.difficulty) return false
    if (quotaInfo && !quotaInfo.allowed) return false
    return true
  }, [busy, form, quotaInfo, hasAccess, ent.lessonGenerator])

  if (loading || !pinChecked) {
    return <main style={{ padding: 24 }}><p>Loading...</p></main>
  }

  return (
    <>
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Lesson Maker</h1>
          <p style={{ marginTop: 0, color: '#6b7280' }}>
            Generate a lesson, then edit it in the lesson editor.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {generatedLessonKey && (
            <button
              onClick={() => router.push(`/facilitator/lessons/edit?key=${encodeURIComponent(generatedLessonKey)}`)}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ✏️ Edit This Lesson
            </button>
          )}
          <button
            onClick={() => router.push('/facilitator/lessons')}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            ← Back to Lessons
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ marginTop: 12 }}>
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}

      <form onSubmit={handleGenerate} style={{ marginTop: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Grade</span>
            <select
              value={form.grade}
              onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
              style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}
              required
            >
              <option value="">Select grade</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Difficulty</span>
            <select
              value={form.difficulty}
              onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
              style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}
              required
            >
              {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Subject</span>
            <select
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}
              required
            >
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Title</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}
                placeholder="e.g., Fractions: Adding Like Denominators"
                required
              />
              <AIRewriteButton
                onRewrite={handleRewriteTitle}
                rewriting={rewritingTitle}
                compact
              />
            </div>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Description</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, minHeight: 90 }}
                placeholder="What should the learner learn?"
              />
              <AIRewriteButton
                onRewrite={handleRewriteDescription}
                rewriting={rewritingDescription}
                compact
              />
            </div>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Teaching Notes</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, minHeight: 110 }}
                placeholder="Facilitator notes, examples, reminders..."
              />
              <AIRewriteButton
                onRewrite={handleRewriteNotes}
                rewriting={rewritingNotes}
                compact
              />
            </div>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Vocabulary (optional)</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea
                value={form.vocab}
                onChange={e => setForm(f => ({ ...f, vocab: e.target.value }))}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, minHeight: 80 }}
                placeholder="Comma-separated terms, or term: definition pairs"
              />
              <AIRewriteButton
                onRewrite={handleRewriteVocab}
                rewriting={rewritingVocab}
                compact
              />
            </div>
          </label>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={!canGenerate}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #3b82f6',
              background: canGenerate ? '#3b82f6' : '#93c5fd',
              color: '#fff',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              fontWeight: 700
            }}
          >
            ✨ Generate Lesson
          </button>

          {quotaLoading ? (
            <span style={{ color: '#6b7280', fontSize: 13 }}>Checking quota...</span>
          ) : quotaInfo ? (
            <span style={{ color: quotaInfo.allowed ? '#6b7280' : '#b45309', fontSize: 13 }}>
              {quotaInfo.allowed
                ? `Generations remaining today: ${quotaInfo.remaining}`
                : 'Generation limit reached for today'}
            </span>
          ) : null}
        </div>

        {message && (
          <div style={{ marginTop: 12, color: '#b91c1c', fontWeight: 600 }}>
            {message}
          </div>
        )}
      </form>
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
