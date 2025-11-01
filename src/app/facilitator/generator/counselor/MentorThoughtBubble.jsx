'use client'

import { useEffect, useState, useMemo } from 'react'

const PHASE_STYLES = {
  start: {
    bg: '#eef2ff',
    border: '#c7d2fe',
    text: '#312e81',
    dot: '#4338ca'
  },
  success: {
    bg: '#ecfdf5',
    border: '#a7f3d0',
    text: '#064e3b',
    dot: '#10b981'
  },
  error: {
    bg: '#fef2f2',
    border: '#fecaca',
    text: '#7f1d1d',
    dot: '#ef4444'
  },
  default: {
    bg: '#f3f4f6',
    border: '#e5e7eb',
    text: '#1f2937',
    dot: '#4b5563'
  }
}

const TOOL_LABELS = {
  search_lessons: 'Lesson Search',
  get_lesson_details: 'Lesson Review',
  generate_lesson: 'Lesson Generator',
  validate_lesson: 'Quality Check',
  improve_lesson: 'Lesson Polish',
  schedule_lesson: 'Calendar Update',
  edit_lesson: 'Lesson Editing',
  get_capabilities: 'Tool Check',
  get_conversation_memory: 'Memory Review',
  search_conversation_history: 'Conversation Search'
}

function formatLabel(name) {
  if (!name) return 'Mr. Mentor'
  return TOOL_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/**
 * Floating thought bubble for Mr. Mentor status updates
 * @param {{ thought?: { id: string, message: string, name?: string, phase?: string } }} props
 */
export default function MentorThoughtBubble({ thought }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (thought) {
      setVisible(true)
      return () => setVisible(false)
    }
    setVisible(false)
  }, [thought])

  const style = useMemo(() => {
    if (!thought) return PHASE_STYLES.default
    return PHASE_STYLES[thought.phase] || PHASE_STYLES.default
  }, [thought])

  const label = useMemo(() => formatLabel(thought?.name), [thought])

  if (!thought) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: `translate(-50%, ${visible ? '0' : '-12px'})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 180ms ease, transform 220ms ease',
        pointerEvents: 'none',
        zIndex: 15,
        maxWidth: '90%'
      }}
    >
      <div
        style={{
          position: 'relative',
          background: style.bg,
          border: `2px solid ${style.border}`,
          color: style.text,
          padding: '12px 16px',
          borderRadius: 18,
          minWidth: 220,
          maxWidth: 320,
          boxShadow: '0 18px 30px rgba(15, 23, 42, 0.25)',
          fontSize: 15,
          fontWeight: 500,
          lineHeight: 1.45
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: 0.75
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: style.dot,
              boxShadow: `0 0 0 2px ${style.border}`
            }}
          />
          <span>{label}</span>
        </div>
        <div>{thought.message}</div>
        <div
          style={{
            position: 'absolute',
            bottom: -12,
            left: '22%',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: style.bg,
            border: `2px solid ${style.border}`,
            boxShadow: '0 6px 12px rgba(15, 23, 42, 0.2)'
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -22,
            left: '30%',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: style.bg,
            border: `2px solid ${style.border}`,
            opacity: 0.85
          }}
        />
      </div>
    </div>
  )
}
