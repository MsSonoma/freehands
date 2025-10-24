// Compact lessons list view for Mr. Mentor overlay
'use client'
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'

const SUBJECTS = ['math', 'science', 'language arts', 'social studies']
const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

export default function LessonsOverlay({ learnerId }) {
  const [allLessons, setAllLessons] = useState({})
  const [approvedLessons, setApprovedLessons] = useState({})
  const [medals, setMedals] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedSubjects, setExpandedSubjects] = useState({})
  const [gradeFilters, setGradeFilters] = useState({})

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
      setMedals({})
      setGradeFilters({})
      return
    }
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Load approved lessons and grade
      const { data: approvedData } = await supabase
        .from('learners')
        .select('approved_lessons, grade')
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
                          const medal = medals[lessonKey]

                          return (
                            <div
                              key={lesson.file}
                              style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #f3f4f6',
                                background: isApproved ? '#f0fdf4' : '#fff',
                                fontSize: 12
                              }}
                            >
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 6,
                                marginBottom: 2
                              }}>
                                {isApproved && <span>✅</span>}
                                {medal && <span>{emojiForTier(medal.medalTier)}</span>}
                                <span style={{ fontWeight: 600, color: '#1f2937' }}>
                                  {lesson.isGenerated && '✨ '}{lesson.title}
                                </span>
                              </div>
                              <div style={{ color: '#6b7280', fontSize: 11 }}>
                                {lesson.grade} • {lesson.difficulty}
                              </div>
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
