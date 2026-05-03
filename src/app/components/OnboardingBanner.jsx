'use client';
/**
 * OnboardingBanner – contextual step banner rendered at the top of each
 * onboarding page.  Pages pass their step number, a title, an optional
 * sub-message, and an optional action element (e.g. a link button).
 */
export default function OnboardingBanner({ step, total = 4, title, message, action }) {
  return (
    <div style={{
      marginBottom: 20,
      padding: '14px 18px',
      background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)',
      border: '1px solid #c4b5fd',
      borderRadius: 12,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
    }}>
      <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>🚀</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#7c3aed', marginBottom: 3, textTransform: 'uppercase' }}>
          Step {step} of {total} · Getting Started
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e1b4b' }}>{title}</div>
        {message && (
          <div style={{ fontSize: 13, color: '#4c1d95', marginTop: 5, lineHeight: 1.5 }}>{message}</div>
        )}
        {action && <div style={{ marginTop: 12 }}>{action}</div>}
      </div>
    </div>
  );
}
