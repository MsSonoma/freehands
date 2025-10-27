'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ClipboardOverlay({
  summary,
  onSave,
  onDelete,
  onExport,
  onClose,
  show
}) {
  const [editedSummary, setEditedSummary] = useState(summary || '')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setEditedSummary(summary || '')
  }, [summary])

  const handleChange = (e) => {
    setEditedSummary(e.target.value)
  }

  const handleSave = () => {
    onSave(editedSummary.trim())
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      onDelete()
    }
  }

  if (!show || !mounted) return null

  const overlayContent = (
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
      paddingTop: '40px',
      zIndex: 99999,
      padding: '16px'
    }}>
      {/* Clipboard styled container */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 50%, #8B4513 100%)',
        borderRadius: '8px 8px 16px 16px',
        maxWidth: '460px',
        width: '100%',
        height: '85vh',
        maxHeight: '760px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2), inset 0 -2px 4px rgba(0, 0, 0, 0.3)',
        border: '3px solid #654321',
        overflow: 'visible'
      }}>
        {/* Clipboard clip at top */}
        <div style={{
          position: 'absolute',
          top: '-28px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120px',
          height: '70px',
          background: 'linear-gradient(180deg, #C0C0C0 0%, #A8A8A8 50%, #808080 100%)',
          borderRadius: '8px 8px 0 0',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.4)',
          border: '2px solid #696969'
        }} />

        {/* Content area */}
        <div style={{
          padding: '40px 28px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          background: '#FEFDF8',
          margin: '14px',
          borderRadius: '0px',
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            paddingBottom: '6px',
            flexShrink: 0
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#4A2511',
              fontFamily: 'Georgia, serif'
            }}>
              Conversation Summary
            </h2>
            <p style={{
              margin: '6px 0 0',
              fontSize: '0.8125rem',
              color: '#8B6F47',
              fontFamily: 'Georgia, serif'
            }}>
              Review and edit your conversation summary
            </p>
          </div>

          {/* Editable summary textarea */}
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <textarea
              value={editedSummary}
              onChange={handleChange}
              placeholder="No summary yet..."
              style={{
                width: '100%',
                flex: 1,
                minHeight: 0,
                padding: '14px',
                fontSize: '0.9375rem',
                lineHeight: '1.6',
                border: 'none',
                borderRadius: '0px',
                resize: 'none',
                fontFamily: 'Georgia, serif',
                background: '#FEFDF8',
                color: '#4A2511',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0
          }}>
            {/* Top row: Save and Export */}
            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              {/* Save to Memory - Primary action */}
              <button
                onClick={handleSave}
                disabled={!editedSummary.trim()}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: editedSummary.trim() ? 'transparent' : '#f3f4f6',
                  color: editedSummary.trim() ? '#6b7280' : '#9ca3af',
                  border: '1px solid #D2B48C',
                  borderRadius: '6px',
                  cursor: editedSummary.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (editedSummary.trim()) {
                    e.currentTarget.style.background = '#F5E6D3'
                  }
                }}
                onMouseLeave={(e) => {
                  if (editedSummary.trim()) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                💾 Save
              </button>

              {/* Export Whole Conversation - Secondary action */}
              <button
                onClick={onExport}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #D2B48C',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F5E6D3'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                📥 Export
              </button>
            </div>

            {/* Bottom row: Delete and Cancel */}
            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              {/* Delete Conversation - Destructive action */}
              <button
                onClick={handleDelete}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #D2B48C',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F5E6D3'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                🗑️ Delete
              </button>

              {/* Cancel */}
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #D2B48C',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F5E6D3'
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
    </div>
  )

  return createPortal(overlayContent, document.body)
}
