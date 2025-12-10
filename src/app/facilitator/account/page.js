"use client"
import { useEffect, useState, useMemo } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { getPinPrefsLocal, setPinPrefsLocal } from '@/app/lib/pinGate'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'
import SettingsOverlay from '@/components/SettingsOverlay'
import { useRouter } from 'next/navigation'

export default function FacilitatorAccountPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true })
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  
  // Active overlay state
  const [activeOverlay, setActiveOverlay] = useState(null) // 'name'|'password'|'2fa'|'pin'|'accounts'|'hotkeys'|'timezone'|'marketing'|'policies'|'plan'|'danger'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setEmail(session.user.email || '')
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setEmail(session.user.email || '')
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Setting card style
  const cardStyle = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
  }

  const iconStyle = {
    fontSize: 28,
    flexShrink: 0,
    width: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  if (authLoading || loading) {
    return <main style={{ padding: 7 }}><p>Loading…</p></main>
  }

  return (
    <>
      <main style={{ padding: 7, opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
        <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{ marginTop: 0, marginBottom: 8, textAlign: 'left' }}>Account</h1>
          <p style={{ color: '#6b7280', marginTop: 0, marginBottom: 24, textAlign: 'left' }}>
            Manage your profile, security, connections, and preferences.
          </p>

          {/* Settings grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 24
          }}>
            {/* Your Name */}
            <div
              onClick={() => setActiveOverlay('name')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#111'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>👤</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 }}>Your Name</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Display name on your Facilitator page</div>
              </div>
            </div>

            {/* Email and Password */}
            <div
              onClick={() => setActiveOverlay('password')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#111'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>🔐</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 }}>Email and Password</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Manage sign-in credentials</div>
              </div>
            </div>

            {/* Two-Factor Authentication */}
            <div
              onClick={() => setActiveOverlay('2fa')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#111'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>🔒</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 }}>Two-Factor Auth</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Add extra security layer</div>
              </div>
            </div>

            {/* Facilitator PIN */}
            <div
              onClick={() => setActiveOverlay('pin')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#111'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>📌</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 }}>Facilitator PIN</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Protect sensitive actions</div>
              </div>
            </div>

            {/* Connected Accounts */}
            <div
              onClick={() => setActiveOverlay('accounts')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#111'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>🔗</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 }}>Connected Accounts</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Link Google and other services</div>
              </div>
            </div>

            {/* Hotkeys */}
            <div
              onClick={() => setActiveOverlay('hotkeys')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#111'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>⌨️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 }}>Hotkeys</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Customize keyboard shortcuts</div>
              </div>
            </div>

            {/* Timezone */}
            <div
              onClick={() => setActiveOverlay('timezone')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#111'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>🌍</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 }}>Timezone</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Set your preferred timezone</div>
              </div>
            </div>

            {/* Marketing Emails */}
            <div
              onClick={() => setActiveOverlay('marketing')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#111'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>📧</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 }}>Marketing Emails</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Manage email preferences</div>
              </div>
            </div>

            {/* Policies */}
            <div
              onClick={() => setActiveOverlay('policies')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#111'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>📄</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 }}>Policies</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Privacy, terms, and data practices</div>
              </div>
            </div>

            {/* Plan */}
            <div
              onClick={() => setActiveOverlay('plan')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#111'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>💎</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 }}>Plan</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Manage subscription and billing</div>
              </div>
            </div>

            {/* Danger Zone */}
            <div
              onClick={() => setActiveOverlay('danger')}
              style={{
                ...cardStyle,
                borderColor: '#fca5a5',
                background: '#fef2f2'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)'
                e.currentTarget.style.borderColor = '#b00020'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#fca5a5'
              }}
            >
              <div style={{ ...iconStyle, color: '#b00020' }}>⚠️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#b00020', marginBottom: 4 }}>Danger Zone</div>
                <div style={{ fontSize: 14, color: '#991b1b' }}>Delete your account</div>
              </div>
            </div>
          </div>

          {/* Logout button */}
          <section style={{ marginTop: 16 }}>
            <button
              onClick={async () => {
                const supabase = getSupabaseClient();
                try { 
                  // Use scope: 'local' to only log out this device, not all devices
                  await supabase?.auth?.signOut?.({ scope: 'local' });
                  // Clear session storage on logout
                  try {
                    sessionStorage.removeItem('facilitator_section_active');
                  } catch (e) {}
                  // Clear learner data to prevent cross-facilitator leakage
                  try {
                    localStorage.removeItem('learner_id');
                    localStorage.removeItem('learner_name');
                    localStorage.removeItem('learner_grade');
                    localStorage.removeItem('learner_humor_level');
                    
                    // Clear learner-specific overrides and snapshots
                    const keys = Object.keys(localStorage);
                    keys.forEach(key => {
                      if (key.startsWith('learner_humor_level_') ||
                          key.startsWith('target_comprehension_') ||
                          key.startsWith('target_exercise_') ||
                          key.startsWith('target_worksheet_') ||
                          key.startsWith('target_test_') ||
                          key.startsWith('atomic_snapshot:')) {
                        localStorage.removeItem(key);
                      }
                    });
                    
                    // Clear global target overrides
                    localStorage.removeItem('target_comprehension');
                    localStorage.removeItem('target_exercise');
                    localStorage.removeItem('target_worksheet');
                    localStorage.removeItem('target_test');
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
      
      {/* Overlays */}
      <NameOverlay
        isOpen={activeOverlay === 'name'}
        onClose={() => setActiveOverlay(null)}
      />

      <PasswordOverlay
        isOpen={activeOverlay === 'password'}
        onClose={() => setActiveOverlay(null)}
        email={email}
      />

      <TwoFactorOverlay
        isOpen={activeOverlay === '2fa'}
        onClose={() => setActiveOverlay(null)}
      />

      <PinOverlay
        isOpen={activeOverlay === 'pin'}
        onClose={() => setActiveOverlay(null)}
        email={email}
      />

      <ConnectedAccountsOverlay
        isOpen={activeOverlay === 'accounts'}
        onClose={() => setActiveOverlay(null)}
      />

      <HotkeysOverlay
        isOpen={activeOverlay === 'hotkeys'}
        onClose={() => setActiveOverlay(null)}
      />

      <TimezoneOverlay
        isOpen={activeOverlay === 'timezone'}
        onClose={() => setActiveOverlay(null)}
      />

      <MarketingOverlay
        isOpen={activeOverlay === 'marketing'}
        onClose={() => setActiveOverlay(null)}
      />

      <PoliciesOverlay
        isOpen={activeOverlay === 'policies'}
        onClose={() => setActiveOverlay(null)}
      />

      <PlanOverlay
        isOpen={activeOverlay === 'plan'}
        onClose={() => setActiveOverlay(null)}
      />

      <DangerZoneOverlay
        isOpen={activeOverlay === 'danger'}
        onClose={() => setActiveOverlay(null)}
      />
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

// Name Overlay
function NameOverlay({ isOpen, onClose }) {
  const [facilitatorName, setFacilitatorName] = useState('')
  const [serverFacilitatorName, setServerFacilitatorName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMessage, setNameMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
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
          } catch {}
          if (!loadedName) {
            const meta = session?.user?.user_metadata || {}
            loadedName = (meta.full_name || meta.display_name || meta.name || '').trim()
          }
          if (!cancelled) {
            setFacilitatorName(loadedName)
            setServerFacilitatorName(loadedName)
          }
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [isOpen])

  const handleSave = async () => {
    setSavingName(true); setNameMessage('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setNameMessage('Please sign in.'); setSavingName(false); return }
      
      let saved = false
      try {
        const { error: pErr } = await supabase
          .from('profiles')
          .update({ full_name: facilitatorName })
          .eq('id', session.user.id)
        if (!pErr) saved = true
      } catch {}

      if (!saved) {
        const tryUpdate = async (payload) => {
          const { error } = await supabase.from('profiles').update(payload).eq('id', session.user.id)
          return !error
        }
        saved = await tryUpdate({ display_name: facilitatorName }) ||
                await tryUpdate({ name: facilitatorName })
      }

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
  }

  return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Your Name"
    >
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Shown on your Facilitator page as a friendly greeting.
          </p>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
              Display name
            </label>
            <input
              type="text"
              value={facilitatorName}
              onChange={e => { setFacilitatorName(e.target.value); setNameMessage('') }}
              placeholder="Enter your name"
              style={{
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                width: '100%',
                fontSize: 14
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleSave}
              disabled={savingName || facilitatorName === serverFacilitatorName}
              style={{
                padding: '8px 16px',
                border: '1px solid #111',
                borderRadius: 8,
                background: '#111',
                color: '#fff',
                fontWeight: 600,
                cursor: savingName || facilitatorName === serverFacilitatorName ? 'not-allowed' : 'pointer',
                opacity: savingName || facilitatorName === serverFacilitatorName ? 0.5 : 1
              }}
            >
              {savingName ? 'Saving…' : 'Save'}
            </button>
            {nameMessage && <span style={{ color: '#374151' }}>{nameMessage}</span>}
          </div>
        </div>
      )}
    </SettingsOverlay>
  )
}

// Password Overlay
function PasswordOverlay({ isOpen, onClose, email }) {
  return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Email and Password"
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
            Email address
          </label>
          <div style={{
            padding: '8px 12px',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#f9fafb',
            color: '#6b7280',
            fontSize: 14
          }}>
            {email || '—'}
          </div>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
            Email address cannot be changed. Contact support if you need to update it.
          </p>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
            Password
          </label>
          <a
            href="/auth/update-password"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 16px',
              border: '1px solid #111',
              borderRadius: 8,
              background: '#111',
              color: '#fff',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: 14
            }}
          >
            Change password
          </a>
        </div>
      </div>
    </SettingsOverlay>
  )
}

// Two-Factor Overlay
function TwoFactorOverlay({ isOpen, onClose }) {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [enrollingMfa, setEnrollingMfa] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaMessage, setMfaMessage] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const activeTotp = factors?.totp?.active || []
        if (!cancelled) setMfaEnabled(activeTotp.length > 0)
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [isOpen])

  return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Two-Factor Authentication"
      maxWidth={500}
    >
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Add an extra layer of security to your account using an authenticator app.
          </p>

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
              style={{
                padding: '8px 16px',
                border: '1px solid #111',
                borderRadius: 8,
                background: '#111',
                color: '#fff',
                fontWeight: 600,
                cursor: mfaBusy ? 'not-allowed' : 'pointer',
                opacity: mfaBusy ? 0.5 : 1,
                width: 'fit-content'
              }}
            >
              Enable two-factor
            </button>
          )}

          {enrollingMfa && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                {enrollingMfa.qr ? (
                  <img src={enrollingMfa.qr} alt="Scan QR code" style={{ width: 160, height: 160 }} />
                ) : (
                  enrollingMfa.uri ? <a href={enrollingMfa.uri} target="_blank" rel="noreferrer">Open authenticator</a> : <div />
                )}
                <div style={{ color: '#6b7280', flex: 1 }}>
                  Scan with your authenticator app, then enter the 6-digit code to verify.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => { setMfaCode(e.target.value); setMfaMessage('') }}
                  style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, width: 140, fontSize: 14 }}
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
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #111',
                    borderRadius: 8,
                    background: '#111',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: mfaBusy || !mfaCode || mfaCode.length < 6 ? 'not-allowed' : 'pointer',
                    opacity: mfaBusy || !mfaCode || mfaCode.length < 6 ? 0.5 : 1
                  }}
                >
                  Verify code
                </button>
                <button
                  onClick={() => { setEnrollingMfa(null); setMfaCode(''); setMfaMessage('Enrollment canceled') }}
                  disabled={mfaBusy}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#fff',
                    color: '#111',
                    fontWeight: 600,
                    cursor: mfaBusy ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {mfaEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#0a7f27', fontWeight: 600 }}>✓ Two-factor is enabled</span>
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
                style={{
                  padding: '8px 16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#111',
                  fontWeight: 600,
                  cursor: mfaBusy ? 'not-allowed' : 'pointer'
                }}
              >
                Disable two-factor
              </button>
            </div>
          )}

          {mfaMessage && <div style={{ color: '#374151' }}>{mfaMessage}</div>}
        </div>
      )}
    </SettingsOverlay>
  )
}

