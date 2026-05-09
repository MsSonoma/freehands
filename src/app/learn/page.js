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

        {!noLearner && learner.id === 'demo' && (
          <div style={{ marginTop:4, marginBottom:12 }}>
            <button
              onClick={() => {
                try { localStorage.removeItem('learner_id'); localStorage.removeItem('learner_name'); localStorage.removeItem('learner_grade'); } catch {}
                setLearner({ id: null, name: '' });
              }}
              style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', color:'#6b7280' }}
            >
              Exit Demo
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
          <div style={{ marginTop: 16 }}>
            {/* Teacher buttons — responsive grid, spreads on wider screens */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 14,
            }}>
              {[{
                label: '👩🏻‍🦰 Ms. Sonoma',
                teacher: 'sonoma',
                border: '#c7442e',
                bg: '#c7442e',
                title: 'Practice lessons guided by Ms. Sonoma',
              }, {
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
              }].map(({ label, teacher, border, bg, title }) => {
                const isDemo = learner.id === 'demo'
                return (
                  <button
                    key={label}
                    onClick={() => {
                      if (isDemo) { setShowAuthGate(true); return }
                      try { localStorage.setItem('selected_teacher', teacher) } catch {}
                      r.push('/learn/lessons')
                    }}
                    title={isDemo ? 'Sign up to use this' : title}
                    style={{
                      padding: '14px 20px',
                      border: `2px solid ${border}`,
                      borderRadius: 12,
                      fontSize: 16,
                      fontWeight: 700,
                      background: bg,
                      color: '#fff',
                      cursor: isDemo ? 'not-allowed' : 'pointer',
                      opacity: isDemo ? 0.45 : 1,
                      transition: 'opacity 0.15s',
                      width: '100%',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Divider separating Awards from teachers */}
            <div style={{ borderTop: '1px solid #e5e7eb', margin: '20px 0 16px' }} />

            {/* Awards — outlined/gold to distinguish from teacher buttons */}
            <button
              onClick={() => {
                if (learner.id === 'demo') { setShowAuthGate(true); return }
                r.push('/learn/awards')
              }}
              title={learner.id === 'demo' ? 'Sign up to use this' : 'View medals and achievements'}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 20px',
                border: '2px solid #d97706',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                background: 'transparent',
                color: '#d97706',
                cursor: learner.id === 'demo' ? 'not-allowed' : 'pointer',
                opacity: learner.id === 'demo' ? 0.45 : 1,
                transition: 'opacity 0.15s',
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
