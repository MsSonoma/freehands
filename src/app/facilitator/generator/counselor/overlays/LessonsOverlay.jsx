// Compact lessons list view for Mr. Mentor overlay
'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import LessonEditor from '@/components/LessonEditor'
import { useLessonHistory } from '@/app/hooks/useLessonHistory'
import LessonHistoryModal from '@/app/components/LessonHistoryModal'

const SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general', 'generated']
const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

function normalizeApprovedLessonKeys(raw) {
  const normalized = {}
  let changed = false

  if (Array.isArray(raw)) {
    for (const key of raw) {
      if (typeof key !== 'string' || !key) continue
      let finalKey = key
      if (key.startsWith('Facilitator Lessons/')) {
        finalKey = `general/${key.slice('Facilitator Lessons/'.length)}`
        changed = true
      }
      if (finalKey !== key) changed = true
      normalized[finalKey] = true
    }
    if (raw.length > 0) changed = true
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([key, value]) => {
      if (!value || typeof key !== 'string' || !key) return
      let finalKey = key
      if (key.startsWith('Facilitator Lessons/')) {
        finalKey = `general/${key.slice('Facilitator Lessons/'.length)}`
        changed = true
      }
      if (finalKey !== key) changed = true
      normalized[finalKey] = true
    })
  }

  return { normalized, changed }
}

