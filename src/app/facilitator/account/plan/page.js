"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccessControl } from '@/app/hooks/useAccessControl';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import GatedOverlay from '@/app/components/GatedOverlay';
import ClientManage from '@/app/billing/manage/ClientManage';

export default function FacilitatorPlanPage() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true });

  // PIN gate
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page');
        if (!allowed) { router.push('/'); return; }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [router]);

  // BFCache reset + return from Stripe checkout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPageShow = (e) => {
      if (e?.persisted) { try { window.location.reload(); } catch {} }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        try {
          const pending = sessionStorage.getItem('stripe_nav_pending');
          if (pending) { sessionStorage.removeItem('stripe_nav_pending'); window.location.reload(); }
        } catch {}
      }
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Clean up ?rts / ?checkout params after returning from Stripe
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      let changed = false;
      ['checkout', 'rts'].forEach(p => { if (url.searchParams.has(p)) { url.searchParams.delete(p); changed = true; } });
      if (changed) window.history.replaceState(null, '', url.toString());
    } catch {}
  }, []);

  if (authLoading) return <main style={{ padding: 24 }}><p>Loading…</p></main>;

  return (
    <>
      <main style={{ padding: 24, display: 'flex', justifyContent: 'center', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
        <div style={{ width: '100%', maxWidth: 960 }}>
          <ClientManage />
        </div>
      </main>
      <GatedOverlay
        show={!isAuthenticated}
        gateType={gateType}
        feature="Plans & Billing"
        emoji="💳"
        description="Sign in to view and manage your subscription plan."
        benefits={[
          'Compare Free, Standard, and Pro',
          'Manage your subscription and billing details',
          'View your current plan and usage',
          'Cancel or upgrade anytime',
        ]}
      />
    </>
  );
}