// PIN Overlay
function PinOverlay({ isOpen, onClose, email }) {
  const [hasPin, setHasPin] = useState(false)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [prefs, setPrefs] = useState(() => getPinPrefsLocal())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
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
          if (!cancelled) {
            setHasPin(false)
            setPrefs(getPinPrefsLocal())
          }
        }
      } catch (e) {
        if (!cancelled) {
          setHasPin(false)
          setPrefs(getPinPrefsLocal())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isOpen])

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

  return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Facilitator PIN"
      maxWidth={550}
    >
      {loading ? (
        <p>Loading…</p>
      ) : (
        <form onSubmit={handleSave} style={{ display:'grid', gap: 16 }}>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Protect sensitive actions like skipping or downloading. This PIN is saved to your account.
          </p>
          
          {/* Hidden username for accessibility */}
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
            <div>
              <label style={{ display:'block', marginBottom:8, fontWeight:600, color:'#374151' }}>Current PIN</label>
              <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password"
                value={currentPin} onChange={e=>setCurrentPin(e.target.value)}
                style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, width: '100%', fontSize: 14 }} />
            </div>
          )}
          
          <div>
            <label style={{ display:'block', marginBottom:8, fontWeight:600, color:'#374151' }}>{hasPin ? 'New PIN' : 'Set PIN'}</label>
            <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password"
              value={pin} onChange={e=>setPin(e.target.value)}
              placeholder="4–8 digits"
              style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, width: '100%', fontSize: 14 }} />
          </div>
          
          <div>
            <label style={{ display:'block', marginBottom:8, fontWeight:600, color:'#374151' }}>Confirm PIN</label>
            <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password"
              value={pin2} onChange={e=>setPin2(e.target.value)}
              style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, width: '100%', fontSize: 14 }} />
          </div>
          
          {/* Preferences */}
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Require PIN for:</h3>
            <div style={{ display:'grid', gap:10 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!prefs.facilitatorPage} onChange={(e)=> setPrefs(p=>({ ...p, facilitatorPage: e.target.checked }))} />
                <span style={{ fontSize: 14 }}>Facilitator Page</span>
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!prefs.downloads} onChange={(e)=> setPrefs(p=>({ ...p, downloads: e.target.checked }))} />
                <span style={{ fontSize: 14 }}>Print previews and downloads</span>
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!prefs.facilitatorKey} onChange={(e)=> setPrefs(p=>({ ...p, facilitatorKey: e.target.checked }))} />
                <span style={{ fontSize: 14 }}>Facilitator Key</span>
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!prefs.refresh} onChange={(e)=> setPrefs(p=>({ ...p, refresh: e.target.checked }))} />
                <span style={{ fontSize: 14 }}>Refreshing Worksheet/Test</span>
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!prefs.skipTimeline} onChange={(e)=> setPrefs(p=>({ ...p, skipTimeline: e.target.checked }))} />
                <span style={{ fontSize: 14 }}>Skip buttons and timeline jumps</span>
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!prefs.changeLearner} onChange={(e)=> setPrefs(p=>({ ...p, changeLearner: e.target.checked }))} />
                <span style={{ fontSize: 14 }}>Changing Learners on Learn page</span>
              </label>
            </div>
          </div>
          
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding:'8px 16px',
                border:'1px solid #111',
                borderRadius:8,
                background:'#111',
                color:'#fff',
                fontWeight:600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.5 : 1
              }}
            >
              {saving ? 'Saving…' : 'Save PIN and Preferences'}
            </button>
            {hasPin && (
              <button type="button" onClick={clear} disabled={saving}
                style={{
                  padding:'8px 16px',
                  border:'1px solid #e5e7eb',
                  borderRadius:8,
                  background:'#fff',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}>
                Clear PIN
              </button>
            )}
            {msg && <span style={{ color:'#374151' }}>{msg}</span>}
          </div>
        </form>
      )}
    </SettingsOverlay>
  )
}

