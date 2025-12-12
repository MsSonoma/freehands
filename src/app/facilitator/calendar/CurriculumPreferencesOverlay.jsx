// Curriculum preferences overlay for lesson planner
'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'

export default function CurriculumPreferencesOverlay({ learnerId, onClose, onSaved }) {
  const [bannedWords, setBannedWords] = useState('')
  const [bannedTopics, setBannedTopics] = useState('')
  const [bannedConcepts, setBannedConcepts] = useState('')
  const [focusTopics, setFocusTopics] = useState('')
  const [focusConcepts, setFocusConcepts] = useState('')
  const [focusKeywords, setFocusKeywords] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [learnerId])

  const loadPreferences = async () => {
    if (!learnerId) {
      setLoading(false)
      return
    }

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setLoading(false)
        return
      }

      const response = await fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        const prefs = result.preferences

        if (prefs) {
          setBannedWords(prefs.banned_words?.join(', ') || '')
          setBannedTopics(prefs.banned_topics?.join(', ') || '')
          setBannedConcepts(prefs.banned_concepts?.join(', ') || '')
          setFocusTopics(prefs.focus_topics?.join(', ') || '')
          setFocusConcepts(prefs.focus_concepts?.join(', ') || '')
          setFocusKeywords(prefs.focus_keywords?.join(', ') || '')
        }
      }
    } catch (err) {
      console.error('Error loading preferences:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!learnerId) {
      alert('Please select a learner first')
      return
    }

    setSaving(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        alert('Please sign in to save preferences')
        return
      }

      const parseList = (str) => {
        return str
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0)
      }

      const response = await fetch('/api/curriculum-preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          learnerId,
          bannedWords: parseList(bannedWords),
          bannedTopics: parseList(bannedTopics),
          bannedConcepts: parseList(bannedConcepts),
          focusTopics: parseList(focusTopics),
          focusConcepts: parseList(focusConcepts),
          focusKeywords: parseList(focusKeywords)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }

      if (onSaved) onSaved()
      onClose()
    } catch (err) {
      console.error('Error saving preferences:', err)
      alert('Failed to save curriculum preferences')
    } finally {
      setSaving(false)
    }
  }

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
          maxWidth: 600,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ 
          fontSize: 24, 
          fontWeight: 700, 
          marginBottom: 8,
          color: '#1f2937'
        }}>
          Curriculum Preferences
        </h2>
        <p style={{ 
          fontSize: 14, 
          color: '#6b7280', 
          marginBottom: 24 
        }}>
          Customize what content should be included or excluded when generating lessons for this learner.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            Loading preferences...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Banned Words */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 6
              }}>
                Banned Words
              </label>
              <input
                type="text"
                value={bannedWords}
                onChange={(e) => setBannedWords(e.target.value)}
                placeholder="Enter words to avoid, separated by commas"
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Example: war, violence, religion
              </p>
            </div>

            {/* Banned Topics */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 6
              }}>
                Banned Topics
              </label>
              <input
                type="text"
                value={bannedTopics}
                onChange={(e) => setBannedTopics(e.target.value)}
                placeholder="Enter topics to exclude, separated by commas"
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Example: colonialism, Christopher Columbus, evolution
              </p>
            </div>

            {/* Banned Concepts */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 6
              }}>
                Banned Concepts
              </label>
              <input
                type="text"
                value={bannedConcepts}
                onChange={(e) => setBannedConcepts(e.target.value)}
                placeholder="Enter concepts to avoid, separated by commas"
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Example: evolution, big bang theory, democracy
              </p>
            </div>

            {/* Focus Topics */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 6
              }}>
                Focus Topics
              </label>
              <input
                type="text"
                value={focusTopics}
                onChange={(e) => setFocusTopics(e.target.value)}
                placeholder="Enter topics to emphasize, separated by commas"
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Example: Christianity, environmental science, local history
              </p>
            </div>

            {/* Focus Concepts */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 6
              }}>
                Focus Concepts
              </label>
              <input
                type="text"
                value={focusConcepts}
                onChange={(e) => setFocusConcepts(e.target.value)}
                placeholder="Enter concepts to emphasize, separated by commas"
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Example: critical thinking, problem solving, collaboration
              </p>
            </div>

            {/* Focus Keywords */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 6
              }}>
                Focus Keywords
              </label>
              <input
                type="text"
                value={focusKeywords}
                onChange={(e) => setFocusKeywords(e.target.value)}
                placeholder="Enter keywords to include, separated by commas"
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Example: sustainability, critical thinking, problem solving
              </p>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          marginTop: 24,
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
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
            disabled={saving || loading}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: 6,
              background: saving ? '#9ca3af' : '#2563eb',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  )
}
