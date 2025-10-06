'use client'
import { useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { useRouter } from 'next/navigation'


const subjects = ['math','language arts','science','social studies']
const difficulties = ['beginner','intermediate','advanced']

export default function LessonMakerPage(){
  const router = useRouter()
  const [tier, setTier] = useState('free')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    grade:'', difficulty:'intermediate', subject:'math', title:'', description:'', notes:'', vocab:''
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { router.push('/auth/login'); return }
        const { data } = await supabase.from('profiles').select('plan_tier').eq('id', session.user.id).maybeSingle()
        const t = (data?.plan_tier || 'free').toLowerCase()
        if (!cancelled) setTier(t)
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [router])

  const ent = featuresForTier(tier)

  async function handleGenerate(e){
    e.preventDefault()
    if (!ent.facilitatorTools) { router.push('/facilitator/plan'); return }
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
      
      // Show success message
      if (js?.storageUrl) {
        setMessage(`Lesson generated and saved to cloud storage: ${js.file}`)
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
  if (!ent.facilitatorTools) return (
    <main style={{ padding:24 }}>
      <h1>Lesson Maker</h1>
      <p>Premium required. <a href="/facilitator/plan">View plans</a>.</p>
    </main>
  )

  const label = { display:'block', fontWeight:600, margin:'12px 0 4px' }
  const input = { width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:8 }
  const btn = { display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'10px 12px', border:'1px solid #111', background:'#111', color:'#fff', borderRadius:8, fontWeight:600 }

  return (
    <main style={{ padding:24, maxWidth:720, margin:'0 auto' }}>
      <h1 style={{ marginTop:0 }}>Lesson Maker</h1>
      <form onSubmit={handleGenerate}>
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
          <button style={btn} disabled={busy} type="submit">{busy ? 'Generating…' : 'Generate Lesson'}</button>
        </div>
      </form>
      {message && <p style={{ marginTop:12 }}>{message}</p>}
      
      <div style={{ marginTop:24, paddingTop:24, borderTop:'1px solid #e5e7eb' }}>
        <a href="/facilitator/tools/generated" style={{ ...btn, textDecoration:'none', background:'#374151', borderColor:'#374151' }}>
          View Generated Lessons
        </a>
      </div>
    </main>
  )
}
