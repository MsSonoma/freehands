'use client'

import { useEffect, useMemo, useRef } from 'react'

function normalizeEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map(entry => ({
      role: entry?.role === 'user' ? 'user' : 'assistant',
      text: String(entry?.text ?? entry?.content ?? '').trim(),
    }))
    .filter(entry => entry.text)
}

export default function TypingConversationContext({ entries, visible, maxItems = 4, accent = '#c7442e', teacherLabel = 'Teacher', compact = false }) {
  const scrollerRef = useRef(null)
  const recent = useMemo(() => normalizeEntries(entries).slice(-Math.max(1, maxItems)), [entries, maxItems])

  useEffect(() => {
    if (!visible || !scrollerRef.current) return
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [visible, recent])

  if (!visible || recent.length === 0) return null

  return (
    <div data-ms-typing-context style={{
      borderBottom: '1px solid #e5e7eb',
      background: '#f8fafc',
      padding: compact ? '3px 6px 3px' : '7px 10px 6px',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: compact ? 9 : 10, fontWeight: 850, letterSpacing: compact ? 0.8 : 1.1, textTransform: 'uppercase', color: '#64748b', marginBottom: compact ? 2 : 4 }}>
        Recent conversation
      </div>
      <div ref={scrollerRef} style={{
        maxHeight: compact ? '40px' : 'min(24dvh, 132px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'grid',
        gap: compact ? 1 : 3,
        paddingRight: compact ? 2 : 4,
      }}>
        {recent.map((entry, index) => (
          <div key={`${index}-${entry.role}-${entry.text.slice(0, 24)}`} style={{
            fontSize: compact ? 11 : 'clamp(12px, 1.7vw, 14px)',
            lineHeight: compact ? 1.2 : 1.35,
            color: entry.role === 'user' ? accent : '#334155',
            fontWeight: entry.role === 'user' ? 700 : 520,
            whiteSpace: 'pre-line',
          }}>
            <span style={{ fontWeight: 850 }}>{entry.role === 'user' ? 'You' : teacherLabel}:</span> {entry.text}
          </div>
        ))}
      </div>
    </div>
  )
}
