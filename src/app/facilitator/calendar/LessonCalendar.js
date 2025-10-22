// Calendar component for lesson scheduling
'use client'
import { useState, useEffect } from 'react'

export default function LessonCalendar({ learnerId, onDateSelect, scheduledLessons = {}, learners = [], selectedLearnerId, onLearnerChange }) {
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

  const today = new Date().toISOString().split('T')[0]
  const calendarDays = generateCalendarDays()

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-300 overflow-hidden">
      {/* Calendar Header with Learner Selector */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-300">
        <div className="flex items-center justify-center gap-4">
          {/* Learner Selector */}
          {learners.length > 0 && (
            <select
              value={selectedLearnerId}
              onChange={(e) => onLearnerChange(e.target.value)}
              className="px-4 py-2 text-base font-semibold rounded bg-white border border-gray-300 hover:bg-gray-50 transition shadow-sm cursor-pointer"
              style={{ minWidth: '160px' }}
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
            className="px-4 py-2 text-base font-semibold rounded bg-white border border-gray-300 hover:bg-gray-50 transition shadow-sm cursor-pointer"
            style={{ minWidth: '140px' }}
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
            className="px-4 py-2 text-base font-semibold rounded bg-white border border-gray-300 hover:bg-gray-50 transition shadow-sm cursor-pointer"
            style={{ minWidth: '100px' }}
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
      <div className="p-4">
        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }} className="border-b-2 border-gray-300 mb-2">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <div key={day} className="text-center text-sm font-bold text-gray-700 py-3 px-2 bg-gray-50 border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }} className="bg-gray-300">
          {calendarDays.map((item, idx) => {
            if (!item.day) {
              return <div key={idx} className="bg-gray-100" style={{ minHeight: '100px' }} />
            }

            const dateStr = item.date
            const lessonCount = scheduledLessons[dateStr]?.length || 0
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const isPast = dateStr < today

            return (
              <button
                key={idx}
                onClick={() => handleDateClick(dateStr)}
                style={{ 
                  minHeight: '100px', 
                  display: 'block', 
                  width: '100%',
                  position: 'relative',
                  padding: '8px',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  border: 'none',
                  background: isPast 
                    ? '#f3f4f6' 
                    : isSelected 
                      ? '#dbeafe' 
                      : lessonCount > 0 
                        ? '#f0fdf4' 
                        : '#ffffff',
                  color: isPast ? '#9ca3af' : '#111827',
                  boxShadow: isToday ? 'inset 0 0 0 2px #2563eb' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isPast) e.currentTarget.style.background = isSelected ? '#bfdbfe' : lessonCount > 0 ? '#dcfce7' : '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isPast 
                    ? '#f3f4f6' 
                    : isSelected 
                      ? '#dbeafe' 
                      : lessonCount > 0 
                        ? '#f0fdf4' 
                        : '#ffffff'
                }}
              >
                <div className="flex flex-col h-full">
                  <span style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    marginBottom: '4px',
                    color: isToday ? '#2563eb' : isPast ? '#9ca3af' : '#111827'
                  }}>
                    {item.day}
                  </span>
                  {lessonCount > 0 && (
                    <div className="mt-auto">
                      <span className="inline-block px-2 py-1 text-xs font-bold bg-green-600 text-white rounded">
                        {lessonCount} lesson{lessonCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
