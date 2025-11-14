'use client';
/**
 * Facilitator Tutorial Walkthrough
 * 
 * Step-by-step interactive tutorial for Beta facilitators.
 * Uses calm, clear language following brand signals.
 * Marks fac_tutorial_completed_at on completion.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { markFacilitatorTutorialCompleted } from '@/app/lib/tutorialGuards';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome',
    content: 'This quick walkthrough will show you how to use the facilitator tools. Take your time with each step.',
    position: null,
  },
  {
    id: 'learners',
    title: 'Managing Learners',
    content: 'Create learner profiles here. Set their grade level and learning goals. You can add as many learners as you need.',
    target: '.learners-section',
    highlightArea: 'learners-card',
  },
  {
    id: 'lesson-select',
    title: 'Choosing Lessons',
    content: 'Pick a lesson for your learner. Lessons are organized by grade and subject. Choose what fits their current progress.',
    target: '.lesson-selector',
    highlightArea: 'lesson-dropdown',
  },
  {
    id: 'session-start',
    title: 'Starting a Session',
    content: 'Click Begin to start the learning session. Ms. Sonoma will guide your learner through the lesson step by step.',
    target: '.begin-button',
    highlightArea: 'begin-button',
  },
  {
    id: 'facilitator-tools',
    title: 'Your Tools',
    content: 'During lessons, use the facilitator panel to take notes, track progress, and adjust settings. Everything stays private.',
    target: '.facilitator-panel',
    highlightArea: 'facilitator-panel',
  },
  {
    id: 'complete',
    title: 'Ready to Begin',
    content: 'You are all set. Start by creating your first learner profile. If you need help, use the Help menu anytime.',
    position: null,
  },
];

export default function FacilitatorTutorial() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('Not signed in. Please refresh and try again.');
        setCompleting(false);
        return;
      }

      const success = await markFacilitatorTutorialCompleted(user.id);

      if (success) {
        // Redirect to learners page
        router.push('/facilitator/learners');
      } else {
        setError('Could not save progress. Please try again.');
        setCompleting(false);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setCompleting(false);
    }
  };

  return (
    <>
      {/* Overlay backdrop */}
      <div style={styles.overlay} />

      {/* Tutorial card */}
      <div style={styles.card}>
        {/* Progress indicator */}
        <div style={styles.progress}>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%`,
              }}
            />
          </div>
          <span style={styles.progressText}>
            Step {currentStep + 1} of {TUTORIAL_STEPS.length}
          </span>
        </div>

        {/* Content */}
        <h2 style={styles.title}>{step.title}</h2>
        <p style={styles.content}>{step.content}</p>

        {/* Error message */}
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {/* Navigation */}
        <div style={styles.nav}>
          {!isFirstStep && (
            <button onClick={handlePrev} style={styles.buttonSecondary} disabled={completing}>
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            style={styles.button}
            disabled={completing}
          >
            {completing ? 'Finishing...' : isLastStep ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: 9998,
  },
  card: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '500px',
    background: '#fff',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    zIndex: 9999,
  },
  progress: {
    marginBottom: '24px',
  },
  progressBar: {
    width: '100%',
    height: '4px',
    background: '#e0e0e0',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressFill: {
    height: '100%',
    background: '#111',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '12px',
    color: '#888',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#111',
    marginBottom: '16px',
  },
  content: {
    fontSize: '16px',
    color: '#555',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  error: {
    background: '#fee',
    color: '#c33',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  nav: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  button: {
    padding: '12px 24px',
    background: '#111',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonSecondary: {
    padding: '12px 24px',
    background: '#fff',
    color: '#111',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
