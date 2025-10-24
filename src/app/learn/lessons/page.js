'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import { getLearner, updateLearner } from '@/app/facilitator/learners/clientApi'
import LoadingProgress from '@/components/LoadingProgress'
import GoldenKeyCounter from '@/app/learn/GoldenKeyCounter'

const SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'generated']

function LessonsPageInner(){
  const router = useRouter()

  const [approvedLessons, setApprovedLessons] = useState({})
  const [scheduledLessons, setScheduledLessons] = useState({}) // { 'subject/lesson_file': true } - lessons scheduled for today
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
  const [activeGoldenKeys, setActiveGoldenKeys] = useState({}) // Track lessons with active golden keys
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Used to force refresh at midnight and on schedule changes

  // Set up midnight refresh timer
  useEffect(() => {
    const scheduleNextMidnightRefresh = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const msUntilMidnight = tomorrow.getTime() - now.getTime()
      
      console.log('[Learn Lessons] Scheduling refresh in', Math.round(msUntilMidnight / 1000 / 60), 'minutes at midnight')
      
      const timer = setTimeout(() => {
        console.log('[Learn Lessons] Midnight refresh triggered')
        setRefreshTrigger(prev => prev + 1)
        // Schedule next midnight refresh
        scheduleNextMidnightRefresh()
      }, msUntilMidnight)
      
      return timer
    }
    
    const timer = scheduleNextMidnightRefresh()
    return () => clearTimeout(timer)
  }, [])

  // Poll for newly scheduled lessons every 2 minutes
  useEffect(() => {
    if (!learnerId) return
    
    const pollInterval = setInterval(() => {
      console.log('[Learn Lessons] Polling for schedule changes')
      setRefreshTrigger(prev => prev + 1)
    }, 2 * 60 * 1000) // 2 minutes
    
    return () => clearInterval(pollInterval)
  }, [learnerId])

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
      
      // Load demo lessons if it's the demo learner
      if (learnerId === 'demo') {
        try {
          const res = await fetch('/api/lessons/demo', { cache: 'no-store' })
          const list = res.ok ? await res.json() : []
          lessonsMap['demo'] = Array.isArray(list) ? list : []
        } catch {
          lessonsMap['demo'] = []
        }
      }
      
      for (const subject of SUBJECTS) {
        try {
          const headers = subject === 'generated' && token 
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
  }, [learnerId])

  useEffect(() => {
    if (!learnerId) {
      setApprovedLessons({})
      setActiveGoldenKeys({})
      setLoading(false)
      return
    }
    // Demo learner doesn't need database lookup
    if (learnerId === 'demo') {
      // Auto-approve all demo lessons for the demo learner
      const demoApproved = {}
      if (allLessons['demo']) {
        allLessons['demo'].forEach(lesson => {
          demoApproved[`demo/${lesson.file}`] = true
        })
      }
      setApprovedLessons(demoApproved)
      setActiveGoldenKeys({})
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        // Try to load with all fields first
        let data, error
        const result = await supabase.from('learners').select('approved_lessons, active_golden_keys').eq('id', learnerId).maybeSingle()
        data = result.data
        error = result.error
        
        // If error, try without active_golden_keys (column might not exist yet)
        if (error) {
          console.warn('[Learn Lessons] Error loading with active_golden_keys, trying without:', error)
          const fallbackResult = await supabase.from('learners').select('approved_lessons').eq('id', learnerId).maybeSingle()
          data = fallbackResult.data
          error = fallbackResult.error
          if (error) {
            console.warn('[Learn Lessons] Could not load learner data (may not exist in database yet):', learnerId)
            // Don't throw - just use empty defaults
            data = null
          }
        }
        
        // Load today's scheduled lessons and merge with approved lessons
        let mergedApproved = data?.approved_lessons || {}
        let scheduled = {}
        try {
          const today = new Date().toISOString().split('T')[0]
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token
          
          if (!token) {
            console.warn('[Learn Lessons] No auth token available for schedule fetch')
          } else {
            const scheduleResponse = await fetch(`/api/lesson-schedule?learnerId=${learnerId}&action=active`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
            if (scheduleResponse.ok) {
              const scheduleData = await scheduleResponse.json()
              const scheduledLessons = scheduleData.lessons || []
              console.log('[Learn Lessons] Scheduled lessons for today:', scheduledLessons)
              
              // Add scheduled lessons to available lessons and track them separately
              scheduledLessons.forEach(item => {
                if (item.lesson_key) {
                  mergedApproved[item.lesson_key] = true
                  scheduled[item.lesson_key] = true
                }
              })
            } else {
              console.warn('[Learn Lessons] Schedule fetch failed:', scheduleResponse.status)
            }
          }
        } catch (schedErr) {
          console.warn('[Learn Lessons] Could not load scheduled lessons:', schedErr)
        }
        
        console.log('[Learn Lessons] Loaded approved + scheduled lessons for learner:', learnerId, mergedApproved)
        if (!cancelled) {
          setApprovedLessons(mergedApproved)
          setScheduledLessons(scheduled)
          setActiveGoldenKeys(data?.active_golden_keys || {})
        }
      } catch (err) {
        console.error('[Learn Lessons] Failed to load:', err)
        if (!cancelled) {
          setApprovedLessons({})
          setActiveGoldenKeys({})
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [learnerId, allLessons, refreshTrigger])

  async function openLesson(subject, fileBaseName){
    const ent = featuresForTier(planTier)
    
    // Skip quota checks for demo lessons - they're unlimited
    const isDemoLesson = subject === 'demo';
    
    if (!isDemoLesson) {
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
    }
    
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
            {/* Show demo lessons first if they exist */}
            {lessonsBySubject['demo'] && lessonsBySubject['demo'].map((l) => {
              const ent = featuresForTier(planTier)
              const cap = ent.lessonsPerDay
              const capped = Number.isFinite(cap) && todaysCount >= cap
              const lessonKey = `demo/${l.file}`
              const medalTier = medals[lessonKey]?.medalTier || null
              const medal = medalTier ? emojiForTier(medalTier) : ''
              
              return (
                <div key={`demo-${l.file}`} style={card}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize:12, color:'#6b7280' }}>
                        {l.subject ? l.subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Tutorial'}
                      </div>
                      <div style={{ 
                        fontSize: 11, 
                        background: '#dbeafe', 
                        color: '#1e40af',
                        padding: '2px 6px',
                        borderRadius: 6,
                        fontWeight: 600
                      }}>
                        Demo
                      </div>
                    </div>
                    <h3 style={{ margin:'0 0 6px' }}>
                      {l.title} {medal}
                    </h3>
                    <p style={{ margin:0, color:'#4b5563', fontSize:14 }}>{l.blurb || ' '}</p>
                  </div>
                  <button
                    style={btn}
                    onClick={()=>{ openLesson('demo', l.file) }}
                  >
                    Start Lesson
                  </button>
                </div>
              )
            })}
            
            {SUBJECTS.map(subject => {
              const lessons = lessonsBySubject[subject]
              if (!lessons || lessons.length === 0) return null

              const displaySubject = subject === 'generated' ? 'Generated Lessons' : 
                                     subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

              // Render all lessons as cards with subject badges - no headings
              return lessons.map((l) => {
                const ent = featuresForTier(planTier)
                const cap = ent.lessonsPerDay
                const capped = Number.isFinite(cap) && todaysCount >= cap
                const lessonKey = `${subject}/${l.file}`
                const isScheduled = !!scheduledLessons[lessonKey]
                const medalTier = medals[lessonKey]?.medalTier || null
                const medal = medalTier ? emojiForTier(medalTier) : ''
                const hasActiveKey = activeGoldenKeys[lessonKey] === true
                
                // For generated lessons, use lesson.subject; for others use the subject category
                const subjectBadge = subject === 'generated' && l.subject
                  ? l.subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  : displaySubject
                
                return (
                  <div key={`${subject}-${l.file}`} style={card}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontSize:12, color:'#6b7280' }}>
                          {subjectBadge}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {isScheduled && (
                            <div style={{ 
                              fontSize: 16, 
                              background: '#dbeafe', 
                              color: '#1e40af',
                              padding: '2px 6px',
                              borderRadius: 6,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }} title="Scheduled for today">
                              📅
                            </div>
                          )}
                          {hasActiveKey && (
                            <div style={{ 
                              fontSize: 16, 
                              background: '#fef3c7', 
                              color: '#92400e',
                              padding: '2px 6px',
                              borderRadius: 6,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }} title="Golden Key Active">
                              🔑 Active
                            </div>
                          )}
                        </div>
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
