"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [autoResent, setAutoResent] = useState(false);
	const [resendLoading, setResendLoading] = useState(false);
	const [info, setInfo] = useState('');
	// MFA (TOTP) challenge state
	const [mfaRequired, setMfaRequired] = useState(false);
	const [mfaFactorId, setMfaFactorId] = useState('');
	const [mfaChallengeId, setMfaChallengeId] = useState('');
	const [mfaCode, setMfaCode] = useState('');
	const [mfaLoading, setMfaLoading] = useState(false);
	const [mfaError, setMfaError] = useState('');

	// Clean any rts param after OAuth return
	useEffect(() => {
		try {
			if (typeof window === 'undefined') return;
			const url = new URL(window.location.href);
			if (url.searchParams.has('rts')) {
				url.searchParams.delete('rts');
				window.history.replaceState(null, '', url.toString());
			}
		} catch {}
	}, []);

	const onSubmit = async (e) => {
		e.preventDefault();
		setError('');
			setMfaError('');
		setLoading(true);
		try {
			if (!hasSupabaseEnv()) {
				// Dev-friendly fallback: pretend login works locally
				router.push('/facilitator');
				return;
			}
			const supabase = getSupabaseClient();
						const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
						if (signInError) {
							// MFA required flow
							const factors = signInData?.mfa?.factors || [];
							const totp = factors.find((f) => f?.factor_type === 'totp' || f?.type === 'totp');
							if (totp) {
								try {
									const { data: challengeData, error: challErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
									if (challErr) throw challErr;
									setMfaRequired(true);
									setMfaFactorId(totp.id);
									setMfaChallengeId(challengeData?.id || '');
									setInfo('');
									setError('');
									return; // Stop normal navigation; await MFA verification
								} catch (mfaErr) {
									setError(mfaErr?.message || 'Unable to start two-factor challenge');
									return;
								}
							}
						// Common case: unconfirmed email
						const msg = signInError.message || '';
						if (/confirm/i.test(msg) || /email not confirmed/i.test(msg)) {
							// Automatically resend confirmation once per submit attempt
							if (!autoResent && email) {
								try {
									await supabase.auth.resend({ type: 'signup', email });
									setAutoResent(true);
									throw new Error('Your email is not confirmed yet. We just sent another confirmation email. Please check your inbox and try again after confirming.');
								} catch (resendErr) {
									throw new Error('Your email is not confirmed yet, and we could not resend the confirmation automatically. Please use the Resend link below.');
								}
							}
							throw new Error('Please confirm your email before logging in.');
						}
						throw new Error(signInError.message || 'Login failed');
					}
			router.push('/facilitator');
		} catch (err) {
			setError(err?.message || 'Login failed');
		} finally {
			setLoading(false);
		}
	};

			const resendConfirmation = async () => {
				if (!hasSupabaseEnv()) {
					setError('Email auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
					return;
				}
				try {
					setError('');
					setInfo('');
					setResendLoading(true);
					const supabase = getSupabaseClient();
					const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
					const { error } = await supabase.auth.resend({ type: 'signup', email, options: emailRedirectTo ? { emailRedirectTo } : undefined });
					if (error) throw new Error(error.message || 'Could not resend confirmation');
					setInfo('Confirmation email resent. Please check your inbox and spam folder.');
				} catch (err) {
					setError(err?.message || 'Could not resend confirmation');
				} finally {
					setResendLoading(false);
				}
			};

	return (
		<main style={{ padding: 24, maxWidth: 380, margin: '0 auto' }}>
			<h1 style={{ marginTop: 0 }}>Login</h1>
						<form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
				<label style={{ display: 'grid', gap: 6 }}>
					<span>Email</span>
					<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required style={{ padding:'10px 12px', border:'1px solid #ddd', borderRadius: 8 }} />
				</label>
				{hasSupabaseEnv() && (
					<div style={{ display:'flex', justifyContent:'flex-start' }}>
						<button type="button" onClick={resendConfirmation} disabled={!email || resendLoading} aria-label="Resend confirmation email"
							style={{ border:'none', background:'transparent', color:'#111', textDecoration:'underline', cursor: (!email || resendLoading) ? 'not-allowed' : 'pointer', padding:0 }}>
							{resendLoading ? 'Resending…' : 'Resend confirmation email'}
						</button>
					</div>
				)}
				<label style={{ display: 'grid', gap: 6 }}>
					<span>Password</span>
					<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" required style={{ padding:'10px 12px', border:'1px solid #ddd', borderRadius: 8 }} />
				</label>
					{mfaRequired && (
						<div style={{ display: 'grid', gap: 8, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
							<div style={{ color: '#111', fontWeight: 600 }}>Two-factor code</div>
							<input
								type="text"
								inputMode="numeric"
								pattern="[0-9]*"
								placeholder="123456"
								value={mfaCode}
								onChange={(e) => setMfaCode(e.target.value)}
								style={{ padding:'10px 12px', border:'1px solid #ddd', borderRadius: 8 }}
							/>
							{mfaError && <div style={{ color:'#b00020', fontSize: 14 }}>{mfaError}</div>}
							<div style={{ display: 'flex', gap: 8 }}>
								<button
									type="button"
									onClick={async () => {
										setMfaLoading(true); setMfaError(''); setError('');
										try {
											const supabase = getSupabaseClient();
											const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, code: mfaCode, challengeId: mfaChallengeId });
											if (error) throw error;
											router.push('/facilitator');
										} catch (err) {
											setMfaError(err?.message || 'Invalid code');
										} finally { setMfaLoading(false); }
									}}
									disabled={mfaLoading || !mfaCode || mfaCode.length < 6}
									style={{ padding:'10px 14px', border:'1px solid #111', borderRadius: 8, background:'#111', color:'#fff' }}
								>
									{mfaLoading ? 'Verifying…' : 'Verify & sign in'}
								</button>
								<button
									type="button"
									onClick={() => { setMfaRequired(false); setMfaCode(''); setMfaError(''); setMfaChallengeId(''); setMfaFactorId(''); }}
									disabled={mfaLoading}
									style={{ padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius: 8, background:'#fff', color:'#111' }}
								>
									Cancel
								</button>
							</div>
						</div>
					)}
						{error && (
							<div style={{ color:'#b00020', fontSize: 14 }}>
								{error}
								{/confirm/i.test(error) && email && (
									<>
										{' '}
										<button type="button" onClick={resendConfirmation} style={{ border:'none', background:'transparent', color:'#111', textDecoration:'underline', cursor:'pointer' }}>
											Resend confirmation email
										</button>
									</>
								)}
							</div>
						)}
						{info && (
							<div style={{ color:'#0b6b00', fontSize: 14 }}>{info}</div>
						)}
						<button type="submit" disabled={loading} style={{ padding:'10px 14px', border:'1px solid #111', borderRadius: 8, background:'#111', color:'#fff' }}>{loading ? 'Signing in…' : 'Sign in'}</button>
					{hasSupabaseEnv() && (
						<button
							type="button"
							onClick={async () => {
								try {
									const supabase = getSupabaseClient();
									const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/facilitator?rts=${Date.now()}` : undefined;
									const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: redirectTo ? { redirectTo } : {} });
									if (error) throw error;
									if (data?.url) window.location.assign(data.url);
								} catch (err) {
									setError(err?.message || 'Google sign-in failed');
								}
							}}
							style={{ padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius: 8, background:'#fff', color:'#111' }}
						>
							Continue with Google
						</button>
					)}
						<div style={{ fontSize: 14 }}>
							Don’t have an account? <a href="/auth/signup" style={{ color:'#111' }}>Sign up</a>
						</div>
			</form>
		</main>
	);
}
