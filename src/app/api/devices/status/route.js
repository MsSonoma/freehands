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

export async function GET(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { svc } = getClients();
    // Plan tier
    const { data: prof, error: pErr } = await svc
      .from('profiles')
      .select('subscription_tier, plan_tier')
      .eq('id', user.id)
      .single();
    if (pErr) throw new Error(pErr.message || 'Failed to read profile');
    const effectiveTier = resolveEffectiveTier(prof?.subscription_tier, prof?.plan_tier);
    const cap = featuresForTier(effectiveTier).devices;

    // Active leases count
    const now = new Date().toISOString();
    const { count, error: cErr } = await svc
      .from('device_leases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('released_at', null)
      .gt('expires_at', now);
    if (cErr) throw new Error(cErr.message || 'Failed to count leases');

    return NextResponse.json({ plan_tier: effectiveTier, devicesCap: cap, active: count || 0 });
  } catch (e) {
    const msg = (e?.message || '').toLowerCase();
    const hint = msg.includes('relation "device_leases" does not exist')
      ? 'Create the device_leases table. See docs/device-leases.md.'
      : undefined;
    return NextResponse.json({ error: e?.message || 'Unexpected error', hint }, { status: 500 });
  }
}
