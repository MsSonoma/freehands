'use client'

import { useState, useEffect } from 'react'

const CHAR_LIMIT = 500 // Space-saving but comprehensive

export default function ClipboardOverlay({
  summary,
  onSave,
  onDelete,
  onExport,
  onClose,
  show
}) {
  const [editedSummary, setEditedSummary] = useState(summary || '')
  const [charCount, setCharCount] = useState(0)

  useEffect(() => {
    setEditedSummary(summary || '')
    setCharCount((summary || '').length)
  }, [summary])

  const handleChange = (e) => {
    const text = e.target.value
    if (text.length <= CHAR_LIMIT) {
      setEditedSummary(text)
      setCharCount(text.length)
    }
  }

  const handleSave = () => {
    onSave(editedSummary.trim())
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      onDelete()
    }
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      {/* Clipboard styled container */}
      <div style={{
        position: 'relative',
        background: '#f8f9fa',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        border: '2px solid #d1d5db',
        overflow: 'hidden'
      }}>
        {/* Clipboard clip at top */}
        <div style={{
          position: 'absolute',
          top: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80px',
          height: '20px',
          background: 'linear-gradient(180deg, #9ca3af 0%, #6b7280 100%)',
          borderRadius: '4px 4px 0 0',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }} />

        {/* Content area */}
        <div style={{
          padding: '40px 30px 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            borderBottom: '2px solid #d1d5db',
            paddingBottom: '15px'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#111827'
            }}>
              Conversation Summary
            </h2>
            <p style={{
              margin: '8px 0 0',
              fontSize: '0.875rem',
              color: '#6b7280'
            }}>
              Review and edit your conversation summary
            </p>
          </div>

          {/* Editable summary textarea */}
          <div style={{ position: 'relative' }}>
            <textarea
              value={editedSummary}
              onChange={handleChange}
              placeholder="No summary yet..."
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '15px',
                fontSize: '1rem',
                lineHeight: '1.6',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                resize: 'vertical',
                fontFamily: 'inherit',
                background: '#ffffff'
              }}
            />
            {/* Character counter */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '15px',
              fontSize: '0.75rem',
              color: charCount > CHAR_LIMIT * 0.9 ? '#dc2626' : '#6b7280',
              fontWeight: 600
            }}>
              {charCount} / {CHAR_LIMIT}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {/* Save to Memory - Primary action */}
            <button
              onClick={handleSave}
              disabled={!editedSummary.trim()}
              style={{
                padding: '12px 20px',
                fontSize: '1rem',
                fontWeight: 600,
                background: editedSummary.trim() ? '#16a34a' : '#9ca3af',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: editedSummary.trim() ? 'pointer' : 'not-allowed',
                boxShadow: editedSummary.trim() ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (editedSummary.trim()) {
                  e.currentTarget.style.background = '#15803d'
                }
              }}
              onMouseLeave={(e) => {
                if (editedSummary.trim()) {
                  e.currentTarget.style.background = '#16a34a'
                }
              }}
            >
              💾 Save to Memory
            </button>

            {/* Export Whole Conversation - Secondary action */}
            <button
              onClick={onExport}
              style={{
                padding: '12px 20px',
                fontSize: '1rem',
                fontWeight: 600,
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2563eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#3b82f6'
              }}
            >
              📥 Export Whole Conversation
            </button>

            {/* Delete Conversation - Destructive action */}
            <button
              onClick={handleDelete}
              style={{
                padding: '12px 20px',
                fontSize: '1rem',
                fontWeight: 600,
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#b91c1c'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#dc2626'
              }}
            >
              🗑️ Delete Conversation
            </button>

            {/* Cancel */}
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                fontSize: '0.875rem',
                fontWeight: 500,
                background: 'transparent',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
