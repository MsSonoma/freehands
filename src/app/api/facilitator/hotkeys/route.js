import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_HOTKEYS } from '@/app/lib/hotkeys';

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

export async function GET(req) {
  try {
    const { url, service } = getEnv();
    if (!url || !service) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = createClient(url, service, { auth: { persistSession: false } });
    const { data, error } = await svc
      .from('profiles')
      .select('facilitator_hotkeys')
      .eq('id', user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message || 'Failed to read' }, { status: 500 });
    const stored = (data && typeof data.facilitator_hotkeys === 'object') ? data.facilitator_hotkeys : null;
    const hotkeys = { ...DEFAULT_HOTKEYS, ...(stored || {}) };
    return NextResponse.json({ ok: true, hotkeys });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { url, service } = getEnv();
    if (!url || !service) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(()=>({}));
    const hotkeys = (body && typeof body.hotkeys === 'object') ? body.hotkeys : null;
    if (!hotkeys) return NextResponse.json({ error: 'hotkeys object required' }, { status: 400 });
    const svc = createClient(url, service, { auth: { persistSession: false } });
    const payload = { facilitator_hotkeys: hotkeys, updated_at: new Date().toISOString() };
    const { error } = await svc
      .from('profiles')
      .update(payload)
      .eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message || 'Failed to save hotkeys' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
