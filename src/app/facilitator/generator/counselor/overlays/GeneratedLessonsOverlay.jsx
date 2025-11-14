// Compact generated lessons list for Mr. Mentor overlay
'use client'
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import LessonEditor from '@/components/LessonEditor'

export default function GeneratedLessonsOverlay({ learnerId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [busyItems, setBusyItems] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [changeRequests, setChangeRequests] = useState({})
  const [showChangeModal, setShowChangeModal] = useState(null)
  const [editingLesson, setEditingLesson] = useState(null)
  const [busy, setBusy] = useState(false)
  
  // AI Rewrite loading states
  const [rewritingDescription, setRewritingDescription] = useState(false)
  const [rewritingTeachingNotes, setRewritingTeachingNotes] = useState(false)
  const [rewritingVocabDefinition, setRewritingVocabDefinition] = useState({})

  useEffect(() => {
    loadLessons()
  }, [])

  useEffect(() => {
    if (learnerId && learnerId !== 'none') {
      loadLearnerGrade()
    } else {
      setGradeFilter('all')
    }
  }, [learnerId])

  const loadLearnerGrade = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .from('learners')
        .select('grade')
        .eq('id', learnerId)
        .maybeSingle()
      
      if (data?.grade) {
        setGradeFilter(String(data.grade))
      } else {
        setGradeFilter('all')
      }
    } catch (err) {
      console.error('Failed to load learner grade:', err)
      setGradeFilter('all')
    }
  }

  const loadLessons = async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        setItems([])
        setLoading(false)
        return
      }
      
      const res = await fetch('/api/facilitator/lessons/list', { 
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      })
      const js = await res.json().catch(() => [])
      setItems(Array.isArray(js) ? js : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (file, userId) => {
    if (!confirm('Delete this lesson?')) return
    setBusyItems(prev => ({ ...prev, [file]: 'deleting' }))
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/facilitator/lessons/delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ file, userId })
      })
      if (!res.ok) {
        const js = await res.json().catch(() => null)
        setError(js?.error || 'Delete failed')
      }
      await loadLessons()
    } finally {
      setBusyItems(prev => {
        const next = { ...prev }
        delete next[file]
        return next
      })
    }
  }

  const handleApprove = async (file, userId) => {
    setBusyItems(prev => ({ ...prev, [file]: 'approving' }))
    setError('')
    setSuccess('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/facilitator/lessons/approve', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ file, userId })
      })
      if (!res.ok) {
        const js = await res.json().catch(() => null)
        setError(js?.error || 'Approve failed')
        return
      }
      setSuccess('✓ Lesson approved!')
      setTimeout(() => setSuccess(''), 3000)
      await loadLessons()
    } finally {
      setBusyItems(prev => {
        const next = { ...prev }
        delete next[file]
        return next
      })
    }
  }

  const handleEditLesson = async (file, userId) => {
    setBusyItems(prev => ({ ...prev, [file]: 'editing' }))
    setError('')
    try {
      const params = new URLSearchParams({ file, userId })
      const res = await fetch(`/api/facilitator/lessons/get?${params}`, { cache: 'no-store' })
      if (!res.ok) {
        setError('Failed to load lesson')
        return
      }
      const lesson = await res.json()
      setEditingLesson({ file, userId, lesson })
    } finally {
      setBusyItems(prev => {
        const next = { ...prev }
        delete next[file]
        return next
      })
    }
  }

  const handleSaveLesson = async (updatedLesson) => {
    if (!editingLesson) return
    setBusy(true)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const res = await fetch('/api/facilitator/lessons/update', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          file: editingLesson.file,
          userId: editingLesson.userId,
          lesson: updatedLesson
        })
      })

      const js = await res.json().catch(() => null)
      
      if (!res.ok) {
        setError(js?.error || 'Failed to save lesson')
        return
      }

      setEditingLesson(null)
      setSuccess('✓ Lesson updated!')
      setTimeout(() => setSuccess(''), 3000)
      await loadLessons()
    } finally {
      setBusy(false)
    }
  }

  // AI Rewrite handlers
  const handleRewriteDescription = async (text, context, purpose) => {
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
        body: JSON.stringify({ text, context, purpose })
      })

      if (!res.ok) {
        throw new Error('Failed to rewrite text')
      }

      const data = await res.json()
      return data.rewritten
    } catch (err) {
      console.error('Error rewriting text:', err)
      setError('Failed to rewrite text')
      return null
    }
  }

  const handleRewriteLessonDescription = async (description) => {
    setRewritingDescription(true)
    const lessonTitle = editingLesson?.lesson?.title || 'Lesson'
    const rewritten = await handleRewriteDescription(description, lessonTitle, 'lesson-description')
    setRewritingDescription(false)
    
    if (rewritten && editingLesson) {
      setEditingLesson(prev => ({
        ...prev,
        lesson: {
          ...prev.lesson,
          blurb: rewritten
        }
      }))
    }
  }

  const handleRewriteLessonTeachingNotes = async (notes) => {
    setRewritingTeachingNotes(true)
    const lessonTitle = editingLesson?.lesson?.title || 'Lesson'
    const rewritten = await handleRewriteDescription(notes, lessonTitle, 'teaching-notes')
    setRewritingTeachingNotes(false)
    
    if (rewritten && editingLesson) {
      setEditingLesson(prev => ({
        ...prev,
        lesson: {
          ...prev.lesson,
          teachingNotes: rewritten
        }
      }))
    }
  }

  const handleRewriteVocabDefinition = async (definition, term, index) => {
    setRewritingVocabDefinition(prev => ({ ...prev, [index]: true }))
    const lessonTitle = editingLesson?.lesson?.title || 'Lesson'
    const context = `${lessonTitle} - Term: ${term}`
    const rewritten = await handleRewriteDescription(definition, context, 'vocabulary-definition')
    
    setRewritingVocabDefinition(prev => ({ ...prev, [index]: false }))
    
    if (rewritten && editingLesson) {
      setEditingLesson(prev => {
        const newVocab = [...(prev.lesson.vocab || [])]
        if (newVocab[index]) {
          newVocab[index] = { ...newVocab[index], definition: rewritten }
        }
        return {
          ...prev,
          lesson: {
            ...prev.lesson,
            vocab: newVocab
          }
        }
      })
    }
  }

  const handleRequestChanges = async () => {
    if (!showChangeModal) return
    const { file, userId } = showChangeModal
    const changeRequest = changeRequests[file] || ''
    if (!changeRequest.trim()) {
      setError('Please describe the changes you want')
      return
    }
    setBusy(true)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/facilitator/lessons/request-changes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ file, changeRequest, userId })
      })
      const js = await res.json().catch(() => null)
      if (!res.ok) {
        setError(js?.error || 'Request changes failed')
        return
      }
      setShowChangeModal(null)
      setChangeRequests(prev => {
        const next = { ...prev }
        delete next[file]
        return next
      })
      setSuccess('✓ Changes requested!')
      setTimeout(() => setSuccess(''), 3000)
      await loadLessons()
    } finally {
      setBusy(false)
    }
  }

  const subjects = ['all', 'math', 'science', 'language arts', 'social studies', 'general', 'generated']
  const grades = ['all', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

  const filteredItems = items.filter(item => {
    if (subjectFilter !== 'all' && item.subject !== subjectFilter) return false
    if (gradeFilter !== 'all') {
      if (!item.grade) return false
      // Normalize item grade: "4th" -> "4", "K" -> "K", "10th" -> "10"
      const itemGrade = String(item.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
      if (itemGrade !== String(gradeFilter).toUpperCase()) return false
    }
    return true
  })

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
      {/* Show editor if editing */}
      {editingLesson ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ 
            padding: '8px 12px', 
            background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>
              Edit Lesson
            </div>
            <button
              onClick={() => setEditingLesson(null)}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                background: '#6b7280',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
          </div>
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '8px',
            fontSize: '11px'
          }}>
            <LessonEditor
              initialLesson={editingLesson.lesson}
              onSave={handleSaveLesson}
              onCancel={() => setEditingLesson(null)}
              busy={busy}
              compact={true}
              onRewriteDescription={handleRewriteLessonDescription}
              onRewriteTeachingNotes={handleRewriteLessonTeachingNotes}
              onRewriteVocabDefinition={handleRewriteVocabDefinition}
              rewritingDescription={rewritingDescription}
              rewritingTeachingNotes={rewritingTeachingNotes}
              rewritingVocabDefinition={rewritingVocabDefinition}
            />
          </div>
        </div>
      ) : showChangeModal ? (
        /* Change request modal */
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ 
            padding: '12px 16px', 
            background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
              Request Changes
            </div>
          </div>
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
              Describe the changes you want:
            </label>
            <textarea
              value={changeRequests[showChangeModal.file] || ''}
              onChange={(e) => setChangeRequests(prev => ({ ...prev, [showChangeModal.file]: e.target.value }))}
              placeholder="e.g., Make the examples more challenging, add more vocabulary..."
              rows={6}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 12,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            {error && (
              <div style={{ 
                marginTop: 8,
                padding: 8,
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: 6,
                fontSize: 11
              }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={handleRequestChanges}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  background: busy ? '#d1d5db' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
              >
                {busy ? 'Requesting...' : 'Request Changes'}
              </button>
              <button
                onClick={() => setShowChangeModal(null)}
                disabled={busy}
                style={{
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  background: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Main list view */
        <>
          {/* Header */}
          <div style={{ 
            padding: '12px 16px', 
            background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
              ✨ Generated Lessons
            </div>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer'
            }}
          >
            {subjects.map(subject => (
              <option key={subject} value={subject}>
                {subject === 'all' ? 'All Subjects' : subject.charAt(0).toUpperCase() + subject.slice(1)}
              </option>
            ))}
          </select>
          
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer'
            }}
          >
            {grades.map(grade => (
              <option key={grade} value={grade}>
                {grade === 'all' ? 'All Grades' : `Grade ${grade}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lessons List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>
            Loading lessons...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 20, 
            color: '#9ca3af',
            fontSize: 13
          }}>
            No generated lessons found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredItems.map(item => {
              const isBusy = busyItems[item.file]
              return (
                <div
                  key={item.file}
                  style={{
                    padding: 12,
                    background: item.approved ? '#f0fdf4' : item.needsUpdate ? '#fef3c7' : '#fff',
                    border: '1px solid',
                    borderColor: item.approved ? '#86efac' : item.needsUpdate ? '#fcd34d' : '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 8
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 2 }}>
                        {item.title}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: 11 }}>
                        {item.grade} • {item.difficulty} • {item.subject}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, marginLeft: 8 }}>
                      {item.approved && (
                        <span style={{ 
                          padding: '2px 6px',
                          background: '#10b981',
                          color: '#fff',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700
                        }}>
                          ✓ Approved
                        </span>
                      )}
                      {item.needsUpdate && (
                        <span style={{ 
                          padding: '2px 6px',
                          background: '#f59e0b',
                          color: '#fff',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700
                        }}>
                          ⚠ Update
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!item.approved && (
                      <button
                        onClick={() => handleApprove(item.file, item.userId)}
                        disabled={!!isBusy}
                        style={{
                          padding: '4px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          background: isBusy === 'approving' ? '#d1d5db' : '#065f46',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: isBusy ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isBusy === 'approving' ? '...' : '✓ Approve'}
                      </button>
                    )}
                    <button
                      onClick={() => handleEditLesson(item.file, item.userId)}
                      disabled={!!isBusy}
                      style={{
                        padding: '4px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        background: isBusy === 'editing' ? '#d1d5db' : '#374151',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: isBusy ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isBusy === 'editing' ? '...' : '✏️ Edit'}
                    </button>
                    <button
                      onClick={() => setShowChangeModal({ file: item.file, userId: item.userId })}
                      disabled={!!isBusy}
                      style={{
                        padding: '4px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        background: isBusy ? '#d1d5db' : '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: isBusy ? 'not-allowed' : 'pointer'
                      }}
                    >
                      🔄 Request Changes
                    </button>
                    <button
                      onClick={() => handleDelete(item.file, item.userId)}
                      disabled={!!isBusy}
                      style={{
                        padding: '4px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        background: isBusy === 'deleting' ? '#d1d5db' : '#b91c1c',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: isBusy ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isBusy === 'deleting' ? '...' : '🗑️ Delete'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Success/Error messages */}
        {success && (
          <div style={{
            margin: '0 12px 12px',
            padding: 8,
            background: '#d1fae5',
            color: '#065f46',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600
          }}>
            {success}
          </div>
        )}
        {error && (
          <div style={{
            margin: '0 12px 12px',
            padding: 8,
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600
          }}>
            {error}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  )
}
