// Calendar component for lesson scheduling
'use client'
import { useState, useEffect } from 'react'

export default function LessonCalendar({ learnerId, onDateSelect, scheduledLessons = {}, noSchoolDates = {}, learners = [], selectedLearnerId, onLearnerChange }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  
  const currentYear = currentMonth.getFullYear()
  const currentMonthIndex = currentMonth.getMonth()
  
  // Generate year options (current year ± 2 years)
  const yearOptions = []
  const thisYear = new Date().getFullYear()
  for (let y = thisYear - 1; y <= thisYear + 2; y++) {
    yearOptions.push(y)
  }
  
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
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, date: null })
    }
    
    // Add days of the month
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      const dateStr = date.toISOString().split('T')[0]
      days.push({ day, date: dateStr })
    }
    
    return days
  }

  const handleMonthChange = (e) => {
    const newMonth = parseInt(e.target.value)
    setCurrentMonth(new Date(currentYear, newMonth))
  }

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value)
    setCurrentMonth(new Date(newYear, currentMonthIndex))
  }

  const handleDateClick = (dateStr) => {
    if (!dateStr) return
    setSelectedDate(dateStr)
    onDateSelect(dateStr)
  }

  // Calculate today using local timezone
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const today = `${year}-${month}-${day}`
  const calendarDays = generateCalendarDays()

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-500 overflow-hidden">
      {/* Calendar Header with Learner Selector */}
      <div style={{ 
        padding: '12px 16px', 
        background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {/* Learner Selector */}
          {learners.length > 0 && (
            <select
              value={selectedLearnerId}
              onChange={(e) => onLearnerChange(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                background: '#fff',
                border: '1px solid #d1d5db',
                cursor: 'pointer',
                minWidth: '160px'
              }}
            >
              {learners.map(learner => (
                <option key={learner.id} value={learner.id}>
                  {learner.name} {learner.grade ? `(Grade ${learner.grade})` : ''}
                </option>
              ))}
            </select>
          )}
          
          <select
            value={currentMonthIndex}
            onChange={handleMonthChange}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              flex: 1,
              minWidth: '140px'
            }}
          >
            {monthNames.map((month, idx) => (
              <option key={idx} value={idx}>
                {month}
              </option>
            ))}
          </select>
          
          <select
            value={currentYear}
            onChange={handleYearChange}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              minWidth: '100px'
            }}
          >
            {yearOptions.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Table */}
      <div style={{ padding: 12 }}>
        {/* Day Headers */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: 4,
          marginBottom: 8
        }}>
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
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

        {/* Calendar Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {calendarDays.map((item, idx) => {
            if (!item.day) {
              return <div key={idx} style={{ aspectRatio: '1', background: 'transparent' }} />
            }

            const dateStr = item.date
            const lessonCount = scheduledLessons[dateStr]?.length || 0
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const isPast = dateStr < today
            const isNoSchool = noSchoolDates[dateStr] !== undefined

            return (
              <button
                key={idx}
                onClick={() => handleDateClick(dateStr)}
                style={{
                  aspectRatio: '1',
                  border: '1px solid',
                  borderColor: isNoSchool ? '#f59e0b' : isSelected ? '#3b82f6' : isToday ? '#10b981' : '#e5e7eb',
                  borderRadius: 6,
                  background: isNoSchool ? '#fef3c7' : isSelected ? '#dbeafe' : isToday ? '#d1fae5' : lessonCount > 0 ? '#fef3c7' : '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: lessonCount > 0 ? 700 : 400,
                  color: isPast ? '#9ca3af' : '#1f2937',
                  position: 'relative',
                  transition: 'all 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  padding: '4px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: '600',
                  color: isToday ? '#10b981' : isPast ? '#9ca3af' : '#1f2937'
                }}>
                  {item.day}
                </span>
                {isNoSchool && (
                  <div style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    fontSize: 10
                  }}>
                    🚫
                  </div>
                )}
                {lessonCount > 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: 4,
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
      </div>
    </div>
  )
}
