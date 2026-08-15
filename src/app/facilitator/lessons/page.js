'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { resolveLibraryLessonState, resolveInitialLibraryLearner, LIBRARY_PRIMARY_ACTIONS } from '@/app/lib/facilitatorLessonLibraryState.mjs'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'
import { useLessonHistory } from '@/app/hooks/useLessonHistory'
import LessonHistoryModal from '@/app/components/LessonHistoryModal'

import { useFacilitatorSubjects } from '@/app/hooks/useFacilitatorSubjects'

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
  const { coreSubjects, subjectsWithoutGenerated: subjectDropdownOptions } = useFacilitatorSubjects({ includeGenerated: true })
  const [pinChecked, setPinChecked] = useState(false)
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState(null)
  const [allLessons, setAllLessons] = useState({}) // { subject: [lessons] }
  const [lessonLibraryScope, setLessonLibraryScope] = useState('owned') // owned | downloadable | all
  const [ownedLessonKeys, setOwnedLessonKeys] = useState({}) // { 'subject/file.json': true }
  const [downloadingLesson, setDownloadingLesson] = useState(null) // `${subject}/${file}`
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
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Used to force refresh at midnight and on schedule changes
  const [selectedLearner, setSelectedLearner] = useState(null) // Store full learner object
  const [learnerDataLoading, setLearnerDataLoading] = useState(false) // Loading learner-specific data
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const {
    sessions: lessonHistorySessions,
    events: lessonHistoryEvents,
    lastCompleted: lessonHistoryLastCompleted,
    inProgress: lessonHistoryInProgress,
    loading: lessonHistoryLoading,
    error: lessonHistoryError,
    refresh: refreshLessonHistory,
  } = useLessonHistory(selectedLearnerId, { limit: 150, refreshKey: refreshTrigger })

  const lessonTitleLookup = useMemo(() => {
    const map = {}
    Object.entries(allLessons || {}).forEach(([subject, lessons]) => {
      if (!Array.isArray(lessons)) return
      lessons.forEach((lesson) => {
        if (!lesson || !lesson.file) return
        const key = lesson.isGenerated ? `generated/${lesson.file}` : `${subject}/${lesson.file}`
        if (lesson.title) {
          map[key] = lesson.title
        }
      })
    })
    return map
  }, [allLessons])

  const formatDateOnly = (isoString) => {
    if (!isoString) return null
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return isoString
    }
  }

  const formatDateTime = (isoString) => {
    if (!isoString) return null
    try {
      const date = new Date(isoString)
      return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    } catch {
      return isoString
    }
  }

  // Set up midnight refresh timer
  useEffect(() => {
    const scheduleNextMidnightRefresh = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const msUntilMidnight = tomorrow.getTime() - now.getTime()
      
      const timer = setTimeout(() => {
        setRefreshTrigger(prev => prev + 1)
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
      setRefreshTrigger(prev => prev + 1)
    }, 2 * 60 * 1000)
    
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
          // Fetch learners
          const { data: learnersData } = await supabase.from('learners').select('*').order('created_at', { ascending: false })
          if (!cancelled && learnersData) {
            setLearners(learnersData)
            const onlyLearner = resolveInitialLibraryLearner(learnersData)
            if (onlyLearner) {
              setSelectedLearnerId(onlyLearner.id)
              setSelectedLearner(onlyLearner)
              if (onlyLearner?.grade) {
                const learnerGrade = String(onlyLearner.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
                setSelectedGrade(learnerGrade)
              }
            }
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

      const lessonsMap = {}

      // Start loading public lesson lists immediately (no auth needed) and do it in parallel.
      const publicSubjects = coreSubjects
      await Promise.all(
        publicSubjects.map(async (subject) => {
          try {
            const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { cache: 'no-store' })
            if (!res.ok) {
              lessonsMap[subject] = []
              return
            }
            const list = await res.json()
            lessonsMap[subject] = Array.isArray(list) ? list : []
          } catch {
            lessonsMap[subject] = []
          }
        })
      )

      // Initialize generated bucket even if we haven't loaded owned lessons yet.
      lessonsMap['generated'] = []

      // Publish public lessons ASAP so the library appears immediately.
      if (!cancelled) {
        setAllLessons({ ...lessonsMap })
        setLessonsLoading(false)
      }

      // Now load owned lessons (requires auth) and merge them in.
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        if (token) {
          const res = await fetch('/api/facilitator/lessons/list', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` }
          })

          if (res.ok) {
            const generatedList = await res.json()
            const sortedGeneratedList = (Array.isArray(generatedList) ? generatedList : []).sort((a, b) => {
              const timeA = new Date(a?.created_at || 0).getTime()
              const timeB = new Date(b?.created_at || 0).getTime()
              return timeB - timeA
            })

            const owned = {}
            for (const lesson of sortedGeneratedList) {
              const subj = (lesson?.subject || '').toString().toLowerCase() || 'math'
              const file = lesson?.file
              if (file) owned[`${subj}/${file}`] = true
            }
            if (!cancelled) setOwnedLessonKeys(owned)

            const merged = { ...lessonsMap, generated: [] }
            for (const lesson of sortedGeneratedList.slice().reverse()) {
              const subject = lesson.subject || 'math'
              const generatedLesson = { ...lesson, isGenerated: true }
              if (!merged[subject]) merged[subject] = []
              merged[subject].unshift(generatedLesson)
              merged['generated'].push(generatedLesson)
            }

            if (!cancelled) setAllLessons(merged)
          }
        }
      } catch {
        // Silent fail
      }
    })()
    return () => { cancelled = true }
  }, []) // Load once on mount

  async function refreshOwnedLessons() {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const res = await fetch('/api/facilitator/lessons/list', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return

      const generatedList = await res.json()
      const sortedGeneratedList = (Array.isArray(generatedList) ? generatedList : []).sort((a, b) => {
        const timeA = new Date(a?.created_at || 0).getTime()
        const timeB = new Date(b?.created_at || 0).getTime()
        return timeB - timeA
      })

      const owned = {}
      for (const lesson of sortedGeneratedList) {
        const subj = (lesson?.subject || '').toString().toLowerCase() || 'math'
        const file = lesson?.file
        if (file) owned[`${subj}/${file}`] = true
      }
      setOwnedLessonKeys(owned)

      setAllLessons((prev) => {
        const next = {}
        for (const [subject, lessons] of Object.entries(prev || {})) {
          if (!Array.isArray(lessons)) {
            next[subject] = lessons
            continue
          }
          next[subject] = lessons.filter((l) => !l?.isGenerated)
        }

        const ownedLessons = []
        for (const lesson of sortedGeneratedList.slice().reverse()) {
          const subject = lesson?.subject || 'math'
          const generatedLesson = { ...lesson, isGenerated: true }
          if (!next[subject]) next[subject] = []
          next[subject].unshift(generatedLesson)
          ownedLessons.unshift(generatedLesson)
        }

        next['generated'] = ownedLessons
        return next
      })
    } catch {
      // Silent fail
    }
  }

  async function downloadLesson(subject, file) {
    if (!subject || !file) return

    const key = `${subject}/${file}`
    setDownloadingLesson(key)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        alert('Not authenticated')
        return
      }

      const res = await fetch('/api/facilitator/lessons/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subject, file })
      })

      if (!res.ok) {
        let msg = 'Download failed'
        try {
          const data = await res.json()
          if (data?.error) msg = data.error
        } catch {}
        throw new Error(msg)
      }

      await refreshOwnedLessons()
    } catch (e) {
      alert(e?.message || 'Download failed')
    } finally {
      setDownloadingLesson(null)
    }
  }

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
        
        if (error) {
          const fallbackResult = await supabase.from('learners').select('grade').eq('id', selectedLearnerId).maybeSingle()
          data = fallbackResult.data
          error = fallbackResult.error
          if (error) {
            throw error
          }
        }
        
        let scheduled = {}
        let futureScheduled = {}
        try {
          const today = new Date().toISOString().split('T')[0]
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token
          
          if (token) {
            const scheduleResponse = await fetch(`/api/lesson-schedule?learnerId=${selectedLearnerId}&action=active`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
            if (scheduleResponse.ok) {
              const scheduleData = await scheduleResponse.json()
              const scheduledLessons = scheduleData.lessons || []
              
              scheduledLessons.forEach(item => {
                if (item.lesson_key) {
                  scheduled[item.lesson_key] = true
                }
              })
            }
            
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
              
              allScheduledLessons.forEach(item => {
                if (item.lesson_key && item.scheduled_date && item.scheduled_date > today) {
                  futureScheduled[item.lesson_key] = item.scheduled_date
                }
              })
            }
          }
        } catch (schedErr) {
          // Silent fail
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
              // Silent fail
            }
          }
          
          // Set grade filter to learner's grade
          if (data?.grade && selectedGrade === 'all') {
            const learnerGrade = String(data.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
            setSelectedGrade(learnerGrade)
          }
        }
        
        const medalsData = await getMedalsForLearner(selectedLearnerId)
        if (!cancelled) {
          setMedals(medalsData || {})
        }
      } catch (err) {
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

  function getFilteredLessons() {
    const filtered = []
    
    Object.entries(allLessons).forEach(([subject, lessons]) => {
      if (!Array.isArray(lessons)) return
      
      // Skip "generated" when "all subjects" is selected to avoid duplicates
      if (selectedSubject === 'all' && subject === 'generated') return
      
      // Apply subject filter
      if (selectedSubject !== 'all' && subject !== selectedSubject) return
      
      lessons.forEach(lesson => {
        const isOwned = lesson?.isGenerated === true
        const fileName = lesson?.file || null
        const ownedKey = isOwned
          ? `${(lesson?.subject || subject || '').toString().toLowerCase() || 'math'}/${fileName || ''}`
          : `${(subject || '').toString().toLowerCase()}/${fileName || ''}`
        const ownedByKey = Boolean(fileName && ownedLessonKeys?.[ownedKey])

        // If a public lesson has been downloaded (owned copy exists), hide the public entry.
        if (!isOwned && ownedByKey) return

        if (lessonLibraryScope === 'owned' && !isOwned) return
        if (lessonLibraryScope === 'downloadable' && isOwned) return

        const lessonKey = lesson.isGenerated 
          ? `generated/${lesson.file}` 
          : `${subject}/${lesson.file}`
        
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
        throw error
      }
    } catch (e) {
      alert('Failed to save note: ' + (e?.message || e?.hint || 'Unknown error'))
      setLessonNotes(lessonNotes)
    } finally {
      setSaving(false)
    }
  }

  if (!pinChecked || authLoading || loading) {
    return <main style={{ padding: '12px 24px' }}><p>Loading…</p></main>
  }

  const filteredLessons = getFilteredLessons()

  const SUBJECT_COLORS = {
    math:           { bg: '#eff6ff', text: '#1d4ed8', border: '#3b82f6' },
    science:        { bg: '#f0fdf4', text: '#166534', border: '#22c55e' },
    'language arts':{ bg: '#faf5ff', text: '#6b21a8', border: '#a855f7' },
    'social studies':{ bg: '#fffbeb', text: '#92400e', border: '#f59e0b' },
    history:        { bg: '#fffbeb', text: '#92400e', border: '#f59e0b' },
    generated:      { bg: '#eef2ff', text: '#3730a3', border: '#6366f1' },
  }
  const subjectAccent = (s) => (SUBJECT_COLORS[s?.toLowerCase()] || { bg: '#f9fafb', text: '#374151', border: '#9ca3af' })

  return (
    <>
      <main style={{ padding: 7, maxWidth: 1200, margin: '0 auto', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
        <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ marginTop: 0, marginBottom: 4, textAlign: 'left', fontSize: 22 }}>Lesson Library</h1>
              </div>
              <p style={{ color: '#6b7280', marginTop: 0, marginBottom: 0, textAlign: 'left', fontSize: 14 }}>
                Choose a learner to see what is ready, scheduled, or completed.
              </p>
            </div>
            <details style={{ position: 'relative' }}>
              <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '9px 13px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#374151', fontWeight: 700, fontSize: 13 }}>
                Advanced library tools
              </summary>
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 5, display: 'grid', gap: 6, minWidth: 210, padding: 8, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                <button type="button" onClick={() => router.push('/facilitator/lessons/edit?new=1')} style={{ textAlign: 'left', padding: '9px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>
                  New lesson from scratch
                </button>
                <button type="button" onClick={() => router.push('/facilitator/generator?advanced=1')} style={{ textAlign: 'left', padding: '9px 10px', border: '1px solid #dbeafe', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}>
                  Detailed lesson builder
                </button>
              </div>
            </details>
          </div>
        </div>
      
        <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
      
      {learners.length === 0 ? (
        <div style={{
          padding: 24,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            No learners found. <a href="/facilitator/learners/add" style={{ color: '#374151', fontWeight: 600 }}>Add a learner</a> first.
          </p>
        </div>
      ) : (
        <>
          {/* Learner Selection and Filters - Combined Row */}
          <div style={{ 
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '0 0 14px 0',
            marginBottom: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '8px 14px',
              borderBottom: '1px solid #f3f4f6',
              background: '#fafafa',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: '#9ca3af'
            }}>Filters</div>
            {/* Row 1: dropdowns */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '12px 14px 0' }}>
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
                  
                }}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  background: '#fff',
                  cursor: 'pointer',
                  minWidth: '180px',
                  flex: '2 1 180px'
                }}
              >
                <option value="">(Select learner)</option>
                {learners.map(learner => (
                  <option key={learner.id} value={learner.id}>
                    {learner.name} {learner.grade ? `(Grade ${learner.grade})` : ''}
                  </option>
                ))}
              </select>

              <button type="button" onClick={() => setAdvancedFiltersOpen(open => !open)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600 }}>
                {advancedFiltersOpen ? 'Hide filters' : 'Advanced filters'}
              </button>
            </div>

            {advancedFiltersOpen && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px 0' }}>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fff', cursor: 'pointer', minWidth: '130px', flex: '1 1 130px' }}
                >
                  <option value="all">All Subjects</option>
                  {subjectDropdownOptions.map(subject => (
                    <option key={subject} value={subject} style={{ textTransform: 'capitalize' }}>
                      {subject === 'language arts' ? 'Language Arts' : 
                       subject === 'social studies' ? 'Social Studies' :
                       subject.charAt(0).toUpperCase() + subject.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fff', cursor: 'pointer', minWidth: '110px', flex: '1 1 110px' }}
                >
                  <option value="all">All Grades</option>
                  {GRADES.map(grade => <option key={grade} value={grade}>Grade {grade}</option>)}
                </select>
                <select
                  value={lessonLibraryScope}
                  onChange={(e) => setLessonLibraryScope(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fff', cursor: 'pointer', minWidth: '130px', flex: '1 1 130px' }}
                >
                  <option value="owned">Owned</option>
                  <option value="downloadable">Downloadable</option>
                  <option value="all">All Lessons</option>
                </select>
              </div>
            )}

            {/* Row 2: search + action buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px 2px' }}>
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

              {!lessonsLoading && (
                <div style={{ 
                  fontSize: 13, 
                  color: '#6b7280',
                  padding: '0 4px',
                  whiteSpace: 'nowrap'
                }}>
                  {filteredLessons.length} lessons
                </div>
              )}
            </div>
          </div>

          {saving && <p style={{ color: '#555' }}>Saving...</p>}

          {/* Show appropriate state based on loading */}
          {lessonsLoading ? (
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
                borderTop: '4px solid #3b82f6',
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
              color: '#6b7280',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}>
              {Object.keys(allLessons).length === 0 
                ? 'Loading lessons...' 
                : 'No lessons match your filters'}
            </div>
          ) : (
            <div style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
              {filteredLessons.map(lesson => {
                const { lessonKey, subject, displayGrade } = lesson
                const learnerSelected = Boolean(selectedLearnerId)
                const isOwned = lesson?.isGenerated === true
                const fileName = lesson?.file || null
                const ownedKey = isOwned
                  ? `${(lesson?.subject || subject || '').toString().toLowerCase() || 'math'}/${fileName || ''}`
                  : `${(subject || '').toString().toLowerCase()}/${fileName || ''}`
                const ownedByKey = Boolean(fileName && ownedLessonKeys?.[ownedKey])
                const isDownloadableNotOwned = !isOwned && !ownedByKey
                const hasActiveKey = learnerSelected && !isDownloadableNotOwned && activeGoldenKeys[lessonKey] === true
                const medalInfo = learnerSelected && !isDownloadableNotOwned ? medals[lessonKey] : null
                const noteText = learnerSelected && !isDownloadableNotOwned ? (lessonNotes[lessonKey] || '') : ''
                const isEditingThisNote = learnerSelected && !isDownloadableNotOwned && editingNote === lessonKey
                const lastCompletedAt = learnerSelected && !isDownloadableNotOwned ? lessonHistoryLastCompleted?.[lessonKey] : null
                const inProgressAt = learnerSelected && !isDownloadableNotOwned ? lessonHistoryInProgress?.[lessonKey] : null
                const hasHistory = Boolean(learnerSelected && !isDownloadableNotOwned && (lastCompletedAt || inProgressAt))
                const libraryState = resolveLibraryLessonState({
                  lesson,
                  lessonKey,
                  learnerId: selectedLearnerId || '',
                  isDownloadableNotOwned,
                  availableLessons,
                  scheduledToday: scheduledLessons,
                  futureScheduledLessons,
                  inProgressLessons: lessonHistoryInProgress,
                  completedLessons: lessonHistoryLastCompleted,
                })
                const primaryLabel = libraryState.primaryActionType === LIBRARY_PRIMARY_ACTIONS.REVIEW
                  ? 'Review lesson'
                  : libraryState.primaryActionType === LIBRARY_PRIMARY_ACTIONS.DELIVERY
                    ? 'Choose session option'
                    : libraryState.primaryActionType === LIBRARY_PRIMARY_ACTIONS.DOWNLOAD
                      ? 'Download'
                      : ''
                
                return (
                  <div key={`${subject}-${lessonKey}`} data-library-row="true" data-state-key={libraryState.stateKey} style={{
                    padding: '13px 16px',
                    borderBottom: '1px solid #f3f4f6',
                    borderLeft: `3px solid ${subjectAccent(subject).border}`,
                    transition: 'background 0.15s'
                  }}>
                    {/* Main lesson info */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: 8,
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <div style={{ fontWeight: 600, color: '#111827', fontSize: 15, lineHeight: '1.3' }}>
                          {lesson.isGenerated && '✨ '}{lesson.title}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5, alignItems: 'center' }}>
                          {(() => {
                            const sc = subjectAccent(subject)
                            const subLabel = subject === 'language arts' ? 'Language Arts' :
                              subject === 'social studies' ? 'Social Studies' :
                              subject === 'generated' ? 'Generated' :
                              subject.charAt(0).toUpperCase() + subject.slice(1)
                            return (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}33` }}>
                                {subLabel}
                              </span>
                            )
                          })()}
                          {displayGrade && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
                              Grade {displayGrade}
                            </span>
                          )}
                          {lesson.difficulty && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
                              {lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#374151', fontSize: 13, marginTop: 6, fontWeight: 600 }}>
                          {libraryState.label}
                        </div>
                      </div>

                      {/* Primary action plus collapsed uncommon tools */}
                      <div style={{ 
                        display: 'flex', 
                        gap: 8,
                        alignItems: 'flex-start',
                        flexShrink: 0
                      }}>
                        {libraryState.primaryActionType === LIBRARY_PRIMARY_ACTIONS.DOWNLOAD ? (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              downloadLesson(subject, lesson.file)
                            }}
                            data-primary-action="download"
                            disabled={downloadingLesson === `${subject}/${lesson.file}`}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #3b82f6',
                              borderRadius: 4,
                              background: '#3b82f6',
                              color: '#fff',
                              fontSize: 12,
                              cursor: downloadingLesson === `${subject}/${lesson.file}` ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontWeight: 700
                            }}
                            title="Unlock this lesson to edit and assign"
                          >
                            {downloadingLesson === `${subject}/${lesson.file}` ? 'Downloading...' : primaryLabel}
                          </button>
                        ) : libraryState.primaryActionType !== LIBRARY_PRIMARY_ACTIONS.NONE && libraryState.href ? (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              router.push(libraryState.href)
                            }}
                            data-primary-action={libraryState.primaryActionType}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #111827',
                              borderRadius: 4,
                              background: '#111827',
                              color: '#fff',
                              fontSize: 12,
                              cursor: 'pointer',
                              fontWeight: 700
                            }}
                          >
                            {primaryLabel}
                          </button>
                        ) : null}

                        {!isDownloadableNotOwned && (
                          <details data-more-actions="true" style={{ position: 'relative' }}>
                            <summary style={{ listStyle: 'none', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              More
                            </summary>
                            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 4, display: 'grid', gap: 6, minWidth: 190, padding: 8, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                              <button type="button" onClick={() => router.push(`/facilitator/lessons/edit?key=${encodeURIComponent(lessonKey)}`)} style={{ textAlign: 'left', padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                                Edit
                              </button>
                              {learnerSelected && (
                                <button type="button" onClick={() => setEditingNote(isEditingThisNote ? null : lessonKey)} style={{ textAlign: 'left', padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 6, background: noteText ? '#fef3c7' : '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                                  {noteText ? 'Edit note' : 'Notes'}
                                </button>
                              )}
                              {learnerSelected && hasHistory && (
                                <button type="button" onClick={() => setShowHistoryModal(true)} style={{ textAlign: 'left', padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                                  Detailed history
                                </button>
                              )}
                              {learnerSelected && inProgressAt && (
                                <div style={{ padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#374151', fontSize: 12 }}>
                                  In progress since {formatDateTime(inProgressAt)}
                                </div>
                              )}
                              {learnerSelected && lastCompletedAt && (
                                <div style={{ padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#374151', fontSize: 12 }}>
                                  Last completed {formatDateOnly(lastCompletedAt)}
                                </div>
                              )}
                              {learnerSelected && medalInfo?.medalTier && (
                                <div style={{ padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#374151', fontSize: 12 }}>
                                  Medal: {emojiForTier(medalInfo.medalTier)} {medalInfo.bestPercent || 0}%
                                </div>
                              )}
                              {learnerSelected && hasActiveKey && (
                                <div style={{ padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fefce8', color: '#854d0e', fontSize: 12 }}>
                                  Golden Key active
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
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

                  </div>
                )
              })}
            </div>
          )}
          </>
          )}
        </>
      )}
        </div>

      <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
      <div
        onClick={() => router.push('/facilitator/calendar')}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && router.push('/facilitator/calendar')}
        style={{
          marginTop: 32,
          padding: '16px 20px',
          border: '1px solid #dbeafe',
          borderRadius: 12,
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e40af', marginBottom: 4 }}>
            📅 Want to generate whole weeks of lessons at once?
          </div>
          <div style={{ fontSize: 13, color: '#4b5563' }}>
            The Lesson Planner builds a full curriculum calendar for you — automatically.
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap' }}>
          Open Planner →
        </div>
      </div>
      </div>
    </main>

    <LessonHistoryModal
      open={showHistoryModal}
      onClose={() => setShowHistoryModal(false)}
      sessions={lessonHistorySessions}
      events={lessonHistoryEvents}
      medals={medals}
      loading={lessonHistoryLoading}
      error={lessonHistoryError}
      onRefresh={refreshLessonHistory}
      titleLookup={(lessonId) => lessonTitleLookup[lessonId]}
    />

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
