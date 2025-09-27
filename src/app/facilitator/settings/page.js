"use client"
import { useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { setFacilitatorPin, clearFacilitatorPin, getPinPrefsLocal, setPinPrefsLocal } from '@/app/lib/pinGate'
import { DEFAULT_HOTKEYS, getHotkeysLocal, setHotkeysLocal, fetchHotkeysServer, saveHotkeysServer } from '@/app/lib/hotkeys'

export default function FacilitatorSettingsPage() {
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [timezone, setTimezone] = useState('')
	const [serverTimezone, setServerTimezone] = useState('')
	const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
	// Marketing opt-in state (moved from Account)
	const [marketingOptIn, setMarketingOptIn] = useState(false)
	const [serverMarketingOptIn, setServerMarketingOptIn] = useState(false)
	const [marketingMessage, setMarketingMessage] = useState('')
	const [savingMarketing, setSavingMarketing] = useState(false)

	const tzOptions = useMemo(() => {
		try {
			// A light list; for a full list consider shipping a JSON of IANA zones
			return [
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
			]
		} catch { return ['UTC'] }
	}, [])

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const supabase = getSupabaseClient()
				const { data: { session } } = await supabase.auth.getSession()
				if (session?.user) {
					const { data } = await supabase.from('profiles').select('timezone, marketing_opt_in').eq('id', session.user.id).maybeSingle()
					if (!cancelled) {
						const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
						setTimezone(data?.timezone || browserTz || 'UTC')
						setServerTimezone(data?.timezone || '')
            const meta = session?.user?.user_metadata || {}
            const mk = (typeof data?.marketing_opt_in === 'boolean') ? data.marketing_opt_in : (meta.marketing_opt_in ?? false)
            setMarketingOptIn(!!mk)
            setServerMarketingOptIn(!!mk)
					}
				}
			} catch {}
			if (!cancelled) setLoading(false)
		})()
		return () => { cancelled = true }
	}, [])

	return (
		<main style={{ padding: '10px 28px 24px', maxWidth: 720, margin: '0 auto' }}>
			<h1 style={{ marginTop:0, marginBottom: 2, fontSize: 20 }}>Settings</h1>

			{/* Facilitator PIN */}
			<section style={{ marginTop: 6 }}>
				<h2 style={{ fontSize: 18, margin: '4px 0' }}>Facilitator PIN</h2>
				<p style={{ color:'#555', marginTop: 0, fontSize: 14, lineHeight: 1.35 }}>
					Protect sensitive actions like skipping or downloading. This PIN is saved to your account.
				</p>
				<PinManager />
			</section>

			{/* Hotkeys */}
			<section style={{ marginTop: 16 }}>
				<h2 style={{ fontSize: 18, margin: '4px 0' }}>Hotkeys</h2>
				<p style={{ color:'#555', marginTop: 0, fontSize: 14, lineHeight: 1.35 }}>
					Customize session hotkeys. Use physical key names (based on KeyboardEvent.code) like Enter, NumpadAdd, ArrowLeft.
				</p>
				<HotkeysManager />
			</section>

			{/* Name moved to Account page */}
			<section style={{ marginTop: 6 }}>
				<h2 style={{ fontSize: 18, margin: '4px 0' }}>Preferred Time Zone</h2>
				<p style={{ color:'#555', marginTop: 0, fontSize: 14, lineHeight: 1.35 }}>
					Used to compute your daily lesson limits. If unset, we’ll use your browser’s time zone.
				</p>
				{loading ? (
					<p>Loading…</p>
				) : (
					<div style={{ display:'flex', gap:5, alignItems:'center', flexWrap:'wrap' }}>
						<select value={timezone} onChange={e=>setTimezone(e.target.value)} style={{ padding:'5px 8px', border:'1px solid #e5e7eb', borderRadius:8 }}>
							{tzOptions.map(z => <option key={z} value={z}>{z}</option>)}
						</select>
						<button
							onClick={async ()=>{
								setSaving(true); setMessage('')
								try {
									const supabase = getSupabaseClient()
									const { data: { session } } = await supabase.auth.getSession()
									if (!session?.user) { setMessage('Please sign in.'); setSaving(false); return }
									const { error } = await supabase.from('profiles').update({ timezone }).eq('id', session.user.id)
									if (error) throw error
									setServerTimezone(timezone)
									setMessage('Saved!')
								} catch (e) {
									setMessage(e?.message || 'Failed to save')
								} finally { setSaving(false) }
							}}
							disabled={saving || timezone === serverTimezone}
							style={{ padding:'5px 10px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}
						>
							{saving ? 'Saving…' : 'Save'}
						</button>
						{message && <span style={{ color:'#374151' }}>{message}</span>}
					</div>
				)}
			</section>

			<section style={{ marginTop: 24 }}>
				<h2 style={{ fontSize: 18, margin: '4px 0' }}>Marketing opt-in</h2>
				<p style={{ color:'#555', marginTop: 0, fontSize: 14, lineHeight: 1.35 }}>Receive occasional product updates and tips. You can opt out anytime.</p>
				{loading ? (
					<p>Loading…</p>
				) : (
					<div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
						<label style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
							<input type="checkbox" checked={marketingOptIn} onChange={(e)=>{ setMarketingOptIn(e.target.checked); setMarketingMessage('') }} />
							<span>Send me updates</span>
						</label>
						<button
							onClick={async ()=>{
								setSavingMarketing(true); setMarketingMessage('')
								try {
									const supabase = getSupabaseClient()
									const { data: { session } } = await supabase.auth.getSession()
									if (!session?.user) { setMarketingMessage('Please sign in.'); setSavingMarketing(false); return }
									let ok = false
									const tryUpdate = async (payload) => {
										const { error } = await supabase.from('profiles').update(payload).eq('id', session.user.id)
										if (error) return false
										return true
									}
									ok = await tryUpdate({ marketing_opt_in: marketingOptIn })
									if (!ok) {
										const { error: mdErr } = await supabase.auth.updateUser({ data: { marketing_opt_in: marketingOptIn } })
										if (mdErr) throw mdErr
										ok = true
									}
									if (ok) {
										setServerMarketingOptIn(marketingOptIn)
										setMarketingMessage('Saved!')
									}
								} catch (e) {
									setMarketingMessage(e?.message || 'Failed to save')
								} finally { setSavingMarketing(false) }
							}}
							disabled={savingMarketing || marketingOptIn === serverMarketingOptIn}
							style={{ padding:'5px 10px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}
						>
							{savingMarketing ? 'Saving…' : 'Save'}
						</button>
						{marketingMessage && <span style={{ color:'#374151' }}>{marketingMessage}</span>}
					</div>
				)}
			</section>

			<section style={{ marginTop: 24 }}>
				<h2 style={{ fontSize: 18, margin: '4px 0' }}>Privacy & Data</h2>
				<ul style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.35 }}>
					<li><a href="/legal/privacy">Privacy Policy</a></li>
					<li><a href="/legal/subprocessors">Subprocessors</a></li>
					<li><a href="/legal/cookies">Cookie Policy</a></li>
					<li>Data export: contact <a href="mailto:outreach@mssonoma.com">outreach@mssonoma.com</a></li>
				</ul>
			</section>

			{/* Danger zone moved to the bottom */}
			<section style={{ marginTop: 24 }}>
				<h2 style={{ fontSize: 18, margin: '4px 0', color:'#b00020' }}>Danger zone</h2>
				<p style={{ color:'#555', marginTop: 0, fontSize: 14, lineHeight: 1.35 }}>
					Permanently delete your account and all associated data. This cannot be undone.
				</p>
				<div style={{ display:'grid', gap:5, alignItems:'start' }}>
					{!confirmingDelete ? (
						<button onClick={()=>{ setConfirmingDelete(true); setDeleteError('') }} disabled={deleting}
							style={{ padding:'5px 10px', border:'1px solid #b00020', borderRadius:8, background:'#fff', color:'#b00020', fontWeight:600 }}>
							Delete Account
						</button>
					) : (
						<div style={{ display:'flex', gap:5, alignItems:'center', flexWrap:'wrap' }}>
							<span style={{ color:'#444' }}>Are you sure? This action is permanent.</span>
							<button onClick={()=>setConfirmingDelete(false)} disabled={deleting}
								style={{ padding:'5px 10px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}>Cancel</button>
							<button onClick={async ()=>{
								setDeleting(true); setDeleteError('')
								try {
									// get access token for API
									const supabase = getSupabaseClient()
									const { data: { session } } = await supabase.auth.getSession()
									const token = session?.access_token
									if (!token) throw new Error('Please sign in')
									const res = await fetch('/api/user/delete', { method:'POST', headers: { Authorization: `Bearer ${token}` } })
									const js = await res.json().catch(()=>({}))
									if (!res.ok || !js?.ok) throw new Error(js?.error || 'Failed to delete account')
									// sign out locally and redirect
									await supabase.auth.signOut()
									window.location.assign('/')
								} catch (e) {
									setDeleteError(e?.message || 'Unexpected error')
								} finally { setDeleting(false) }
							}}
							disabled={deleting}
							style={{ padding:'5px 10px', border:'1px solid #b00020', borderRadius:8, background:'#fff', color:'#b00020', fontWeight:600 }}>
							{deleting ? 'Deleting…' : 'Confirm delete'}
						</button>
						{deleteError && <span style={{ color:'#b00020' }}>{deleteError}</span>}
						</div>
					)}
				</div>
			</section>
		</main>
	)
}


function PinManager() {
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
				// Try to call API to see if server-side PIN exists
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
					// If API not configured, fall back to local check
					const stored = typeof window !== 'undefined' ? localStorage.getItem('facilitator_pin') : null
							if (!cancelled) {
								setHasPin(!!stored)
								setPrefs(getPinPrefsLocal())
							}
				}
			} catch {
				const stored = typeof window !== 'undefined' ? localStorage.getItem('facilitator_pin') : null
						if (!cancelled) {
							setHasPin(!!stored)
							setPrefs(getPinPrefsLocal())
						}
			} finally {
				if (!cancelled) setLoading(false)
			}
		})()
		return () => { cancelled = true }
	}, [])

	const save = async () => {
		setMsg(''); setSaving(true)
		try {
			if (!pin || pin.length < 4 || pin.length > 8 || /\D/.test(pin)) throw new Error('Use a 4–8 digit PIN')
			if (pin !== pin2) throw new Error('PINs do not match')
			// Prefer server API when available
			let usedServer = false
					try {
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
						usedServer = true
						// Keep local fallback in sync so existing gates work
						try { setFacilitatorPin(pin) } catch {}
			} catch (e) {
				// Fallback to local storage
				try { setFacilitatorPin(pin) } catch {}
				if (hasPin && currentPin && currentPin !== (typeof window !== 'undefined' ? localStorage.getItem('facilitator_pin') : '')) {
					throw e
				}
			}
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
			// Try server
			let usedServer = false
					try {
				const supabase = getSupabaseClient()
				const { data: { session } } = await supabase.auth.getSession()
				const token = session?.access_token
				if (!token) throw new Error('Sign in required')
				const res = await fetch('/api/facilitator/pin', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
				const js = await res.json().catch(()=>({}))
				if (!res.ok || !js?.ok) throw new Error(js?.error || 'Failed to clear')
				usedServer = true
					} catch {}
					// Always clear local fallback
					try { clearFacilitatorPin() } catch {}
			setHasPin(false)
			setMsg('Cleared')
			setPin(''); setPin2(''); setCurrentPin('')
		} catch (e) {
			setMsg(e?.message || 'Failed to clear')
		} finally { setSaving(false) }
	}

	if (loading) return <p>Loading…</p>

	return (
		<div style={{ display:'grid', gap:8, alignItems:'start', maxWidth: 520 }}>
			{hasPin && (
				<div style={{ display:'grid', gap:4 }}>
					<label style={{ color:'#374151', fontSize:14 }}>Current PIN</label>
					<input type="password" inputMode="numeric" pattern="\d*" autoComplete="current-password"
						value={currentPin} onChange={e=>setCurrentPin(e.target.value)}
						style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }} />
				</div>
			)}
			<div style={{ display:'grid', gap:4 }}>
				<label style={{ color:'#374151', fontSize:14 }}>{hasPin ? 'New PIN' : 'Set PIN'}</label>
				<input type="password" inputMode="numeric" pattern="\d*" autoComplete="new-password"
					value={pin} onChange={e=>setPin(e.target.value)}
					placeholder="4–8 digits"
					style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }} />
			</div>
			<div style={{ display:'grid', gap:4 }}>
				<label style={{ color:'#374151', fontSize:14 }}>Confirm PIN</label>
				<input type="password" inputMode="numeric" pattern="\d*" autoComplete="new-password"
					value={pin2} onChange={e=>setPin2(e.target.value)}
					style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8 }} />
			</div>
			<div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
				<button onClick={save} disabled={saving}
					style={{ padding:'6px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}>
					{saving ? 'Saving…' : (hasPin ? 'Update PIN' : 'Set PIN')}
				</button>
				{hasPin && (
					<button onClick={clear} disabled={saving}
						style={{ padding:'6px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}>
						Clear PIN
					</button>
				)}
				{msg && <span style={{ color:'#374151' }}>{msg}</span>}
			</div>
			<p style={{ color:'#6b7280', fontSize:12, marginTop:2 }}>
				Tip: We recommend 4–8 digits. Avoid reusing sensitive PINs.
			</p>
					{/* Preferences */}
					<div style={{ marginTop: 6 }}>
						<h3 style={{ margin: '6px 0 4px', fontSize: 14 }}>Require PIN for:</h3>
						<div style={{ display:'grid', gap:6 }}>
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
						<div style={{ display:'flex', gap:6, marginTop:6 }}>
							<button
								onClick={async ()=>{
									setMsg(''); setSaving(true)
									try {
										// Save prefs to server if available; always mirror locally
										try {
											const supabase = getSupabaseClient()
											const { data: { session } } = await supabase.auth.getSession()
											const token = session?.access_token
											if (!token) throw new Error('Sign in required')
											const res = await fetch('/api/facilitator/pin', { method:'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ prefs }) })
											if (!res.ok) { const js = await res.json().catch(()=>({})); throw new Error(js?.error || 'Failed to save') }
										} catch {}
										setPinPrefsLocal(prefs)
										setMsg('Preferences saved')
									} catch (e) {
										setMsg(e?.message || 'Failed to save')
									} finally { setSaving(false) }
								}}
								disabled={saving}
								style={{ padding:'6px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}
							>
								{saving ? 'Saving…' : 'Save preferences'}
							</button>
						</div>
					</div>
		</div>
	)
}


function HotkeysManager() {
	const [loading, setLoading] = useState(true);
	const [hotkeys, setHotkeys] = useState(() => getHotkeysLocal());
	const [serverHotkeys, setServerHotkeys] = useState(null);
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState('');
  const [recordingField, setRecordingField] = useState(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				setLoading(true);
				const res = await fetchHotkeysServer();
				if (res?.ok && res.hotkeys) {
					if (!cancelled) {
						setHotkeys(prev => ({ ...prev, ...res.hotkeys }));
						setServerHotkeys(res.hotkeys);
					}
				} else {
					// keep local
				}
			} catch {}
			if (!cancelled) setLoading(false);
		})();
		return () => { cancelled = true };
	}, []);

	// Utility: treat pure modifiers as non-assignable
	const isModifierCode = (code) => {
		return [
			'ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight',
			'MetaLeft','MetaRight','CapsLock','NumLock','ScrollLock','Fn','FnLock',
			'Hyper','Super'
		].includes(code);
	};

	// When recording is active, capture the next keydown and assign its .code to the field
	useEffect(() => {
		if (!recordingField) return;
		const onKeyDown = (e) => {
			const code = e.code || e.key;
			if (!code || code === 'Unidentified') return;
			// Allow Escape to clear the field
			if (code === 'Escape') {
				e.preventDefault();
				setHotkeys(h => ({ ...h, [recordingField]: '' }));
				setRecordingField(null);
				return;
			}
			if (isModifierCode(code)) {
				// Keep listening until a non-modifier is pressed
				return;
			}
			e.preventDefault();
			setHotkeys(h => ({ ...h, [recordingField]: code }));
			setRecordingField(null);
		};
		// Use capture so we pre-empt inputs
		window.addEventListener('keydown', onKeyDown, { capture: true });
		return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
	}, [recordingField]);

	const fields = [
		{ key:'beginSend', label:'Begin/Send' },
		{ key:'micHold', label:'Mic (hold to record)' },
		{ key:'skipLeft', label:'Skip Left' },
		{ key:'skipRight', label:'Skip Right' },
		{ key:'muteToggle', label:'Mute toggle' },
		{ key:'playPauseToggle', label:'Play/Pause toggle' },
	];

	const resetDefaults = () => {
		setHotkeys({ ...DEFAULT_HOTKEYS });
		setMsg('Defaults restored (not yet saved)');
	};

	if (loading) return <p>Loading…</p>;

	return (
		<div style={{ display:'grid', gap:8, alignItems:'start', maxWidth: 520 }}>
			<div style={{ display:'grid', gap:8 }}>
				{fields.map(f => {
					const isRec = recordingField === f.key;
					return (
						<div key={f.key} style={{ display:'grid', gap:4 }}>
							<label style={{ color:'#374151', fontSize:14, display:'flex', alignItems:'center', gap:8 }}>
								<span>{f.label}</span>
								{isRec && <span style={{ fontSize:12, color:'#6b7280' }}>Recording… press a key (Esc to clear)</span>}
							</label>
							<div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
								<input
									type="text"
									value={hotkeys[f.key] ?? ''}
									placeholder={DEFAULT_HOTKEYS[f.key] || ''}
									onChange={(e)=> setHotkeys(h => ({ ...h, [f.key]: e.target.value }))}
									style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8, minWidth: 160 }}
								/>
								<button
									onClick={() => setRecordingField(prev => prev === f.key ? null : f.key)}
									title={isRec ? 'Stop recording' : 'Record this key'}
									type="button"
									style={{ padding:'6px 10px', border:'1px solid #111', borderRadius:8, background:isRec ? '#374151' : '#111', color:'#fff', fontWeight:600 }}
								>
									{isRec ? 'Stop' : 'Record'}
								</button>
								<button
									onClick={() => setHotkeys(h => ({ ...h, [f.key]: '' }))}
									type="button"
									style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}
								>
									Clear
								</button>
							</div>
						</div>
					);
				})}
			</div>
			<div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
				<button
					onClick={async ()=>{
						setSaving(true); setMsg('');
						try {
							// Basic normalization: trim strings
							const cleaned = Object.fromEntries(Object.entries(hotkeys).map(([k,v]) => [k, (typeof v === 'string' ? v.trim() : '')]));
							// Save server if possible
							const res = await saveHotkeysServer(cleaned);
							if (!res?.ok) {
								// non-fatal; proceed with local save
							}
							setHotkeysLocal(cleaned);
							setServerHotkeys(cleaned);
							setMsg('Saved');
						} catch (e) {
							setMsg(e?.message || 'Failed to save');
						} finally { setSaving(false); }
					}}
					disabled={saving}
					style={{ padding:'6px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}
				>
					{saving ? 'Saving…' : 'Save hotkeys'}
				</button>
				<button
					onClick={resetDefaults}
					disabled={saving}
					style={{ padding:'6px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}
				>
					Restore defaults
				</button>
				{msg && <span style={{ color:'#374151' }}>{msg}</span>}
			</div>
			<p style={{ color:'#6b7280', fontSize:12, marginTop:2 }}>
				Tip: Click Record, press a key to capture its code. Use codes like Enter, ArrowLeft, NumpadAdd. Press Esc while recording to clear. Leave blank to disable.
			</p>
		</div>
	);
}


