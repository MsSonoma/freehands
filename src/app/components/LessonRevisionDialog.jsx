'use client'

import { useEffect, useState } from 'react'
import { regenerateLessonWithChanges } from '@/app/lib/lessonRevisionClient'

const buttonBase = {
  borderRadius: 8,
  padding: '9px 13px',
  fontWeight: 700,
  cursor: 'pointer',
}

export default function LessonRevisionDialog({
  open,
  lessonKey,
  lessonTitle = 'lesson',
  accessToken = '',
  onClose,
  onRevised,
}) {
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setFeedback('')
    setError('')
    setBusy(false)
  }, [open, lessonKey])

  if (!open) return null

  async function submit(event) {
    event?.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await regenerateLessonWithChanges({ lessonKey, changeRequest: feedback, accessToken })
      if (typeof onRevised === 'function') await onRevised(result)
      onClose?.()
    } catch (cause) {
      setError(cause?.message || 'Could not regenerate the lesson')
    } finally {
      setBusy(false)
    }
  }

  return <div onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose?.() }} style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(17,24,39,0.42)', display: 'grid', placeItems: 'center', padding: 16 }}>
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={`Regenerate ${lessonTitle} with changes`} style={{ width: 'min(620px, 96vw)', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 18px 50px rgba(15,23,42,0.24)', padding: 18, display: 'grid', gap: 13 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20 }}>Regenerate with changes</h2>
        <p style={{ margin: '6px 0 0', color: '#4b5563', lineHeight: 1.5 }}>Explain what is wrong or what should be different. The lesson will return to draft and require review before the learner can use the revised content.</p>
      </div>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 700 }}>What should be different?</span>
        <textarea autoFocus value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={6} placeholder="Example: Refresh whole-number division first. Do not introduce decimal division until that review is complete." disabled={busy} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 11, border: '1px solid #cbd5e1', borderRadius: 8, font: 'inherit', lineHeight: 1.45 }} />
      </label>
      {error && <div role="alert" style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={onClose} style={{ ...buttonBase, border: '1px solid #d1d5db', background: '#fff', color: '#374151', opacity: busy ? 0.6 : 1 }}>Cancel</button>
        <button type="submit" disabled={busy || feedback.trim().length < 4} style={{ ...buttonBase, border: '1px solid #c7442e', background: '#c7442e', color: '#fff', opacity: busy || feedback.trim().length < 4 ? 0.6 : 1 }}>{busy ? 'Regenerating...' : 'Regenerate lesson'}</button>
      </div>
    </form>
  </div>
}