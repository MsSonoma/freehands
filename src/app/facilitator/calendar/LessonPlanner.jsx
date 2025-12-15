// Lesson Planner component for automated weekly scheduling
'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import CurriculumPreferencesOverlay from './CurriculumPreferencesOverlay'
import LessonGeneratorOverlay from './LessonGeneratorOverlay'
import { InlineExplainer, WorkflowGuide } from '@/components/FacilitatorHelp'

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
  const [planStartDate, setPlanStartDate] = useState('')
  const [planDuration, setPlanDuration] = useState(1)

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

      // Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

      let lessonContext = []
      let curriculumPrefs = {}

      // Build chronological lesson history with scores
      if (historyRes.ok) {
        const history = await historyRes.json()
        let medals = {}
        
        // Get medals if available
        if (medalsRes.ok) {
          medals = await medalsRes.json()
        }
        
        // Completed lessons with scores
        const completed = (history.sessions || [])
          .filter(s => s.status === 'completed')
          .map(s => ({
            name: s.lesson_id,
            date: s.ended_at,
            status: 'completed',
            score: medals[s.lesson_id]?.bestPercent || null
          }))

        // Incomplete lessons
        const incomplete = (history.sessions || [])
          .filter(s => s.status === 'incomplete')
          .map(s => ({
            name: s.lesson_id,
            date: s.started_at,
            status: 'incomplete'
          }))

        lessonContext = [...completed, ...incomplete]
      }

      // Add scheduled lessons
      if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json()
        const scheduledLessons = (scheduledData.schedule || []).map(s => ({
          name: s.lesson_key,
          date: s.scheduled_date,
          status: 'scheduled'
        }))
        lessonContext = [...lessonContext, ...scheduledLessons]
      }

      // Add planned lessons from current plan
      Object.entries(plannedLessons || {}).forEach(([date, dayLessons]) => {
        dayLessons.forEach(lesson => {
          lessonContext.push({
            name: lesson.title || lesson.id,
            date,
            status: 'planned'
          })
        })
      })

      // Sort chronologically
      lessonContext.sort((a, b) => new Date(a.date) - new Date(b.date))

      // Get curriculum preferences
      if (preferencesRes.ok) {
        curriculumPrefs = await preferencesRes.json()
      }

      // Build context string for GPT
      let contextText = ''
      if (lessonContext.length > 0) {
        contextText += '\n\nLearner Lesson History (chronological):\n'
        lessonContext.forEach(l => {
          if (l.status === 'completed' && l.score !== null) {
            contextText += `- ${l.name} (${l.status}, score: ${l.score}%)\n`
          } else {
            contextText += `- ${l.name} (${l.status})\n`
          }
        })
      }

      // Add curriculum preferences (only non-empty fields)
      if (curriculumPrefs.focus_concepts) {
        contextText += `\n\nFocus Concepts: ${curriculumPrefs.focus_concepts}`
      }
      if (curriculumPrefs.focus_topics) {
        contextText += `\n\nFocus Topics: ${curriculumPrefs.focus_topics}`
      }
      if (curriculumPrefs.focus_words) {
        contextText += `\n\nFocus Words: ${curriculumPrefs.focus_words}`
      }
      if (curriculumPrefs.banned_concepts) {
        contextText += `\n\nBanned Concepts: ${curriculumPrefs.banned_concepts}`
      }
      if (curriculumPrefs.banned_topics) {
        contextText += `\n\nBanned Topics: ${curriculumPrefs.banned_topics}`
      }
      if (curriculumPrefs.banned_words) {
        contextText += `\n\nBanned Words: ${curriculumPrefs.banned_words}`
      }

      // Calculate recommended difficulty based on recent performance
      const recentCompleted = lessonContext
        .filter(l => l.status === 'completed' && l.score !== null)
        .slice(-6) // Last 6 completed lessons
      
      let recommendedDifficulty = 'intermediate' // Safe default
      
      if (recentCompleted.length >= 3) {
        const avgScore = recentCompleted.reduce((sum, l) => sum + l.score, 0) / recentCompleted.length
        
        // Detect current level from recent lesson keywords
        const recentBeginner = recentCompleted.slice(-3).filter(l => 
          l.name.toLowerCase().includes('beginner') || 
          l.name.toLowerCase().includes('introduction') ||
          l.name.toLowerCase().includes('basics')
        ).length
        
        const recentAdvanced = recentCompleted.slice(-3).filter(l => 
          l.name.toLowerCase().includes('advanced') || 
          l.name.toLowerCase().includes('expert') ||
          l.name.toLowerCase().includes('mastery')
        ).length
        
        // Bidirectional adjustment based on performance
        if (avgScore >= 85 && recentAdvanced >= 2) {
          recommendedDifficulty = 'advanced' // Already advanced, doing great
        } else if (avgScore >= 80 && recentBeginner === 0) {
          recommendedDifficulty = 'advanced' // Ready to move up from intermediate
        } else if (avgScore <= 65) {
          recommendedDifficulty = 'beginner' // Struggling - move down
        } else if (avgScore <= 70 && recentAdvanced >= 2) {
          recommendedDifficulty = 'intermediate' // Struggling at advanced - move down
        }
        // else stays at intermediate (safe middle ground)
      }

      if (contextText) {
        contextText += '\n\n=== CRITICAL: AVOID ALL REPETITION ==='
        contextText += '\nThe lessons listed above have ALREADY been completed, scheduled, or planned.'
        contextText += '\nYou MUST create entirely NEW lessons on DIFFERENT topics.'
        contextText += '\nIf a topic like "Addition" was already covered, do NOT create "Addition Practice" or "More Addition".'
        contextText += '\nInstead, progress to the NEXT concept in the subject (e.g., Subtraction, Place Value, etc.).'
        contextText += '\n\nCurriculum Evolution Guidelines:'
        contextText += '\n- Each new lesson must advance to a NEW topic not yet covered'
        contextText += '\n- Build sequentially (e.g., after "Fractions Intro" → "Comparing Fractions" → "Adding Fractions")'
        contextText += '\n- Reference prior concepts but teach something genuinely new'
        contextText += `\n- Target difficulty: ${recommendedDifficulty} (maintain for 3-4 lessons before advancing)`
      }

      // Start from the exact date provided (no Monday adjustment)
      // Parse as local date to avoid timezone issues
      const [year, month, day] = startDate.split('-').map(Number)
      const start = new Date(year, month - 1, day)
      
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
                  difficulty: recommendedDifficulty,
                  learnerId,
                  context: contextText  // Include lesson history and preferences
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
      {/* Title and Workflow Guide */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>
          Create a Lesson Plan
        </h2>
        <WorkflowGuide
          workflowKey="lesson-planner-workflow"
          title="How Automated Lesson Planning Works"
          steps={[
            { 
              step: 'Set your weekly pattern', 
              description: 'Check which subjects you want to teach on each day of the week below' 
            },
            { 
              step: 'Choose start date and duration', 
              description: 'Select when to begin and how many weeks/months to plan' 
            },
            { 
              step: 'Generate lesson plan', 
              description: 'We create lesson outlines based on your learner\'s history and grade level' 
            },
            { 
              step: 'Review and generate full lessons', 
              description: 'Click dates in the calendar to see planned lessons. Generate full lesson content for any outline you like' 
            }
          ]}
        />
      </div>

      {/* Weekly Pattern Section */}
      <div style={{
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        padding: '16px 8px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 12,
          paddingLeft: 8,
          paddingRight: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>
              Weekly Schedule Pattern
            </h3>
            <InlineExplainer
              helpKey="weekly-pattern-explainer"
              title="Weekly Pattern"
            >
              <p>Check the subjects you want to teach on each day. This pattern repeats every week for the duration you specify.</p>
              <p className="mt-2">Example: Check "Math" on Monday, Wednesday, Friday to schedule 3 math lessons per week.</p>
            </InlineExplainer>
          </div>
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
        <div className="weekly-pattern-grid">
          {DAYS.map(day => {
            const daySubjects = weeklyPattern[day] || []
            return (
              <div 
                key={day}
                className="day-column"
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
                    const getSubjectLabel = (subj) => {
                      if (subj === 'language arts') return <span><span className="full-label">Language Arts</span><span className="abbr-label">LA</span></span>
                      if (subj === 'social studies') return <span><span className="full-label">Social Studies</span><span className="abbr-label">SS</span></span>
                      return subj.charAt(0).toUpperCase() + subj.slice(1)
                    }
                    return (
                      <button
                        key={subject}
                        onClick={() => toggleSubjectForDay(day, subject)}
                        className="subject-button"
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
                        {getSubjectLabel(subject)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Generate Plan Controls */}
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end'
        }}>
          {/* Starting Date Selector */}
          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 4
            }}>
              Starting Date
            </label>
            <input
              type="date"
              value={planStartDate}
              onChange={(e) => setPlanStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff'
              }}
            />
          </div>

          {/* Duration Selector */}
          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 4
            }}>
              Duration
            </label>
            <select
              value={planDuration}
              onChange={(e) => setPlanDuration(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff'
              }}
            >
              <option value={1}>1 Month</option>
              <option value={2}>2 Months</option>
              <option value={3}>3 Months</option>
              <option value={4}>4 Months</option>
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={() => {
              const startDate = planStartDate || (() => {
                const today = new Date()
                return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
              })()
              const weeksToGenerate = planDuration * 4 // Approximate weeks per month
              generatePlannedLessons(startDate, weeksToGenerate)
            }}
            disabled={generating || !learnerId}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: generating || !learnerId ? '#9ca3af' : '#10b981',
              color: '#fff',
              cursor: generating || !learnerId ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {generating ? 'Generating...' : 'Generate Lesson Plan'}
          </button>
        </div>
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

      <style jsx>{`
        .weekly-pattern-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          margin-bottom: 16px;
        }

        .day-column {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 4px;
          background: #f9fafb;
          min-width: 0;
        }

        .subject-button {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 3px 4px !important;
          font-size: 9px !important;
        }

        .abbr-label {
          display: none;
        }

        .full-label {
          display: inline;
        }

        @media (max-width: 768px) {
          .abbr-label {
            display: inline;
          }
          .full-label {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .weekly-pattern-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .day-column {
            padding: 12px;
          }
          .subject-button {
            padding: 4px 6px !important;
            font-size: 10px !important;
          }
          .abbr-label {
            display: none;
          }
          .full-label {
            display: inline;
          }
        }
      `}</style>
    </div>
  )
}
