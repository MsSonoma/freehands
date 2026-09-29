'use client'

import { useEffect, useState } from 'react'

export default function ConversationLibraryOverlay({
  open,
  conversations = [],
  activeConversationId = null,
  learners = [],
  loading = false,
  onClose,
  onCreate,
  onOpen,
  onRename,
  onDelete,
}) {
  const [editingId, setEditingId] = useState(null)
  const [draftTitle, setDraftTitle] = useState('')

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setDraftTitle('')
    }
  }, [open])

  if (!open) return null

  const learnerName = (learnerId) => {
    if (!learnerId) return 'General'
    return learners.find((learner) => String(learner.id) === String(learnerId))?.name || 'Learner'
  }

  const startRename = (conversation) => {
    setEditingId(conversation.id)
    setDraftTitle(conversation.title || '')
  }

  const finishRename = async (conversation) => {
    const title = draftTitle.replace(/\s+/g, ' ').trim()
    if (!title || title === conversation.title) {
      setEditingId(null)
      return
    }
    const renamed = await onRename?.(conversation.id, title)
    if (renamed !== false) setEditingId(null)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conversation Library"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        background: 'rgba(249,250,251,0.98)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 16px',
        borderBottom: '1px solid #d1d5db',
        background: '#f9fafb',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#111827' }}>Conversations</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Saved conversations help Ms. Sonoma remember relevant context across chats. They stay scoped to your account and can be deleted here.</div>
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={loading}
          style={{
            border: 'none',
            borderRadius: 8,
            background: '#1f2937',
            color: '#fff',
            padding: '9px 12px',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          New conversation
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close conversation library"
          title="Close"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '1px solid #d1d5db',
            background: '#fff',
            color: '#111827',
            fontSize: 20,
            cursor: 'pointer',
          }}
        >
          &times;
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px 14px' }}>
        {loading && conversations.length === 0 ? (
          <div style={{ padding: 18, color: '#6b7280', fontSize: 13 }}>Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: 18, color: '#6b7280', fontSize: 13 }}>No saved conversations yet.</div>
        ) : (
          conversations.map((conversation) => {
            const active = String(conversation.id) === String(activeConversationId)
            const editing = editingId === conversation.id
            return (
              <div
                key={conversation.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 52,
                  marginBottom: 4,
                  padding: '6px 8px 6px 10px',
                  borderRadius: 9,
                  background: active ? '#e5e7eb' : 'transparent',
                  border: active ? '1px solid #d1d5db' : '1px solid transparent',
                }}
              >
                <button
                  type="button"
                  onClick={() => !editing && onOpen?.(conversation.id)}
                  disabled={editing}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: editing ? 'default' : 'pointer',
                    color: '#111827',
                  }}
                >
                  {editing ? (
                    <input
                      autoFocus
                      value={draftTitle}
                      maxLength={120}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          event.currentTarget.blur()
                        }
                        if (event.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={() => finishRename(conversation)}
                      onClick={(event) => event.stopPropagation()}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        border: '1px solid #9ca3af',
                        borderRadius: 6,
                        padding: '6px 8px',
                        font: 'inherit',
                        fontSize: 13,
                      }}
                    />
                  ) : (
                    <>
                      <div style={{ fontSize: 13, fontWeight: active ? 750 : 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conversation.title || 'New conversation'}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                        {learnerName(conversation.learner_id)}
                      </div>
                    </>
                  )}
                </button>

                {!editing && (
                  <>
                    <button
                      type="button"
                      onClick={() => startRename(conversation)}
                      aria-label={`Rename ${conversation.title || 'conversation'}`}
                      title="Rename"
                      style={{ border: 'none', background: 'transparent', color: '#4b5563', cursor: 'pointer', padding: 6, fontSize: 12 }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(conversation)}
                      aria-label={`Delete ${conversation.title || 'conversation'}`}
                      title="Delete"
                      style={{ border: 'none', background: 'transparent', color: '#991b1b', cursor: 'pointer', padding: 6, fontSize: 12 }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
