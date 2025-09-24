'use client'
import { useEffect, useState } from 'react'

// Simple in-page PIN prompt for facilitator actions.
// - If a PIN exists in localStorage (facilitator_pin), prompts for it and validates.
// - If no PIN exists, allows setting a new one (with confirm) before proceeding.
// Props:
// - onSuccess: () => void  (called after successful verify/set)
// - onCancel: () => void   (called when dismissed)
export default function FacilitatorPinPrompt({ onSuccess, onCancel }) {
  const [hasPin, setHasPin] = useState(false)
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('facilitator_pin')
      setHasPin(Boolean(stored))
    } catch { setHasPin(false) }
  }, [])

  const verify = () => {
    try {
      const stored = localStorage.getItem('facilitator_pin') || ''
      if (!stored) { setHasPin(false); return }
      if (pin === stored) {
        setError('')
        onSuccess?.()
      } else {
        setError('Incorrect password. Please try again.')
      }
    } catch {
      onSuccess?.()
    }
  }

  const setup = () => {
    if (!newPin || newPin.length < 4) {
      setError('Please enter at least 4 characters.')
      return
    }
    if (newPin !== confirmPin) {
      setError('Passwords do not match.')
      return
    }
    try {
      localStorage.setItem('facilitator_pin', newPin)
      setError('')
      onSuccess?.()
    } catch {
      onSuccess?.()
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'grid', placeItems:'center', zIndex:50 }}>
      <div role="dialog" aria-modal="true" style={{ width:'100%', maxWidth:360, background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:16, boxShadow:'0 8px 30px rgba(0,0,0,0.12)' }}>
        <h3 style={{ margin:'0 0 8px' }}>{hasPin ? 'Facilitator Password' : 'Set Facilitator Password'}</h3>
        {hasPin ? (
          <form onSubmit={(e)=>{ e.preventDefault(); verify(); }}>
            {/* Hidden username field for accessibility and autofill context */}
            <input type="text" name="username" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ position:'absolute', width:1, height:1, padding:0, border:0, clip:'rect(0 0 0 0)', clipPath:'inset(50%)', overflow:'hidden', whiteSpace:'nowrap' }} />
            <label style={{ display:'block', marginBottom:8 }}>
              <span style={{ display:'block', fontSize:12, color:'#6b7280', marginBottom:4 }}>Enter password</span>
              <input
                type="password"
                value={pin}
                onChange={e=>setPin(e.target.value)}
                autoComplete="current-password"
                name="facilitator-current-password"
                style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}
              />
            </label>
            {error && <div role="alert" style={{ color:'#b91c1c', fontSize:12, marginBottom:8 }}>{error}</div>}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" onClick={onCancel} style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}>Cancel</button>
              <button type="submit" style={{ padding:'8px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}>Confirm</button>
            </div>
          </form>
        ) : (
          <form onSubmit={(e)=>{ e.preventDefault(); setup(); }}>
            {/* Hidden username field for accessibility and autofill context */}
            <input type="text" name="username" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ position:'absolute', width:1, height:1, padding:0, border:0, clip:'rect(0 0 0 0)', clipPath:'inset(50%)', overflow:'hidden', whiteSpace:'nowrap' }} />
            <label style={{ display:'block', marginBottom:8 }}>
              <span style={{ display:'block', fontSize:12, color:'#6b7280', marginBottom:4 }}>New password (min 4 chars)</span>
              <input
                type="password"
                value={newPin}
                onChange={e=>setNewPin(e.target.value)}
                autoComplete="new-password"
                name="facilitator-new-password"
                minLength={4}
                style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}
              />
            </label>
            <label style={{ display:'block', marginBottom:8 }}>
              <span style={{ display:'block', fontSize:12, color:'#6b7280', marginBottom:4 }}>Confirm password</span>
              <input
                type="password"
                value={confirmPin}
                onChange={e=>setConfirmPin(e.target.value)}
                autoComplete="new-password"
                name="facilitator-confirm-password"
                minLength={4}
                style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}
              />
            </label>
            {error && <div role="alert" style={{ color:'#b91c1c', fontSize:12, marginBottom:8 }}>{error}</div>}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" onClick={onCancel} style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}>Cancel</button>
              <button type="submit" style={{ padding:'8px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}>Save & Continue</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
