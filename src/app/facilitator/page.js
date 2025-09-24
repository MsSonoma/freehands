"use client";
import Link from 'next/link'
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Facilitator Hub

export default function FacilitatorPage() {
	const router = useRouter();
		const cardStyle = {
			display:'flex', alignItems:'center', justifyContent:'center',
			width:'100%', padding:'12px 14px', border:'1px solid #e5e7eb', borderRadius:12,
			background:'#fff', color:'#111', textDecoration:'none', fontWeight:600,
			boxShadow:'0 2px 6px rgba(0,0,0,0.06)', boxSizing:'border-box'
		}

		// Black button variant for Login/Logout
		const authCardStyle = {
			...cardStyle,
			background:'#111',
			color:'#fff',
			border:'1px solid #111'
		}

	const [plan, setPlan] = useState('free')
	const [loading, setLoading] = useState(true)
	const [session, setSession] = useState(null)
  const [facilitatorName, setFacilitatorName] = useState('')

	useEffect(() => {
		let cancelled = false
		let authSub = null
		;(async () => {
			try {
				const supabase = getSupabaseClient()
				if (supabase) {
					const { data: { session } } = await supabase.auth.getSession()
					setSession(session || null)
										if (session?.user) {
												// Fetch plan tier only; some deployments don't have name columns in profiles
												try {
													const { data: planRow } = await supabase.from('profiles').select('plan_tier').eq('id', session.user.id).maybeSingle()
													if (!cancelled && planRow?.plan_tier) setPlan(planRow.plan_tier)
												} catch {}
												if (!cancelled) {
														const meta = session?.user?.user_metadata || {}
														const profName = (meta.display_name || meta.full_name || meta.name || '').trim()
														setFacilitatorName(profName)

							// Try to get the canonical/effective tier from the billing summary API
							try {
								const token = session?.access_token || (await supabase.auth.getSession())?.data?.session?.access_token
								if (token) {
									const res = await fetch('/api/billing/manage/summary', { headers: { Authorization: `Bearer ${token}` } })
									const js = await res.json().catch(()=>null)
									if (res.ok && js) {
										const eff = (js?.effective_tier || js?.subscription?.tier || js?.plan_tier || null)
										if (eff) {
											if (!cancelled) setPlan(String(eff).toLowerCase())
										}
									}
								}
							} catch (e) {}
						}
					}
					// Subscribe to auth changes to keep UI in sync
					const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
						if (!cancelled) setSession(s || null)
					})
					authSub = sub?.subscription
				}
			} catch {}
			if (!cancelled) setLoading(false)
		})()
		return () => {
			cancelled = true
			try { authSub?.unsubscribe?.() } catch {}
		}
	}, [])

	// Clean up cache-busting param from trampoline
	useEffect(() => {
		try {
			if (typeof window === 'undefined') return
			const url = new URL(window.location.href)
			if (url.searchParams.has('rts')) {
				url.searchParams.delete('rts')
				window.history.replaceState(null, '', url.toString())
			}
		} catch {}
	}, [])

	async function openPortal() {
			try {
				// Use in-app embedded manage page to avoid stale portal history
				window.location.assign('/billing/manage')
			} catch (e) {
				alert(e?.message || 'Unable to open manage page')
			}
	}

		// Clear any stale Stripe action locks when this page becomes visible again
		useEffect(() => {
			const clearLocks = () => {
				try {
					const keys = Object.keys(sessionStorage || {})
					for (const k of keys) if (k.startsWith('stripe_action_lock_')) sessionStorage.removeItem(k)
				} catch {}
			}
				const onVis = () => {
					if (document.visibilityState === 'visible') {
						try {
							const pending = sessionStorage.getItem('stripe_nav_pending')
							if (pending) {
								sessionStorage.removeItem('stripe_nav_pending')
								window.location.reload();
								return
							}
						} catch {}
						clearLocks()
					}
				}
				const onShow = (e) => {
					if (e && e.persisted) {
						try { window.location.reload(); return } catch {}
						clearLocks()
					}
				}
			document.addEventListener('visibilitychange', onVis)
			window.addEventListener('pageshow', onShow)
			window.addEventListener('focus', onVis)
			return () => {
				document.removeEventListener('visibilitychange', onVis)
				window.removeEventListener('pageshow', onShow)
				window.removeEventListener('focus', onVis)
			}
		}, [])

	return (
		<div style={{ padding:'12px 24px 0' }}>
					<div style={{ width:'100%', maxWidth:560, margin:'0 auto' }}>
				<h1 style={{ marginTop:0, marginBottom:4, textAlign:'center' }}>{facilitatorName ? `Hi, ${facilitatorName}!` : 'Facilitator'}</h1>
				<p style={{ color:'#555', marginTop:0, marginBottom:12, textAlign:'center' }}>Choose a section to manage.</p>

						<div style={{ display:'flex', flexDirection:'column', gap:10 }}>
							<Link href="/facilitator/account" style={cardStyle}>Account</Link>
							<Link href="/facilitator/learners" style={cardStyle}>Learners</Link>
							<Link href="/facilitator/plan" style={cardStyle}>Plan</Link>
							<Link href="/facilitator/settings" style={cardStyle}>Settings</Link>
							<Link href="/facilitator/tools" style={cardStyle}>Tools</Link>
						</div>

	            {/* Billing summary */}
	            <section aria-label="Billing" style={{ marginTop:48, padding:8, border:'1px solid #e5e7eb', borderRadius:12, background:'#fff', textAlign:'center' }}>
	              <h2 style={{ margin:'0 0 4px', fontSize:18, textAlign:'center' }}>Billing</h2>
								<p style={{ margin:'0 0 8px', color:'#444', textAlign:'center' }}>
								Subscription: {loading ? '…' : (plan || 'free')}
							</p>
	              <div style={{ display:'flex', justifyContent:'center' }}>
	                <button type="button" onClick={openPortal} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#f7f7f7' }}>
	                  Manage subscription
	                </button>
	              </div>
	            </section>

	            {/* Auth control moved below Billing */}
	            <div style={{ marginTop:32, marginBottom:0 }}>
	            {hasSupabaseEnv() && (
	            session ? (
	            <button
	            onClick={async () => {
	            const supabase = getSupabaseClient();
	            try { await supabase?.auth?.signOut?.() } catch {}
	            router.push('/auth/login')
	            }}
	            style={authCardStyle}
	            >
	            Logout
	            </button>
	            ) : (
	            <Link href="/auth/login" style={authCardStyle}>Login</Link>
	            )
	            )}
	            </div>
			</div>
		</div>
	)
}

