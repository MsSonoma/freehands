'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LearnerSelector from './LearnerSelector'
import { ensurePinAllowed } from '../lib/pinGate'
import { getLearner } from '../facilitator/learners/clientApi'
import { getSupabaseClient } from '../lib/supabaseClient'
import GatedOverlay from '@/app/components/GatedOverlay'

export default function LearnPage() {
  const r = useRouter()
  const [learner, setLearner] = useState({ id: null, name: '' })
  const [showAuthGate, setShowAuthGate] = useState(false)

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
      const name = typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null;
      
      if (!id) {
        setLearner({ id: null, name: '' });
        return;
      }
      
      // Validate learner belongs to current facilitator
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          // Not logged in — auto-select Demo Learner
          try {
            localStorage.setItem('learner_id', 'demo');
            localStorage.setItem('learner_name', 'Demo Learner');
            localStorage.setItem('learner_grade', '4');
          } catch {}
          if (!cancelled) setLearner({ id: 'demo', name: 'Demo Learner' });
          return;
        }
        
        // Verify learner ownership via server
        const learner = await getLearner(id);
        if (!learner) {
          // Learner doesn't exist or doesn't belong to this facilitator
          localStorage.removeItem('learner_id');
          localStorage.removeItem('learner_name');
          localStorage.removeItem('learner_grade');
          if (!cancelled) setLearner({ id: null, name: '' });
          return;
        }
        
        if (!cancelled) setLearner({ id, name: name || learner.name || '' });
        
      } catch (e) {
        // On error, clear stale data
        localStorage.removeItem('learner_id');
        localStorage.removeItem('learner_name');
        localStorage.removeItem('learner_grade');
        if (!cancelled) setLearner({ id: null, name: '' });
      }
    })();
    
    return () => { cancelled = true; };
  }, [])

  const noLearner = !learner.id

  function goToLessons() {
    r.push('/learn/lessons')
  }

  function goToAwards() {
    r.push('/learn/awards')
  }

  return (
    <main style={{ padding:'16px 24px' }}>
      <GatedOverlay
        show={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        gateType="auth"
        feature="this feature"
        emoji="👩🏻‍🦰"
        description="Create a free account to access all teachers, track awards, and save your progress."
        benefits={['All three AI teachers — Ms. Sonoma, Mr. Slate, Mrs. Webb', 'Awards and medal tracking', 'Lesson history and progress', 'Personalized learner profiles']}
      />
      <div style={{ width:'100%', maxWidth:560, textAlign:'center', margin:'0 auto' }}>
        <h1 style={{ margin:'4px 0 8px' }}>{noLearner ? 'Learning Portal' : `Hi, ${learner.name}!`}</h1>
        
        {!noLearner && learner.id !== 'demo' && (
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
              onClick={() => {
                try { localStorage.setItem('selected_teacher', 'sonoma') } catch {}
                r.push('/learn/lessons')
              }}
              title="Practice lessons guided by Ms. Sonoma"
              style={{
                padding:'14px 20px', 
                border:'2px solid #c7442e', 
                borderRadius:12,
                fontSize:16, 
                fontWeight:700,
                background:'#c7442e',
                color:'#fff',
                cursor:'pointer',
                width:'100%', 
                maxWidth:320
              }}
            >
              👩🏻‍🦰 Ms. Sonoma
            </button>
            {[{
              label: '🤖 Mr. Slate',
              teacher: 'slate',
              border: '#6366f1',
              bg: '#6366f1',
              title: 'Drill questions with Mr. Slate',
            }, {
              label: '👩‍🏫 Mrs. Webb',
              teacher: 'webb',
              border: '#0d9488',
              bg: '#0d9488',
              title: 'Chat with Mrs. Webb, your educational AI teacher',
            }, {
              label: '🏆 Awards',
              teacher: null,
              border: '#059669',
              bg: '#059669',
              title: 'View medals and achievements',
              onClick: () => r.push('/learn/awards'),
            }].map(({ label, teacher, border, bg, title, onClick }) => {
              const isDemo = learner.id === 'demo'
              return (
                <div key={label} style={{ position: 'relative', width: '100%', maxWidth: 320 }} title={isDemo ? 'Sign up to use this' : title}>
                  <button
                    onClick={() => {
                      if (isDemo) { setShowAuthGate(true); return }
                      if (onClick) { onClick(); return }
                      try { localStorage.setItem('selected_teacher', teacher) } catch {}
                      r.push('/learn/lessons')
                    }}
                    style={{
                      padding:'14px 20px',
                      border: `2px solid ${border}`,
                      borderRadius:12,
                      fontSize:16,
                      fontWeight:700,
                      background: bg,
                      color:'#fff',
                      cursor: isDemo ? 'not-allowed' : 'pointer',
                      width:'100%',
                      opacity: isDemo ? 0.45 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {label}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
