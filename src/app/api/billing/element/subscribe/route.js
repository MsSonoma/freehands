import { NextResponse } from 'next/server';
import { getStripe } from '@/app/lib/stripe';
import { createClient } from '@supabase/supabase-js';

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Do not hardcode localhost fallback here; compute from request origin later
  const appUrl = process.env.APP_URL;
  const prices = {
    standard: process.env.STRIPE_PRICE_STANDARD,
    pro: process.env.STRIPE_PRICE_PRO,
  };
  return { url, anon, service, appUrl, prices };
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

async function getOrCreateCustomer(user) {
  const { url, service } = getEnv();
  const supabase = createClient(url, service, { auth: { persistSession: false } });
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, stripe_customer_id')
    .eq('id', user.id)
    .single();
  if (profErr && profErr.code !== 'PGRST116') {
    throw new Error(profErr.message || 'Failed to load profile');
  }
  const stripe = getStripe();
  if (profile?.stripe_customer_id) return { customerId: profile.stripe_customer_id };
  const customer = await stripe.customers.create({ email: user?.email || undefined, metadata: { supabase_user_id: user.id } });
  const { error: upErr } = await supabase
    .from('profiles')
    .upsert({ id: user.id, stripe_customer_id: customer.id }, { onConflict: 'id' });
  if (upErr) throw new Error(upErr.message || 'Failed to save stripe_customer_id');
  return { customerId: customer.id };
}

export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { appUrl, prices } = getEnv();
    const url = new URL(req.url);
    const tier = (url.searchParams.get('tier') || '').toLowerCase();
    if (!['standard', 'pro'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }
    const price = prices[tier];
    if (!price) return NextResponse.json({ error: 'Price not configured' }, { status: 500 });

    const { customerId } = await getOrCreateCustomer(user);
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { supabase_user_id: user.id, tier },
    });

    const pi = subscription?.latest_invoice?.payment_intent;
    const client_secret = pi?.client_secret || null;
    if (!client_secret) return NextResponse.json({ error: 'Missing client_secret' }, { status: 500 });

  // Provide a recommended return URL for 3DS or next actions
  const baseUrl = appUrl || new URL(req.url).origin;
  const return_url = `${baseUrl}/billing/return?to=${encodeURIComponent('/facilitator/account/plan')}`;

    return NextResponse.json({ client_secret, return_url, subscription_id: subscription.id });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
