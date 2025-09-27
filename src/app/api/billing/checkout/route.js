import { NextResponse } from 'next/server';
import { getStripe } from '@/app/lib/stripe';
import { createClient } from '@supabase/supabase-js';

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.APP_URL;
  const prices = {
    basic: process.env.STRIPE_PRICE_BASIC,
    plus: process.env.STRIPE_PRICE_PLUS,
    premium: process.env.STRIPE_PRICE_PREMIUM,
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
  // Read current profile
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, stripe_customer_id')
    .eq('id', user.id)
    .single();
  if (profErr && profErr.code !== 'PGRST116') { // ignore not found
    throw new Error(profErr.message || 'Failed to load profile');
  }

  const stripe = getStripe();
  if (profile?.stripe_customer_id) {
    return { customerId: profile.stripe_customer_id, supabase };
  }

  const customer = await stripe.customers.create({
    email: user?.email || undefined,
    metadata: { supabase_user_id: user.id },
  });

  // Upsert profile with stripe_customer_id
  const { error: upErr } = await supabase
    .from('profiles')
    .upsert({ id: user.id, stripe_customer_id: customer.id }, { onConflict: 'id' });
  if (upErr) throw new Error(upErr.message || 'Failed to save stripe_customer_id');
  return { customerId: customer.id, supabase };
}

export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { appUrl, prices } = getEnv();
    const url = new URL(req.url);
    const tier = (url.searchParams.get('tier') || '').toLowerCase();
    if (!['basic','plus','premium'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }
    const price = prices[tier];
    if (!price) return NextResponse.json({ error: 'Price not configured' }, { status: 500 });

    const { customerId } = await getOrCreateCustomer(user);

    const stripe = getStripe();
    // Prefer explicit APP_URL, otherwise derive from request origin (correct port in dev)
    const baseUrl = appUrl || new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${baseUrl}/billing/return?to=${encodeURIComponent('/facilitator?checkout=success')}`,
      cancel_url: `${baseUrl}/billing/return?to=${encodeURIComponent('/facilitator/plan?checkout=cancel')}` ,
      metadata: { supabase_user_id: user.id, tier },
    });

    const accept = req.headers.get('accept') || '';
    if (accept.includes('application/json')) {
      // Return both URL and session ID so the client can use stripe-js redirectToCheckout
      return NextResponse.json({ url: session.url, id: session.id });
    }
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
