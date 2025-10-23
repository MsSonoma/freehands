'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import GatedOverlay from '@/app/components/GatedOverlay'
import { useAccessControl } from '@/app/hooks/useAccessControl'


const subjects = ['math','language arts','science','social studies']
const difficulties = ['beginner','intermediate','advanced']

export default function LessonMakerPage(){
  const router = useRouter()
  const { loading, hasAccess, gateType, tier, isAuthenticated } = useAccessControl({
    requiredAuth: 'required',
    requiredFeature: 'facilitatorTools'
  })
  const [form, setForm] = useState({
    grade:'', difficulty:'intermediate', subject:'math', title:'', description:'', notes:'', vocab:''
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [quotaInfo, setQuotaInfo] = useState(null)
  const [quotaLoading, setQuotaLoading] = useState(true)

  const ent = featuresForTier(tier)

  // Check generation quota on mount
  useEffect(() => {
    if (!isAuthenticated || !hasAccess) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) return
        
        const res = await fetch('/api/usage/check-generation-quota', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!cancelled) {
          setQuotaInfo(data)
          setQuotaLoading(false)
        }
      } catch (e) {
        console.error('Failed to check generation quota:', e)
        if (!cancelled) setQuotaLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, hasAccess])

  async function handleGenerate(e){
    e.preventDefault()
    if (!ent.facilitatorTools) { router.push('/facilitator/plan'); return }
    
    // Check quota before generating
    if (quotaInfo && !quotaInfo.allowed) {
      setMessage('Generation limit reached. Upgrade to increase your quota.')
      return
    }
    
    setBusy(true); setMessage('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/facilitator/lessons/generate', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
        body: JSON.stringify(form)
      })
      const js = await res.json().catch(()=>null)
      if (!res.ok) { setMessage(js?.error || 'Failed to generate'); return }
      
      // Increment usage counter after successful generation
      try {
        await fetch('/api/usage/increment-generation', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
        // Refresh quota info
        const quotaRes = await fetch('/api/usage/check-generation-quota', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const quotaData = await quotaRes.json()
        setQuotaInfo(quotaData)
      } catch (e) {
        console.error('Failed to update generation quota:', e)
      }
      
      // Show success message
      if (js?.storageUrl) {
        setMessage(`Lesson generated and saved to cloud storage: ${js.file}`)
      } else if (js?.storageError) {
        setMessage(`Lesson generated but storage failed: ${js.storageError}. Downloading lesson file...`)
        // Trigger download as backup
        const blob = new Blob([JSON.stringify(js.lesson, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = js.file || 'lesson.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else if (js?.lesson) {
        setMessage(`Lesson generated successfully.`)
        // Trigger download as backup
        const blob = new Blob([JSON.stringify(js.lesson, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = js.file || 'lesson.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        setMessage('Lesson generated: ' + (js?.file || ''))
      }
    } catch (e) {
      setMessage('Error: ' + (e?.message || String(e)))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <main style={{ padding:24 }}><p>Loading…</p></main>

  const label = { display:'block', fontWeight:600, margin:'12px 0 4px' }
  const input = { width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:8 }
  const btn = { display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'10px 12px', border:'1px solid #111', background:'#111', color:'#fff', borderRadius:8, fontWeight:600 }

  return (
    <main style={{ padding:24, maxWidth:720, margin:'0 auto', position: 'relative' }}>
      <h1 style={{ marginTop:0 }}>Lesson Maker</h1>
      
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

        <label style={label}>Subject</label>
        <select style={input} value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}>
          {subjects.map(s=> <option key={s} value={s}>{s}</option>)}
        </select>

        <label style={label}>Difficulty</label>
        <select style={input} value={form.difficulty} onChange={e=>setForm(f=>({...f,difficulty:e.target.value}))}>
          {difficulties.map(d=> <option key={d} value={d}>{d}</option>)}
        </select>

        <label style={label}>Grade</label>
        <input style={input} required value={form.grade} onChange={e=>setForm(f=>({...f,grade:e.target.value}))} placeholder="e.g., 3rd" />

        <label style={label}>Short Description</label>
        <textarea style={{...input, minHeight:80}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What this lesson covers and the key skills." />

        <label style={label}>Vocabulary Terms (optional)</label>
        <textarea style={{...input, minHeight:80}} value={form.vocab} onChange={e=>setForm(f=>({...f,vocab:e.target.value}))} placeholder="Enter vocabulary terms, one per line or comma-separated." />

        <label style={label}>Additional Notes (optional)</label>
        <textarea style={{...input, minHeight:80}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Constraints, examples to include, or standards." />

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
        </div>
      </form>
      {message && <p style={{ marginTop:12 }}>{message}</p>}
      
      <div style={{ marginTop:24, paddingTop:24, borderTop:'1px solid #e5e7eb' }}>
        <a href="/facilitator/tools/generated" style={{ ...btn, textDecoration:'none', background:'#374151', borderColor:'#374151' }}>
          View Generated Lessons
        </a>
      </div>

      {/* Gated Overlay */}
      <GatedOverlay
        show={!hasAccess}
        gateType={gateType}
        feature="Lesson Maker"
        emoji="🎨"
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
