'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import LessonCalendar from '@/app/facilitator/calendar/LessonCalendar'
import FacilitatorSyllabusLessonOverlay from '@/app/components/syllabus/FacilitatorSyllabusLessonOverlay'
import { groupSyllabusCalendarItems, syllabusCalendarSelection } from '@/app/lib/syllabus/calendarProjection.mjs'
import { instructionalTeacherLabel, normalizeInstructionalTeacher } from '@/app/lib/syllabus/instructionalTeacher.mjs'

function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function prettyDate(value) {
  const date = dateOnly(value)
  if (!date) return ''
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function statusLabel(item) {
  if (item?.actual_kind === 'completed' || item?.historical_record === true) return 'Completed'
  if (item?.actual_kind === 'in_progress') return 'In progress'
  if (item?.actual_kind === 'incomplete') return 'Incomplete'
  if (!item?.lesson_key) return 'Planned concept'
  if (item?.item_type === 'slate_assignment') return 'Mr. Slate practice'
  return String(item?.readiness_state || 'Planned').replaceAll('_', ' ')
}

export default function CalendarOverlay({ learnerId, tier = 'free', accessToken = '' }) {
  const router = useRouter()
  const [syllabus, setSyllabus] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadSyllabus = useCallback(async () => {
    if (!learnerId || learnerId === 'none' || !accessToken) {
      setSyllabus(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/syllabus?learnerId=${encodeURIComponent(learnerId)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not load the Syllabus calendar')
      setSyllabus(json)
      setSelectedDate((current) => current || json.resolved_today || '')
    } catch (cause) {
      setSyllabus(null)
      setError(cause?.message || 'Could not load the Syllabus calendar')
    } finally {
      setLoading(false)
    }
  }, [accessToken, learnerId])

  useEffect(() => {
    setSelectedLesson(null)
    setSelectedDate('')
    void loadSyllabus()
  }, [loadSyllabus])

  const itemsByDate = useMemo(() => groupSyllabusCalendarItems(syllabus?.timeline_items || []), [syllabus?.timeline_items])
  const selectedItems = selectedDate ? (itemsByDate[selectedDate] || []) : []
  const resolvedToday = syllabus?.resolved_today || selectedDate || ''
  const activeRevisionId = String(syllabus?.active_revision?.id || '')

  function selectItem(item) {
    if (!item?.lesson_key) {
      router.push('/facilitator/syllabus')
      return
    }
    setSelectedLesson(syllabusCalendarSelection(item, { today: resolvedToday }))
  }

  if (!learnerId || learnerId === 'none') {
    return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#6b7280', fontSize: 13 }}>Select a learner to view the Syllabus calendar.</div>
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#f8fafc', padding: 10 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <strong style={{ color: '#111827' }}>Syllabus Calendar</strong>
            <div style={{ color: '#6b7280', fontSize: 11 }}>Calendar reflects the active Syllabus. Planning changes belong in Syllabus.</div>
          </div>
          <button type="button" onClick={() => router.push('/facilitator/syllabus')} style={{ padding: '6px 9px', border: '1px solid #c7442e', borderRadius: 6, background: '#fff', color: '#c7442e', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Open Syllabus</button>
        </div>

        {error && <div role="alert" style={{ padding: 8, border: '1px solid #fecaca', borderRadius: 7, background: '#fef2f2', color: '#991b1b', fontSize: 11 }}>{error}</div>}
        {loading && <div style={{ color: '#6b7280', fontSize: 11 }}>Refreshing Syllabus...</div>}

        <LessonCalendar
          itemsByDate={itemsByDate}
          learners={[]}
          selectedLearnerId={learnerId}
          selectedDate={selectedDate}
          onLearnerChange={() => {}}
          onDateSelect={setSelectedDate}
          onItemSelect={selectItem}
        />

        <section style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 9, overflow: 'hidden' }}>
          <header style={{ padding: 9, borderBottom: '1px solid #e5e7eb' }}>
            <strong style={{ fontSize: 12 }}>{selectedDate ? prettyDate(selectedDate) : 'Select a date'}</strong>
            {selectedDate && <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 10 }}>{selectedItems.length} item{selectedItems.length === 1 ? '' : 's'}</span>}
          </header>
          <div style={{ padding: 8, display: 'grid', gap: 6 }}>
            {!syllabus?.has_active_syllabus && <button type="button" onClick={() => router.push('/facilitator/syllabus')} style={{ padding: 9, border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', textAlign: 'left', cursor: 'pointer' }}><strong>No active Syllabus</strong><div style={{ marginTop: 3, color: '#6b7280', fontSize: 10 }}>Open Syllabus to establish the learner plan.</div></button>}
            {syllabus?.has_active_syllabus && selectedItems.length === 0 && <div style={{ color: '#6b7280', fontSize: 11 }}>Nothing is placed on this date.</div>}
            {selectedItems.map((item) => {
              const teacher = normalizeInstructionalTeacher(item?.assigned_instructional_teacher || item?.instructional_teacher)
              return <button type="button" key={item.occurrence_id || item.id || `${item.title}-${item.sort_order}`} onClick={() => selectItem(item)} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 9, color: '#6b7280' }}><strong>{item.subject || 'Lesson'}</strong><span>{statusLabel(item)}</span></div>
                <div style={{ marginTop: 2, color: '#111827', fontWeight: 800, fontSize: 11 }}>{item.title || 'Untitled lesson'}</div>
                {teacher && item.item_type !== 'slate_assignment' && <div style={{ marginTop: 2, color: '#6b7280', fontSize: 9 }}>{instructionalTeacherLabel(teacher)}</div>}
                {!item.lesson_key && <div style={{ marginTop: 3, color: '#c7442e', fontSize: 9 }}>Open in Syllabus to prepare this concept</div>}
              </button>
            })}
          </div>
        </section>
      </div>

      {selectedLesson && <FacilitatorSyllabusLessonOverlay
        selection={selectedLesson}
        learnerId={learnerId}
        accessToken={accessToken}
        planTier={tier}
        resolvedToday={resolvedToday}
        activeRevisionId={activeRevisionId}
        onChanged={loadSyllabus}
        onClose={() => setSelectedLesson(null)}
        canChangeIntent={false}
      />}
    </div>
  )
}