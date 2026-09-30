'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { WEBB_WRITING_SUBPHASES } from '@/app/lib/webbWritingFlow.mjs'
import useTypingViewport, { shouldAutoFocusTextInput } from '../hooks/useTypingViewport'
import WebbDictationButton from './WebbDictationButton'

function GuidanceTranscript({ text, compact = false, tight = false }) {
  if (!String(text || '').trim()) return null
  return (
    <div style={{
      width: compact ? '100%' : 'min(92vw, 760px)',
      margin: compact ? '0 auto 6px' : '0 auto 22px',
      padding: compact ? '0 6px' : 0,
      boxSizing: 'border-box',
      color: '#334155',
      fontSize: compact ? 13 : 15,
      lineHeight: compact ? 1.4 : 1.65,
      textAlign: 'center',
      minHeight: compact ? 0 : 24,
      maxHeight: compact && !tight ? 52 : 'none',
      overflowY: compact && !tight ? 'auto' : 'visible',
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
  objectivePrompt = '',
  objectivePromptCaptured = false,
  slot = null,
  sourceNotes = [],
  lessonTitle = '',
  lessonBlurb = '',
  draft,
  previousAttempt,
  acceptedSentences,
  activeIndex,
  totalSentences,
  guidance,
  evaluating,
  transitionBusy = false,
  playtimeDue = false,
  finalView = false,
  onCloseFinal,
  onCompleteLesson,
  completionState = 'idle',
  completionError = '',
  lessonCompleted = false,
  onDraftChange,
  onSubmit,
  onBlankComplete,
  onNextSentence,
  isLastSentence,
  responseTimer = null,
  storageWarning = '',
  onLearnerActivity,
}) {
  const inputRef = useRef(null)
  const [essayPeek, setEssayPeek] = useState(false)
  const typingViewport = useTypingViewport({ preserveTouchFocus: true, blurDelayMs: 350 })
  const keyboardCompact = typingViewport.typing
  const keyboardTight = keyboardCompact && typingViewport.visualHeight > 0 && typingViewport.visualHeight < 280
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
    setEssayPeek(false)
  }, [open, activeIndex, subphase])

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
  const currentObjectivePrompt = String(objectivePrompt || currentObjective).trim()
  const currentRole = String(slot?.role || '').trim().toLowerCase()
  const visibleLessonTitle = String(lessonTitle || '').trim()
  const visibleLessonBlurb = String(lessonBlurb || '').trim()
  const showLessonContext = currentRole === 'topic' || currentRole === 'conclusion'
  const researchNotes = (Array.isArray(sourceNotes) ? sourceNotes : []).map(value => String(value?.text || value || '').trim()).filter(Boolean)
  const visibleResearchNotes = researchNotes.length ? researchNotes : (currentNote ? [currentNote] : [])
  const slotLabel = currentRole === 'topic' ? 'Topic sentence' : currentRole === 'conclusion' ? 'Concluding sentence' : currentRole === 'body' ? 'Body sentence' : ''
  const roleDescription = currentRole === 'topic'
    ? 'This is the first sentence of your paragraph. It tells the reader what the whole paragraph is about. Think about the lesson and what the ideas you learned have in common. You are not turning a research note into a sentence here.'
    : currentRole === 'conclusion'
      ? 'This is the last sentence of your paragraph. It reminds the reader of the main idea and makes the paragraph feel finished. Look back at what you already explained. You are not turning one research note into a sentence here, and you should not add a new fact.'
      : ''
  const currentDraft = String(draft || '')
  const priorText = String(previousAttempt?.text || '').trim()
  const entries = Object.entries(acceptedSentences || {})
    .map(([rawIndex, sentence]) => ({ index: Number(rawIndex), sentence }))
    .filter(entry => Number.isInteger(entry.index) && entry.sentence?.provenance === 'learner-message' && String(entry.sentence?.text || '').trim())
    .sort((a, b) => a.index - b.index)
  const canPeekEssay = !finalView && entries.length > 0 && [WEBB_WRITING_SUBPHASES.FOCUS, WEBB_WRITING_SUBPHASES.REVIEW].includes(subphase)
  const showEssayPeek = canPeekEssay && essayPeek

  const submit = (event) => {
    event.preventDefault()
    if (evaluating || !currentDraft.trim()) return
    onSubmit?.(currentDraft.trim())
  }

  return createPortal(
    <div style={{
      position: 'fixed',
      ...(typingViewport.typing && typingViewport.visualHeight ? {
        top: typingViewport.offsetTop, left: typingViewport.offsetLeft,
        width: typingViewport.visualWidth || '100%', height: typingViewport.visualHeight,
        right: 'auto', bottom: 'auto',
      } : { inset: 0 }),
      zIndex: 1400,
      background: '#f1eee7',
      overflowY: keyboardCompact && !keyboardTight ? 'hidden' : 'auto',
      padding: keyboardCompact ? '5px 8px 8px' : 'clamp(20px, 4vw, 42px) 16px 56px',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }} data-ms-webb-writing-compact={keyboardCompact ? 'true' : 'false'}>
      {responseTimer && (
        <div style={{ position: 'absolute', top: keyboardCompact ? 4 : 12, right: keyboardCompact ? 5 : 14, zIndex: 8 }}>
          {responseTimer}
        </div>
      )}
      {canPeekEssay && (
        <div style={{ width: keyboardCompact ? '100%' : 'min(92vw, 820px)', margin: keyboardCompact ? '0 auto 6px' : '0 auto 14px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              if (!essayPeek) inputRef.current?.blur()
              setEssayPeek(value => !value)
            }}
            style={{
              border: '1px solid #cbd5e1', borderRadius: 999, padding: keyboardCompact ? '6px 11px' : '8px 13px',
              background: essayPeek ? '#0d9488' : '#fff', color: essayPeek ? '#fff' : '#475569',
              fontWeight: 850, fontSize: keyboardCompact ? 11.5 : 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {essayPeek ? 'Back to writing' : 'View essay'}
          </button>
        </div>
      )}
      {subphase === WEBB_WRITING_SUBPHASES.BLANK && (
        <div style={{ animation: 'webb-writing-paper-in 0.55s ease both' }}>
          <GuidanceTranscript text={guidance} />
          {storageWarning && <div style={{ width: 'min(92vw, 820px)', margin: '0 auto 12px', padding: '9px 12px', borderRadius: 9, background: '#fff7ed', color: '#9a3412', fontSize: 12, fontWeight: 700 }}>{storageWarning}</div>}
          <Paper>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              Your essay
            </div>
            <div style={{ height: 1, background: '#e5e7eb', margin: '18px 0 30px' }} />
            <div style={{ minHeight: 420, backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 38px, rgba(148,163,184,0.17) 39px)', opacity: 0.8 }} />
          </Paper>
        </div>
      )}

      {showEssayPeek && (
        <div style={{ animation: 'webb-writing-paper-in 0.28s ease both' }}>
          <Paper>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              Your essay so far
            </div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.45, marginTop: 7 }}>
              These are the sentences you have finished. Your current sentence stays saved while you look.
            </div>
            <div style={{ height: 1, background: '#e5e7eb', margin: '18px 0 28px' }} />
            <div style={{ display: 'grid', gap: 14 }}>
              {entries.map(({ index, sentence }) => (
                <p key={index} style={{ margin: 0, color: '#1f2937', fontSize: 'clamp(18px, 3vw, 24px)', lineHeight: 1.65 }}>
                  {sentence.text}
                </p>
              ))}
            </div>
          </Paper>
        </div>
      )}

      {!showEssayPeek && [WEBB_WRITING_SUBPHASES.FOCUS, WEBB_WRITING_SUBPHASES.REVIEW].includes(subphase) && (
        <div style={{
          animation: 'webb-writing-focus-in 0.35s ease both',
          ...(keyboardCompact && !keyboardTight ? { display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, overflow: 'hidden' } : {}),
        }}>
          <GuidanceTranscript text={guidance} compact={keyboardCompact} tight={keyboardTight} />
          <div style={{
            width: keyboardCompact ? '100%' : 'min(92vw, 780px)',
            margin: '0 auto',
            ...(keyboardCompact && !keyboardTight ? { flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}),
          }}>
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: keyboardCompact ? 10.5 : 12, fontWeight: 800, letterSpacing: keyboardCompact ? 0.7 : 1.25, textTransform: 'uppercase', marginBottom: keyboardCompact ? 4 : 20 }}>
              Sentence {activeIndex + 1} of {totalSentences}
            </div>

            <section style={{
              background: '#fffdf7',
              border: '1px solid #ded6c7',
              borderRadius: keyboardCompact ? 8 : 16,
              padding: keyboardCompact ? '8px 10px' : 'clamp(24px, 5vw, 44px)',
              boxShadow: keyboardCompact ? '0 4px 14px rgba(15,23,42,0.08)' : '0 20px 55px rgba(15,23,42,0.12)',
              ...(keyboardCompact && !keyboardTight ? { flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : {}),
            }}>
              <div data-ms-webb-writing-reference style={keyboardCompact && !keyboardTight ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingRight: 2 } : keyboardCompact ? { paddingRight: 2 } : undefined}>
              {slotLabel && (
                <div style={{ color: '#64748b', fontSize: keyboardCompact ? 10.5 : 11, fontWeight: 900, letterSpacing: keyboardCompact ? 0.7 : 1.4, textTransform: 'uppercase', marginBottom: keyboardCompact ? 5 : 12 }}>
                  {slotLabel}
                </div>
              )}
              {roleDescription && (
                <div style={{ color: '#334155', fontSize: keyboardCompact ? 14 : 16, lineHeight: keyboardCompact ? 1.42 : 1.55, fontWeight: 650, marginBottom: keyboardCompact ? 8 : 18 }}>
                  {roleDescription}
                </div>
              )}
              {showLessonContext && (visibleLessonTitle || visibleLessonBlurb) && (
                <div style={{ marginBottom: keyboardCompact ? 8 : 22, paddingBottom: keyboardCompact ? 8 : 18, borderBottom: '1px solid #e7e0d2' }}>
                  <div style={{ color: '#64748b', fontSize: keyboardCompact ? 10 : 10, fontWeight: 900, letterSpacing: keyboardCompact ? 0.7 : 1.25, textTransform: 'uppercase', marginBottom: keyboardCompact ? 2 : 6 }}>Lesson</div>
                  {visibleLessonTitle && <div style={{ color: '#172033', fontSize: keyboardCompact ? 16 : 18, lineHeight: 1.35, fontWeight: 800 }}>{visibleLessonTitle}</div>}
                  {visibleLessonBlurb && <div style={{ color: '#475569', fontSize: keyboardCompact ? 13 : 15, lineHeight: keyboardCompact ? 1.4 : 1.5, marginTop: keyboardCompact ? 2 : 6 }}>{visibleLessonBlurb}</div>}
                </div>
              )}
              {currentObjectivePrompt && currentRole !== 'topic' && currentRole !== 'conclusion' && (
                <div style={{ marginBottom: keyboardCompact ? 8 : 20, paddingBottom: keyboardCompact ? 8 : 18, borderBottom: '1px solid #e7e0d2' }}>
                  <div style={{ color: '#64748b', fontSize: keyboardCompact ? 10 : 11, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{objectivePromptCaptured ? 'Mrs. Webb asked' : 'Learning objective'}</div>
                  <div style={{ color: '#334155', fontSize: keyboardCompact ? 14 : 17, lineHeight: 1.5, fontWeight: 650 }}>{currentObjectivePrompt}</div>
                </div>
              )}
              {visibleResearchNotes.length > 0 && currentRole !== 'topic' && currentRole !== 'conclusion' && (
                <div style={{ marginBottom: keyboardCompact ? 8 : (subphase === WEBB_WRITING_SUBPHASES.REVIEW ? 30 : 38) }}>
                  <div style={{ color: '#0f766e', fontSize: keyboardCompact ? 10 : 11, fontWeight: 900, letterSpacing: keyboardCompact ? 0.7 : 1.4, textTransform: 'uppercase', marginBottom: keyboardCompact ? 2 : 10 }}>
                    {visibleResearchNotes.length > 1 ? 'Your research notes' : 'Your research note'}
                  </div>
                  <div style={{ display: 'grid', gap: keyboardCompact ? 5 : 10 }}>
                    {visibleResearchNotes.map((text, index) => <div key={index} style={{ color: '#172033', fontSize: keyboardCompact ? 16 : 'clamp(19px, 3.4vw, 30px)', lineHeight: keyboardCompact ? 1.35 : 1.35, fontWeight: 720 }}>{text}</div>)}
                  </div>
                </div>
              )}

              {subphase === WEBB_WRITING_SUBPHASES.REVIEW && priorText && (
                <div style={{
                  marginBottom: keyboardCompact ? 8 : 28,
                  padding: keyboardCompact ? '8px 10px' : '18px 20px',
                  borderRadius: keyboardCompact ? 8 : 12,
                  background: '#f1f5f9',
                  border: '1px solid #dbe4ef',
                  animation: 'webb-writing-attempt-aside 0.38s ease both',
                }}>
                  <div style={{ color: '#64748b', fontSize: keyboardCompact ? 10 : 10, fontWeight: 900, letterSpacing: keyboardCompact ? 0.7 : 1.25, textTransform: 'uppercase', marginBottom: keyboardCompact ? 2 : 8 }}>
                    Previous attempt
                  </div>
                  <div style={{ color: '#475569', fontSize: keyboardCompact ? 14 : 'clamp(16px, 2.6vw, 21px)', lineHeight: keyboardCompact ? 1.4 : 1.55 }}>
                    {priorText}
                  </div>
                </div>
              )}
              </div>

              <form onSubmit={submit} style={keyboardCompact && !keyboardTight ? { marginTop: 6, flexShrink: 0 } : keyboardCompact ? { marginTop: 6 } : undefined}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: keyboardCompact ? 5 : 10 }}>
                  <label htmlFor="webb-writing-attempt" style={{ display: 'block', color: '#0f766e', fontSize: keyboardCompact ? 10 : 11, fontWeight: 900, letterSpacing: keyboardCompact ? 0.7 : 1.4, textTransform: 'uppercase', margin: 0 }}>
                    {subphase === WEBB_WRITING_SUBPHASES.REVIEW ? 'Try again' : 'Your sentence'}
                  </label>
                  <WebbDictationButton
                    disabled={evaluating}
                    compact={keyboardCompact}
                    onBeforeRecord={() => inputRef.current?.blur()}
                    onActivity={onLearnerActivity}
                    onTranscript={text => {
                      const next = [currentDraft.trim(), text].filter(Boolean).join(' ')
                      onDraftChange?.(next)
                    }}
                  />
                </div>
                <textarea
                  ref={inputRef}
                  id="webb-writing-attempt"
                  value={currentDraft}
                  onChange={event => {
                    onLearnerActivity?.()
                    onDraftChange?.(event.target.value)
                  }}
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
                    fontSize: keyboardCompact ? 13 : 15,
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
          {storageWarning && <div style={{ width: 'min(92vw, 820px)', margin: '0 auto 12px', padding: '9px 12px', borderRadius: 9, background: '#fff7ed', color: '#9a3412', fontSize: 12, fontWeight: 700 }}>{storageWarning}</div>}
          <div style={{ width: 'min(92vw, 820px)', margin: '0 auto 18px' }}>
            {!finalView && (slotLabel || currentObjective || visibleResearchNotes.length > 0) && (
              <div style={{ background: '#fffdf7', border: '1px solid #ded6c7', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 900, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 7 }}>
                  {slotLabel || 'What you showed'}
                </div>
                {!slot && currentObjective && <div style={{ color: '#334155', fontSize: 16, lineHeight: 1.5, fontWeight: 650, marginBottom: 12 }}>{currentObjective}</div>}
                {visibleResearchNotes.length > 0 && currentRole !== 'topic' && currentRole !== 'conclusion' && <div>
                  <div style={{ color: '#0f766e', fontSize: 10, fontWeight: 900, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 6 }}>{visibleResearchNotes.length > 1 ? 'Research notes used' : 'Research note used'}</div>
                  {visibleResearchNotes.map((text, index) => <div key={index} style={{ color: '#475569', fontSize: 15, lineHeight: 1.5 }}>{text}</div>)}
                </div>}
              </div>
            )}
          </div>
          <Paper>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              {finalView ? 'Your essay' : 'Your essay so far'}
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
                  padding: !finalView && index === activeIndex ? '8px 10px' : '0',
                  background: !finalView && index === activeIndex ? '#ecfdf5' : 'transparent',
                  boxShadow: !finalView && index === activeIndex ? '0 0 0 2px rgba(13,148,136,0.28), 0 0 28px rgba(13,148,136,0.18)' : 'none',
                  animation: !finalView && index === activeIndex ? 'webb-writing-glow 1.35s ease both' : 'none',
                }}>
                  {sentence.text}
                </p>
              ))}
            </div>
          </Paper>
          <div style={{ width: 'min(92vw, 820px)', margin: '20px auto 0', display: 'grid', gap: 10 }}>
            {finalView ? (
              <>
                <button
                  type="button"
                  onClick={() => onCompleteLesson?.()}
                  disabled={lessonCompleted || completionState === 'saving'}
                  style={{
                    width: '100%', border: 0, borderRadius: 12, padding: '14px 18px',
                    background: lessonCompleted ? '#64748b' : '#0d9488', color: '#fff', fontWeight: 850, fontSize: 16,
                    cursor: lessonCompleted || completionState === 'saving' ? 'default' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {lessonCompleted ? 'Lesson Completed' : completionState === 'saving' ? 'Recording completion...' : completionState === 'failed' ? 'Retry completion' : 'Complete Lesson'}
                </button>
                {completionState === 'failed' && completionError && <div role="alert" style={{ color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>{completionError}</div>}
                <button
                  type="button"
                  onClick={() => onCloseFinal?.()}
                  style={{
                    width: '100%', border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 18px',
                    background: '#fff', color: '#475569', fontWeight: 800, fontSize: 15,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Back to lesson
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onNextSentence?.()}
                disabled={transitionBusy}
                style={{
                  width: '100%', border: 0, borderRadius: 12, padding: '14px 18px',
                  background: transitionBusy ? '#64748b' : '#0d9488', color: '#fff', fontWeight: 850, fontSize: 16,
                  cursor: transitionBusy ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {transitionBusy ? 'Play break starting...' : playtimeDue ? 'Playtime' : isLastSentence ? 'Finish essay' : 'Next sentence'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
