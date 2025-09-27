'use client'
import { useEffect, useState } from 'react'

export default function LoadingProgress({ isLoading, onComplete }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setProgress(0)
      return
    }

    // Simulate natural loading progression
    const intervals = [
      { delay: 100, target: 15 },
      { delay: 300, target: 35 },
      { delay: 500, target: 55 },
      { delay: 800, target: 75 },
      { delay: 1200, target: 90 },
      { delay: 1800, target: 95 }
    ]

    const timeouts = []
    
    intervals.forEach(({ delay, target }) => {
      const timeout = setTimeout(() => {
        setProgress(target)
      }, delay)
      timeouts.push(timeout)
    })

    // Complete after reasonable time if not manually completed
    const completeTimeout = setTimeout(() => {
      setProgress(100)
      if (onComplete) {
        setTimeout(onComplete, 200) // Brief delay to show 100%
      }
    }, 3000)
    timeouts.push(completeTimeout)

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [isLoading, onComplete])

  // Allow external completion
  useEffect(() => {
    if (!isLoading && progress > 0) {
      setProgress(100)
      if (onComplete) {
        setTimeout(onComplete, 200)
      }
    }
  }, [isLoading, progress, onComplete])

  if (!isLoading && progress === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(4px)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh'
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: '0 0 8px', color: '#1f2937' }}>
          Preparing Your Lesson
        </h3>
        <p style={{ margin: 0, color: '#6b7280' }}>
          Setting up your learning session with Ms. Sonoma...
        </p>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '400px',
        height: '8px',
        background: '#e5e7eb',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '12px'
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
          borderRadius: '4px',
          width: `${progress}%`,
          transition: 'width 0.3s ease-out',
          boxShadow: progress > 0 ? '0 0 8px rgba(59, 130, 246, 0.3)' : 'none'
        }} />
      </div>

      <div style={{
        color: '#6b7280',
        fontSize: 'clamp(0.9rem, 1.6vw, 1rem)',
        fontWeight: '500'
      }}>
        {progress}%
      </div>
    </div>
  )
}