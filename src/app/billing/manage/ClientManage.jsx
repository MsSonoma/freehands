"use client";

import React from 'react';
import { loadStripe } from '@stripe/stripe-js';

export default function ClientManage() {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [summary, setSummary] = React.useState(null);
  const [tier, setTier] = React.useState('');
  const [selectedTier, setSelectedTier] = React.useState('');
  const [updatingCard, setUpdatingCard] = React.useState(false); // true when form is visible
  const [cardBusy, setCardBusy] = React.useState(false); // network/confirm busy
  const [cardClientSecret, setCardClientSecret] = React.useState('');
  const stripeRef = React.useRef(null);
  const elementsRef = React.useRef(null);
  const paymentElRef = React.useRef(null);
  const mountRef = React.useRef(null);
  const [cancelBusy, setCancelBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [activeTooltip, setActiveTooltip] = React.useState(null);

  // Friendly labels for plan tiers and subscription statuses
  function formatTierLabel(t) {
    const map = { basic: 'Basic', plus: 'Plus', premium: 'Premium', free: 'Free' };
    const key = (t || '').toString().toLowerCase();
    if (map[key]) return map[key];
    if (!key) return 'Free';
    // Fallback: Title Case unknown tiers
    return key.replace(/(^|\s|[-_])/g, (m, p1) => p1 + '').replace(/\b\w/g, c => c.toUpperCase()).replace(/[-_]/g, ' ');
  }
  function formatSubStatus(s) {
    const key = (s || '').toString().toLowerCase();
    const map = {
      active: 'Active',
      trialing: 'Trialing',
      past_due: 'Past due',
      canceled: 'Canceled',
      unpaid: 'Unpaid',
      incomplete: 'Payment required',
      incomplete_expired: 'Inactive',
      paused: 'Paused',
    };
    if (!key) return 'Inactive';
    if (map[key]) return map[key];
    // Fallback: humanize underscored values
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const token = await getAccessToken();
        if (!token) throw new Error('Please log in to manage your subscription');
        const res = await fetch('/api/billing/manage/summary', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load summary');
        if (cancelled) return;
    setSummary(json);
    const currentTier = (json?.effective_tier || json?.subscription?.tier || json?.plan_tier || 'free')?.toLowerCase();
    setTier(currentTier);
    setSelectedTier(currentTier);
      } catch (e) {
        setErr(e?.message || 'Unexpected error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleUpdateCard() {
    setMessage(''); setErr(''); setCardBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please log in');
      const siRes = await fetch('/api/billing/manage/setup-intent', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const si = await siRes.json();
      if (!siRes.ok) throw new Error(si?.error || 'Failed to create SetupIntent');
      setCardClientSecret(si.client_secret);
      setUpdatingCard(true);
    } catch (e) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setCardBusy(false);
    }
  }

  // Mount Payment Element for updating card
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!updatingCard || !cardClientSecret || !mountRef.current) return;
        if (!stripeRef.current) {
          const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
          if (!pk) throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
          const stripe = await loadStripe(pk);
          if (!stripe) throw new Error('Stripe failed to load');
          if (cancelled) return;
          stripeRef.current = stripe;
        }
        // reset and mount
        elementsRef.current = null;
        try { paymentElRef.current?.unmount(); } catch {}
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
            '.Input': { color: '#111111', borderColor: '#e5e7eb' },
            '.Input:focus': { borderColor: '#000000', boxShadow: '0 0 0 1px #000000' },
            '.Label': { color: '#111111' },
          },
        };
        elementsRef.current = stripeRef.current.elements({ clientSecret: cardClientSecret, appearance });
        paymentElRef.current = elementsRef.current.create('payment', { layout: 'tabs' });
        paymentElRef.current.mount(mountRef.current);
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Unable to initialize payment form');
      }
    })();
    return () => {
      cancelled = true;
      try { paymentElRef.current?.unmount(); } catch {}
    };
  }, [updatingCard, cardClientSecret]);

  async function saveUpdatedCard() {
    setCardBusy(true); setErr(''); setMessage('');
    try {
      if (!stripeRef.current || !elementsRef.current) throw new Error('Payment form not ready');
      const result = await stripeRef.current.confirmSetup({
        elements: elementsRef.current,
        redirect: 'if_required',
      });
      if (result.error) throw new Error(result.error.message || 'Failed to confirm');
      const pm = result.setupIntent?.payment_method;
      if (!pm) throw new Error('Missing payment_method');
      const token = await getAccessToken();
      if (!token) throw new Error('Please log in');
      const setRes = await fetch('/api/billing/manage/set-default', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ payment_method: pm }) });
      const setJson = await setRes.json().catch(()=>({}));
      if (!setRes.ok) throw new Error(setJson?.error || 'Failed to set default');
      setMessage('Payment method updated');
      // refresh summary
      const sumRes = await fetch('/api/billing/manage/summary', { headers: { Authorization: `Bearer ${token}` } });
      const sumJs = await sumRes.json(); if (sumRes.ok) {
        setSummary(sumJs);
        const current = (sumJs?.effective_tier || sumJs?.subscription?.tier || sumJs?.plan_tier || 'free')?.toLowerCase();
        setTier(current);
      }
      // close form
      try { paymentElRef.current?.unmount(); } catch {}
      elementsRef.current = null; paymentElRef.current = null; setCardClientSecret(''); setUpdatingCard(false);
    } catch (e) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setCardBusy(false);
    }
  }

  function cancelCardUpdate() {
    try { paymentElRef.current?.unmount(); } catch {}
    elementsRef.current = null; paymentElRef.current = null; setCardClientSecret(''); setUpdatingCard(false);
  }

  async function handlePlanSave() {
    if (!selectedTier || selectedTier === tier) return;
    setMessage(''); setErr(''); setSaveBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please log in');
      const res = await fetch('/api/billing/manage/update', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tier: selectedTier }) });
      const js = await res.json();
      if (!res.ok) throw new Error(js?.error || 'Failed to update plan');
      setTier(selectedTier);
      setMessage('Plan updated');
      // refresh summary
      const sumRes = await fetch('/api/billing/manage/summary', { headers: { Authorization: `Bearer ${token}` } });
      const sumJs = await sumRes.json(); if (sumRes.ok) {
        setSummary(sumJs);
        const current = (sumJs?.effective_tier || sumJs?.subscription?.tier || sumJs?.plan_tier || 'free')?.toLowerCase();
        setTier(current);
      }
    } catch (e) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleCancel(mode) {
    setMessage(''); setErr(''); setCancelBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please log in');
      const res = await fetch('/api/billing/manage/cancel', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ mode }) });
      const js = await res.json();
      if (!res.ok) throw new Error(js?.error || 'Failed to update cancellation');
      setMessage(mode === 'resume' ? 'Cancellation removed' : 'Cancellation updated');
      const sumRes = await fetch('/api/billing/manage/summary', { headers: { Authorization: `Bearer ${token}` } });
      const sumJs = await sumRes.json(); if (sumRes.ok) setSummary(sumJs);
    } catch (e) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setCancelBusy(false);
    }
  }

  async function submitSurveyAndCancelNow() {
    try {
      setCancelBusy(true);
      const token = await getAccessToken();
      if (!token) throw new Error('Please log in');
      // Send feedback (best-effort)
      const fb = await fetch('/api/billing/manage/feedback', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ reasons: surveyReasons, message: surveyMessage, allowContact: surveyAllowContact }) });
      await fb.json().catch(()=>({}));
      // Proceed to cancel now
      await handleCancel('now');
      setShowSurvey(false);
    } catch (e) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setCancelBusy(false);
    }
  }

  if (loading) return <p style={{ color:'#555' }}>Loading…</p>;
  if (err) return (
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ color:'#b00020' }}>{err}</div>
      <a href="/auth/login" style={{ padding:'8px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', textDecoration:'none', width:'fit-content' }}>Go to Login</a>
    </div>
  );

  const plans = [
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
  ];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <h1 style={{ margin:0 }}>Manage subscription</h1>
        <a href="/facilitator/account/plan" className="back-link" style={{ color:'#c7442e', textDecoration:'none' }}>← Back to plans</a>
      </div>

      <p style={{ marginTop:8, color:'#6b7280', fontSize: 12 }}>
        Cancellations take effect at period end; no proration on cancel. Upgrades are instant and cannot be canceled until the next period. See <a href="/legal/billing">Subscription & Billing Terms</a> and <a href="/legal/refunds">Refund/Cancellation Policy</a>.
      </p>

      {message && <div style={{ marginTop:12, padding:12, border:'1px solid #e5e5e5', borderRadius:8, background:'#f8f8f8', color:'#0a7' }}>{message}</div>}

      <div style={{ marginTop:16, borderTop:'1px solid #eee' }} />

      {/* Mini plan comparison with Save */}
      <div style={{ marginTop:16 }}>
        <div style={{ marginBottom:8, color:'#666' }}>Plan</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12, position:'relative', zIndex:20 }}>
          {plans.map(p => {
            const isSelected = p.id === selectedTier;
            const isActive = activeTooltip === p.id;
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
                      position: 'absolute', left: 12, right: 12, top: '100%', marginTop: 10,
                      background: '#ffffff', color: '#111', border: '1px solid #e5e7eb', borderRadius: 8,
                      boxShadow: '0 8px 22px rgba(0,0,0,0.12)', padding: '10px 12px', fontSize: 12, lineHeight: 1.4,
                      zIndex: 10000, pointerEvents: 'none', opacity: isActive ? 1 : 0,
                      transform: isActive ? 'translateY(0)' : 'translateY(-4px)', transition: 'opacity .12s ease, transform .12s ease'
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
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', minHeight: 22 }}>
                  <strong style={{ fontSize: isSelected ? 18 : 16 }}>{p.label}</strong>
                  {p.id === tier ? (
                    <span style={{ fontSize: 12, color: '#0a7', fontWeight: 600 }}>Current</span>
                  ) : null}
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:6, marginTop:6 }}>
                  <span style={{ fontSize: isSelected ? 24 : 20, fontWeight:700 }}>{p.priceLabel}</span>
                  <span style={{ color:'#666', fontSize: isSelected ? 13 : 12 }}>{p.priceSub}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (p.id === tier) return; // current plan, no-op
                    if (isSelected) { setActiveTooltip(null); return; }
                    setActiveTooltip(null);
                    setSelectedTier(p.id);
                  }}
                  disabled={p.id === tier}
                  onFocus={() => p.features?.length && setActiveTooltip(p.id)}
                  onBlur={() => setActiveTooltip(prev => (prev === p.id ? null : prev))}
                  aria-describedby={p.features?.length ? `plan-tooltip-${p.id}` : undefined}
                  style={{
                    marginTop: 'auto', width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: (p.id === tier || isSelected) ? '1px solid #000' : '1px solid #c7442e',
                    background: (p.id === tier || isSelected) ? '#fff' : '#c7442e', color: (p.id === tier || isSelected) ? '#111' : '#fff',
                    fontWeight: 600, cursor: (p.id === tier) ? 'default' : 'pointer'
                  }}
                >
                  {p.id === tier ? 'Current' : (isSelected ? 'Selected' : `Choose ${p.label}`)}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', marginTop: 12 }}>
          <div />
          <div style={{ justifySelf:'center' }}>
            <button onClick={handlePlanSave} disabled={saveBusy || selectedTier === tier}
              style={{ padding:'10px 16px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff' }}>
              {saveBusy ? 'Saving…' : 'Save plan'}
            </button>
          </div>
          <div />
        </div>
      </div>

      <div style={{ marginTop:24, borderTop:'1px solid #eee' }} />

      {/* Payment method */}
      <div style={{ marginTop:16 }}>
        <div style={{ marginBottom:8, color:'#666' }}>Payment method</div>
        {summary?.paymentMethod ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:'#444' }}>{summary.paymentMethod.brand} •••• {summary.paymentMethod.last4} (exp {summary.paymentMethod.exp_month}/{summary.paymentMethod.exp_year})</span>
          </div>
        ) : (
          <div style={{ color:'#666' }}>No default card on file</div>
        )}
        {!updatingCard ? (
          <div style={{ marginTop:8 }}>
            <button onClick={handleUpdateCard} disabled={cardBusy} style={{ padding:'10px 14px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff' }}>{cardBusy?'Preparing…':'Update card'}</button>
          </div>
        ) : (
          <div style={{ marginTop:12, padding:12, border:'1px solid #e5e7eb', borderRadius:8 }}>
            <div ref={mountRef} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center', marginTop:12 }}>
              <div style={{ color:'#555', fontSize:12 }}>Powered by Stripe</div>
              <button onClick={cancelCardUpdate} disabled={cardBusy} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff' }}>Cancel</button>
              <button onClick={saveUpdatedCard} disabled={cardBusy} style={{ padding:'8px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff' }}>{cardBusy ? 'Saving…' : 'Save card'}</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop:24, borderTop:'1px solid #eee' }} />

      {/* Cancel/resume */}
      <div style={{ marginTop:16 }}>
        <div style={{ marginBottom:8, color:'#666' }}>Status</div>
        {summary?.subscription ? (
          <div style={{ display:'grid', gap:8 }}>
            <div style={{ color:'#444' }}>
              Plan: {formatTierLabel(summary.subscription.tier || summary.effective_tier || tier)}
              {' '}
              <span style={{ color:'#666' }}>
                ({formatSubStatus(summary.subscription.status)}{summary.subscription.cancel_at_period_end ? '; cancels at period end' : ''})
              </span>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {!summary.subscription.cancel_at_period_end && (
                <button onClick={() => handleCancel('end_of_period')} disabled={cancelBusy} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff' }}>Cancel Subscription</button>
              )}
              {summary.subscription.cancel_at_period_end && (
                <button onClick={() => handleCancel('resume')} disabled={cancelBusy} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff' }}>Resume</button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ color:'#666' }}>Plan: {formatTierLabel(summary?.effective_tier || tier)} (Inactive)</div>
        )}
      </div>

      {/* Immediate-cancel survey removed; only end-of-period cancel supported here. */}
      <style>{`
        .back-link:focus-visible { outline: 2px solid #c7442e; outline-offset: 2px; }
        @media (max-width: 480px) {
          /* Ensure header row reserves space for status badge on small screens */
          [role="tooltip"] { pointer-events: none; }
        }
      `}</style>
    </div>
  );
}

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

