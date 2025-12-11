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


const subjects = ['math','language arts','science','social studies','general']
const difficulties = ['beginner','intermediate','advanced']

export default function LessonMakerPage(){
  const router = useRouter()
  const { loading, hasAccess, gateType, tier, isAuthenticated } = useAccessControl({
    requiredAuth: 'required',
    requiredFeature: 'facilitatorTools'
  })
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

  // AI Rewrite handlers
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
          context: form.title || 'lesson description',
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
    if (!ent.facilitatorTools) { router.push('/facilitator/plan'); return }
    
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
      
      generatedFile = js.file
      generatedUserId = js.userId
      
      // STEP 2: Validate the lesson
      setToast({ message: 'Validating lesson quality...', type: 'info' })
      const validation = validateLessonQuality(js.lesson)
      
      if (!validation.passed && validation.issues.length > 0) {
        // STEP 3: Auto-fix with request-changes API
        setToast({ message: 'Improving lesson quality...', type: 'info' })
        
        try {
          const changeRequest = buildValidationChangeRequest(validation.issues)
          const fixRes = await fetch('/api/facilitator/lessons/request-changes', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              file: generatedFile,
              userId: generatedUserId,
              changeRequest: changeRequest
            })
          })
          
          const fixJs = await fixRes.json().catch(() => null)
          if (fixRes.ok) {
            setToast({ message: 'Lesson ready!', type: 'success' })
            setMessage(`Lesson generated, validated, and optimized: ${generatedFile}`)
          } else {
            setToast({ message: 'Lesson generated with quality warnings', type: 'warning' })
            setMessage(`Lesson generated: ${generatedFile}\n\nQuality issues detected:\n${validation.issues.join('\n')}`)
          }
        } catch (fixError) {
          setToast({ message: 'Lesson generated with quality warnings', type: 'warning' })
          setMessage(`Lesson generated: ${generatedFile}\n\nQuality issues detected:\n${validation.issues.join('\n')}`)
        }
      } else {
        // Passed validation on first try!
        setToast({ message: 'Lesson ready!', type: 'success' })
        
        // Show success message
        if (js?.storageUrl) {
          setMessage(`Lesson generated and saved to cloud storage: ${js.file}`)
        } else {
          setMessage(`Lesson generated successfully: ${js.file}`)
        }
      }
      
      // Store the generated lesson key for the edit button
      // Key format must be "generated/filename" to match lesson-file API expectations
      if (generatedFile) {
        setGeneratedLessonKey(`generated/${generatedFile}`)
      }
      
      // Handle storage errors (not blocking)
      if (js?.storageError) {
        setMessage(prev => prev + `\n\nNote: Storage warning: ${js.storageError}`)
      }
      
      // Notify lessons overlay to refresh
      window.dispatchEvent(new CustomEvent('mr-mentor:lesson-generated'))
      
    } catch (e) {
      setMessage('Error: ' + (e?.message || String(e)))
      setToast({ message: 'Error generating lesson', type: 'error' })
    } finally {
      setBusy(false)
      // Clear toast after 5 seconds if it's a success
      setTimeout(() => {
        setToast(prev => prev?.type === 'success' ? null : prev)
      }, 5000)
    }
  }

  if (loading) return <main style={{ padding:24 }}><p>Loading…</p></main>

  const label = { display:'block', fontWeight:600, margin:'12px 0 4px', color: '#374151' }
  const input = { width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:8 }
  const btn = { display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'10px 12px', border:'1px solid #3b82f6', background:'#3b82f6', color:'#fff', borderRadius:8, fontWeight:600 }

  return (
    <main style={{ padding:24, maxWidth:720, margin:'0 auto', position: 'relative' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <h1 style={{ marginTop:0 }}>Lesson Generator</h1>
      
      {/* Quota Info */}
      {!quotaLoading && quotaInfo && hasAccess && (
        <div style={{ 
          padding: '12px 16px', 
          marginBottom: 16, 
          borderRadius: 8, 
          background: quotaInfo.allowed ? '#f0f9ff' : '#fef2f2',
          border: `1px solid ${quotaInfo.allowed ? '#bfdbfe' : '#fecaca'}`
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {quotaInfo.source === 'lifetime' && `Lifetime Generations: ${quotaInfo.remaining} remaining`}
            {quotaInfo.source === 'weekly' && `Weekly Generations: ${quotaInfo.remaining} remaining (resets Sunday)`}
            {quotaInfo.source === 'unlimited' && 'Unlimited Generations'}
            {!quotaInfo.allowed && 'Generation Limit Reached'}
          </div>
          {!quotaInfo.allowed && (
            <div style={{ fontSize: 14, color: '#991b1b' }}>
              Upgrade your plan to generate more lessons
            </div>
          )}
        </div>
      )}
      
      <form onSubmit={handleGenerate} style={{ opacity: hasAccess ? 1 : 0.6, pointerEvents: hasAccess ? 'auto' : 'none' }}>
        <label style={label}>Lesson Title</label>
        <input style={input} required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g., Fractions on a Number Line" />

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Grade</label>
            <input style={input} required value={form.grade} onChange={e=>setForm(f=>({...f,grade:e.target.value}))} placeholder="e.g., 3rd" />
          </div>
          
          <div style={{ flex: 1 }}>
            <label style={label}>Difficulty</label>
            <select style={input} value={form.difficulty} onChange={e=>setForm(f=>({...f,difficulty:e.target.value}))}>
              {difficulties.map(d=> <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          
          <div style={{ flex: 1 }}>
            <label style={label}>Subject</label>
            <select style={input} value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}>
              {subjects.map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <label style={label}>Short Description</label>
        <textarea style={{...input, minHeight:80}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What this lesson covers and the key skills." />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <AIRewriteButton
            text={form.description}
            onRewrite={handleRewriteDescription}
            loading={rewritingDescription}
            size="small"
          />
        </div>

        <label style={label}>Vocabulary Terms (optional)</label>
        <textarea style={{...input, minHeight:80}} value={form.vocab} onChange={e=>setForm(f=>({...f,vocab:e.target.value}))} placeholder="Enter vocabulary terms, one per line or comma-separated." />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <AIRewriteButton
            text={form.vocab}
            onRewrite={handleRewriteVocab}
            loading={rewritingVocab}
            size="small"
          />
        </div>

        <label style={label}>Additional Notes (optional)</label>
        <textarea style={{...input, minHeight:80}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Constraints, examples to include, or standards." />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <AIRewriteButton
            text={form.notes}
            onRewrite={handleRewriteNotes}
            loading={rewritingNotes}
            size="small"
          />
        </div>

        <div style={{ marginTop:12 }}>
          <button 
            style={{
              ...btn, 
              opacity: (quotaInfo && !quotaInfo.allowed) ? 0.5 : 1,
              cursor: (quotaInfo && !quotaInfo.allowed) ? 'not-allowed' : 'pointer'
            }} 
            disabled={busy || (quotaInfo && !quotaInfo.allowed)} 
            type="submit"
          >
            {busy ? 'Generating…' : 'Generate Lesson'}
          </button>
          
          {generatedLessonKey && (
            <button
              type="button"
              onClick={() => router.push(`/facilitator/lessons/edit?key=${encodeURIComponent(generatedLessonKey)}`)}
              style={{
                ...btn,
                marginLeft: 12,
                background: '#059669',
                borderColor: '#059669'
              }}
            >
              Edit This Lesson
            </button>
          )}
        </div>
      </form>
      {message && <p style={{ marginTop:12 }}>{message}</p>}
      
      <div style={{ marginTop:24, paddingTop:24, borderTop:'1px solid #e5e7eb' }}>
        <a href="/facilitator/lessons" style={{ ...btn, textDecoration:'none', background:'#6b7280', borderColor:'#6b7280' }}>
          View Lessons
        </a>
      </div>

      {/* Gated Overlay */}
      <GatedOverlay
        show={!hasAccess}
        gateType={gateType}
        feature="Lesson Maker"
        emoji="✨"
        description="Create custom AI-generated lessons tailored to your grade level, subject, and difficulty. Available exclusively to Premium subscribers."
        benefits={[
          'Custom vocabulary and definitions',
          'Teaching examples aligned to your standards',
          'Comprehension questions with answer checking',
          'Exercises, worksheets, and tests',
          'Saved automatically to your Facilitator Lessons'
        ]}
        currentTier={tier}
        requiredTier="premium"
      />
    </main>
  )
}
