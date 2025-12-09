"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

export default function SignupPage() {
	const router = useRouter();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [info, setInfo] = useState('');

	const onSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setInfo('');
		setLoading(true);
		try {
			if (!hasSupabaseEnv()) {
				// Dev-friendly fallback
				// Mark facilitator section as active to skip PIN on redirect
				try { sessionStorage.setItem('facilitator_section_active', '1'); } catch {}
				router.push('/facilitator');
				return;
			}
			const supabase = getSupabaseClient();
					const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : undefined);
					const emailRedirectTo = siteUrl ? `${siteUrl}/auth/callback` : undefined;
					const { data, error: signUpError } = await supabase.auth.signUp({
						email,
						password,
						options: emailRedirectTo ? { emailRedirectTo } : undefined,
					});
			if (signUpError) throw new Error(signUpError.message || 'Sign up failed');
			// If email confirmation is enabled, Supabase returns a session=null and sends an email
					if (!data?.session) {
						setInfo('Check your email to confirm your account, then return here to log in.');
						return; // do not redirect if confirmation required
					}
					// Mark facilitator section as active to skip PIN on redirect
					try { sessionStorage.setItem('facilitator_section_active', '1'); } catch {}
					router.push('/facilitator');
		} catch (err) {
			setError(err?.message || 'Sign up failed');
		} finally {
			setLoading(false);
		}
	};

	return (
		<main style={{ padding: 24, maxWidth: 380, margin: '0 auto' }}>
			<h1 style={{ marginTop: 0 }}>Sign up</h1>
			<form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
				<label style={{ display: 'grid', gap: 6 }}>
					<span>Email</span>
					<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required style={{ padding:'10px 12px', border:'1px solid #ddd', borderRadius: 8 }} />
				</label>
				<label style={{ display: 'grid', gap: 6 }}>
					<span>Password</span>
					<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" required style={{ padding:'10px 12px', border:'1px solid #ddd', borderRadius: 8 }} />
				</label>
				{error && <div style={{ color:'#b00020', fontSize: 14 }}>{error}</div>}
				{info && <div style={{ color:'#0b6b00', fontSize: 14 }}>{info}</div>}
				<button type="submit" disabled={loading} style={{ padding:'10px 14px', border:'1px solid #111', borderRadius: 8, background:'#111', color:'#fff' }}>{loading ? 'Signing up…' : 'Sign up'}</button>
				<p style={{ color:'#6b7280', fontSize: 12, marginTop: 8 }}>
					By creating an account you agree to the <a href="/legal/terms">Terms</a> and <a href="/legal/privacy">Privacy Policy</a>.
				</p>
				<div style={{ fontSize: 14 }}>
					Already have an account? <a href="/auth/login" style={{ color:'#111' }}>Log in</a>
				</div>
			</form>
		</main>
	);
}