// Connected Accounts Overlay
function ConnectedAccountsOverlay({ isOpen, onClose }) {
  const [googleLinked, setGoogleLinked] = useState(false)
  const [linkMsg, setLinkMsg] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const identities = Array.isArray(session?.user?.identities) ? session.user.identities : []
        const hasGoogle = identities.some(id => id?.provider === 'google')
        if (!cancelled) setGoogleLinked(hasGoogle)
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [isOpen])

  // Clean up ?rts parameter after OAuth redirect
  useEffect(() => {
    if (!isOpen) return
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
  }, [isOpen])

  return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Connected Accounts"
    >
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Link external accounts to sign in more easily and keep your profile in sync.
          </p>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 24 }}>🔗</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Google</div>
                <div style={{ fontSize: 14, color: googleLinked ? '#0a7f27' : '#6b7280' }}>
                  {googleLinked ? '✓ Linked' : 'Not linked'}
                </div>
              </div>
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
                    } else {
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
                style={{
                  padding: '8px 16px',
                  border: '1px solid #111',
                  borderRadius: 8,
                  background: '#111',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: linkBusy ? 'not-allowed' : 'pointer',
                  opacity: linkBusy ? 0.5 : 1
                }}
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
                style={{
                  padding: '8px 16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#111',
                  fontWeight: 600,
                  cursor: linkBusy ? 'not-allowed' : 'pointer'
                }}
              >
                Unlink Google
              </button>
            )}
            
            {linkMsg && <div style={{ color: '#374151', marginTop: 12, fontSize: 14 }}>{linkMsg}</div>}
          </div>
        </div>
      )}
    </SettingsOverlay>
  )
}

