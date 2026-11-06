'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { acquirePageScrollLock } from '@/app/lib/scrollLock.mjs'
import { mediaDurationLabel, videoEmbedUrl } from '@/app/lib/webbMedia.mjs'

const actionButton = {
  border: '1px solid #94a3b8',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  background: '#fff',
  color: '#0f172a',
}

export default function WebbFacilitatorVideoReviewOverlay({
  video,
  status = '',
  busy = false,
  error = '',
  onClose,
  onDecision,
}) {
  const closeRef = useRef(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const releaseScrollLock = acquirePageScrollLock()
    closeRef.current?.focus()
    return () => {
      releaseScrollLock()
      previouslyFocused?.focus?.()
    }
  }, [])

  const embedUrl = videoEmbedUrl(video?.id)
  if (!embedUrl) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2400,
        background: 'rgba(2, 6, 23, 0.88)',
        display: 'grid',
        placeItems: 'center',
        padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
        fontFamily: 'Roboto, system-ui, sans-serif',
      }}
      onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose?.() }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="webb-video-review-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.stopPropagation()
            onClose?.()
          }
        }}
        style={{
          width: 'min(1080px, 100%)',
          maxHeight: 'min(94dvh, 1100px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 16,
          background: '#fff',
          color: '#0f172a',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
        }}
      >
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, background: '#0f766e', color: '#fff', padding: '12px 16px', flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Mrs. Webb · Facilitator review
            </div>
            <h2 id="webb-video-review-title" style={{ margin: '3px 0 0', fontSize: 18, lineHeight: 1.3 }}>
              {video.title}
            </h2>
          </div>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            disabled={busy}
            aria-label="Close video review"
            style={{ ...actionButton, flexShrink: 0 }}
          >
            Close
          </button>
        </header>

        <div style={{ overflowY: 'auto', padding: 16, minHeight: 0 }}>
          <div style={{ width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
            <iframe
              title={video.title}
              src={embedUrl.replace('controls=0', 'controls=1')}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          </div>

          <div style={{ marginTop: 12, display: 'grid', gap: 6, fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ color: '#475569' }}>
              {video.source || 'Video source'} · {mediaDurationLabel(video)} · Estimated lesson fit {video.fitScore}/10
            </div>
            {video.description && <p style={{ margin: 0 }}>{video.description}</p>}
            {video.fitReason && <div><strong>Lesson fit:</strong> {video.fitReason}</div>}
            {video.ageNote && <div><strong>Age suitability:</strong> {video.ageNote}</div>}
            <div style={{ fontWeight: 700 }}>
              {status === 'approved' ? 'Already approved' : status === 'pending' ? 'Learner requested this video' : status === 'rejected' ? 'Previously rejected' : 'Awaiting facilitator decision'}
            </div>
          </div>
        </div>

        {error && <div role="alert" style={{ padding: '8px 16px', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        <footer style={{
          padding: 14, display: 'flex', justifyContent: 'flex-end', gap: 9, flexWrap: 'wrap',
          borderTop: '1px solid #e2e8f0', flexShrink: 0,
        }}>
          <button type="button" disabled={busy} onClick={onClose} style={actionButton}>Back to results</button>
          <button type="button" disabled={busy} onClick={() => onDecision?.(video, 'rejected', false)}
            style={actionButton}>Reject</button>
          <button type="button" disabled={busy} onClick={() => onDecision?.(video, 'approved', false)}
            style={{ ...actionButton, background: '#0f766e', borderColor: '#0f766e', color: '#fff' }}>
            Approve for play time
          </button>
          <button type="button" disabled={busy} onClick={() => onDecision?.(video, 'approved', true)}
            style={{ ...actionButton, background: '#164e63', borderColor: '#164e63', color: '#fff' }}>
            Approve for work and play
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
