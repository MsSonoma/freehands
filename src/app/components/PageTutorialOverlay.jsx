'use client';
/**
 * PageTutorialOverlay – generic reusable tour overlay.
 *
 * Style matches CalendarTutorialOverlay exactly (dark backdrop, white card,
 * indigo progress bars, icon + title + body, step counter, skip / next).
 *
 * Props:
 *   steps    – Array<{ icon: string, title: string, body: string }>
 *   onClose  – called when the user skips or finishes
 */
import { useState } from 'react';

export default function PageTutorialOverlay({ steps = [], onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const total = steps.length;
  const card = steps[currentStep] || {};
  const isLast = currentStep === total - 1;

  function handleNext() {
    if (isLast) {
      onClose?.();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleSkip() {
    onClose?.();
  }

  if (!steps.length) return null;

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
        {/* Close / skip × */}
        <button
          onClick={handleSkip}
          aria-label="Close tutorial"
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

        {/* Progress bars */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {steps.map((_, i) => (
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

        {/* Footer */}
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
              {isLast ? 'Got it! 🎉' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
