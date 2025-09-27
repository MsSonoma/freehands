'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LearnerSelector from './LearnerSelector'
import { ensurePinAllowed } from '../lib/pinGate'

// Difficulty taxonomy: Normal renamed to Intermediate (backward compat handled in lessons & session pages)
const DIFFICULTIES = ['Beginner','Intermediate','Advanced']

export default function LearnPage() {
  const r = useRouter()
  const [learner, setLearner] = useState({ id: null, name: '' })
  // Start with no defaults selected
  const [subject, setSubject] = useState(null) // 'Math' | 'Science' | 'Language Arts' | 'Social Studies'
  const [difficulty, setDifficulty] = useState(null) // 'Beginner' | 'Intermediate' | 'Advanced'
  const [showPinPrompt, setShowPinPrompt] = useState(false)

  useEffect(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null
    const name = typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null
    setLearner({ id, name: name || '' })
  }, [])

  // Gate: if no learner selected, show inline selector instead of redirecting away
  const noLearner = !learner.id

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
                // Clear the current learner selection
                try { localStorage.removeItem('learner_id'); localStorage.removeItem('learner_name'); localStorage.removeItem('learner_grade'); } catch {}
                setLearner({ id: null, name: '' });
              }}
              style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}
            >
              Change Learner
            </button>
          </div>
        )}

        {noLearner && (
          <div style={{ margin:'8px auto 16px', maxWidth:420 }}>
            <p style={{ marginTop:0 }}>Pick a Learner to continue:</p>
            <LearnerSelector onSelect={(l)=> setLearner({ id: l.id, name: l.name })} />
            <p style={{ margin:'8px 0 0', color:'#6b7280' }}>
              Prefer a full page? <Link href="/learners/select">Open Learner selection</Link>
            </p>
          </div>
        )}

  <h2 style={{ marginTop: 8 }}>Select Subject</h2>
        {/* 2×2 grid: two buttons per row, centered */}
        <div
          style={{
            display:'grid',
            gridTemplateColumns:'repeat(2, minmax(0, 1fr))',
            gap:12,
            maxWidth:420,
            margin:'0 auto 12px'
          }}
        >
          {/* Row 1 */}
          <button
            onClick={() => setSubject('Math')}
            aria-pressed={subject === 'Math'}
            style={{
              padding:'10px 12px', border:'1px solid #ddd', borderRadius:8,
              background: subject==='Math' ? '#eaeaea' : '#fff',
              width:'100%'
            }}
          >
            Math{subject==='Math' ? ' ✓' : ''}
          </button>
          <button
            onClick={() => setSubject('Science')}
            aria-pressed={subject === 'Science'}
            style={{
              padding:'10px 12px', border:'1px solid #ddd', borderRadius:8,
              background: subject==='Science' ? '#eaeaea' : '#fff',
              width:'100%'
            }}
          >
            Science{subject==='Science' ? ' ✓' : ''}
          </button>

          {/* Row 2 */}
          <button
            onClick={() => setSubject('Language Arts')}
            aria-pressed={subject === 'Language Arts'}
            style={{
              padding:'10px 12px', border:'1px solid #ddd', borderRadius:8,
              background: subject==='Language Arts' ? '#eaeaea' : '#fff',
              width:'100%'
            }}
          >
            Language Arts{subject==='Language Arts' ? ' ✓' : ''}
          </button>
          <button
            onClick={() => setSubject('Social Studies')}
            aria-pressed={subject === 'Social Studies'}
            style={{
              padding:'10px 12px', border:'1px solid #ddd', borderRadius:8,
              background: subject==='Social Studies' ? '#eaeaea' : '#fff',
              width:'100%'
            }}
          >
            Social Studies{subject==='Social Studies' ? ' ✓' : ''}
          </button>
        </div>

  <h2 style={{ marginTop: 12 }}>Select Difficulty</h2>
        <div
          style={{
            display:'grid',
            gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
            gap:8,
            maxWidth:420,
            margin:'0 auto 16px'
          }}
        >
          {DIFFICULTIES.map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              aria-pressed={difficulty === d}
              style={{
                padding:'8px 10px', border:'1px solid #ddd', borderRadius:8,
                background: difficulty===d ? '#eaeaea' : '#fff', width:'100%'
              }}>
              {d}{difficulty===d ? ' ✓' : ''}
            </button>
          ))}
        </div>

        <button
          disabled={!subject || !difficulty}
          onClick={() => r.push(`/learn/lessons?subject=${encodeURIComponent(subject)}&difficulty=${encodeURIComponent(difficulty)}`)}
          style={{
            padding:'14px 20px', border:'2px solid #111', borderRadius:12,
            fontSize:16, fontWeight:700,
            background: (!subject || !difficulty) ? '#9ca3af' : '#111',
            color: '#fff',
            cursor: (!subject || !difficulty) ? 'not-allowed' : 'pointer',
            width:'100%', maxWidth:320,
            marginTop: 12
          }}
        >
          Continue
        </button>
      </div>
      {/* No modal anymore; centralized ensurePinAllowed handles prompting */}
    </main>
  )
}
