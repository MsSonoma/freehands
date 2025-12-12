// Lesson Planner component for automated weekly scheduling
'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import CurriculumPreferencesOverlay from './CurriculumPreferencesOverlay'
import LessonGeneratorOverlay from './LessonGeneratorOverlay'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const CORE_SUBJECTS = ['math', 'language arts', 'science', 'social studies', 'general']

export default function LessonPlanner({ 
  learnerId, 
  tier,
  selectedDate,
  plannedLessons = {},
  onPlannedLessonsChange,
  onLessonGenerated 
}) {
  const [customSubjects, setCustomSubjects] = useState([])
  const [weeklyPattern, setWeeklyPattern] = useState({
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: []
  })
  const [newSubjectName, setNewSubjectName] = useState('')
  const [showPreferences, setShowPreferences] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [generatorData, setGeneratorData] = useState(null)
  const [generatorDate, setGeneratorDate] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [templateId, setTemplateId] = useState(null)

  useEffect(() => {
    loadCustomSubjects()
    loadWeeklyPattern()
  }, [learnerId])

  const loadCustomSubjects = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) return

      const response = await fetch('/api/custom-subjects', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const result = await response.json()
        setCustomSubjects(result.subjects || [])
      }
    } catch (err) {
      console.error('Error loading custom subjects:', err)
    }
  }

  const loadWeeklyPattern = async () => {
    if (!learnerId) return

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) return

      const response = await fetch(`/api/schedule-templates?learnerId=${learnerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const result = await response.json()
        const templates = result.templates || []
        
        if (templates.length > 0) {
          const activeTemplate = templates.find(t => t.active) || templates[0]
          setWeeklyPattern(activeTemplate.pattern || {})
          setTemplateId(activeTemplate.id)
        }
      }
    } catch (err) {
      console.error('Error loading weekly pattern:', err)
    }
  }

  const handleAddCustomSubject = async () => {
    if (!newSubjectName.trim()) return

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) return

      const response = await fetch('/api/custom-subjects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newSubjectName.trim()
        })
      })

      if (response.ok) {
        setNewSubjectName('')
        await loadCustomSubjects()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create custom subject')
      }
    } catch (err) {
      console.error('Error creating custom subject:', err)
      alert('Failed to create custom subject')
    }
  }

  const handleDeleteCustomSubject = async (subjectId) => {
    if (!confirm('Delete this custom subject?')) return

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) return

      const response = await fetch(`/api/custom-subjects?id=${subjectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        await loadCustomSubjects()
      }
    } catch (err) {
      console.error('Error deleting custom subject:', err)
    }
  }

  const toggleSubjectForDay = (day, subject) => {
    const daySubjects = weeklyPattern[day] || []
    const hasSubject = daySubjects.some(s => s.subject === subject)

    if (hasSubject) {
      setWeeklyPattern({
        ...weeklyPattern,
        [day]: daySubjects.filter(s => s.subject !== subject)
      })
    } else {
      setWeeklyPattern({
        ...weeklyPattern,
        [day]: [...daySubjects, { subject }]
      })
    }
  }

  const saveWeeklyPattern = async () => {
    if (!learnerId) {
      alert('Please select a learner first')
      return
    }

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) return

      const method = templateId ? 'PUT' : 'POST'
      const body = {
        learnerId,
        name: 'Weekly Schedule',
        pattern: weeklyPattern,
        active: true
      }

      if (templateId) {
        body.id = templateId
      }

      const response = await fetch('/api/schedule-templates', {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const result = await response.json()
        if (!templateId) {
          setTemplateId(result.template.id)
        }
        alert('Weekly pattern saved!')
      }
    } catch (err) {
      console.error('Error saving pattern:', err)
      alert('Failed to save weekly pattern')
    }
  }

  const generatePlannedLessons = async (startDate, weeks = 4) => {
    if (!learnerId) {
      alert('Please select a learner first')
      return
    }

    const hasAnySubjects = DAYS.some(day => weeklyPattern[day]?.length > 0)
    if (!hasAnySubjects) {
      alert('Please assign subjects to at least one day of the week')
      return
    }

    setGenerating(true)
    const lessons = {}

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setGenerating(false)
        return
      }

      // Find the Monday of the week containing startDate
      // Parse as local date to avoid timezone issues
      const [year, month, day] = startDate.split('-').map(Number)
      const start = new Date(year, month - 1, day)
      const dayOfWeek = start.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
      const daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1) // Move back to Monday
      start.setDate(start.getDate() + daysToMonday)
      
      for (let week = 0; week < weeks; week++) {
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const currentDate = new Date(start)
          currentDate.setDate(start.getDate() + (week * 7) + dayIndex)
          
          const dayName = DAYS[currentDate.getDay()]
          const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
          const daySubjects = weeklyPattern[dayName] || []

          for (const subjectInfo of daySubjects) {
            // Generate outline for each subject on this day
            try {
              const response = await fetch('/api/generate-lesson-outline', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  subject: subjectInfo.subject,
                  grade: '3rd', // Default - user can change in generator
                  difficulty: 'intermediate',
                  learnerId
                })
              })

              if (response.ok) {
                const result = await response.json()
                const outline = result.outline

                if (!lessons[dateStr]) {
                  lessons[dateStr] = []
                }

                lessons[dateStr].push({
                  ...outline,
                  id: `${dateStr}-${subjectInfo.subject}`,
                  subject: subjectInfo.subject
                })
              }
            } catch (err) {
              console.error('Error generating outline:', err)
            }
          }
        }
      }

      if (onPlannedLessonsChange) {
        onPlannedLessonsChange(lessons)
      }
    } catch (err) {
      console.error('Error generating planned lessons:', err)
      alert('Failed to generate lesson plan')
    } finally {
      setGenerating(false)
    }
  }

  const handleLessonClick = (lesson, date) => {
    setGeneratorData({
      title: lesson.title,
      description: lesson.description,
      subject: lesson.subject,
      grade: lesson.grade,
      difficulty: lesson.difficulty
    })
    setGeneratorDate(date)
    setShowGenerator(true)
  }

  const allSubjects = [...CORE_SUBJECTS, ...customSubjects.map(s => s.name)]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Weekly Pattern Section */}
      <div style={{
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        padding: 16
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>
            Weekly Schedule Pattern
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowPreferences(true)}
              disabled={!learnerId}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                cursor: learnerId ? 'pointer' : 'not-allowed'
              }}
            >
              Curriculum Preferences
            </button>
            <button
              onClick={saveWeeklyPattern}
              disabled={!learnerId}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                background: learnerId ? '#2563eb' : '#9ca3af',
                color: '#fff',
                cursor: learnerId ? 'pointer' : 'not-allowed'
              }}
            >
              Save Pattern
            </button>
          </div>
        </div>

        {/* Day of Week Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: 8,
          marginBottom: 16
        }}>
          {DAYS.map(day => {
            const daySubjects = weeklyPattern[day] || []
            return (
              <div 
                key={day} 
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: 12,
                  background: '#f9fafb'
                }}
              >
                <div style={{ 
                  fontSize: 12, 
                  fontWeight: 700, 
                  color: '#6b7280',
                  marginBottom: 8,
                  textAlign: 'center',
                  textTransform: 'uppercase'
                }}>
                  {day.slice(0, 3)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {allSubjects.map(subject => {
                    const isSelected = daySubjects.some(s => s.subject === subject)
                    return (
                      <button
                        key={subject}
                        onClick={() => toggleSubjectForDay(day, subject)}
                        style={{
                          padding: '4px 6px',
                          fontSize: 10,
                          borderRadius: 4,
                          border: 'none',
                          background: isSelected ? '#dbeafe' : '#fff',
                          color: isSelected ? '#1e40af' : '#6b7280',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 600 : 400,
                          textAlign: 'left',
                          border: '1px solid ' + (isSelected ? '#93c5fd' : '#e5e7eb')
                        }}
                      >
                        {subject.charAt(0).toUpperCase() + subject.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Generate Button */}
        <button
          onClick={() => {
            const today = new Date()
            const localDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            generatePlannedLessons(localDateStr, 4)
          }}
          disabled={generating || !learnerId}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            background: generating || !learnerId ? '#9ca3af' : '#10b981',
            color: '#fff',
            cursor: generating || !learnerId ? 'not-allowed' : 'pointer'
          }}
        >
          {generating ? 'Generating Lesson Plan...' : 'Generate 4-Week Lesson Plan'}
        </button>
      </div>

      {/* Custom Subjects Section */}
      <div style={{
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        padding: 16
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 12 }}>
          Custom Subjects
        </h3>
        
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            placeholder="Enter new subject name"
            onKeyPress={(e) => e.key === 'Enter' && handleAddCustomSubject()}
            style={{
              flex: 1,
              padding: 8,
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13
            }}
          />
          <button
            onClick={handleAddCustomSubject}
            disabled={!newSubjectName.trim()}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: newSubjectName.trim() ? '#2563eb' : '#9ca3af',
              color: '#fff',
              cursor: newSubjectName.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Add
          </button>
        </div>

        {customSubjects.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {customSubjects.map(subject => (
              <div
                key={subject.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: '#f3f4f6',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#374151'
                }}
              >
                {subject.name}
                <button
                  onClick={() => handleDeleteCustomSubject(subject.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Planned Lessons Info */}
      {Object.keys(plannedLessons).length > 0 && (
        <div style={{
          background: '#eff6ff',
          borderRadius: 8,
          border: '1px solid #93c5fd',
          padding: 12
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af' }}>
            ✓ Lesson plan generated! Click on dates in the calendar to see planned lessons.
          </div>
        </div>
      )}

      {/* Modals */}
      {showPreferences && (
        <CurriculumPreferencesOverlay
          learnerId={learnerId}
          onClose={() => setShowPreferences(false)}
          onSaved={() => {
            // Preferences saved
          }}
        />
      )}

      {showGenerator && generatorData && (
        <LessonGeneratorOverlay
          learnerId={learnerId}
          tier={tier}
          scheduledDate={generatorDate}
          prefilledData={generatorData}
          onClose={() => {
            setShowGenerator(false)
            setGeneratorData(null)
            setGeneratorDate(null)
          }}
          onGenerated={() => {
            if (onLessonGenerated) onLessonGenerated()
          }}
        />
      )}
    </div>
  )
}
