'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { WEBB_WRITING_SUBPHASES } from '@/app/lib/webbWritingFlow.mjs'
import useTypingViewport, { shouldAutoFocusTextInput } from '../hooks/useTypingViewport'
import TypingConversationContext from '../components/TypingConversationContext'

function GuidanceTranscript({ text, compact = false }) {
  if (!String(text || '').trim()) return null
  return (
    <div style={{
      width: compact ? '100%' : 'min(92vw, 760px)',
      margin: compact ? '0 auto 3px' : '0 auto 22px',
      padding: compact ? '0 3px' : 0,
      boxSizing: 'border-box',
      color: '#334155',
      fontSize: compact ? 10.5 : 15,
      lineHeight: compact ? 1.18 : 1.65,
      textAlign: 'center',
      minHeight: compact ? 0 : 24,
      maxHeight: compact ? 24 : 'none',
      overflowY: compact ? 'auto' : 'visible',
      flexShrink: 0,
    }} aria-live="polite">
      {text}
    </div>
  )
}

function Paper({ children, style = {} }) {
  return (
    <div style={{
      width: 'min(92vw, 820px)',
      minHeight: 'min(72dvh, 720px)',
      margin: '0 auto',
      background: '#fffdf7',
      border: '1px solid #e7e0d2',
      borderRadius: 10,
      boxShadow: '0 24px 70px rgba(15,23,42,0.16)',
      padding: 'clamp(28px, 5vw, 58px)',
      boxSizing: 'border-box',
      position: 'relative',
      ...style,
    }}>
      {children}
    </div>
  )
}

