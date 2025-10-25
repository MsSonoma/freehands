"use client";
import Link from 'next/link';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensurePinAllowed } from '@/app/lib/pinGate';

// Facilitator Hub
export default function FacilitatorPage() {
  const router = useRouter();

  const cardStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 12,
    background: '#fff', color: '#111', textDecoration: 'none', fontWeight: 600,
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)', boxSizing: 'border-box'
  };

  // Black button variant for Login/Logout
  const authCardStyle = {
    ...cardStyle,
    background: '#111',
    color: '#fff',
    border: '1px solid #111'
  };

  const [plan, setPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [facilitatorName, setFacilitatorName] = useState('');
  const [pinChecked, setPinChecked] = useState(false);

  // Check PIN requirement on mount - this is the main entry point to facilitator section
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

  useEffect(() => {
    let cancelled = false;
    let authSub = null;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          setSession(session || null);
          if (session?.user) {
            // Fetch plan tier
            try {
              const { data: planRow } = await supabase
                .from('profiles')
                .select('plan_tier')
                .eq('id', session.user.id)
                .maybeSingle();
              if (!cancelled && planRow?.plan_tier) setPlan(planRow.plan_tier);
            } catch (e) {}
            // Load name from profiles.full_name first, then fallback to auth metadata
            try {
              const { data: profRow } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', session.user.id)
                .maybeSingle();
              if (!cancelled) {
                let name = '';
                if (profRow && typeof profRow.full_name === 'string' && profRow.full_name.trim()) {
                  name = profRow.full_name.trim();
                }
                if (!name) {
                  const meta = session?.user?.user_metadata || {};
                  name = (meta.full_name || meta.display_name || meta.name || '').trim();
                }
                setFacilitatorName(name);
              }
            } catch (e) {
              if (!cancelled) {
                const meta = session?.user?.user_metadata || {};
                const name = (meta.full_name || meta.display_name || meta.name || '').trim();
                setFacilitatorName(name);
              }
            }
            // Try to get the canonical/effective tier from the billing summary API
            try {
              const token = session?.access_token || (await supabase.auth.getSession())?.data?.session?.access_token;
              if (token) {
                const res = await fetch('/api/billing/manage/summary', { headers: { Authorization: `Bearer ${token}` } });
                const js = await res.json().catch((_e) => null);
                if (res.ok && js) {
                  const eff = (js?.effective_tier || js?.subscription?.tier || js?.plan_tier || null);
                  if (eff) {
                    if (!cancelled) setPlan(String(eff).toLowerCase());
                  }
                }
              }
            } catch (e) {}
          }
          // Subscribe to auth changes to keep UI in sync
          const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
            if (!cancelled) setSession(s || null);
          });
          authSub = sub?.subscription;
        }
      } catch (e) {}
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
      try { authSub?.unsubscribe?.() } catch (e) {}
    };
  }, []);

  // Listen for profile name updates (from Account page)
  useEffect(() => {
    const onNameUpdate = (e) => {
      try {
        const detail = e?.detail || {};
        if (detail?.name) setFacilitatorName(String(detail.name));
      } catch (e) {}
    };
    window.addEventListener('ms:profile:name:updated', onNameUpdate);
    return () => window.removeEventListener('ms:profile:name:updated', onNameUpdate);
  }, []);

  // Clean up cache-busting param from trampoline
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      if (url.searchParams.has('rts')) {
        // User just returned from OAuth, mark facilitator section as active to skip PIN
        try { sessionStorage.setItem('facilitator_section_active', '1'); } catch {}
        url.searchParams.delete('rts');
        window.history.replaceState(null, '', url.toString());
      }
    } catch (e) {}
  }, []);

  async function openPortal() {
    try {
      // Use in-app embedded manage page to avoid stale portal history
      window.location.assign('/billing/manage');
    } catch (e) {
      alert(e?.message || 'Unable to open manage page');
    }
  }

  // Clear any stale Stripe action locks when this page becomes visible again
  useEffect(() => {
    const clearLocks = () => {
      try {
        const keys = Object.keys(sessionStorage || {});
        for (const k of keys) if (k.startsWith('stripe_action_lock_')) sessionStorage.removeItem(k);
      } catch (e) {}
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        try {
          const pending = sessionStorage.getItem('stripe_nav_pending');
          if (pending) {
            sessionStorage.removeItem('stripe_nav_pending');
            window.location.reload();
            return;
          }
        } catch (e) {}
        clearLocks();
      }
    };
    const onShow = (e) => {
      if (e && e.persisted) {
        try { window.location.reload(); return; } catch (e) {}
        clearLocks();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onShow);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('focus', onVis);
    };
  }, []);

  // Don't render page content until PIN check is complete
  if (!pinChecked) {
    return <div style={{ padding: '12px 24px 0', textAlign: 'center' }}><p>Loading…</p></div>;
  }

  return (
    <div style={{ padding: '4px 24px 0' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ marginTop: 0, marginBottom: 0, textAlign: 'center' }}>{facilitatorName ? `Hi, ${facilitatorName}!` : 'Facilitator'}</h1>
        <p style={{ color: '#555', marginTop: 0, marginBottom: 4, textAlign: 'center' }}>Choose a section to manage.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link href="/facilitator/account" style={cardStyle}>Account</Link>
          <Link href="/facilitator/learners" style={cardStyle}>Learners</Link>
          <Link href="/facilitator/lessons" style={cardStyle}>Lessons</Link>
          <Link href="/facilitator/calendar" style={cardStyle}>Calendar</Link>
        </div>

        {/* Billing summary */}
        <section aria-label="Billing" style={{ marginTop: 16, padding: 6, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 0', fontSize: 18, textAlign: 'center' }}>Billing</h2>
          <p style={{ margin: '0 0 4px', color: '#444', textAlign: 'center' }}>
            Subscription: {loading ? '…' : (plan || 'free')}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button type="button" onClick={openPortal} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8, background: '#f7f7f7' }}>
              Manage subscription
            </button>
          </div>
        </section>

        {/* Mr. Mentor video button */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <Link 
            href="/facilitator/generator/counselor"
            title="Mr. Mentor"
            style={{
              display: 'block',
              width: 80,
              height: 80,
              border: '2px solid #111',
              borderRadius: 12,
              overflow: 'hidden',
              padding: 0,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
            >
              <source src="/media/Mr Mentor.mp4" type="video/mp4" />
            </video>
          </Link>
        </div>
        <p style={{ textAlign: 'center', color: '#555', fontSize: 14, marginTop: 8 }}>
          Talk to Mr. Mentor
        </p>
      </div>
    </div>
  );
}

