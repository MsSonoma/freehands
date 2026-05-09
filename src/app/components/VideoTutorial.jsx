'use client'
import { useState, useRef, useEffect } from 'react'

/**
 * VideoTutorial – reusable video thumbnail that opens a floating,
 * repositionable overlay.
 *
 * Props:
 *   src       {string}  – video path (public URL)
 *   title     {string}  – overlay header title
 *   label     {string}  – small caption under the thumbnail
 *   thumbTime {number}  – seconds into the video to use as thumbnail (default 1)
 *   width     {number}  – thumbnail width in px (default 160)
 */
export default function VideoTutorial({
  src,
  title = 'Tutorial',
  label,
  thumbTime = 1,
  width = 160,
  autoOpen = false,
}) {
  const height = Math.round(width * (9 / 16))
  const [open, setOpen] = useState(autoOpen)
  const [side, setSide] = useState('right') // 'left' | 'right'
  const [fullscreen, setFullscreen] = useState(false)
  const [thumbUrl, setThumbUrl] = useState(null)
  const videoRef = useRef(null)
  const overlayVideoRef = useRef(null)

  // Extract thumbnail frame from video via canvas
  useEffect(() => {
    if (!src) return
    const vid = document.createElement('video')
    vid.src = src
    vid.muted = true
    vid.preload = 'metadata'
    vid.addEventListener('loadedmetadata', () => {
      vid.currentTime = Math.min(thumbTime, vid.duration - 0.01 || thumbTime)
    })
    vid.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = vid.videoWidth || 320
        canvas.height = vid.videoHeight || 180
        canvas.getContext('2d').drawImage(vid, 0, 0, canvas.width, canvas.height)
        setThumbUrl(canvas.toDataURL('image/jpeg', 0.85))
      } catch {
        // cross-origin or decode error – fallback to no thumbnail
      }
    })
    vid.load()
  }, [src, thumbTime])

  // Auto-play when opened via autoOpen prop
  useEffect(() => {
    if (autoOpen) setTimeout(() => overlayVideoRef.current?.play(), 200)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpen = () => {
    setOpen(true)
    setTimeout(() => overlayVideoRef.current?.play(), 120)
  }

  const handleClose = () => {
    setOpen(false)
    if (overlayVideoRef.current) {
      overlayVideoRef.current.pause()
      overlayVideoRef.current.currentTime = 0
    }
  }

  // Keyboard: Esc closes
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const panelStyle = fullscreen
    ? {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: '#000', display: 'flex', flexDirection: 'column',
        zIndex: 10000,
      }
    : {
        position: 'fixed',
        top: '50%',
        transform: 'translateY(-50%)',
        [side === 'left' ? 'left' : 'right']: 16,
        width: 'min(440px, 94vw)',
        background: '#111827',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
      }

  return (
    <>
      {/* ── Thumbnail button ── */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Watch tutorial: ${title}`}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'relative',
          width,
          height,
          borderRadius: 10,
          overflow: 'hidden',
          border: '2px solid #c4b5fd',
          boxShadow: '0 2px 10px rgba(79,70,229,0.18)',
          background: thumbUrl
            ? `url(${thumbUrl}) center/cover no-repeat`
            : 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)',
          flexShrink: 0,
        }}>
          {/* Hover-effect darkener */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.18)',
            transition: 'background 0.15s',
          }} />
          {/* Play button */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 40, height: 40,
              background: 'rgba(255,255,255,0.92)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 12px rgba(0,0,0,0.35)',
            }}>
              <span style={{ fontSize: 15, marginLeft: 3, color: '#4f46e5' }}>▶</span>
            </div>
          </div>
        </div>
        {label && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#7c3aed',
            letterSpacing: '0.03em', textTransform: 'uppercase',
          }}>
            {label}
          </span>
        )}
      </button>

      {/* ── Video overlay ── */}
      {open && (
        <>
          {/* Dim backdrop (only in non-fullscreen so user can see the page behind) */}
          {!fullscreen && (
            <div
              onClick={handleClose}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.4)',
                zIndex: 9999,
              }}
            />
          )}

          <div style={panelStyle} onClick={e => e.stopPropagation()}>
            {/* Toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 10px',
              background: '#0f172a',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{
                flex: 1, color: '#c7d2fe', fontSize: 13, fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                🎬 {title}
              </span>
              {/* Position controls (hidden in fullscreen) */}
              {!fullscreen && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setSide('left')}
                    title="Move to left side"
                    style={toolbarBtn(side === 'left')}
                  >◀ Left</button>
                  <button
                    type="button"
                    onClick={() => setSide('right')}
                    title="Move to right side"
                    style={toolbarBtn(side === 'right')}
                  >Right ▶</button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setFullscreen(f => !f)}
                title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                style={toolbarBtn(fullscreen)}
              >{fullscreen ? '⊡ Exit' : '⛶'}</button>
              <button
                type="button"
                onClick={handleClose}
                title="Close"
                style={{ ...toolbarBtn(false), color: '#fca5a5' }}
              >✕</button>
            </div>

            {/* Video element */}
            <video
              ref={overlayVideoRef}
              src={src}
              controls
              playsInline
              style={{
                width: '100%',
                flex: 1,
                display: 'block',
                minHeight: 0,
                background: '#000',
                objectFit: fullscreen ? 'contain' : 'cover',
                maxHeight: fullscreen ? undefined : '56.25vw', // keep 16:9 in panel mode
              }}
            />
          </div>
        </>
      )}
    </>
  )
}

function toolbarBtn(active) {
  return {
    background: active ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)',
    border: '1px solid ' + (active ? '#818cf8' : 'rgba(255,255,255,0.12)'),
    borderRadius: 6,
    color: active ? '#c7d2fe' : '#94a3b8',
    padding: '3px 8px',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    lineHeight: 1.6,
  }
}
