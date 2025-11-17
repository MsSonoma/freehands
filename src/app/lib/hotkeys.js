// Hotkeys preferences: defaults, local storage helpers, and server sync helpers

export const DEFAULT_HOTKEYS = Object.freeze({
  beginSend: 'Enter',            // Begin overlays + Send in input
  micHold: 'NumpadAdd',          // Hold to record voice
  skip: 'ArrowRight',            // Skip forward
  repeat: 'ArrowLeft',           // Repeat last speech
  muteToggle: 'NumpadMultiply'   // Toggle mute
});

const LS_KEY = 'facilitator_hotkeys';

export function getHotkeysLocal() {
  if (typeof window === 'undefined') return { ...DEFAULT_HOTKEYS };
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_HOTKEYS, ...(parsed || {}) };
  } catch { return { ...DEFAULT_HOTKEYS } }
}

export function setHotkeysLocal(next) {
  if (typeof window === 'undefined') return;
  try {
    const merged = { ...DEFAULT_HOTKEYS, ...(next || {}) };
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
  } catch {}
}

export function isTextEntryTarget(t) {
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  const editable = t.isContentEditable;
  return editable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

export async function fetchHotkeysServer() {
  try {
    const mod = await import('@/app/lib/supabaseClient');
    const supabase = mod.getSupabaseClient?.();
    if (!supabase || !mod.hasSupabaseEnv?.()) return { ok: false, reason: 'no-env' };
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { ok: false, reason: 'no-token' };
    const res = await fetch('/api/facilitator/hotkeys', { headers: { Authorization: `Bearer ${token}` } });
    const js = await res.json().catch(()=>({}));
    if (!res.ok || !js?.ok) return { ok: false, reason: js?.error || 'fetch-failed' };
    const hk = { ...DEFAULT_HOTKEYS, ...(js.hotkeys || {}) };
    return { ok: true, hotkeys: hk };
  } catch (e) {
    return { ok: false, reason: e?.message || 'error' };
  }
}

export async function saveHotkeysServer(hotkeys) {
  try {
    const mod = await import('@/app/lib/supabaseClient');
    const supabase = mod.getSupabaseClient?.();
    if (!supabase || !mod.hasSupabaseEnv?.()) return { ok: false, reason: 'no-env' };
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { ok: false, reason: 'no-token' };
    const res = await fetch('/api/facilitator/hotkeys', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ hotkeys })
    });
    const js = await res.json().catch(()=>({}));
    if (!res.ok || !js?.ok) return { ok: false, reason: js?.error || 'save-failed' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || 'error' };
  }
}
