'use client'
import { useEffect } from 'react'

/**
 * Simple toast notification component
 * @param {string} message - Message to display
 * @param {string} type - 'info' | 'success' | 'error' | 'warning'
 * @param {function} onClose - Callback when toast closes
 * @param {number} duration - Auto-close duration in ms (0 = don't auto-close)
 */
export default function Toast({ message, type = 'info', onClose, duration = 0 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const colors = {
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
    warning: { bg: '#fefce8', border: '#fde047', text: '#854d0e' }
  }

  const style = colors[type] || colors.info
  
  // Show loading animation for info type
  const showLoading = type === 'info'

  return (
    <>
      <style>{`
        @keyframes rotateClockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes rotateCounterClockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        .gear-large {
          animation: rotateClockwise 3s linear infinite;
          transform-origin: center;
        }
        .gear-small {
          animation: rotateCounterClockwise 2s linear infinite;
          transform-origin: center;
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '16px 24px',
        background: style.bg,
        border: `2px solid ${style.border}`,
        borderRadius: 12,
        color: style.text,
        fontWeight: 600,
        fontSize: 16,
        maxWidth: 500,
        minWidth: 300,
        textAlign: 'center',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexDirection: 'column'
      }}>
        {showLoading && (
          <svg width="60" height="60" viewBox="0 0 60 60" style={{ flexShrink: 0 }}>
            {/* Large gear */}
            <g className="gear-large">
              <circle cx="30" cy="30" r="12" fill="none" stroke={style.text} strokeWidth="2"/>
              <circle cx="30" cy="30" r="6" fill={style.text}/>
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
                const rad = (angle * Math.PI) / 180
                const x1 = 30 + Math.cos(rad) * 12
                const y1 = 30 + Math.sin(rad) * 12
                const x2 = 30 + Math.cos(rad) * 16
                const y2 = 30 + Math.sin(rad) * 16
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={style.text}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                )
              })}
            </g>
            {/* Small gear - positioned to mesh with large gear */}
            <g className="gear-small" transform="translate(40, 10)">
              <circle cx="10" cy="10" r="7" fill="none" stroke={style.text} strokeWidth="1.5"/>
              <circle cx="10" cy="10" r="3.5" fill={style.text}/>
              {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                const rad = (angle * Math.PI) / 180
                const x1 = 10 + Math.cos(rad) * 7
                const y1 = 10 + Math.sin(rad) * 7
                const x2 = 10 + Math.cos(rad) * 9.5
                const y2 = 10 + Math.sin(rad) * 9.5
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={style.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )
              })}
            </g>
          </svg>
        )}
        <div style={{ flex: 1 }}>{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: style.text,
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
            padding: 0,
            opacity: 0.7
          }}
          aria-label="Close"
        >
          ×
        </button>
      )}
      </div>
    </>
  )
}
