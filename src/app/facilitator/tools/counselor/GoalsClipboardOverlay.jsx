// Persistent goals clipboard for Mr. Mentor
// Stores long-term goals/notes per learner or for facilitator
'use client'
import { useState, useEffect } from 'react'

const MAX_CHARS = 600

export default function GoalsClipboardOverlay({ 
  visible, 
  onClose, 
  learnerId, 
  learnerName,
  onSave 
}) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  const charCount = text.length
  const charsRemaining = MAX_CHARS - charCount

  useEffect(() => {
    if (visible && onSave) {
      // Load existing goals when overlay opens
      loadGoals()
    }
  }, [visible, learnerId])

  const loadGoals = async () => {
    try {
      const params = new URLSearchParams()
      if (learnerId && learnerId !== 'none') {
        params.append('learner_id', learnerId)
      }
      
      const response = await fetch(`/api/goals-notes?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setText(data.goals_notes || '')
      }
    } catch (err) {
      console.error('[GoalsClipboard] Failed to load goals:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveStatus('')
    
    try {
      const body = { goals_notes: text }
      if (learnerId && learnerId !== 'none') {
        body.learner_id = learnerId
      }
      
      const response = await fetch('/api/goals-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error('Failed to save goals')
      }

      setSaveStatus('Saved!')
      if (onSave) {
        onSave(text)
      }
      
      setTimeout(() => {
        setSaveStatus('')
      }, 2000)
    } catch (err) {
      console.error('[GoalsClipboard] Save failed:', err)
      setSaveStatus('Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!visible) return null

  const contextText = learnerId && learnerId !== 'none' 
    ? `Goals for ${learnerName || 'Learner'}` 
    : 'Your Personal Goals'

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.4)',
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
          maxWidth: 600,
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#1f2937' }}>
              📋 {contextText}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              Persistent notes that Mr. Mentor always sees
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              color: '#9ca3af',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ 
          flex: 1, 
          padding: 20,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ fontSize: 14, color: '#374151' }}>
            Set goals, preferences, or context that should guide all conversations with Mr. Mentor.
            These notes persist across sessions and help Mr. Mentor understand your priorities.
          </div>

          <textarea
            value={text}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) {
                setText(e.target.value)
              }
            }}
            placeholder="Examples:&#10;• Focus on building Emma's confidence in math&#10;• Looking for gentle, engaging science lessons&#10;• Working toward more independent learning&#10;• Need help balancing academics with creative time"
            style={{
              width: '100%',
              minHeight: 200,
              padding: 12,
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13
          }}>
            <div style={{ 
              color: charsRemaining < 50 ? '#dc2626' : '#6b7280' 
            }}>
              {charCount} / {MAX_CHARS} characters
            </div>
            {saveStatus && (
              <div style={{ 
                color: saveStatus.includes('failed') ? '#dc2626' : '#059669',
                fontWeight: 600
              }}>
                {saveStatus}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: saving ? '#9ca3af' : '#2563eb',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : 'Save Goals'}
          </button>
        </div>
      </div>
    </div>
  )
}
