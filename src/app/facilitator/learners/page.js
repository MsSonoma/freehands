"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listLearners, deleteLearner, updateLearner } from './clientApi';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';
import { featuresForTier } from '@/app/lib/entitlements';

export default function LearnersPage() {
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [savingId, setSavingId] = useState(null);
	const [savedId, setSavedId] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [planTier, setPlanTier] = useState('free');
    const [maxLearners, setMaxLearners] = useState(Infinity);

	useEffect(() => {
		let mounted = true;
		(async () => {
			setLoading(true);
			try {
				const data = await listLearners();
				// Fetch plan_tier if possible to compute max learners
				let tier = 'free';
				if (hasSupabaseEnv()) {
					try {
						const supabase = getSupabaseClient();
						const { data: auth } = await supabase.auth.getUser();
						const uid = auth?.user?.id;
						if (uid) {
							const { data: prof } = await supabase.from('profiles').select('plan_tier').eq('id', uid).maybeSingle();
							tier = (prof?.plan_tier || 'free').toLowerCase();
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
	}, []);

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
		setSavedId(null); // Clear any existing saved notification
			try {
				await updateLearner(id, updated);
			setItems(prev => prev.map((x,i) => i===idx ? { ...x, ...updated, ...(updated.targets?{
				comprehension: Number(updated.targets.comprehension),
				exercise: Number(updated.targets.exercise),
				worksheet: Number(updated.targets.worksheet),
				test: Number(updated.targets.test),
			}:{}) } : x));
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

	return (
		<main style={{ padding: 24, overflowX: 'hidden' }}>
			<div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
				<h1 style={{ marginTop:0, marginBottom:0 }}>Learners</h1>
				<div style={{ display:'flex', alignItems:'center', gap:12 }}>
					{Number.isFinite(maxLearners) && (
						<span style={{ color:'#666', fontSize:13 }}>Plan: {planTier} • {items.length} / {maxLearners} learners</span>
					)}
					<Link
						href={items.length >= maxLearners ? '/facilitator/plan' : '/facilitator/learners/add'}
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
					<Link href="/facilitator/plan" style={{ padding:'8px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', textDecoration:'none' }}>View Plans</Link>
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
						<LearnerRow key={it.id || idx} item={it} saving={savingId===it.id} saved={savedId===it.id} onSave={(u)=>handleInlineSave(idx,u)} onDelete={()=>handleDelete(it.id)} />
					))}
				</div>
			)}
		</main>
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
	const containerStyle = { display:'flex', alignItems:'center', gap:8, justifyContent:'space-between', padding:'6px 8px', border:'1px solid #e6e6e6', borderRadius:8, userSelect:'none', background:'#fff', width:'100%', maxWidth:100 };
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

const range = (a,b)=>Array.from({length:b-a+1},(_,i)=>String(a+i));
const GRADES = ['K',...range(1,12)];
const TARGETS = range(3,20);

function LearnerRow({ item, saving, saved, onSave, onDelete }){
	const [name, setName] = useState(item.name || '');
	const [grade, setGrade] = useState(item.grade || 'K');
	const [comprehension, setComprehension] = useState(String(item.comprehension ?? item.targets?.comprehension ?? 3));
	const [exercise, setExercise] = useState(String(item.exercise ?? item.targets?.exercise ?? 3));
	const [worksheet, setWorksheet] = useState(String(item.worksheet ?? item.targets?.worksheet ?? 3));
	const [test, setTest] = useState(String(item.test ?? item.targets?.test ?? 3));

	return (
		<div style={{ border:'1px solid #eee', borderRadius:12, padding:12, background:'#fff', display:'grid', gap:10, minWidth:0 }}>
			{/* Top row: Name, Grade, and action buttons (buttons span columns 3-6) */}
			<div style={{ display:'grid', gridTemplateColumns:'minmax(0, 2fr) repeat(5, minmax(0, 1fr))', gap:14, alignItems:'start', padding:'0 12px', minWidth:0 }}>
				<div style={{ display:'flex', flexDirection:'column', gap:6 }}>
					<div style={{ fontSize:12, color:'#666' }}>Name</div>
					<input aria-label="Name" title="Name" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Name" style={{ padding:'8px 10px', border:'1px solid #ddd', borderRadius:8, width:'100%', minWidth:0 }} />
				</div>
				{/* Grade moved to the dial group below — removed from top row */}
				<div style={{ gridColumn: '3 / span 4', display:'flex', gap:8, justifyContent:'flex-end', alignItems:'center', marginTop:16 }}>
					<button onClick={()=>onSave({ name, grade, targets:{ comprehension, exercise, worksheet, test } })} disabled={saving} style={{ width:140, padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff', color:'#0b1220', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>{saving ? 'Saving…' : 'Save'}
						<span aria-hidden style={{ fontSize:16, lineHeight:1 }}>💾</span>
					</button>
					{saved && (
						<div style={{ padding:'8px 12px', background:'#d4f8d4', color:'#2d5a2d', borderRadius:8, fontSize:14, fontWeight:500 }}>
							Saved
						</div>
					)}
					<button onClick={onDelete} disabled={saving} style={{ width:140, padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
						<span>Delete</span>
						<span aria-hidden style={{ fontSize:16, lineHeight:1 }}>🗑️</span>
					</button>
				</div>
			</div>

			{/* Bottom row: centered group of target dials */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, alignItems: 'center' }}>
						<div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 104px)', gap: 24, alignItems: 'start', justifyItems: 'center', width: 104 * 5 + 24 * 4, maxWidth: '100%' }}>
									<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
										<div style={{ fontSize: 12, color: '#666' }}>Grade</div>
										<Dial value={grade} onChange={e => setGrade(e.target.value)} options={GRADES} ariaLabel="Grade" title="Grade" />
									</div>

									<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
										<div style={{ fontSize: 12, color: '#666' }}>Comprehension</div>
										<Dial value={comprehension} onChange={e => setComprehension(e.target.value)} options={TARGETS} ariaLabel="Comprehension" />
									</div>

									<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
										<div style={{ fontSize: 12, color: '#666' }}>Exercise</div>
										<Dial value={exercise} onChange={e => setExercise(e.target.value)} options={TARGETS} ariaLabel="Exercise" />
									</div>

									<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
										<div style={{ fontSize: 12, color: '#666' }}>Worksheet</div>
										<Dial value={worksheet} onChange={e => setWorksheet(e.target.value)} options={TARGETS} ariaLabel="Worksheet" />
									</div>

									<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
										<div style={{ fontSize: 12, color: '#666' }}>Test</div>
										<Dial value={test} onChange={e => setTest(e.target.value)} options={TARGETS} ariaLabel="Test" />
									</div>
								</div>
							</div>
						</div>
		</div>
	);
}
