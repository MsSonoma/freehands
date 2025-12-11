// Lesson picker component for scheduling
'use client'
import { useState, useEffect } from 'react'

export default function LessonPicker({ 
  learnerId, 
  selectedDate, 
  onScheduleLesson, 
  scheduledLessonsForDate = [] 
}) {
  const [approvedLessons, setApprovedLessons] = useState({})
  const [allLessons, setAllLessons] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [learnerGrade, setLearnerGrade] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [lessonDetails, setLessonDetails] = useState(null)

  const subjects = ['math', 'science', 'language arts', 'social studies', 'general']
  const grades = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

  useEffect(() => {
    if (learnerId) {
      loadLearnerGrade()
      loadApprovedLessons()
      loadAllLessons()
    }
  }, [learnerId])

  // Set grade filter to learner's grade when it loads
  useEffect(() => {
    if (learnerGrade && selectedGrade === 'all') {
      setSelectedGrade(learnerGrade)
    }
  }, [learnerGrade])

  const loadLearnerGrade = async () => {
    try {
      const { getSupabaseClient } = await import('@/app/lib/supabaseClient')
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .from('learners')
        .select('grade')
        .eq('id', learnerId)
        .maybeSingle()
      
      if (data?.grade) {
        setLearnerGrade(String(data.grade))
      }
    } catch (err) {
      // Silent fail
    }
  }

  const loadApprovedLessons = async () => {
    try {
      const { getSupabaseClient } = await import('@/app/lib/supabaseClient')
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .from('learners')
        .select('approved_lessons')
        .eq('id', learnerId)
        .maybeSingle()
      
      setApprovedLessons(data?.approved_lessons || {})
    } catch (err) {
      // Silent fail
    }
  }

  const loadAllLessons = async () => {
    try {
      const { getSupabaseClient } = await import('@/app/lib/supabaseClient')
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const lessonsMap = {}
      
      // Load public lessons for each subject
      for (const subject of subjects) {
        try {
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store'
          })
          const list = res.ok ? await res.json() : []
          lessonsMap[subject] = Array.isArray(list) ? list : []
        } catch (err) {
          lessonsMap[subject] = []
        }
      }
      
      // Load generated lessons from user's storage and insert into their respective subjects
      if (token) {
        try {
          const res = await fetch('/api/facilitator/lessons/list', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            const generatedList = await res.json()
            const sortedGeneratedList = generatedList.sort((a, b) => {
              const timeA = new Date(a.created_at || 0).getTime()
              const timeB = new Date(b.created_at || 0).getTime()
              return timeB - timeA
            })
            
            for (const lesson of sortedGeneratedList) {
              const subject = lesson.subject || 'math'
              const generatedLesson = {
                ...lesson,
                isGenerated: true
              }
              
              if (!lessonsMap[subject]) lessonsMap[subject] = []
              lessonsMap[subject].unshift(generatedLesson)
            }
          }
        } catch (err) {
          // Silent fail on generated lessons
        }
      }
      
      setAllLessons(lessonsMap)
    } catch (err) {
      // Silent fail
    }
  }

  const handleSchedule = async (lessonKey) => {
    if (!selectedDate) {
      alert('Please select a date first')
      return
    }

    setLoading(true)
    try {
      await onScheduleLesson(lessonKey, selectedDate)
      setSelectedLesson(null)
      setLessonDetails(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLessonClick = async (lesson) => {
    setSelectedLesson(lesson)
    setLoading(true)
    try {
      // Load lesson details
      const { getSupabaseClient } = await import('@/app/lib/supabaseClient')
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      // Fetch lesson content to get blurb
      const lessonPath = lesson.key
      const res = await fetch(`/api/lessons/load?key=${encodeURIComponent(lessonPath)}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      })
      const lessonData = res.ok ? await res.json() : null
      
      // Fetch completion/medal data for this learner
      const { data: historyData } = await supabase
        .from('lesson_history')
        .select('*')
        .eq('learner_id', learnerId)
        .eq('lesson_key', lessonPath)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      setLessonDetails({
        blurb: lessonData?.blurb || 'No description available',
        completed: !!historyData,
        completedAt: historyData?.completed_at,
        score: historyData?.score,
        medal: historyData?.medal_tier
      })
    } catch (err) {
      setLessonDetails({ blurb: 'Error loading lesson details', completed: false })
    } finally {
      setLoading(false)
    }
  }

  const isScheduled = (lessonKey) => {
    return scheduledLessonsForDate.some(item => item.lesson_key === lessonKey)
  }

  const getFilteredLessons = () => {
    const bySubject = {}
    
    // Group lessons by subject
    Object.entries(allLessons).forEach(([subject, lessons]) => {
      if (!Array.isArray(lessons)) return
      
      // Apply subject filter
      if (selectedSubject !== 'all' && subject !== selectedSubject) return
      
      bySubject[subject] = []
      
      lessons.forEach(item => {
        // Handle generated lessons (object format) and public lessons (string filenames)
        const filename = typeof item === 'string' ? item : item.filename || item.file || item.key
        if (!filename) return
        
        // For generated lessons, use 'generated/' prefix in the key
        const key = (item.isGenerated || item?.isGenerated === true) 
          ? `generated/${filename}` 
          : `${subject}/${filename}`
        
        const baseName = item.title || filename.replace('.json', '').replace(/_/g, ' ')
        const lessonName = (item.isGenerated || item?.isGenerated === true) ? `✨ ${baseName}` : baseName
        
        // Extract grade from filename (e.g., "4th_multiplying_with_zeros.json")
        let grade = null
        const gradeMatch = filename.match(/^(\d+)(st|nd|rd|th)_/i)
        if (gradeMatch) {
          grade = gradeMatch[1]
        } else if (filename.toLowerCase().startsWith('k_')) {
          grade = 'K'
        }
        
        // Apply grade filter
        if (selectedGrade !== 'all' && grade !== selectedGrade) return
        
        // Apply search filter
        if (searchTerm && !lessonName.toLowerCase().includes(searchTerm.toLowerCase())) return
        
        // Extract difficulty from filename (e.g., "1st_beginner_addition.json")
        let difficulty = 2 // default to intermediate
        const lowerName = filename.toLowerCase()
        if (lowerName.includes('beginner')) difficulty = 1
        else if (lowerName.includes('advanced')) difficulty = 3
        
        bySubject[subject].push({ key, subject, name: lessonName, difficulty, grade, isGenerated: item.isGenerated })
      })
      
      // Sort within subject by difficulty then name
      bySubject[subject].sort((a, b) => {
        if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty
        return a.name.localeCompare(b.name)
      })
    })
    
    return bySubject
  }

  const filteredLessonsBySubject = getFilteredLessons()
  const totalCount = Object.values(filteredLessonsBySubject).reduce((sum, lessons) => sum + lessons.length, 0)

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-300 overflow-hidden" style={{ height: 'fit-content' }}>
      {/* Helpful prompt when no date selected */}
      {!selectedDate && (
        <div style={{ 
          background: '#fef3c7', 
          padding: '8px 12px', 
          borderBottom: '1px solid #fbbf24',
          fontSize: '13px',
          color: '#92400e',
          textAlign: 'center'
        }}>
          ← Select a date on the calendar to schedule lessons
        </div>
      )}
      
      {/* Compact Header with filters */}
      <div style={{ background: 'linear-gradient(to right, #eff6ff, #e0e7ff)', padding: '10px 12px', borderBottom: '1px solid #d1d5db' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: 0 }}>
            Add Lessons
          </h3>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>
            {totalCount} available
          </div>
        </div>

        {/* Compact Search and Filter Row */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: '1',
              padding: '5px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              background: '#ffffff'
            }}
          />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            style={{
              padding: '5px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              background: '#ffffff',
              cursor: 'pointer',
              minWidth: '110px'
            }}
          >
            <option value="all">All Subjects</option>
            {subjects.map(subject => (
              <option key={subject} value={subject} style={{ textTransform: 'capitalize' }}>
                {subject.charAt(0).toUpperCase() + subject.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            style={{
              padding: '5px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              background: '#ffffff',
              cursor: 'pointer',
              minWidth: '90px'
            }}
          >
            <option value="all">All Grades</option>
            {grades.map(grade => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Compact Lessons List */}
      <div style={{ height: '400px', overflowY: 'auto' }}>
        {totalCount === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
            {Object.keys(allLessons).length === 0 ? 'Loading lessons...' : 'No lessons match your filters'}
          </div>
        ) : (
          <div>
            {Object.entries(filteredLessonsBySubject).map(([subject, lessons]) => {
              if (lessons.length === 0) return null
              
              return (
                <div key={subject}>
                  {/* Subject Header (only show when viewing all subjects) */}
                  {selectedSubject === 'all' && (
                    <div style={{ 
                      padding: '6px 12px', 
                      background: '#f9fafb', 
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#374151',
                      textTransform: 'capitalize',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1
                    }}>
                      {subject}
                    </div>
                  )}
                  
                  {/* Lessons for this subject */}
                  {lessons.map(lesson => {
                    const scheduled = isScheduled(lesson.key)
                    return (
                      <div
                        key={lesson.key}
                        onClick={() => handleLessonClick(lesson)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderBottom: '1px solid #e5e7eb',
                          transition: 'background 0.15s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ flex: '1', minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lesson.name}
                          </div>
                        </div>
                        {scheduled && (
                          <div style={{ 
                            fontSize: '11px', 
                            fontWeight: '600', 
                            color: '#065f46',
                            background: '#d1fae5',
                            padding: '2px 8px',
                            borderRadius: 4
                          }}>
                            ✓ Scheduled
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lesson Detail Overlay */}
      {selectedLesson && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => { setSelectedLesson(null); setLessonDetails(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '18px', 
                  fontWeight: '700', 
                  color: '#111827',
                  lineHeight: '1.4'
                }}>
                  {selectedLesson.name}
                </h3>
              </div>
              <button
                onClick={() => { setSelectedLesson(null); setLessonDetails(null); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '0',
                  lineHeight: '1',
                  transition: 'color 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#374151'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '20px' }}>
              {!lessonDetails ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                  Loading lesson details...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Blurb */}
                  {lessonDetails.blurb && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        About This Lesson
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                        {lessonDetails.blurb}
                      </p>
                    </div>
                  )}

                  {/* Completion Status */}
                  {lessonDetails.completed && (
                    <div style={{
                      padding: '12px',
                      background: '#d1fae5',
                      borderRadius: '8px',
                      border: '1px solid #a7f3d0'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#065f46', marginBottom: '4px' }}>
                        ✓ Completed
                      </div>
                      <div style={{ fontSize: '13px', color: '#047857' }}>
                        {lessonDetails.completedAt && new Date(lessonDetails.completedAt).toLocaleDateString()}
                        {lessonDetails.score !== null && lessonDetails.score !== undefined && ` • Score: ${lessonDetails.score}%`}
                      </div>
                    </div>
                  )}

                  {/* Medal */}
                  {lessonDetails.medal && (
                    <div style={{
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '24px' }}>
                        {lessonDetails.medal === 'gold' ? '🥇' : lessonDetails.medal === 'silver' ? '🥈' : '🥉'}
                      </span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', textTransform: 'capitalize' }}>
                          {lessonDetails.medal} Medal Earned
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Schedule Status */}
                  {isScheduled(selectedLesson.key) && (
                    <div style={{
                      padding: '12px',
                      background: '#dbeafe',
                      borderRadius: '8px',
                      border: '1px solid #93c5fd'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e40af' }}>
                        📅 Already Scheduled
                      </div>
                      <div style={{ fontSize: '13px', color: '#1e3a8a', marginTop: '4px' }}>
                        This lesson is scheduled for {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {lessonDetails && !isScheduled(selectedLesson.key) && selectedDate && (
              <div style={{
                padding: '20px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => handleSchedule(selectedLesson.key)}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#3b82f6',
                    color: '#ffffff',
                    cursor: loading ? 'default' : 'pointer',
                    transition: 'background 0.15s',
                    opacity: loading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#2563eb')}
                  onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#3b82f6')}
                >
                  {loading ? 'Scheduling...' : `Schedule on ${selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
