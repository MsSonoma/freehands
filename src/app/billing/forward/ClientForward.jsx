"use client";
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { loadStripe } from '@stripe/stripe-js';

export default function ClientForward() {
  const sp = useSearchParams();
  const kind = sp?.get('kind') || '';
  const tier = sp?.get('tier') || '';
  const to = useMemo(() => {
    const t = sp?.get('to') || '';
    return typeof t === 'string' && t.startsWith('/') ? t : '/facilitator/plan';
  }, [sp]);
  const [error, setError] = useState('');

  // Prepare the "back" destination before navigating to Stripe
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(to, window.location.origin);
      url.searchParams.set('rts', Date.now().toString());
      window.history.replaceState(null, '', url.toString());
    } catch {}
  }, [to]);

  useEffect(() => {
    (async () => {
      try {
        if (!kind) throw new Error('Missing kind');
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Please log in to continue');

        if (kind === 'checkout') {
          if (!tier) throw new Error('Missing tier');
          const res = await fetch(`/api/billing/checkout?tier=${encodeURIComponent(tier)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || 'Checkout failed');
          }
          const { url, id } = await res.json();
          try {
            const stripePk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
            if (stripePk && id) {
              const stripe = await loadStripe(stripePk);
              if (stripe) {
                try { sessionStorage.setItem('stripe_nav_pending', '1'); } catch {}
                const { error } = await stripe.redirectToCheckout({ sessionId: id });
                if (error) throw error;
                return;
              }
            }
          } catch {}
          if (url) {
            try { sessionStorage.setItem('stripe_nav_pending', '1'); } catch {}
            window.location.assign(url);
            return;
          }
          throw new Error('Checkout URL missing');
        } else if (kind === 'portal') {
          const res = await fetch(`/api/billing/portal`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || 'Unable to open billing portal');
          }
          const { url } = await res.json();
          if (url) {
            try { sessionStorage.setItem('stripe_nav_pending', '1'); } catch {}
            window.location.assign(url);
            return;
          }
          throw new Error('Portal URL missing');
        } else {
          throw new Error('Unknown kind');
        }
      } catch (e) {
        setError(e?.message || 'Something went wrong');
      }
    })();
  }, [kind, tier]);

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Redirecting to Stripe…</h1>
        <p style={{ color: '#666', marginTop: 0 }}>Please wait a moment.</p>
        {error ? (
          <div style={{ marginTop: 16, color: '#b00020' }}>
            <p style={{ margin: 0 }}>{error}</p>
            <button style={{ marginTop: 12, padding: '8px 12px', border: '1px solid #c7442e', background:'#c7442e', color:'#fff', borderRadius: 8 }} onClick={() => {
              const url = new URL(to, window.location.origin);
              url.searchParams.set('rts', Date.now().toString());
              window.location.replace(url.toString());
            }}>Go back</button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
