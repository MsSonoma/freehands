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
    const { customerId } = await getOrCreateCustomer(user);
    const stripe = getStripe();
    const si = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });
    return NextResponse.json({ client_secret: si.client_secret });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
