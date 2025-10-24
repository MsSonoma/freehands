import { NextResponse } from 'next/server';
import { getStripe } from '@/app/lib/stripe';
import { createClient } from '@supabase/supabase-js';

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
    appUrl: process.env.APP_URL,
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
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { url, service, appUrl } = getEnv();
    const supabase = createClient(url, service, { auth: { persistSession: false } });

    // Ensure the user has a Stripe customer; create one if missing.
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();
    if (profErr && profErr.code !== 'PGRST116') {
      throw new Error(profErr.message || 'Failed to load profile');
    }

    let customerId = profile?.stripe_customer_id || null;
    if (!customerId) {
      const stripe = getStripe();
      const customer = await stripe.customers.create({
        email: user?.email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      const { error: upErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, stripe_customer_id: customerId }, { onConflict: 'id' });
      if (upErr) throw new Error(upErr.message || 'Failed to save stripe_customer_id');
    }

    const stripe = getStripe();
    const baseUrl = appUrl || new URL(req.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/billing/return?to=${encodeURIComponent('/facilitator/account/plan')}`,
      // If you create a specific Portal configuration, you can set STRIPE_PORTAL_CONFIGURATION_ID
      // to force using it. Otherwise, Stripe uses your default configuration.
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID || undefined,
    });

    const accept = req.headers.get('accept') || '';
    if (accept.includes('application/json')) {
      return NextResponse.json({ url: session.url });
    }
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    const msg = err?.message || '';
    const noConfig = msg.includes('No configuration provided') && msg.includes('test mode default configuration');
    if (noConfig) {
      return NextResponse.json({
        error: 'Stripe customer portal is not configured for Test mode.',
        hint: 'Open https://dashboard.stripe.com/test/settings/billing/portal, adjust any setting, and click Save to create a default configuration. Then retry. Optionally set STRIPE_PORTAL_CONFIGURATION_ID to a specific configuration ID.',
      }, { status: 400 });
    }
    return NextResponse.json({ error: msg || 'Unexpected error' }, { status: 500 });
  }
}
