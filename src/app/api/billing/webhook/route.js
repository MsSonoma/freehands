import { NextResponse } from 'next/server';
import { getStripe } from '@/app/lib/stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tierFromPriceId(priceId) {
  if (!priceId) return 'free';
  const map = {
    [process.env.STRIPE_PRICE_BASIC]: 'basic',
    [process.env.STRIPE_PRICE_PLUS]: 'plus',
    [process.env.STRIPE_PRICE_PREMIUM]: 'premium',
  };
  return map[priceId] || 'free';
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error('Supabase service not configured');
  return createClient(url, service, { auth: { persistSession: false } });
}

async function updateUserFromSubscription(sub) {
  const supabase = getServiceSupabase();
  const customerId = sub.customer;
  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan_tier = tierFromPriceId(priceId);
  const current_period_end = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  const status = sub.status;

  // Find user by stripe_customer_id
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();
  if (profErr || !profile?.id) return; // nothing to update

  await supabase
    .from('profiles')
    .update({ plan_tier })
    .eq('id', profile.id);

  // Optional: upsert subscriptions table
  await supabase
    .from('subscriptions')
    .upsert({
      user_id: profile.id,
      stripe_subscription_id: sub.id,
      status,
      price_id: priceId,
      current_period_end,
      cancel_at_period_end: !!sub.cancel_at_period_end,
    }, { onConflict: 'stripe_subscription_id' });
}

export async function POST(req) {
  try {
    const signature = req.headers.get('stripe-signature');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !secret) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
    }
    const rawBody = await req.text();
    const stripe = getStripe();
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      return NextResponse.json({ error: `Signature verification failed: ${err.message}` }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        // session contains subscription and customer
        const session = event.data.object;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await updateUserFromSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await updateUserFromSubscription(sub);
        break;
      }
      default:
        // ignore other events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
