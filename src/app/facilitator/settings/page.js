"use client"
import { useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'

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


