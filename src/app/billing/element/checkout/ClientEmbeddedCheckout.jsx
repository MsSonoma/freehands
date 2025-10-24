"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { getSupabaseClient } from '@/app/lib/supabaseClient';

export default function ClientEmbeddedCheckout() {
  const sp = useSearchParams();
  const router = useRouter();
  const initialTier = (sp?.get('tier') || '').toLowerCase();
  const [selectedTier, setSelectedTier] = useState(initialTier);
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const paymentElRef = useRef(null);
  const mountRef = useRef(null);
  const lastSecretRef = useRef(null);

  // Sync state if URL changes via browser nav
  useEffect(() => {
    const current = (sp?.get('tier') || '').toLowerCase();
    if (current && current !== selectedTier) setSelectedTier(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const plans = useMemo(() => ([
    {
      id: 'basic',
      label: 'Basic',
      priceLabel: '$5',
      priceSub: 'per month',
      features: ['5 Lessons per day', 'Extended Lessons', '1 Learner']
    },
    {
      id: 'plus',
      label: 'Plus',
      priceLabel: '$20',
      priceSub: 'per month',
      features: ['20 lessons per day', 'All Lessons', 'Up to 10 Learners', 'One device at a time']
    },
    {
      id: 'premium',
      label: 'Premium',
      priceLabel: '$35',
      priceSub: 'per month',
      features: ['Unlimited lessons', 'All Lessons', 'Up to 10 Learners', '2 Devices at a time', 'Premium Facilitator Tools']
    },
  ]), []);

  const changeTier = (tierId) => {
    if (!tierId || tierId === selectedTier) return;
    setError('');
    setClientSecret(''); // forces unmount/re-init of Payment Element
    setSelectedTier(tierId);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tier', tierId);
      url.searchParams.delete('rts');
      window.history.replaceState(null, '', url.toString());
    } catch {
      try { router.replace(`/billing/element/checkout?tier=${encodeURIComponent(tierId)}`); } catch {}
    }
  };

  // Initialize subscription for current tier
  useEffect(() => {
    (async () => {
      try {
        setError('');
        if (!selectedTier) throw new Error('Missing tier');
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Please log in to continue');
        const res = await fetch(`/api/billing/element/subscribe?tier=${encodeURIComponent(selectedTier)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || 'Failed to initialize subscription');
        }
        const data = await res.json();
        setClientSecret(data.client_secret);
      } catch (e) {
        setError(e?.message || 'Unable to load checkout');
      }
    })();
  }, [selectedTier]);

  // Mount Payment Element (guarded to avoid StrictMode double-mount noise in dev)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!clientSecret || !mountRef.current) return;
        // If we already mounted for this clientSecret, skip
        if (lastSecretRef.current === clientSecret && paymentElRef.current) return;

        if (!stripeRef.current) {
          const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
          if (!pk) throw new Error('Publishable key missing');
          const stripe = await loadStripe(pk);
          if (!stripe) throw new Error('Stripe failed to load');
          if (cancelled) return;
          stripeRef.current = stripe;
        }
        // If remounting due to a new clientSecret, clean up existing element first
        if (paymentElRef.current && lastSecretRef.current && lastSecretRef.current !== clientSecret) {
          try { paymentElRef.current.unmount(); } catch {}
          paymentElRef.current = null;
          elementsRef.current = null;
        }

        // mount with site-matching appearance (black accents)
        const appearance = {
          theme: 'stripe',
          variables: {
            colorPrimary: '#000000',
            colorText: '#111111',
            colorTextSecondary: '#222222',
            colorTextPlaceholder: '#6b7280',
            colorBackground: '#ffffff',
            colorDanger: '#b00020',
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
            borderRadius: '8px',
          },
          rules: {
            '.Tab': { borderColor: '#e5e7eb' },
            '.Tab--selected': { borderColor: '#000000', color: '#000000' },
            '.Tab:focus': { boxShadow: '0 0 0 1px #000000' },
            '.Tab:hover': { borderColor: '#111111' },
            '.Label': { color: '#111111' },
            '.Link': { color: '#000000' },
            '.Input': { color: '#111111', borderColor: '#e5e7eb' },
            '.Input:focus': { borderColor: '#000000', boxShadow: '0 0 0 1px #000000' },
            '.Block': { backgroundColor: '#ffffff' },
            '.AccordionItem--selected': { borderColor: '#000000', color: '#000000' }
            // Removed unsupported selectors like .AccordionTrigger and .Radio
          },
        };
        elementsRef.current = elementsRef.current || stripeRef.current.elements({ clientSecret, appearance });
        paymentElRef.current = elementsRef.current.create('payment', { layout: 'tabs' });
        paymentElRef.current.mount(mountRef.current);
        lastSecretRef.current = clientSecret;
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Unable to initialize payment form');
      }
    })();
    return () => {
      cancelled = true;
      // In dev, React StrictMode double-invokes effects; avoid spamming unmount/mount cycles
      if (process.env.NODE_ENV === 'production') {
        try { paymentElRef.current?.unmount(); } catch {}
        paymentElRef.current = null;
        elementsRef.current = null;
        lastSecretRef.current = null;
      }
    };
  }, [clientSecret]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!stripeRef.current || !elementsRef.current) return;
    setSubmitting(true);
    try {
      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        redirect: 'if_required',
      });
      if (result.error) throw result.error;
      const url = new URL('/facilitator/account/plan', window.location.origin);
      url.searchParams.set('rts', Date.now().toString());
      router.replace(url.toString());
    } catch (err) {
      alert(err?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLabel = useMemo(() => {
    if (!selectedTier) return 'plan';
    return selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1);
  }, [selectedTier]);

  return (
    <main style={{ padding: '0 24px 0', marginTop: 12 }}>
      <div style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
  {/* Removed informational subtitle per request */}

        {/* Micro plan comparison */}
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16, position: 'relative', zIndex: 20 }}>
          {plans.map(p => {
            const isSelected = p.id === selectedTier;
            const isActive = activeTooltip === p.id;
            const tooltip = p.features && p.features.length ? `Features:\n• ${p.features.join('\n• ')}` : undefined;
            return (
              <div
                key={p.id}
                style={{
                  border: isSelected ? '2px solid #111' : '1px solid #ddd',
                  borderRadius: 12,
                  padding: 12,
                  paddingTop: 26,
                  background: isSelected ? '#fafafa' : '#fff',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isSelected ? '0 8px 22px rgba(0,0,0,0.08)' : 'none',
                  zIndex: isSelected ? 1 : 0,
                  transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}
                onMouseEnter={() => p.features?.length && setActiveTooltip(p.id)}
                onMouseLeave={() => setActiveTooltip(prev => (prev === p.id ? null : prev))}
              >
                {isSelected ? (
                  <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 14, color: '#0a7', fontWeight: 700 }}>current</span>
                ) : null}
                {p.features?.length ? (
                  <div
                    id={`plan-tooltip-${p.id}`}
                    role="tooltip"
                    aria-hidden={!isActive}
                    style={{
                      position: 'absolute',
                      left: 12,
                      right: 12,
                      top: '100%',
                      marginTop: 10,
                      background: '#ffffff',
                      color: '#111',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      boxShadow: '0 8px 22px rgba(0,0,0,0.12)',
                      padding: '10px 12px',
                      fontSize: 12,
                      lineHeight: 1.4,
                      zIndex: 10000,
                      pointerEvents: 'none',
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? 'translateY(0)' : 'translateY(-4px)',
                      transition: 'opacity .12s ease, transform .12s ease'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: .2, marginBottom: 6 }}>Features</div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {p.features.map(f => (
                        <li key={f} style={{ margin: '4px 0' }}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 }}>
                  <strong style={{ fontSize: isSelected ? 18 : 16 }}>{p.label}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: isSelected ? 24 : 20, fontWeight: 700 }}>{p.priceLabel}</span>
                  <span style={{ color: '#666', fontSize: isSelected ? 13 : 12 }}>{p.priceSub}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { if (isSelected) { setActiveTooltip(null); return; } setActiveTooltip(null); changeTier(p.id); }}
                  disabled={false}
                  onFocus={() => p.features?.length && setActiveTooltip(p.id)}
                  onBlur={() => setActiveTooltip(prev => (prev === p.id ? null : prev))}
                  aria-describedby={p.features?.length ? `plan-tooltip-${p.id}` : undefined}
                  style={{
                    marginTop: 'auto',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: isSelected ? '1px solid #000' : '1px solid #c7442e',
                    background: isSelected ? '#fff' : '#c7442e',
                    color: isSelected ? '#111' : '#fff',
                    fontWeight: 600,
                    cursor: isSelected ? 'default' : 'pointer'
                  }}
                >
                  {isSelected ? 'Selected' : `Choose ${p.label}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Separator between plan comparison and embed */}
  <div style={{ width: '100%', height: 1, background: '#e5e7eb', margin: '40px 0' }} />

        {error ? (
          <div style={{ color: '#b00020' }}>{error}</div>
        ) : clientSecret ? (
          <form onSubmit={onSubmit} style={{ width: '100%', position: 'relative', zIndex: 0 }}>
            <div ref={mountRef} style={{ width: '100%', position: 'relative', zIndex: 0 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginTop: 28 }}>
              <div style={{ gridColumn: 1, justifySelf: 'start', color: '#555', fontSize: 12 }}>
                Powered by Stripe
              </div>
              <div style={{ gridColumn: 2, justifySelf: 'center' }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '12px 24px',
                    fontSize: 16,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                  }}
                >
                  {submitting ? 'Processing…' : `Subscribe to ${selectedLabel}`}
                </button>
              </div>
              <div style={{ gridColumn: 3, justifySelf: 'end', textAlign: 'right' }}>
                <a href="/facilitator/plan" style={{ color: '#c7442e', textDecoration: 'none', fontSize: 12, lineHeight: 1.2 }}>Cancel and go back</a>
              </div>
            </div>
          </form>
        ) : (
          <div>Loading…</div>
        )}

        <p style={{ marginTop: 12, color: '#6b7280', fontSize: 12 }}>
          By subscribing you agree to recurring charges and auto-renewal. See our <a href="/legal/billing">Subscription & Billing Terms</a> and <a href="/legal/refunds">Refund/Cancellation Policy</a>.
        </p>

      </div>
    </main>
  );
}
