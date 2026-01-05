"use client";

import { useState, useEffect } from 'react';
import { 
	loadPhaseTimersForLearner,
	PHASE_DISPLAY_NAMES,
	TIMER_TYPE_EMOJI,
	TIMER_TYPE_NAMES,
	getDefaultPhaseTimers
} from '@/app/session/utils/phaseTimerDefaults';
import { InlineExplainer } from '@/components/FacilitatorHelp';

const GRADES = ['K', ...Array.from({length: 12}, (_, i) => String(i + 1))];
const TARGETS = Array.from({length: 18}, (_, i) => String(i + 3)); // 3-20
const HUMOR_LEVELS = ['calm', 'funny', 'hilarious'];

const normalizeHumorLevel = (value) => {
	if (typeof value !== 'string') return 'calm';
	const v = value.trim().toLowerCase();
	return HUMOR_LEVELS.includes(v) ? v : 'calm';
};

export default function LearnerEditOverlay({ isOpen, learner, onClose, onSave, onDelete }) {
	const [activeTab, setActiveTab] = useState(learner?.initialTab || 'basic'); // 'basic' | 'targets' | 'ai-features' | 'timers'
	
	// Form state
	const [name, setName] = useState('');
	const [grade, setGrade] = useState('K');
	const [humorLevel, setHumorLevel] = useState('calm');
	const [comprehension, setComprehension] = useState('3');
	const [exercise, setExercise] = useState('3');
	const [worksheet, setWorksheet] = useState('3');
	const [test, setTest] = useState('3');
	const [goldenKeys, setGoldenKeys] = useState('0');
	const [askDisabled, setAskDisabled] = useState(false);
	const [poemDisabled, setPoemDisabled] = useState(false);
	const [storyDisabled, setStoryDisabled] = useState(false);
	const [fillInFunDisabled, setFillInFunDisabled] = useState(false);
	const [phaseTimers, setPhaseTimers] = useState(getDefaultPhaseTimers());
	const [hoveredTooltip, setHoveredTooltip] = useState(null);
	const [clickedTooltip, setClickedTooltip] = useState(null);
	const [showHelp, setShowHelp] = useState(false);
	const [autoAdvancePhases, setAutoAdvancePhases] = useState(true);
	
	const [saving, setSaving] = useState(false);

	// Initialize form when learner changes
	useEffect(() => {
		if (!learner) return;
		
		setActiveTab(learner.initialTab || 'basic');
		setName(learner.name || '');
		setGrade(learner.grade || 'K');
		setHumorLevel(normalizeHumorLevel(learner.humor_level));
		setComprehension(String(learner.targets?.comprehension ?? learner.comprehension ?? ''));
		setExercise(String(learner.targets?.exercise ?? learner.exercise ?? ''));
		setWorksheet(String(learner.targets?.worksheet ?? learner.worksheet ?? ''));
		setTest(String(learner.targets?.test ?? learner.test ?? ''));
		setGoldenKeys(String(learner.golden_keys ?? 0));
		setAskDisabled(!!learner.ask_disabled);
		setPoemDisabled(!!learner.poem_disabled);
		setStoryDisabled(!!learner.story_disabled);
		setFillInFunDisabled(!!learner.fill_in_fun_disabled);
		setPhaseTimers({ ...getDefaultPhaseTimers(), ...loadPhaseTimersForLearner(learner) });
		setAutoAdvancePhases(learner.auto_advance_phases !== false); // Default true if not set
	}, [learner]);

	const handleTimerChange = (phase, type, value) => {
		const key = `${phase}_${type}_min`;
		setPhaseTimers(prev => ({ ...prev, [key]: value }));
	};

	const handleGoldenKeyChange = (value) => {
		setPhaseTimers(prev => ({ ...prev, golden_key_bonus_min: value }));
	};

	const handleTooltipHover = (key, isEntering) => {
		if (!clickedTooltip) {
			setHoveredTooltip(isEntering ? key : null);
		}
	};

	const handleTooltipClick = (key) => {
		if (clickedTooltip === key) {
			setClickedTooltip(null);
			setHoveredTooltip(null);
		} else {
			setClickedTooltip(key);
			setHoveredTooltip(null);
		}
	};

	const showTooltip = (key) => hoveredTooltip === key || clickedTooltip === key;

	const handleSave = async () => {
		setSaving(true);
		try {
			await onSave({
				name,
				grade,
				humor_level: humorLevel,
				targets: {
					comprehension: Number(comprehension),
					exercise: Number(exercise),
					worksheet: Number(worksheet),
					test: Number(test)
				},
				golden_keys: Number(goldenKeys),
				ask_disabled: askDisabled,
				poem_disabled: poemDisabled,
				story_disabled: storyDisabled,
				fill_in_fun_disabled: fillInFunDisabled,
				auto_advance_phases: autoAdvancePhases,
				...phaseTimers
			});
			onClose();
		} catch (error) {
			alert(error?.message || 'Failed to save changes');
		} finally {
			setSaving(false);
		}
	};

	if (!isOpen) return null;

	const overlayStyle = {
		position: 'fixed',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		background: 'rgba(0, 0, 0, 0.5)',
		backdropFilter: 'blur(4px)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1000,
		padding: 16
	};

	const modalStyle = {
		background: '#fff',
		borderRadius: 12,
		boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
		maxWidth: 600,
		width: '100%',
		height: '90vh',
		display: 'flex',
		flexDirection: 'column'
	};

	const headerStyle = {
		padding: '20px 24px',
		borderBottom: '1px solid #e5e7eb',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center'
	};

	const tabsStyle = {
		display: 'flex',
		gap: 4,
		padding: '12px 24px 0',
		borderBottom: '1px solid #e5e7eb',
		overflowX: 'auto',
		flexShrink: 0
	};

	const tabStyle = (active) => ({
		padding: '8px 16px',
		border: 'none',
		background: active ? '#3b82f6' : 'transparent',
		color: active ? '#fff' : '#6b7280',
		borderRadius: '8px 8px 0 0',
		cursor: 'pointer',
		fontSize: 14,
		fontWeight: active ? 600 : 400,
		transition: 'all 0.2s',
		whiteSpace: 'nowrap'
	});

	const contentStyle = {
		padding: 24,
		overflowY: 'auto',
		flex: 1,
		minHeight: 0
	};

	const footerStyle = {
		padding: '16px 24px',
		borderTop: '1px solid #e5e7eb',
		display: 'flex',
		gap: 12,
		justifyContent: 'space-between',
		alignItems: 'flex-start'
	};

	const buttonStyle = {
		padding: '10px 20px',
		border: '1px solid #3b82f6',
		borderRadius: 8,
		background: '#3b82f6',
		color: '#fff',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
		transition: 'all 0.2s'
	};

	const secondaryButtonStyle = {
		...buttonStyle,
		background: '#fff',
		color: '#6b7280',
		border: '1px solid #e5e7eb'
	};

	const labelStyle = {
		display: 'block',
		fontSize: 14,
		fontWeight: 600,
		color: '#374151',
		marginBottom: 6
	};

	const inputStyle = {
		width: '100%',
		padding: '10px 12px',
		border: '1px solid #e5e7eb',
		borderRadius: 8,
		fontSize: 14,
		outline: 'none',
		transition: 'border-color 0.2s'
	};

	const selectStyle = {
		...inputStyle,
		cursor: 'pointer'
	};

	const fieldStyle = {
		marginBottom: 20
	};

	const gridStyle = {
		display: 'grid',
		gridTemplateColumns: 'repeat(2, 1fr)',
		gap: 16
	};

	const toggleButtonStyle = (enabled) => ({
		padding: '10px 16px',
		border: `2px solid ${enabled ? '#10b981' : '#ef4444'}`,
		borderRadius: 8,
		background: enabled ? '#d1fae5' : '#fee2e2',
		color: enabled ? '#065f46' : '#991b1b',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
		transition: 'all 0.2s',
		display: 'flex',
		alignItems: 'center',
		gap: 8
	});

	const getTitle = () => {
		switch (activeTab) {
			case 'basic': return '👤 Basic Info';
			case 'targets': return '🎯 Learning Targets';
			case 'ai-features': return '🤖 AI Features';
			case 'timers': return '⏱️ Timers';
			default: return 'Edit Learner';
		}
	};

	return (
		<div style={overlayStyle} onClick={onClose}>
			<div style={modalStyle} onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div style={headerStyle}>
						<div>
							<h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
								{getTitle()}
							</h2>
							<p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
								{name || 'Configure learner settings'}
							</p>
						</div>
						<button
							onClick={onClose}
							style={{
								border: 'none',
								background: 'none',
								fontSize: 24,
								cursor: 'pointer',
								color: '#6b7280',
								padding: 4
							}}
						>
							×
						</button>
					</div>

					{/* Content */}
					<div style={contentStyle}>
						{activeTab === 'basic' && (
							<div>
								<div style={fieldStyle}>
									<label style={labelStyle}>Name</label>
									<input
										type="text"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="Enter learner name"
										style={inputStyle}
									/>
								</div>

								<div style={gridStyle}>
									<div style={fieldStyle}>
										<label style={labelStyle}>Grade Level</label>
										<select
											value={grade}
											onChange={(e) => setGrade(e.target.value)}
											style={selectStyle}
										>
											{GRADES.map(g => (
												<option key={g} value={g}>{g}</option>
											))}
										</select>
									</div>

									<div style={fieldStyle}>
										<label style={labelStyle}>Humor Level</label>
										<select
											value={humorLevel}
											onChange={(e) => setHumorLevel(e.target.value)}
											style={selectStyle}
										>
											{HUMOR_LEVELS.map(h => (
												<option key={h} value={h}>
													{h.charAt(0).toUpperCase() + h.slice(1)}
												</option>
											))}
										</select>
									</div>
								</div>

								<div style={fieldStyle}>
									<label style={labelStyle}>Golden Keys</label>
									<select
										value={goldenKeys}
										onChange={(e) => setGoldenKeys(e.target.value)}
										style={selectStyle}
									>
										{Array.from({length: 11}, (_, i) => String(i)).map(k => (
											<option key={k} value={k}>{k}</option>
										))}
									</select>
									<p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
										Number of golden keys available to unlock bonus time
									</p>
								</div>

								<div style={fieldStyle}>
									<label style={labelStyle}>Phase Begin Buttons</label>
									<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
										<button
											onClick={() => setAutoAdvancePhases(!autoAdvancePhases)}
											style={{
												display: 'flex',
												alignItems: 'center',
												width: 52,
												height: 28,
												borderRadius: 14,
												border: 'none',
												padding: 2,
												cursor: 'pointer',
												background: autoAdvancePhases ? '#3b82f6' : '#d1d5db',
												transition: 'background 0.2s',
												position: 'relative'
											}}
										>
											<div style={{
												width: 24,
												height: 24,
												borderRadius: '50%',
												background: '#fff',
												boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
												transform: autoAdvancePhases ? 'translateX(24px)' : 'translateX(0)',
												transition: 'transform 0.2s'
											}} />
										</button>
										<span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>
											{autoAdvancePhases ? 'Show Buttons' : 'Auto-Advance'}
										</span>
									</div>
									<p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
										{autoAdvancePhases 
											? 'Learner must click "Begin" at each phase transition' 
											: 'Phases auto-start after completion (prevents break stalling). Initial Begin button still shows.'}
									</p>
								</div>

								{/* Additional Actions */}
								<div style={{ 
									marginTop: 24, 
									paddingTop: 24, 
									borderTop: '1px solid #e5e7eb',
									display: 'flex',
									gap: 12,
									flexWrap: 'wrap'
								}}>
									{learner?.id && (
										<a
											href={`/facilitator/learners/${learner.id}/transcripts`}
											target="_blank"
											rel="noopener noreferrer"
											style={{
												display: 'inline-flex',
												alignItems: 'center',
												gap: 8,
												padding: '8px 16px',
												background: '#3b82f6',
												color: '#fff',
												borderRadius: 8,
												textDecoration: 'none',
												fontSize: 14,
												fontWeight: 500,
												cursor: 'pointer'
											}}
										>
											📄 View Transcripts
										</a>
									)}
									{learner?.id && onDelete && (
										<button
											onClick={() => {
												const confirmation = window.prompt(
													`Are you sure you want to delete ${name}?\n\nThis cannot be undone. Type "delete learner" to confirm:`
												);
												if (confirmation === 'delete learner') {
													onDelete(learner.id, name);
													onClose();
												} else if (confirmation !== null) {
													alert('Deletion cancelled. You must type "delete learner" exactly to confirm.');
												}
											}}
											style={{
												display: 'inline-flex',
												alignItems: 'center',
												gap: 8,
												padding: '8px 16px',
												background: '#ef4444',
												color: '#fff',
												border: 'none',
												borderRadius: 8,
												fontSize: 14,
												fontWeight: 500,
												cursor: 'pointer'
											}}
										>
											🗑️ Delete Learner
										</button>
									)}
								</div>
							</div>
						)}

						{activeTab === 'targets' && (
							<div>
								<p style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280' }}>
									Set the number of questions for each activity type
								</p>
								<div style={gridStyle}>
									<div style={fieldStyle}>
										<label style={labelStyle}>Comprehension</label>
										<select
											value={comprehension}
											onChange={(e) => setComprehension(e.target.value)}
											style={selectStyle}
										>
											{TARGETS.map(t => (
												<option key={t} value={t}>{t} questions</option>
											))}
										</select>
									</div>

									<div style={fieldStyle}>
										<label style={labelStyle}>Exercise</label>
										<select
											value={exercise}
											onChange={(e) => setExercise(e.target.value)}
											style={selectStyle}
										>
											{TARGETS.map(t => (
												<option key={t} value={t}>{t} questions</option>
											))}
										</select>
									</div>

									<div style={fieldStyle}>
										<label style={labelStyle}>Worksheet</label>
										<select
											value={worksheet}
											onChange={(e) => setWorksheet(e.target.value)}
											style={selectStyle}
										>
											{TARGETS.map(t => (
												<option key={t} value={t}>{t} questions</option>
											))}
										</select>
									</div>

									<div style={fieldStyle}>
										<label style={labelStyle}>Test</label>
										<select
											value={test}
											onChange={(e) => setTest(e.target.value)}
											style={selectStyle}
										>
											{TARGETS.map(t => (
												<option key={t} value={t}>{t} questions</option>
											))}
										</select>
									</div>
								</div>
							</div>
						)}

						{activeTab === 'ai-features' && (
							<div>
								<p style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280' }}>
									Enable or disable individual AI features for this learner
								</p>

								<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
									<div>
										<label style={{ ...labelStyle, marginBottom: 8 }}>Ask Feature</label>
										<button
											onClick={() => setAskDisabled(!askDisabled)}
											style={toggleButtonStyle(!askDisabled)}
										>
											<span>{!askDisabled ? '✅' : '🚫'}</span>
											<span>{!askDisabled ? 'Enabled' : 'Disabled'}</span>
										</button>
										<p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
											Vocabulary questions during lessons
										</p>
									</div>

									<div>
										<label style={{ ...labelStyle, marginBottom: 8 }}>Poem Feature</label>
										<button
											onClick={() => setPoemDisabled(!poemDisabled)}
											style={toggleButtonStyle(!poemDisabled)}
										>
											<span>{!poemDisabled ? '✅' : '🚫'}</span>
											<span>{!poemDisabled ? 'Enabled' : 'Disabled'}</span>
										</button>
										<p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
											Silly poems based on lesson content
										</p>
									</div>

									<div>
										<label style={{ ...labelStyle, marginBottom: 8 }}>Story Feature</label>
										<button
											onClick={() => setStoryDisabled(!storyDisabled)}
											style={toggleButtonStyle(!storyDisabled)}
										>
											<span>{!storyDisabled ? '✅' : '🚫'}</span>
											<span>{!storyDisabled ? 'Enabled' : 'Disabled'}</span>
										</button>
										<p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
											Short stories related to the lesson
										</p>
									</div>

									<div>
										<label style={{ ...labelStyle, marginBottom: 8 }}>Fill-in-Fun Feature</label>
										<button
											onClick={() => setFillInFunDisabled(!fillInFunDisabled)}
											style={toggleButtonStyle(!fillInFunDisabled)}
										>
											<span>{!fillInFunDisabled ? '✅' : '🚫'}</span>
											<span>{!fillInFunDisabled ? 'Enabled' : 'Disabled'}</span>
										</button>
										<p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
											Mad libs style activities
										</p>
									</div>
								</div>

							<div style={{ marginTop: 20, padding: 12, background: '#f3f4f6', borderRadius: 8 }}>
								<p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
									💡 Learn more about <a href="/about#ai-features" target="_blank" style={{ color: '#3b82f6', fontWeight: 600 }}>AI features</a>
								</p>
							</div>
							</div>
						)}

						{activeTab === 'timers' && (
							<div>
						{/* Info note with explanation */}
						<div style={{
							background: '#eff6ff',
							border: '1px solid #bfdbfe',
							borderRadius: 8,
							padding: 12,
							marginBottom: 16
						}}>
							<div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
								<h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', margin: 0 }}>
									Phase Timers Explained
								</h4>
								<InlineExplainer
									helpKey="phase-timers-details"
									title="About Phase Timers"

								>
									<p><strong>Play Timer:</strong> Time for games and warm-up activities at the start of each phase. The learner can explore and have fun before focusing on lesson work.</p>
									<p className="mt-2"><strong>Work Timer:</strong> Time for actual lesson tasks (questions, exercises, etc). When this expires, a 30-second countdown begins before moving to the next phase.</p>
									<p className="mt-2 text-xs">Timers create structure and help learners manage their time during lessons.</p>
								</InlineExplainer>
							</div>
							<p style={{ fontSize: 12, color: '#1e40af', margin: 0, lineHeight: 1.4 }}>
								Each lesson phase has two timers: <strong>Play</strong> (games before work) and <strong>Work</strong> (actual tasks). 
								Click phase names for details.
							</p>
						</div>						{/* Phase timers */}
						{['discussion', 'comprehension', 'exercise', 'worksheet', 'test'].map((phase) => (
							<div key={phase} style={{ marginBottom: 12 }}>
								{/* Phase header with tooltip */}
								<div style={{ position: 'relative', marginBottom: 6 }}>
											<div
												style={{
													fontSize: 16,
													fontWeight: 700,
													color: '#374151',
													cursor: 'help',
													display: 'inline-block',
													borderBottom: '1px dotted #9ca3af',
													userSelect: 'none'
												}}
												onMouseEnter={() => handleTooltipHover(`phase-${phase}`, true)}
												onMouseLeave={() => handleTooltipHover(`phase-${phase}`, false)}
												onClick={() => handleTooltipClick(`phase-${phase}`)}
											>
												{PHASE_DISPLAY_NAMES[phase]}
											</div>

											{/* Tooltip */}
											{showTooltip(`phase-${phase}`) && (
												<div style={{
													position: 'absolute',
													top: '100%',
													left: 0,
													marginTop: 6,
													background: '#1f2937',
													color: '#fff',
													padding: '8px 12px',
													borderRadius: 6,
													fontSize: 12,
													lineHeight: 1.4,
													boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
													zIndex: 10,
													maxWidth: 280,
													whiteSpace: 'normal'
												}}>
													<strong>Play:</strong> Time from "Begin {PHASE_DISPLAY_NAMES[phase]}" to "Go" button (games/exploration).
													<br />
													<strong>Work:</strong> Time from "Go" to next phase (actual lesson work).
												</div>
											)}
										</div>

										{/* Timer dials side-by-side */}
										<div style={{ 
											display: 'grid', 
											gridTemplateColumns: '1fr 1fr', 
											gap: 12 
										}}>
											{/* Play timer */}
											<div>
												<label style={{
													display: 'block',
													fontSize: 13,
													fontWeight: 600,
													color: '#059669',
													marginBottom: 6,
													cursor: 'help',
													position: 'relative'
												}}
													onMouseEnter={() => handleTooltipHover(`${phase}-play`, true)}
													onMouseLeave={() => handleTooltipHover(`${phase}-play`, false)}
													onClick={() => handleTooltipClick(`${phase}-play`)}
												>
													{TIMER_TYPE_EMOJI.play} {TIMER_TYPE_NAMES.play}
													
													{/* Play tooltip */}
													{showTooltip(`${phase}-play`) && (
														<div style={{
															position: 'absolute',
															top: '100%',
															left: 0,
															marginTop: 4,
															background: '#1f2937',
															color: '#fff',
															padding: '6px 10px',
															borderRadius: 6,
															fontSize: 11,
															lineHeight: 1.3,
															boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
															zIndex: 10,
															whiteSpace: 'nowrap'
														}}>
															Time for games before work starts
														</div>
													)}
												</label>
												<input
													type="number"
													min="1"
													max="60"
													value={phaseTimers[`${phase}_play_min`]}
													onChange={(e) => handleTimerChange(phase, 'play', e.target.value)}
													style={{
														width: '100%',
														padding: '8px 10px',
												border: '2px solid #d1d5db',
												borderRadius: 6,
												fontSize: 16,
														fontWeight: 700,
														textAlign: 'center',
														color: '#059669',
														background: '#fff'
													}}
											/>
											<div style={{ 
												fontSize: 10, 
												color: '#6b7280', 
												marginTop: 2, 
												textAlign: 'center' 
											}}>
												minutes
											</div>
										</div>

										{/* Work timer */}
											<div>
												<label style={{
													display: 'block',
													fontSize: 13,
													fontWeight: 600,
													color: '#2563eb',
													marginBottom: 6,
													cursor: 'help',
													position: 'relative'
												}}
													onMouseEnter={() => handleTooltipHover(`${phase}-work`, true)}
													onMouseLeave={() => handleTooltipHover(`${phase}-work`, false)}
													onClick={() => handleTooltipClick(`${phase}-work`)}
												>
													{TIMER_TYPE_EMOJI.work} {TIMER_TYPE_NAMES.work}
													
													{/* Work tooltip */}
													{showTooltip(`${phase}-work`) && (
														<div style={{
															position: 'absolute',
															top: '100%',
															left: 0,
															marginTop: 4,
															background: '#1f2937',
															color: '#fff',
															padding: '6px 10px',
															borderRadius: 6,
															fontSize: 11,
															lineHeight: 1.3,
															boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
															zIndex: 10,
															whiteSpace: 'nowrap'
														}}>
															Actual lesson work time
														</div>
													)}
												</label>
												<input
													type="number"
													min="1"
													max="60"
													value={phaseTimers[`${phase}_work_min`]}
													onChange={(e) => handleTimerChange(phase, 'work', e.target.value)}
												style={{
													width: '100%',
													padding: '8px 10px',
													border: '2px solid #d1d5db',
													borderRadius: 6,
													fontSize: 16,
													fontWeight: 700,
													textAlign: 'center',
													color: '#2563eb',
													background: '#fff'
												}}
											/>
											<div style={{ 
												fontSize: 10, 
												color: '#6b7280', 
												marginTop: 2, 
												textAlign: 'center'
												}}>
													minutes
												</div>
											</div>
										</div>
									</div>
								))}

							{/* Golden Key Bonus */}
							<div style={{
								borderTop: '2px solid #e5e7eb',
								paddingTop: 12,
								marginTop: 4
							}}>
								<div style={{ position: 'relative', marginBottom: 6 }}>
										<div
											style={{
												fontSize: 16,
												fontWeight: 700,
												color: '#b45309',
												cursor: 'help',
												display: 'inline-block',
												borderBottom: '1px dotted #9ca3af',
												userSelect: 'none'
											}}
											onMouseEnter={() => handleTooltipHover('golden-key', true)}
											onMouseLeave={() => handleTooltipHover('golden-key', false)}
											onClick={() => handleTooltipClick('golden-key')}
										>
											⚡ Golden Key Bonus
										</div>

										{/* Golden key tooltip */}
										{showTooltip('golden-key') && (
											<div style={{
												position: 'absolute',
												top: '100%',
												left: 0,
												marginTop: 6,
												background: '#1f2937',
												color: '#fff',
												padding: '8px 12px',
												borderRadius: 6,
												fontSize: 12,
												lineHeight: 1.4,
												boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
												zIndex: 10,
												maxWidth: 280,
												whiteSpace: 'normal'
											}}>
												Extra time added to <strong>all play timers</strong> when golden key is earned (completing 4/5 work phases) or applied by facilitator.
											</div>
										)}
									</div>

									<div style={{ maxWidth: 240 }}>
									<input
										type="number"
										min="1"
										max="60"
										value={phaseTimers.golden_key_bonus_min}
										onChange={(e) => handleGoldenKeyChange(e.target.value)}
										style={{
											width: '100%',
											padding: '8px 10px',
											border: '2px solid #d1d5db',
											borderRadius: 6,
											fontSize: 16,
											fontWeight: 700,
											textAlign: 'center',
											color: '#b45309',
											background: '#fffbeb'
										}}
									/>
										<div style={{ 
											fontSize: 10, 
											color: '#6b7280', 
											marginTop: 2, 
											textAlign: 'center'
										}}>
											bonus minutes per phase
										</div>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Footer */}
					<div style={footerStyle}>
						{/* Help Section in Footer */}
						{(activeTab === 'targets' || activeTab === 'ai-features' || activeTab === 'timers') && (
							<div style={{ flex: 1, position: 'relative' }}>
								<button
									onClick={() => setShowHelp(!showHelp)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 6,
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										color: '#3b82f6',
										fontSize: 14,
										fontWeight: 500
									}}
								>
									❓ {showHelp ? 'Hide' : 'Show'} Help
								</button>
								{showHelp && (
									<div style={{
										position: 'absolute',
										bottom: '100%',
										left: 0,
										marginBottom: 8,
										padding: 12,
										background: '#f9fafb',
										borderRadius: 6,
										border: '1px solid #e5e7eb',
										fontSize: 14,
										color: '#374151',
										lineHeight: 1.5,
										minWidth: 300,
										maxWidth: 400,
										boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
									}}>
										{activeTab === 'targets' && (
											<>
												<p><strong>Learning Targets</strong></p>
												<p style={{ marginTop: 8 }}>Set how many questions appear in each lesson phase (Comprehension, Exercise, Worksheet, Test).</p>
												<p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Higher numbers = more practice, longer lessons.</p>
											</>
										)}
										{activeTab === 'ai-features' && (
											<>
												<p><strong>AI Features</strong></p>
												<p style={{ marginTop: 8 }}>Control which AI-powered activities are available: Ask (custom questions), Poem generation, Story mode, and Fill-in-Fun games.</p>
												<p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Disable features you don&apos;t want learners to access during lessons.</p>
											</>
										)}
										{activeTab === 'timers' && (
											<>
												<p><strong>Phase Timers</strong></p>
												<p style={{ marginTop: 8 }}>Set Play time (games/exploration) and Work time (lesson tasks) for each of the 5 lesson phases.</p>
												<p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Timers help learners manage time and stay focused.</p>
											</>
										)}
									</div>
								)}
							</div>
						)}
						<div style={{ display: 'flex', gap: '8px' }}>
							<button
								onClick={onClose}
								style={secondaryButtonStyle}
								disabled={saving}
							>
								Cancel
							</button>
							<button
								onClick={handleSave}
								style={buttonStyle}
								disabled={saving}
							>
								{saving ? 'Saving…' : 'Save Changes'}
							</button>
						</div>
					</div>
				</div>
			</div>
	);
}