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

// Normalize tier names/synonyms to canonical ids used by UI
function canonTier(input) {
  if (!input) return null;
  const raw = String(input).toLowerCase();
  // strip common qualifiers
  const cleaned = raw
    .replace(/annual|yearly|monthly|month|year|yr|mo/g, '')
    .replace(/[-_\s]+/g, ' ')
    .trim();
  if (/\bpro\b/.test(cleaned)) return 'pro';
  if (/\bstandard\b/.test(cleaned)) return 'standard';
  return raw;
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
    .select('id, stripe_customer_id, plan_tier')
    .eq('id', user.id)
    .single();
  if (profErr && profErr.code !== 'PGRST116') {
    throw new Error(profErr.message || 'Failed to load profile');
  }
  const stripe = getStripe();
  if (profile?.stripe_customer_id) return { customerId: profile.stripe_customer_id, plan_tier: profile?.plan_tier || 'free' };
  const customer = await stripe.customers.create({ email: user?.email || undefined, metadata: { supabase_user_id: user.id } });
  const { error: upErr } = await supabase
    .from('profiles')
    .upsert({ id: user.id, stripe_customer_id: customer.id }, { onConflict: 'id' });
  if (upErr) throw new Error(upErr.message || 'Failed to save stripe_customer_id');
  return { customerId: customer.id, plan_tier: profile?.plan_tier || 'free' };
}

export async function GET(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { prices } = getEnv();
    const { customerId, plan_tier } = await getOrCreateCustomer(user);
    const stripe = getStripe();

    // Get latest subscription and expand price (not product) to stay within expand limits
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 3,
      expand: ['data.items.data.price']
    });
    // Choose best subscription by status priority, then recency
    const allSubs = subs?.data || [];
    const priority = { active: 0, trialing: 1, past_due: 2, unpaid: 3, incomplete: 4 };
    const filtered = allSubs.filter(s => s.status !== 'canceled');
    const sorted = filtered.sort((a, b) => {
      const pa = priority[a.status] ?? 999;
      const pb = priority[b.status] ?? 999;
      if (pa !== pb) return pa - pb;
      return (b.created || 0) - (a.created || 0);
    });
    const sub = sorted[0] || allSubs.sort((a,b)=> (b.created||0) - (a.created||0))[0] || null;

    // Derive current tier from all subscription items
    const items = sub?.items?.data || [];
    const planRank = { standard: 1, pro: 2 };
    let best = { tier: null, rank: -1, priceId: null };
    for (const it of items) {
      const price = it?.price || null;
      if (!price) continue;
      const priceId = price.id || null;
      let tier = null;
      // 1) Env mapping by price id
      if (priceId) {
        const mapped = Object.entries(prices).find(([k, v]) => v && v === priceId)?.[0];
        if (mapped) tier = canonTier(mapped);
      }
      // 2) Price metadata
      if (!tier) {
        const metaTier = price?.metadata?.tier?.toString?.();
        if (metaTier) tier = canonTier(metaTier);
      }
      // 3) Product metadata/name (fetch if needed)
      if (!tier) {
        let productObj = null;
        if (typeof price?.product === 'object' && price.product) {
          productObj = price.product;
        } else if (typeof price?.product === 'string') {
          try {
            productObj = await stripe.products.retrieve(price.product);
          } catch {}
        }
  const metaTier = productObj?.metadata?.tier?.toString?.();
  if (metaTier) tier = canonTier(metaTier);
        if (!tier) {
          const nameSource = (productObj?.name || price?.nickname || '').toString();
          const lc = nameSource.toLowerCase();
          if (/\bpro\b/.test(lc)) tier = 'pro';
          else if (/\bstandard\b/.test(lc)) tier = 'standard';
        }
      }
      if (tier) {
        const t = tier.toLowerCase();
        const r = planRank[t] ?? 0;
        if (r > best.rank) best = { tier: t, rank: r, priceId };
      }
    }
    const price = items[0]?.price || null;
    let priceId = best.priceId || price?.id || null;
    let current_tier = best.tier ? best.tier.toLowerCase() : null;
    // 4) Final fallback: infer by amount for recurring prices
    if (!current_tier && items.length) {
      const recurring = items
        .map(it => it?.price)
        .filter(p => p && p.recurring && typeof p.unit_amount === 'number');
      if (recurring.length) {
        const top = recurring.sort((a,b)=> (b.unit_amount||0) - (a.unit_amount||0))[0];
        priceId = priceId || top.id;
        const amt = top.unit_amount || 0; // cents
        // Heuristic thresholds (USD): 6900+ pro, otherwise standard
        current_tier = amt >= 6500 ? 'pro' : 'standard';
      }
    }

    // Get default payment method from customer.invoice_settings
    const customer = await stripe.customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] });
    const dpm = customer?.invoice_settings?.default_payment_method;
    const pm = dpm && typeof dpm === 'object' ? dpm : null;
    const paymentMethod = pm ? {
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      exp_month: pm.card?.exp_month,
      exp_year: pm.card?.exp_year,
    } : null;

    // Optional: recent invoices
    const invs = await stripe.invoices.list({ customer: customerId, limit: 6 });
    const invoices = (invs?.data || []).map(inv => ({
      id: inv.id,
      created: inv.created,
      total: inv.total,
      currency: inv.currency,
      status: inv.status,
      hosted_invoice_url: inv.hosted_invoice_url,
      number: inv.number,
    }));

    // Determine effective tier:
    // - Prefer profile.plan_tier when set (authoritative for entitlements)
    // - Otherwise, only trust Stripe tier if subscription is active or trialing
    const planTierLc = (plan_tier || 'free').toLowerCase();
    const stripeTierAllowed = sub && (sub.status === 'active' || sub.status === 'trialing');
    const effective_tier = (planTierLc !== 'free' ? planTierLc : (stripeTierAllowed ? (current_tier || 'free') : 'free')).toLowerCase();

    // If subscription isn't active/trialing, don't expose a misleading tier on the subscription object
    const subTierForResponse = stripeTierAllowed ? current_tier : null;

    const summary = {
      plan_tier: planTierLc,
      subscription: sub ? {
        id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_end: sub.current_period_end,
        price_id: priceId,
        tier: subTierForResponse,
      } : null,
      effective_tier,
      paymentMethod,
      invoices,
    };
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
