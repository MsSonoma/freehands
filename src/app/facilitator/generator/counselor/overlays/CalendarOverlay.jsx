// Compact calendar view for Mr. Mentor overlay
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import LessonGeneratorOverlay from '@/app/facilitator/calendar/LessonGeneratorOverlay'
import LessonPlanner from '@/app/facilitator/calendar/LessonPlanner'
import LessonEditor from '@/components/LessonEditor'
import LessonNotesModal from '@/app/facilitator/calendar/LessonNotesModal'
import VisualAidsManagerModal from '@/app/facilitator/calendar/VisualAidsManagerModal'
import TypedRemoveConfirmModal from '@/app/facilitator/calendar/TypedRemoveConfirmModal'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

export default function CalendarOverlay({ learnerId, learnerGrade, tier }) {
  const OVERLAY_Z_INDEX = 2147483647

  const getLocalTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const toLocalDateStr = (dateLike) => {
    const dt = new Date(dateLike)
    if (Number.isNaN(dt.getTime())) return null
    const year = dt.getFullYear()
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const addDaysToDateStr = (dateStr, days) => {
    try {
      const [y, m, d] = String(dateStr || '').split('-').map(n => Number(n))
      if (!y || !m || !d) return null
      const dt = new Date(y, m - 1, d)
      if (Number.isNaN(dt.getTime())) return null
      dt.setDate(dt.getDate() + Number(days || 0))
      const yy = dt.getFullYear()
      const mm = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      return `${yy}-${mm}-${dd}`
    } catch {
      return null
    }
  }

  const canonicalLessonId = (raw) => {
    if (!raw) return null
    const normalized = normalizeLessonKey(String(raw)) || String(raw)
    const base = normalized.includes('/') ? normalized.split('/').pop() : normalized
    const withoutExt = String(base || '').replace(/\.json$/i, '')
    return withoutExt || null
  }

  const [isMounted, setIsMounted] = useState(false)

  const [authToken, setAuthToken] = useState('')

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [scheduledLessons, setScheduledLessons] = useState({})
  const [scheduledForSelectedDate, setScheduledForSelectedDate] = useState([])
  const [plannedLessons, setPlannedLessons] = useState({})
  const [plannedForSelectedDate, setPlannedForSelectedDate] = useState([])
  const [tableExists, setTableExists] = useState(true)
  const [rescheduling, setRescheduling] = useState(null) // Track which lesson is being rescheduled
  const [listTab, setListTab] = useState('scheduled') // 'scheduled' | 'planned'

  const [showGenerator, setShowGenerator] = useState(false)
  const [generatorData, setGeneratorData] = useState(null)
  const [redoingLesson, setRedoingLesson] = useState(null)

  const [showPlannerOverlay, setShowPlannerOverlay] = useState(false)

  const [notesLesson, setNotesLesson] = useState(null)
  const [visualAidsLesson, setVisualAidsLesson] = useState(null)
  const [removeConfirmLesson, setRemoveConfirmLesson] = useState(null)

  const [editingLesson, setEditingLesson] = useState(null)
  const [lessonEditorLoading, setLessonEditorLoading] = useState(false)
  const [lessonEditorSaving, setLessonEditorSaving] = useState(false)
  const [lessonEditorData, setLessonEditorData] = useState(null)

  const scheduleLoadedForLearnerRef = useRef(null)
  const plannedLoadedForLearnerRef = useRef(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  
  const currentYear = currentMonth.getFullYear()
  const currentMonthIndex = currentMonth.getMonth()

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }
  
  const loadScheduleForLearner = useCallback(async (targetLearnerId) => {
    if (!targetLearnerId || targetLearnerId === 'none') {
      setScheduledLessons({})
      scheduleLoadedForLearnerRef.current = null
      return
    }

    // Skip reload if schedule already loaded for this learner
    if (scheduleLoadedForLearnerRef.current === targetLearnerId && Object.keys(scheduledLessons).length > 0) return
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (token) {
        setAuthToken((prev) => (prev === token ? prev : token))
      }

      if (!token) {
        setScheduledLessons({})
        return
      }

      // Get all scheduled lessons for this learner
      const response = await fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        setScheduledLessons({})
        return
      }

      const result = await response.json()
      const data = result.schedule || []

      const todayStr = getLocalTodayStr()

      // Build a completion lookup.
      // Past scheduled dates will show only completed lessons.
      // NOTE: Lessons may be completed after their scheduled date (make-up work).
      let completedKeySet = new Set()
      let completedDatesByLesson = new Map()
      let completionLookupFailed = false
      try {
        const pastSchedule = (data || []).filter(row => row?.scheduled_date && row.scheduled_date < todayStr)
        const minPastDate = pastSchedule.reduce((min, r) => (min && min < r.scheduled_date ? min : r.scheduled_date), null)

        if (pastSchedule.length > 0 && minPastDate) {
          const historyRes = await fetch(`/api/learner/lesson-history?learner_id=${targetLearnerId}`)
          const historyJson = await historyRes.json().catch(() => null)

          if (!historyRes.ok) {
            completionLookupFailed = true
          } else {
            const events = Array.isArray(historyJson?.events) ? historyJson.events : []
            for (const row of events) {
              if (row?.event_type && row.event_type !== 'completed') continue
              const completedDate = toLocalDateStr(row?.occurred_at)
              const key = canonicalLessonId(row?.lesson_id)
              if (!completedDate || !key) continue
              completedKeySet.add(`${key}|${completedDate}`)
              const prev = completedDatesByLesson.get(key) || []
              prev.push(completedDate)
              completedDatesByLesson.set(key, prev)
            }

            for (const [k, dates] of completedDatesByLesson.entries()) {
              const uniq = Array.from(new Set((dates || []).filter(Boolean))).sort()
              completedDatesByLesson.set(k, uniq)
            }
          }
        }
      } catch {
        completedKeySet = new Set()
        completedDatesByLesson = new Map()
        completionLookupFailed = true
      }

      const grouped = {}
      data.forEach(item => {
        const dateStr = item.scheduled_date
        const lessonKey = item.lesson_key
        if (!dateStr || !lessonKey) return

        const isPast = dateStr < todayStr
        const canonical = canonicalLessonId(lessonKey)
        const direct = canonical ? completedKeySet.has(`${canonical}|${dateStr}`) : false
        const windowEnd = addDaysToDateStr(dateStr, 7)
        const makeup = (() => {
          if (!canonical || !windowEnd) return false
          const dates = completedDatesByLesson.get(canonical) || []
          return dates.some(d => d > dateStr && d <= windowEnd)
        })()
        const completed = direct || makeup

        if (isPast && !completed && !completionLookupFailed) return

        if (!grouped[dateStr]) grouped[dateStr] = []
        grouped[dateStr].push({
          id: item.id, // Include the schedule ID
          facilitator_id: item.facilitator_id,
          lesson_title: item.lesson_key?.split('/')[1]?.replace('.json', '').replace(/_/g, ' ') || 'Lesson',
          subject: item.lesson_key?.split('/')[0] || 'Unknown',
          grade: 'Various',
          lesson_key: item.lesson_key,
          completed
        })
      })
      setScheduledLessons(grouped)
      setTableExists(true)
      scheduleLoadedForLearnerRef.current = targetLearnerId
    } catch (err) {
      setScheduledLessons({})
    }
  }, [scheduledLessons])

  const persistPlannedForDate = async (dateStr, lessonsForDate) => {
    if (!learnerId || learnerId === 'none') return false

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learnerId,
          plannedLessons: { [dateStr]: lessonsForDate }
        })
      })

      const js = await response.json().catch(() => null)
      if (!response.ok) throw new Error(js?.error || 'Failed to save planned lessons')
      return true
    } catch (err) {
      alert('Failed to save planned lessons')
      return false
    }
  }

  const savePlannedLessons = async (lessons) => {
    setPlannedLessons(lessons)

    if (!learnerId || learnerId === 'none') return

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          learnerId,
          plannedLessons: lessons
        })
      })
    } catch (err) {
      alert('Failed to save planned lessons')
    }
  }

  const loadPlannedForLearner = useCallback(async (targetLearnerId) => {
    if (!targetLearnerId || targetLearnerId === 'none') {
      setPlannedLessons({})
      plannedLoadedForLearnerRef.current = null
      return
    }

    // Skip reload if planned lessons already loaded for this learner
    if (plannedLoadedForLearnerRef.current === targetLearnerId && Object.keys(plannedLessons).length > 0) return

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setPlannedLessons({})
        return
      }

      const response = await fetch(`/api/planned-lessons?learnerId=${targetLearnerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        setPlannedLessons({})
        return
      }

      const result = await response.json()
      setPlannedLessons(result.plannedLessons || {})
      plannedLoadedForLearnerRef.current = targetLearnerId
    } catch (err) {
      setPlannedLessons({})
    }
  }, [plannedLessons])

  const loadSchedule = useCallback(async () => {
    return loadScheduleForLearner(learnerId)
  }, [learnerId, loadScheduleForLearner])

  const loadPlanned = useCallback(async () => {
    return loadPlannedForLearner(learnerId)
  }, [learnerId, loadPlannedForLearner])

  const loadCalendarData = useCallback(async () => {
    await Promise.all([loadSchedule(), loadPlanned()])
  }, [loadPlanned, loadSchedule])

  const handleRemoveScheduledLessonById = async (scheduleId, opts = {}) => {
    if (!scheduleId) return
    if (!opts?.skipConfirm) {
      if (!confirm('Remove this lesson from the schedule?')) return
    }

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const deleteResponse = await fetch(
        `/api/lesson-schedule?id=${scheduleId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!deleteResponse.ok) throw new Error('Failed to remove lesson')

      setScheduledLessons({})
      await loadSchedule()
    } catch (err) {
      alert('Failed to remove lesson')
    }
  }

  const handleRescheduleLesson = async (lessonKey, oldDate, newDate) => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      // Find the schedule ID
      const findResponse = await fetch(
        `/api/lesson-schedule?learnerId=${learnerId}&startDate=${oldDate}&endDate=${oldDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!findResponse.ok) throw new Error('Failed to find schedule entry')
      
      const findResult = await findResponse.json()
      const schedules = findResult.schedule || []
      const scheduleItem = schedules.find(s => s.lesson_key === lessonKey && s.scheduled_date === oldDate)
      
      if (!scheduleItem) throw new Error('Schedule entry not found')

      // Delete old schedule entry
      const deleteResponse = await fetch(
        `/api/lesson-schedule?id=${scheduleItem.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!deleteResponse.ok) throw new Error('Failed to remove old schedule')

      // Create new schedule entry with new date
      const scheduleResponse = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          learnerId: learnerId,
          lessonKey: lessonKey,
          scheduledDate: newDate
        })
      })

      if (!scheduleResponse.ok) throw new Error('Failed to reschedule lesson')

      setRescheduling(null)
      setScheduledLessons({})
      await loadSchedule()
    } catch (err) {
      alert('Failed to reschedule lesson')
    }
  }

  const handleGenerateClick = (plannedLesson) => {
    if (!selectedDate) return
    setGeneratorData({
      grade: learnerGrade || plannedLesson.grade || '',
      difficulty: plannedLesson.difficulty || 'intermediate',
      subject: plannedLesson.subject || '',
      title: plannedLesson.title || '',
      description: plannedLesson.description || ''
    })
    setShowGenerator(true)
  }

  const handleRedoClick = async (plannedLesson) => {
    if (!selectedDate) return
    if (!learnerId || learnerId === 'none') return

    setRedoingLesson(plannedLesson.id)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/generate-lesson-outline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: plannedLesson.subject,
          grade: learnerGrade || plannedLesson.grade || '3rd',
          difficulty: plannedLesson.difficulty || 'intermediate',
          learnerId
        })
      })

      if (!response.ok) throw new Error('Failed to generate outline')
      const result = await response.json()
      const newOutline = result.outline

      const updatedLesson = {
        ...plannedLesson,
        title: newOutline?.title || plannedLesson.title,
        description: newOutline?.description || plannedLesson.description
      }

      const current = Array.isArray(plannedLessons[selectedDate]) ? plannedLessons[selectedDate] : []
      const next = current.map((l) => (l.id === plannedLesson.id ? updatedLesson : l))
      const ok = await persistPlannedForDate(selectedDate, next)
      if (!ok) return

      setPlannedLessons((prev) => ({ ...prev, [selectedDate]: next }))
    } catch (err) {
      alert('Failed to regenerate lesson outline')
    } finally {
      setRedoingLesson(null)
    }
  }

  const handleRemoveClick = async (plannedLesson) => {
    if (!selectedDate) return
    if (!confirm(`Remove "${plannedLesson.title || 'this planned lesson'}" from ${selectedDate}?`)) return

    const current = Array.isArray(plannedLessons[selectedDate]) ? plannedLessons[selectedDate] : []
    const next = current.filter((l) => l.id !== plannedLesson.id)
    const ok = await persistPlannedForDate(selectedDate, next)
    if (!ok) return

    setPlannedLessons((prev) => ({ ...prev, [selectedDate]: next }))
  }

  const handleEditClick = async (scheduledLesson) => {
    setEditingLesson(scheduledLesson.lesson_key)
    setLessonEditorLoading(true)
    setLessonEditorData(null)

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const authedUserId = session?.user?.id

      if (!token || !authedUserId) throw new Error('Not authenticated')
      if (scheduledLesson.facilitator_id && scheduledLesson.facilitator_id !== authedUserId) {
        throw new Error('Cannot edit another facilitator\'s lesson')
      }

      const params = new URLSearchParams({ file: scheduledLesson.lesson_key })
      const response = await fetch(`/api/facilitator/lessons/get?${params}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to load lesson')
      }

      const data = await response.json()
      setLessonEditorData(data)
    } catch (err) {
      alert('Failed to load lesson for editing')
      setEditingLesson(null)
      setLessonEditorData(null)
    } finally {
      setLessonEditorLoading(false)
    }
  }

  const handleSaveLessonEdits = async (updatedLesson) => {
    setLessonEditorSaving(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const normalizedFile = String(editingLesson || '')
        .replace(/^generated\//, '')
        .replace(/\.json$/i, '')
      const file = `${normalizedFile}.json`

      const response = await fetch('/api/facilitator/lessons/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ file, lesson: updatedLesson })
      })

      const js = await response.json().catch(() => null)
      if (!response.ok) throw new Error(js?.error || 'Failed to save lesson')

      alert('Lesson updated successfully!')
      setEditingLesson(null)
      setLessonEditorData(null)
    } catch (err) {
      alert('Failed to save lesson changes')
    } finally {
      setLessonEditorSaving(false)
    }
  }

  // Listen for preload event to trigger initial load
  useEffect(() => {
    const handlePreload = () => {
      if (learnerId && learnerId !== 'none') {
        loadCalendarData()
      }
    }
    
    const handleLessonScheduled = () => {
      // Clear cache and reload
      setScheduledLessons({})
      scheduleLoadedForLearnerRef.current = null
      loadSchedule()
    }
    
    window.addEventListener('preload-overlays', handlePreload)
    window.addEventListener('mr-mentor:lesson-scheduled', handleLessonScheduled)
    return () => {
      window.removeEventListener('preload-overlays', handlePreload)
      window.removeEventListener('mr-mentor:lesson-scheduled', handleLessonScheduled)
    }
  }, [learnerId, loadCalendarData, loadSchedule])
  
  useEffect(() => {
    if (learnerId && learnerId !== 'none') {
      loadCalendarData()
      
      // Poll for updates every 2 minutes
      const pollInterval = setInterval(() => {
        loadCalendarData()
      }, 2 * 60 * 1000)
      
      return () => clearInterval(pollInterval)
    }
  }, [learnerId, loadCalendarData])

  useEffect(() => {
    setSelectedDate(null)
    setRescheduling(null)
    setListTab('scheduled')
    setScheduledLessons({})
    setPlannedLessons({})
    scheduleLoadedForLearnerRef.current = null
    plannedLoadedForLearnerRef.current = null
  }, [learnerId])

  useEffect(() => {
    if (selectedDate && scheduledLessons[selectedDate]) {
      setScheduledForSelectedDate(scheduledLessons[selectedDate])
    } else {
      setScheduledForSelectedDate([])
    }
  }, [selectedDate, scheduledLessons])

  useEffect(() => {
    if (selectedDate && plannedLessons[selectedDate]) {
      setPlannedForSelectedDate(plannedLessons[selectedDate])
    } else {
      setPlannedForSelectedDate([])
    }
  }, [selectedDate, plannedLessons])

  const daysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const firstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const generateCalendarDays = () => {
    const days = []
    const totalDays = daysInMonth(currentMonth)
    const firstDay = firstDayOfMonth(currentMonth)
    
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, date: null })
    }
    
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      const dateStr = toLocalDateStr(date)
      days.push({ day, date: dateStr })
    }
    
    return days
  }

  const handleDateClick = (dateStr) => {
    if (!dateStr) return
    setSelectedDate(dateStr)
  }

  const today = getLocalTodayStr()
  const calendarDays = generateCalendarDays()

  const formattedSelectedDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    : null

  // If generator overlay is open, show it
  if (showGenerator) {
    const overlay = (
      <LessonGeneratorOverlay
        learnerId={learnerId}
        learnerGrade={learnerGrade}
        tier={tier}
        scheduledDate={selectedDate}
        prefilledData={generatorData}
        onClose={() => setShowGenerator(false)}
        onGenerated={async () => {
          setShowGenerator(false)
          // Ensure scheduled markers refresh
          setScheduledLessons({})
          scheduleLoadedForLearnerRef.current = null
          await loadSchedule()
        }}
      />
    )

    return isMounted ? createPortal(overlay, document.body) : null
  }

  // If lesson editor is open, show it as a full-page overlay
  if (editingLesson) {
    const overlay = (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: OVERLAY_Z_INDEX,
          padding: 16
        }}
        onClick={() => {
          if (!lessonEditorSaving && confirm('Close without saving changes?')) {
            setEditingLesson(null)
            setLessonEditorData(null)
          }
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            width: '100%',
            maxWidth: 1000,
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {lessonEditorLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              Loading lesson...
            </div>
          ) : lessonEditorData ? (
            <LessonEditor
              initialLesson={lessonEditorData}
              onSave={handleSaveLessonEdits}
              onCancel={() => {
                if (!lessonEditorSaving || confirm('Cancel editing?')) {
                  setEditingLesson(null)
                  setLessonEditorData(null)
                }
              }}
              busy={lessonEditorSaving}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: '#ef4444' }}>
              Failed to load lesson
            </div>
          )}
        </div>
      </div>
    )

    return isMounted ? createPortal(overlay, document.body) : null
  }

  // If lesson planner overlay is open, show it as a full-screen overlay
  if (showPlannerOverlay) {
    const overlay = (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: OVERLAY_Z_INDEX,
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={() => setShowPlannerOverlay(false)}
      >
        <div
          style={{
            background: '#fff',
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb'
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
              Lesson Planner
            </div>
            <button
              type="button"
              onClick={() => setShowPlannerOverlay(false)}
              style={{
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <LessonPlanner
              learnerId={learnerId}
              learnerGrade={learnerGrade}
              tier={tier}
              selectedDate={selectedDate}
              plannedLessons={plannedLessons}
              onPlannedLessonsChange={savePlannedLessons}
              onLessonGenerated={async () => {
                setScheduledLessons({})
                scheduleLoadedForLearnerRef.current = null
                await loadSchedule()
              }}
            />
          </div>
        </div>
      </div>
    )

    return isMounted ? createPortal(overlay, document.body) : null
  }

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
        padding: '8px 12px', 
        background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={currentMonthIndex}
            onChange={(e) => setCurrentMonth(new Date(currentYear, parseInt(e.target.value)))}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              flex: 1
            }}
          >
            {monthNames.map((month, idx) => (
              <option key={idx} value={idx}>{month}</option>
            ))}
          </select>
          
          <select
            value={currentYear}
            onChange={(e) => setCurrentMonth(new Date(parseInt(e.target.value), currentMonthIndex))}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer'
            }}
          >
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            title="Previous month"
            style={{
              padding: '4px 8px',
              fontSize: 14,
              fontWeight: 900,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            {'<'}
          </button>

          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            title="Next month"
            style={{
              padding: '4px 8px',
              fontSize: 14,
              fontWeight: 900,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            {'>'}
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: 3,
            marginBottom: 6
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ 
                textAlign: 'center', 
                fontSize: 11,
                fontWeight: 700,
                color: '#6b7280',
                padding: '2px 0'
              }}>
                {day}
              </div>
          ))}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {calendarDays.map((item, idx) => {
            const isToday = item.date === today
            const isSelected = item.date === selectedDate
            const scheduledCount = item.date ? (scheduledLessons[item.date]?.length || 0) : 0
            const plannedCount = item.date ? (plannedLessons[item.date]?.length || 0) : 0
            const hasScheduled = scheduledCount > 0
            const hasPlanned = plannedCount > 0
            const tabHasLessons = listTab === 'planned' ? hasPlanned : hasScheduled
            
            return (
              <button
                key={idx}
                onClick={() => handleDateClick(item.date)}
                disabled={!item.day}
                style={{
                  aspectRatio: '1',
                  border: '1px solid',
                  borderColor: isSelected ? '#3b82f6' : isToday ? '#10b981' : '#e5e7eb',
                  borderRadius: 6,
                  background: isSelected
                    ? '#dbeafe'
                    : isToday
                      ? '#d1fae5'
                      : tabHasLessons
                        ? (listTab === 'planned' ? '#dbeafe' : '#fef3c7')
                        : '#fff',
                  cursor: item.day ? 'pointer' : 'default',
                  fontSize: 11,
                  fontWeight: tabHasLessons ? 700 : 400,
                  color: item.day ? '#1f2937' : 'transparent',
                  position: 'relative',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (item.day) {
                    e.currentTarget.style.transform = 'scale(1.03)'
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (item.day) {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                {item.day}
                {tabHasLessons && (
                  <div style={{
                    position: 'absolute',
                    bottom: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: listTab === 'planned' ? '#3b82f6' : '#f59e0b'
                  }} />
                )}
              </button>
            )
          })}
        </div>
        
        {/* Tabs + selected date + lessons (tabs always visible) */}
        <div style={{ marginTop: 10, padding: 10, background: '#f9fafb', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => setListTab('scheduled')}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                border: listTab === 'scheduled' ? '1px solid #10b981' : '1px solid #d1d5db',
                background: listTab === 'scheduled' ? '#ecfdf5' : '#fff',
                color: listTab === 'scheduled' ? '#065f46' : '#374151',
                cursor: 'pointer'
              }}
            >
              Scheduled ({scheduledForSelectedDate.length})
            </button>
            <button
              type="button"
              onClick={() => setListTab('planned')}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                border: listTab === 'planned' ? '1px solid #3b82f6' : '1px solid #d1d5db',
                background: listTab === 'planned' ? '#eff6ff' : '#fff',
                color: listTab === 'planned' ? '#1e40af' : '#374151',
                cursor: 'pointer'
              }}
            >
              Planned ({plannedForSelectedDate.length})
            </button>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#374151' }}>
            {formattedSelectedDate || 'Select a date'}
          </div>

          {listTab === 'scheduled' ? (
            scheduledForSelectedDate.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scheduledForSelectedDate.map((lesson, idx) => (
                  <div key={lesson.id || idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: 6,
                    background: '#fff',
                    borderRadius: 6,
                    border: '1px solid #e5e7eb',
                    fontSize: 11
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1f2937' }}>{lesson.lesson_title}</div>
                      <div style={{ color: '#6b7280', fontSize: 10 }}>
                        {lesson.subject} • {lesson.grade}
                      </div>
                    </div>
                    {selectedDate && selectedDate < getLocalTodayStr() ? (
                      <>
                        <button
                          onClick={() => setNotesLesson({ lessonKey: lesson.lesson_key, lessonTitle: lesson.lesson_title })}
                          style={{
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: 'none',
                            cursor: 'pointer',
                            background: '#f3f4f6',
                            color: '#111827'
                          }}
                        >
                          Notes
                        </button>
                        <button
                          onClick={() => setVisualAidsLesson({ lessonKey: lesson.lesson_key, lessonTitle: lesson.lesson_title })}
                          style={{
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: 'none',
                            cursor: 'pointer',
                            background: '#eff6ff',
                            color: '#1e40af'
                          }}
                        >
                          Add Image
                        </button>
                        <button
                          onClick={() => setRemoveConfirmLesson({ scheduleId: lesson.id, lessonTitle: lesson.lesson_title })}
                          style={{
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: 'none',
                            cursor: 'pointer',
                            background: '#fee2e2',
                            color: '#991b1b'
                          }}
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditClick(lesson)}
                          style={{
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: 'none',
                            cursor: 'pointer',
                            background: '#ecfdf5',
                            color: '#065f46',
                            transition: 'background 0.15s'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setRescheduling(lesson.id)}
                          style={{
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: 'none',
                            cursor: 'pointer',
                            background: '#eff6ff',
                            color: '#1e40af',
                            transition: 'background 0.15s'
                          }}
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleRemoveScheduledLessonById(lesson.id)}
                          style={{
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: 'none',
                            cursor: 'pointer',
                            background: '#fee2e2',
                            color: '#991b1b',
                            transition: 'background 0.15s'
                          }}
                          title={!selectedDate ? 'Select a date first' : 'Remove from schedule'}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                {(!learnerId || learnerId === 'none')
                  ? 'Select a learner to view scheduled lessons'
                  : (selectedDate ? 'No lessons scheduled' : 'Select a date to view scheduled lessons')}
              </div>
            )
          ) : (
            plannedForSelectedDate.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plannedForSelectedDate.map((lesson, idx) => (
                    <div key={lesson.id || idx} style={{
                      padding: 8,
                      background: '#fff',
                      borderRadius: 6,
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af' }}>
                          Planned
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleGenerateClick(lesson)}
                            disabled={!selectedDate}
                            style={{
                              padding: '2px 6px',
                              fontSize: 10,
                              fontWeight: 700,
                              borderRadius: 4,
                              border: 'none',
                              cursor: !selectedDate ? 'not-allowed' : 'pointer',
                              background: !selectedDate ? '#e5e7eb' : '#dbeafe',
                              color: !selectedDate ? '#9ca3af' : '#1e40af'
                            }}
                            title={!selectedDate ? 'Select a date first' : 'Generate and schedule on this date'}
                          >
                            Generate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRedoClick(lesson)}
                            disabled={!selectedDate || redoingLesson === lesson.id}
                            style={{
                              padding: '2px 6px',
                              fontSize: 10,
                              fontWeight: 700,
                              borderRadius: 4,
                              border: 'none',
                              cursor: (!selectedDate || redoingLesson === lesson.id) ? 'not-allowed' : 'pointer',
                              background: (!selectedDate || redoingLesson === lesson.id) ? '#e5e7eb' : '#fff7ed',
                              color: (!selectedDate || redoingLesson === lesson.id) ? '#9ca3af' : '#9a3412'
                            }}
                            title={!selectedDate ? 'Select a date first' : 'Regenerate outline'}
                          >
                            {redoingLesson === lesson.id ? 'Redoing...' : 'Redo'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveClick(lesson)}
                            disabled={!selectedDate}
                            style={{
                              padding: '2px 6px',
                              fontSize: 10,
                              fontWeight: 700,
                              borderRadius: 4,
                              border: 'none',
                              cursor: !selectedDate ? 'not-allowed' : 'pointer',
                              background: !selectedDate ? '#e5e7eb' : '#fee2e2',
                              color: !selectedDate ? '#9ca3af' : '#991b1b'
                            }}
                            title={!selectedDate ? 'Select a date first' : 'Remove from planned lessons'}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                        {lesson.title || 'Planned lesson'}
                      </div>
                      {lesson.description && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                          {lesson.description}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>
                        {lesson.subject || 'general'}{lesson.grade ? ` • ${lesson.grade}` : ''}{lesson.difficulty ? ` • ${lesson.difficulty}` : ''}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPlannerOverlay(true)}
                    disabled={!learnerId || learnerId === 'none'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: (!learnerId || learnerId === 'none') ? '#f3f4f6' : '#111827',
                      color: (!learnerId || learnerId === 'none') ? '#9ca3af' : '#fff',
                      cursor: (!learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer'
                    }}
                    title={(!learnerId || learnerId === 'none') ? 'Select a learner first' : 'Open the full Lesson Planner'}
                  >
                    Create a Lesson Plan
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                  {(!learnerId || learnerId === 'none')
                    ? 'Select a learner to view planned lessons'
                    : (selectedDate ? 'No planned lessons' : 'Select a date to view planned lessons')}
                </div>

                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPlannerOverlay(true)}
                    disabled={!learnerId || learnerId === 'none'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: (!learnerId || learnerId === 'none') ? '#f3f4f6' : '#111827',
                      color: (!learnerId || learnerId === 'none') ? '#9ca3af' : '#fff',
                      cursor: (!learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer'
                    }}
                    title={(!learnerId || learnerId === 'none') ? 'Select a learner first' : 'Open the full Lesson Planner'}
                  >
                    Create a Lesson Plan
                  </button>
                </div>
              </>
            )
          )}
        </div>
        </>
      </div>

      <LessonNotesModal
        open={!!notesLesson}
        onClose={() => setNotesLesson(null)}
        learnerId={learnerId}
        lessonKey={notesLesson?.lessonKey}
        lessonTitle={notesLesson?.lessonTitle || 'Lesson Notes'}
        portal
        zIndex={OVERLAY_Z_INDEX}
      />

      <VisualAidsManagerModal
        open={!!visualAidsLesson}
        onClose={() => setVisualAidsLesson(null)}
        learnerId={learnerId}
        lessonKey={visualAidsLesson?.lessonKey}
        lessonTitle={visualAidsLesson?.lessonTitle || 'Visual Aids'}
        authToken={authToken}
        portal
        zIndex={OVERLAY_Z_INDEX}
      />

      <TypedRemoveConfirmModal
        open={!!removeConfirmLesson}
        onClose={() => setRemoveConfirmLesson(null)}
        title="Remove lesson?"
        description="This cannot be undone. Type remove to confirm."
        confirmWord="remove"
        confirmLabel="Remove"
        portal
        zIndex={OVERLAY_Z_INDEX}
        onConfirm={async () => {
          if (!removeConfirmLesson?.scheduleId) return
          await handleRemoveScheduledLessonById(removeConfirmLesson.scheduleId, { skipConfirm: true })
        }}
      />
      
      {/* Reschedule popup modal (ported to body to avoid spill suppression stacking issues) */}
      {isMounted && rescheduling && scheduledForSelectedDate.find(item => item.id === rescheduling) && createPortal(
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
            zIndex: OVERLAY_Z_INDEX
          }}
          onClick={() => setRescheduling(null)}
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
              📅 Reschedule Lesson
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              {scheduledForSelectedDate.find(item => item.id === rescheduling)?.lesson_title}
            </div>
            
            <input
              type="date"
              defaultValue={selectedDate}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 16,
                boxSizing: 'border-box'
              }}
              id="reschedule-date-overlay"
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  const dateInput = document.getElementById('reschedule-date-overlay')
                  const lesson = scheduledForSelectedDate.find(item => item.id === rescheduling)
                  if (dateInput?.value && lesson) {
                    handleRescheduleLesson(lesson.lesson_key, selectedDate, dateInput.value)
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reschedule
              </button>
              <button
                onClick={() => setRescheduling(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  color: '#374151',
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
