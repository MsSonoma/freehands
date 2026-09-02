import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyFacilitatorPinForUser } from '../../../../lib/facilitatorPin.server.mjs';

export const runtime = 'nodejs';

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function getUserFromAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  const { url, anon } = getEnv();
  if (!url || !anon) return null;
  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

export async function POST(req) {
  try {
    const { url, service } = getEnv();
    if (!url || !service) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(()=>({}));
    const pin = typeof body?.pin === 'string' ? body.pin : '';
    if (!pin) return NextResponse.json({ error: 'pin required' }, { status: 400 });
    const svc = createClient(url, service, { auth: { persistSession: false } });
    const ok = await verifyFacilitatorPinForUser(svc, user.id, pin);
    if (!ok) return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