// Hotkeys Overlay - redirects to full page
function HotkeysOverlay({ isOpen, onClose }) {
  useEffect(() => {
    if (isOpen) {
      window.location.href = '/facilitator/hotkeys'
    }
  }, [isOpen])

  return null
}

// Timezone Overlay
function TimezoneOverlay({ isOpen, onClose }) {
  const [timezone, setTimezone] = useState('')
  const [serverTimezone, setServerTimezone] = useState('')
  const [savingTz, setSavingTz] = useState(false)
  const [tzMessage, setTzMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const tzOptions = useMemo(() => [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Kolkata',
    'Asia/Tokyo',
    'Australia/Sydney',
  ], [])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch('/api/profile/timezone', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        const js = await res.json().catch(()=>({}))
        if (js && js.ok) {
          const tz = js.timezone || ''
          if (!cancelled) { setTimezone(tz); setServerTimezone(tz) }
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [isOpen])

  const handleSave = async () => {
    setSavingTz(true); setTzMessage('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) throw new Error('Please sign in')
      const token = session?.access_token
      let saved = false
      try {
        const res = await fetch('/api/profile/timezone', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ timezone })
        })
        const js = await res.json().catch(()=>({}))
        saved = !!js?.ok
      } catch {}

      try {
        const newMeta = { ...(user.user_metadata||{}), timezone }
        await supabase.auth.updateUser({ data: newMeta })
        saved = true
      } catch {}

      if (!saved) throw new Error('Failed to save')
      setServerTimezone(timezone)
      setTzMessage('Saved')
    } catch (e) {
      setTzMessage(e?.message || 'Failed to save')
    } finally { setSavingTz(false) }
  }

  return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Timezone"
    >
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Set your preferred timezone for lesson scheduling and calendar events.
          </p>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
              Preferred timezone
            </label>
            <select
              value={timezone}
              onChange={(e)=> setTimezone(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                width: '100%',
                fontSize: 14,
                background: '#fff'
              }}
            >
              {tzOptions.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleSave}
              disabled={savingTz || timezone === serverTimezone}
              style={{
                padding: '8px 16px',
                border: '1px solid #111',
                borderRadius: 8,
                background: '#111',
                color: '#fff',
                fontWeight: 600,
                cursor: savingTz || timezone === serverTimezone ? 'not-allowed' : 'pointer',
                opacity: savingTz || timezone === serverTimezone ? 0.5 : 1
              }}
            >
              {savingTz ? 'Saving…' : 'Save'}
            </button>
            {tzMessage && <span style={{ color: '#374151' }}>{tzMessage}</span>}
          </div>
        </div>
      )}
    </SettingsOverlay>
  )
}

