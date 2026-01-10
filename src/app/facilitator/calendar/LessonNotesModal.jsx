'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getSupabaseClient } from '@/app/lib/supabaseClient'

export default function LessonNotesModal({
  open,
  onClose,
  learnerId,
  lessonKey,
  lessonTitle = 'Lesson Notes',
  zIndex = 10020,
  portal = false
}) {
  const [isMounted, setIsMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [initialLoadedKey, setInitialLoadedKey] = useState(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    if (!learnerId || !lessonKey) return

    // Avoid reloading on every keystroke if parent re-renders.
    const loadKey = `${learnerId}|${lessonKey}`
    if (initialLoadedKey === loadKey) return

    setInitialLoadedKey(loadKey)
    setLoading(true)

    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('learners')
          .select('lesson_notes')
          .eq('id', learnerId)
          .maybeSingle()

        if (error) throw error
        const notesMap = data?.lesson_notes || {}
        const existing = typeof notesMap?.[lessonKey] === 'string' ? notesMap[lessonKey] : ''
        setNoteText(existing)
      } catch {
        setNoteText('')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, learnerId, lessonKey, initialLoadedKey])

  const handleSave = async () => {
    if (!learnerId || !lessonKey) return
    setSaving(true)
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('learners')
        .select('lesson_notes')
        .eq('id', learnerId)
        .maybeSingle()

      if (error) throw error

      const current = data?.lesson_notes || {}
      const next = { ...current }
      const trimmed = noteText.trim()
      if (trimmed) next[lessonKey] = trimmed
      else delete next[lessonKey]

      const { error: updateErr } = await supabase
        .from('learners')
        .update({ lesson_notes: next })
        .eq('id', learnerId)

      if (updateErr) throw updateErr
      onClose?.()
    } catch (err) {
      alert(err?.message || 'Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={() => onClose?.()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 640,
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Notes</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lessonTitle}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {loading ? (
            <div style={{ fontSize: 13, color: '#6b7280' }}>Loading…</div>
          ) : (
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add notes for this lesson…"
              style={{
                width: '100%',
                minHeight: 160,
                padding: 12,
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.4,
                resize: 'vertical'
              }}
            />
          )}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={saving}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: (saving || loading) ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )

  if (portal && isMounted && typeof document !== 'undefined') {
    return createPortal(content, document.body)
  }

  return content
}
