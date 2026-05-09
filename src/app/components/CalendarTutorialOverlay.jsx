'use client';
/**
 * CalendarTutorialOverlay – shown the first time a new user lands on the
 * calendar (onboarding step 4).  Steps through tooltip-style cards that
 * explain the key calendar features, then calls onComplete() to mark the
 * onboarding flow as finished.
 */
import { useState } from 'react';

const TOUR_STEPS = [
  {
    icon: '📅',
    title: 'Welcome to the Calendar!',
    body: 'This is your scheduling hub. From here you can assign lessons to specific dates, see what\'s planned for any day, and keep your learner on track all year.',
  },
  {
    icon: '🖱️',
    title: 'Pick a Date',
    body: 'Click any date on the calendar to open the Day View. You\'ll see which lessons are already scheduled and get options to add, move, or remove them.',
  },
  {
    icon: '📚',
    title: 'Assign Lessons',
    body: 'Use the Lesson Picker panel (right side) to browse your lesson library and drag or click a lesson onto a date. You can also schedule directly from the Lessons page.',
  },
  {
    icon: '▶️',
    title: 'Activate vs. Schedule',
    body: 'Scheduling a lesson marks it for a future date. Activating it makes it available for your learner to start right now. You can do both — schedule ahead, then activate on the day.',
  },
  {
    icon: '🗓️',
    title: 'Planner Tab',
    body: 'Switch to the Planner tab to drag-and-drop lessons across weeks, mark no-school days, and bulk-plan your curriculum. Perfect for end-of-term prep.',
  },
  {
    icon: '🎓',
    title: 'Ready to Start? Hit "Learn"!',
    body: 'When your learner is ready to begin, click the "Learn" button in the top navigation bar. That switches to the learner-facing side where they can pick a lesson and start.',
  },
  {
    icon: '✅',
    title: 'You\'re all set!',
    body: 'That\'s the full tour. Explore at your own pace — every panel has a help icon (❓) with more detail. Happy teaching!',
  },
];

export default function CalendarTutorialOverlay({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const total = TOUR_STEPS.length;
  const card = TOUR_STEPS[currentStep];
  const isLast = currentStep === total - 1;

  function handleNext() {
    if (isLast) {
      onComplete?.();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleSkip() {
    onComplete?.();
  }

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.55)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleSkip(); }}
    >
      {/* Card */}
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '28px 28px 22px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          fontFamily: 'inherit',
          position: 'relative',
        }}
      >
        {/* Skip */}
        <button
          onClick={handleSkip}
          aria-label="Skip tutorial"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            border: 'none',
            background: 'none',
            fontSize: 20,
            color: '#9ca3af',
            cursor: 'pointer',
            lineHeight: 1,
            padding: 4,
          }}
        >
          ×
        </button>

        {/* Step indicator dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: 5,
                flex: 1,
                borderRadius: 3,
                background: i <= currentStep ? '#6366f1' : '#e5e7eb',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 12 }}>{card.icon}</div>

        {/* Content */}
        <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
          {card.title}
        </h2>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          {card.body}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            {currentStep + 1} / {total}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isLast && (
              <button
                onClick={handleSkip}
                style={{
                  padding: '8px 14px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#6b7280',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Skip tour
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {isLast ? 'Get started! 🎉' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