// Marketing Overlay
function MarketingOverlay({ isOpen, onClose }) {
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [serverMarketingOptIn, setServerMarketingOptIn] = useState(false)
  const [marketingMessage, setMarketingMessage] = useState('')
  const [savingMarketing, setSavingMarketing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        const mm = user?.user_metadata?.marketing_opt_in
        if (!cancelled) {
          setMarketingOptIn(!!mm)
          setServerMarketingOptIn(!!mm)
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [isOpen])

  const handleSave = async () => {
    setSavingMarketing(true); setMarketingMessage('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) throw new Error('Please sign in')

      try {
        await supabase.from('profiles')
          .update({ marketing_opt_in: marketingOptIn })
          .eq('id', user.id)
      } catch {}

      const newMeta = { ...(user.user_metadata||{}), marketing_opt_in: !!marketingOptIn }
      const { error: upErr } = await supabase.auth.updateUser({ data: newMeta })
      if (upErr) throw upErr

      setServerMarketingOptIn(!!marketingOptIn)
      setMarketingMessage('Saved')
    } catch (e) {
      setMarketingMessage(e?.message || 'Failed to save')
    } finally { setSavingMarketing(false) }
  }

  return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Marketing Emails"
    >
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Receive occasional product updates and announcements. We will not spam you.
          </p>

          <label style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e)=> setMarketingOptIn(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontSize: 14 }}>Receive occasional product updates</span>
          </label>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleSave}
              disabled={savingMarketing || marketingOptIn === serverMarketingOptIn}
              style={{
                padding: '8px 16px',
                border: '1px solid #111',
                borderRadius: 8,
                background: '#111',
                color: '#fff',
                fontWeight: 600,
                cursor: savingMarketing || marketingOptIn === serverMarketingOptIn ? 'not-allowed' : 'pointer',
                opacity: savingMarketing || marketingOptIn === serverMarketingOptIn ? 0.5 : 1
              }}
            >
              {savingMarketing ? 'Saving…' : 'Save'}
            </button>
            {marketingMessage && <span style={{ color: '#374151' }}>{marketingMessage}</span>}
          </div>
        </div>
      )}
    </SettingsOverlay>
  )
}

