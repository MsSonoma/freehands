// Curriculum preferences overlay — per-subject focus and ban lists
'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'

const CORE_SUBJECTS = ['math', 'language arts', 'science', 'social studies', 'general']

const formatSubjectLabel = (subj) => {
  if (subj === 'all') return 'Global (all subjects)'
  return subj.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const EMPTY_FIELDS = {
  bannedWords: '',
  bannedTopics: '',
  bannedConcepts: '',
  focusTopics: '',
  focusConcepts: '',
  focusKeywords: '',
}

export default function CurriculumPreferencesOverlay({ learnerId, customSubjects = [], onClose, onSaved }) {
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [fullRow, setFullRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const allSubjects = ['all', ...CORE_SUBJECTS, ...customSubjects.map(s => s.name)]

  useEffect(() => {
    loadPreferences()
  }, [learnerId])

  useEffect(() => {
    applySubjectFields(selectedSubject, fullRow)
  }, [selectedSubject, fullRow])

  const applySubjectFields = (subject, row) => {
    if (!row) { setFields(EMPTY_FIELDS); return }
    if (subject === 'all') {
      setFields({
        bannedWords: row.banned_words?.join(', ') || '',
        bannedTopics: row.banned_topics?.join(', ') || '',
        bannedConcepts: row.banned_concepts?.join(', ') || '',
        focusTopics: row.focus_topics?.join(', ') || '',
        focusConcepts: row.focus_concepts?.join(', ') || '',
        focusKeywords: row.focus_keywords?.join(', ') || '',
      })
    } else {
      const subPrefs = row.subject_preferences?.[subject] || {}
      setFields({
        bannedWords: subPrefs.bannedWords?.join(', ') || '',
        bannedTopics: subPrefs.bannedTopics?.join(', ') || '',
        bannedConcepts: subPrefs.bannedConcepts?.join(', ') || '',
        focusTopics: subPrefs.focusTopics?.join(', ') || '',
        focusConcepts: subPrefs.focusConcepts?.join(', ') || '',
        focusKeywords: subPrefs.focusKeywords?.join(', ') || '',
      })
    }
  }

  const setField = (key, value) => setFields(prev => ({ ...prev, [key]: value }))

  const loadPreferences = async () => {
    if (!learnerId) { setLoading(false); return }
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setLoading(false); return }

      const response = await fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const result = await response.json()
        setFullRow(result.preferences || null)
      }
    } catch (err) {
      console.error('Error loading preferences:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!learnerId) { alert('Please select a learner first'); return }
    setSaving(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { alert('Please sign in to save preferences'); return }

      const parseList = (str) =>
        str.split(',').map(s => s.trim()).filter(s => s.length > 0)

      const response = await fetch('/api/curriculum-preferences', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          subject: selectedSubject,
          bannedWords: parseList(fields.bannedWords),
          bannedTopics: parseList(fields.bannedTopics),
          bannedConcepts: parseList(fields.bannedConcepts),
          focusTopics: parseList(fields.focusTopics),
          focusConcepts: parseList(fields.focusConcepts),
          focusKeywords: parseList(fields.focusKeywords),
        })
      })

      if (!response.ok) throw new Error('Failed to save preferences')

      const result = await response.json()
      setFullRow(result.preferences)
      if (onSaved) onSaved()
    } catch (err) {
      console.error('Error saving preferences:', err)
      alert('Failed to save curriculum preferences')
    } finally {
      setSaving(false)
    }
  }

  const isSubjectScope = selectedSubject !== 'all'

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
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: '#1f2937' }}>
          Curriculum Preferences
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Customize content focus and bans per subject. <strong>Global</strong> preferences apply to all subjects unless a subject has its own overrides.
        </p>

        {/* Subject Selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Subject
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              color: '#1f2937',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            {allSubjects.map(subj => (
              <option key={subj} value={subj}>{formatSubjectLabel(subj)}</option>
            ))}
          </select>
          {isSubjectScope && (
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              These preferences apply only to <strong>{formatSubjectLabel(selectedSubject)}</strong> lessons and are combined with Global preferences.
            </p>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
            Loading preferences...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Focus section */}
            <SectionLabel label={isSubjectScope ? `${formatSubjectLabel(selectedSubject)} — Focus` : 'Global Focus'} />

            <Field
              label="Focus Concepts"
              value={fields.focusConcepts}
              onChange={v => setField('focusConcepts', v)}
              placeholder="Concepts to emphasize (comma-separated)"
            />
            <Field
              label="Focus Topics"
              value={fields.focusTopics}
              onChange={v => setField('focusTopics', v)}
              placeholder="Topics to emphasize (comma-separated)"
            />
            <Field
              label="Focus Keywords"
              value={fields.focusKeywords}
              onChange={v => setField('focusKeywords', v)}
              placeholder="Keywords to include (comma-separated)"
            />

            {/* Bans section */}
            <SectionLabel label={isSubjectScope ? `${formatSubjectLabel(selectedSubject)} — Bans` : 'Global Bans'} />

            <Field
              label="Banned Concepts"
              value={fields.bannedConcepts}
              onChange={v => setField('bannedConcepts', v)}
              placeholder="Concepts to avoid (comma-separated)"
            />
            <Field
              label="Banned Topics"
              value={fields.bannedTopics}
              onChange={v => setField('bannedTopics', v)}
              placeholder="Topics to exclude (comma-separated)"
            />
            <Field
              label="Banned Words"
              value={fields.bannedWords}
              onChange={v => setField('bannedWords', v)}
              placeholder="Words to avoid (comma-separated)"
            />
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
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
            {saving ? 'Saving...' : `Save ${isSubjectScope ? formatSubjectLabel(selectedSubject) : 'Global'} Preferences`}
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ label }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      borderBottom: '1px solid #f3f4f6',
      paddingBottom: 4,
      marginTop: 4
    }}>
      {label}
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: 13,
        fontWeight: 600,
        color: '#374151',
        marginBottom: 4
      }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: 8,
          border: '1px solid #d1d5db',
          borderRadius: 4,
          fontSize: 13,
          boxSizing: 'border-box'
        }}
      />
    </div>
  )
}
