'use client'
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import Link from 'next/link'

export default function ClientTools(){
  const [tier, setTier] = useState('free')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          const uid = session?.user?.id
          if (uid) {
            const { data } = await supabase.from('profiles').select('plan_tier').eq('id', uid).maybeSingle()
            if (!cancelled && data?.plan_tier) setTier((data.plan_tier || 'free').toLowerCase())
          }
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const ent = featuresForTier(tier)
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Tools</h1>
      {loading ? (
        <p>Loading…</p>
      ) : !ent.facilitatorTools ? (
        <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:16, background:'#fff' }}>
          <h3 style={{ marginTop:0 }}>Premium required</h3>
          <p style={{ color:'#555' }}>Upgrade to Premium to use Facilitator Tools like Lesson Maker and Generated Lessons.</p>
          <Link href="/facilitator/plan" style={{ display:'inline-block', padding:'8px 12px', border:'1px solid #111', background:'#111', color:'#fff', borderRadius:8, fontWeight:600 }}>View Plans</Link>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:12 }}>
          <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:16, background:'#fff' }}>
            <h3 style={{ marginTop:0 }}>Lesson Maker</h3>
            <p style={{ color:'#555' }}>Use AI to draft a lesson aligned to your grade, subject, and difficulty. Saved under Facilitator Lessons.</p>
            <Link href="/facilitator/tools/lesson-maker" style={{ display:'inline-block', padding:'8px 12px', border:'1px solid #111', background:'#111', color:'#fff', borderRadius:8, fontWeight:600 }}>Open Lesson Maker</Link>
          </div>
          <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:16, background:'#fff' }}>
            <h3 style={{ marginTop:0 }}>Generated Lessons</h3>
            <p style={{ color:'#555' }}>Review, preview, and delete lessons you generated.</p>
            <Link href="/facilitator/tools/generated" style={{ display:'inline-block', padding:'8px 12px', border:'1px solid #111', background:'#111', color:'#fff', borderRadius:8, fontWeight:600 }}>Open Manager</Link>
          </div>
        </div>
      )}
    </main>
  )
}
