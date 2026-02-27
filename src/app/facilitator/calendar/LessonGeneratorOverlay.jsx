// Lesson generator overlay for calendar lesson planner
'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import AIRewriteButton from '@/components/AIRewriteButton'

const subjects = ['math', 'language arts', 'science', 'social studies', 'general']
const difficulties = ['beginner', 'intermediate', 'advanced']

export default function LessonGeneratorOverlay({ 
  learnerId,
  learnerGrade,
  tier, 
  onClose, 
  onGenerated,
  scheduledDate,
  prefilledData 
}) {
  const asTrimmedString = (value) => {
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number') return String(value).trim()
    if (value == null) return ''
    return String(value).trim()
  }

  const normalizeGradeOption = (value) => {
    const raw = asTrimmedString(value)
    if (!raw) return ''

    const lower = raw.toLowerCase()
    if (lower === 'k' || lower === 'kindergarten' || lower === 'kg') return 'K'

    // Accept values like "3", "3rd", "3rd grade", "grade 3".
    const match = lower.match(/\b(\d{1,2})\b/)
    if (match) {
      const n = Number(match[1])
      if (!Number.isFinite(n)) return ''
      if (n <= 0) return ''
      if (n === 1) return '1st'
      if (n === 2) return '2nd'
      if (n === 3) return '3rd'
      if (n >= 4 && n <= 12) return `${n}th`
    }

    // Already in the expected form?
    const canonical = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']
    const found = canonical.find((g) => g.toLowerCase() === lower)
    return found || ''
  }

  const resolveInitialGrade = () => {
    const fromPrefill = normalizeGradeOption(prefilledData?.grade)
    if (fromPrefill) return fromPrefill
    return normalizeGradeOption(learnerGrade)
  }

  const [form, setForm] = useState({
    grade: resolveInitialGrade(), 
    difficulty: prefilledData?.difficulty || 'intermediate', 
    subject: prefilledData?.subject || 'math', 
    title: String(prefilledData?.title ?? ''), 
    description: String(prefilledData?.description ?? ''), 
    notes: '', 
    vocab: ''
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [customSubjects, setCustomSubjects] = useState([])
  
  // AI Rewrite loading states
  const [rewritingTitle, setRewritingTitle] = useState(false)
  const [rewritingDescription, setRewritingDescription] = useState(false)
  const [rewritingVocab, setRewritingVocab] = useState(false)
  const [rewritingNotes, setRewritingNotes] = useState(false)

  const ent = featuresForTier(tier)
  
  const isFormValid = asTrimmedString(form.grade) && asTrimmedString(form.title) && asTrimmedString(form.description)

  // If the learner grade loads after mount, default the Grade select (unless explicitly prefilled).
  useEffect(() => {
    if (normalizeGradeOption(prefilledData?.grade)) return
    const next = normalizeGradeOption(learnerGrade)
    if (!next) return
    setForm((prev) => {
      if (normalizeGradeOption(prev.grade)) return prev
      return { ...prev, grade: next }
    })
  }, [learnerGrade, prefilledData?.grade])

  useEffect(() => {
    loadCustomSubjects()
  }, [])

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

  const allSubjects = [...subjects, ...customSubjects.map(s => s.name)]

  // AI Rewrite handlers
  const handleRewriteTitle = async () => {
    if (!form.title.trim()) return
    setRewritingTitle(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: form.title,
          context: `${form.subject} lesson for ${form.grade}`,
          purpose: 'lesson-title'
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.rewritten) {
          setForm({ ...form, title: data.rewritten })
        }
      }
    } catch (err) {
      // Rewrite failed - user can retry
    } finally {
      setRewritingTitle(false)
    }
  }

  const handleRewriteDescription = async () => {
    if (!form.description.trim()) return
    setRewritingDescription(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: form.description,
          context: form.title || 'lesson description',
          purpose: 'lesson-description'
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.rewritten) {
          setForm({ ...form, description: data.rewritten })
        }
      }
    } catch (err) {
      // Rewrite failed - user can retry
    } finally {
      setRewritingDescription(false)
    }
  }

  const handleRewriteVocab = async () => {
    if (!form.vocab.trim()) return
    setRewritingVocab(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: form.vocab,
          context: form.title || 'vocabulary terms',
          purpose: 'vocabulary-terms'
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.rewritten) {
          setForm({ ...form, vocab: data.rewritten })
        }
      }
    } catch (err) {
      // Rewrite failed - user can retry
    } finally {
      setRewritingVocab(false)
    }
  }

  const handleRewriteNotes = async () => {
    if (!form.notes.trim()) return
    setRewritingNotes(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: form.notes,
          context: form.title || 'additional notes',
          purpose: 'lesson-notes'
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.rewritten) {
          setForm({ ...form, notes: data.rewritten })
        }
      }
    } catch (err) {
      // Rewrite failed - user can retry
    } finally {
      setRewritingNotes(false)
    }
  }

  const handleGenerateAndSchedule = async (e) => {
    e.preventDefault()
    
    if (!isFormValid) {
      setMessage('Please fill in all required fields (Grade, Title, Description)')
      return
    }

    if (!scheduledDate) {
      setMessage('No date selected for scheduling')
      return
    }
    
    setBusy(true)
    setMessage('Generating lesson...')
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setMessage('Please sign in to generate lessons')
        setBusy(false)
        return
      }

      // Generate the full lesson
      const res = await fetch('/api/facilitator/lessons/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: form.title,
          subject: form.subject,
          difficulty: form.difficulty,
          grade: form.grade,
          description: form.description,
          notes: form.notes,
          vocab: form.vocab
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Failed to generate lesson')
        setBusy(false)
        return
      }

      if (!data.ok || !data.file) {
        setMessage('Lesson generation incomplete')
        setBusy(false)
        return
      }

      // Lesson generated successfully, now schedule it
      setMessage('Scheduling lesson...')
      
      const lessonKey = `generated/${data.file}`
      
      const scheduleRes = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learnerId,
          lessonKey,
          scheduledDate
        })
      })

      if (!scheduleRes.ok) {
        setMessage('Lesson generated but failed to schedule')
        setBusy(false)
        return
      }

      const scheduleJson = await scheduleRes.json().catch(() => null)
      const newEntry = scheduleJson?.data || { lesson_key: lessonKey, scheduled_date: scheduledDate }

      setMessage('Lesson generated and scheduled successfully!')
      
      // Dispatch event to refresh lesson lists
      window.dispatchEvent(new CustomEvent('mr-mentor:lesson-generated'))
      
      setTimeout(() => {
        if (onGenerated) onGenerated(newEntry)
        onClose()
      }, 1000)

    } catch (err) {
      console.error('Generate and schedule error:', err)
      setMessage('An error occurred during generation')
      setBusy(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
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
        zIndex: 2147483647,
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
        <h2 style={{ 
          fontSize: 24, 
          fontWeight: 700, 
          marginBottom: 8,
          color: '#1f2937'
        }}>
          Generate Lesson
        </h2>
        <p style={{ 
          fontSize: 14, 
          color: '#6b7280', 
          marginBottom: 16 
        }}>
          Customize and generate this lesson for <strong>{formatDate(scheduledDate)}</strong>
        </p>

        <form onSubmit={handleGenerateAndSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Grade and Difficulty Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Grade *
              </label>
              <select
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select Grade</option>
                {['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Difficulty
              </label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              >
                {difficulties.map(d => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Subject
            </label>
            <select
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            >
              {allSubjects.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Title *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Enter lesson title"
                style={{
                  width: '100%',
                  padding: 10,
                  paddingRight: 90,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
              <AIRewriteButton
                onClick={handleRewriteTitle}
                loading={rewritingTitle}
                disabled={!form.title.trim() || !ent.aiRewrite}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Description *
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                placeholder="Brief description of what this lesson will teach"
                rows={3}
                style={{
                  width: '100%',
                  padding: 10,
                  paddingRight: 90,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
              <AIRewriteButton
                onClick={handleRewriteDescription}
                loading={rewritingDescription}
                disabled={!form.description.trim() || !ent.aiRewrite}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 10
                }}
              />
            </div>
          </div>

          {/* Vocabulary Terms */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Vocabulary Terms (optional)
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                value={form.vocab}
                onChange={(e) => setForm({ ...form, vocab: e.target.value })}
                placeholder="Key terms to include (comma-separated)"
                rows={2}
                style={{
                  width: '100%',
                  padding: 10,
                  paddingRight: 90,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
              <AIRewriteButton
                onClick={handleRewriteVocab}
                loading={rewritingVocab}
                disabled={!form.vocab.trim() || !ent.aiRewrite}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 10
                }}
              />
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Additional Notes (optional)
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Special instructions or focus areas for this lesson"
                rows={2}
                style={{
                  width: '100%',
                  padding: 10,
                  paddingRight: 90,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
              <AIRewriteButton
                onClick={handleRewriteNotes}
                loading={rewritingNotes}
                disabled={!form.notes.trim() || !ent.aiRewrite}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 10
                }}
              />
            </div>
          </div>

          {/* Message */}
          {message && (
            <div style={{
              padding: 12,
              borderRadius: 6,
              background: busy ? '#eff6ff' : '#f0fdf4',
              color: busy ? '#1e40af' : '#166534',
              fontSize: 13,
              fontWeight: 500
            }}>
              {message}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                padding: '10px 20px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                color: '#374151',
                fontSize: 14,
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !isFormValid}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: 6,
                background: busy || !isFormValid ? '#9ca3af' : '#2563eb',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: busy || !isFormValid ? 'not-allowed' : 'pointer'
              }}
            >
              {busy ? 'Generating...' : `Generate on ${scheduledDate ? new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Selected Date'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
