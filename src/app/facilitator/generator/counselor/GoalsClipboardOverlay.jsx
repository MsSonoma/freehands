// Persistent goals clipboard for Mr. Mentor
// Stores long-term goals/notes per learner or for facilitator
'use client'
import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'

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

  const loadGoals = useCallback(async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const params = new URLSearchParams()
      if (learnerId && learnerId !== 'none') {
        params.append('learner_id', learnerId)
      }
      
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const url = `/api/goals-notes?${params.toString()}`
      
      const response = await fetch(url, { headers })
      
      if (response.ok) {
        const data = await response.json()
        setText(data.goals_notes || '')
      }
    } catch (err) {
      // Silent error handling
    }
  }, [learnerId])

  useEffect(() => {
    if (visible) {
      // Load existing goals when overlay opens
      loadGoals()
    } else {
      // Clear text when overlay closes to ensure fresh load next time
      setText('')
    }
  }, [visible, learnerId, loadGoals])

  const handleSave = async () => {
    setSaving(true)
    setSaveStatus('')
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const body = { goals_notes: text }
      if (learnerId && learnerId !== 'none') {
        body.learner_id = learnerId
      }
      
      const headers = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/goals-notes', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        let errorData = {}
        const contentType = response.headers.get('content-type')
        
        try {
          const responseText = await response.text()
          
          if (contentType?.includes('application/json')) {
            errorData = JSON.parse(responseText)
          } else {
            errorData = { error: responseText || 'Unknown error' }
          }
        } catch (e) {
          errorData = { error: 'Failed to parse error response' }
        }
        
        throw new Error(errorData.error || `Failed to save goals (${response.status})`)
      }

      setSaveStatus('Saved!')
      if (onSave) {
        onSave(text)
      }
      
      setTimeout(() => {
        setSaveStatus('')
      }, 2000)
    } catch (err) {
      setSaveStatus(`Save failed: ${err.message}`)
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
          maxWidth: 480,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
              📋 {contextText}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
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
          padding: 14,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>
            Set goals, preferences, or context that should guide all conversations with Mr. Mentor.
          </div>

          <textarea
            value={text}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) {
                setText(e.target.value)
              }
            }}
            placeholder="Examples:&#10;• Focus on building confidence in math&#10;• Looking for gentle, engaging lessons&#10;• Working toward more independence&#10;• Need help balancing academics"
            style={{
              width: '100%',
              minHeight: 120,
              maxHeight: 180,
              padding: 10,
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: 1.5
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
          padding: '10px 16px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              fontSize: 13,
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
              padding: '7px 14px',
              border: 'none',
              borderRadius: 6,
              background: saving ? '#9ca3af' : '#2563eb',
              color: '#fff',
              fontSize: 13,
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
