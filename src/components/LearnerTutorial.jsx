'use client';
/**
 * Learner Tutorial
 * 
 * Kid-friendly first-time tutorial for learners.
 * Shows how to interact with Ms. Sonoma, use buttons, and speak.
 * Tracks completion in learner_tutorial_progress table.
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { markLearnerTutorialCompleted } from '@/app/lib/tutorialGuards';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome',
    content: 'Hi! I am Ms. Sonoma. I will help you learn today. Let me show you how this works.',
  },
  {
    id: 'speaking',
    title: 'How to Talk',
    content: 'You can talk to me! Just click the microphone button and speak. I will listen and help you.',
  },
  {
    id: 'buttons',
    title: 'Buttons You Can Use',
    content: 'See the buttons on the screen? You can click them to answer questions or ask for help.',
  },
  {
    id: 'practice',
    title: 'Taking Your Time',
    content: 'There is no rush. Take your time to think. I will wait for you.',
  },
  {
    id: 'ready',
    title: 'Ready to Start',
    content: 'Great! Now you know how to use everything. Let us begin the lesson together.',
  },
];

export default function LearnerTutorial() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const learnerId = searchParams.get('learner');

  const [currentStep, setCurrentStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleComplete = async () => {
    if (!learnerId) {
      setError('Missing learner information. Please try again.');
      return;
    }

    setCompleting(true);
    setError(null);

    try {
      const success = await markLearnerTutorialCompleted(learnerId);

      if (success) {
        // Redirect to session page with learner
        router.push(`/session?learner=${learnerId}`);
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
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Friendly character or icon could go here */}
        <div style={styles.icon}>👋</div>

        {/* Content */}
        <h2 style={styles.title}>{step.title}</h2>
        <p style={styles.content}>{step.content}</p>

        {/* Error message */}
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {/* Progress dots */}
        <div style={styles.dots}>
          {TUTORIAL_STEPS.map((s, idx) => (
            <div
              key={s.id}
              style={{
                ...styles.dot,
                ...(idx === currentStep && styles.dotActive),
              }}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          style={styles.button}
          disabled={completing}
        >
          {completing ? 'Starting...' : isLastStep ? 'Start Lesson' : 'Next'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    padding: '20px',
  },
  card: {
    maxWidth: '600px',
    width: '100%',
    background: '#fff',
    borderRadius: '16px',
    padding: '48px 40px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  icon: {
    fontSize: '64px',
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#111',
    marginBottom: '16px',
  },
  content: {
    fontSize: '20px',
    color: '#555',
    lineHeight: '1.6',
    marginBottom: '32px',
  },
  error: {
    background: '#fee',
    color: '#c33',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  dots: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    marginBottom: '32px',
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#ddd',
    transition: 'all 0.3s',
  },
  dotActive: {
    background: '#111',
    transform: 'scale(1.2)',
  },
  button: {
    padding: '16px 40px',
    background: '#111',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
