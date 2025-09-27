'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import LoadingProgress from '@/components/LoadingProgress'

function LessonsPageInner(){
  const router = useRouter()
  const params = useSearchParams()

  const subject = (params.get('subject') || 'math').toLowerCase()
  let difficulty = (params.get('difficulty') || 'beginner').toLowerCase()
  // Backward compatibility: 'normal' renamed to 'intermediate'
  if (difficulty === 'normal') difficulty = 'intermediate'

  const [lessons, setLessons] = useState([]) // discovered lessons (metadata parsed from each JSON file)
  const [filteredLessons, setFilteredLessons] = useState([]) // after grade/difficulty filter
  const [loading, setLoading] = useState(true)
  const [filterLoading, setFilterLoading] = useState(false)
  const [completed, setCompleted] = useState([]) // legacy trophy flag (kept harmless)
  const [medals, setMedals] = useState({}) // { [lessonKey]: { bestPercent, medalTier } }
  const [learnerGrade, setLearnerGrade] = useState(null)
  const [learnerName, setLearnerName] = useState(null)
  const [planTier, setPlanTier] = useState('free')
  const [todaysCount, setTodaysCount] = useState(0)
  const [sessionLoading, setSessionLoading] = useState(false) // loading state for session navigation

  // Pre-warm Ms. Sonoma API route in dev to avoid first-touch 404 during compilation
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } })
        if (!mounted) return
        // ignore result; this triggers route registration
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  // Normalize grade strings like '4' vs '4th' vs 'Grade 4' vs 'K'
  function normalizeGrade(val) {
    if (val == null) return null;
    const s = String(val).trim().toLowerCase();
    if (!s) return null;
    // Kindergarten variants
    if (s === 'k' || s === 'kg' || s === 'kindergarten') return 'K';
    // e.g., '4', '4th', 'grade 4', 'g4'
    const numMatch = s.match(/^(?:grade\s*)?(?:g\s*)?(\d{1,2})(?:st|nd|rd|th)?$/i);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      if (Number.isFinite(n) && n >= 1 && n <= 12) return String(n);
    }
    // Pass through already ordinal entries if we can't normalize
    return s;
  }

  // Load completed lesson markers + learner grade + learner name
  useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('completed_lessons') || '[]')
      if (Array.isArray(arr)) setCompleted(arr)
      const g = localStorage.getItem('learner_grade')
      if (g) setLearnerGrade(g)
      const n = localStorage.getItem('learner_name')
      if (n) setLearnerName(n)
    } catch {}
    // Load plan tier + today's lesson-start count
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

  // Load medals for current learner (persisted best scores)
  useEffect(() => {
    (async () => {
      try {
        const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
        if (!learnerId) { setMedals({}); return; }
        const data = await getMedalsForLearner(learnerId);
        setMedals(data || {});
      } catch {
        setMedals({});
      }
    })();
  }, [])

  // Discover lessons dynamically using server API that enumerates /public/lessons/{subject}
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { cache: 'no-store' });
        const list = res.ok ? await res.json() : [];
        if (!cancelled) setLessons(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setLessons([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true };
  }, [subject]);

  // Filter lessons client-side using metadata already loaded, then gate based on plan tier
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    setFilterLoading(true);
    try {
      const results = [];
      const ent = featuresForTier(planTier)
      const gFilter = normalizeGrade(learnerGrade);
      for (const entry of lessons) {
        const difficultyMatch = !difficulty || !entry.difficulty || entry.difficulty === difficulty;
        // Normalize entry grade and compare against normalized learner grade
        const entryGrade = normalizeGrade(entry.grade);
        const gradeMatch = !gFilter || (entryGrade != null && entryGrade === gFilter);
        if (difficultyMatch && gradeMatch) results.push(entry);
      }
      const gated = featuresForTier(planTier).allLessons
        ? results
        : results.filter((e) => e.featured === true || e.difficulty === 'beginner')
      if (!cancelled) setFilteredLessons(gated);
    } finally {
      if (!cancelled) setFilterLoading(false);
    }
    return () => { cancelled = true };
  }, [lessons, learnerGrade, difficulty, loading, planTier]);

  const title = useMemo(() => {
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
    return `${cap(subject)} · ${difficulty === 'intermediate' ? 'Intermediate' : cap(difficulty)}`
  }, [subject, difficulty])

  function openLesson(fileBaseName){
    // we pass the JSON filename (without .json) as the "lesson" param
    const ent = featuresForTier(planTier)
    try {
      const dateKey = new Date().toISOString().slice(0,10)
      const key = `lesson_unique:${dateKey}`
      const raw = localStorage.getItem(key)
      const set = new Set(raw ? JSON.parse(raw) : [])
      const lessonKey = `${subject}/${fileBaseName}`
      // Only gate locally if lesson not already started today
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
    
    // Start loading animation
    setSessionLoading(true)
    
    // Navigate to session
    router.push(`/session?subject=${encodeURIComponent(subject)}&difficulty=${encodeURIComponent(difficulty)}&lesson=${encodeURIComponent(fileBaseName)}`)
  }

  // styles
  const pill = { padding:'2px 8px', border:'1px solid #e5e7eb', borderRadius:9999, fontSize:12 }
  const grid = { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12, alignItems:'stretch', marginTop:12 }
  const card = { border:'1px solid #e5e7eb', borderRadius:12, padding:14, display:'flex', flexDirection:'column', justifyContent:'space-between', background:'#fff' }
  const btn = { display:'inline-flex', justifyContent:'center', alignItems:'center', gap:8, width:'100%', padding:'10px 12px', border:'1px solid #111', borderRadius:10, background:'#111', color:'#fff', fontWeight:600 }
  const btnDisabled = { ...btn, background:'#9ca3af', borderColor:'#9ca3af', cursor:'not-allowed' }
  const tab = (active) => ({ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:9999, fontSize:14, background: active ? '#111' : '#fff', color: active ? '#fff' : '#111', cursor:'pointer' })
  const row = { display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', justifyContent:'center', margin:'8px 0' }
  const gradePill = { display:'inline-flex', alignItems:'center', gap:8, padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:9999, background:'#fff' }
  const iconBtn = { padding:'4px 8px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', cursor:'pointer' }

  const GRADES = ['K','1','2','3','4','5','6','7','8','9','10','11','12'];
  const currentGradeIndex = useMemo(() => {
    const g = (learnerGrade || '').toString();
    if (!g) return -1;
    const norm = normalizeGrade(g);
    if (!norm) return -1;
    const label = norm === 'K' ? 'K' : String(norm);
    return GRADES.indexOf(label);
  }, [learnerGrade]);
  function moveGrade(delta){
    let idx = currentGradeIndex;
    if (idx < 0) idx = 0; // start at K if not set
    let next = idx + delta;
    if (next < 0) next = 0;
    if (next >= GRADES.length) next = GRADES.length - 1;
    const val = GRADES[next];
    setLearnerGrade(val);
    try { localStorage.setItem('learner_grade', val); } catch {}
  }

  return (
    <main style={{ padding:24, maxWidth:980, margin:'0 auto' }}>
        <h1 style={{ margin:'8px 0 4px', textAlign:'center' }}>Select a Lesson</h1>
        {learnerName && (
          <div style={{ textAlign:'center', marginBottom:16, fontSize:16, color:'#666' }}>
            Learning with <strong style={{ color:'#111' }}>{learnerName}</strong>
          </div>
        )}
        <div style={{ ...row, marginBottom: 8 }}>
          <button style={tab(subject==='math')} onClick={()=>{
            const q = new URLSearchParams(Array.from(params.entries()))
            q.set('subject','math')
            router.push(`/learn/lessons?${q.toString()}`)
          }}>Math</button>
          <button style={tab(subject==='language arts')} onClick={()=>{
            const q = new URLSearchParams(Array.from(params.entries()))
            q.set('subject','language arts')
            router.push(`/learn/lessons?${q.toString()}`)
          }}>Language Arts</button>
          <button style={tab(subject==='science')} onClick={()=>{
            const q = new URLSearchParams(Array.from(params.entries()))
            q.set('subject','science')
            router.push(`/learn/lessons?${q.toString()}`)
          }}>Science</button>
          <button style={tab(subject==='social studies')} onClick={()=>{
            const q = new URLSearchParams(Array.from(params.entries()))
            q.set('subject','social studies')
            router.push(`/learn/lessons?${q.toString()}`)
          }}>Social Studies</button>
          <button style={tab(subject==='facilitator')} onClick={()=>{
            const q = new URLSearchParams(Array.from(params.entries()))
            q.set('subject','facilitator')
            router.push(`/learn/lessons?${q.toString()}`)
          }}>Facilitator</button>
        </div>
        <div style={{ ...row, marginBottom: 16 }}>
          <button style={tab(difficulty==='beginner')} onClick={()=>{
            const q = new URLSearchParams(Array.from(params.entries()))
            q.set('difficulty','beginner')
            router.push(`/learn/lessons?${q.toString()}`)
          }}>Beginner</button>
          <button style={tab(difficulty==='intermediate')} onClick={()=>{
            const q = new URLSearchParams(Array.from(params.entries()))
            q.set('difficulty','intermediate')
            router.push(`/learn/lessons?${q.toString()}`)
          }}>Intermediate</button>
          <button style={tab(difficulty==='advanced')} onClick={()=>{
            const q = new URLSearchParams(Array.from(params.entries()))
            q.set('difficulty','advanced')
            router.push(`/learn/lessons?${q.toString()}`)
          }}>Advanced</button>
        </div>

        {/* Grade Dial */}
        <div style={{ ...row, marginBottom: 8 }}>
          <div style={gradePill}>
            <button aria-label="Previous grade" style={iconBtn} onClick={()=> moveGrade(-1)}>{'◀'}</button>
            <div style={{ minWidth: 80, textAlign:'center', fontWeight:600 }}>
              Grade: {currentGradeIndex >= 0 ? GRADES[currentGradeIndex] : '—'}
            </div>
            <button aria-label="Next grade" style={iconBtn} onClick={()=> moveGrade(1)}>{'▶'}</button>
          </div>
        </div>

        { (subject === 'facilitator' && !featuresForTier(planTier).facilitatorTools) ? (
          <p style={{ textAlign:'center', color:'#4b5563' }}>
            Facilitator Lessons are a Premium feature. <a href="/facilitator/plan">View plans</a>.
          </p>
        ) : loading || filterLoading ? (
          <p>Loading lessons…</p>
        ) : filteredLessons.length === 0 ? (
          <p style={{ textAlign:'center', color:'#6b7280' }}>
            No lessons match the selected grade{learnerGrade ? ` (${learnerGrade})` : ''} and difficulty &quot;{difficulty}&quot;.
          </p>
        ) : (
          <div style={grid}>
            {filteredLessons.map((l) => {
              const ent = featuresForTier(planTier)
              const cap = ent.lessonsPerDay
              const capped = Number.isFinite(cap) && todaysCount >= cap
              const lessonKey = `${subject}/${l.file}`
              const medalTier = medals[lessonKey]?.medalTier || null
              const medal = medalTier ? emojiForTier(medalTier) : ''
              return (
                <div key={l.file} style={card}>
                  <div>
                    <h3 style={{ margin:'0 0 6px' }}>
                      {l.title} {medal}
                    </h3>
                    <p style={{ margin:0, color:'#4b5563', fontSize:14 }}>{l.blurb || ' '}</p>
                  </div>
                  <button
                    style={capped ? btnDisabled : btn}
                    disabled={capped}
                    onClick={async ()=>{
                      try {
                        const supabase = getSupabaseClient()
                        const { data: { session } } = await supabase.auth.getSession()
                        const token = session?.access_token
                        if (!token) { openLesson(l.file); return }
                        // Server prefers profile.timezone; we also send browser tz as a fallback.
                        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
                        const lessonKey = `${subject}/${l.file}`
                        const res = await fetch('/api/lessons/quota', {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
                          body: JSON.stringify({ lesson_key: lessonKey, timezone: tz })
                        })
                        if (res.status === 429) {
                          // Respect server-enforced cap
                          const data = await res.json().catch(()=>null)
                          if (data?.count != null) setTodaysCount(data.count)
                          return
                        }
                        // For any other non-OK, fall back to client open to avoid blocking
                        if (!res.ok) { openLesson(l.file); return }
                        const data = await res.json().catch(()=>null)
                        if (data?.count != null) setTodaysCount(data.count)
                        openLesson(l.file)
                      } catch {
                        // fall back to client open if server check fails unexpectedly
                        openLesson(l.file)
                      }
                    }}
                  >
                    Begin
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {!featuresForTier(planTier).allLessons && (
          <p style={{ textAlign:'center', color:'#4b5563', marginTop:12 }}>
            Upgrade to access All Lessons.
          </p>
        )}
        <p style={{ textAlign:'center', color:'#6b7280', marginTop:12 }}>
          Daily lessons used: {Number.isFinite(todaysCount) ? todaysCount : 0} / {featuresForTier(planTier).lessonsPerDay === Infinity ? '∞' : featuresForTier(planTier).lessonsPerDay}
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
    <Suspense fallback={<main style={{padding:24}}><p>Loading lessons…</p></main>}>
      <LessonsPageInner />
    </Suspense>
  )
}
