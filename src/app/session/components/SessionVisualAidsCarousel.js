'use client'
import { useState, useRef, useEffect } from 'react'

/**
 * SessionVisualAidsCarousel - Full-screen carousel for displaying visual aids during lesson session
 * Shows visual aids with Explain button that triggers Ms. Sonoma to describe the image
 */
export default function SessionVisualAidsCarousel({ 
  visualAids = [], 
  onClose, 
  onExplain,
  videoRef,
  isSpeaking = false
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [explaining, setExplaining] = useState(false)
  const miniVideoRef = useRef(null)

  // Sync mini video playback with isSpeaking state
  useEffect(() => {
    if (!miniVideoRef.current) return

    if (isSpeaking) {
      miniVideoRef.current.play().catch(() => {})
    } else {
      miniVideoRef.current.pause()
      miniVideoRef.current.currentTime = 0
    }
  }, [isSpeaking])

  const goNext = () => {
    if (currentIndex < visualAids.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleExplain = async () => {
    if (explaining || !onExplain) return
    
    setExplaining(true)
    const currentAid = visualAids[currentIndex]
    
    try {
      await onExplain(currentAid)
    } finally {
      setExplaining(false)
    }
  }

  if (!visualAids || visualAids.length === 0) {
    return null
  }

  const currentAid = visualAids[currentIndex]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.95)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 2000,
      height: '100vh',
      overflow: 'hidden'
    }}>
      {/* Close button - upper right */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(0, 0, 0, 0.7)',
          border: 'none',
          fontSize: 32,
          cursor: 'pointer',
          color: '#fff',
          lineHeight: 1,
          padding: 8,
          width: 48,
          height: 48,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}
      >
        ×
      </button>

      {/* Full-screen image container */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: 20,
        overflow: 'visible',
        minHeight: 0,
        height: '100%'
      }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: 'calc(100% - 140px)',
          maxHeight: '100%',
          height: '100%'
        }}>
          <img
            src={currentAid.url}
            alt={currentAid.description || `Visual aid ${currentIndex + 1}`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
          />
          
          {/* Explain button - positioned just to the right of the image */}
          <div style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alignItems: 'center',
            marginLeft: 20
          }}>
            <button
              onClick={handleExplain}
              disabled={explaining}
              style={{
                padding: 0,
                background: 'transparent',
                color: '#fff',
                border: '3px solid #3b82f6',
                borderRadius: 12,
                cursor: explaining ? 'wait' : 'pointer',
                fontWeight: 700,
                fontSize: 16,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflow: 'hidden',
                position: 'relative',
                width: 120,
                height: 120
              }}
            >
              {/* Ms. Sonoma video background */}
              {videoRef && videoRef.current && (
                <video
                  ref={miniVideoRef}
                  src="/media/ms-sonoma-3.mp4"
                  muted
                  loop
                  playsInline
                  preload="auto"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    opacity: explaining ? 0.6 : 1
                  }}
                />
              )}
              {/* Explain text overlay */}
              <span style={{
                position: 'relative',
                zIndex: 1,
                textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.4)',
                borderRadius: 8,
                marginTop: 'auto',
                marginBottom: 8,
                fontSize: 14
              }}>
                {explaining ? 'Explaining...' : 'Explain'}
              </span>
            </button>
            {visualAids.length > 1 && (
              <div style={{
                color: '#9ca3af',
                fontSize: 14,
                fontWeight: 600,
                textAlign: 'center'
              }}>
                {currentIndex + 1} of {visualAids.length}
              </div>
            )}
          </div>
        </div>
        
        {/* Left arrow */}
        {currentIndex > 0 && (
          <button
            onClick={goPrev}
            aria-label="Previous"
            style={{
              position: 'absolute',
              left: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: 56,
              height: 56,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 10
            }}
          >
            ‹
          </button>
        )}
        
        {/* Right arrow */}
        {currentIndex < visualAids.length - 1 && (
          <button
            onClick={goNext}
            aria-label="Next"
            style={{
              position: 'absolute',
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: 56,
              height: 56,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 10
            }}
          >
            ›
          </button>
        )}
      </div>
    </div>
  )
}