// Policies Overlay
function PoliciesOverlay({ isOpen, onClose }) {
  return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Policies"
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Review our privacy policy, terms of service, and data practices.
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          <a
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#111',
              background: '#fff',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            <div style={{ fontSize: 20 }}>🔒</div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Privacy Policy</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>How we protect your data</div>
            </div>
          </a>

          <a
            href="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#111',
              background: '#fff',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            <div style={{ fontSize: 20 }}>📜</div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Terms of Service</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Rules and guidelines</div>
            </div>
          </a>

          <a
            href="/legal/data"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#111',
              background: '#fff',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            <div style={{ fontSize: 20 }}>📊</div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Data Practices</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>What we collect and why</div>
            </div>
          </a>
        </div>
      </div>
    </SettingsOverlay>
  )
}

// Plan Overlay - redirects to plan page
function PlanOverlay({ isOpen, onClose }) {
  useEffect(() => {
    if (isOpen) {
      window.location.href = '/facilitator/account/plan'
    }
  }, [isOpen])

  return null
}

// Danger Zone Overlay
function DangerZoneOverlay({ isOpen, onClose }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Reset state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setConfirming(false)
      setDeleting(false)
      setError('')
    }
  }, [isOpen])

  const handleDelete = async () => {
    setDeleting(true); setError('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Please sign in')
      
      const res = await fetch('/api/user/delete', { method:'POST', headers: { Authorization: `Bearer ${token}` } })
      const js = await res.json().catch(()=>({}))
      if (!res.ok || !js?.ok) throw new Error(js?.error || 'Failed to delete account')
      
      await supabase.auth.signOut({ scope: 'local' })
      
      try {
        sessionStorage.removeItem('facilitator_section_active')
      } catch (e) {}
      
      try {
        localStorage.removeItem('learner_id');
        localStorage.removeItem('learner_name');
        localStorage.removeItem('learner_grade');
        localStorage.removeItem('learner_humor_level');
        
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('learner_humor_level_') ||
              key.startsWith('target_comprehension_') ||
              key.startsWith('target_exercise_') ||
              key.startsWith('target_worksheet_') ||
              key.startsWith('target_test_') ||
              key.startsWith('atomic_snapshot:')) {
            localStorage.removeItem(key);
          }
        });
        
        localStorage.removeItem('target_comprehension');
        localStorage.removeItem('target_exercise');
        localStorage.removeItem('target_worksheet');
        localStorage.removeItem('target_test');
      } catch (e) {}
      
      window.location.assign('/')
    } catch (e) {
      setError(e?.message || 'Unexpected error')
    } finally { setDeleting(false) }
  }

  return (
    <SettingsOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Danger Zone"
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          padding: 16
        }}>
          <div style={{ color: '#b00020', fontWeight: 600, marginBottom: 8 }}>
            ⚠️ Delete Your Account
          </div>
          <p style={{ color: '#991b1b', margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            This permanently deletes your profile, settings, and all associated data.
            This action cannot be undone.
          </p>
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={deleting}
            style={{
              padding: '8px 16px',
              border: '1px solid #b00020',
              borderRadius: 8,
              background: '#b00020',
              color: '#fff',
              fontWeight: 600,
              cursor: deleting ? 'not-allowed' : 'pointer',
              width: 'fit-content'
            }}
          >
            Delete my account
          </button>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ color: '#b00020', fontWeight: 600 }}>
              Are you absolutely sure?
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#111',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #b00020',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#b00020',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.5 : 1
                }}
              >
                {deleting ? 'Deleting…' : 'Confirm delete'}
              </button>
            </div>
            {error && <div style={{ color: '#b00020', fontSize: 14 }}>{error}</div>}
          </div>
        )}
      </div>
    </SettingsOverlay>
  )
}
