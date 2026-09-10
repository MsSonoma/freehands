'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { WEBB_WRITING_SUBPHASES } from '@/app/lib/webbWritingFlow.mjs'

function GuidanceTranscript({ text }) {
  if (!String(text || '').trim()) return null
  return (
    <div style={{
      width: 'min(92vw, 760px)',
      margin: '0 auto 22px',
      color: '#334155',
      fontSize: 15,
      lineHeight: 1.65,
      textAlign: 'center',
      minHeight: 24,
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
}) {
  const inputRef = useRef(null)
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
    const timer = setTimeout(() => inputRef.current?.focus(), 120)
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
      inset: 0,
      zIndex: 1400,
      background: '#f1eee7',
      overflowY: 'auto',
      padding: 'clamp(20px, 4vw, 42px) 16px 56px',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
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
        <div style={{ animation: 'webb-writing-focus-in 0.35s ease both' }}>
          <GuidanceTranscript text={guidance} />
          <div style={{ width: 'min(92vw, 780px)', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: 1.25, textTransform: 'uppercase', marginBottom: 20 }}>
              Sentence {activeIndex + 1} of {totalSentences}
            </div>

            <section style={{
              background: '#fffdf7',
              border: '1px solid #ded6c7',
              borderRadius: 16,
              padding: 'clamp(24px, 5vw, 44px)',
              boxShadow: '0 20px 55px rgba(15,23,42,0.12)',
            }}>
              {currentObjective && (
                <div style={{ marginBottom: 26, paddingBottom: 22, borderBottom: '1px solid #e7e0d2' }}>
                  <div style={{ color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 }}>
                    What you showed
                  </div>
                  <div style={{ color: '#334155', fontSize: 'clamp(15px, 2.4vw, 19px)', lineHeight: 1.55, fontWeight: 650 }}>
                    {currentObjective}
                  </div>
                </div>
              )}
              <div style={{ color: '#0f766e', fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>
                Your note
              </div>
              <div style={{
                color: '#172033',
                fontSize: 'clamp(23px, 4vw, 36px)',
                lineHeight: 1.35,
                fontWeight: 720,
                letterSpacing: '-0.02em',
                marginBottom: subphase === WEBB_WRITING_SUBPHASES.REVIEW ? 30 : 38,
              }}>
                {currentNote}
              </div>

              {subphase === WEBB_WRITING_SUBPHASES.REVIEW && priorText && (
                <div style={{
                  marginBottom: 28,
                  padding: '18px 20px',
                  borderRadius: 12,
                  background: '#f1f5f9',
                  border: '1px solid #dbe4ef',
                  animation: 'webb-writing-attempt-aside 0.38s ease both',
                }}>
                  <div style={{ color: '#64748b', fontSize: 10, fontWeight: 900, letterSpacing: 1.25, textTransform: 'uppercase', marginBottom: 8 }}>
                    Previous attempt
                  </div>
                  <div style={{ color: '#475569', fontSize: 'clamp(16px, 2.6vw, 21px)', lineHeight: 1.55 }}>
                    {priorText}
                  </div>
                </div>
              )}

              <form onSubmit={submit}>
                <label htmlFor="webb-writing-attempt" style={{ display: 'block', color: '#0f766e', fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>
                  {subphase === WEBB_WRITING_SUBPHASES.REVIEW ? 'Try again' : 'Your sentence'}
                </label>
                <textarea
                  ref={inputRef}
                  id="webb-writing-attempt"
                  value={currentDraft}
                  onChange={event => onDraftChange?.(event.target.value)}
                  disabled={evaluating}
                  rows={4}
                  autoComplete="off"
                  spellCheck
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    minHeight: 132,
                    boxSizing: 'border-box',
                    border: '2px solid #99f6e4',
                    borderRadius: 12,
                    background: '#ffffff',
                    color: '#111827',
                    fontSize: 'clamp(18px, 3vw, 24px)',
                    lineHeight: 1.5,
                    padding: '16px 18px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  disabled={evaluating || !currentDraft.trim()}
                  style={{
                    width: '100%',
                    marginTop: 14,
                    border: 0,
                    borderRadius: 12,
                    padding: '13px 18px',
                    background: evaluating || !currentDraft.trim() ? '#cbd5e1' : '#0d9488',
                    color: '#fff',
                    fontWeight: 850,
                    fontSize: 15,
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