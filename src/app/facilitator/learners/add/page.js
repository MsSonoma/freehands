"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import { createLearner } from '../clientApi';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';
import { featuresForTier } from '@/app/lib/entitlements';
import { listLearners } from '../clientApi';
import OnboardingBanner from '@/app/components/OnboardingBanner';
import VideoTutorial from '@/app/components/VideoTutorial';
import { useOnboarding } from '@/app/hooks/useOnboarding';

const grades = [
	'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
];

const numericRange = (min, max) => Array.from({ length: (max - min + 1) }, (_, i) => String(min + i));
const targetOptions = numericRange(3, 20);
const humorLevels = ['calm', 'funny', 'hilarious'];

export default function AddLearnerPage() {
	const router = useRouter();
	// Read ?onboarding=1 client-side to avoid Suspense boundary requirement
	const [isOnboardingParam, setIsOnboardingParam] = useState(false);
	useEffect(() => {
		if (typeof window !== 'undefined') {
			setIsOnboardingParam(new URLSearchParams(window.location.search).get('onboarding') === '1');
		}
	}, []);
	const { step, advanceStep, STEPS } = useOnboarding();
	// Show onboarding banner when arriving from signup (?onboarding=1) or hook says step 1
	const showOnboarding = isOnboardingParam || step === STEPS.CREATE_LEARNER;
	const [settingsTipOpen, setSettingsTipOpen] = useState(false);
	const [pinChecked, setPinChecked] = useState(false);
	// Onboarding PIN gate: null=loading, 'needed', 'done'
	const [onboardingPinStatus, setOnboardingPinStatus] = useState(null)
	const [pinVal, setPinVal] = useState('')
	const [pinConfirm, setPinConfirm] = useState('')
	const [pinSaving, setPinSaving] = useState(false)
	const [pinMsg, setPinMsg] = useState('')
	const [name, setName] = useState('');
	const [grade, setGrade] = useState('K');
	const [comprehension, setComprehension] = useState('5');
	const [exercise, setExercise] = useState('10');
	const [worksheet, setWorksheet] = useState('15');
	const [test, setTest] = useState('10');
	const [humorLevel, setHumorLevel] = useState('calm');
	const [saving, setSaving] = useState(false);
		const [planTier, setPlanTier] = useState('free');
		const [maxLearners, setMaxLearners] = useState(Infinity);
		const [count, setCount] = useState(0);
		const atLimit = Number.isFinite(maxLearners) && count >= maxLearners;

		// Check PIN requirement on mount
		useEffect(() => {
			let cancelled = false;
			(async () => {
				try {
					const allowed = await ensurePinAllowed('facilitator-page');
					if (!allowed) {
						router.push('/');
						return;
					}
					if (!cancelled) setPinChecked(true);
				} catch (e) {
					if (!cancelled) setPinChecked(true);
				}
			})();
			return () => { cancelled = true; };
		}, [router]);
	// Check PIN during onboarding only — gate wizard until PIN is set
	useEffect(() => {
		if (!isOnboardingParam || !pinChecked) return
		let cancelled = false
		;(async () => {
			try {
				const supabase = getSupabaseClient()
				const { data: { session } } = await supabase.auth.getSession()
				const token = session?.access_token
				if (!token) { if (!cancelled) setOnboardingPinStatus('done'); return }
				const res = await fetch('/api/facilitator/pin', { headers: { Authorization: `Bearer ${token}` } })
				const js = await res.json().catch(() => ({}))
				if (!cancelled) setOnboardingPinStatus(res.ok && js?.ok && js?.hasPin ? 'done' : 'needed')
			} catch {
				if (!cancelled) setOnboardingPinStatus('done') // fail-open
			}
		})()
		return () => { cancelled = true }
	}, [isOnboardingParam, pinChecked])

	const handlePinSave = async (e) => {
		e?.preventDefault()
		setPinMsg('')
		if (!/^\d{4,8}$/.test(pinVal)) { setPinMsg('Use a 4–8 digit PIN'); return }
		if (pinVal !== pinConfirm) { setPinMsg('PINs do not match'); return }
		setPinSaving(true)
		try {
			const supabase = getSupabaseClient()
			const { data: { session } } = await supabase.auth.getSession()
			const token = session?.access_token
			if (!token) throw new Error('Sign in required')
			const res = await fetch('/api/facilitator/pin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ pin: pinVal, currentPin: null })
			})
			const js = await res.json().catch(() => ({}))
			if (!res.ok || !js?.ok) throw new Error(js?.error || 'Failed to save')
			setOnboardingPinStatus('done')
		} catch (err) {
			setPinMsg(err?.message || 'Failed to save')
		} finally {
			setPinSaving(false)
		}
	}
		// Load plan tier and current count
		useEffect(() => {
			if (!pinChecked) return;
			let cancelled = false;
			(async () => {
				try {
					// Count current learners (supports local fallback)
					const items = await listLearners();
					if (!cancelled) setCount(items.length);
					// Plan tier via Supabase if available
					let tier = 'free';
					if (hasSupabaseEnv()) {
						try {
							const supabase = getSupabaseClient();
							const { data: auth } = await supabase.auth.getUser();
							const uid = auth?.user?.id;
							if (uid) {
						const { data: prof } = await supabase.from('profiles').select('subscription_tier, plan_tier').eq('id', uid).maybeSingle();
						tier = resolveEffectiveTier(prof?.subscription_tier, prof?.plan_tier);
							}
						} catch {}
					}
					const ent = featuresForTier(tier);
					if (!cancelled) {
						setPlanTier(tier);
						setMaxLearners(ent.learnersMax);
					}
				} catch {}
			})();
			return () => { cancelled = true; };
		}, []);

	const handleSave = async (e) => {
		e.preventDefault();
		setSaving(true);
				try {
					if (atLimit) {
						alert(`Your ${planTier} plan allows up to ${maxLearners} learner${maxLearners===1?'':'s'}. Upgrade to add more.`);
						setSaving(false);
						return;
					}
					await createLearner({
					name,
					grade,
					targets: {
						comprehension,
						exercise,
						worksheet,
						test,
					},
					humor_level: humorLevel,
				});
					// If arriving from onboarding flow, advance step and go to generator
					if (showOnboarding) {
						await advanceStep(STEPS.GENERATE_LESSON);
						const gradeParam = grade ? `&grade=${encodeURIComponent(grade)}` : '';
						router.push(`/facilitator/generator?onboarding=1${gradeParam}`);
					} else {
						router.push('/facilitator/learners');
					}
			} finally {
			setSaving(false);
		}
	};

	// Onboarding PIN gate screen
	if (isOnboardingParam && pinChecked && onboardingPinStatus !== 'done') {
		return (
			<main style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
				{onboardingPinStatus === null ? (
					<p style={{ color: '#6b7280' }}>Loading…</p>
				) : (
					<>
						<div style={{ marginBottom: 20, padding: '14px 18px', background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)', border: '1px solid #e0e7ff', borderRadius: 12 }}>
							<h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#1e1b4b' }}>🔐 Set Your Facilitator PIN</h2>
							<p style={{ margin: 0, color: '#4338ca', fontSize: 14 }}>This PIN protects the facilitator area from learners. You&apos;ll need it to access settings, lessons, and this dashboard.</p>
						</div>
						<div style={{ display: 'grid', gap: 14 }}>
							<label style={{ display: 'grid', gap: 6 }}>
								<span style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>PIN <span style={{ fontWeight: 400, color: '#6b7280' }}>(4–8 digits)</span></span>
								<input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
									value={pinVal} onChange={e => setPinVal(e.target.value)}
									placeholder="e.g. 1234"
									style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 16, background: '#f9fafb' }} />
							</label>
							<label style={{ display: 'grid', gap: 6 }}>
								<span style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>Confirm PIN</span>
								<input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
									value={pinConfirm} onChange={e => setPinConfirm(e.target.value)}
									onKeyDown={e => e.key === 'Enter' && handlePinSave()}
									style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 16, background: '#f9fafb' }} />
							</label>
							{pinMsg && <p style={{ margin: 0, color: '#dc2626', fontSize: 14 }}>{pinMsg}</p>}
							<button type="button" onClick={handlePinSave} disabled={pinSaving}
								style={{ padding: '11px 20px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: pinSaving ? 'not-allowed' : 'pointer', opacity: pinSaving ? 0.7 : 1 }}>
								{pinSaving ? 'Saving…' : 'Set PIN & Continue →'}
							</button>
						</div>
					</>
				)}
			</main>
		)
	}

	return (
		<main style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
			<h1 style={{ marginTop: 0 }}>Add Learner</h1>

			{showOnboarding && (
				<>
					<OnboardingBanner
						step={1}
						title="Create your first learner"
						message="Give your learner a name and grade level. Targets and timers are already set to smart defaults — adjust them any time from the Learners page."
						action={
							<button type="button" onClick={() => setSettingsTipOpen((o) => !o)} style={{ background:'none', border:'none', color:'#6366f1', fontSize:13, fontWeight:600, cursor:'pointer', padding:0 }}>
								{settingsTipOpen ? '▲ Hide' : '▼ Show'} settings, targets &amp; timers
							</button>
						}
					/>
					<div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'10px 14px', background:'linear-gradient(135deg,#ede9fe 0%,#e0e7ff 100%)', border:'1px solid #c4b5fd', borderRadius:10 }}>
						<VideoTutorial
							src="/media/Mr. Mentor Wizard Helper.mp4"
							title="Mr. Mentor — Wizard Walkthrough"
							label="Watch the walkthrough"
							width={120}
						/>
						<div>
							<div style={{ fontWeight:700, fontSize:13, color:'#4c1d95', marginBottom:3 }}>🤖 Mr. Mentor explains it all</div>
							<div style={{ fontSize:12, color:'#5b21b6', lineHeight:1.5 }}>Watch a quick walkthrough of the setup wizard — you can move the video left or right so it doesn&apos;t block the page.</div>
						</div>
					</div>
				</>
			)}

			{showOnboarding && settingsTipOpen && (
				<div style={{ marginBottom:16, padding:'14px 16px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, fontSize:13, color:'#374151', lineHeight:1.6 }}>
					<p style={{ margin:'0 0 8px', fontWeight:600 }}>🎯 Targets — how many questions per phase</p>
					<p style={{ margin:'0 0 10px' }}>Start at 3 questions each and increase as your learner builds confidence.</p>
					<p style={{ margin:'0 0 8px', fontWeight:600 }}>⏱️ Timers — structured work and play</p>
					<p style={{ margin:'0 0 10px' }}>Work and play timers keep sessions on track. Fully configurable per learner from the Learners page.</p>
					<p style={{ margin:'0 0 8px', fontWeight:600 }}>⚙️ AI Features &amp; Settings</p>
					<p style={{ margin:0 }}>Stories, poems, Ask mode, and humor level are all adjustable. The defaults work great out of the box.</p>
				</div>
			)}

			{atLimit && (
				<div style={{ marginBottom:16, padding:12, border:'1px solid #eee', borderRadius:8, background:'#fff' }}>
					<div style={{ fontWeight:600, marginBottom:6 }}>Learner limit reached</div>
					<div style={{ color:'#444', marginBottom:8 }}>Your {planTier} plan allows up to {maxLearners} learner{maxLearners===1?'':'s'}. Upgrade to add more learners.</div>
					<a href="/facilitator/account/plan" style={{ padding:'8px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', textDecoration:'none' }}>View Plans</a>
				</div>
			)}

			<form onSubmit={handleSave} style={{ display: 'grid', gap: 12 }}>
				<label style={{ display: 'grid', gap: 6 }}>
					<span>Name</span>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Enter learner name"
						required
						style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}
					/>
				</label>

				<label style={{ display: 'grid', gap: 6 }}>
					<span>Grade</span>
					<select value={grade} onChange={(e) => setGrade(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}>
						{grades.map((g) => (
							<option key={g} value={g}>{g}</option>
						))}
					</select>
				</label>

				<label style={{ display: 'grid', gap: 6 }}>
					<span>Humor Level</span>
					<select value={humorLevel} onChange={(e) => setHumorLevel(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}>
						{humorLevels.map((level) => (
							<option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
						))}
					</select>
				</label>

				<label style={{ display: 'grid', gap: 6 }}>
					<span>Comprehension Target</span>
					<select value={comprehension} onChange={(e) => setComprehension(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}>
						{targetOptions.map((n) => (
							<option key={'c'+n} value={n}>{n}</option>
						))}
					</select>
				</label>

				<label style={{ display: 'grid', gap: 6 }}>
					<span>Exercise Target</span>
					<select value={exercise} onChange={(e) => setExercise(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}>
						{targetOptions.map((n) => (
							<option key={'e'+n} value={n}>{n}</option>
						))}
					</select>
				</label>

				<label style={{ display: 'grid', gap: 6 }}>
					<span>Worksheet Target</span>
					<select value={worksheet} onChange={(e) => setWorksheet(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}>
						{targetOptions.map((n) => (
							<option key={'w'+n} value={n}>{n}</option>
						))}
					</select>
				</label>

				<label style={{ display: 'grid', gap: 6 }}>
					<span>Test Target</span>
					<select value={test} onChange={(e) => setTest(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}>
						{targetOptions.map((n) => (
							<option key={'t'+n} value={n}>{n}</option>
						))}
					</select>
				</label>

				<div style={{ display:'flex', gap:8, marginTop:4 }}>
					<button type="submit" disabled={saving || atLimit} style={{ padding: '10px 14px', border: '1px solid #111', borderRadius: 8, background: atLimit ? '#999' : '#111', color: '#fff', opacity: atLimit ? 0.6 : 1 }}>
						{saving ? 'Saving…' : 'Save'}
					</button>
					<button type="button" onClick={() => router.push('/facilitator/learners')} style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
						Cancel
					</button>
				</div>
			</form>
		</main>
	);
}

