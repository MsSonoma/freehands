// Day view overlay showing all scheduled and planned lessons for a selected date
'use client'
import { useState } from 'react'
import LessonGeneratorOverlay from './LessonGeneratorOverlay'
import LessonEditor from '@/app/components/LessonEditor'

export default function DayViewOverlay({ 
  selectedDate, 
  scheduledLessons = [], 
  plannedLessons = [], 
  learnerId,
  tier,
  onClose,
  onLessonGenerated,
  onNoSchoolSet,
  noSchoolReason = null
}) {
  const [showGenerator, setShowGenerator] = useState(false)
  const [generatorData, setGeneratorData] = useState(null)
  const [editingLesson, setEditingLesson] = useState(null)
  const [lessonEditorData, setLessonEditorData] = useState(null)
  const [lessonEditorLoading, setLessonEditorLoading] = useState(false)
  const [lessonEditorSaving, setLessonEditorSaving] = useState(false)
  const [showNoSchoolInput, setShowNoSchoolInput] = useState(false)
  const [noSchoolInputValue, setNoSchoolInputValue] = useState(noSchoolReason || '')

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  const handleGenerateClick = (plannedLesson) => {
    setGeneratorData({
      grade: plannedLesson.grade || '',
      difficulty: plannedLesson.difficulty || 'intermediate',
      subject: plannedLesson.subject || '',
      title: plannedLesson.title || '',
      description: plannedLesson.description || ''
    })
    setShowGenerator(true)
  }

  const handleEditClick = async (scheduledLesson) => {
    setEditingLesson(scheduledLesson.lesson_key)
    setLessonEditorLoading(true)
    
    try {
      const response = await fetch(`/api/facilitator/lessons/${encodeURIComponent(scheduledLesson.lesson_key)}`)
      if (!response.ok) throw new Error('Failed to load lesson')
      
      const data = await response.json()
      setLessonEditorData(data.lesson)
    } catch (err) {
      console.error('Error loading lesson:', err)
      alert('Failed to load lesson for editing')
      setEditingLesson(null)
    } finally {
      setLessonEditorLoading(false)
    }
  }

  const handleSaveLessonEdits = async (updatedLesson) => {
    setLessonEditorSaving(true)
    
    try {
      const response = await fetch(`/api/facilitator/lessons/${encodeURIComponent(editingLesson)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson: updatedLesson })
      })

      if (!response.ok) throw new Error('Failed to save lesson')
      
      alert('Lesson updated successfully!')
      setEditingLesson(null)
      setLessonEditorData(null)
      if (onLessonGenerated) onLessonGenerated()
    } catch (err) {
      console.error('Error saving lesson:', err)
      alert('Failed to save lesson changes')
    } finally {
      setLessonEditorSaving(false)
    }
  }

  const handleNoSchoolSave = () => {
    if (onNoSchoolSet) {
      onNoSchoolSet(selectedDate, noSchoolInputValue.trim() || null)
    }
    setShowNoSchoolInput(false)
  }

  // If generator overlay is open, show it
  if (showGenerator) {
    return (
      <LessonGeneratorOverlay
        learnerId={learnerId}
        tier={tier}
        scheduledDate={selectedDate}
        prefilledData={generatorData}
        onClose={() => setShowGenerator(false)}
        onGenerated={() => {
          setShowGenerator(false)
          if (onLessonGenerated) onLessonGenerated()
        }}
      />
    )
  }

  // If lesson editor is open, show it
  if (editingLesson) {
    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          padding: 16
        }}
        onClick={() => {
          if (!lessonEditorSaving && confirm('Close without saving changes?')) {
            setEditingLesson(null)
            setLessonEditorData(null)
          }
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            width: '100%',
            maxWidth: 900,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {lessonEditorLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              Loading lesson...
            </div>
          ) : lessonEditorData ? (
            <LessonEditor
              initialLesson={lessonEditorData}
              onSave={handleSaveLessonEdits}
              onCancel={() => {
                if (!lessonEditorSaving || confirm('Cancel editing?')) {
                  setEditingLesson(null)
                  setLessonEditorData(null)
                }
              }}
              busy={lessonEditorSaving}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: '#ef4444' }}>
              Failed to load lesson
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main day view overlay
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          maxWidth: 700,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ 
            fontSize: 20, 
            fontWeight: 700, 
            color: '#1f2937',
            marginBottom: 4
          }}>
            {formattedDate}
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            {scheduledLessons.length} scheduled  {plannedLessons.length} planned
          </p>
        </div>

        {/* No School Section */}
        <div style={{ 
          marginBottom: 20,
          padding: 12,
          background: noSchoolReason ? '#fef3c7' : '#f9fafb',
          borderRadius: 8,
          border: `1px solid ${noSchoolReason ? '#fbbf24' : '#e5e7eb'}`
        }}>
          {noSchoolReason ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>
                   No School
                </span>
                <button
                  onClick={() => {
                    setNoSchoolInputValue('')
                    handleNoSchoolSave()
                  }}
                  style={{
                    marginLeft: 'auto',
                    padding: '2px 8px',
                    fontSize: 11,
                    background: 'transparent',
                    border: '1px solid #d97706',
                    borderRadius: 4,
                    color: '#92400e',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
              <p style={{ fontSize: 13, color: '#78350f', margin: 0 }}>
                {noSchoolReason}
              </p>
            </div>
          ) : showNoSchoolInput ? (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Reason (optional)
              </label>
              <input
                type=\"text\"
                value={noSchoolInputValue}
                onChange={(e) => setNoSchoolInputValue(e.target.value)}
                placeholder=\"e.g., Holiday, Field Trip, Teacher Planning Day\"
                autoFocus
                style={{
                  width: '100%',
                  padding: 8,
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  fontSize: 13,
                  boxSizing: 'border-box',
                  marginBottom: 8
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleNoSchoolSave}
                  style={{
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowNoSchoolInput(false)
                    setNoSchoolInputValue(noSchoolReason || '')
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#fff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNoSchoolInput(true)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                background: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
               Mark as No School
            </button>
          )}
        </div>

        {/* Lessons */}
        {scheduledLessons.length === 0 && plannedLessons.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 40, 
            color: '#9ca3af',
            background: '#f9fafb',
            borderRadius: 8
          }}>
            No lessons scheduled or planned for this day
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Scheduled Lessons */}
            {scheduledLessons.map(lesson => {
              const [subject, filename] = lesson.lesson_key.split('/')
              const lessonName = filename?.replace('.json', '').replace(/_/g, ' ') || lesson.lesson_key
              
              return (
                <div
                  key={lesson.id}
                  style={{
                    padding: 12,
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: 11, 
                        fontWeight: 700, 
                        color: '#065f46',
                        textTransform: 'uppercase',
                        marginBottom: 4
                      }}>
                         Scheduled
                      </div>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 600, 
                        color: '#111827',
                        marginBottom: 2
                      }}>
                        {lessonName}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {subject}
                      </div>
                    </div>
                    <button
                      onClick={() => handleEditClick(lesson)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#fff',
                        color: '#065f46',
                        border: '1px solid #86efac',
                        borderRadius: 4,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Edit Lesson
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Planned Lessons */}
            {plannedLessons.map(lesson => (
              <div
                key={lesson.id}
                style={{
                  padding: 12,
                  background: '#eff6ff',
                  border: '1px solid #93c5fd',
                  borderRadius: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      color: '#1e40af',
                      textTransform: 'uppercase',
                      marginBottom: 4
                    }}>
                       Planned
                    </div>
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: 600, 
                      color: '#111827',
                      marginBottom: 4
                    }}>
                      {lesson.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      {lesson.description}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {lesson.subject}  {lesson.grade}  {lesson.difficulty}
                    </div>
                  </div>
                  <button
                    onClick={() => handleGenerateClick(lesson)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Generate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Close Button */}
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              background: '#fff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
