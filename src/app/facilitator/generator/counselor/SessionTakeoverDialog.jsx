// Session Takeover Dialog - requires PIN to take over Mr. Mentor session from another device
'use client'

import { useState } from 'react'

export default function SessionTakeoverDialog({ 
  existingSession, 
  onTakeover, 
  onCancel, 
  onForceEnd 
}) {
  const [pinCode, setPinCode] = useState('')
  const [error, setError] = useState('')
  const [loadingAction, setLoadingAction] = useState(null)

  const isBusy = loadingAction !== null

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (pinCode.length !== 4) {
      setError('PIN must be 4 digits')
      return
    }

    setError('')
    setLoadingAction('takeover')

    try {
      await onTakeover(pinCode)
    } catch (err) {
      setError(err.message || 'Failed to take over session')
      setLoadingAction(null)
    }
  }

  const handleForceEnd = async () => {
    if (pinCode.length !== 4) {
      setError('PIN must be 4 digits')
      return
    }

    if (!onForceEnd) {
      return
    }

    setError('')
    setLoadingAction('force')

    try {
      await onForceEnd(pinCode)
    } catch (err) {
      setError(err.message || 'Failed to end session')
      setLoadingAction(null)
    }
  }

  const formatLastActivity = (isoString) => {
    if (!isoString) return 'Unknown'
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString()
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: 20
      }}
      onClick={onCancel}
    >
      <div 
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 32,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1f2937' }}>
          🔒 Session Active on Another Device
        </div>
        
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.5 }}>
          Mr. Mentor is currently active on <strong>{existingSession?.device_name || 'another device'}</strong>.
          {existingSession?.last_activity_at && (
            <div style={{ marginTop: 8 }}>
              Last activity: {formatLastActivity(existingSession.last_activity_at)}
            </div>
          )}
        </div>

        <div style={{ 
          background: '#fffbeb', 
          border: '1px solid #fbbf24',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          fontSize: 13,
          color: '#92400e',
          lineHeight: 1.5
        }}>
          <strong>⚠️ Taking over this session will:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
            <li>End the session on the other device</li>
            <li>Continue the conversation here</li>
            <li>Preserve all conversation history</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Enter your 4-digit PIN to continue:
          </label>
          
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pinCode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '')
              setPinCode(val)
              setError('')
            }}
            placeholder="••••"
            disabled={isBusy}
            autoFocus
            style={{
              width: '100%',
              padding: 12,
              fontSize: 18,
              letterSpacing: '0.5em',
              textAlign: 'center',
              border: error ? '2px solid #ef4444' : '2px solid #d1d5db',
              borderRadius: 8,
              marginBottom: 12,
              outline: 'none',
              transition: 'border-color 0.2s',
              backgroundColor: isBusy ? '#f9fafb' : '#fff'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => {
              if (!error) e.target.style.borderColor = '#d1d5db'
            }}
          />

          {error && (
            <div style={{ 
              color: '#dc2626', 
              fontSize: 13, 
              marginBottom: 16,
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              style={{
                flex: 1,
                padding: '12px 20px',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                border: '2px solid #d1d5db',
                background: '#fff',
                color: '#6b7280',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isBusy || pinCode.length !== 4}
              style={{
                flex: 1,
                padding: '12px 20px',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                background: (isBusy || pinCode.length !== 4) ? '#9ca3af' : '#2563eb',
                color: '#fff',
                cursor: (isBusy || pinCode.length !== 4) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {loadingAction === 'takeover' ? 'Taking Over...' : 'Take Over Session'}
            </button>
          </div>
        </form>

        {onForceEnd && (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={handleForceEnd}
              disabled={isBusy || pinCode.length !== 4}
              style={{
                width: '100%',
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                border: '2px solid #f97316',
                background: '#fff7ed',
                color: '#c2410c',
                cursor: (isBusy || pinCode.length !== 4) ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              {loadingAction === 'force' ? 'Force Ending...' : 'Force End Session'}
            </button>

            <div style={{
              marginTop: 8,
              fontSize: 12,
              color: '#7c2d12',
              lineHeight: 1.4
            }}>
              Use this if the other device is frozen and will not release.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
