"use client"
import React from 'react'

export default function SpinnerScreen({ show = false, label = 'Loading...', backdrop = 'light', fullscreen = true }) {
  if (!show) return null
  const bg = backdrop === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.95)'
  const color = backdrop === 'dark' ? '#fff' : '#1f2937'
  return (
    <div style={{
      position: fullscreen ? 'fixed' : 'absolute',
      inset: 0,
      zIndex: 9999,
      display: 'grid',
      placeItems: 'center',
      background: bg,
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className="ms-spinner-legacy" aria-hidden="true">
          <div className="ms-spinner" role="status" aria-label="Loading" />
        </div>
        {label ? (
          <div style={{ color, fontSize: 'clamp(0.95rem, 1.6vw, 1rem)', fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
        ) : null}
      </div>
    </div>
  )
}
