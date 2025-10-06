'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LearnerSelector from './LearnerSelector'
import { ensurePinAllowed } from '../lib/pinGate'

export default function LearnPage() {
  const r = useRouter()
  const [learner, setLearner] = useState({ id: null, name: '' })

  useEffect(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null
    const name = typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null
    setLearner({ id, name: name || '' })
  }, [])

  const noLearner = !learner.id

  function goToLessons() {
    r.push('/learn/lessons')
  }

  function goToAwards() {
    r.push('/learn/awards')
  }

  return (
    <main style={{ minHeight:'calc(100dvh - 56px)', padding:'16px 24px' }}>
      <div style={{ width:'100%', maxWidth:560, textAlign:'center', margin:'0 auto' }}>
        <h1 style={{ margin:'4px 0 8px' }}>{noLearner ? 'Learning Portal' : `Hi, ${learner.name}!`}</h1>
        
        {!noLearner && (
          <div style={{ marginTop:4, marginBottom:12 }}>
            <button
              onClick={async ()=> {
                const ok = await ensurePinAllowed('change-learner');
                if (!ok) return;
                try { localStorage.removeItem('learner_id'); localStorage.removeItem('learner_name'); localStorage.removeItem('learner_grade'); } catch {}
                setLearner({ id: null, name: '' });
              }}
              style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}
            >
              Change Learner
            </button>
          </div>
        )}

        {noLearner ? (
          <div style={{ margin:'8px auto 16px', maxWidth:420 }}>
            <p style={{ marginTop:0 }}>Pick a Learner to continue:</p>
            <LearnerSelector onSelect={(l)=> {
              setLearner({ id: l.id, name: l.name })
              try {
                localStorage.setItem('learner_id', l.id)
                localStorage.setItem('learner_name', l.name)
                if (l.grade) localStorage.setItem('learner_grade', l.grade)
              } catch {}
            }} />
          </div>
        ) : (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <button
              onClick={goToLessons}
              style={{
                padding:'14px 20px', 
                border:'2px solid #111', 
                borderRadius:12,
                fontSize:16, 
                fontWeight:700,
                background:'#111',
                color:'#fff',
                cursor:'pointer',
                width:'100%', 
                maxWidth:320
              }}
            >
              View Lessons
            </button>
            <button
              onClick={goToAwards}
              style={{
                padding:'14px 20px', 
                border:'2px solid #059669', 
                borderRadius:12,
                fontSize:16, 
                fontWeight:700,
                background:'#059669',
                color:'#fff',
                cursor:'pointer',
                width:'100%', 
                maxWidth:320
              }}
            >
              🏆 Awards
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
