"use client";

import { useState, useEffect } from 'react';

export default function AIFeaturesOverlay({ isOpen, initialSettings, onClose, onSave }) {
	const [askDisabled, setAskDisabled] = useState(false);
	const [poemDisabled, setPoemDisabled] = useState(false);
	const [storyDisabled, setStoryDisabled] = useState(false);
	const [fillInFunDisabled, setFillInFunDisabled] = useState(false);

	useEffect(() => {
		if (isOpen && initialSettings) {
			setAskDisabled(!!initialSettings.ask_disabled);
			setPoemDisabled(!!initialSettings.poem_disabled);
			setStoryDisabled(!!initialSettings.story_disabled);
			setFillInFunDisabled(!!initialSettings.fill_in_fun_disabled);
		}
	}, [isOpen, initialSettings]);

	if (!isOpen) return null;

	const handleSave = () => {
		onSave({
			ask_disabled: askDisabled,
			poem_disabled: poemDisabled,
			story_disabled: storyDisabled,
			fill_in_fun_disabled: fillInFunDisabled,
		});
	};

	const toggleButtonStyle = (disabled) => ({
		padding: '12px 20px',
		border: '1px solid #ddd',
		borderRadius: 999,
		background: disabled ? '#f44336' : '#4caf50',
		color: '#fff',
		cursor: 'pointer',
		fontSize: '1rem',
		fontWeight: 600,
		width: '100%',
		maxWidth: 200,
		transition: 'background 0.2s',
	});

	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				background: 'rgba(0,0,0,0.5)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 9999,
				padding: '20px',
			}}
			onClick={onClose}
		>
			<div
				style={{
					background: '#fff',
					borderRadius: 12,
					padding: '24px',
					maxWidth: 500,
					width: '100%',
					maxHeight: '90vh',
					overflowY: 'auto',
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 600 }}>
					AI Features Control
				</h2>
				<p style={{ margin: '0 0 24px 0', color: '#666', fontSize: '0.95rem' }}>
					Enable or disable individual AI features for this learner. All features are protected 
					by 6-layer content safety guardrails.{' '}
					<a 
						href="/about#ai-features" 
						target="_blank"
						rel="noopener noreferrer"
						style={{ color: '#0066cc', textDecoration: 'underline' }}
					>
						Learn more about these features
					</a>
				</p>

				<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
					{/* Ask Feature */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<div>
							<div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>
								Ask Feature
							</div>
							<div style={{ fontSize: '0.9rem', color: '#666' }}>
								Learner can ask questions about lesson vocabulary
							</div>
						</div>
						<button
							onClick={() => setAskDisabled(!askDisabled)}
							style={toggleButtonStyle(askDisabled)}
						>
							{askDisabled ? '🚫 Disabled' : '✅ Enabled'}
						</button>
					</div>

					{/* Poem Feature */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<div>
							<div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>
								Poem Feature
							</div>
							<div style={{ fontSize: '0.9rem', color: '#666' }}>
								Generate creative silly poems with content safety
							</div>
						</div>
						<button
							onClick={() => setPoemDisabled(!poemDisabled)}
							style={toggleButtonStyle(poemDisabled)}
						>
							{poemDisabled ? '🚫 Disabled' : '✅ Enabled'}
						</button>
					</div>

					{/* Story Feature */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<div>
							<div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>
								Story Feature
							</div>
							<div style={{ fontSize: '0.9rem', color: '#666' }}>
								Generate creative short stories with content safety
							</div>
						</div>
						<button
							onClick={() => setStoryDisabled(!storyDisabled)}
							style={toggleButtonStyle(storyDisabled)}
						>
							{storyDisabled ? '🚫 Disabled' : '✅ Enabled'}
						</button>
					</div>

					{/* Fill-in-Fun Feature */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<div>
							<div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>
								Fill-in-Fun Feature
							</div>
							<div style={{ fontSize: '0.9rem', color: '#666' }}>
								Mad libs style creative game with content safety
							</div>
						</div>
						<button
							onClick={() => setFillInFunDisabled(!fillInFunDisabled)}
							style={toggleButtonStyle(fillInFunDisabled)}
						>
							{fillInFunDisabled ? '🚫 Disabled' : '✅ Enabled'}
						</button>
					</div>
				</div>

				{/* Action buttons */}
				<div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
					<button
						onClick={onClose}
						style={{
							padding: '10px 20px',
							border: '1px solid #ddd',
							borderRadius: 8,
							background: '#fff',
							cursor: 'pointer',
							fontSize: '1rem',
						}}
					>
						Cancel
					</button>
					<button
						onClick={handleSave}
						style={{
							padding: '10px 20px',
							border: '1px solid #0b1220',
							borderRadius: 8,
							background: '#0b1220',
							color: '#fff',
							cursor: 'pointer',
							fontSize: '1rem',
							fontWeight: 600,
						}}
					>
						Save Changes
					</button>
				</div>
			</div>
		</div>
	);
}
