// Device concurrency ("devices at a time") stub helpers.
// This module outlines a client-facing API that should call server routes
// to claim/release a per-user device slot backed by Supabase.
//
// Proposed server design:
// - Table: device_leases { id uuid pk, user_id uuid, device_id text, acquired_at timestamptz, expires_at timestamptz, released_at timestamptz }
// - Unique: (user_id, device_id) active rows
// - Server endpoints (service role): POST /api/devices/claim, POST /api/devices/release, GET /api/devices/status
// - Enforce ENTITLEMENTS[tier].devices by counting active leases for a user and comparing against cap.
// - Auto-expire leases after inactivity (e.g., heartbeat or rolling TTL).
//
// For now these are no-ops that always "succeed" so we can progressively integrate without blocking.

export function getDeviceId() {
  // Use stable per-browser identifier in localStorage.
  const key = 'device_id';
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'anon-device';
  }
}

export async function claimDeviceSlot() {
  const device_id = getDeviceId();
  try {
    const token = await getAccessToken();
    if (!token) return { ok: true, leased: true, local: true };
    const res = await fetch('/api/devices/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ device_id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, ...json };
    return { ok: true, ...json };
  } catch (e) {
    return { ok: true, leased: true, offline: true };
  }
}

export async function releaseDeviceSlot() {
  const device_id = getDeviceId();
  try {
    const token = await getAccessToken();
    if (!token) return { ok: true, released: true, local: true };
    const res = await fetch('/api/devices/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ device_id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, ...json };
    return { ok: true, ...json };
  } catch (e) {
    return { ok: true, released: true, offline: true };
  }
}

async function getAccessToken() {
  try {
    // Inline import to avoid SSR issues
    const mod = await import('../lib/supabaseClient');
    const { getSupabaseClient, hasSupabaseEnv } = mod;
    if (!hasSupabaseEnv()) return null;
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

const deviceLeases = { getDeviceId, claimDeviceSlot, releaseDeviceSlot };
export default deviceLeases;
