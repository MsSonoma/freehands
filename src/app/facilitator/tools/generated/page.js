'use client'
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'


export default function GeneratedLessonsPage(){
  const [tier, setTier] = useState('free')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function refresh(){
    setLoading(true)
    try {
      const res = await fetch('/api/facilitator/lessons/list', { cache:'no-store' })
      const js = await res.json().catch(()=>[])
      setItems(Array.isArray(js) ? js : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data } = await supabase.from('profiles').select('plan_tier').eq('id', session.user.id).maybeSingle()
          if (!cancelled && data?.plan_tier) setTier((data.plan_tier || 'free').toLowerCase())
        }
      } catch {}
      if (!cancelled) await refresh()
    })()
    return () => { cancelled = true }
  }, [])

  const ent = featuresForTier(tier)
  const card = { border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff' }
  const btn = { display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'8px 10px', border:'1px solid #111', background:'#111', color:'#fff', borderRadius:8, fontWeight:600 }
  const btnDanger = { ...btn, background:'#b91c1c', borderColor:'#b91c1c' }

  async function handleDelete(file){
    if (!confirm('Delete this lesson?')) return
    setBusy(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/facilitator/lessons/delete', {
        method:'POST', headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
        body: JSON.stringify({ file })
      })
      if (!res.ok) {
        const js = await res.json().catch(()=>null)
        setError(js?.error || 'Delete failed')
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ padding:24, maxWidth:900, margin:'0 auto' }}>
      <h1 style={{ marginTop:0 }}>Generated Lessons</h1>
      {!ent.facilitatorTools ? (
        <p>Premium required. <a href="/facilitator/plan">View plans</a>.</p>
      ) : loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No generated lessons yet. Use Lesson Maker to create one.</p>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
          {items.map(it => (
            <div key={it.file} style={card}>
              <h3 style={{ margin:'0 0 4px' }}>{it.title || it.file}</h3>
              <p style={{ margin:'0 0 8px', color:'#555' }}>Grade: {it.grade || '—'} · {it.difficulty || '—'}</p>
              <div style={{ display:'flex', gap:8 }}>
                <a style={btn} href={`/lessons/${encodeURIComponent('Facilitator Lessons')}/${encodeURIComponent(it.file)}`} target="_blank" rel="noreferrer">Preview JSON</a>
                <button style={btnDanger} disabled={busy} onClick={()=>handleDelete(it.file)}>
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p style={{ color:'#b91c1c', marginTop:12 }}>{error}</p>}
    </main>
  )
}
