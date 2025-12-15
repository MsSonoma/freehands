"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { listLearners, deleteLearner, updateLearner } from './clientApi';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';
import { featuresForTier, resolveEffectiveTier } from '@/app/lib/entitlements';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import { useAccessControl } from '@/app/hooks/useAccessControl';
import GatedOverlay from '@/app/components/GatedOverlay';
import TutorialGuard from '@/components/TutorialGuard';
import LearnerEditOverlay from './components/LearnerEditOverlay';
import { PageHeader, InlineExplainer } from '@/components/FacilitatorHelp';

export default function LearnersPage() {
	const router = useRouter();
	const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true });
	const [pinChecked, setPinChecked] = useState(false);
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [planTier, setPlanTier] = useState('free');
    const [maxLearners, setMaxLearners] = useState(Infinity);
	const [selectedLearnerId, setSelectedLearnerId] = useState(null);
	const [editingBasicInfo, setEditingBasicInfo] = useState(null);
	const [editingTargets, setEditingTargets] = useState(null);
	const [editingAiFeatures, setEditingAiFeatures] = useState(null);
	const [editingTimers, setEditingTimers] = useState(null);

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

	useEffect(() => {
		if (!pinChecked) return;
		let mounted = true;
		(async () => {
			setLoading(true);
			try {
				const data = await listLearners();
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
				if (mounted) {
					setPlanTier(tier);
					setMaxLearners(ent.learnersMax);
					setItems(data);
				}
			} catch (err) {
                const msg = err?.message || String(err) || 'Failed to load learners';
                if (mounted) setErrorMsg(msg);
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => { mounted = false; };
	}, [pinChecked]);

	// Initialize current selection from localStorage to keep in sync with Learn page
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const id = localStorage.getItem('learner_id') || null;
		setSelectedLearnerId(id);
	}, []);

	// Ensure selection remains valid when items change (e.g., after delete)
	useEffect(() => {
		if (!items?.length) return;
		if (!selectedLearnerId) return;
		if (!items.some(x => String(x.id) === String(selectedLearnerId))) {
			// Clear selection if the learner no longer exists
			if (typeof window !== 'undefined') localStorage.removeItem('learner_id');
			setSelectedLearnerId(null);
		}
	}, [items, selectedLearnerId]);

	const handleSelectLearner = (learner, checked) => {
		// Only one may be selected at a time and mirror Learn page behavior
		if (typeof window === 'undefined') return;
		try {
			if (checked) {
				const previousId = localStorage.getItem('learner_id');
				// Persist current learner id/name/grade
				localStorage.setItem('learner_id', String(learner.id));
				if (learner.name != null) localStorage.setItem('learner_name', learner.name);
				if (learner.grade != null) localStorage.setItem('learner_grade', String(learner.grade));
				const humorValue = normalizeHumorLevel(learner.humor_level);
				localStorage.setItem('learner_humor_level', humorValue);
				if (learner?.id != null) {
					localStorage.setItem(`learner_humor_level_${learner.id}`, humorValue);
				}

				// Clear any global target overrides so learner-specific targets are used
				localStorage.removeItem('target_comprehension');
				localStorage.removeItem('target_exercise');
				localStorage.removeItem('target_worksheet');
				localStorage.removeItem('target_test');

				// Also clear any learner-specific overrides for the previous learner to avoid leakage
				if (previousId && previousId !== String(learner.id)) {
					localStorage.removeItem(`target_comprehension_${previousId}`);
					localStorage.removeItem(`target_exercise_${previousId}`);
					localStorage.removeItem(`target_worksheet_${previousId}`);
					localStorage.removeItem(`target_test_${previousId}`);
				}

				setSelectedLearnerId(String(learner.id));
			} else {
				// Allow deselect to clear current learner completely
				localStorage.removeItem('learner_id');
				localStorage.removeItem('learner_name');
				localStorage.removeItem('learner_grade');
				localStorage.removeItem('learner_humor_level');
				setSelectedLearnerId(null);
			}
		} catch {}
	};

	const handleDelete = async (id, learnerName) => {
		if (!confirm(`Delete ${learnerName || 'this learner'}?`)) return;
		try {
			await deleteLearner(id);
			setItems(prev => prev.filter(x => x.id !== id));
		} catch (err) {
			alert(err?.message || 'Failed to delete learner');
		}
	};

	const handleSaveLearner = async (idx, updates) => {
		const learner = items[idx];
		try {
			await updateLearner(learner.id, updates);
			setItems(prev => prev.map((x, i) => i === idx ? { ...x, ...updates } : x));
			
			// Update localStorage if this is the current learner
			if (String(selectedLearnerId) === String(learner.id)) {
				if (updates.name != null) localStorage.setItem('learner_name', updates.name);
				if (updates.grade != null) localStorage.setItem('learner_grade', String(updates.grade));
				if (updates.humor_level != null) {
					const humorValue = normalizeHumorLevel(updates.humor_level);
					localStorage.setItem('learner_humor_level', humorValue);
					localStorage.setItem(`learner_humor_level_${learner.id}`, humorValue);
				}
			}
			
			setEditingBasicInfo(null);
		} catch (err) {
			throw err; // Let overlay handle the error
		}
	};

	// Card styling matching Account page
	const cardStyle = {
		background: '#fff',
		border: '1px solid #e5e7eb',
		borderRadius: 8,
		padding: '14px',
		cursor: 'pointer',
		transition: 'all 0.2s',
		display: 'flex',
		alignItems: 'center',
		gap: 12,
		boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
		position: 'relative'
	};

	const iconStyle = {
		fontSize: 24,
		flexShrink: 0,
		width: 36,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center'
	};

	if (!pinChecked || authLoading) {
		return <main style={{ padding: 24 }}><p>Loading…</p></main>;
	}

	return (
		<TutorialGuard>
			<style jsx>{`
				.button-text-tablet {
					display: none !important;
				}
				@media (min-width: 640px) {
					.button-text-tablet {
						display: inline !important;
					}
				}
			`}</style>
			<main style={{ padding: 7, overflowX: 'hidden', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
				<div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
					<PageHeader
						title="Learners"
						subtitle="Manage your students and customize their learning experience"
					>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
								<span style={{ fontSize: 13, color: '#6b7280' }}>🎯 Targets</span>
								<InlineExplainer
									helpKey="learner-targets-info"
									title="Learning Targets"
									placement="bottom"
								>
									<p>Set how many questions appear in each lesson phase (Comprehension, Exercise, Worksheet, Test).</p>
									<p className="mt-2 text-xs text-gray-500">Higher numbers = more practice, longer lessons.</p>
								</InlineExplainer>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
								<span style={{ fontSize: 13, color: '#6b7280' }}>🤖 AI Features</span>
								<InlineExplainer
									helpKey="learner-ai-features-info"
									title="AI Features"
									placement="bottom"
								>
									<p>Control which AI-powered activities are available: Ask (custom questions), Poem generation, Story mode, and Fill-in-Fun games.</p>
									<p className="mt-2 text-xs text-gray-500">Disable features you don't want learners to access during lessons.</p>
								</InlineExplainer>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
								<span style={{ fontSize: 13, color: '#6b7280' }}>⏱️ Timers</span>
								<InlineExplainer
									helpKey="learner-timers-info"
									title="Phase Timers"
									placement="bottom"
								>
									<p>Set Play time (games/exploration) and Work time (lesson tasks) for each of the 5 lesson phases.</p>
									<p className="mt-2 text-xs text-gray-500">Timers help learners manage time and stay focused.</p>
								</InlineExplainer>
							</div>
						</div>
					</PageHeader>

					{/* Header with plan info */}
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
						{Number.isFinite(maxLearners) && (
							<span style={{ color: '#6b7280', fontSize: 14 }}>
								Plan: {planTier} • {items.length} / {maxLearners} learner{maxLearners === 1 ? '' : 's'}
							</span>
						)}
						<div style={{ flex: '1 1 auto' }}></div>
					</div>

			{items.length >= maxLearners && Number.isFinite(maxLearners) && (
				<div style={{
					marginBottom: 12,
					padding: 14,
					border: '1px solid #e5e7eb',
					borderRadius: 8,
					background: '#fff',
					boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
				}}>
					<div style={{ fontWeight: 600, marginBottom: 6, color: '#111' }}>⚠️ Learner limit reached</div>
					<div style={{ color: '#6b7280', marginBottom: 8, fontSize: 14 }}>Your current plan allows up to {maxLearners} learner{maxLearners === 1 ? '' : 's'}. Upgrade to add more learners.</div>
					<Link
						href="/facilitator/account/plan"
						style={{
							display: 'inline-block',
							padding: '8px 12px',
							border: '1px solid #3b82f6',
							borderRadius: 8,
							background: '#3b82f6',
							color: '#fff',
							textDecoration: 'none',
							fontSize: 14,
							fontWeight: 600,
							transition: 'all 0.2s'
						}}
					>
						View Plans
					</Link>
				</div>
			)}

			{errorMsg ? (
				errorMsg.toLowerCase().includes('please log in') ? (
					<div style={{
						padding: 14,
						border: '1px solid #e5e7eb',
						borderRadius: 8,
						background: '#fff',
						boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
					}}>
						<div style={{ color: '#6b7280', marginBottom: 8, fontSize: 14 }}>{errorMsg}</div>
						<a
						href="/auth/login"
						style={{
							display: 'inline-block',
							padding: '8px 12px',
							border: '1px solid #3b82f6',
							borderRadius: 8,
							background: '#3b82f6',
							color: '#fff',
							textDecoration: 'none',
							fontSize: 14,
							fontWeight: 600
						}}
						>
							Go to Login
						</a>
					</div>
				) : (
					<p style={{ color: '#b00020', fontSize: 14 }}>{errorMsg}</p>
				)
			) : loading ? (
				<p style={{ color: '#6b7280', fontSize: 14 }}>Loading…</p>
			) : (
				<>
					{/* Learner cards grid */}
					<div style={{
						display: 'grid',
						gridTemplateColumns: '1fr',
						gap: 12,
						marginBottom: 16
					}}>
						{/* Add Learner Card */}
						{items.length < maxLearners ? (
							<Link
								href="/facilitator/learners/add"
								style={{ textDecoration: 'none' }}
							>
							<div
								style={cardStyle}
								onMouseEnter={(e) => {
									e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
									e.currentTarget.style.borderColor = '#9ca3af';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
									e.currentTarget.style.borderColor = '#e5e7eb';
								}}
							>
									<div style={iconStyle}>➕</div>
									<div style={{ flex: 1 }}>
										<div style={{ fontWeight: 600, fontSize: 15, color: '#111', marginBottom: 2 }}>Add New Learner</div>
										<div style={{ fontSize: 13, color: '#6b7280' }}>Create a new student profile</div>
									</div>
								</div>
							</Link>
						) : (
							<div
								style={{
									...cardStyle,
									cursor: 'not-allowed',
									opacity: 0.6,
									borderColor: '#fca5a5',
									background: '#fef2f2'
								}}
								onClick={() => router.push('/facilitator/account/plan')}
								onMouseEnter={(e) => {
									e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)';
									e.currentTarget.style.borderColor = '#b00020';
									e.currentTarget.style.cursor = 'pointer';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
									e.currentTarget.style.borderColor = '#fca5a5';
								}}
							>
								<div style={{ ...iconStyle, color: '#b00020' }}>⚠️</div>
								<div style={{ flex: 1 }}>
									<div style={{ fontWeight: 600, fontSize: 15, color: '#b00020', marginBottom: 2 }}>Learner Limit Reached</div>
									<div style={{ fontSize: 13, color: '#991b1b' }}>Upgrade to add more learners</div>
								</div>
							</div>
						)}

						{/* Existing Learner Cards */}
						{items.map((learner, idx) => {
							const isSelected = String(selectedLearnerId) === String(learner.id);
							return (
								<div
									key={learner.id || idx}
									style={{
										...cardStyle,
										borderColor: isSelected ? '#c7442e' : '#e5e7eb',
										background: isSelected ? '#fff5f5' : '#fff'
									}}
							onClick={() => handleSelectLearner(learner, true)}
							onMouseEnter={(e) => {
								e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
								if (!isSelected) e.currentTarget.style.borderColor = '#9ca3af';
							}}
								onMouseLeave={(e) => {
									e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
									if (!isSelected) e.currentTarget.style.borderColor = '#e5e7eb';
								}}
								>
									{isSelected && (
										<div style={{
											position: 'absolute',
											top: -8,
											right: -8,
											background: '#c7442e',
											color: '#fff',
											borderRadius: '50%',
											width: 28,
											height: 28,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											fontSize: 16,
											boxShadow: '0 2px 8px rgba(199, 68, 46, 0.3)'
										}}>
											🌟
										</div>
									)}
									
									<div style={iconStyle}>👤</div>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ fontWeight: 600, fontSize: 15, color: '#111', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
											{learner.name || 'Unnamed Learner'}
										</div>
										<div style={{ fontSize: 13, color: '#6b7280' }}>
											Grade {learner.grade || 'K'} • {learner.humor_level || 'calm'}
										</div>
										<div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
											{learner.golden_keys || 0} 🔑 • Targets: {learner.comprehension || learner.targets?.comprehension || 3}-{learner.test || learner.targets?.test || 3}
										</div>
									</div>

								{/* Tab buttons */}
								<div
									className="learner-card-actions"
									style={{
										position: 'absolute',
										top: '50%',
										transform: 'translateY(-50%)',
										right: 8,
										display: 'flex',
										gap: 4
									}}
									onClick={(e) => e.stopPropagation()}
								>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setEditingBasicInfo(learner);
									}}
									title="Basic Info"
									style={{
										border: 'none',
										background: '#3b82f6',
										color: '#fff',
										borderRadius: 6,
										padding: '4px 8px',
										fontSize: 14,
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										gap: 6
									}}
								>
									<span>👤</span>
									<span style={{ display: 'none' }} className="button-text-tablet">Basic</span>
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setEditingTargets(learner);
									}}
									title="Learning Targets"
									style={{
										border: 'none',
										background: '#3b82f6',
										color: '#fff',
										borderRadius: 6,
										padding: '4px 8px',
										fontSize: 14,
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										gap: 6
									}}
								>
									<span>🎯</span>
									<span style={{ display: 'none' }} className="button-text-tablet">Targets</span>
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setEditingAiFeatures(learner);
									}}
									title="AI Features"
									style={{
										border: 'none',
										background: '#3b82f6',
										color: '#fff',
										borderRadius: 6,
										padding: '4px 8px',
										fontSize: 14,
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										gap: 6
									}}
								>
									<span>🤖</span>
									<span style={{ display: 'none' }} className="button-text-tablet">AI</span>
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setEditingTimers(learner);
									}}
									title="Timers"
									style={{
										border: 'none',
										background: '#3b82f6',
										color: '#fff',
										borderRadius: 6,
										padding: '4px 8px',
										fontSize: 14,
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										gap: 6
									}}
								>
									<span>⏱️</span>
									<span style={{ display: 'none' }} className="button-text-tablet">Timers</span>
								</button>
								</div>
								</div>
							);
						})}
					</div>
				</>
			)}
				</div>
		</main>
		
		{/* Basic Info Overlay */}
		<LearnerEditOverlay
			isOpen={!!editingBasicInfo}
			learner={editingBasicInfo ? { ...editingBasicInfo, initialTab: 'basic' } : null}
			onClose={() => setEditingBasicInfo(null)}
			onSave={async (updates) => {
				const idx = items.findIndex(item => item.id === editingBasicInfo.id);
				if (idx !== -1) {
					await handleSaveLearner(idx, updates);
				}
			}}
			onDelete={handleDelete}
		/>

		{/* Learning Targets Overlay */}
		<LearnerEditOverlay
			isOpen={!!editingTargets}
			learner={editingTargets ? { ...editingTargets, initialTab: 'targets' } : null}
			onClose={() => setEditingTargets(null)}
			onSave={async (updates) => {
				const idx = items.findIndex(item => item.id === editingTargets.id);
				if (idx !== -1) {
					await handleSaveLearner(idx, updates);
				}
			}}
		/>

		{/* AI Features Overlay */}
		<LearnerEditOverlay
			isOpen={!!editingAiFeatures}
			learner={editingAiFeatures ? { ...editingAiFeatures, initialTab: 'ai-features' } : null}
			onClose={() => setEditingAiFeatures(null)}
			onSave={async (updates) => {
				const idx = items.findIndex(item => item.id === editingAiFeatures.id);
				if (idx !== -1) {
					await handleSaveLearner(idx, updates);
				}
			}}
		/>

		{/* Timers Overlay */}
		<LearnerEditOverlay
			isOpen={!!editingTimers}
			learner={editingTimers ? { ...editingTimers, initialTab: 'timers' } : null}
			onClose={() => setEditingTimers(null)}
			onSave={async (updates) => {
				const idx = items.findIndex(item => item.id === editingTimers.id);
				if (idx !== -1) {
					await handleSaveLearner(idx, updates);
				}
			}}
		/>
		
		<GatedOverlay
			show={!isAuthenticated}
			gateType={gateType}
			feature="Learner Management"
			emoji="👥"
			description="Sign in to create and manage learners, track their progress, and customize their learning experience."
			benefits={[
				'Create and manage multiple learners',
				'Track progress and performance across lessons',
				'Customize grade levels and learning targets',
				'Sync learner data across all your devices'
			]}
		/>
		</TutorialGuard>
	);
}

// Helper function for normalizing humor level values
const normalizeHumorLevel = (value) => {
	if (typeof value !== 'string') return 'calm';
	const v = value.trim().toLowerCase();
	const HUMOR_LEVELS = ['calm', 'funny', 'hilarious'];
	return HUMOR_LEVELS.includes(v) ? v : 'calm';
};
