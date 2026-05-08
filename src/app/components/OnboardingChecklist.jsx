'use client';
/**
 * OnboardingChecklist – persistent floating checklist shown to new users
 * while the onboarding flow is active (step 1–4).
 *
 * Clicking a step row navigates to that step's page.
 * The card can be minimised and dismissed.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding, ONBOARDING_STEPS } from '@/app/hooks/useOnboarding';
import VideoTutorial from '@/app/components/VideoTutorial';

const STEP_ITEMS = [
  {
    id: ONBOARDING_STEPS.CREATE_LEARNER,
    label: 'Create your first learner',
    path: '/facilitator/learners/add',
  },
  {
    id: ONBOARDING_STEPS.GENERATE_LESSON,
    label: 'Generate a lesson',
    path: '/facilitator/generator',
  },
  {
    id: ONBOARDING_STEPS.ACTIVATE_LESSON,
    label: 'Activate or schedule a lesson',
    path: '/facilitator/lessons',
  },
  {
    id: ONBOARDING_STEPS.CALENDAR_TOUR,
    label: 'Explore the calendar',
    path: '/facilitator/calendar',
  },
];

export default function OnboardingChecklist() {
  const { step, isOnboarding, dismissOnboarding } = useOnboarding();
  const [minimized, setMinimized] = useState(false);
  const router = useRouter();

  if (!isOnboarding) return null;

  const completedCount = STEP_ITEMS.filter((s) => step > s.id).length;
  const progressPct = Math.round((completedCount / STEP_ITEMS.length) * 100);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1200,
        width: 290,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(99,102,241,0.14)',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        aria-label={minimized ? 'Expand getting-started guide' : 'Collapse getting-started guide'}
        onClick={() => setMinimized((m) => !m)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMinimized((m) => !m); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 14px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#fff',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
          🚀 Getting Started
          <span style={{
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 20,
            padding: '1px 7px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {completedCount}/{STEP_ITEMS.length}
          </span>
        </span>
        <span style={{ fontSize: 16, lineHeight: 1, opacity: 0.8 }}>
          {minimized ? '▲' : '▼'}
        </span>
      </div>

      {!minimized && (
        <div style={{ padding: '12px 14px 14px' }}>
          {/* Progress bar */}
          <div style={{ height: 5, background: '#f3f4f6', borderRadius: 3, marginBottom: 14 }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>

          {/* Step rows */}
          {STEP_ITEMS.map((s) => {
            const done = step > s.id;
            const current = step === s.id;
            return (
              <div
                key={s.id}
                role={done ? undefined : 'button'}
                tabIndex={done ? undefined : 0}
                onClick={() => {
                  if (!done) router.push(`${s.path}?onboarding=1`);
                }}
                onKeyDown={(e) => {
                  if (!done && (e.key === 'Enter' || e.key === ' ')) router.push(`${s.path}?onboarding=1`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 0',
                  cursor: done ? 'default' : 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                {/* Step indicator */}
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background: done ? '#6366f1' : current ? '#ede9fe' : '#f9fafb',
                  border: done ? 'none' : current ? '2px solid #6366f1' : '2px solid #e5e7eb',
                  color: done ? '#fff' : current ? '#6366f1' : '#9ca3af',
                }}>
                  {done ? '✓' : s.id}
                </div>
                <span style={{
                  fontSize: 13,
                  color: done ? '#9ca3af' : current ? '#111827' : '#374151',
                  fontWeight: current ? 600 : 400,
                  textDecoration: done ? 'line-through' : 'none',
                  flex: 1,
                  lineHeight: 1.3,
                }}>
                  {s.label}
                </span>
                {current && (
                  <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ← now
                  </span>
                )}
              </div>
            );
          })}

          {/* Video walkthrough thumbnail */}
          <div style={{
            marginTop: 12,
            padding: '8px 10px',
            background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)',
            border: '1px solid #c4b5fd',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
          }}>
            <VideoTutorial
              src="/media/mr-mentor-wizard-helper.mp4"
              title="Mr. Mentor — Wizard Walkthrough"
              label=""
              thumbTime={1}
              width={72}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 11, color: '#4c1d95', lineHeight: 1.3 }}>🤖 Watch the walkthrough</div>
              <div style={{ fontSize: 10, color: '#5b21b6', lineHeight: 1.4, marginTop: 2 }}>Mr. Mentor explains every step</div>
            </div>
          </div>

          <button
            onClick={dismissOnboarding}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '7px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: 'none',
              color: '#9ca3af',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Dismiss guide
          </button>
        </div>
      )}
    </div>
  );
}
