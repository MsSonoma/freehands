'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import Link from 'next/link'

export default function ClientTools(){
  const router = useRouter()
  const [tier, setTier] = useState('free')
  const [loading, setLoading] = useState(true)
  const [pinChecked, setPinChecked] = useState(false)

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
  }, [router])

  useEffect(() => {
    if (!pinChecked) return
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
  }, [pinChecked])

  if (!pinChecked) {
    return <main style={{ padding: 24 }}><p>Loading…</p></main>
  }

  const ent = featuresForTier(tier)
  const hasAccess = ent.facilitatorTools

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Tools</h1>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {!hasAccess && (
            <div style={{ 
              border:'2px solid #fbbf24', 
              borderRadius:12, 
              padding:16, 
              background:'#fffbeb',
              marginBottom: 24
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>✨</span>
                <h3 style={{ marginTop:0, marginBottom: 0, color: '#92400e' }}>Preview Mode - Upgrade to Use</h3>
              </div>
              <p style={{ color:'#78350f', marginBottom: 12 }}>
                You're viewing the Facilitator Tools. Upgrade to Premium to unlock Mr. Mentor, Lesson Generator, and more.
              </p>
              <Link 
                href="/facilitator/plan" 
                style={{ 
                  display:'inline-block', 
                  padding:'10px 20px', 
                  background:'#f59e0b', 
                  color:'#fff', 
                  borderRadius:8, 
                  fontWeight:600,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                }}
              >
                Upgrade to Premium
              </Link>
            </div>
          )}
          
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:12 }}>
            <div style={{ 
              border:'1px solid #e5e7eb', 
              borderRadius:12, 
              padding:16, 
              background:'#fff',
              position: 'relative',
              opacity: hasAccess ? 1 : 0.7
            }}>
              {!hasAccess && (
                <div style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: '#fbbf24',
                  color: '#78350f',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Premium
                </div>
              )}
              <h3 style={{ marginTop:0 }}>Mr. Mentor</h3>
              <p style={{ color:'#555' }}>Talk with an AI counselor who helps with teaching challenges, curriculum planning, and goal setting.</p>
              <Link 
                href="/facilitator/tools/counselor" 
                style={{ 
                  display:'inline-block', 
                  padding:'8px 12px', 
                  border:'1px solid #111', 
                  background:'#111', 
                  color:'#fff', 
                  borderRadius:8, 
                  fontWeight:600,
                  textDecoration: 'none'
                }}
              >
                {hasAccess ? 'Open Mr. Mentor' : 'Preview'}
              </Link>
            </div>
            
            <div style={{ 
              border:'1px solid #e5e7eb', 
              borderRadius:12, 
              padding:16, 
              background:'#fff',
              position: 'relative',
              opacity: hasAccess ? 1 : 0.7
            }}>
              {!hasAccess && (
                <div style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: '#fbbf24',
                  color: '#78350f',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Premium
                </div>
              )}
              <h3 style={{ marginTop:0 }}>Lesson Generator</h3>
              <p style={{ color:'#555' }}>Use AI to draft a lesson aligned to your grade, subject, and difficulty. Saved under Generated Lessons.</p>
              <Link 
                href="/facilitator/tools/lesson-maker" 
                style={{ 
                  display:'inline-block', 
                  padding:'8px 12px', 
                  border:'1px solid #111', 
                  background:'#111', 
                  color:'#fff', 
                  borderRadius:8, 
                  fontWeight:600,
                  textDecoration: 'none'
                }}
              >
                {hasAccess ? 'Open Lesson Generator' : 'Preview'}
              </Link>
            </div>
            
            <div style={{ 
              border:'1px solid #e5e7eb', 
              borderRadius:12, 
              padding:16, 
              background:'#fff',
              position: 'relative',
              opacity: hasAccess ? 1 : 0.7
            }}>
              {!hasAccess && (
                <div style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: '#fbbf24',
                  color: '#78350f',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Premium
                </div>
              )}
              <h3 style={{ marginTop:0 }}>Generated Lessons</h3>
              <p style={{ color:'#555' }}>Review, preview, and delete lessons you generated.</p>
              <Link 
                href="/facilitator/tools/generated" 
                style={{ 
                  display:'inline-block', 
                  padding:'8px 12px', 
                  border:'1px solid #111', 
                  background:'#111', 
                  color:'#fff', 
                  borderRadius:8, 
                  fontWeight:600,
                  textDecoration: 'none'
                }}
              >
                {hasAccess ? 'Open Manager' : 'Preview'}
              </Link>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