export default function LessonsOverlay({ learnerId }) {
  const router = useRouter()
  const [allLessons, setAllLessons] = useState({})
  const [approvedLessons, setApprovedLessons] = useState({})
  const [lessonNotes, setLessonNotes] = useState({})
  const [scheduledLessons, setScheduledLessons] = useState({})
  const [futureScheduledLessons, setFutureScheduledLessons] = useState({})
  const [medals, setMedals] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [editingNote, setEditingNote] = useState(null)
  const [editingLesson, setEditingLesson] = useState(null) // Track which lesson is being edited
  const [lessonEditorData, setLessonEditorData] = useState(null) // Hold lesson data for editing
  const [lessonEditorLoading, setLessonEditorLoading] = useState(false)
  const [lessonEditorSaving, setLessonEditorSaving] = useState(false)
  const [schedulingLesson, setSchedulingLesson] = useState(null)
  const [learnerDataLoading, setLearnerDataLoading] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const {
    sessions: lessonHistorySessions,
    events: lessonHistoryEvents,
    lastCompleted: lessonHistoryLastCompleted,
    inProgress: lessonHistoryInProgress,
    loading: lessonHistoryLoading,
    error: lessonHistoryError,
    refresh: refreshLessonHistory,
  } = useLessonHistory(learnerId, { limit: 150 })

  const completedLessonCount = useMemo(() => Object.keys(lessonHistoryLastCompleted || {}).length, [lessonHistoryLastCompleted])
  const activeLessonCount = useMemo(() => Object.keys(lessonHistoryInProgress || {}).length, [lessonHistoryInProgress])

  const lessonTitleLookup = useMemo(() => {
    const map = {}
    Object.entries(allLessons || {}).forEach(([subject, lessons]) => {
      if (!Array.isArray(lessons)) return
      lessons.forEach((lesson) => {
        if (!lesson || !lesson.file) return
        const key = lesson.isGenerated ? `generated/${lesson.file}` : `${subject}/${lesson.file}`
        if (!map[key] && lesson.title) {
          map[key] = lesson.title
        }
      })
    })
    return map
  }, [allLessons])

  const formatDateOnly = useCallback((isoString) => {
    if (!isoString) return null
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return isoString
    }
  }, [])

  const formatDateTime = useCallback((isoString) => {
    if (!isoString) return null
    try {
      const date = new Date(isoString)
      return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    } catch {
      return isoString
    }
  }, [])

  const isLearnerScoped = Boolean(learnerId && learnerId !== 'none')
  const subjectOptions = useMemo(
    () => (isLearnerScoped ? SUBJECTS.filter(subject => subject !== 'generated') : SUBJECTS),
    [isLearnerScoped]
  )

  useEffect(() => {
    if (selectedSubject === 'generated' && !subjectOptions.includes('generated')) {
      setSelectedSubject('all')
    }
  }, [selectedSubject, subjectOptions])

  useEffect(() => {
    setAllLessons(prev => (Object.keys(prev).length === 0 ? prev : {}))
  }, [isLearnerScoped])

  const loadLessons = useCallback(async () => {
    if (Object.keys(allLessons).length > 0) {
      console.log('[LessonsOverlay] Lessons already loaded, skipping')
      return
    }

    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      console.log('[LessonsOverlay] Session token available:', !!token)

      const results = {}
      const subjectsToFetch = isLearnerScoped
        ? SUBJECTS.filter(subject => subject !== 'generated')
        : SUBJECTS

      for (const subject of subjectsToFetch) {
        try {
          console.log(`[LessonsOverlay] Fetching lessons for subject: ${subject}`)
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, {
            cache: 'no-store'
          })
          console.log(`[LessonsOverlay] Response for ${subject}:`, res.status, res.ok)
          if (!res.ok) {
            if (res.status === 401) {
              console.log(`[LessonsOverlay] No access to ${subject} lessons (authentication required)`)
              results[subject] = []
              continue
            }
            let errorDetail = ''
            try {
              const errorData = await res.json()
              errorDetail = errorData.detail || errorData.error || ''
            } catch {}
            console.error(`Failed to load ${subject} lessons:`, res.status, errorDetail)
            results[subject] = []
            continue
          }
          const list = await res.json()
          results[subject] = Array.isArray(list) ? list : []
          console.log(`[LessonsOverlay] Loaded ${results[subject].length} lessons for ${subject}`)
        } catch (err) {
          console.error(`Error loading ${subject} lessons:`, err)
          results[subject] = []
        }
      }

      if (token && !isLearnerScoped) {
        try {
          console.log('[LessonsOverlay] Fetching generated lessons')
          const res = await fetch('/api/facilitator/lessons/list', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` }
          })
          console.log('[LessonsOverlay] Generated lessons response:', res.status, res.ok)
          if (res.ok) {
            const generatedList = await res.json()
            console.log('[LessonsOverlay] Generated lessons:', generatedList.length)
            const sortedGeneratedList = generatedList.sort((a, b) => {
              const timeA = new Date(a.created_at || 0).getTime()
              const timeB = new Date(b.created_at || 0).getTime()
              return timeB - timeA
            })

            if (!results['generated']) results['generated'] = []

            for (const lesson of sortedGeneratedList) {
              const subject = lesson.subject || 'math'
              const generatedLesson = {
                ...lesson,
                isGenerated: true
              }

              if (!results[subject]) results[subject] = []
              results[subject].unshift(generatedLesson)
              results['generated'].push(generatedLesson)
            }
          }
        } catch (err) {
          console.error('Error loading generated lessons:', err)
        }
      } else if (isLearnerScoped) {
        console.log('[LessonsOverlay] Skipping generated lessons fetch for learner-specific view')
      }

      console.log('[LessonsOverlay] All lessons loaded:', Object.keys(results).map(s => `${s}: ${results[s].length}`))
      setAllLessons(results)
    } catch (err) {
      console.error('Failed to load lessons:', err)
    } finally {
      setLoading(false)
    }
  }, [allLessons, isLearnerScoped])

  const loadLearnerData = useCallback(async () => {
    if (!learnerId || learnerId === 'none') {
      setApprovedLessons({})
      setLessonNotes({})
      setScheduledLessons({})
      setFutureScheduledLessons({})
      setMedals({})
      return
    }
    
    setLearnerDataLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Load approved lessons, notes, and grade
      const { data: approvedData } = await supabase
        .from('learners')
        .select('approved_lessons, lesson_notes, grade')
        .eq('id', learnerId)
        .maybeSingle()

      const { normalized: approvedMap, changed: approvedChanged } = normalizeApprovedLessonKeys(approvedData?.approved_lessons)
      setApprovedLessons(approvedMap)

      if (approvedChanged) {
        try {
          await supabase.from('learners').update({ approved_lessons: approvedMap }).eq('id', learnerId)
        } catch (normErr) {
          console.warn('[LessonsOverlay] Failed to normalize approved lesson keys:', normErr)
        }
      }

      setLessonNotes(approvedData?.lesson_notes || {})

      // Set grade filter to learner's grade
      if (approvedData?.grade && selectedGrade === 'all') {
        const learnerGrade = String(approvedData.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
        setSelectedGrade(learnerGrade)
      }

      // Load scheduled lessons
      try {
        const today = new Date().toISOString().split('T')[0]
        const token = session?.access_token
        
        if (token) {
          // Get today's scheduled lessons
          const scheduleResponse = await fetch(`/api/lesson-schedule?learnerId=${learnerId}&action=active`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (scheduleResponse.ok) {
            const scheduleData = await scheduleResponse.json()
            const scheduledLessons = scheduleData.lessons || []
            const scheduled = {}
            scheduledLessons.forEach(item => {
              if (item.lesson_key) {
                scheduled[item.lesson_key] = true
              }
            })
            setScheduledLessons(scheduled)
          }

          // Get future scheduled lessons
          const futureEnd = new Date()
          futureEnd.setFullYear(futureEnd.getFullYear() + 1)
          const allScheduleResponse = await fetch(`/api/lesson-schedule?learnerId=${learnerId}&startDate=${today}&endDate=${futureEnd.toISOString().split('T')[0]}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (allScheduleResponse.ok) {
            const allScheduleData = await allScheduleResponse.json()
            const allScheduledLessons = allScheduleData.schedule || []
            const futureScheduled = {}
            allScheduledLessons.forEach(item => {
              if (item.lesson_key && item.scheduled_date && item.scheduled_date > today) {
                futureScheduled[item.lesson_key] = item.scheduled_date
              }
            })
            setFutureScheduledLessons(futureScheduled)
          }
        }
      } catch (schedErr) {
        console.warn('[LessonsOverlay] Could not load scheduled lessons:', schedErr)
      }

      // Load medals
      const medalsData = await getMedalsForLearner(learnerId)
      setMedals(medalsData || {})
    } catch (err) {
      console.error('Failed to load learner data:', err)
      setApprovedLessons({})
      setLessonNotes({})
      setScheduledLessons({})
      setFutureScheduledLessons({})
      setMedals({})
    } finally {
      setLearnerDataLoading(false)
    }
  }, [learnerId, selectedGrade])

  // Listen for preload event to trigger initial load
  useEffect(() => {
    const handlePreload = () => {
      console.log('[LessonsOverlay] Received preload event, loading data')
      loadLessons()
      if (learnerId && learnerId !== 'none') {
        loadLearnerData()
      }
    }
    
    const handleLessonGenerated = () => {
      console.log('[LessonsOverlay] Lesson generated, reloading')
      // Clear cache and reload
      setAllLessons({})
      loadLessons()
    }
    
    window.addEventListener('preload-overlays', handlePreload)
    window.addEventListener('mr-mentor:lesson-generated', handleLessonGenerated)
    return () => {
      window.removeEventListener('preload-overlays', handlePreload)
      window.removeEventListener('mr-mentor:lesson-generated', handleLessonGenerated)
    }
  }, [learnerId, loadLessons, loadLearnerData])

  // Load learner data when learner changes
  useEffect(() => {
    if (learnerId && learnerId !== 'none') {
      loadLearnerData()
    } else {
      setApprovedLessons({})
      setLessonNotes({})
      setScheduledLessons({})
      setFutureScheduledLessons({})
      setMedals({})
    }
  }, [learnerId, loadLearnerData])

  const getFilteredLessons = () => {
    const filtered = []
    
    Object.entries(allLessons).forEach(([subject, lessons]) => {
      if (!Array.isArray(lessons)) return
      
      // Skip 'generated' when 'all subjects' is selected to avoid duplicates
      if (selectedSubject === 'all' && subject === 'generated') return
      
      // Apply subject filter
      if (selectedSubject !== 'all' && subject !== selectedSubject) return
      
      lessons.forEach(lesson => {
        const lessonKey = lesson.isGenerated 
          ? `generated/${lesson.file}` 
          : `${subject}/${lesson.file}`
        
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

  const saveNote = async (lessonKey, noteText) => {
    if (!learnerId || learnerId === 'none') return
    
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
      if (error) throw error
      console.log('[LessonsOverlay] Successfully saved note for lesson:', lessonKey)
    } catch (e) {
      console.error('[LessonsOverlay] Failed to save note:', e)
      alert('Failed to save note')
      setLessonNotes(lessonNotes) // Revert
    } finally {
      setSaving(false)
    }
  }

  const loadLessonForEditing = async (lessonKey) => {
    setEditingLesson(lessonKey)
    setLessonEditorLoading(true)
    setLessonEditorData(null)
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const res = await fetch(`/api/lesson-file?key=${encodeURIComponent(lessonKey)}`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      })
      
      if (!res.ok) {
        throw new Error('Failed to load lesson')
      }
      
      const lessonData = await res.json()
      setLessonEditorData(lessonData)
    } catch (err) {
      console.error('[LessonsOverlay] Failed to load lesson for editing:', err)
      alert('Failed to load lesson: ' + err.message)
      setEditingLesson(null)
    } finally {
      setLessonEditorLoading(false)
    }
  }

  const saveLessonEdits = async (updatedLesson) => {
    if (!editingLesson) return
    
    setLessonEditorSaving(true)
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const res = await fetch('/api/lesson-edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          lessonKey: editingLesson,
          updates: updatedLesson
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save lesson')
      }
      
      // Success - close editor
      setEditingLesson(null)
      setLessonEditorData(null)
      // Don't navigate away - just show success message
      console.log('[LessonsOverlay] Lesson saved successfully')
    } catch (err) {
      console.error('[LessonsOverlay] Failed to save lesson:', err)
      alert('Failed to save lesson: ' + err.message)
    } finally {
      setLessonEditorSaving(false)
    }
  }

  const scheduleLesson = async (lessonKey, scheduledDate) => {
    if (!learnerId || learnerId === 'none') return
    
    setSaving(true)
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
          learnerId: learnerId,
          lessonKey: lessonKey,
          scheduledDate: scheduledDate
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to schedule')
      }

      // Refresh learner data to update calendar emoji
      await loadLearnerData()
      setSchedulingLesson(null)
      alert(`Lesson scheduled for ${scheduledDate}`)
    } catch (e) {
      console.error('[LessonsOverlay] Failed to schedule:', e)
      alert('Failed to schedule: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleLessonApproval = useCallback(async (lessonKey) => {
    if (!learnerId || learnerId === 'none') return

    const previous = { ...approvedLessons }
    const legacyKey = lessonKey.replace('general/', 'facilitator/')
    const next = { ...previous }
    const isCurrentlyApproved = !!next[lessonKey] || !!next[legacyKey]

    if (isCurrentlyApproved) {
      delete next[lessonKey]
      delete next[legacyKey]
    } else {
      next[lessonKey] = true
    }

    setApprovedLessons(next)
    setSaving(true)

    try {
      const supabase = getSupabaseClient()
      if (!supabase) throw new Error('Not authenticated')
      const { error } = await supabase.from('learners').update({ approved_lessons: next }).eq('id', learnerId)
      if (error) throw error
    } catch (err) {
      console.error('[LessonsOverlay] Failed to update lesson availability:', err)
      alert('Failed to update lesson availability. Please try again.')
      setApprovedLessons(previous)
    } finally {
      setSaving(false)
    }
  }, [approvedLessons, learnerId])

  const filteredLessons = getFilteredLessons()

  return (
    <div style={{ 
      height: '100%', 
      background: '#fff', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      border: '1px solid #6b7280',
      borderRadius: 8
    }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px', 
        background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
          📚 Lessons
        </div>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: '1',
              minWidth: '120px',
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 12,
              background: '#fff'
            }}
          />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            style={{
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 12,
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Subjects</option>
            {subjectOptions.map(subject => (
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
            style={{
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 12,
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Grades</option>
            {GRADES.map(grade => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>
          {isLearnerScoped && (
            <button
              onClick={() => setShowHistoryModal(true)}
              style={{
                padding: '6px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: '#fff',
                color: '#1f2937',
                fontSize: 12,
                fontWeight: 600,
                cursor: lessonHistoryLoading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap'
              }}
              disabled={lessonHistoryLoading && !lessonHistorySessions.length}
              title={lessonHistoryLoading ? 'Loading history…' : 'View completed lessons'}
            >
              ✅ Completed{completedLessonCount ? ` (${completedLessonCount})` : ''}
              {activeLessonCount > 0 && (
                <span style={{ fontSize: 11, color: '#d97706' }}>⏳ {activeLessonCount}</span>
              )}
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
          {filteredLessons.length} lessons
        </div>
      </div>

      {/* Lessons List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 12 }}>
            Loading lessons...
          </div>
        ) : filteredLessons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 12 }}>
            {Object.keys(allLessons).length === 0 
              ? 'No lessons loaded' 
              : 'No lessons match your filters'}
          </div>
        ) : (
          <div>
            {filteredLessons.map(lesson => {
              const { lessonKey, subject, displayGrade } = lesson
              const legacyKey = lessonKey.replace('general/', 'facilitator/')
              const isApproved = !!approvedLessons[lessonKey] || !!approvedLessons[legacyKey]
              const isScheduled = scheduledLessons[lessonKey]
              const futureDate = futureScheduledLessons[lessonKey]
              const medal = medals[lessonKey]
              const noteText = lessonNotes[lessonKey] || ''
              const isEditingThisNote = editingNote === lessonKey
              const isSchedulingThis = schedulingLesson === lessonKey
              const lastCompletedAt = lessonHistoryLastCompleted?.[lessonKey]
              const inProgressAt = lessonHistoryInProgress?.[lessonKey]
              const hasHistory = Boolean(lastCompletedAt || inProgressAt)

              return (
                <div
                  key={`${subject}-${lessonKey}`}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f3f4f6',
                    background: isApproved ? '#f0fdf4' : '#fff'
                  }}
                >
                  {/* Main lesson info with floating buttons */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: 6,
                    flexWrap: 'wrap'
                  }}>
                    <input
                      type="checkbox"
                      checked={isApproved}
                      onChange={() => toggleLessonApproval(lessonKey)}
                      disabled={saving || !learnerId || learnerId === 'none'}
                      style={{
                        marginTop: 2,
                        cursor: (saving || !learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer',
                        width: 16,
                        height: 16
                      }}
                      title="Show this lesson to learner"
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      {isScheduled && <span style={{ fontSize: 12 }} title="Scheduled for today">📅</span>}
                      {!isScheduled && futureDate && <span style={{ fontSize: 12, opacity: 0.5 }} title={`Scheduled for ${futureDate}`}>📅</span>}
                      {medal && <span style={{ fontSize: 14 }}>{emojiForTier(medal.medalTier)}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 12 }}>
                        {lesson.isGenerated && '✨ '}{lesson.title}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: 11 }}>
                        {subject === 'language arts' ? 'Language Arts' : 
                         subject === 'social studies' ? 'Social Studies' :
                         subject.charAt(0).toUpperCase() + subject.slice(1)}
                        {displayGrade && ` • Grade ${displayGrade}`}
                        {lesson.difficulty && ` • ${lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}`}
                      </div>
                      {hasHistory && (
                        <div style={{ color: '#4b5563', fontSize: 11, marginTop: 3 }}>
                          {inProgressAt && (
                            <span>In progress since {formatDateTime(inProgressAt)}</span>
                          )}
                          {inProgressAt && lastCompletedAt && <span> • </span>}
                          {lastCompletedAt && (
                            <span>Last completed {formatDateOnly(lastCompletedAt)}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Compact action buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        loadLessonForEditing(lessonKey)
                      }}
                      style={{
                        padding: '3px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: '#fff',
                        color: '#6b7280',
                        fontSize: 11,
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
                        e.stopPropagation()
                        setEditingNote(isEditingThisNote ? null : lessonKey)
                      }}
                      style={{
                        padding: '3px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: noteText ? '#fef3c7' : '#fff',
                        color: '#6b7280',
                        fontSize: 11,
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
                        e.stopPropagation()
                        setSchedulingLesson(isSchedulingThis ? null : lessonKey)
                      }}
                      style={{
                        padding: '3px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: '#fff',
                        color: '#6b7280',
                        fontSize: 11,
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
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                      <textarea
                        defaultValue={noteText}
                        placeholder="Add notes..."
                        autoFocus
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          marginBottom: 6,
                          boxSizing: 'border-box'
                        }}
                        id={`note-${lessonKey}`}
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => {
                            const textarea = document.getElementById(`note-${lessonKey}`)
                            saveNote(lessonKey, textarea?.value || '')
                          }}
                          disabled={saving}
                          style={{
                            padding: '4px 10px',
                            border: 'none',
                            borderRadius: 4,
                            background: '#2563eb',
                            color: '#fff',
                            fontSize: 11,
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
                            padding: '4px 10px',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            background: '#fff',
                            color: '#374151',
                            fontSize: 11,
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
                      onClick={() => setSchedulingLesson(null)}
                    >
                      <div 
                        style={{
                          background: '#fff',
                          borderRadius: 8,
                          padding: 16,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                          maxWidth: 280,
                          width: '90%'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>
                          📅 Schedule Lesson
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                          {lesson.title}
                        </div>
                        
                        <input
                          type="date"
                          defaultValue={new Date().toISOString().split('T')[0]}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            fontSize: 13,
                            marginBottom: 12,
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
                              padding: '8px',
                              border: 'none',
                              borderRadius: 6,
                              background: '#2563eb',
                              color: '#fff',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: saving ? 'wait' : 'pointer'
                            }}
                          >
                            {saving ? 'Scheduling...' : 'Schedule'}
                          </button>
                          <button
                            onClick={() => setSchedulingLesson(null)}
                            disabled={saving}
                            style={{
                              flex: 1,
                              padding: '8px',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              background: '#fff',
                              color: '#374151',
                              fontSize: 13,
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
      </div>

      {/* Full Lesson Editor Overlay */}
      {editingLesson && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            overflow: 'auto'
          }}
          onClick={(e) => {
            // Only close if clicking the backdrop, not the editor itself
            if (e.target === e.currentTarget && !lessonEditorSaving) {
              if (window.confirm('Close editor without saving?')) {
                setEditingLesson(null)
                setLessonEditorData(null)
              }
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              width: '100%',
              height: '100%',
              boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              zIndex: 1002,
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {lessonEditorLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#6b7280', fontSize: 16 }}>
                Loading lesson data...
              </div>
            ) : lessonEditorData ? (
              <LessonEditor
                initialLesson={lessonEditorData}
                onSave={saveLessonEdits}
                onCancel={() => {
                  if (window.confirm('Close editor without saving?')) {
                    setEditingLesson(null)
                    setLessonEditorData(null)
                  }
                }}
                busy={lessonEditorSaving}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: '#ef4444', fontSize: 16 }}>
                Failed to load lesson data
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
  )
}