export default function WebbWritingStudio({
  open,
  subphase,
  note,
  objective,
  draft,
  previousAttempt,
  acceptedSentences,
  activeIndex,
  totalSentences,
  guidance,
  evaluating,
  onDraftChange,
  onSubmit,
  onBlankComplete,
  onNextSentence,
  isLastSentence,
  recentEntries = [],
}) {
  const inputRef = useRef(null)
  const typingViewport = useTypingViewport()
  const keyboardCompact = typingViewport.keyboardVisible
  const blankCompleteRef = useRef(onBlankComplete)

  useEffect(() => {
    blankCompleteRef.current = onBlankComplete
  }, [onBlankComplete])

  useEffect(() => {
    if (!open || subphase !== WEBB_WRITING_SUBPHASES.BLANK) return undefined
    const timer = setTimeout(() => blankCompleteRef.current?.(), 900)
    return () => clearTimeout(timer)
  }, [open, subphase])

  useEffect(() => {
    if (!open) return
    if (![WEBB_WRITING_SUBPHASES.FOCUS, WEBB_WRITING_SUBPHASES.REVIEW].includes(subphase)) return
    if (!shouldAutoFocusTextInput()) return undefined
    const timer = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 120)
    return () => clearTimeout(timer)
  }, [open, subphase, activeIndex])

  if (!open || typeof document === 'undefined') return null

  const currentNote = String(note?.text || '').trim()
  const currentObjective = String(objective || '').trim()
  const currentDraft = String(draft || '')
  const priorText = String(previousAttempt?.text || '').trim()
  const entries = Object.entries(acceptedSentences || {})
    .map(([rawIndex, sentence]) => ({ index: Number(rawIndex), sentence }))
    .filter(entry => Number.isInteger(entry.index) && entry.sentence?.provenance === 'learner-message' && String(entry.sentence?.text || '').trim())
    .sort((a, b) => a.index - b.index)

  const submit = (event) => {
    event.preventDefault()
    if (evaluating || !currentDraft.trim()) return
    onSubmit?.(currentDraft.trim())
  }

  return createPortal(
    <div style={{
      position: 'fixed',
      ...(typingViewport.keyboardVisible && typingViewport.visualHeight ? {
        top: typingViewport.offsetTop, left: typingViewport.offsetLeft,
        width: typingViewport.visualWidth || '100%', height: typingViewport.visualHeight,
        right: 'auto', bottom: 'auto',
      } : { inset: 0 }),
      zIndex: 1400,
      background: '#f1eee7',
      overflowY: keyboardCompact ? 'hidden' : 'auto',
      padding: keyboardCompact ? '3px 5px 5px' : 'clamp(20px, 4vw, 42px) 16px 56px',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }} data-ms-webb-writing-compact={keyboardCompact ? 'true' : 'false'}>
      <div style={{ position: keyboardCompact ? 'relative' : 'static', zIndex: 4, flexShrink: 0 }}>
        <TypingConversationContext
          entries={recentEntries}
          visible={typingViewport.keyboardVisible}
          maxItems={keyboardCompact ? 2 : 6}
          compact={keyboardCompact}
          teacherLabel="Mrs. Webb"
          accent="#0d9488"
        />
      </div>
      {subphase === WEBB_WRITING_SUBPHASES.BLANK && (
        <div style={{ animation: 'webb-writing-paper-in 0.55s ease both' }}>
          <GuidanceTranscript text={guidance} />
          <Paper>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              Your essay
            </div>
            <div style={{ height: 1, background: '#e5e7eb', margin: '18px 0 30px' }} />
            <div style={{ minHeight: 420, backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 38px, rgba(148,163,184,0.17) 39px)', opacity: 0.8 }} />
          </Paper>
        </div>
      )}

      {[WEBB_WRITING_SUBPHASES.FOCUS, WEBB_WRITING_SUBPHASES.REVIEW].includes(subphase) && (
        <div style={{
          animation: 'webb-writing-focus-in 0.35s ease both',
          ...(keyboardCompact ? { display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, overflow: 'hidden' } : {}),
        }}>
          <GuidanceTranscript text={guidance} compact={keyboardCompact} />
          <div style={{
            width: keyboardCompact ? '100%' : 'min(92vw, 780px)',
            margin: '0 auto',
            ...(keyboardCompact ? { flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}),
          }}>
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: keyboardCompact ? 9 : 12, fontWeight: 800, letterSpacing: keyboardCompact ? 0.7 : 1.25, textTransform: 'uppercase', marginBottom: keyboardCompact ? 3 : 20 }}>
              Sentence {activeIndex + 1} of {totalSentences}
            </div>

            <section style={{
              background: '#fffdf7',
              border: '1px solid #ded6c7',
              borderRadius: keyboardCompact ? 8 : 16,
              padding: keyboardCompact ? '5px 7px' : 'clamp(24px, 5vw, 44px)',
              boxShadow: keyboardCompact ? '0 4px 14px rgba(15,23,42,0.08)' : '0 20px 55px rgba(15,23,42,0.12)',
              ...(keyboardCompact ? { flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : {}),
            }}>
              {currentObjective && (
                <div style={{
                  marginBottom: keyboardCompact ? 3 : 26,
                  paddingBottom: keyboardCompact ? 3 : 22,
                  borderBottom: '1px solid #e7e0d2',
                  ...(keyboardCompact ? { maxHeight: 44, overflowY: 'auto', flexShrink: 0 } : {}),
                }}>
                  <div style={{ color: '#64748b', fontSize: keyboardCompact ? 9 : 11, fontWeight: 900, letterSpacing: keyboardCompact ? 0.7 : 1.4, textTransform: 'uppercase', marginBottom: keyboardCompact ? 2 : 8 }}>
                    What you showed
                  </div>
                  <div style={{ color: '#334155', fontSize: keyboardCompact ? 12 : 'clamp(15px, 2.4vw, 19px)', lineHeight: keyboardCompact ? 1.22 : 1.55, fontWeight: 650 }}>
                    {currentObjective}
                  </div>
                </div>
              )}
              <div style={{ color: '#0f766e', fontSize: keyboardCompact ? 9 : 11, fontWeight: 900, letterSpacing: keyboardCompact ? 0.7 : 1.4, textTransform: 'uppercase', marginBottom: keyboardCompact ? 2 : 10 }}>
                Your note
              </div>
              <div style={{
                color: '#172033',
                fontSize: keyboardCompact ? 13 : 'clamp(23px, 4vw, 36px)',
                lineHeight: keyboardCompact ? 1.22 : 1.35,
                fontWeight: 720,
                letterSpacing: keyboardCompact ? '-0.01em' : '-0.02em',
                marginBottom: keyboardCompact ? 3 : (subphase === WEBB_WRITING_SUBPHASES.REVIEW ? 30 : 38),
                ...(keyboardCompact ? { maxHeight: 44, overflowY: 'auto', flexShrink: 0 } : {}),
              }}>
                {currentNote}
              </div>

              {subphase === WEBB_WRITING_SUBPHASES.REVIEW && priorText && (
                <div style={{
                  marginBottom: keyboardCompact ? 5 : 28,
                  padding: keyboardCompact ? '5px 7px' : '18px 20px',
                  borderRadius: keyboardCompact ? 7 : 12,
                  background: '#f1f5f9',
                  border: '1px solid #dbe4ef',
                  animation: 'webb-writing-attempt-aside 0.38s ease both',
                  ...(keyboardCompact ? { maxHeight: 44, overflowY: 'auto', flexShrink: 0 } : {}),
                }}>
                  <div style={{ color: '#64748b', fontSize: keyboardCompact ? 9 : 10, fontWeight: 900, letterSpacing: keyboardCompact ? 0.7 : 1.25, textTransform: 'uppercase', marginBottom: keyboardCompact ? 2 : 8 }}>
                    Previous attempt
                  </div>
                  <div style={{ color: '#475569', fontSize: keyboardCompact ? 12 : 'clamp(16px, 2.6vw, 21px)', lineHeight: keyboardCompact ? 1.22 : 1.55 }}>
                    {priorText}
                  </div>
                </div>
              )}

              <form onSubmit={submit} style={keyboardCompact ? { marginTop: 'auto', flexShrink: 0 } : undefined}>
                <label htmlFor="webb-writing-attempt" style={{ display: 'block', color: '#0f766e', fontSize: keyboardCompact ? 9 : 11, fontWeight: 900, letterSpacing: keyboardCompact ? 0.7 : 1.4, textTransform: 'uppercase', marginBottom: keyboardCompact ? 3 : 10 }}>
                  {subphase === WEBB_WRITING_SUBPHASES.REVIEW ? 'Try again' : 'Your sentence'}
                </label>
                <textarea
                  ref={inputRef}
                  id="webb-writing-attempt"
                  value={currentDraft}
                  onChange={event => onDraftChange?.(event.target.value)}
                  disabled={evaluating}
                  rows={keyboardCompact ? 2 : 4}
                  autoComplete="off"
                  spellCheck
                  style={{
                    width: '100%',
                    resize: keyboardCompact ? 'none' : 'vertical',
                    minHeight: keyboardCompact ? 52 : 132,
                    maxHeight: keyboardCompact ? 58 : 'none',
                    boxSizing: 'border-box',
                    border: '2px solid #99f6e4',
                    borderRadius: keyboardCompact ? 7 : 12,
                    background: '#ffffff',
                    color: '#111827',
                    fontSize: keyboardCompact ? 16 : 'clamp(18px, 3vw, 24px)',
                    lineHeight: keyboardCompact ? 1.25 : 1.5,
                    padding: keyboardCompact ? '6px 8px' : '16px 18px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  disabled={evaluating || !currentDraft.trim()}
                  style={{
                    width: '100%',
                    marginTop: keyboardCompact ? 4 : 14,
                    border: 0,
                    borderRadius: keyboardCompact ? 7 : 12,
                    padding: keyboardCompact ? '7px 10px' : '13px 18px',
                    background: evaluating || !currentDraft.trim() ? '#cbd5e1' : '#0d9488',
                    color: '#fff',
                    fontWeight: 850,
                    fontSize: keyboardCompact ? 12 : 15,
                    cursor: evaluating || !currentDraft.trim() ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {evaluating ? 'Mrs. Webb is reviewing...' : 'Review my sentence'}
                </button>
              </form>
            </section>
          </div>
        </div>
      )}

      {subphase === WEBB_WRITING_SUBPHASES.COMMITTED && (
        <div style={{ animation: 'webb-writing-paper-in 0.4s ease both' }}>
          <GuidanceTranscript text={guidance} />
          <div style={{ width: 'min(92vw, 820px)', margin: '0 auto 18px' }}>
            {currentObjective && (
              <div style={{ background: '#fffdf7', border: '1px solid #ded6c7', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 900, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 7 }}>
                  What you showed
                </div>
                <div style={{ color: '#334155', fontSize: 16, lineHeight: 1.5, fontWeight: 650, marginBottom: 12 }}>
                  {currentObjective}
                </div>
                <div style={{ color: '#0f766e', fontSize: 10, fontWeight: 900, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 6 }}>
                  Your note
                </div>
                <div style={{ color: '#475569', fontSize: 15, lineHeight: 1.5 }}>
                  {currentNote}
                </div>
              </div>
            )}
          </div>
          <Paper>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              Your essay so far
            </div>
            <div style={{ height: 1, background: '#e5e7eb', margin: '18px 0 28px' }} />
            <div style={{ display: 'grid', gap: 14 }}>
              {entries.map(({ index, sentence }) => (
                <p key={index} style={{
                  margin: 0,
                  color: '#1f2937',
                  fontSize: 'clamp(18px, 3vw, 24px)',
                  lineHeight: 1.65,
                  borderRadius: 9,
                  padding: index === activeIndex ? '8px 10px' : '0',
                  background: index === activeIndex ? '#ecfdf5' : 'transparent',
                  boxShadow: index === activeIndex ? '0 0 0 2px rgba(13,148,136,0.28), 0 0 28px rgba(13,148,136,0.18)' : 'none',
                  animation: index === activeIndex ? 'webb-writing-glow 1.35s ease both' : 'none',
                }}>
                  {sentence.text}
                </p>
              ))}
            </div>
          </Paper>
          <div style={{ width: 'min(92vw, 820px)', margin: '20px auto 0' }}>
            <button
              type="button"
              onClick={() => onNextSentence?.()}
              style={{
                width: '100%', border: 0, borderRadius: 12, padding: '14px 18px',
                background: '#0d9488', color: '#fff', fontWeight: 850, fontSize: 16,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {isLastSentence ? 'Finish essay' : 'Next sentence'}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}