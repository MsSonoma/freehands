import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    if (!device_id) return NextResponse.json({ error: 'device_id required' }, { status: 400 });

    const nowIso = new Date().toISOString();
    // Mark active lease as released (if present)
    const { error: upErr } = await svc
      .from('device_leases')
      .update({ released_at: nowIso, expires_at: nowIso })
      .eq('user_id', user.id)
      .eq('device_id', device_id)
      .is('released_at', null);
    if (upErr) throw new Error(upErr.message || 'Failed to release lease');

    return NextResponse.json({ released: true });
  } catch (e) {
    const msg = (e?.message || '').toLowerCase();
    const hint = msg.includes('relation "device_leases" does not exist')
      ? 'Create the device_leases table. See docs/device-leases.md.'
      : undefined;
    return NextResponse.json({ error: e?.message || 'Unexpected error', hint }, { status: 500 });
  }
}
