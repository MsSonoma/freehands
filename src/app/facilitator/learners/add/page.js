"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import { createLearner } from '../clientApi';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';
import { featuresForTier, resolveEffectiveTier } from '@/app/lib/entitlements';
import { listLearners } from '../clientApi';
import { useAccessControl } from '@/app/hooks/useAccessControl';
import GatedOverlay from '@/app/components/GatedOverlay';

const grades = [
	'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
];

const numericRange = (min, max) => Array.from({ length: (max - min + 1) }, (_, i) => String(min + i));
const targetOptions = numericRange(3, 20);
const humorLevels = ['calm', 'funny', 'hilarious'];

export default function AddLearnerPage() {
	const router = useRouter();
	const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: 'required' });
	const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
	const [pinChecked, setPinChecked] = useState(false);
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
			if (authLoading || !isAuthenticated) return;
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
		}, [authLoading, isAuthenticated, router]);
		// Load plan tier and current count
		useEffect(() => {
			if (!pinChecked || !isAuthenticated) return;
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
		}, [isAuthenticated, pinChecked]);

	const handleSave = async (e) => {
		e.preventDefault();
		if (!isAuthenticated) return;
		setSaving(true);
				try {
					if (atLimit) {
						alert(`Your ${planTier} plan allows up to ${maxLearners} learner${maxLearners===1?'':'s'}. Upgrade to add more.`);
						setSaving(false);
						return;
					}
					const createdLearner = await createLearner({
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
					router.push('/facilitator');
			} finally {
			setSaving(false);
		}
	};

	if (authLoading || (isAuthenticated && !pinChecked)) {
		return <main style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}><p style={{ color: '#6b7280' }}>Loading...</p></main>;
	}

	if (!isAuthenticated) {
		return (
			<main style={{ minHeight: 320 }}>
				<GatedOverlay
					show
					gateType={gateType || 'auth'}
					feature="Learner Creation"
					emoji="🔒"
					description="Sign in to create a persistent learner profile and save learner-specific progress."
					benefits={[
						'Create persistent learner profiles',
						'Save lesson progress and transcripts',
						'Keep learner data tied to your facilitator account',
					]}
				/>
			</main>
		);
	}

	return (
		<main style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
			<h1 style={{ marginTop: 0 }}>Add Learner</h1>

			<div style={{ marginBottom: 16, color: '#4b5563', lineHeight: 1.5 }}>Add the learner name and grade. You can adjust advanced settings now or later from the Learners page.</div>

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


					<button type="button" onClick={() => setAdvancedSettingsOpen((open) => !open)} style={{ justifySelf:'start', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff', color:'#374151', fontWeight:600 }}>
						{advancedSettingsOpen ? 'Hide advanced settings' : 'Advanced settings'}
					</button>

					{advancedSettingsOpen && (
						<div style={{ display:'grid', gap:12, padding:12, border:'1px solid #e5e7eb', borderRadius:8, background:'#f9fafb' }}>
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
						</div>
					)}

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

