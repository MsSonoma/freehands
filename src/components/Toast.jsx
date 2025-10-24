'use client'
import { useEffect } from 'react'

/**
 * Simple toast notification component
 * @param {string} message - Message to display
 * @param {string} type - 'info' | 'success' | 'error' | 'warning'
 * @param {function} onClose - Callback when toast closes
 * @param {number} duration - Auto-close duration in ms (0 = don't auto-close)
 */
export default function Toast({ message, type = 'info', onClose, duration = 0 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const colors = {
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
    warning: { bg: '#fefce8', border: '#fde047', text: '#854d0e' }
  }

  const style = colors[type] || colors.info

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      right: 24,
      padding: '12px 16px',
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: 8,
      color: style.text,
      fontWeight: 600,
      fontSize: 14,
      maxWidth: 400,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }}>
      <div style={{ flex: 1 }}>{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: style.text,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
            opacity: 0.7
          }}
          aria-label="Close"
        >
          ×
        </button>
      )}
    </div>
  )
}
