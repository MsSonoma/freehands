'use client'
import { useEffect, useState } from 'react'
import { listLearners } from '@/app/facilitator/learners/clientApi'

// Contract:
// - Props:
//   - onSelect: function({ id, name, grade }) called when a learner is chosen
//   - compact: boolean to render smaller UI variant
// - Behavior:
//   - Loads learners from Supabase if configured, else from localStorage fallback
//   - Provides a Demo Learner option when list is empty
export default function LearnerSelector({ onSelect, compact = false }) {
  const [learners, setLearners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const list = await listLearners()
        if (!cancelled) setLearners(Array.isArray(list) ? list : [])
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load learners')
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
  if (error) {
    return <div role="alert" style={{ color:'#b91c1c', textAlign:'center' }}>{error}</div>
  }

  if (!learners.length) {
    return (
      <div style={{ textAlign:'center' }}>
        <p style={{ marginTop: 0, marginBottom: 8 }}>No learners found.</p>
        <button
          onClick={() => pick({ id: 'demo', name: 'Demo Learner', grade: 4 })}
          style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8 }}
        >
          Use Demo Learner
        </button>
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
            <div style={{ color:'#6b7280', fontSize:12 }}>Grade {l.grade}</div>
          )}
        </button>
      ))}
    </div>
  )
}
