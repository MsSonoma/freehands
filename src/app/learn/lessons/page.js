'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import { getLearner, updateLearner } from '@/app/facilitator/learners/clientApi'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import LoadingProgress from '@/components/LoadingProgress'
import GoldenKeyCounter from '@/app/learn/GoldenKeyCounter'
import { getStoredSnapshot } from '@/app/session/sessionSnapshotStore'

const SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general', 'generated']

function normalizeApprovedLessonKeys(map = {}) {
  const normalized = {}
  let changed = false
  Object.entries(map || {}).forEach(([key, value]) => {
    if (typeof key === 'string' && key.startsWith('Facilitator Lessons/')) {
      const suffix = key.slice('Facilitator Lessons/'.length)
      normalized[`general/${suffix}`] = value
      changed = true
    } else if (key) {
      normalized[key] = value
    }
  })
  return { normalized, changed }
}

function LessonsPageInner(){
  const router = useRouter()

  const [scheduledLessons, setScheduledLessons] = useState({}) // { 'subject/lesson_file': true } - lessons scheduled for today
  const [allLessons, setAllLessons] = useState({})
  const [availableLessons, setAvailableLessons] = useState({}) // { 'subject/lesson_file': true } - lessons marked as available by facilitator
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
  const [lessonNotes, setLessonNotes] = useState({}) // { 'subject/lesson_file': 'note text' }
  const [editingNote, setEditingNote] = useState(null) // lesson key currently being edited
  const [saving, setSaving] = useState(false)
  const [lessonSnapshots, setLessonSnapshots] = useState({}) // { 'subject/lesson_file': true } - lessons with saved snapshots

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

  // Poll for newly scheduled lessons every 30 seconds
  useEffect(() => {
    if (!learnerId) return
    
    // DISABLED: Polling causes too many reloads, schedule changes are rare
    // Users can manually refresh if needed
    // const pollInterval = setInterval(() => {
    //   console.log('[Learn Lessons] Polling for schedule changes')
    //   setRefreshTrigger(prev => prev + 1)
    // }, 30 * 1000) // 30 seconds
    
    // return () => clearInterval(pollInterval)
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
      if (!learnerId) {
        setLessonsLoading(false)
        return
      }

      setLessonsLoading(true)
      
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
      } else if (learnerId) {
        // OPTIMIZED: Call single API that returns only checked/scheduled lessons
        try {
          const res = await fetch(`/api/learner/available-lessons?learner_id=${learnerId}`, {
            cache: 'no-store'
          })
          
          if (res.ok) {
            const { lessons, scheduledKeys: debugScheduledKeys, rawSchedule: debugRawSchedule, approvedKeys: debugApprovedKeys } = await res.json()
            console.log('[Learn Lessons] Loaded', lessons.length, 'available lessons from server')
            if (debugScheduledKeys || debugRawSchedule || debugApprovedKeys) {
              console.log('[Learn Lessons] Debug available lessons payload:', {
                scheduledKeys: debugScheduledKeys,
                rawSchedule: debugRawSchedule,
                approvedKeys: debugApprovedKeys
              })
            }
            
            // Group by subject
            for (const lesson of lessons) {
              const subject = lesson.isGenerated ? 'generated' : (lesson.subject || 'general')
              if (!lessonsMap[subject]) lessonsMap[subject] = []
              lessonsMap[subject].push(lesson)
            }
          }
        } catch (err) {
          console.error('[Learn Lessons] Error loading available lessons:', err)
        }
      }
      
      if (!cancelled) {
        setAllLessons(lessonsMap)
        setLessonsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [learnerId, availableLessons, scheduledLessons])

  useEffect(() => {
    if (!learnerId) {
      setActiveGoldenKeys({})
      setLoading(false)
      return
    }
    // Demo learner doesn't need database lookup
    if (learnerId === 'demo') {
      setActiveGoldenKeys({})
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        // Load active golden keys, lesson notes, and approved lessons
        let data, error
        const result = await supabase.from('learners').select('active_golden_keys, lesson_notes, approved_lessons').eq('id', learnerId).maybeSingle()
        data = result.data
        error = result.error
        
        // If error, use empty defaults
        if (error) {
          console.warn('[Learn Lessons] Error loading learner data:', error)
          data = null
        }
        
        // Load today's scheduled lessons
        let scheduled = {}
        try {
          // Get today's date in local timezone, not UTC
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          const today = `${year}-${month}-${day}`
          
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
              
              // Track scheduled lessons
              scheduledLessons.forEach(item => {
                if (item.lesson_key) {
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
        
        if (!cancelled) {
          setScheduledLessons(scheduled)
          setActiveGoldenKeys(data?.active_golden_keys || {})
          setLessonNotes(data?.lesson_notes || {})
          const { normalized: approvedNormalized } = normalizeApprovedLessonKeys(data?.approved_lessons || {})
          console.log('[Learn Lessons] Loaded approved lessons:', approvedNormalized)
          console.log('[Learn Lessons] Original approved lessons from DB:', data?.approved_lessons)
          setAvailableLessons(approvedNormalized)
        }
      } catch (err) {
        console.error('[Learn Lessons] Failed to load:', err)
        if (!cancelled) {
          setActiveGoldenKeys({})
          setAvailableLessons({})
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [learnerId, refreshTrigger])

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

  async function saveNote(lessonKey, noteText) {
    if (!learnerId) return
    
    // Require PIN before saving notes
    const allowed = await ensurePinAllowed('lesson-notes')
    if (!allowed) {
      alert('PIN required to manage lesson notes')
      setEditingNote(null)
      return
    }
    
    const newNotes = { ...lessonNotes }
    if (noteText && noteText.trim()) {
      newNotes[lessonKey] = noteText.trim()
    } else {
      delete newNotes[lessonKey]
    }
    
    setLessonNotes(newNotes)
    setEditingNote(null)
    setSaving(true)
    
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from('learners').update({ lesson_notes: newNotes }).eq('id', learnerId)
      if (error) {
        console.error('[Learn Lessons] Note save error:', error)
        throw error
      }
      console.log('[Learn Lessons] Successfully saved note for lesson:', lessonKey)
    } catch (e) {
      console.error('[Learn Lessons] Failed to save note:', e)
      alert('Failed to save note: ' + (e?.message || e?.hint || 'Unknown error'))
      // Revert on error
      setLessonNotes(lessonNotes)
    } finally {
      setSaving(false)
    }
  }

  const card = { border:'1px solid #e5e7eb', borderRadius:12, padding:14, display:'flex', flexDirection:'column', justifyContent:'space-between', background:'#fff' }
  const btn = { display:'inline-flex', justifyContent:'center', alignItems:'center', gap:8, width:'100%', padding:'10px 12px', border:'1px solid #111', borderRadius:10, background:'#111', color:'#fff', fontWeight:600 }
  const btnDisabled = { ...btn, background:'#9ca3af', borderColor:'#9ca3af', cursor:'not-allowed' }
  const subjectHeading = { margin:'24px 0 8px', fontSize:18, fontWeight:600 }
  const grid = { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12, alignItems:'stretch' }

  const lessonsBySubject = useMemo(() => {
    const grouped = {}
    SUBJECTS.forEach(subject => {
      const subjectLessons = allLessons[subject] || []
      // Filter by available lessons - show lessons that are EITHER:
      // 1. Marked available by facilitator (checkbox), OR
      // 2. Scheduled for today (calendar)
      const availableForSubject = subjectLessons.filter(lesson => {
        const lessonKey = lesson.isGenerated 
          ? `generated/${lesson.file}`
          : `${subject}/${lesson.file}`
        // Also check legacy facilitator/ key for general lessons
        const legacyKey = lessonKey.replace('general/', 'facilitator/')
        // Also check just the filename (no subject prefix) for backwards compatibility
        const filenameOnly = lesson.file
        const isAvailable = availableLessons[lessonKey] === true 
          || availableLessons[legacyKey] === true 
          || availableLessons[filenameOnly] === true
          || scheduledLessons[lessonKey] === true 
          || scheduledLessons[legacyKey] === true
          || scheduledLessons[filenameOnly] === true
        // Debug logging for general subject
        if (subject === 'general') {
          console.log('[Learn Lessons] General lesson filter:', {
            lessonKey,
            legacyKey,
            filenameOnly,
            file: lesson.file,
            isAvailable,
            inApproved: availableLessons[lessonKey] || availableLessons[legacyKey] || availableLessons[filenameOnly],
            inScheduled: scheduledLessons[lessonKey] || scheduledLessons[legacyKey] || scheduledLessons[filenameOnly]
          })
        }
        return isAvailable
      }).map(lesson => {
        // Add lessonKey to each lesson object for snapshot lookup
        const lessonKey = lesson.isGenerated 
          ? `generated/${lesson.file}`
          : `${subject}/${lesson.file}`
        return { ...lesson, lessonKey }
      })
      if (availableForSubject.length > 0) {
        grouped[subject] = availableForSubject
      }
    })
    // Debug log final grouped lessons
    console.log('[Learn Lessons] Grouped lessons by subject:', Object.keys(grouped))
    console.log('[Learn Lessons] Available lessons keys:', Object.keys(availableLessons))
    return grouped
  }, [allLessons, availableLessons, scheduledLessons])

  const hasLessons = Object.keys(lessonsBySubject).length > 0

  // Check for existing snapshots from server - must use lesson.id not filename
  useEffect(() => {
    if (!learnerId || lessonsLoading) return
    
    // Wait for lessons to be loaded with their IDs
    const allLoadedLessons = Object.values(lessonsBySubject).flat()
    if (allLoadedLessons.length === 0) return
    
    let cancelled = false
    
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (!supabase) {
          if (!cancelled) setLessonSnapshots({})
          return
        }
        
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          if (!cancelled) setLessonSnapshots({})
          return
        }
        
        console.log('[Learn Lessons] Checking server snapshots for', allLoadedLessons.length, 'loaded lessons')
        
        const snapshotsFound = {}
        
        // Check each loaded lesson for a snapshot using its ID
        for (const lesson of allLoadedLessons) {
          if (cancelled) break
          
          // Use lesson.id if available, fallback to filename without extension
          const lessonId = lesson.id || lesson.file?.replace(/\.json$/i, '') || lesson.lessonKey?.split('/').pop()?.replace(/\.json$/i, '')
          if (!lessonId) continue
          
          try {
            const res = await fetch(
              `/api/snapshots?learner_id=${encodeURIComponent(learnerId)}&lesson_key=${encodeURIComponent(lessonId)}`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            
            if (res.ok) {
              const { snapshot } = await res.json()
              if (snapshot && snapshot.savedAt) {
                // Store under the lessonKey for display
                snapshotsFound[lesson.lessonKey] = true
                console.log('[Learn Lessons] Found snapshot for', lesson.lessonKey, '(id:', lessonId + ')')
              }
            }
          } catch (e) {
            console.warn('[Learn Lessons] Failed to check snapshot for', lesson.lessonKey, e)
          }
        }
        
        console.log('[Learn Lessons] Snapshot check complete. Found:', Object.keys(snapshotsFound).length, 'snapshots')
        if (!cancelled) setLessonSnapshots(snapshotsFound)
      } catch (e) {
        console.error('[Learn Lessons] Error checking snapshots:', e)
        if (!cancelled) setLessonSnapshots({})
      }
    })()
    
    return () => { cancelled = true }
  }, [learnerId, lessonsBySubject, lessonsLoading])

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
      ) : !hasLessons ? (
        <div style={{ textAlign:'center', marginTop:32 }}>
          <p style={{ color:'#6b7280' }}>No lessons available yet.</p>
          <p style={{ color:'#9ca3af', fontSize:14 }}>
            Ask your facilitator to add lessons in the Facilitator portal.
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
                    {(() => {
                      const lessonKey = `demo/${l.file}`
                      const hasSnapshot = lessonSnapshots[lessonKey]
                      // Debug log to see format mismatch
                      if (!window._loggedSnapshotCheck && Object.keys(lessonSnapshots).length > 0) {
                        console.log('[Learn Lessons] Button check - Looking for:', lessonKey)
                        console.log('[Learn Lessons] Button check - Available keys:', Object.keys(lessonSnapshots).slice(0, 3))
                        console.log('[Learn Lessons] Button check - Found?', hasSnapshot)
                        window._loggedSnapshotCheck = true
                      }
                      return hasSnapshot ? 'Continue' : 'Start Lesson'
                    })()}
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
                const noteText = lessonNotes[lessonKey] || ''
                const isEditingThisNote = editingNote === lessonKey
                
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
                      
                      {/* Facilitator Notes Section */}
                      {noteText && !isEditingThisNote && (
                        <div style={{
                          marginTop: 8,
                          padding: 8,
                          background: '#fef3c7',
                          borderRadius: 6,
                          fontSize: 13,
                          color: '#92400e'
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>📝 Facilitator Note:</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{noteText}</div>
                        </div>
                      )}
                      
                      {/* Notes Editing Section */}
                      {isEditingThisNote && (
                        <div style={{ marginTop: 8 }}>
                          <textarea
                            defaultValue={noteText}
                            placeholder="Add facilitator notes..."
                            autoFocus
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              fontSize: 13,
                              fontFamily: 'inherit',
                              resize: 'vertical',
                              marginBottom: 8,
                              boxSizing: 'border-box'
                            }}
                            id={`note-${lessonKey}`}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => {
                                const textarea = document.getElementById(`note-${lessonKey}`)
                                saveNote(lessonKey, textarea?.value || '')
                              }}
                              disabled={saving}
                              style={{
                                padding: '6px 12px',
                                border: 'none',
                                borderRadius: 6,
                                background: '#2563eb',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: saving ? 'wait' : 'pointer'
                              }}
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingNote(null)}
                              disabled={saving}
                              style={{
                                padding: '6px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                background: '#fff',
                                color: '#374151',
                                fontSize: 13,
                                cursor: saving ? 'wait' : 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Action buttons container */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Notes button */}
                      {!isEditingThisNote && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setEditingNote(lessonKey)
                          }}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: 8,
                            background: noteText ? '#fef3c7' : '#fff',
                            color: '#374151',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                          title={noteText ? 'Edit facilitator note' : 'Add facilitator note'}
                        >
                          📝 Notes
                        </button>
                      )}
                      
                      {/* Start Lesson button */}
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
                        {lessonSnapshots[lessonKey] ? 'Continue' : 'Start Lesson'}
                      </button>
                    </div>
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
