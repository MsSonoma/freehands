import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { featuresForTier, resolveEffectiveTier } from '../../../lib/entitlements';

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getClients() {
  const { url, anon, service } = getEnv();
  if (!url || !anon || !service) throw new Error('Supabase env not configured');
  return {
    pub: createClient(url, anon, { auth: { persistSession: false } }),
    svc: createClient(url, service, { auth: { persistSession: false } }),
  };
}

async function getUserFromAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  const { pub } = getClients();
  const { data } = await pub.auth.getUser(token);
  return data?.user || null;
}

export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { svc } = getClients();
    const body = await req.json().catch(() => ({}));
    const device_id = typeof body?.device_id === 'string' && body.device_id ? body.device_id : null;
    const ttlSeconds = Number.isFinite(body?.ttlSeconds) ? Math.max(60, Math.min(24*3600, body.ttlSeconds)) : 3600;
    if (!device_id) return NextResponse.json({ error: 'device_id required' }, { status: 400 });

    // Plan tier and cap
    const { data: prof, error: pErr } = await svc
      .from('profiles')
      .select('subscription_tier, plan_tier')
      .eq('id', user.id)
      .single();
    if (pErr) throw new Error(pErr.message || 'Failed to read profile');
    const effectiveTier = resolveEffectiveTier(prof?.subscription_tier, prof?.plan_tier);
    const cap = featuresForTier(effectiveTier).devices;

    const now = new Date();
    const nowIso = now.toISOString();
    const expires_at = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    // Check existing active leases for this device; if exists, extend TTL
    const { data: existing, error: exErr } = await svc
      .from('device_leases')
      .select('id, expires_at, released_at')
      .eq('user_id', user.id)
      .eq('device_id', device_id)
      .limit(1)
      .maybeSingle();
    if (exErr && exErr.code !== 'PGRST116') throw new Error(exErr.message || 'Failed to query lease');

    if (existing && (!existing.released_at) && new Date(existing.expires_at) > new Date()) {
      // Extend
      const { error: upErr } = await svc
        .from('device_leases')
        .update({ expires_at })
        .eq('id', existing.id);
      if (upErr) throw new Error(upErr.message || 'Failed to extend lease');
      return NextResponse.json({ plan_tier: effectiveTier, devicesCap: cap, leased: true, extended: true, expires_at });
    }

    // Count active leases
    const { count, error: cErr } = await svc
      .from('device_leases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('released_at', null)
      .gt('expires_at', nowIso);
    if (cErr) throw new Error(cErr.message || 'Failed to count leases');

    if (Number.isFinite(cap) && (count || 0) >= cap) {
      return NextResponse.json({ error: 'Device limit reached', plan_tier: effectiveTier, devicesCap: cap, active: count || 0 }, { status: 409 });
    }

    // Insert lease
    const { error: insErr } = await svc
      .from('device_leases')
      .insert({ user_id: user.id, device_id, acquired_at: nowIso, expires_at, released_at: null });
    if (insErr) throw new Error(insErr.message || 'Failed to create lease');

    return NextResponse.json({ plan_tier: effectiveTier, devicesCap: cap, leased: true, expires_at });
  } catch (e) {
    const msg = (e?.message || '').toLowerCase();
    const hint = msg.includes('relation "device_leases" does not exist')
      ? 'Create the device_leases table. See docs/device-leases.md.'
      : undefined;
    return NextResponse.json({ error: e?.message || 'Unexpected error', hint }, { status: 500 });
  }
}
