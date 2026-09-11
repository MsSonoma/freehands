'use client'

import { useState } from 'react'
import { syllabusCalendarItemCompleted } from '@/app/lib/syllabus/calendarProjection.mjs'

function localDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function LessonCalendar({
  itemsByDate = {},
  noSchoolDates = {},
  learners = [],
  selectedLearnerId = '',
  selectedDate = '',
  onLearnerChange,
  onDateSelect,
  onItemSelect,
  resolvedToday = '',
  canManageDays = false,
  onDayAction,
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const base = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date()
    return Number.isNaN(base.getTime()) ? new Date() : base
  })
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const currentYear = currentMonth.getFullYear()
  const currentMonthIndex = currentMonth.getMonth()
  const thisYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, index) => thisYear - 1 + index)
  const totalDays = new Date(currentYear, currentMonthIndex + 1, 0).getDate()
  const firstDay = new Date(currentYear, currentMonthIndex, 1).getDay()
  const calendarDays = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ]
  const today = resolvedToday || localDateString(new Date())

  function changeMonth(offset) {
    setCurrentMonth(new Date(currentYear, currentMonthIndex + offset, 1))
  }

  return (
    <section style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 12, overflow: 'hidden' }}>
      <header style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {learners.length > 0 && (
          <select value={selectedLearnerId} onChange={(event) => onLearnerChange?.(event.target.value)} style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontWeight: 700 }}>
            {learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name}{learner.grade ? ` (Grade ${learner.grade})` : ''}</option>)}
          </select>
        )}
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer' }}>&lt;</button>
        <select value={currentMonthIndex} onChange={(event) => setCurrentMonth(new Date(currentYear, Number(event.target.value), 1))} style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontWeight: 700 }}>
          {monthNames.map((month, index) => <option key={month} value={index}>{month}</option>)}
        </select>
        <select value={currentYear} onChange={(event) => setCurrentMonth(new Date(Number(event.target.value), currentMonthIndex, 1))} style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontWeight: 700 }}>
          {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer' }}>&gt;</button>
        <button type="button" onClick={() => setCurrentMonth(new Date())} style={{ marginLeft: 'auto', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer', fontWeight: 700 }}>Today</button>
      </header>

      <div style={{ padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 4 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#6b7280', padding: 4 }}>{day}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
          {calendarDays.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} style={{ minHeight: 112 }} />
            const date = localDateString(new Date(currentYear, currentMonthIndex, day))
            const items = itemsByDate[date] || []
            const isSelected = date === selectedDate
            const isToday = date === today
            const noSchool = noSchoolDates[date] !== undefined
            const allCompleted = items.length > 0 && items.every(syllabusCalendarItemCompleted)
            return (
              <div key={date} style={{ minHeight: 112, padding: 6, border: isSelected ? '2px solid #111827' : '1px solid #e5e7eb', borderRadius: 8, background: noSchool ? '#fffbeb' : isToday ? '#f0fdf4' : '#fff', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'center' }}>
                  <button type="button" onClick={() => onDateSelect?.(date)} style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <strong style={{ fontSize: 13, color: isToday ? '#166534' : '#111827' }}>{day}</strong>
                    {noSchool ? <span style={{ fontSize: 9, color: '#92400e' }}>Day off</span> : items.length > 0 ? <span style={{ fontSize: 9, color: allCompleted ? '#6b7280' : '#374151' }}>{items.length}</span> : null}
                  </button>
                  {canManageDays && date >= today && <button type="button" aria-label={`Plan ${date}`} title="Add lesson or mark day off" onClick={() => onDayAction?.(date)} style={{ width: 24, height: 24, flex: '0 0 auto', border: '1px solid #d1d5db', borderRadius: '50%', background: '#fff', color: '#6b382c', cursor: 'pointer', fontSize: 16, fontWeight: 800, lineHeight: '20px', padding: 0 }}>+</button>}
                </div>
                <div style={{ display: 'grid', gap: 3, marginTop: 5 }}>
                  {items.slice(0, 3).map((item) => (
                    <button
                      type="button"
                      key={item.occurrence_id || item.id || `${item.title}-${item.sort_order}`}
                      onClick={() => item.lesson_key ? onItemSelect?.(item) : onDateSelect?.(date)}
                      title={item.lesson_key ? `Open ${item.title || 'lesson'}` : 'Open this planned concept in the Syllabus'}
                      style={{ border: '1px solid #e5e7eb', borderRadius: 5, padding: '3px 5px', background: syllabusCalendarItemCompleted(item) ? '#f3f4f6' : item.readiness_state === 'draft' ? '#fff7ed' : '#f9fafb', color: '#1f2937', cursor: 'pointer', textAlign: 'left', fontSize: 9, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {item.item_type === 'slate_assignment' ? 'Mr. Slate: ' : ''}{item.title || item.subject || 'Planned lesson'}
                    </button>
                  ))}
                  {items.length > 3 && <button type="button" onClick={() => onDateSelect?.(date)} style={{ border: 0, padding: 0, background: 'transparent', textAlign: 'left', fontSize: 9, color: '#6b7280', cursor: 'pointer' }}>+{items.length - 3} more</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}