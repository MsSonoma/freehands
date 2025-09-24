"use client"
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'

export default function FacilitatorAccountPage() {
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
          // Prefer auth user metadata for display name; avoid selecting non-existent columns
          let data = null
          try { data = (await supabase.from('profiles').select('plan_tier').eq('id', session.user.id).maybeSingle()).data } catch {}
          if (!cancelled) {
            const meta = session?.user?.user_metadata || {}
            const profName = (meta.display_name || meta.full_name || meta.name || '').trim()
            setFacilitatorName(profName)
            setServerFacilitatorName(profName)
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

  return (
    <main style={{ padding: 7 }}>
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
                    // Try updating several likely columns; ignore missing-column errors
                    let ok = false
                    const tryUpdate = async (payload) => {
                      const { error } = await supabase.from('profiles').update(payload).eq('id', session.user.id)
                      if (error) return false
                      return true
                    }
                    ok = await tryUpdate({ full_name: facilitatorName }) ||
                         await tryUpdate({ display_name: facilitatorName }) ||
                         await tryUpdate({ name: facilitatorName })
                    // If profile columns aren't available, fall back to auth user metadata
                    if (!ok) {
                      const { error: mdErr } = await supabase.auth.updateUser({ data: { display_name: facilitatorName, full_name: facilitatorName, name: facilitatorName } })
                      if (mdErr) throw mdErr
                      ok = true
                    }
                    if (ok) {
                      setServerFacilitatorName(facilitatorName)
                      setNameMessage('Saved!')
                    }
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
          <p style={{ color: '#555', marginTop: 3 }}>Need to permanently delete your account? Use the Danger zone in <a href="/facilitator/settings">Settings</a>.</p>
        </section>
      </div>
    </main>
  )
}
