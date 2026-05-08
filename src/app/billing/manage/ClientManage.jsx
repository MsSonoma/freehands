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
  const [cardReady, setCardReady] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [saveBusy, setSaveBusy] = React.useState(false);

  // Friendly labels for plan tiers and subscription statuses
  function formatTierLabel(t) {
    const map = { trial: 'Trial', standard: 'Standard', pro: 'Pro', free: 'Free' };
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
    setSelectedTier(['standard','pro'].includes(currentTier) ? currentTier : 'standard');
      } catch (e) {
        setErr(e?.message || 'Unexpected error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleUpdateCard() {
    setMessage(''); setErr(''); setCardBusy(true); setCardReady(false);
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
          if (!pk) throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — contact support.');
          if (pk.startsWith('pk_test_') && cardClientSecret?.startsWith('seti_') && !cardClientSecret?.includes('_test_')) {
            throw new Error('Stripe key mode mismatch: test publishable key is active in this build. Please contact support or try again later.');
          }
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
        paymentElRef.current.on('ready', () => { if (!cancelled) setCardReady(true); });
        paymentElRef.current.on('loaderror', (ev) => {
          if (!cancelled) setErr(ev?.error?.message || 'Payment form failed to load. Please refresh and try again.');
        });
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
      if (!stripeRef.current || !elementsRef.current || !cardClientSecret) throw new Error('Payment form not ready');
      // Step 1: validate & collect payment details
      const { error: submitError } = await elementsRef.current.submit();
      if (submitError) throw new Error(submitError.message || 'Validation failed');
      // Step 2: confirm setup using clientSecret directly
      const baseUrl = window.location.origin;
      const returnUrl = `${baseUrl}/facilitator/account/plan`;
      const result = await stripeRef.current.confirmSetup({
        clientSecret: cardClientSecret,
        confirmParams: { return_url: returnUrl },
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
      elementsRef.current = null; paymentElRef.current = null; setCardClientSecret(''); setUpdatingCard(false); setCardReady(false);
    } catch (e) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setCardBusy(false);
    }
  }

  function cancelCardUpdate() {
    try { paymentElRef.current?.unmount(); } catch {}
    elementsRef.current = null; paymentElRef.current = null; setCardClientSecret(''); setUpdatingCard(false); setCardReady(false);
  }

  async function handlePlanSave() {
    if (!selectedTier || selectedTier === tier) return;
    setMessage(''); setErr(''); setSaveBusy(true);
    try {
      if (!summary?.subscription?.id) {
        // No active subscription — redirect to checkout to subscribe
        if (typeof window !== 'undefined') {
          window.location.assign(`/billing/element/checkout?tier=${encodeURIComponent(selectedTier)}`);
        }
        return;
      }
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
        setSelectedTier(['standard','pro'].includes(current) ? current : 'standard');
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

  if (loading) return <p style={{ color:'#888', padding:'40px 0', textAlign:'center' }}>Loading…</p>;
  if (err && !summary) return (
    <div style={{ display:'grid', gap:12, textAlign:'center', padding:'40px 0' }}>
      <div style={{ color:'#b00020', fontSize:14 }}>{err}</div>
      <a href="/auth/login" style={{ padding:'10px 16px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', textDecoration:'none', width:'fit-content', margin:'0 auto', fontSize:14 }}>Go to Login</a>
    </div>
  );

  const plans = [
    {
      id: 'standard',
      label: 'Standard',
      priceLabel: '$49',
      priceSub: '/month',
      features: ['Unlimited lessons', 'Up to 2 learners', 'Golden Keys', 'Visual Aids & Games'],
    },
    {
      id: 'pro',
      label: 'Pro',
      priceLabel: '$69',
      priceSub: '/month',
      badge: 'Most popular',
      features: ['Everything in Standard', 'Up to 5 learners', 'Mr. Mentor AI tutor', 'Lesson Planner', 'Curriculum Preferences'],
    },
  ];

  const statusColor = { active: '#0a7', trialing: '#0a7', past_due: '#c7442e', unpaid: '#c7442e', canceled: '#888', incomplete: '#b57e00', paused: '#888' };
  const subStatus = summary?.subscription?.status || '';
  const badgeColor = statusColor[subStatus] || '#888';
  const isCancelPending = summary?.subscription?.cancel_at_period_end;

  const selectedLabel = selectedTier ? selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1) : '';
  const ctaLabel = saveBusy ? 'Processing…' : summary?.subscription?.id ? `Switch to ${selectedLabel}` : `Subscribe to ${selectedLabel}`;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111', maxWidth: 680, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 28 }}>
        <h1 style={{ margin:0, fontSize:24, fontWeight:700 }}>Plan &amp; billing</h1>
        <a href="/facilitator/account" style={{ color:'#c7442e', textDecoration:'none', fontSize:14, fontWeight:500 }}>← Back to account</a>
      </div>

      {/* ── Toast messages ── */}
      {message && (
        <div style={{ marginBottom:20, padding:'12px 16px', borderRadius:8, background:'#f0faf4', border:'1px solid #a7e3c0', color:'#0a6640', fontSize:14, display:'flex', alignItems:'center', gap:8 }}>
          <span>✓</span> {message}
        </div>
      )}
      {err && (
        <div style={{ marginBottom:20, padding:'12px 16px', borderRadius:8, background:'#fff5f5', border:'1px solid #fca5a5', color:'#b00020', fontSize:14 }}>
          {err}
        </div>
      )}

      {/* ── Current subscription status card ── */}
      {summary?.subscription && (
        <div style={{ marginBottom:28, padding:'16px 20px', borderRadius:12, border:'1px solid #e5e7eb', background:'#fafafa', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:12, color:'#888', fontWeight:500, letterSpacing:.4, textTransform:'uppercase', marginBottom:4 }}>Current plan</div>
            <div style={{ fontSize:18, fontWeight:700 }}>{formatTierLabel(summary.subscription.tier || tier)}</div>
            {isCancelPending && (
              <div style={{ fontSize:12, color:'#c7442e', marginTop:4 }}>Cancels at end of billing period</div>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background: badgeColor + '18', color: badgeColor, fontSize:12, fontWeight:600 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background: badgeColor, display:'inline-block' }} />
              {formatSubStatus(subStatus)}
            </span>
            {!isCancelPending ? (
              <button onClick={() => handleCancel('end_of_period')} disabled={cancelBusy}
                style={{ padding:'6px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', color:'#666', fontSize:12, cursor:'pointer', fontWeight:500 }}>
                {cancelBusy ? 'Updating…' : 'Cancel subscription'}
              </button>
            ) : (
              <button onClick={() => handleCancel('resume')} disabled={cancelBusy}
                style={{ padding:'6px 12px', border:'1px solid #111', borderRadius:8, background:'#fff', color:'#111', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                {cancelBusy ? 'Updating…' : 'Resume subscription'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Plan cards ── */}
      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#555', letterSpacing:.3, textTransform:'uppercase', marginBottom:16 }}>
          {summary?.subscription?.id ? 'Switch plan' : 'Choose a plan'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:16 }}>
          {plans.map(p => {
            const isCurrent = p.id === tier;
            const isSelected = p.id === selectedTier;
            return (
              <div
                key={p.id}
                onClick={() => { if (!isCurrent) setSelectedTier(p.id); }}
                style={{
                  position:'relative', borderRadius:16, padding:'24px 20px',
                  border: isCurrent ? '2px solid #111' : isSelected ? '2px solid #111' : '1.5px solid #e5e7eb',
                  background: '#fff',
                  boxShadow: isSelected ? '0 4px 20px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
                  cursor: isCurrent ? 'default' : 'pointer',
                  transition: 'box-shadow .15s, border-color .15s',
                  display:'flex', flexDirection:'column',
                }}
              >
                {/* Badge */}
                {isCurrent && (
                  <span style={{ position:'absolute', top:-1, right:16, background:'#111', color:'#fff', fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:'0 0 8px 8px', letterSpacing:.4 }}>CURRENT</span>
                )}
                {!isCurrent && p.badge && (
                  <span style={{ position:'absolute', top:-1, right:16, background:'#c7442e', color:'#fff', fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:'0 0 8px 8px', letterSpacing:.4 }}>{p.badge.toUpperCase()}</span>
                )}

                <div style={{ fontSize:17, fontWeight:700, marginBottom:8 }}>{p.label}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:16 }}>
                  <span style={{ fontSize:36, fontWeight:800, letterSpacing:-1 }}>{p.priceLabel}</span>
                  <span style={{ fontSize:13, color:'#888' }}>{p.priceSub}</span>
                </div>
                <ul style={{ margin:'0 0 20px 0', padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:7, flexGrow:1 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#333' }}>
                      <span style={{ color:'#0a7', fontWeight:700, fontSize:14, flexShrink:0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div style={{ padding:'9px 0', textAlign:'center', fontSize:13, fontWeight:600, color:'#888', borderTop:'1px solid #f0f0f0' }}>Your current plan</div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedTier(p.id); }}
                    style={{
                      marginTop:'auto', padding:'10px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer',
                      border: isSelected ? '2px solid #111' : '1.5px solid #e5e7eb',
                      background: isSelected ? '#111' : '#fff',
                      color: isSelected ? '#fff' : '#555',
                      transition: 'all .12s',
                    }}
                  >
                    {isSelected ? '✓ Selected' : `Select ${p.label}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── CTA: confirm selection ── */}
        {selectedTier && selectedTier !== tier && (
          <div style={{ marginTop:20, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <button
              onClick={handlePlanSave}
              disabled={saveBusy}
              style={{
                padding:'13px 40px', borderRadius:10, fontSize:15, fontWeight:700,
                border:'none', background:'#111', color:'#fff', cursor: saveBusy ? 'wait' : 'pointer',
                boxShadow:'0 2px 8px rgba(0,0,0,0.18)', transition:'opacity .12s',
                opacity: saveBusy ? 0.7 : 1,
              }}
            >
              {ctaLabel}
            </button>
            {summary?.subscription?.id && (
              <span style={{ fontSize:12, color:'#888' }}>Plan change takes effect immediately</span>
            )}
          </div>
        )}
      </div>

      {/* ── Payment method ── */}
      <div style={{ marginTop:32, padding:'20px 20px', borderRadius:12, border:'1px solid #e5e7eb', background:'#fff' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#555', letterSpacing:.3, textTransform:'uppercase', marginBottom:14 }}>Payment method</div>
        {!updatingCard ? (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            {summary?.paymentMethod ? (
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:44, height:28, borderRadius:4, border:'1px solid #e5e7eb', background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#555', letterSpacing:.3 }}>
                  {(summary.paymentMethod.brand || 'CARD').toUpperCase().slice(0,4)}
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>•••• •••• •••• {summary.paymentMethod.last4}</div>
                  <div style={{ fontSize:12, color:'#888' }}>Expires {summary.paymentMethod.exp_month}/{summary.paymentMethod.exp_year}</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize:14, color:'#888' }}>No payment method on file</div>
            )}
            <button onClick={handleUpdateCard} disabled={cardBusy}
              style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#111', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              {cardBusy ? 'Preparing…' : summary?.paymentMethod ? 'Update card' : 'Add card'}
            </button>
          </div>
        ) : (
          <div>
            <div ref={mountRef} style={{ minHeight: 200 }} />
            {err && updatingCard && (
              <div style={{ marginTop:8, color:'#b00020', fontSize:13 }}>{err}</div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, flexWrap:'wrap', gap:8 }}>
              <span style={{ fontSize:12, color:'#aaa' }}>Powered by Stripe</span>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={cancelCardUpdate} disabled={cardBusy}
                  style={{ padding:'8px 16px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', color:'#555', fontSize:13, cursor:'pointer' }}>Cancel</button>
                <button onClick={saveUpdatedCard} disabled={cardBusy || !cardReady}
                  style={{ padding:'8px 20px', border:'none', borderRadius:8, background:'#111', color:'#fff', fontSize:13, fontWeight:600, cursor: (!cardReady || cardBusy) ? 'wait' : 'pointer', opacity: (!cardReady && !cardBusy) ? 0.5 : 1 }}>
                  {cardBusy ? 'Saving…' : !cardReady ? 'Loading…' : 'Save card'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Legal ── */}
      <p style={{ marginTop:24, color:'#aaa', fontSize:11, lineHeight:1.6 }}>
        Cancellations take effect at period end. Upgrades are immediate. See our{' '}
        <a href="/legal/billing" style={{ color:'#aaa' }}>Billing Terms</a> and{' '}
        <a href="/legal/refunds" style={{ color:'#aaa' }}>Refund Policy</a>.
      </p>

      <style>{`
        .back-link:focus-visible { outline: 2px solid #c7442e; outline-offset: 2px; }
        @media (max-width: 540px) {
          div[style*="grid-template-columns: repeat(2, 1fr)"] { grid-template-columns: 1fr !important; }
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

