'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  bg:       '#f0fdfa',   // teal-50
  surface:  '#ffffff',
  border:   '#99f6e4',   // teal-200
  accent:   '#0d9488',   // teal-600
  accentHover: '#0f766e',
  bubble:   '#0d9488',
  bubbleTxt:'#ffffff',
  student:  '#f0fdfa',
  studentBorder: '#99f6e4',
  studentTxt:'#134e4a',
  muted:    '#6b7280',
  error:    '#ef4444',
  header:   '#0f766e',   // teal-700
  headerTxt:'#ffffff',
}

const MAX_CHAT_LENGTH = 400  // max chars per student message
const MAX_HISTORY    = 20   // max messages kept in scroll view (10 turns)

export default function WebbPage() {
  const router = useRouter()

  // ── State ───────────────────────────────────────────────────────────────────
  const [messages, setMessages]       = useState([
    {
      role: 'webb',
      content: "Hi! I'm Mrs. Webb. 📚 What would you like to learn about today?",
      id: 'welcome'
    }
  ])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const bottomRef                     = useRef(null)
  const inputRef                      = useRef(null)

  // Learner meta (pulled from localStorage, same pattern as rest of app)
  const learnerName = useRef('')
  const learnerGrade = useRef('')

  useEffect(() => {
    try {
      learnerName.current  = localStorage.getItem('learner_name') || ''
      learnerGrade.current = localStorage.getItem('learner_grade') || ''
    } catch {}
  }, [])

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    if (text.length > MAX_CHAT_LENGTH) {
      setError(`That message is too long. Please keep it under ${MAX_CHAT_LENGTH} characters.`)
      return
    }

    setError('')
    setInput('')

    // Optimistically append student message
    const studentMsg = { role: 'student', content: text, id: `s-${Date.now()}` }
    setMessages(prev => {
      const updated = [...prev, studentMsg]
      return updated.slice(-MAX_HISTORY)
    })
    setLoading(true)

    try {
      // Build the conversation history to send (exclude welcome message from API payload)
      // We send the last 20 messages as context
      const historyForApi = [...messages, studentMsg]
        .filter(m => m.id !== 'welcome')
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/webb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          learnerName: learnerName.current,
          grade: learnerGrade.current
        })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.error) {
        setError(data.error || "Mrs. Webb isn't available right now. Please try again.")
        return
      }

      const webbMsg = {
        role: 'webb',
        content: data.reply || "I'm not sure how to answer that. Can you try asking a different way?",
        id: `w-${Date.now()}`
      }
      setMessages(prev => [...prev, webbMsg].slice(-MAX_HISTORY))

    } catch {
      setError("Couldn't reach Mrs. Webb. Please check your connection and try again.")
    } finally {
      setLoading(false)
      // Re-focus input after response
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [input, loading, messages])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const handleExit = useCallback(async () => {
    const { ensurePinAllowed } = await import('@/app/lib/pinGate')
    const ok = await ensurePinAllowed('session-exit')
    if (ok) router.push('/learn')
  }, [router])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: C.bg,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden'
    }}>
      {/* ── Header ── */}
      <div style={{
        background: C.header,
        color: C.headerTxt,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }} role="img" aria-label="Mrs. Webb">👩‍🏫</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 0.5 }}>MRS. WEBB</div>
            <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: 1 }}>CHAT TEACHER · EDUCATIONAL AI</div>
          </div>
        </div>
        <button
          onClick={handleExit}
          title="Back to Learn"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.35)',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: 0.5
          }}
        >
          ← BACK
        </button>
      </div>

      {/* ── Safety notice ── */}
      <div style={{
        background: '#ecfdf5',
        borderBottom: '1px solid #a7f3d0',
        padding: '6px 16px',
        fontSize: 11,
        color: '#065f46',
        textAlign: 'center',
        flexShrink: 0,
        letterSpacing: 0.3
      }}>
        🔒 Safe educational chat · Questions are reviewed for safety before answering
      </div>

      {/* ── Message list ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} />
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={bubbleBase(C.bubble, C.bubbleTxt)}>
              <TypingDots />
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: C.error,
            borderRadius: 10,
            padding: '8px 14px',
            fontSize: 13,
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{
        background: C.surface,
        borderTop: `2px solid ${C.border}`,
        padding: '12px 16px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-end',
        flexShrink: 0
      }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={e => {
            setError('')
            // Prevent input exceeding max length
            if (e.target.value.length <= MAX_CHAT_LENGTH) setInput(e.target.value)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask Mrs. Webb a question…"
          disabled={loading}
          style={{
            flex: 1,
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 15,
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            background: loading ? '#f9fafb' : '#fff',
            color: '#111',
            lineHeight: 1.4,
            maxHeight: 120,
            overflowY: 'auto',
            transition: 'border-color .15s'
          }}
          aria-label="Chat with Mrs. Webb"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? '#d1d5db' : C.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '10px 18px',
            fontSize: 15,
            fontWeight: 700,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'background .15s',
            alignSelf: 'flex-end'
          }}
          aria-label="Send message"
        >
          Send
        </button>
      </div>

      {/* ── Char count hint ── */}
      {input.length > MAX_CHAT_LENGTH * 0.8 && (
        <div style={{
          background: C.surface,
          paddingBottom: 4,
          paddingRight: 16,
          textAlign: 'right',
          fontSize: 11,
          color: input.length >= MAX_CHAT_LENGTH ? C.error : C.muted
        }}>
          {input.length}/{MAX_CHAT_LENGTH}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function bubbleBase(bg, color) {
  return {
    background: bg,
    color,
    borderRadius: 16,
    padding: '10px 14px',
    fontSize: 15,
    lineHeight: 1.5,
    maxWidth: '72%',
    wordBreak: 'break-word',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
  }
}

function ChatBubble({ msg }) {
  const isWebb = msg.role === 'webb'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isWebb ? 'flex-start' : 'flex-end',
      alignItems: 'flex-end',
      gap: 8
    }}>
      {isWebb && (
        <span style={{ fontSize: 22, flexShrink: 0, marginBottom: 2 }} aria-hidden>👩‍🏫</span>
      )}
      <div style={
        isWebb
          ? bubbleBase(C.bubble, C.bubbleTxt)
          : {
              ...bubbleBase(C.student, C.studentTxt),
              border: `1.5px solid ${C.studentBorder}`
            }
      }>
        {msg.content}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.7)',
          display: 'inline-block',
          animation: `webbDot 1.2s ${i * 0.2}s ease-in-out infinite`
        }} />
      ))}
      <style>{`
        @keyframes webbDot {
          0%, 80%, 100% { transform: scale(1); opacity: .5; }
          40% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </span>
  )
}
