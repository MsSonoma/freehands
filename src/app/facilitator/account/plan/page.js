"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccessControl } from '@/app/hooks/useAccessControl';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import GatedOverlay from '@/app/components/GatedOverlay';
// BillingStatusDev removed per request

const plans = [
  { name: 'Free', priceLabel: 'Free', priceSub: '', features: ['Access to 1 lesson per day', 'Beginner Lessons', '1 Learner'], highlight: false },
  { name: 'Basic', priceLabel: '$5', priceSub: 'per month', features: ['5 Lessons per day', 'Extended Lessons', '1 Learner'], highlight: false },
  { name: 'Plus', priceLabel: '$20', priceSub: 'per month', features: ['20 lessons per day', 'All Lessons', 'Up to 10 Learners', 'One device at a time'], highlight: true },
  { name: 'Premium', priceLabel: '$35', priceSub: 'per month', features: ['Unlimited lessons', 'All Lessons', 'Up to 10 Learners', '2 Devices at a time', 'Premium Facilitator Tools'], highlight: false },
];

async function startCheckout(tier, setLoadingTier) {
  try {
    // Guard: prevent double-submission if returning via in-Stripe back
    if (typeof window !== 'undefined') {
      const key = `stripe_action_lock_${tier}`;
      const now = Date.now();
      const prior = Number(sessionStorage.getItem(key) || 0);
      if (now - prior < 4000) return; // ignore rapid re-clicks within 4s
      sessionStorage.setItem(key, String(now));
    }
    // Same-tab navigation to avoid extra/blank tabs
    setLoadingTier(tier);
    if (typeof window !== 'undefined') {
      const embedded = `/billing/element/checkout?tier=${encodeURIComponent(tier)}`;
      window.location.assign(embedded);
      return;
    }
  } catch (e) {
    if (typeof window !== 'undefined') alert(e?.message || 'Checkout failed');
  } finally {
    setLoadingTier(null);
  }
}

async function openPortal(setPortalLoading) {
  try {
    if (typeof window !== 'undefined') {
      const key = `stripe_action_lock_portal`;
      const now = Date.now();
      const prior = Number(sessionStorage.getItem(key) || 0);
      if (now - prior < 4000) return;
      sessionStorage.setItem(key, String(now));
    }
    // Same-tab navigation for Portal
    setPortalLoading(true);
    if (typeof window !== 'undefined') {
      // Use in-app embedded manage page to avoid Stripe hosted history issues
      window.location.assign('/billing/manage');
      return;
    }
  } catch (e) {
    if (typeof window !== 'undefined') alert(e?.message || 'Unable to open billing portal');
  } finally {
    setPortalLoading(false);
  }
}

