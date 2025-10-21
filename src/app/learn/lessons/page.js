'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import { getLearner, updateLearner } from '@/app/facilitator/learners/clientApi'
import LoadingProgress from '@/components/LoadingProgress'
import GoldenKeyCounter from '@/app/learn/GoldenKeyCounter'

function LessonsPageInner(){
  const router = useRouter()

  const [approvedLessons, setApprovedLessons] = useState({})
  const [allLessons, setAllLessons] = useState({})
  const [loading, setLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(true)
  const [medals, setMedals] = useState({})
  const [learnerName, setLearnerName] = useState(null)
  const [learnerId, setLearnerId] = useState(null)
  const [planTier, setPlanTier] = useState('free')
  const [todaysCount, setTodaysCount] = useState(0)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [goldenKeySelected, setGoldenKeySelected] = useState(false)

  const subjects = ['math', 'science', 'language arts', 'social studies', 'facilitator']

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } })
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    try {
      const id = localStorage.getItem('learner_id')
      const n = localStorage.getItem('learner_name')
      if (n) setLearnerName(n)
      if (id) setLearnerId(id)
    } catch {}
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data } = await supabase.from('profiles').select('plan_tier').eq('id', session.user.id).maybeSingle()
            if (data?.plan_tier) setPlanTier(data.plan_tier)
          }
        }
      } catch {}
      try {
        const dateKey = new Date().toISOString().slice(0,10)
        const key = `lesson_unique:${dateKey}`
        const raw = localStorage.getItem(key)
        if (raw) {
          const set = new Set(JSON.parse(raw))
          setTodaysCount(set.size)
        } else {
          setTodaysCount(0)
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    (async () => {
      try {
        if (!learnerId) { setMedals({}); return; }
        const data = await getMedalsForLearner(learnerId);
        setMedals(data || {});
      } catch {
        setMedals({});
      }
    })();
  }, [learnerId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLessonsLoading(true)
      // Get auth token for facilitator lessons
      let token = null
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          token = session?.access_token || null
        }
      } catch {}
      
      const lessonsMap = {}
      for (const subject of subjects) {
        try {
          const headers = subject === 'facilitator' && token 
            ? { 'Authorization': `Bearer ${token}` }
            : {}
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store',
            headers 
          })
          const list = res.ok ? await res.json() : []
          lessonsMap[subject] = Array.isArray(list) ? list : []
        } catch {
          lessonsMap[subject] = []
        }
      }
      if (!cancelled) {
        setAllLessons(lessonsMap)
        setLessonsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!learnerId) {
      setApprovedLessons({})
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data } = await supabase.from('learners').select('approved_lessons').eq('id', learnerId).maybeSingle()
        if (!cancelled) {
          setApprovedLessons(data?.approved_lessons || {})
        }
      } catch {
        if (!cancelled) setApprovedLessons({})
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [learnerId])

  async function openLesson(subject, fileBaseName){
    const ent = featuresForTier(planTier)
    try {
      const dateKey = new Date().toISOString().slice(0,10)
      const key = `lesson_unique:${dateKey}`
      const raw = localStorage.getItem(key)
      const set = new Set(raw ? JSON.parse(raw) : [])
      const lessonKey = `${subject}/${fileBaseName}`
      if (!set.has(lessonKey)) {
        const cap = ent.lessonsPerDay
        if (Number.isFinite(cap) && set.size >= cap) {
          alert(`Daily limit reached. Your plan allows ${cap === Infinity ? 'unlimited' : cap} unique lessons per day.`)
          return
        }
        set.add(lessonKey)
        localStorage.setItem(key, JSON.stringify(Array.from(set)))
        setTodaysCount(set.size)
      }
    } catch {}
    
    // Handle golden key consumption - decrement from database
    if (goldenKeySelected && learnerId) {
      try {
        const learner = await getLearner(learnerId)
        if (learner && learner.golden_keys > 0) {
          await updateLearner(learnerId, { 
            name: learner.name,
            grade: learner.grade,
            targets: {
              comprehension: learner.comprehension,
              exercise: learner.exercise,
              worksheet: learner.worksheet,
              test: learner.test
            },
            session_timer_minutes: learner.session_timer_minutes,
            golden_keys: learner.golden_keys - 1
          })
        }
      } catch (e) {
        console.error('[Golden Key] Failed to consume key:', e)
      }
    }
    
    setSessionLoading(true)
    const url = `/session?subject=${encodeURIComponent(subject)}&lesson=${encodeURIComponent(fileBaseName)}`
    const withKey = goldenKeySelected ? `${url}&goldenKey=true` : url
    router.push(withKey)
  }

  const card = { border:'1px solid #e5e7eb', borderRadius:12, padding:14, display:'flex', flexDirection:'column', justifyContent:'space-between', background:'#fff' }
  const btn = { display:'inline-flex', justifyContent:'center', alignItems:'center', gap:8, width:'100%', padding:'10px 12px', border:'1px solid #111', borderRadius:10, background:'#111', color:'#fff', fontWeight:600 }
  const btnDisabled = { ...btn, background:'#9ca3af', borderColor:'#9ca3af', cursor:'not-allowed' }
  const subjectHeading = { margin:'24px 0 8px', fontSize:18, fontWeight:600 }
  const grid = { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12, alignItems:'stretch' }

  const lessonsBySubject = useMemo(() => {
    const grouped = {}
    Object.keys(approvedLessons).forEach(lessonKey => {
      const [subject, file] = lessonKey.split('/')
      if (!subject || !file) return
      const subjectLessons = allLessons[subject] || []
      const lesson = subjectLessons.find(l => l.file === file)
      if (lesson) {
        if (!grouped[subject]) grouped[subject] = []
        grouped[subject].push(lesson)
      }
    })
    return grouped
  }, [approvedLessons, allLessons])

  const hasApprovedLessons = Object.keys(lessonsBySubject).length > 0

  return (
    <main style={{ padding:24, maxWidth:980, margin:'0 auto' }}>
      <h1 style={{ margin:'8px 0 4px', textAlign:'center' }}>Select a Lesson</h1>
      {learnerName && (
        <div style={{ textAlign:'center', marginBottom:16, fontSize:16, color:'#666' }}>
          Learning with <strong style={{ color:'#111' }}>{learnerName}</strong>
        </div>
      )}

      {/* Golden Key Counter */}
      <GoldenKeyCounter
        learnerId={learnerId}
        selected={goldenKeySelected}
        onToggle={() => setGoldenKeySelected(prev => !prev)}
      />

      {loading || lessonsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: 12, marginTop: 32 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            border: '4px solid #e5e7eb', 
            borderTop: '4px solid #111', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }}></div>
          <p style={{ textAlign:'center', color: '#6b7280', fontSize: 16 }}>Loading lessons...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : !hasApprovedLessons ? (
        <div style={{ textAlign:'center', marginTop:32 }}>
          <p style={{ color:'#6b7280' }}>No lessons have been approved for this learner yet.</p>
          <p style={{ color:'#9ca3af', fontSize:14 }}>
            Ask your facilitator to approve lessons in the Facilitator portal.
          </p>
        </div>
      ) : (
        <>
          <div style={grid}>
            {subjects.map(subject => {
              const lessons = lessonsBySubject[subject]
              if (!lessons || lessons.length === 0) return null

              const displaySubject = subject === 'facilitator' ? 'Facilitator Lessons' : 
                                     subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

              // Render all lessons as cards with subject badges - no headings
              return lessons.map((l) => {
                const ent = featuresForTier(planTier)
                const cap = ent.lessonsPerDay
                const capped = Number.isFinite(cap) && todaysCount >= cap
                const lessonKey = `${subject}/${l.file}`
                const medalTier = medals[lessonKey]?.medalTier || null
                const medal = medalTier ? emojiForTier(medalTier) : ''
                
                // For facilitator lessons, use lesson.subject; for others use the subject category
                const subjectBadge = subject === 'facilitator' && l.subject
                  ? l.subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  : displaySubject
                
                return (
                  <div key={`${subject}-${l.file}`} style={card}>
                    <div>
                      <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>
                        {subjectBadge}
                      </div>
                      <h3 style={{ margin:'0 0 6px' }}>
                        {l.title} {medal}
                      </h3>
                      <p style={{ margin:0, color:'#4b5563', fontSize:14 }}>{l.blurb || ' '}</p>
                      {(l.grade || l.difficulty) && (
                        <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>
                          {l.grade && `Grade ${l.grade}`}
                          {l.grade && l.difficulty && '  '}
                          {l.difficulty && l.difficulty.charAt(0).toUpperCase() + l.difficulty.slice(1)}
                        </div>
                      )}
                    </div>
                    <button
                      style={capped ? btnDisabled : btn}
                      disabled={capped}
                      onClick={async ()=>{
                        try {
                          const supabase = getSupabaseClient()
                          const { data: { session } } = await supabase.auth.getSession()
                          const token = session?.access_token
                          if (!token) { openLesson(subject, l.file); return }
                          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
                          const lessonKey = `${subject}/${l.file}`
                          const res = await fetch('/api/lessons/quota', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ lesson_key: lessonKey, timezone: tz })
                          })
                          if (res.ok) {
                            const js = await res.json()
                            openLesson(subject, l.file)
                          } else if (res.status === 429) {
                            const js = await res.json()
                            alert(js.error || 'Daily lesson limit reached')
                          } else {
                            openLesson(subject, l.file)
                          }
                        } catch {
                          openLesson(subject, l.file)
                        }
                      }}
                    >
                      Start Lesson
                    </button>
                  </div>
                )
              })
            })}
          </div>
        </>
      )}

      <p style={{ textAlign:'center', color:'#6b7280', marginTop:24 }}>
        Daily lessons used: {Number.isFinite(todaysCount) ? todaysCount : 0} / {featuresForTier(planTier).lessonsPerDay === Infinity ? '' : featuresForTier(planTier).lessonsPerDay}
      </p>
      
      <LoadingProgress
        isLoading={sessionLoading}
        onComplete={() => setSessionLoading(false)}
      />
    </main>
  )
}

export default function LessonsPage(){
  return (
    <Suspense fallback={<main style={{padding:24}}><p>Loading lessons</p></main>}>
      <LessonsPageInner />
    </Suspense>
  )
}
