"use client";

import { useState, useEffect } from 'react';
import PhaseTimersOverlay from '@/app/session/components/PhaseTimersOverlay';
import { loadPhaseTimersForLearner } from '@/app/session/utils/phaseTimerDefaults';

const GRADES = ['K', ...Array.from({length: 12}, (_, i) => String(i + 1))];
const TARGETS = Array.from({length: 18}, (_, i) => String(i + 3)); // 3-20
const HUMOR_LEVELS = ['calm', 'funny', 'hilarious'];

const normalizeHumorLevel = (value) => {
	if (typeof value !== 'string') return 'calm';
	const v = value.trim().toLowerCase();
	return HUMOR_LEVELS.includes(v) ? v : 'calm';
};

export default function LearnerEditOverlay({ isOpen, learner, onClose, onSave }) {
	const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'targets' | 'ai-features' | 'timers'
	
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
	const [phaseTimers, setPhaseTimers] = useState({});
	const [showTimersOverlay, setShowTimersOverlay] = useState(false);
	
	const [saving, setSaving] = useState(false);

	// Initialize form when learner changes
	useEffect(() => {
		if (!learner) return;
		
		setName(learner.name || '');
		setGrade(learner.grade || 'K');
		setHumorLevel(normalizeHumorLevel(learner.humor_level));
		setComprehension(String(learner.comprehension ?? learner.targets?.comprehension ?? 3));
		setExercise(String(learner.exercise ?? learner.targets?.exercise ?? 3));
		setWorksheet(String(learner.worksheet ?? learner.targets?.worksheet ?? 3));
		setTest(String(learner.test ?? learner.targets?.test ?? 3));
		setGoldenKeys(String(learner.golden_keys ?? 0));
		setAskDisabled(!!learner.ask_disabled);
		setPoemDisabled(!!learner.poem_disabled);
		setStoryDisabled(!!learner.story_disabled);
		setFillInFunDisabled(!!learner.fill_in_fun_disabled);
		setPhaseTimers(loadPhaseTimersForLearner(learner));
	}, [learner]);

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
		maxHeight: '90vh',
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
		overflowX: 'auto'
	};

	const tabStyle = (active) => ({
		padding: '8px 16px',
		border: 'none',
		background: active ? '#111' : 'transparent',
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
		flex: 1
	};

	const footerStyle = {
		padding: '16px 24px',
		borderTop: '1px solid #e5e7eb',
		display: 'flex',
		gap: 12,
		justifyContent: 'flex-end'
	};

	const buttonStyle = {
		padding: '10px 20px',
		border: '1px solid #111',
		borderRadius: 8,
		background: '#111',
		color: '#fff',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
		transition: 'all 0.2s'
	};

	const secondaryButtonStyle = {
		...buttonStyle,
		background: '#fff',
		color: '#111'
	};

	const labelStyle = {
		display: 'block',
		fontSize: 14,
		fontWeight: 600,
		color: '#111',
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

	return (
		<>
			<div style={overlayStyle} onClick={onClose}>
				<div style={modalStyle} onClick={(e) => e.stopPropagation()}>
					{/* Header */}
					<div style={headerStyle}>
						<div>
							<h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
								Edit Learner
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

					{/* Tabs */}
					<div style={tabsStyle}>
						<button
							style={tabStyle(activeTab === 'basic')}
							onClick={() => setActiveTab('basic')}
						>
							👤 Basic Info
						</button>
						<button
							style={tabStyle(activeTab === 'targets')}
							onClick={() => setActiveTab('targets')}
						>
							🎯 Learning Targets
						</button>
						<button
							style={tabStyle(activeTab === 'ai-features')}
							onClick={() => setActiveTab('ai-features')}
						>
							🤖 AI Features
						</button>
						<button
							style={tabStyle(activeTab === 'timers')}
							onClick={() => setActiveTab('timers')}
						>
							⏱️ Timers
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
										💡 Learn more about <a href="/about#ai-features" target="_blank" style={{ color: '#111', fontWeight: 600 }}>AI features</a>
									</p>
								</div>
							</div>
						)}

						{activeTab === 'timers' && (
							<div>
								<p style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280' }}>
									Configure phase timers for this learner's sessions
								</p>

								<button
									onClick={() => setShowTimersOverlay(true)}
									style={{
										...buttonStyle,
										width: '100%',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										gap: 8
									}}
								>
									<span>⏱️</span>
									<span>Configure Phase Timers</span>
								</button>

								<div style={{ marginTop: 16, padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #dbeafe' }}>
									<p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
										ℹ️ Phase timers control how long each part of a lesson lasts, including play time (games) and work time (learning activities).
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Footer */}
					<div style={footerStyle}>
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

			{/* Phase Timers Sub-Overlay */}
			<PhaseTimersOverlay
				isOpen={showTimersOverlay}
				initialTimers={phaseTimers}
				onClose={() => setShowTimersOverlay(false)}
				onSave={(updatedTimers) => {
					setPhaseTimers(updatedTimers);
					setShowTimersOverlay(false);
				}}
			/>
		</>
	);
}
