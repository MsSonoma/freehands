'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import { getSupabaseClient } from '@/app/lib/supabaseClient'

// Contract:
// - Props:
//   - onSelect: function({ id, name, grade }) called when a learner is chosen
//   - compact: boolean to render smaller UI variant
// - Behavior:
//   - Loads learners from Supabase if configured, else from localStorage fallback
//   - Provides a Demo Learner option when list is empty
export default function LearnerSelector({ onSelect, compact = false }) {
  const router = useRouter()
  const [learners, setLearners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        
        // Check if user is logged in
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!cancelled) setIsLoggedIn(!!session?.user)
        
        const list = await listLearners()
        if (!cancelled) setLearners(Array.isArray(list) ? list : [])
      } catch (e) {
        if (!cancelled) {
          // Check again if user is logged in (in case the error is auth-related)
          try {
            const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            setIsLoggedIn(!!session?.user)
          } catch {}
          setError(e?.message || 'Failed to load learners')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const pick = (l) => {
    try {
      // Get current learner ID before changing it
      const currentId = localStorage.getItem('learner_id')
      
      // Set new learner info
      localStorage.setItem('learner_id', l.id)
      localStorage.setItem('learner_name', l.name)
      if (l.grade != null) localStorage.setItem('learner_grade', String(l.grade))
      
      // Clear any global target overrides so learner-specific targets are used
      localStorage.removeItem('target_comprehension')
      localStorage.removeItem('target_exercise') 
      localStorage.removeItem('target_worksheet')
      localStorage.removeItem('target_test')
      
      // Also clear any learner-specific overrides for the previous learner
      // This prevents override leakage between learners
      if (currentId && currentId !== l.id) {
        localStorage.removeItem(`target_comprehension_${currentId}`)
        localStorage.removeItem(`target_exercise_${currentId}`)
        localStorage.removeItem(`target_worksheet_${currentId}`)
        localStorage.removeItem(`target_test_${currentId}`)
      }
    } catch {}
    onSelect?.(l)
  }

  if (loading) {
    return <div style={{ textAlign:'center' }}>Loading learners…</div>
  }

  // Show auth-specific messaging when not logged in
  if (!isLoggedIn) {
    return (
      <div style={{ textAlign:'center', padding: '16px' }}>
        <p style={{ marginTop: 0, marginBottom: 12 }}>Create an account to make learner profiles</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/auth/signup')}
            style={{ padding:'8px 16px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}
          >
            Sign Up
          </button>
          <button
            onClick={() => router.push('/auth/login')}
            style={{ padding:'8px 16px', border:'1px solid #ddd', borderRadius:8, background:'#fff' }}
          >
            Sign In
          </button>
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
          <p style={{ marginTop: 0, marginBottom: 8, fontSize: '0.9rem', color: '#6b7280' }}>Or try without an account:</p>
          <button
            onClick={() => pick({ id: 'demo', name: 'Demo Learner', grade: 4 })}
            style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8 }}
          >
            Use Demo Learner
          </button>
        </div>
      </div>
    )
  }

  // Show different message when logged in but no learners yet
  if (!learners.length) {
    return (
      <div style={{ textAlign:'center', padding: '16px' }}>
        <p style={{ marginTop: 0, marginBottom: 12 }}>Add your first learner to get started</p>
        <button
          onClick={() => router.push('/facilitator/learners/add')}
          style={{ padding:'8px 16px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600, marginBottom: 8 }}
        >
          Add Learner
        </button>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
          <p style={{ marginTop: 0, marginBottom: 8, fontSize: '0.9rem', color: '#6b7280' }}>Or try with a demo:</p>
          <button
            onClick={() => pick({ id: 'demo', name: 'Demo Learner', grade: 4 })}
            style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8 }}
          >
            Use Demo Learner
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'grid', gap:8 }}>
      {learners.map(l => (
        <button
          key={l.id}
          onClick={() => pick({ id: l.id, name: l.name, grade: l.grade })}
          style={{
            padding: compact ? '6px 10px' : '10px 14px',
            border:'1px solid #e5e7eb', borderRadius:8, textAlign:'left'
          }}
        >
          <div style={{ fontWeight:600 }}>{l.name}</div>
          {l.grade != null && (
            <div style={{ color:'#6b7280', fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)' }}>Grade {l.grade}</div>
          )}
        </button>
      ))}
    </div>
  )
}
