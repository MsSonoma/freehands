import { NextResponse } from 'next/server';
import { getStripe } from '@/app/lib/stripe';
import { createClient } from '@supabase/supabase-js';

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prices = {
    standard: process.env.STRIPE_PRICE_STANDARD,
    pro: process.env.STRIPE_PRICE_PRO,
  };
  return { url, anon, service, prices };
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
    const { prices } = getEnv();
    const body = await req.json().catch(() => ({}));
    const tier = (body?.tier || '').toLowerCase();
    if (!['standard','pro'].includes(tier)) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    const price = prices[tier];
    if (!price) return NextResponse.json({ error: 'Price not configured' }, { status: 500 });

    const customerId = await getCustomerId(user);
    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
    const sub = subs?.data?.[0];
    if (!sub) return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    const item = sub.items?.data?.[0];
    if (!item) return NextResponse.json({ error: 'Subscription has no items' }, { status: 500 });

    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price }],
      proration_behavior: 'create_prorations',
      metadata: { ...(sub.metadata||{}), tier },
    });
    return NextResponse.json({ id: updated.id, status: updated.status, tier });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
