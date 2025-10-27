// Compact calendar view for Mr. Mentor overlay
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'

export default function CalendarOverlay({ learnerId }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [scheduledLessons, setScheduledLessons] = useState({})
  const [scheduledForSelectedDate, setScheduledForSelectedDate] = useState([])
  const [tableExists, setTableExists] = useState(true)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  
  const currentYear = currentMonth.getFullYear()
  const currentMonthIndex = currentMonth.getMonth()
  
  const loadScheduleForLearner = useCallback(async (targetLearnerId) => {
    if (!targetLearnerId || targetLearnerId === 'none') {
      setScheduledLessons({})
      return
    }
    
    // Skip reload if schedule already loaded
    if (Object.keys(scheduledLessons).length > 0) {
      console.log('[CalendarOverlay] Schedule already loaded, skipping')
      return
    }
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        console.warn('[CalendarOverlay] No auth token available')
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
        console.error('[CalendarOverlay] Failed to load schedule:', response.status)
        setScheduledLessons({})
        return
      }

      const result = await response.json()
      const data = result.schedule || []

      const grouped = {}
      data.forEach(item => {
        const dateStr = item.scheduled_date
        if (!grouped[dateStr]) grouped[dateStr] = []
        grouped[dateStr].push({
          lesson_title: item.lesson_key?.split('/')[1]?.replace('.json', '').replace(/_/g, ' ') || 'Lesson',
          subject: item.lesson_key?.split('/')[0] || 'Unknown',
          grade: 'Various',
          lesson_key: item.lesson_key
        })
      })
      setScheduledLessons(grouped)
      setTableExists(true)
    } catch (err) {
      console.error('[CalendarOverlay] Failed to load schedule:', err)
      setScheduledLessons({})
    }
  }, [scheduledLessons])

  const loadSchedule = useCallback(async () => {
    return loadScheduleForLearner(learnerId)
  }, [learnerId, loadScheduleForLearner])

  // Listen for preload event to trigger initial load
  useEffect(() => {
    const handlePreload = () => {
      console.log('[CalendarOverlay] Received preload event, loading schedule')
      if (learnerId && learnerId !== 'none') {
        loadSchedule()
      }
    }
    
    window.addEventListener('preload-overlays', handlePreload)
    return () => window.removeEventListener('preload-overlays', handlePreload)
  }, [learnerId, loadSchedule])
  
  useEffect(() => {
    if (learnerId && learnerId !== 'none') {
      loadSchedule()
      
      // Poll for updates every 2 minutes
      const pollInterval = setInterval(() => {
        console.log('[CalendarOverlay] Polling for schedule updates')
        loadSchedule()
      }, 2 * 60 * 1000)
      
      return () => clearInterval(pollInterval)
    }
  }, [learnerId, loadSchedule])

  useEffect(() => {
    if (selectedDate && scheduledLessons[selectedDate]) {
      setScheduledForSelectedDate(scheduledLessons[selectedDate])
    } else {
      setScheduledForSelectedDate([])
    }
  }, [selectedDate, scheduledLessons])

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
      const dateStr = date.toISOString().split('T')[0]
      days.push({ day, date: dateStr })
    }
    
    return days
  }

  const handleDateClick = (dateStr) => {
    if (!dateStr) return
    setSelectedDate(dateStr)
  }

  const today = new Date().toISOString().split('T')[0]
  const calendarDays = generateCalendarDays()

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
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={currentMonthIndex}
            onChange={(e) => setCurrentMonth(new Date(currentYear, parseInt(e.target.value)))}
            style={{
              padding: '6px 10px',
              fontSize: 13,
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
              padding: '6px 10px',
              fontSize: 13,
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
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: 4,
            marginBottom: 8
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ 
                textAlign: 'center', 
                fontSize: 11,
                fontWeight: 700,
                color: '#6b7280',
                padding: '4px 0'
              }}>
                {day}
              </div>
          ))}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {calendarDays.map((item, idx) => {
            const isToday = item.date === today
            const isSelected = item.date === selectedDate
            const hasLessons = item.date && scheduledLessons[item.date]?.length > 0
            
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
                  background: isSelected ? '#dbeafe' : isToday ? '#d1fae5' : hasLessons ? '#fef3c7' : '#fff',
                  cursor: item.day ? 'pointer' : 'default',
                  fontSize: 12,
                  fontWeight: hasLessons ? 700 : 400,
                  color: item.day ? '#1f2937' : 'transparent',
                  position: 'relative',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (item.day) {
                    e.currentTarget.style.transform = 'scale(1.05)'
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
                {hasLessons && (
                  <div style={{
                    position: 'absolute',
                    bottom: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#f59e0b'
                  }} />
                )}
              </button>
            )
          })}
        </div>
        
        {/* Selected date lessons */}
        {selectedDate && (
          <div style={{ marginTop: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#374151' }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
            {scheduledForSelectedDate.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scheduledForSelectedDate.map((lesson, idx) => (
                  <div key={idx} style={{ 
                    padding: 8, 
                    background: '#fff', 
                    borderRadius: 6,
                    border: '1px solid #e5e7eb',
                    fontSize: 12
                  }}>
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>{lesson.lesson_title}</div>
                    <div style={{ color: '#6b7280', fontSize: 11 }}>
                      {lesson.subject} • {lesson.grade}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                {(!learnerId || learnerId === 'none') ? 'Select a learner to schedule lessons' : 'No lessons scheduled'}
              </div>
            )}
          </div>
        )}
        </>
      </div>
    </div>
  )
}
