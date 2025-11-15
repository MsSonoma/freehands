"use client"
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { getPinPrefsLocal, setPinPrefsLocal } from '@/app/lib/pinGate'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'
import { useRouter } from 'next/navigation'

export default function FacilitatorAccountPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true })
  const [loading, setLoading] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [facilitatorName, setFacilitatorName] = useState('')
  const [serverFacilitatorName, setServerFacilitatorName] = useState('')
  const [nameMessage, setNameMessage] = useState('')
  const [email, setEmail] = useState('')
  // Two-factor (TOTP)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [enrollingMfa, setEnrollingMfa] = useState(null) // { factorId, qr, uri, secret }
  const [mfaCode, setMfaCode] = useState('')
  const [mfaMessage, setMfaMessage] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  // Connected accounts (Google)
  const [googleLinked, setGoogleLinked] = useState(false)
  const [linkMsg, setLinkMsg] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)

  // Uniform primary button style for key CTAs
  const primaryBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    width: 180,
    padding: '0 12px',
    border: '1px solid #111',
    borderRadius: 8,
    background: '#111',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    textDecoration: 'none',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setEmail(session.user.email || '')
          // Load display name from profiles.first, falling back to auth user metadata
          let loadedName = ''
          try {
            const { data: profRow } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', session.user.id)
              .maybeSingle()
            if (profRow && typeof profRow.full_name === 'string' && profRow.full_name.trim()) {
              loadedName = profRow.full_name.trim()
            }
          } catch {
            // profiles table or column may not exist yet; ignore and fall back
          }
          if (!loadedName) {
            const meta = session?.user?.user_metadata || {}
            loadedName = (meta.full_name || meta.display_name || meta.name || '').trim()
          }
          if (!cancelled) {
            setFacilitatorName(loadedName)
            setServerFacilitatorName(loadedName)
            // Marketing opt-in moved to Settings page
            // Connected accounts (Google)
            const identities = Array.isArray(session.user.identities) ? session.user.identities : []
            const hasGoogle = identities.some(id => id?.provider === 'google')
            setGoogleLinked(hasGoogle)
            // MFA status
            try {
              const { data: factors } = await supabase.auth.mfa.listFactors()
              const activeTotp = factors?.totp?.active || []
              setMfaEnabled(activeTotp.length > 0)
            } catch {
              // MFA may be unavailable or not configured; ignore
            }
          }
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // If we just came back from an OAuth linking redirect, refresh identities and clean the URL
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (typeof window === 'undefined') return
        const url = new URL(window.location.href)
        if (url.searchParams.has('rts')) {
          const supabase = getSupabaseClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!cancelled) {
            const identities = Array.isArray(user?.identities) ? user.identities : []
            const hasGoogle = identities.some(id => id?.provider === 'google')
            setGoogleLinked(hasGoogle)
          }
          url.searchParams.delete('rts')
          window.history.replaceState(null, '', url.toString())
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  if (authLoading || loading) {
    return <main style={{ padding: 7 }}><p>Loading…</p></main>
  }

  return (
    <>
      <main style={{ padding: 7, opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
      <div style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ marginTop: 0, marginBottom: 3, textAlign: 'left' }}>Account</h1>
        <p style={{ color: '#555', marginTop: 0, marginBottom: 5, textAlign: 'left' }}>Manage your profile and sign-in details.</p>

        {/* Profile name */}
  <section style={{ marginTop: 12 }}>
          <h2 style={{ fontSize: 18, margin: '2px 0' }}>Your name</h2>
          <p style={{ color: '#555', marginTop: 0 }}>Shown on your Facilitator page as a friendly greeting.</p>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={facilitatorName}
                onChange={e => { setFacilitatorName(e.target.value); setNameMessage('') }}
                placeholder="Enter your name"
                style={{ padding: '3px 9px', border: '1px solid #e5e7eb', borderRadius: 8, width: 280 }}
              />
              <button
                onClick={async () => {
                  setSavingName(true); setNameMessage('')
                  try {
                    const supabase = getSupabaseClient()
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session?.user) { setNameMessage('Please sign in.'); setSavingName(false); return }
                    // First, try updating profiles.full_name (authoritative in our schema)
                    let saved = false
                    try {
                      const { error: pErr } = await supabase
                        .from('profiles')
                        .update({ full_name: facilitatorName })
                        .eq('id', session.user.id)
                      if (!pErr) saved = true
                    } catch {}

                    // If profiles update failed due to schema mismatch, try other common columns
                    if (!saved) {
                      const tryUpdate = async (payload) => {
                        const { error } = await supabase.from('profiles').update(payload).eq('id', session.user.id)
                        return !error
                      }
                      saved = await tryUpdate({ display_name: facilitatorName }) ||
                              await tryUpdate({ name: facilitatorName })
                    }

                    // Always attempt to keep auth user metadata in sync (best-effort)
                    try {
                      await supabase.auth.updateUser({ data: { full_name: facilitatorName, display_name: facilitatorName, name: facilitatorName } })
                    } catch {}

                    if (!saved) throw new Error('Could not save name')

                    setServerFacilitatorName(facilitatorName)
                    setNameMessage('Saved!')
                    try {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('ms:profile:name:updated', { detail: { name: facilitatorName } }))
                      }
                    } catch {}
                  } catch (e) {
                    setNameMessage(e?.message || 'Failed to save')
                  } finally { setSavingName(false) }
                }}
                disabled={savingName || facilitatorName === serverFacilitatorName}
                style={{ padding: '3px 11px', border: '1px solid #111', borderRadius: 8, background: '#111', color: '#fff', fontWeight: 600 }}
              >
                {savingName ? 'Saving…' : 'Save'}
              </button>
              {nameMessage && <span style={{ color: '#374151' }}>{nameMessage}</span>}
            </div>
          )}
        </section>

        {/* Email + password */}
  <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18, margin: '3px 0' }}>Sign-in</h2>
          <div style={{ color: '#555', marginBottom: 3 }}>Email: <strong style={{ color: '#111' }}>{email || '—'}</strong></div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <a href="/auth/update-password" style={primaryBtnStyle}>Change password</a>
          </div>
        </section>

        {/* Marketing opt-in moved to Settings page */}

        {/* Two-factor authentication */}
  <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18, margin: '3px 0' }}>Two-factor authentication</h2>
          <p style={{ color: '#555', marginTop: 0, marginBottom: 2 }}>Add an extra layer of security to your account using an authenticator app.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {!mfaEnabled && !enrollingMfa && (
              <button
                onClick={async () => {
                  setMfaBusy(true); setMfaMessage('')
                  try {
                    const supabase = getSupabaseClient()
                    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
                    if (error) throw error
                    const factorId = data?.id
                    const qr = data?.totp?.qr_code || null
                    const uri = data?.totp?.uri || null
                    const secret = data?.totp?.secret || null
                    setEnrollingMfa({ factorId, qr, uri, secret })
                  } catch (e) {
                    setMfaMessage(e?.message || 'Unable to start enrollment')
                  } finally { setMfaBusy(false) }
                }}
                disabled={mfaBusy}
                style={{ ...primaryBtnStyle, alignSelf: 'flex-start' }}
              >
                Enable two-factor
              </button>
            )}

            {enrollingMfa && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 5 }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                  {enrollingMfa.qr ? (
                    <img src={enrollingMfa.qr} alt="Scan QR code" style={{ width: 140, height: 140 }} />
                  ) : (
                    enrollingMfa.uri ? <a href={enrollingMfa.uri} target="_blank" rel="noreferrer">Open authenticator</a> : <div />
                  )}
                  <div style={{ color: '#555' }}>
                    Scan with your authenticator app, then enter the 6-digit code to verify.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => { setMfaCode(e.target.value); setMfaMessage('') }}
                    style={{ padding: '3px 9px', border: '1px solid #e5e7eb', borderRadius: 8, width: 118 }}
                  />
                  <button
                    onClick={async () => {
                      setMfaBusy(true); setMfaMessage('')
                      try {
                        const supabase = getSupabaseClient()
                        const { error } = await supabase.auth.mfa.verify({ factorId: enrollingMfa.factorId, code: mfaCode })
                        if (error) throw error
                        setMfaEnabled(true)
                        setEnrollingMfa(null)
                        setMfaCode('')
                        setMfaMessage('Two-factor enabled')
                      } catch (e) {
                        setMfaMessage(e?.message || 'Verification failed')
                      } finally { setMfaBusy(false) }
                    }}
                    disabled={mfaBusy || !mfaCode || mfaCode.length < 6}
                    style={{ padding: '3px 11px', border: '1px solid #111', borderRadius: 8, background: '#111', color: '#fff', fontWeight: 600 }}
                  >
                    Verify code
                  </button>
                  <button
                    onClick={() => { setEnrollingMfa(null); setMfaCode(''); setMfaMessage('Enrollment canceled') }}
                    disabled={mfaBusy}
                    style={{ padding: '3px 11px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {mfaEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                <span style={{ color: '#0a7f27', fontWeight: 600 }}>Two-factor is enabled</span>
                <button
                  onClick={async () => {
                    setMfaBusy(true); setMfaMessage('')
                    try {
                      const supabase = getSupabaseClient()
                      const { data: factors } = await supabase.auth.mfa.listFactors()
                      const active = factors?.totp?.active || []
                      if (!active.length) { setMfaEnabled(false); return }
                      const factorId = active[0]?.id
                      const { error } = await supabase.auth.mfa.unenroll({ factorId })
                      if (error) throw error
                      setMfaEnabled(false)
                      setMfaMessage('Two-factor disabled')
                    } catch (e) {
                      setMfaMessage(e?.message || 'Unable to disable two-factor')
                    } finally { setMfaBusy(false) }
                  }}
                  disabled={mfaBusy}
                  style={{ padding: '3px 11px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111', fontWeight: 600 }}
                >
                  Disable two-factor
                </button>
              </div>
            )}
            {mfaMessage && <span style={{ color: '#374151' }}>{mfaMessage}</span>}
          </div>
        </section>

        {/* Facilitator PIN */}
        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18, margin: '3px 0' }}>Facilitator PIN</h2>
          <p style={{ color:'#555', marginTop: 0, fontSize: 14, lineHeight: 1.35 }}>
            Protect sensitive actions like skipping or downloading. This PIN is saved to your account.
          </p>
          <PinManager email={email} />
        </section>

        {/* Connected accounts */}
  <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18, margin: '3px 0' }}>Connected accounts</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 140 }}>
              <strong>Google</strong>
              <span style={{ marginLeft: 8, color: googleLinked ? '#0a7f27' : '#6b7280' }}>{googleLinked ? 'Linked' : 'Not linked'}</span>
            </div>
            {!googleLinked ? (
              <button
                onClick={async () => {
                  setLinkBusy(true); setLinkMsg('')
                  try {
                    const supabase = getSupabaseClient()
                    const redirectTo = `${window.location.origin}/facilitator/account?rts=${Date.now()}`
                    if (typeof supabase.auth.linkIdentity === 'function') {
                      const { data, error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo } })
                      if (error) throw error
                      const url = data?.url
                      if (url) { window.location.assign(url); return }
                      // Some environments may redirect automatically
                    } else {
                      // Fallback attempt (might not link in older backends)
                      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
                      if (error) throw error
                      const url = data?.url
                      if (url) { window.location.assign(url); return }
                    }
                    setLinkMsg('Follow the Google flow to complete linking…')
                  } catch (e) {
                    setLinkMsg(e?.message || 'Unable to start Google linking')
                  } finally { setLinkBusy(false) }
                }}
                disabled={linkBusy}
                style={primaryBtnStyle}
              >
                Link Google
              </button>
            ) : (
              <button
                onClick={async () => {
                  setLinkBusy(true); setLinkMsg('')
                  try {
                    const supabase = getSupabaseClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    const identities = Array.isArray(user?.identities) ? user.identities : []
                    const goog = identities.find(id => id?.provider === 'google')
                    if (!goog) { setGoogleLinked(false); return }
                    if (typeof supabase.auth.unlinkIdentity === 'function') {
                      const { error } = await supabase.auth.unlinkIdentity({ identity_id: goog.id })
                      if (error) throw error
                      setGoogleLinked(false)
                      setLinkMsg('Google unlinked')
                    } else {
                      setLinkMsg('Unlink not supported in this version')
                    }
                  } catch (e) {
                    setLinkMsg(e?.message || 'Unable to unlink Google')
                  } finally { setLinkBusy(false) }
                }}
                disabled={linkBusy}
                style={{ padding: '3px 11px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111', fontWeight: 600 }}
              >
                Unlink Google
              </button>
            )}
            {linkMsg && <span style={{ color: '#374151' }}>{linkMsg}</span>}
          </div>
          <p style={{ color: '#555', marginTop: 3 }}>Need to permanently delete your account? Use the Danger zone in Settings (see below).</p>
        </section>

        {/* Navigation to Plan and Settings */}
        <section style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ fontSize: 18, margin: '3px 0' }}>Account Management</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <a
              href="/facilitator/account/plan"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                background: '#fff',
                color: '#111',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
              }}
            >
              Plan
            </a>
            <a
              href="/facilitator/account/settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                background: '#fff',
                color: '#111',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
              }}
            >
              Settings
            </a>
          </div>
        </section>

        {/* Logout button */}
        <section style={{ marginTop: 16 }}>
          <button
            onClick={async () => {
              const supabase = getSupabaseClient();
              try { 
                await supabase?.auth?.signOut?.();
                // Clear session storage on logout
                try {
                  sessionStorage.removeItem('facilitator_section_active');
                } catch (e) {}
              } catch (e) {}
              router.push('/auth/login')
            }}
            style={{
              padding: '10px 20px',
              background: '#111',
              color: '#fff',
              border: '1px solid #111',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
              width: '100%'
            }}
          >
            Logout
          </button>
        </section>
      </div>
    </main>
    
    <GatedOverlay
      show={!isAuthenticated}
      gateType={gateType}
      feature="Account Management"
      emoji="👤"
      description="Sign in to manage your account settings, security preferences, and connected services."
      benefits={[
        'Manage your profile and display name',
        'Set up two-factor authentication',
        'Configure PIN protection for sensitive actions',
        'Link and manage connected accounts (Google, etc.)'
      ]}
    />
    </>
  )
}