export default function FacilitatorPlanPage() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true });
  const [pinChecked, setPinChecked] = useState(false);
  const [loadingTier, setLoadingTier] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [currentTier, setCurrentTier] = useState(null);

  // Check PIN requirement on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page');
        if (!allowed) {
          router.push('/');
          return;
        }
        if (!cancelled) setPinChecked(true);
      } catch (e) {
        if (!cancelled) setPinChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Clean up query params like ?checkout=success|cancel when returning from Stripe
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      if (url.searchParams.has('checkout')) {
        url.searchParams.delete('checkout');
        window.history.replaceState(null, '', url.toString());
      }
      if (url.searchParams.has('rts')) {
        url.searchParams.delete('rts');
        window.history.replaceState(null, '', url.toString());
      }
    } catch {}
  }, []);

  // Detect current plan tier to style the "current" column and button label
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return; // not logged in or no Supabase; skip
        const res = await fetch('/api/billing/manage/summary', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (cancelled) return;
        const cur = (json?.effective_tier || json?.subscription?.tier || json?.plan_tier || 'free')?.toLowerCase();
        setCurrentTier(cur);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // After returning from Stripe, browsers may restore this page from the BFCache with stale in-memory state.
  // Reset UI flags and clear action locks whenever the page becomes visible or is restored via pageshow.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const resetUi = () => {
      try {
        setLoadingTier(null);
        setPortalLoading(false);
        // Clear any short-lived action locks
        try {
          const keys = Object.keys(sessionStorage || {});
          for (const k of keys) if (k.startsWith('stripe_action_lock_')) sessionStorage.removeItem(k);
        } catch {}
        // Also clean leftover checkout param, if any
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.has('checkout')) {
            url.searchParams.delete('checkout');
            window.history.replaceState(null, '', url.toString());
          }
        } catch {}
      } catch {}
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // If we navigated to Stripe and came back, force a fresh reload once
        try {
          const pending = sessionStorage.getItem('stripe_nav_pending');
          if (pending) {
            sessionStorage.removeItem('stripe_nav_pending');
            window.location.reload();
            return;
          }
        } catch {}
        resetUi();
      }
    };
    const onPageShow = (e) => {
      // e.persisted true indicates BFCache restore; force a clean reload
      if (e && e.persisted) {
        try { window.location.reload(); return; } catch {}
        resetUi();
      }
    };
    const onFocus = () => {
      try {
        const pending = sessionStorage.getItem('stripe_nav_pending');
        if (pending) {
          sessionStorage.removeItem('stripe_nav_pending');
          window.location.reload();
        }
      } catch {}
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (authLoading) {
    return <main style={{ padding: 12 }}><p>Loading…</p></main>;
  }

  return (
    <>
    <main style={{ padding: 12, opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
  {/* Dev billing status banner removed */}
      <h1 style={{ marginTop: 0, marginBottom: 2 }}>Choose your plan</h1>
      <p style={{ color: '#555', marginTop: 0, marginBottom: 8 }}>Compare features and pick the level that fits your needs.</p>

      <section aria-label="Plan comparison" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, alignItems: 'stretch', position: 'relative', zIndex: 20 }}>
        {plans.map((plan) => {
          const tierId = plan.name.toLowerCase();
          const isSelected = loadingTier === tierId; // transient "selected" visual while redirecting
          const isCurrent = (currentTier || '').toLowerCase() === tierId;
          return (
            <article
              key={plan.name}
              aria-label={`${plan.name} plan`}
              style={{
                border: (isSelected || isCurrent) ? '2px solid #111' : '1px solid #ddd',
                borderRadius: 12,
                padding: 8,
                paddingTop: 22,
                background: isSelected ? '#fafafa' : '#fff',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                boxShadow: isSelected ? '0 8px 22px rgba(0,0,0,0.08)' : 'none',
                zIndex: isSelected ? 1 : 0,
                transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                position: 'relative',
              }}
            >
              {isSelected ? (
                <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 14, color: '#0a7', fontWeight: 700 }}>
                  current
                </span>
              ) : null}
              <header style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 }}>
                  <h2 style={{ margin: 0, fontSize: isSelected ? 18 : 16 }}>{plan.name}</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: isSelected ? 24 : 20, fontWeight: 700 }}>{plan.priceLabel}</span>
                  {plan.priceSub ? <span style={{ color: '#666', fontSize: isSelected ? 13 : 12 }}>{plan.priceSub}</span> : null}
                </div>
              </header>
              <ul style={{ paddingLeft: 18, margin: '4px 0 6px 0', color: '#222', flexGrow: 1 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ margin: '3px 0' }}>{f}</li>
                ))}
              </ul>
              <div style={{ marginTop: 'auto' }}>
                {/* Show button for all plans; for Free it acts as a non-action "Current" if applicable */}
                <button
                  type="button"
                  aria-label={isCurrent ? `${plan.name} is current plan` : `Choose ${plan.name} plan`}
                  onClick={() => { if (!isCurrent) startCheckout(tierId, setLoadingTier); }}
                  disabled={isCurrent || Boolean(loadingTier) || portalLoading}
                  aria-busy={loadingTier === tierId}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: isCurrent ? '1px solid #000' : (isSelected ? '1px solid #000' : '1px solid #c7442e'),
                    background: isCurrent ? '#fff' : (isSelected ? '#fff' : '#c7442e'),
                    color: isCurrent ? '#111' : (isSelected ? '#111' : '#fff'),
                    fontWeight: 600,
                    cursor: (isCurrent || Boolean(loadingTier) || portalLoading) ? 'not-allowed' : 'pointer',
                    opacity: (Boolean(loadingTier) && loadingTier !== tierId) || portalLoading ? 0.7 : 1,
                  }}
                  title={isCurrent ? `${plan.name} is your current plan` : `Select ${plan.name}`}
                >
                  {isCurrent ? 'Current' : (loadingTier === tierId ? 'Redirecting…' : 'Select')}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <div style={{ marginTop: 40 }}>
        <button
          type="button"
          onClick={() => openPortal(setPortalLoading)}
          aria-label="Manage your subscription"
          disabled={Boolean(loadingTier) || portalLoading}
          aria-busy={portalLoading}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 560,
            margin: '0 auto',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #ccc',
            background: '#f7f7f7',
            color: '#111',
            fontWeight: 600,
            cursor: Boolean(loadingTier) || portalLoading ? 'not-allowed' : 'pointer',
            opacity: Boolean(loadingTier) || portalLoading ? 0.7 : 1,
          }}
        >
          {portalLoading ? 'Opening…' : 'Manage subscription'}
        </button>
      </div>

      <style>{`
        @media (max-width: 1100px) { [aria-label="Plan comparison"] { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { [aria-label="Plan comparison"] { grid-template-columns: 1fr; } }
      `}</style>
    </main>
    
    <GatedOverlay
      show={!isAuthenticated}
      gateType={gateType}
      feature="Plans & Billing"
      emoji="💳"
      description="Sign in to view and manage your subscription plan."
      benefits={[
        'Compare and select from Free, Basic, Plus, or Premium plans',
        'Manage your subscription and billing details',
        'View your current plan and usage',
        'Cancel or upgrade anytime'
      ]}
    />
    </>
  );
}

// Minimal helper to get the Supabase access token on the client
async function getAccessToken() {
  try {
    const mod = await import('@/app/lib/supabaseClient');
    const { getSupabaseClient, hasSupabaseEnv } = mod;
    if (!hasSupabaseEnv()) return null;
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

