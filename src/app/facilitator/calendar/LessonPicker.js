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

  const subjects = ['math', 'science', 'language arts', 'social studies', 'general', 'generated']
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
      for (const subject of subjects) {
        try {
          const headers = subject === 'generated' && token ? { Authorization: `Bearer ${token}` } : {}
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store',
            headers
          })
          const list = res.ok ? await res.json() : []
          lessonsMap[subject] = Array.isArray(list) ? list : []
        } catch (err) {
          lessonsMap[subject] = []
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
        // Handle both string filenames and object format
        const filename = typeof item === 'string' ? item : item.filename || item.file || item.key
        if (!filename) return
        
        const key = `${subject}/${filename}`
        const lessonName = filename.replace('.json', '').replace(/_/g, ' ')
        
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
        
        bySubject[subject].push({ key, subject, name: lessonName, difficulty, grade })
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
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderBottom: '1px solid #e5e7eb',
                          transition: 'background 0.15s',
                          cursor: scheduled ? 'default' : 'pointer'
                        }}
                        onMouseEnter={(e) => !scheduled && (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ flex: '1', minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lesson.name}
                          </div>
                        </div>
                        <button
                          onClick={() => !scheduled && selectedDate && handleSchedule(lesson.key)}
                          disabled={scheduled || loading || !selectedDate}
                          style={{
                            padding: scheduled ? '3px 10px' : '5px 12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: scheduled || !selectedDate ? 'default' : 'pointer',
                            transition: 'all 0.15s',
                            background: scheduled ? '#d1fae5' : !selectedDate ? '#d1d5db' : '#3b82f6',
                            color: scheduled ? '#065f46' : !selectedDate ? '#9ca3af' : '#ffffff',
                            whiteSpace: 'nowrap',
                            opacity: !selectedDate ? 0.6 : 1
                          }}
                          onMouseEnter={(e) => !scheduled && selectedDate && (e.currentTarget.style.background = '#2563eb')}
                          onMouseLeave={(e) => !scheduled && selectedDate && (e.currentTarget.style.background = '#3b82f6')}
                          title={!selectedDate ? 'Select a date first' : scheduled ? 'Already scheduled' : 'Add to schedule'}
                        >
                          {scheduled ? '✓' : 'Add'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
