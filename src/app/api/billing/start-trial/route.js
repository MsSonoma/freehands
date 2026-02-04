import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anon, service };
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
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { url, service } = getEnv();
    if (!url || !service) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const supabase = createClient(url, service, { auth: { persistSession: false } });
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, plan_tier')
      .eq('id', user.id)
      .maybeSingle();

    if (profErr) return NextResponse.json({ error: profErr.message || 'Profile error' }, { status: 400 });

    const current = (profile?.plan_tier || 'free').toLowerCase();
    if (['standard', 'pro', 'lifetime'].includes(current)) {
      return NextResponse.json({ error: 'Trial is only available on Free accounts' }, { status: 400 });
    }

    if (current === 'trial') {
      return NextResponse.json({ ok: true, plan_tier: 'trial' });
    }

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ plan_tier: 'trial' })
      .eq('id', user.id);

    if (upErr) return NextResponse.json({ error: upErr.message || 'Update failed' }, { status: 400 });

    return NextResponse.json({ ok: true, plan_tier: 'trial' });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
