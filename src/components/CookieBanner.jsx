"use client";
import React from 'react';

const STORAGE_KEY = 'cookie_prefs_v1';

export default function CookieBanner() {
  const [open, setOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const bannerRef = React.useRef(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setOpen(true); return; }
      const prefs = JSON.parse(raw);
      setAnalytics(!!prefs.analytics);
    } catch {
      setOpen(true);
    }
  }, []);

  // Reserve space for the fixed banner so footers remain visible
  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const updatePadding = () => {
      try {
        if (!open) { document.body.style.paddingBottom = ''; return; }
        const h = bannerRef.current?.offsetHeight || 0;
        document.body.style.paddingBottom = h ? `${h}px` : '';
      } catch {}
    };

    updatePadding();

    let ro;
    try {
      if (bannerRef.current && 'ResizeObserver' in window) {
        ro = new ResizeObserver(() => updatePadding());
        ro.observe(bannerRef.current);
      }
    } catch {}

    return () => {
      try { if (ro) ro.disconnect(); } catch {}
      try { document.body.style.paddingBottom = ''; } catch {}
    };
  }, [open, manageOpen]);

  const save = (val) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: !!val, ts: Date.now() })); } catch {}
    setAnalytics(!!val);
  };

  if (!open) return null;

  return (
    <div ref={bannerRef} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999, background: '#fff', borderTop: '1px solid #e5e7eb' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260, color: '#111' }}>
          We use essential cookies and optional analytics to improve the app. See our <a href="/legal/cookies">Cookie Policy</a>.
        </div>
        {!manageOpen ? (
          <>
            <button onClick={() => { save(true); setOpen(false); }} style={{ padding: '8px 12px', border: '1px solid #111', borderRadius: 6, background: '#111', color: '#fff' }}>
              Accept
            </button>
            <button onClick={() => setManageOpen(true)} style={{ padding: '8px 12px', border: '1px solid #111', borderRadius: 6, background: '#fff', color: '#111' }}>
              Manage
            </button>
          </>
        ) : (
          <div style={{ width: '100%' }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Preferences</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <input type="checkbox" checked disabled />
              Strictly necessary (always on)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
              Analytics
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { save(analytics); setOpen(false); }} style={{ padding: '8px 12px', border: '1px solid #111', borderRadius: 6, background: '#111', color: '#fff' }}>Save</button>
              <button onClick={() => setManageOpen(false)} style={{ padding: '8px 12px', border: '1px solid #111', borderRadius: 6, background: '#fff', color: '#111' }}>Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