function PinManager({ email }) {
  const [loading, setLoading] = useState(true)
  const [hasPin, setHasPin] = useState(false)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [prefs, setPrefs] = useState(() => getPinPrefsLocal())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        // Fetch PIN status from server only
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error('Sign in required')
        const res = await fetch('/api/facilitator/pin', { headers: { Authorization: `Bearer ${token}` } })
        const js = await res.json().catch(()=>({}))
        if (res.ok && js?.ok) {
          if (!cancelled) {
            setHasPin(!!js.hasPin)
            if (js.prefs && typeof js.prefs === 'object') setPrefs(prev => ({ ...prev, ...js.prefs }))
          }
        } else {
          // API failed - no PIN
          if (!cancelled) {
            setHasPin(false)
            setPrefs(getPinPrefsLocal())
          }
        }
      } catch (e) {
        // Error fetching - no PIN
        if (!cancelled) {
          setHasPin(false)
          setPrefs(getPinPrefsLocal())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { setLoading(false); cancelled = true }
  }, [])

  const save = async () => {
    setMsg(''); setSaving(true)
    try {
      if (!pin || pin.length < 4 || pin.length > 8 || /\D/.test(pin)) throw new Error('Use a 4–8 digit PIN')
      if (pin !== pin2) throw new Error('PINs do not match')
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sign in required')
      const res = await fetch('/api/facilitator/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin, currentPin: hasPin ? currentPin : null, prefs })
      })
      const js = await res.json().catch(()=>({}))
      if (!res.ok || !js?.ok) throw new Error(js?.error || 'Failed to save')
      setHasPin(true)
      setMsg('Saved!')
      setPin(''); setPin2(''); setCurrentPin('')
    } catch (e) {
      setMsg(e?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  const clear = async () => {
    setMsg(''); setSaving(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sign in required')
      const res = await fetch('/api/facilitator/pin', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const js = await res.json().catch(()=>({}))
      if (!res.ok || !js?.ok) throw new Error(js?.error || 'Failed to clear')
      setHasPin(false)
      setMsg('Cleared')
      setPin(''); setPin2(''); setCurrentPin('')
    } catch (e) {
      setMsg(e?.message || 'Failed to clear')
    } finally { setSaving(false) }
  }

  const handleSave = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    setMsg(''); setSaving(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sign in required')

      const pinChange = (pin && pin.length) || (pin2 && pin2.length)
      if (pinChange) {
        if (!/^\d{4,8}$/.test(pin)) throw new Error('Use a 4–8 digit PIN')
        if (pin !== pin2) throw new Error('PINs do not match')
        const res = await fetch('/api/facilitator/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pin, currentPin: hasPin ? currentPin : null, prefs })
        })
        const js = await res.json().catch(()=>({}))
        if (!res.ok || !js?.ok) {
          const errorMsg = js?.error || `Failed to save (${res.status})`
          throw new Error(errorMsg)
        }
        setHasPin(true)
        setPin(''); setPin2(''); setCurrentPin('')
        setPinPrefsLocal(prefs)
        setMsg('Saved')
      } else {
        try {
          const res = await fetch('/api/facilitator/pin', { method:'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ prefs }) })
          if (!res.ok) { const js = await res.json().catch(()=>({})); throw new Error(js?.error || 'Failed to save') }
        } catch (e2) {}
        setPinPrefsLocal(prefs)
        setMsg('Saved')
      }
    } catch (e3) {
      setMsg(e3?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  if (loading) return <p>Loading…</p>

  return (
    <form onSubmit={handleSave} style={{ display:'grid', gap:8, alignItems:'start', maxWidth: 520 }}>
      {/* Hidden username field for accessibility and browser heuristics */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        defaultValue={email || ''}
        aria-hidden="true"
        tabIndex={-1}
        style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)', clipPath:'inset(50%)', whiteSpace:'nowrap', border:0, padding:0, margin:-1 }}
      />
      {hasPin && (
        <div style={{ display:'grid', gap:4 }}>
          <label style={{ color:'#374151', fontSize:14 }}>Current PIN</label>
          <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password"
            value={currentPin} onChange={e=>setCurrentPin(e.target.value)}
            style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }} />
        </div>
      )}
      <div style={{ display:'grid', gap:4 }}>
        <label style={{ color:'#374151', fontSize:14 }}>{hasPin ? 'New PIN' : 'Set PIN'}</label>
        <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password"
          value={pin} onChange={e=>setPin(e.target.value)}
          placeholder="4–8 digits"
          style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }} />
      </div>
      <div style={{ display:'grid', gap:4 }}>
        <label style={{ color:'#374151', fontSize:14 }}>Confirm PIN</label>
        <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password"
          value={pin2} onChange={e=>setPin2(e.target.value)}
          style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }} />
      </div>
      {/* Preferences */}
      <div style={{ marginTop: 2 }}>
        <h3 style={{ margin: '6px 0 4px', fontSize: 14 }}>Require PIN for:</h3>
        <div style={{ display:'grid', gap:6 }}>
          <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={!!prefs.facilitatorPage} onChange={(e)=> setPrefs(p=>({ ...p, facilitatorPage: e.target.checked }))} />
            <span>Facilitator Page</span>
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={!!prefs.downloads} onChange={(e)=> setPrefs(p=>({ ...p, downloads: e.target.checked }))} />
            <span>Print previews and downloads</span>
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={!!prefs.facilitatorKey} onChange={(e)=> setPrefs(p=>({ ...p, facilitatorKey: e.target.checked }))} />
            <span>Facilitator Key</span>
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={!!prefs.refresh} onChange={(e)=> setPrefs(p=>({ ...p, refresh: e.target.checked }))} />
            <span>Refreshing Worksheet/Test</span>
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={!!prefs.skipTimeline} onChange={(e)=> setPrefs(p=>({ ...p, skipTimeline: e.target.checked }))} />
            <span>Skip buttons and timeline jumps</span>
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={!!prefs.changeLearner} onChange={(e)=> setPrefs(p=>({ ...p, changeLearner: e.target.checked }))} />
            <span>Changing Learners on Learn page</span>
          </label>
        </div>
        <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center', flexWrap:'wrap' }}>
          <button
            type="submit"
            disabled={saving}
            style={{ padding:'6px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}
          >
            {saving ? 'Saving…' : 'Save PIN and Preferences'}
          </button>
          {hasPin && (
            <button type="button" onClick={clear} disabled={saving}
              style={{ padding:'6px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}>
              Clear PIN
            </button>
          )}
          {msg && <span style={{ color:'#374151' }}>{msg}</span>}
        </div>
      </div>
    </form>
  )
}
