'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

export default function TypedRemoveConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Remove Lesson',
  description = 'This cannot be undone.',
  confirmWord = 'remove',
  zIndex = 10030,
  portal = false,
  confirmLabel = 'Remove'
}) {
  const [isMounted, setIsMounted] = useState(false)
  const [typed, setTyped] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const canConfirm = useMemo(() => typed.trim().toLowerCase() === confirmWord.toLowerCase(), [typed, confirmWord])

  const handleConfirm = async () => {
    if (!canConfirm) return
    setSubmitting(true)
    try {
      await onConfirm?.()
      onClose?.()
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
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
          maxWidth: 520,
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{title}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>{description}</div>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>
            Type <span style={{ fontWeight: 800 }}>{confirmWord}</span> to confirm.
          </div>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmWord}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 13
            }}
          />
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={submitting}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              fontSize: 13,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: !canConfirm ? '#9ca3af' : '#dc2626',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              cursor: (!canConfirm || submitting) ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Removing…' : confirmLabel}
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
