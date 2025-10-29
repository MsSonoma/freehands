﻿'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'

const SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general', 'generated']
const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

function normalizeApprovedLessonKeys(map = {}) {
  let changed = false
  const normalized = {}
  Object.entries(map || {}).forEach(([key, value]) => {
    if (typeof key === 'string' && key.startsWith('Facilitator Lessons/')) {
      const suffix = key.slice('Facilitator Lessons/'.length)
      const normalizedKey = `general/${suffix}`
      normalized[normalizedKey] = value
      changed = true
    } else if (key) {
      normalized[key] = value
    }
  })
  return { normalized, changed }
}

export default function FacilitatorLessonsPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true })
  const [pinChecked, setPinChecked] = useState(false)
  const [tier, setTier] = useState('free')
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState(null)
  const [allLessons, setAllLessons] = useState({}) // { subject: [lessons] }
  const [availableLessons, setAvailableLessons] = useState({}) // { 'subject/lesson_file': true } - lessons shown to learner
  const [scheduledLessons, setScheduledLessons] = useState({}) // { 'subject/lesson_file': true } - lessons scheduled for today
  const [futureScheduledLessons, setFutureScheduledLessons] = useState({}) // { 'subject/lesson_file': 'YYYY-MM-DD' } - lessons scheduled for future dates
  const [activeGoldenKeys, setActiveGoldenKeys] = useState({}) // { 'subject/lesson_file': true }
  const [lessonNotes, setLessonNotes] = useState({}) // { 'subject/lesson_file': 'note text' }
  const [medals, setMedals] = useState({}) // { lesson_key: { bestPercent, medalTier } }
  const [loading, setLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [editingNote, setEditingNote] = useState(null) // lesson key currently being edited
  const [scheduling, setScheduling] = useState(null) // lesson key currently being scheduled
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Used to force refresh at midnight and on schedule changes
  const [selectedLearner, setSelectedLearner] = useState(null) // Store full learner object
  const [learnerDataLoading, setLearnerDataLoading] = useState(false) // Loading learner-specific data
  const [showLessons, setShowLessons] = useState(false) // Whether to show lessons list

  // Set up midnight refresh timer
  useEffect(() => {
    const scheduleNextMidnightRefresh = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const msUntilMidnight = tomorrow.getTime() - now.getTime()
      
      console.log('[Facilitator Lessons] Scheduling refresh in', Math.round(msUntilMidnight / 1000 / 60), 'minutes at midnight')
      
      const timer = setTimeout(() => {
        console.log('[Facilitator Lessons] Midnight refresh triggered')
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
    if (!selectedLearnerId) return
    
    const pollInterval = setInterval(() => {
      console.log('[Facilitator Lessons] Polling for schedule changes')
      setRefreshTrigger(prev => prev + 1)
    }, 2 * 60 * 1000) // 2 minutes
    
    return () => clearInterval(pollInterval)
  }, [selectedLearnerId])

  // Check PIN requirement on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page')
        if (!allowed) {
          router.push('/')
          return
        }
        if (!cancelled) setPinChecked(true)
      } catch (e) {
        if (!cancelled) setPinChecked(true)
      }
    })()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    if (!pinChecked) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data } = await supabase.from('profiles').select('plan_tier').eq('id', session.user.id).maybeSingle()
          if (!cancelled && data?.plan_tier) setTier((data.plan_tier || 'free').toLowerCase())
          
          // Fetch learners
          const { data: learnersData } = await supabase.from('learners').select('*').order('created_at', { ascending: false })
          if (!cancelled && learnersData) {
            setLearners(learnersData)
            // Don't auto-select a learner - let user choose
          }
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [pinChecked])

  // Load all lessons from all subjects immediately on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLessonsLoading(true)
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const lessonsMap = {}
      
      // Load lessons from public folders for each subject
      for (const subject of SUBJECTS) {
        try {
          console.log(`[FRONTEND] Fetching lessons for subject: ${subject}`);
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store'
          })
          console.log(`[FRONTEND] Response for ${subject}:`, res.status, res.ok);
          if (!res.ok) {
            // For "generated" subject, 401 is expected if not authenticated - don't log as error
            if (subject === 'generated' && res.status === 401) {
              console.log(`[FRONTEND] Generated lessons require authentication, skipping`);
              lessonsMap[subject] = []
              continue
            }
            let errorDetail = ''
            try {
              const errorData = await res.json()
              errorDetail = errorData.detail || errorData.error || ''
            } catch {}
            console.error(`[FRONTEND] Failed to load ${subject} lessons:`, res.status, errorDetail);
            lessonsMap[subject] = []
            continue
          }
          const list = await res.json()
          console.log(`[FRONTEND] Lessons for ${subject}:`, list.length);
          lessonsMap[subject] = Array.isArray(list) ? list : []
        } catch (err) {
          console.error(`[FRONTEND] Error fetching ${subject}:`, err);
          lessonsMap[subject] = []
        }
      }
      
      // Load generated lessons from user's storage
      if (token) {
        try {
          console.log('[FRONTEND] Fetching generated lessons')
          const res = await fetch('/api/facilitator/lessons/list', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` }
          })
          console.log('[FRONTEND] Generated lessons response:', res.status, res.ok)
          if (res.ok) {
            const generatedList = await res.json()
            console.log('[FRONTEND] Generated lessons:', generatedList.length)
            // Sort generated lessons by creation time, newest first
            const sortedGeneratedList = generatedList.sort((a, b) => {
              const timeA = new Date(a.created_at || 0).getTime()
              const timeB = new Date(b.created_at || 0).getTime()
              return timeB - timeA // Descending order (newest first)
            })
            
            // Initialize generated subject array
            if (!lessonsMap['generated']) lessonsMap['generated'] = []
            
            // Add generated lessons to BOTH their specific subject AND the "generated" subject
            for (const lesson of sortedGeneratedList) {
              const subject = lesson.subject || 'math'
              const generatedLesson = {
                ...lesson,
                isGenerated: true // Mark as generated for display
              }
              
              // Add to specific subject (at the beginning to keep newest first)
              if (!lessonsMap[subject]) lessonsMap[subject] = []
              lessonsMap[subject].unshift(generatedLesson)
              
              // Also add to "generated" subject for easy filtering
              lessonsMap['generated'].push(generatedLesson)
            }
          }
        } catch (err) {
          console.error('[FRONTEND] Error loading generated lessons:', err)
        }
      }
      
      console.log('[FRONTEND] All lessons loaded:', lessonsMap);
      if (!cancelled) {
        setAllLessons(lessonsMap)
        setLessonsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, []) // Load once on mount

  // Load data for selected learner - as soon as learner is selected (not waiting for button)
  useEffect(() => {
    if (!selectedLearnerId) {
      setActiveGoldenKeys({})
      setMedals({})
      setAvailableLessons({})
      setScheduledLessons({})
      setFutureScheduledLessons({})
      setLessonNotes({})
      return
    }
    let cancelled = false
    ;(async () => {
      setLearnerDataLoading(true)
      try {
        const supabase = getSupabaseClient()
        // Load active_golden_keys, lesson_notes, approved_lessons, and grade
        let data, error
        const result = await supabase.from('learners').select('active_golden_keys, lesson_notes, approved_lessons, grade').eq('id', selectedLearnerId).maybeSingle()
        data = result.data
        error = result.error
        
        // If error, try without newer columns (might not exist yet)
        if (error) {
          console.warn('[Facilitator Lessons] Error loading with all fields, trying without:', error)
          const fallbackResult = await supabase.from('learners').select('grade').eq('id', selectedLearnerId).maybeSingle()
          data = fallbackResult.data
          error = fallbackResult.error
          if (error) {
            console.error('[Facilitator Lessons] Load error:', error)
            throw error
          }
        }
        
        console.log('[Facilitator Lessons] Loaded data for learner:', selectedLearnerId, data)
        
        // Load scheduled lessons (today and future)
        let scheduled = {}
        let futureScheduled = {}
        try {
          const today = new Date().toISOString().split('T')[0]
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token
          
          if (!token) {
            console.warn('[Facilitator Lessons] No auth token available for schedule fetch')
          } else {
            // Get today's scheduled lessons
            const scheduleResponse = await fetch(`/api/lesson-schedule?learnerId=${selectedLearnerId}&action=active`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
            if (scheduleResponse.ok) {
              const scheduleData = await scheduleResponse.json()
              const scheduledLessons = scheduleData.lessons || []
              console.log('[Facilitator Lessons] Scheduled lessons for today:', scheduledLessons)
              
              // Track scheduled lessons separately - don't merge into approved
              scheduledLessons.forEach(item => {
                if (item.lesson_key) {
                  scheduled[item.lesson_key] = true
                }
              })
            } else {
              console.warn('[Facilitator Lessons] Schedule fetch failed:', scheduleResponse.status)
            }
            
            // Get all scheduled lessons for this learner (future dates)
            const futureEnd = new Date()
            futureEnd.setFullYear(futureEnd.getFullYear() + 1)
            const allScheduleResponse = await fetch(`/api/lesson-schedule?learnerId=${selectedLearnerId}&startDate=${today}&endDate=${futureEnd.toISOString().split('T')[0]}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
            if (allScheduleResponse.ok) {
              const allScheduleData = await allScheduleResponse.json()
              const allScheduledLessons = allScheduleData.schedule || []
              console.log('[Facilitator Lessons] All scheduled lessons:', allScheduledLessons)
              
              allScheduledLessons.forEach(item => {
                if (item.lesson_key && item.scheduled_date && item.scheduled_date > today) {
                  futureScheduled[item.lesson_key] = item.scheduled_date
                }
              })
            }
          }
        } catch (schedErr) {
          console.warn('[Facilitator Lessons] Could not load scheduled lessons:', schedErr)
        }
        
        if (!cancelled) {
          setScheduledLessons(scheduled)
          setFutureScheduledLessons(futureScheduled)
          setActiveGoldenKeys(data?.active_golden_keys || {})
          setLessonNotes(data?.lesson_notes || {})
          const { normalized: approvedNormalized, changed: approvedChanged } = normalizeApprovedLessonKeys(data?.approved_lessons || {})
          setAvailableLessons(approvedNormalized)
          if (approvedChanged) {
            try {
              await supabase.from('learners').update({ approved_lessons: approvedNormalized }).eq('id', selectedLearnerId)
            } catch (normalizeErr) {
              console.warn('[Facilitator Lessons] Failed to normalize approved lesson keys:', normalizeErr)
            }
          }
          
          // Set grade filter to learner's grade
          if (data?.grade && selectedGrade === 'all') {
            const learnerGrade = String(data.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
            setSelectedGrade(learnerGrade)
          }
        }
        
        // Fetch medals for this learner
        const medalsData = await getMedalsForLearner(selectedLearnerId)
        console.log('[Facilitator Lessons] Medals data:', medalsData, 'Keys:', Object.keys(medalsData || {}))
        if (!cancelled) {
          setMedals(medalsData || {})
        }
      } catch (err) {
        console.error('[Facilitator Lessons] Failed to load learner data:', err)
        setActiveGoldenKeys({})
        setGradeFilters({})
        setMedals({})
        setAvailableLessons({})
      } finally {
        if (!cancelled) setLearnerDataLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [selectedLearnerId, refreshTrigger]) // Load immediately when learner selected

  async function toggleAvailability(lessonKey) {
    if (!selectedLearnerId) return
    
    console.log('[toggleAvailability] Called with key:', lessonKey)
    
    try {
      setSaving(true)
      const supabase = getSupabaseClient()
      
      // Read current approved_lessons
      const { data: currentData } = await supabase
        .from('learners')
        .select('approved_lessons')
        .eq('id', selectedLearnerId)
        .maybeSingle()
      
      console.log('[toggleAvailability] Current data from DB:', currentData?.approved_lessons)
      
  const { normalized: currentApproved, changed } = normalizeApprovedLessonKeys(currentData?.approved_lessons || {})
      const newApproved = { ...currentApproved }
      
      console.log('[toggleAvailability] Normalized current approved:', currentApproved)
      console.log('[toggleAvailability] Key to toggle:', lessonKey)
      console.log('[toggleAvailability] Current state for this key:', newApproved[lessonKey])
      
      // Also check for legacy facilitator/ key
      const legacyKey = lessonKey.replace('general/', 'facilitator/')
      const isCurrentlyChecked = newApproved[lessonKey] || newApproved[legacyKey]
      
      // Toggle availability
      if (isCurrentlyChecked) {
        // Remove both the new key and any legacy key
        delete newApproved[lessonKey]
        delete newApproved[legacyKey]
        console.log('[toggleAvailability] Removed key:', lessonKey, '(and legacy key if existed)')
      } else {
        // Always add with the NEW key format (general/)
        newApproved[lessonKey] = true
        console.log('[toggleAvailability] Added key:', lessonKey)
      }
      
      console.log('[toggleAvailability] New approved lessons:', newApproved)
      
      // Update database
      const updatePayload = { approved_lessons: newApproved }
      if (changed) {
        updatePayload.approved_lessons = newApproved
      }
      const { error } = await supabase
        .from('learners')
        .update(updatePayload)
        .eq('id', selectedLearnerId)
      
      if (error) throw error
      
      console.log('[toggleAvailability] Successfully saved to database')
      
      // Update local state
  setAvailableLessons(newApproved)
    } catch (err) {
      console.error('[Facilitator Lessons] Failed to toggle lesson availability:', err)
    } finally {
      setSaving(false)
    }
  }

  function getFilteredLessons() {
    const filtered = []
    
    Object.entries(allLessons).forEach(([subject, lessons]) => {
      if (!Array.isArray(lessons)) return
      
      // Skip "generated" when "all subjects" is selected to avoid duplicates
      if (selectedSubject === 'all' && subject === 'generated') return
      
      // Apply subject filter
      if (selectedSubject !== 'all' && subject !== selectedSubject) return
      
      lessons.forEach(lesson => {
        // Check if lesson has medal data even if not in approved list
        const lessonKey = lesson.isGenerated 
          ? `generated/${lesson.file}` 
          : `${subject}/${lesson.file}`
        
        console.log('[getFilteredLessons] Lesson:', {
          title: lesson.title,
          subject,
          file: lesson.file,
          isGenerated: lesson.isGenerated,
          lessonKey
        })
        
        const hasMetalData = medals[lessonKey]
        
        // Normalize lesson grade
        let lessonGrade = null
        if (lesson.grade) {
          lessonGrade = String(lesson.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
        }
        
        // Apply grade filter
        if (selectedGrade !== 'all' && lessonGrade !== selectedGrade) return
        
        // Apply search filter
        const searchLower = searchTerm.toLowerCase()
        if (searchTerm && !lesson.title.toLowerCase().includes(searchLower)) return
        
        filtered.push({
          ...lesson,
          subject,
          lessonKey,
          displayGrade: lessonGrade
        })
      })
    })
    
    // Sort by subject, then grade, then title
    filtered.sort((a, b) => {
      if (a.subject !== b.subject) {
        return a.subject.localeCompare(b.subject)
      }
      if (a.displayGrade !== b.displayGrade) {
        // Handle K specially
        if (a.displayGrade === 'K') return -1
        if (b.displayGrade === 'K') return 1
        const numA = parseInt(a.displayGrade) || 0
        const numB = parseInt(b.displayGrade) || 0
        return numA - numB
      }
      return a.title.localeCompare(b.title)
    })
    
    return filtered
  }

  async function saveNote(lessonKey, noteText) {
    if (!selectedLearnerId) return
    
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
      const { error } = await supabase.from('learners').update({ lesson_notes: newNotes }).eq('id', selectedLearnerId)
      if (error) {
        console.error('[Facilitator Lessons] Note save error:', error)
        throw error
      }
      console.log('[Facilitator Lessons] Successfully saved note for lesson:', lessonKey)
    } catch (e) {
      console.error('[Facilitator Lessons] Failed to save note:', e)
      alert('Failed to save note: ' + (e?.message || e?.hint || 'Unknown error'))
      // Revert on error
      setLessonNotes(lessonNotes)
    } finally {
      setSaving(false)
    }
  }

  async function scheduleLesson(lessonKey, scheduledDate) {
    if (!scheduledDate) return
    
    setScheduling(lessonKey)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        alert('Not authenticated')
        return
      }

      const response = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learnerId: selectedLearnerId,
          lessonKey: lessonKey,
          scheduledDate: scheduledDate
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to schedule')
      }

      // Trigger refresh to update the calendar emoji
      setRefreshTrigger(prev => prev + 1)
      setScheduling(null)
      alert(`Lesson scheduled for ${scheduledDate}`)
    } catch (e) {
      console.error('[Facilitator Lessons] Failed to schedule:', e)
      alert('Failed to schedule: ' + e.message)
      setScheduling(null)
    }
  }

  const ent = featuresForTier(tier)

  if (!pinChecked || authLoading || loading) {
    return <main style={{ padding: '12px 24px' }}><p>Loading…</p></main>
  }

  const filteredLessons = getFilteredLessons()

  console.log('[Lessons Page] Rendering main content:', { loading, lessonsLoading, learnersCount: learners.length })

  return (
    <>
      <main style={{ padding: '12px 24px', maxWidth: 1200, margin: '0 auto', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>Manage Lessons</h1>
          <button
            onClick={() => router.push('/facilitator/generator/lesson-maker')}
            style={{
              padding: '10px 20px',
              background: '#111',
              color: '#fff',
              border: '1px solid #111',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Generate Lesson
          </button>
        </div>
      
      {learners.length === 0 ? (
        <div>
          <p>No learners found. <a href="/facilitator/learners/add">Add a learner</a> first.</p>
        </div>
      ) : (
        <>
          {/* Learner Selection and Filters - Combined Row */}
          <div style={{ 
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '16px',
            marginBottom: 24
          }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                id="learner-select"
                value={selectedLearnerId || ''}
                onChange={(e) => {
                  const learnerId = e.target.value
                  setSelectedLearnerId(learnerId)
                  const learner = learners.find(l => l.id === learnerId)
                  setSelectedLearner(learner)
                  
                  // Set grade filter to learner's grade
                  if (learner?.grade) {
                    const learnerGrade = String(learner.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
                    setSelectedGrade(learnerGrade)
                  }
                  
                  // Reset showLessons when changing learner
                  setShowLessons(false)
                }}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  background: '#fff',
                  cursor: 'pointer',
                  minWidth: '200px',
                  flex: '1 1 200px'
                }}
              >
                <option value="">(Select learner)</option>
                {learners.map(learner => (
                  <option key={learner.id} value={learner.id}>
                    {learner.name} {learner.grade ? `(Grade ${learner.grade})` : ''}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search lessons..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: '1 1 200px',
                  minWidth: '200px',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
              
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  background: '#fff',
                  cursor: 'pointer',
                  minWidth: '140px'
                }}
              >
                <option value="all">All Subjects</option>
                {SUBJECTS.map(subject => (
                  <option key={subject} value={subject} style={{ textTransform: 'capitalize' }}>
                    {subject === 'language arts' ? 'Language Arts' : 
                     subject === 'social studies' ? 'Social Studies' :
                     subject === 'generated' ? 'Generated' :
                     subject.charAt(0).toUpperCase() + subject.slice(1)}
                  </option>
                ))}
              </select>
              
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  background: '#fff',
                  cursor: 'pointer',
                  minWidth: '120px'
                }}
              >
                <option value="all">All Grades</option>
                {GRADES.map(grade => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>

              {!showLessons && (
                <button
                  onClick={() => setShowLessons(true)}
                  style={{
                    padding: '10px 24px',
                    background: '#111',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 14,
                    whiteSpace: 'nowrap'
                  }}
                >
                  Load Lessons
                </button>
              )}

              {showLessons && !lessonsLoading && (
                <div style={{ 
                  fontSize: 13, 
                  color: '#6b7280',
                  padding: '0 8px',
                  whiteSpace: 'nowrap'
                }}>
                  {filteredLessons.length} lessons
                </div>
              )}
            </div>
          </div>

          {saving && <p style={{ color: '#555' }}>Saving...</p>}

          {/* Show appropriate state based on loading */}
          {!selectedLearnerId ? (
            <div style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '48px 32px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: 16, marginBottom: 8 }}>
                Select a learner to begin
              </div>
            </div>
          ) : !showLessons ? (
            <div style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '48px 32px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: 16, marginBottom: 8 }}>
                Click &quot;Load Lessons&quot; to view lessons
              </div>
            </div>
          ) : lessonsLoading ? (
            <div style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '64px 32px',
              textAlign: 'center'
            }}>
              <div style={{
                width: 48,
                height: 48,
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #111',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}></div>
              <p style={{ color: '#6b7280', fontSize: 16, margin: 0 }}>Loading lessons...</p>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : (
            <>
          {/* Lessons List */}
          {filteredLessons.length === 0 ? (
            <div style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '32px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              {Object.keys(allLessons).length === 0 
                ? 'Loading lessons...' 
                : 'No lessons match your filters'}
            </div>
          ) : (
            <div style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              overflow: 'hidden'
            }}>
              {filteredLessons.map(lesson => {
                const { lessonKey, subject, displayGrade } = lesson
                const isScheduled = !!scheduledLessons[lessonKey]
                const futureDate = futureScheduledLessons[lessonKey]
                const hasActiveKey = activeGoldenKeys[lessonKey] === true
                const medalInfo = medals[lessonKey]
                const hasCompleted = medalInfo && medalInfo.bestPercent > 0
                const medalEmoji = medalInfo?.medalTier ? emojiForTier(medalInfo.medalTier) : null
                const noteText = lessonNotes[lessonKey] || ''
                const isEditingThisNote = editingNote === lessonKey
                const isSchedulingThis = scheduling === lessonKey
                
                return (
                  <div key={`${subject}-${lessonKey}`} style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    {/* Main lesson info with floating buttons */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: 8,
                      flexWrap: 'wrap'
                    }}>
                      {/* Checkbox for making lesson available to learner */}
                      <input
                        type="checkbox"
                        checked={!!availableLessons[lessonKey] || !!availableLessons[lessonKey.replace('general/', 'facilitator/')]}
                        onChange={() => toggleAvailability(lessonKey)}
                        disabled={saving}
                        style={{
                          marginTop: 4,
                          cursor: saving ? 'not-allowed' : 'pointer',
                          width: 18,
                          height: 18
                        }}
                        title="Show this lesson to learner"
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {isScheduled && <span style={{ fontSize: 14 }} title="Scheduled for today">📅</span>}
                        {!isScheduled && futureDate && <span style={{ fontSize: 14, opacity: 0.5 }} title={`Scheduled for ${futureDate}`}>📅</span>}
                        {hasActiveKey && <span style={{ fontSize: 14 }} title="Golden Key Active">🔑</span>}
                        {medalEmoji && <span style={{ fontSize: 16 }} title={`${medalInfo.medalTier} - ${medalInfo.bestPercent}%`}>{medalEmoji}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>
                          {lesson.isGenerated && '✨ '}{lesson.title}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
                          {subject === 'language arts' ? 'Language Arts' : 
                           subject === 'social studies' ? 'Social Studies' :
                           subject === 'generated' ? 'Generated' :
                           subject.charAt(0).toUpperCase() + subject.slice(1)}
                          {displayGrade && ` • Grade ${displayGrade}`}
                          {lesson.difficulty && ` • ${lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}`}
                          {hasCompleted && medalInfo.bestPercent && (
                            <span style={{ marginLeft: 8, color: '#059669' }}>
                              • Best: {medalInfo.bestPercent}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Compact action buttons */}
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          router.push(`/facilitator/lessons/edit?key=${encodeURIComponent(lessonKey)}`)
                        }}
                        style={{
                          padding: '4px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: '#fff',
                          color: '#6b7280',
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title="Edit lesson"
                      >
                        ✏️ Edit
                      </button>

                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setEditingNote(isEditingThisNote ? null : lessonKey)
                        }}
                        style={{
                          padding: '4px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: noteText ? '#fef3c7' : '#fff',
                          color: '#6b7280',
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title={noteText ? 'Edit note' : 'Add note'}
                      >
                        📝 {noteText ? 'Note' : 'Notes'}
                      </button>

                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setScheduling(isSchedulingThis ? null : lessonKey)
                        }}
                        style={{
                          padding: '4px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: '#fff',
                          color: '#6b7280',
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title="Schedule lesson"
                      >
                        📅 Calendar
                      </button>
                    </div>

                    {/* Notes editing section */}
                    {isEditingThisNote && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                        <textarea
                          defaultValue={noteText}
                          placeholder="Add notes..."
                          autoFocus
                          rows={2}
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
                            Save
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

                    {/* Schedule selector overlay */}
                    {isSchedulingThis && (
                      <div 
                        style={{ 
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10000
                        }}
                        onClick={() => setScheduling(null)}
                      >
                        <div 
                          style={{
                            background: '#fff',
                            borderRadius: 8,
                            padding: 20,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            maxWidth: 320,
                            width: '90%'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>
                            📅 Schedule Lesson
                          </div>
                          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                            {lesson.title}
                          </div>
                          
                          <input
                            type="date"
                            defaultValue={new Date().toISOString().split('T')[0]}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              fontSize: 14,
                              marginBottom: 16,
                              boxSizing: 'border-box'
                            }}
                            id={`schedule-date-${lessonKey}`}
                          />

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => {
                                const dateInput = document.getElementById(`schedule-date-${lessonKey}`)
                                if (dateInput?.value) {
                                  scheduleLesson(lessonKey, dateInput.value)
                                }
                              }}
                              disabled={saving}
                              style={{
                                flex: 1,
                                padding: '10px',
                                border: 'none',
                                borderRadius: 6,
                                background: '#2563eb',
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: saving ? 'wait' : 'pointer'
                              }}
                            >
                              {saving ? 'Scheduling...' : 'Schedule'}
                            </button>
                            <button
                              onClick={() => setScheduling(null)}
                              disabled={saving}
                              style={{
                                flex: 1,
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                background: '#fff',
                                color: '#374151',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: saving ? 'wait' : 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          </>
          )}
        </>
      )}
    </main>
    
    <GatedOverlay
      show={!isAuthenticated}
      gateType={gateType}
      feature="Lesson Library"
      emoji="📚"
      description="Sign in to access your personalized lesson library, approve lessons for learners, and track their progress."
      benefits={[
        'Browse and approve lessons by grade and subject',
        'Manage lesson access with Golden Keys',
        'Add personal notes for each lesson',
        'Track which lessons your learners have completed'
      ]}
    />
    </>
  )
}
