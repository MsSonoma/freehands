"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { ensurePinAllowed } from '@/app/lib/pinGate'

export default function FacilitatorSettingsPage() {
	const router = useRouter()
	const [pinChecked, setPinChecked] = useState(false)
	
	// Check PIN requirement on mount
	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const allowed = await ensurePinAllowed('facilitator-page')
				if (!allowed) {
					router.push('/')
					return
				}
				if (!cancelled) setPinChecked(true)
			} catch (e) {
				if (!cancelled) setPinChecked(true)
			}
		})()
		return () => { cancelled = true }
	}, [router])

	// Timezone
	const [loadingTz, setLoadingTz] = useState(true)
	const [savingTz, setSavingTz] = useState(false)
	const [timezone, setTimezone] = useState('')
	const [serverTimezone, setServerTimezone] = useState('')
	const [tzMessage, setTzMessage] = useState('')

	// Marketing (auth metadata only for now)
	const [marketingOptIn, setMarketingOptIn] = useState(false)
	const [serverMarketingOptIn, setServerMarketingOptIn] = useState(false)
	const [marketingMessage, setMarketingMessage] = useState('')
	const [savingMarketing, setSavingMarketing] = useState(false)

	const tzOptions = useMemo(() => {
		try {
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
		} catch {
			return ['UTC']
		}
	}, [])

	useEffect(() => {
		if (!pinChecked) return
		let cancelled = false
		;(async () => {
			try {
				const supabase = getSupabaseClient()
				const { data: { session } } = await supabase.auth.getSession()
				const user = session?.user
				if (!user) throw new Error('Not signed in')

				// Timezone via API (safe defaults)
				try {
					const token = session?.access_token
					const res = await fetch('/api/profile/timezone', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
					const js = await res.json().catch(()=>({}))
					if (js && js.ok) {
						const tz = js.timezone || ''
						if (!cancelled) { setTimezone(tz); setServerTimezone(tz) }
					}
				} catch {}

				// marketing from auth metadata
				try {
					const mm = user.user_metadata?.marketing_opt_in
					if (!cancelled) {
						setMarketingOptIn(!!mm)
						setServerMarketingOptIn(!!mm)
					}
				} catch {}
			} catch {}
			if (!cancelled) setLoadingTz(false)
		})()
		return () => { cancelled = true }
	}, [pinChecked])

	if (!pinChecked) {
		return <main style={{ padding: 12 }}><p style={{ textAlign: 'center' }}>Loading…</p></main>
	}

	return (
		<main style={{ padding: 12 }}>
			<div style={{ width:'100%', maxWidth: 760, margin: '0 auto', textAlign:'center' }}>
				<h1 style={{ fontSize:24, fontWeight:800, margin:'0 0 8px 0', textAlign:'center' }}>Settings</h1>

				<section style={{ display:'grid', gap:4, marginBottom:10 }}>
				<h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Hotkeys</h2>
				<p style={{ color:'#6b7280', margin:0 }}>Customize your keyboard shortcuts for quick control during a session.</p>
				<Link href="/facilitator/hotkeys" style={{ textDecoration:'none', display:'block', width:'100%' }}>
					<button type="button" style={{ display:'block', margin:'6px auto 0', padding:'5px 10px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}>Open Hotkeys</button>
				</Link>
				</section>

				<section style={{ display:'grid', gap:4, marginBottom:10 }}>
				<h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Preferred time zone</h2>
				<div style={{ display:'grid', gap:6, justifyItems:'center' }}>
					<select
						value={timezone}
						onChange={(e)=> setTimezone(e.target.value)}
						style={{ padding:'5px 8px', border:'1px solid #e5e7eb', borderRadius:8, margin:'0 auto' }}
					>
						{tzOptions.map(tz => <option key={tz} value={tz}>{tz}</option>)}
					</select>
					<button
						onClick={async ()=>{
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

								// Best-effort: mirror timezone into auth metadata as fallback copy
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
						}}
						disabled={savingTz || timezone === serverTimezone}
						style={{ display:'block', margin:'0 auto', padding:'5px 10px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}
					>
						{savingTz ? 'Saving…' : 'Save time zone'}
					</button>
					{tzMessage && <span style={{ color:'#374151' }}>{tzMessage}</span>}
				</div>
				</section>

				<section style={{ display:'grid', gap:4, marginBottom:10 }}>
				<h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Marketing emails</h2>
				<div style={{ display:'grid', gap:6, justifyItems:'center' }}>
					<label style={{ display:'flex', gap:6, alignItems:'center' }}>
						<input type="checkbox" checked={marketingOptIn} onChange={(e)=> setMarketingOptIn(e.target.checked)} />
						<span>Receive occasional product updates</span>
					</label>
					<button
						onClick={async ()=>{
							setSavingMarketing(true); setMarketingMessage('')
							try {
								const supabase = getSupabaseClient()
								const { data: { session } } = await supabase.auth.getSession()
								const user = session?.user
								if (!user) throw new Error('Please sign in')

								// Try to update profiles first if column exists (best-effort)
								try {
									await supabase.from('profiles')
										.update({ marketing_opt_in: marketingOptIn })
										.eq('id', user.id)
								} catch {}

								// Always update auth metadata copy
								const newMeta = { ...(user.user_metadata||{}), marketing_opt_in: !!marketingOptIn }
								const { error: upErr } = await supabase.auth.updateUser({ data: newMeta })
								if (upErr) throw upErr

								setServerMarketingOptIn(!!marketingOptIn)
								setMarketingMessage('Saved')
							} catch (e) {
								setMarketingMessage(e?.message || 'Failed to save')
							} finally { setSavingMarketing(false) }
						}}
						disabled={savingMarketing || marketingOptIn === serverMarketingOptIn}
						style={{ display:'block', margin:'0 auto', padding:'5px 10px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}
					>
						{savingMarketing ? 'Saving…' : 'Save preference'}
					</button>
					{marketingMessage && <span style={{ color:'#374151' }}>{marketingMessage}</span>}
				</div>
				<p style={{ color:'#6b7280', fontSize:12, margin:0 }}>Stored in your auth profile metadata. We will not spam you.</p>
				</section>

				<section style={{ display:'grid', gap:4, marginBottom:10 }}>
				<h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Privacy and data</h2>
				<div style={{ color:'#374151', display:'grid', gap:4 }}>
					<a href="/legal/privacy" style={{ color:'#111', textDecoration:'underline' }}>Privacy policy</a>
					<a href="/legal/terms" style={{ color:'#111', textDecoration:'underline' }}>Terms of service</a>
					<a href="/legal/data" style={{ color:'#111', textDecoration:'underline' }}>Data practices</a>
				</div>
				</section>

				<section style={{ display:'grid', gap:4 }}>
				<h2 style={{ fontSize:18, fontWeight:700, color:'#b00020', margin:0 }}>Danger zone</h2>
				<DeleteAccount />
				</section>
			</div>
		</main>
	)
}

function DeleteAccount() {
	const [confirming, setConfirming] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [error, setError] = useState('')

	if (!confirming) {
		return (
			<div style={{ border:'1px solid #fca5a5', background:'#fff', borderRadius:12, padding:8, display:'grid', gap:6, justifyItems:'center', width:'fit-content', maxWidth:'100%', margin:'0 auto' }}>
				<button onClick={()=> setConfirming(true)} disabled={deleting}
					style={{ display:'block', margin:'0 auto', padding:'5px 10px', border:'1px solid #b00020', borderRadius:8, background:'#b00020', color:'#fff', fontWeight:700 }}>
					Delete my account
				</button>
				<span style={{ color:'#b00020', textAlign:'center' }}>This permanently deletes your profile and settings.</span>
			</div>
		)
	}

	return (
		<div style={{ border:'1px solid #fca5a5', background:'#fff', borderRadius:12, padding:8, display:'grid', gap:6, justifyItems:'center', width:'fit-content', maxWidth:'100%', margin:'0 auto' }}>
			<span style={{ color:'#b00020', textAlign:'center' }}>Are you sure?</span>
			<button onClick={()=> setConfirming(false)} disabled={deleting}
				style={{ display:'block', margin:'0 auto', padding:'5px 10px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}>Cancel</button>
			<button onClick={async ()=>{
				setDeleting(true); setError('')
				try {
					const supabase = getSupabaseClient()
					const { data: { session } } = await supabase.auth.getSession()
					const token = session?.access_token
					if (!token) throw new Error('Please sign in')
					const res = await fetch('/api/user/delete', { method:'POST', headers: { Authorization: `Bearer ${token}` } })
					const js = await res.json().catch(()=>({}))
					if (!res.ok || !js?.ok) throw new Error(js?.error || 'Failed to delete account')
					await supabase.auth.signOut()
					window.location.assign('/')
				} catch (e) {
					setError(e?.message || 'Unexpected error')
				} finally { setDeleting(false) }
			}}
			disabled={deleting}
			style={{ display:'block', margin:'0 auto', padding:'5px 10px', border:'1px solid #b00020', borderRadius:8, background:'#fff', color:'#b00020', fontWeight:700 }}>
				{deleting ? 'Deleting…' : 'Confirm delete'}
			</button>
			{error && <span style={{ color:'#b00020', textAlign:'center' }}>{error}</span>}
		</div>
	)
}

// HotkeysManager moved to /facilitator/hotkeys page


