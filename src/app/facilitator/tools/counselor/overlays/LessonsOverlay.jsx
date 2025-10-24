// Compact lessons list view for Mr. Mentor overlay
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'

const SUBJECTS = ['math', 'science', 'language arts', 'social studies']
const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

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
  const [expandedSubjects, setExpandedSubjects] = useState({})
  const [gradeFilters, setGradeFilters] = useState({})
  const [editingNote, setEditingNote] = useState(null)
  const [schedulingLesson, setSchedulingLesson] = useState(null)

  useEffect(() => {
    loadLessons()
  }, [])

  useEffect(() => {
    if (learnerId && learnerId !== 'none') {
      loadLearnerData()
    } else {
      setApprovedLessons({})
      setMedals({})
    }
  }, [learnerId])

  const loadLessons = async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      console.log('[LessonsOverlay] Session token available:', !!token)
      
      const results = {}
      
      // Load lessons from public folders for each subject
      for (const subject of SUBJECTS) {
        try {
          console.log(`[LessonsOverlay] Fetching lessons for subject: ${subject}`)
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store'
          })
          console.log(`[LessonsOverlay] Response for ${subject}:`, res.status, res.ok)
          if (!res.ok) {
            console.error(`Failed to load ${subject} lessons:`, res.status)
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
      
      // Load generated lessons from user's storage
      if (token) {
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
            // Merge generated lessons into their respective subjects with ✨ marker
            for (const lesson of generatedList) {
              const subject = lesson.subject || 'math'
              if (!results[subject]) results[subject] = []
              results[subject].push({
                ...lesson,
                isGenerated: true // Mark as generated for display
              })
            }
          }
        } catch (err) {
          console.error('Error loading generated lessons:', err)
        }
      }
      
      console.log('[LessonsOverlay] All lessons loaded:', Object.keys(results).map(s => `${s}: ${results[s].length}`))
      setAllLessons(results)
    } catch (err) {
      console.error('Failed to load lessons:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadLearnerData = async () => {
    if (!learnerId || learnerId === 'none') {
      setApprovedLessons({})
      setLessonNotes({})
      setScheduledLessons({})
      setFutureScheduledLessons({})
      setMedals({})
      setGradeFilters({})
      return
    }
    
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

      if (approvedData?.approved_lessons && Array.isArray(approvedData.approved_lessons)) {
        const approvedMap = {}
        approvedData.approved_lessons.forEach(key => {
          approvedMap[key] = true
        })
        setApprovedLessons(approvedMap)
      } else {
        setApprovedLessons({})
      }

      setLessonNotes(approvedData?.lesson_notes || {})

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

      // Set grade filters to learner's grade for all subjects
      if (approvedData?.grade) {
        const filters = {}
        SUBJECTS.forEach(subject => {
          filters[subject] = approvedData.grade
        })
        setGradeFilters(filters)
      } else {
        setGradeFilters({})
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
      setGradeFilters({})
    }
  }

  const toggleSubject = (subject) => {
    setExpandedSubjects(prev => ({ ...prev, [subject]: !prev[subject] }))
  }

  const setGradeFilter = (subject, grade) => {
    setGradeFilters(prev => ({ ...prev, [subject]: grade }))
  }

  const filterLessonsByGrade = (lessons, subject) => {
    const selectedGrade = gradeFilters[subject]
    if (!selectedGrade || selectedGrade === 'all') return lessons
    return lessons.filter(lesson => {
      if (!lesson.grade) return false
      // Normalize lesson grade: "4th" -> "4", "K" -> "K", "10th" -> "10"
      const lessonGrade = String(lesson.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
      return lessonGrade === String(selectedGrade).toUpperCase()
    })
  }

  const getLessonKey = (subject, filename) => `${subject}/${filename}`

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

  return (
    <div style={{ 
      height: '100%', 
      background: '#fff', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px', 
        background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>
          📚 Lessons
        </div>
      </div>

      {/* Lessons List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>
            Loading lessons...
          </div>
        ) : Object.keys(allLessons).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>
            No lessons loaded. Check console for errors.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SUBJECTS.map(subject => {
              const lessons = allLessons[subject] || []
              const isExpanded = expandedSubjects[subject]
              const filteredLessons = filterLessonsByGrade(lessons, subject)

              return (
                <div key={subject} style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: 8,
                  overflow: 'hidden'
                }}>
                  {/* Subject Header */}
                  <button
                    onClick={() => toggleSubject(subject)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: isExpanded ? '#f3f4f6' : '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#1f2937',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ textTransform: 'capitalize' }}>
                      {isExpanded ? '▼' : '▶'} {subject} ({filteredLessons.length})
                    </span>
                  </button>

                  {/* Grade Filter */}
                  {isExpanded && (
                    <div style={{ 
                      padding: '8px 12px', 
                      background: '#f9fafb',
                      borderTop: '1px solid #e5e7eb',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setGradeFilter(subject, 'all')}
                          style={{
                            padding: '4px 8px',
                            fontSize: 11,
                            borderRadius: 4,
                            border: '1px solid',
                            borderColor: (gradeFilters[subject] || 'all') === 'all' ? '#3b82f6' : '#d1d5db',
                            background: (gradeFilters[subject] || 'all') === 'all' ? '#dbeafe' : '#fff',
                            color: (gradeFilters[subject] || 'all') === 'all' ? '#1e40af' : '#6b7280',
                            cursor: 'pointer',
                            fontWeight: (gradeFilters[subject] || 'all') === 'all' ? 600 : 400
                          }}
                        >
                          All
                        </button>
                        {GRADES.map(grade => {
                          const isSelected = String(gradeFilters[subject]) === grade
                          return (
                            <button
                              key={grade}
                              onClick={() => setGradeFilter(subject, grade)}
                              style={{
                                padding: '4px 8px',
                                fontSize: 11,
                                borderRadius: 4,
                                border: '1px solid',
                                borderColor: isSelected ? '#3b82f6' : '#d1d5db',
                                background: isSelected ? '#dbeafe' : '#fff',
                                color: isSelected ? '#1e40af' : '#6b7280',
                                cursor: 'pointer',
                                fontWeight: isSelected ? 600 : 400
                              }}
                            >
                              {grade}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lessons */}
                  {isExpanded && (
                    <div>
                      {filteredLessons.length === 0 ? (
                        <div style={{ 
                          padding: 16, 
                          textAlign: 'center', 
                          color: '#9ca3af',
                          fontSize: 12,
                          fontStyle: 'italic'
                        }}>
                          No lessons found
                        </div>
                      ) : (
                        filteredLessons.map(lesson => {
                          // Use 'generated' prefix for generated lessons, actual subject for public lessons
                          const lessonKey = lesson.isGenerated 
                            ? `generated/${lesson.file}` 
                            : getLessonKey(subject, lesson.file)
                          const isApproved = approvedLessons[lessonKey]
                          const isScheduled = scheduledLessons[lessonKey]
                          const futureDate = futureScheduledLessons[lessonKey]
                          const medal = medals[lessonKey]
                          const noteText = lessonNotes[lessonKey] || ''
                          const isEditingThisNote = editingNote === lessonKey
                          const isSchedulingThis = schedulingLesson === lessonKey

                          return (
                            <div
                              key={lesson.file}
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
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                  {isApproved && <span style={{ fontSize: 14 }}>✅</span>}
                                  {isScheduled && <span style={{ fontSize: 12 }} title="Scheduled for today">📅</span>}
                                  {!isScheduled && futureDate && <span style={{ fontSize: 12, opacity: 0.5 }} title={`Scheduled for ${futureDate}`}>📅</span>}
                                  {medal && <span style={{ fontSize: 14 }}>{emojiForTier(medal.medalTier)}</span>}
                                </div>
                                <div style={{ flex: 1, minWidth: 150 }}>
                                  <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 12 }}>
                                    {lesson.isGenerated && '✨ '}{lesson.title}
                                  </div>
                                  <div style={{ color: '#6b7280', fontSize: 11 }}>
                                    {lesson.grade} • {lesson.difficulty}
                                  </div>
                                </div>

                                {/* Compact action buttons that wrap with content */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/facilitator/lessons/edit?key=${encodeURIComponent(lessonKey)}`)
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
                                  📅 Schedule
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
                                    
                                    {/* Simple date input */}
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
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
