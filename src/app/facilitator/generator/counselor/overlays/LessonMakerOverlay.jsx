// Compact lesson generator form for Mr. Mentor overlay
'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import AIRewriteButton from '@/components/AIRewriteButton'
import { useFacilitatorSubjects } from '@/app/hooks/useFacilitatorSubjects'

const difficulties = ['beginner', 'intermediate', 'advanced']

export default function LessonMakerOverlay({ tier }) {
  const { subjectsWithoutGenerated: subjects } = useFacilitatorSubjects()
  const [form, setForm] = useState({
    grade: '', 
    difficulty: 'intermediate', 
    subject: 'math', 
    title: '', 
    description: '', 
    notes: '', 
    vocab: ''
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  
  // AI Rewrite loading states
  const [rewritingDescription, setRewritingDescription] = useState(false)
  const [rewritingVocab, setRewritingVocab] = useState(false)
  const [rewritingNotes, setRewritingNotes] = useState(false)

  const ent = featuresForTier(tier)
  
  const isFormValid = form.grade.trim() && form.title.trim() && form.description.trim()

  // AI Rewrite handlers
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate required fields
    if (!form.grade.trim() || !form.title.trim() || !form.description.trim()) {
      setMessage('Please fill in all required fields (Grade, Title, Description)')
      return
    }
    
    setBusy(true)
    setMessage('Generating lesson...')
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const res = await fetch('/api/facilitator/lessons/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })
      
      const result = await res.json()
      
      if (!res.ok) {
        setMessage(result.error || 'Generation failed')
        setBusy(false)
        return
      }
      
      setMessage('✓ Lesson generated successfully!')
      setForm({
        grade: '', 
        difficulty: 'intermediate', 
        subject: 'math', 
        title: '', 
        description: '', 
        notes: '', 
        vocab: ''
      })
      loadQuota()
    } catch (err) {
      setMessage('Failed to generate lesson')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ 
      height: '100%', 
      background: '#fff', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      border: '1px solid #6b7280',
      borderRadius: 8
    }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px', 
        background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>
          ✨ Lesson Generator
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: '100%' }}>
          {/* Grade, Difficulty & Subject */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#374151' }}>
                Grade *
              </label>
              <input
                type="text"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                placeholder="e.g., 5th"
                required
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: 12,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#374151' }}>
                Difficulty
              </label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: 12,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                {difficulties.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#374151' }}>
                Subject
              </label>
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: 12,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                {subjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#374151' }}>
              Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Multiplying Fractions"
              required
              disabled={busy}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 12,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#374151' }}>
              Description *
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What should this lesson cover?"
              required
              disabled={busy}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 12,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
              <AIRewriteButton
                text={form.description}
                onRewrite={handleRewriteDescription}
                loading={rewritingDescription}
                size="small"
              />
            </div>
          </div>

          {/* Notes (optional) */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#374151' }}>
              Notes (optional)
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any specific requirements or focus areas?"
              disabled={busy}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 12,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
              <AIRewriteButton
                text={form.notes}
                onRewrite={handleRewriteNotes}
                loading={rewritingNotes}
                size="small"
              />
            </div>
          </div>

          {/* Vocab (optional) */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#374151' }}>
              Vocabulary Terms (optional)
            </label>
            <input
              type="text"
              value={form.vocab}
              onChange={(e) => setForm({ ...form, vocab: e.target.value })}
              placeholder="e.g., numerator, denominator, product"
              disabled={busy}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 12,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
              <AIRewriteButton
                text={form.vocab}
                onRewrite={handleRewriteVocab}
                loading={rewritingVocab}
                size="small"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              background: busy ? '#d1d5db' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {busy ? 'Generating...' : 'Generate Lesson'}
          </button>

          {/* Message */}
          {message && (
            <div style={{
              padding: 10,
              fontSize: 12,
              borderRadius: 6,
              background: message.includes('✓') ? '#d1fae5' : message.includes('limit') ? '#fee2e2' : '#fef3c7',
              color: message.includes('✓') ? '#065f46' : message.includes('limit') ? '#991b1b' : '#92400e',
              border: '1px solid',
              borderColor: message.includes('✓') ? '#86efac' : message.includes('limit') ? '#fca5a5' : '#fcd34d'
            }}>
              {message}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
