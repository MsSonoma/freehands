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
import PhaseTimersOverlay from '@/app/session/components/PhaseTimersOverlay';
import AIFeaturesOverlay from './components/AIFeaturesOverlay';
import { loadPhaseTimersForLearner } from '@/app/session/utils/phaseTimerDefaults';

export default function LearnersPage() {
	const router = useRouter();
	const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true });
	const [pinChecked, setPinChecked] = useState(false);
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [savingId, setSavingId] = useState(null);
	const [savedId, setSavedId] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [planTier, setPlanTier] = useState('free');
    const [maxLearners, setMaxLearners] = useState(Infinity);
	// Shared current learner selection (same variable used on Learn page)
	const [selectedLearnerId, setSelectedLearnerId] = useState(null);

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

	const handleDelete = async (id) => {
			if (!confirm('Delete this learner?')) return;
			try {
				await deleteLearner(id);
				setItems(prev => prev.filter(x => x.id !== id));
			} catch (err) {
				alert(err?.message || 'Failed to delete learner');
			}
	};

	const handleInlineSave = async (idx, updated) => {
		const id = items[idx].id;
		setSavingId(id);
		setSavedId(null);
			try {
				const result = await updateLearner(id, updated);
			setItems(prev => prev.map((x,i) => i===idx ? { 
				...x, 
				...updated, 
				...(updated.targets?{
					comprehension: Number(updated.targets.comprehension),
					exercise: Number(updated.targets.exercise),
					worksheet: Number(updated.targets.worksheet),
					test: Number(updated.targets.test),
				}:{}),
				...(updated.session_timer_minutes !== undefined ? {
					session_timer_minutes: Number(updated.session_timer_minutes)
				}:{}),
				...(updated.golden_keys !== undefined ? {
					golden_keys: Number(updated.golden_keys)
				}:{} ),
			...(updated.humor_level !== undefined ? {
				humor_level: normalizeHumorLevel(updated.humor_level)
			}:{} ),
			...(updated.ask_disabled !== undefined ? {
				ask_disabled: !!updated.ask_disabled
			}:{} ),
			...(updated.poem_disabled !== undefined ? {
				poem_disabled: !!updated.poem_disabled
			}:{} ),
			...(updated.story_disabled !== undefined ? {
				story_disabled: !!updated.story_disabled
			}:{} ),
			...(updated.fill_in_fun_disabled !== undefined ? {
				fill_in_fun_disabled: !!updated.fill_in_fun_disabled
			}:{} ),
			// Phase timer fields
				...(updated.discussion_play_min !== undefined ? { discussion_play_min: Number(updated.discussion_play_min) } : {}),
				...(updated.discussion_work_min !== undefined ? { discussion_work_min: Number(updated.discussion_work_min) } : {}),
				...(updated.comprehension_play_min !== undefined ? { comprehension_play_min: Number(updated.comprehension_play_min) } : {}),
				...(updated.comprehension_work_min !== undefined ? { comprehension_work_min: Number(updated.comprehension_work_min) } : {}),
				...(updated.exercise_play_min !== undefined ? { exercise_play_min: Number(updated.exercise_play_min) } : {}),
				...(updated.exercise_work_min !== undefined ? { exercise_work_min: Number(updated.exercise_work_min) } : {}),
				...(updated.worksheet_play_min !== undefined ? { worksheet_play_min: Number(updated.worksheet_play_min) } : {}),
				...(updated.worksheet_work_min !== undefined ? { worksheet_work_min: Number(updated.worksheet_work_min) } : {}),
				...(updated.test_play_min !== undefined ? { test_play_min: Number(updated.test_play_min) } : {}),
				...(updated.test_work_min !== undefined ? { test_work_min: Number(updated.test_work_min) } : {}),
				...(updated.golden_key_bonus_min !== undefined ? { golden_key_bonus_min: Number(updated.golden_key_bonus_min) } : {})
			} : x));
			if (typeof window !== 'undefined' && String(selectedLearnerId) === String(id) && updated?.humor_level !== undefined) {
				const humorValue = normalizeHumorLevel(updated.humor_level);
				try {
					localStorage.setItem('learner_humor_level', humorValue);
					localStorage.setItem(`learner_humor_level_${id}`, humorValue);
				} catch {}
			}
			// Show saved notification
			setSavedId(id);
			// Clear saved notification after 2 seconds
			setTimeout(() => setSavedId(null), 2000);
			} catch (err) {
				alert(err?.message || 'Failed to save changes');
			} finally {
			setSavingId(null);
		}
	};

	if (!pinChecked || authLoading) {
		return <main style={{ padding: 24 }}><p>Loading…</p></main>;
	}

	return (
		<TutorialGuard>
			<main style={{ padding: 24, overflowX: 'hidden', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
			<div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
				<h1 style={{ marginTop:0, marginBottom:0 }}>Learners</h1>
				<div style={{ display:'flex', alignItems:'center', gap:12 }}>
					{Number.isFinite(maxLearners) && (
						<span style={{ color:'#666', fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)' }}>Plan: {planTier} • {items.length} / {maxLearners} learners</span>
					)}
					<Link
						href={items.length >= maxLearners ? '/facilitator/account/plan' : '/facilitator/learners/add'}
						aria-disabled={items.length >= maxLearners}
						style={{ padding:'10px 14px', border:'1px solid #111', borderRadius:8, background: items.length >= maxLearners ? '#999' : '#111', color:'#fff', textDecoration:'none', pointerEvents: items.length >= maxLearners ? 'none' : 'auto', opacity: items.length >= maxLearners ? 0.6 : 1 }}
					>
						Add Learner
					</Link>
				</div>
			</div>

			{items.length >= maxLearners && Number.isFinite(maxLearners) && (
				<div style={{ marginTop:12, padding:12, border:'1px solid #eee', borderRadius:8, background:'#fff' }}>
					<div style={{ fontWeight:600, marginBottom:6 }}>Learner limit reached</div>
					<div style={{ color:'#444', marginBottom:8 }}>Your current plan allows up to {maxLearners} learner{maxLearners===1?'':'s'}. Upgrade to add more learners.</div>
					<Link href="/facilitator/account/plan" style={{ padding:'8px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', textDecoration:'none' }}>View Plans</Link>
				</div>
			)}

							{errorMsg ? (
								errorMsg.toLowerCase().includes('please log in') ? (
									<div style={{ marginTop:16, padding:12, border:'1px solid #eee', borderRadius:8, background:'#fff' }}>
										<div style={{ color:'#444', marginBottom:8 }}>{errorMsg}</div>
										<a href="/auth/login" style={{ padding:'8px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', textDecoration:'none' }}>Go to Login</a>
									</div>
								) : (
									<p style={{ color:'#b00020', marginTop:16 }}>{errorMsg}</p>
								)
							) : loading ? (
				<p style={{ color:'#555', marginTop:16 }}>Loading…</p>
			) : items.length === 0 ? (
				<p style={{ color:'#555', marginTop:16 }}>No learners yet. Click &quot;Add Learner&quot; to create one.</p>
			) : (
				<div style={{ marginTop:16, display:'grid', gap:12, minWidth: 0 }}>
					{/* Header labels removed — labels are shown per-row */}
					{items.map((it, idx) => (
						<LearnerRow
                            key={it.id || idx}
                            item={it}
                            saving={savingId===it.id}
                            saved={savedId===it.id}
                            selected={String(selectedLearnerId) === String(it.id)}
							onToggleSelected={(checked)=>handleSelectLearner(it, checked)}
                            onSave={(u)=>handleInlineSave(idx,u)}
                            onDelete={()=>handleDelete(it.id)}
                        />
					))}
				</div>
			)}
		</main>
		
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

function Select({ value, onChange, options, ariaLabel, title }){
	return (
		<select value={value} onChange={onChange} aria-label={ariaLabel} title={title || ariaLabel} style={{ padding:'8px 10px', border:'1px solid #ddd', borderRadius:8, width:'100%', minWidth:0 }}>
			{options.map(o => <option key={o} value={o}>{o}</option>)}
		</select>
	);
}

// Compact Dial component for numeric targets. Keeps the same onChange signature
// as a native <select> by calling onChange({ target: { value } }).
function Dial({ value, onChange, options, ariaLabel, title }){
	// Accepts options array of strings. If all options parse to numbers, treat as numeric dial.
	const isNumeric = options.every(o => !Number.isNaN(Number(o)));

	// For categorical options (like grades), we'll map index -> label
	const labels = options.map(String);

	// Determine current index
	let idx = 0;
	if (isNumeric) {
		const nums = options.map(o => Number(o));
		const curNum = Number(value) || nums[0];
		// find nearest index for curNum
		idx = nums.indexOf(curNum);
		if (idx === -1) idx = 0;
	} else {
		idx = labels.indexOf(String(value));
		if (idx === -1) idx = 0;
	}

	const setIdx = (newIdx) => {
		const clamped = Math.max(0, Math.min(labels.length - 1, newIdx));
		if (clamped === idx) return;
		const out = labels[clamped];
		onChange && onChange({ target: { value: out } });
	};

	const step = (delta) => setIdx(idx + delta);

	const onKey = (e) => {
		if (['ArrowUp','ArrowRight'].includes(e.key)) { e.preventDefault(); step(1); }
		else if (['ArrowDown','ArrowLeft'].includes(e.key)) { e.preventDefault(); step(-1); }
		else if (e.key === 'PageUp') { e.preventDefault(); step(5); }
		else if (e.key === 'PageDown') { e.preventDefault(); step(-5); }
		else if (e.key === 'Home') { e.preventDefault(); setIdx(0); }
		else if (e.key === 'End') { e.preventDefault(); setIdx(labels.length - 1); }
	};

	const onWheel = (e) => {
		e.preventDefault();
		const delta = Math.sign(e.deltaY) * -1;
		step(delta);
	};

	// Design system styles (compact, darker primary button, accessible focus)
	const containerStyle = { display:'flex', alignItems:'center', gap:8, justifyContent:'space-between', padding:'6px 8px', border:'1px solid #e6e6e6', borderRadius:8, userSelect:'none', background:'#fff', width:'100%', maxWidth:100, minHeight:42 };
	const btnStyle = { padding:'6px 8px', border:'1px solid #ddd', borderRadius:6, background:'#fff', cursor:'pointer', flex:'0 0 auto', color:'#0b1220' };
	const valueStyle = { flex: '1 1 auto', textAlign:'center', fontWeight:700, color:'#0b1220' };

	// Accessible attributes
	const ariaProps = isNumeric ? {
		role: 'spinbutton',
		'aria-valuemin': Number(options[0]),
		'aria-valuemax': Number(options[options.length-1]),
		'aria-valuenow': Number(isNumeric ? options[idx] : idx),
		'aria-valuetext': labels[idx]
	} : {
		role: 'listbox',
		'aria-activedescendant': `dial-${ariaLabel || 'value'}-${idx}`
	};

	return (
		<div {...ariaProps} aria-label={ariaLabel} title={title || ariaLabel} tabIndex={0} onKeyDown={onKey} onWheel={onWheel} style={containerStyle}>
			<button
				type="button"
				aria-label={`Decrease ${ariaLabel || 'value'}`}
				aria-controls={`dial-${ariaLabel || 'value'}-${idx}`}
				tabIndex={-1}
				onClick={()=>step(-1)}
				disabled={idx <= 0}
				style={btnStyle}
			>
				◀
			</button>
			<div id={`dial-${ariaLabel || 'value'}-${idx}`} style={valueStyle}>{labels[idx]}</div>
			<button
				type="button"
				aria-label={`Increase ${ariaLabel || 'value'}`}
				aria-controls={`dial-${ariaLabel || 'value'}-${idx}`}
				tabIndex={-1}
				onClick={()=>step(1)}
				disabled={idx >= labels.length - 1}
				style={btnStyle}
			>
				▶
			</button>
		</div>
	);
}

// TimerDial component specifically for session timer (displays in hours and 15-minute increments)
function TimerDial({ value, onChange, ariaLabel }){
	const TIMER_OPTIONS = ['15', '30', '45', '60', '75', '90', '105', '120', '135', '150', '165', '180', '195', '210', '225', '240', '255', '270', '285', '300']; // minutes: 15min increments up to 5h
	const TIMER_LABELS = { 
		'15': '15m', '30': '30m', '45': '45m', 
		'60': '1h', '75': '1h 15m', '90': '1h 30m', '105': '1h 45m',
		'120': '2h', '135': '2h 15m', '150': '2h 30m', '165': '2h 45m',
		'180': '3h', '195': '3h 15m', '210': '3h 30m', '225': '3h 45m',
		'240': '4h', '255': '4h 15m', '270': '4h 30m', '285': '4h 45m',
		'300': '5h'
	};

	const labels = TIMER_OPTIONS.map(v => TIMER_LABELS[v]);
	let idx = TIMER_OPTIONS.indexOf(String(value));
	if (idx === -1) idx = 3; // default to 1 hour (60 minutes)

	const setIdx = (newIdx) => {
		const clamped = Math.max(0, Math.min(TIMER_OPTIONS.length - 1, newIdx));
		if (clamped === idx) return;
		const out = TIMER_OPTIONS[clamped];
		onChange && onChange({ target: { value: out } });
	};

	const step = (delta) => setIdx(idx + delta);

	const onKey = (e) => {
		if (['ArrowUp','ArrowRight'].includes(e.key)) { e.preventDefault(); step(1); }
		else if (['ArrowDown','ArrowLeft'].includes(e.key)) { e.preventDefault(); step(-1); }
		else if (e.key === 'Home') { e.preventDefault(); setIdx(0); }
		else if (e.key === 'End') { e.preventDefault(); setIdx(TIMER_OPTIONS.length - 1); }
	};

	const onWheel = (e) => {
		e.preventDefault();
		const delta = Math.sign(e.deltaY) * -1;
		step(delta);
	};

	const containerStyle = { display:'flex', alignItems:'center', gap:8, justifyContent:'space-between', padding:'6px 8px', border:'1px solid #e6e6e6', borderRadius:8, userSelect:'none', background:'#fff', width:'100%', maxWidth:100, minHeight:42 };
	const btnStyle = { padding:'6px 8px', border:'1px solid #ddd', borderRadius:6, background:'#fff', cursor:'pointer', flex:'0 0 auto', color:'#0b1220' };
	const valueStyle = { flex: '1 1 auto', textAlign:'center', fontWeight:700, color:'#0b1220' };

	return (
		<div
			role="spinbutton"
			aria-label={ariaLabel}
			aria-valuemin={1}
			aria-valuemax={20}
			aria-valuenow={idx + 1}
			aria-valuetext={labels[idx]}
			tabIndex={0}
			onKeyDown={onKey}
			onWheel={onWheel}
			style={containerStyle}
		>
			<button
				type="button"
				aria-label={`Decrease ${ariaLabel || 'timer'}`}
				tabIndex={-1}
				onClick={()=>step(-1)}
				disabled={idx <= 0}
				style={btnStyle}
			>
				◀
			</button>
			<div style={valueStyle}>{labels[idx]}</div>
			<button
				type="button"
				aria-label={`Increase ${ariaLabel || 'timer'}`}
				tabIndex={-1}
				onClick={()=>step(1)}
				disabled={idx >= TIMER_OPTIONS.length - 1}
				style={btnStyle}
			>
				▶
			</button>
		</div>
	);
}

const range = (a,b)=>Array.from({length:b-a+1},(_,i)=>String(a+i));
const GRADES = ['K',...range(1,12)];
const TARGETS = range(3,20);
const HUMOR_LEVELS = ['calm', 'funny', 'hilarious'];

const normalizeHumorLevel = (value) => {
	if (typeof value !== 'string') return 'calm';
	const v = value.trim().toLowerCase();
	return HUMOR_LEVELS.includes(v) ? v : 'calm';
};

function LearnerRow({ item, saving, saved, selected, onToggleSelected, onSave, onDelete }){
	const [name, setName] = useState(item.name || '');
	const [grade, setGrade] = useState(item.grade || 'K');
	const [comprehension, setComprehension] = useState(String(item.comprehension ?? item.targets?.comprehension ?? 3));
	const [exercise, setExercise] = useState(String(item.exercise ?? item.targets?.exercise ?? 3));
	const [worksheet, setWorksheet] = useState(String(item.worksheet ?? item.targets?.worksheet ?? 3));
	const [test, setTest] = useState(String(item.test ?? item.targets?.test ?? 3));
	const [sessionTimer, setSessionTimer] = useState(String(item.session_timer_minutes || '60'));
	const [goldenKeys, setGoldenKeys] = useState(String(item.golden_keys ?? 0));
	const [humorLevel, setHumorLevel] = useState(normalizeHumorLevel(item.humor_level));
	const [askDisabled, setAskDisabled] = useState(!!item.ask_disabled);
	const [poemDisabled, setPoemDisabled] = useState(!!item.poem_disabled);
	const [storyDisabled, setStoryDisabled] = useState(!!item.story_disabled);
	const [fillInFunDisabled, setFillInFunDisabled] = useState(!!item.fill_in_fun_disabled);
	const [showTimersOverlay, setShowTimersOverlay] = useState(false);
	const [showAIFeaturesOverlay, setShowAIFeaturesOverlay] = useState(false);
	const [phaseTimers, setPhaseTimers] = useState(() => loadPhaseTimersForLearner(item));

	useEffect(() => {
		if (item.session_timer_minutes !== undefined) {
			setSessionTimer(String(item.session_timer_minutes));
		}
		if (item.golden_keys !== undefined) {
			setGoldenKeys(String(item.golden_keys));
		}
		if (item.humor_level !== undefined) {
			setHumorLevel(normalizeHumorLevel(item.humor_level));
		} else {
			setHumorLevel('calm');
		}
		if (item.ask_disabled !== undefined) {
			setAskDisabled(!!item.ask_disabled);
		}
		if (item.poem_disabled !== undefined) {
			setPoemDisabled(!!item.poem_disabled);
		}
		if (item.story_disabled !== undefined) {
			setStoryDisabled(!!item.story_disabled);
		}
		if (item.fill_in_fun_disabled !== undefined) {
			setFillInFunDisabled(!!item.fill_in_fun_disabled);
		}
		// Reload phase timers from learner profile
		setPhaseTimers(loadPhaseTimersForLearner(item));
	}, [item.session_timer_minutes, item.golden_keys, item.humor_level, item.ask_disabled, item.poem_disabled, item.story_disabled, item.fill_in_fun_disabled, item]);

    // Responsive redesign: remove fixed 616px dial grid and allow wrapping on small screens.
    // Use flex for top row and auto-fit grid for dials.
    const actionBtnStyle = { padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:140 };
		return (
      <div style={{ border:'1px solid #eee', borderRadius:12, padding:12, background:'#fff', display:'grid', gap:14, minWidth:0 }}>
        {/* Top section: name + actions; wraps naturally */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-start', padding:'0 4px' }}>
					  <div className="ms-learner-name-block" style={{ display:'flex', flexDirection:'column', gap:6, flex:'0 0 50vw', width:'50vw', maxWidth:'50vw', minWidth:160 }}>
						<div className="ms-learner-name-label" style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>Name</div>
						<div style={{ display:'flex', alignItems:'center', gap:10, width:'100%' }}>
							<input
								className="ms-learner-name-input"
								aria-label="Name"
								title="Name"
								value={name}
								onChange={(e)=>setName(e.target.value)}
								placeholder="Name"
								style={{ padding:'8px 10px', border:'1px solid #ddd', borderRadius:8, flex:'1 1 auto', width:'auto', minWidth:0 }}
							/>
							{/* Selection checkbox to the right of the name field */}
							<label title="Set as current learner" style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', whiteSpace:'nowrap' }}>
								<input
									type="checkbox"
									aria-label="Set as current learner"
									checked={!!selected}
									onChange={(e)=>onToggleSelected && onToggleSelected(e.target.checked)}
									style={{ width:18, height:18, accentColor:'#c7442e' }}
								/>
								<span style={{ fontSize:'clamp(0.75rem, 1.3vw, 0.9rem)', color:'#333' }}>Current</span>
							</label>
						</div>
          </div>
					<div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'flex-end', alignItems:'center', flex:'1 1 320px' }}>
						<button onClick={()=>onSave({ name, grade, targets:{ comprehension, exercise, worksheet, test }, session_timer_minutes: Number(sessionTimer), golden_keys: Number(goldenKeys), humor_level: humorLevel, ask_disabled: askDisabled, poem_disabled: poemDisabled, story_disabled: storyDisabled, fill_in_fun_disabled: fillInFunDisabled })} disabled={saving} style={{ ...actionBtnStyle, color:'#0b1220' }}>{saving ? 'Saving…' : 'Save'}<span aria-hidden style={{ fontSize:16, lineHeight:1 }}>💾</span></button>
            {saved && (
			  <div style={{ padding:'8px 12px', background:'#d4f8d4', color:'#2d5a2d', borderRadius:8, fontSize:'clamp(0.9rem, 1.6vw, 1rem)', fontWeight:500 }}>Saved</div>
            )}
            <button onClick={onDelete} disabled={saving} style={actionBtnStyle}>
              <span>Delete</span>
			  <span aria-hidden style={{ fontSize:'clamp(1rem, 1.8vw, 1.125rem)', lineHeight:1 }}>🗑️</span>
            </button>
          </div>
        </div>

									{/* Tile grid: variable dials + transcripts tile with identical sizing/spacing */}
									<div style={{ display:'grid', gap:16, gridTemplateColumns:'repeat(auto-fit, minmax(88px, 1fr))', justifyItems:'center', alignItems:'start', width:'100%' }}>
									<div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:130 }}>
			<div style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>Grade</div>
            <Dial value={grade} onChange={e => setGrade(e.target.value)} options={GRADES} ariaLabel="Grade" title="Grade" />
									</div>
								<div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:130 }}>
						<div style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>Humor</div>
				            <Select value={humorLevel} onChange={e => setHumorLevel(normalizeHumorLevel(e.target.value))} options={HUMOR_LEVELS} ariaLabel="Humor level" title="Humor level" />
								</div>
								<div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:130 }}>
			<div style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>AI Features</div>
			<button
				onClick={() => setShowAIFeaturesOverlay(true)}
				aria-label="Configure AI features"
				title="Configure AI features"
				style={{
					padding: '10px 16px',
					border: '1px solid #ddd',
					borderRadius: 8,
					background: '#fff',
					cursor: 'pointer',
					fontSize: 'clamp(0.9rem, 1.6vw, 1rem)',
					color: '#0b1220',
					fontWeight: 500,
					width: '100%',
					maxWidth: 130
				}}
			>
				🤖 Setup
			</button>
								</div>
								<div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:130 }}>
		<div style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>Comprehension</div>
            <Dial value={comprehension} onChange={e => setComprehension(e.target.value)} options={TARGETS} ariaLabel="Comprehension" />
									</div>
									<div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:130 }}>
			<div style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>Exercise</div>
            <Dial value={exercise} onChange={e => setExercise(e.target.value)} options={TARGETS} ariaLabel="Exercise" />
									</div>
									<div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:130 }}>
			<div style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>Worksheet</div>
            <Dial value={worksheet} onChange={e => setWorksheet(e.target.value)} options={TARGETS} ariaLabel="Worksheet" />
									</div>
									<div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:130 }}>
			<div style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>Test</div>
            <Dial value={test} onChange={e => setTest(e.target.value)} options={TARGETS} ariaLabel="Test" />
									</div>
									<div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:130 }}>
			<div style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>Timers</div>
			<button
				onClick={() => setShowTimersOverlay(true)}
				aria-label="Configure phase timers"
				title="Configure phase timers"
				style={{
					padding: '10px 16px',
					border: '1px solid #ddd',
					borderRadius: 8,
					background: '#fff',
					cursor: 'pointer',
					fontSize: 'clamp(0.9rem, 1.6vw, 1rem)',
					color: '#0b1220',
					fontWeight: 500,
					width: '100%',
					maxWidth: 130
				}}
			>
				⏱️ Setup
			</button>
									</div>
									<div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:130 }}>
			<div style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>Golden Keys</div>
            <Dial value={goldenKeys} onChange={e => setGoldenKeys(e.target.value)} options={range(0, 10)} ariaLabel="Golden Keys" title="Golden Keys" />
									</div>

											{/* Transcripts as a matching tile */}
											{item?.id && (
																<div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:130 }}>
													<div style={{ fontSize:'clamp(0.8rem, 1.4vw, 0.9rem)', color:'#666' }}>Transcripts</div>
													<Link
														href={`/facilitator/learners/${item.id}/transcripts`}
														style={{
																			display:'flex', alignItems:'center', justifyContent:'center',
																			width:'100%', maxWidth:100, minHeight:42,
																			padding:'6px 8px',
																			border:'1px solid #e6e6e6', borderRadius:8,
																			background:'#fff', color:'#0b1220', textDecoration:'none',
																			whiteSpace:'nowrap'
														}}
													>
														Open
													</Link>
												</div>
											)}
      </div>
			
			{/* Phase Timers Overlay */}
			<PhaseTimersOverlay
				isOpen={showTimersOverlay}
				initialTimers={phaseTimers}
				onClose={() => setShowTimersOverlay(false)}
				onSave={(updatedTimers) => {
					setPhaseTimers(updatedTimers);
					setShowTimersOverlay(false);
					// updatedTimers is already in the flat format with keys like discussion_play_min
					// Call parent save with current values + timer updates
					onSave({
						name,
						grade,
						targets: { comprehension, exercise, worksheet, test },
					session_timer_minutes: Number(sessionTimer),
					golden_keys: Number(goldenKeys),
					humor_level: humorLevel,
					ask_disabled: askDisabled,
					poem_disabled: poemDisabled,
					story_disabled: storyDisabled,
					fill_in_fun_disabled: fillInFunDisabled,
					...updatedTimers  // Spread all 11 timer fields directly
					});
				}}
			/>
			
			{/* AI Features Overlay */}
			<AIFeaturesOverlay
				isOpen={showAIFeaturesOverlay}
				initialSettings={{
					ask_disabled: askDisabled,
					poem_disabled: poemDisabled,
					story_disabled: storyDisabled,
					fill_in_fun_disabled: fillInFunDisabled,
				}}
				onClose={() => setShowAIFeaturesOverlay(false)}
				onSave={(updatedFeatures) => {
					setAskDisabled(updatedFeatures.ask_disabled);
					setPoemDisabled(updatedFeatures.poem_disabled);
					setStoryDisabled(updatedFeatures.story_disabled);
					setFillInFunDisabled(updatedFeatures.fill_in_fun_disabled);
					setShowAIFeaturesOverlay(false);
					// Save all current values including updated AI feature settings
					onSave({
						name,
						grade,
						targets: { comprehension, exercise, worksheet, test },
						session_timer_minutes: Number(sessionTimer),
						golden_keys: Number(goldenKeys),
						humor_level: humorLevel,
						...updatedFeatures,
					});
				}}
			/>
								{/* Close outer card container */}
								</div>
    );
}
