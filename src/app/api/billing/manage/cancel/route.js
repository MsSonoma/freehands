import { NextResponse } from 'next/server';
import { getStripe } from '@/app/lib/stripe';
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

async function getCustomerId(user) {
  const { url, service } = getEnv();
  const supabase = createClient(url, service, { auth: { persistSession: false } });
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();
  if (error) throw new Error(error.message || 'Profile not found');
  const id = profile?.stripe_customer_id;
  if (!id) throw new Error('Missing stripe_customer_id');
  return id;
}

export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const mode = (body?.mode || '').toLowerCase(); // 'end_of_period' | 'now' | 'resume'
    if (!['end_of_period','now','resume'].includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });

    const customerId = await getCustomerId(user);
    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
    const sub = subs?.data?.[0];
    if (!sub) return NextResponse.json({ error: 'No active subscription' }, { status: 400 });

    if (mode === 'now') {
      const canceled = await stripe.subscriptions.cancel(sub.id);
      return NextResponse.json({ canceled: true, id: canceled.id, status: canceled.status });
    }
    if (mode === 'resume') {
      const upd = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
      return NextResponse.json({ id: upd.id, cancel_at_period_end: upd.cancel_at_period_end });
    }
    // end_of_period
    const upd = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    return NextResponse.json({ id: upd.id, cancel_at_period_end: upd.cancel_at_period_end });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
