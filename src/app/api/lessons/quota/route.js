import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { featuresForTier, resolveEffectiveTier } from '../../../lib/entitlements';

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getClients() {
  const { url, anon, service } = getEnv();
  if (!url || !anon || !service) return null;
  return {
    pub: createClient(url, anon, { auth: { persistSession: false } }),
    svc: createClient(url, service, { auth: { persistSession: false } }),
  };
}

async function getUserFromAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  const clients = getClients();
  if (!clients) return null;
  const { pub } = clients;
  const { data } = await pub.auth.getUser(token);
  return data?.user || null;
}

// Compute YYYY-MM-DD for a given IANA timezone (falls back to UTC if invalid)
function dayInTz(tz) {
  const timeZone = typeof tz === 'string' && tz ? tz : 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`; // en-CA gives YYYY-MM-DD
  } catch {}
  return new Date().toISOString().slice(0, 10);
}

async function readPlanTierAndCountInTz(svc, userId, tzParam) {
  // Get plan tier and preferred timezone from profile (best-effort)
  let plan_tier = 'free';
  let preferredTz = '';
  try {
    const { data: profile, error: profErr } = await svc
      .from('profiles')
      .select('subscription_tier, plan_tier, timezone')
      .eq('id', userId)
      .maybeSingle();
    if (!profErr) {
      const subscription_tier = profile?.subscription_tier || null;
      const rawTier = profile?.plan_tier || 'free';
      plan_tier = resolveEffectiveTier(subscription_tier, rawTier);
      preferredTz = (profile?.timezone || '').trim();
    } else if (profErr?.code === 'PGRST116') {
      // MaybeSingle: no rows – keep defaults
    } else {
      // Profiles table/columns might be missing or not yet migrated – proceed with defaults
    }
  } catch {
    // Swallow any profile read issues and proceed with default plan/timezone
  }
  const tz = preferredTz || tzParam || undefined;
  const day = dayInTz(tz);

  // Read today's unique count from lesson_unique_starts
  const { count, error: cntErr } = await svc
    .from('lesson_unique_starts')
    .select('lesson_key', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('day', day);
  if (cntErr) throw new Error(cntErr.message || 'Failed to read count');
  return { plan_tier, count, tz, day };
}

function lessonsPerDay(tier) {
  const ent = featuresForTier(tier);
  return Number.isFinite(ent?.lessonsPerDay) || ent?.lessonsPerDay === Infinity ? ent.lessonsPerDay : 1;
}

// JSON cannot serialize Infinity — use -1 as the "unlimited" sentinel on the wire.
function safeLimit(limit) { return limit === Infinity ? -1 : limit; }
function safeRemaining(limit, used) {
  if (limit === Infinity) return -1;
  return Math.max(0, limit - used);
}

export async function GET(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clients = getClients();
    if (!clients) return NextResponse.json({ plan_tier: 'free', count: 0, limit: 5, remaining: 5, allowed: true, timezone: 'UTC', hint: 'Supabase env not configured; defaulting to free plan.' });
    const { svc } = clients;
    const url = new URL(req.url);
    const tzParam = url.searchParams.get('tz') || url.searchParams.get('timezone') || undefined;

    // Read tier, timezone, and lifetime usage from profiles
    let plan_tier = 'free';
    let preferredTz = '';
    let lifetimeUsed = 0;
    try {
      const { data: profile } = await svc
        .from('profiles')
        .select('subscription_tier, plan_tier, timezone, lifetime_generations_used')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) {
        plan_tier = resolveEffectiveTier(profile.subscription_tier, profile.plan_tier);
        preferredTz = (profile.timezone || '').trim();
        lifetimeUsed = profile.lifetime_generations_used || 0;
      }
    } catch {
      // Swallow; proceed with defaults
    }

    const tz = preferredTz || tzParam || undefined;
    const day = dayInTz(tz);
    const features = featuresForTier(plan_tier);
    const lifetimeLimit = features.lifetimeGenerations;

    // For tiers with a finite lifetime generation limit (e.g. free = 5), report that
    if (Number.isFinite(lifetimeLimit)) {
      const used = lifetimeUsed;
      const remaining = Math.max(0, lifetimeLimit - used);
      const allowed = used < lifetimeLimit;
      return NextResponse.json({ plan_tier, count: used, used, limit: lifetimeLimit, remaining, allowed, quota_type: 'lifetime', day, timezone: tz || 'UTC' });
    }

    // Unlimited tiers (standard/pro/lifetime): return unlimited sentinel
    return NextResponse.json({ plan_tier, count: 0, used: 0, limit: -1, remaining: -1, allowed: true, quota_type: 'unlimited', day, timezone: tz || 'UTC' });
  } catch (e) {
    // Profile or other schema issues – default to free tier but do not block the UI
    return NextResponse.json({ plan_tier: 'free', count: 0, used: 0, limit: 5, remaining: 5, allowed: true, timezone: 'UTC', hint: 'Profile read failed; defaulting to free plan temporarily.' }, { status: 200 });
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clients = getClients();
    if (!clients) return NextResponse.json({ plan_tier: 'free', count: 0, limit: 1, remaining: 1, timezone: 'UTC', hint: 'Supabase env not configured; defaulting to free plan.' });
    const { svc } = clients;
    const body = await req.json().catch(() => ({}));
    const lesson_key = typeof body?.lesson_key === 'string' && body.lesson_key ? body.lesson_key : null;
    const tzParam = typeof body?.timezone === 'string' && body.timezone ? body.timezone : undefined;
    if (!lesson_key) return NextResponse.json({ error: 'lesson_key required' }, { status: 400 });

    const { plan_tier, count = 0, tz, day } = await readPlanTierAndCountInTz(svc, user.id, tzParam);
    const limit = lessonsPerDay(plan_tier);

    // If this lesson is already recorded for the day, do NOT count against quota and do not 429
    const { count: already, error: existErr } = await svc
      .from('lesson_unique_starts')
      .select('lesson_key', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('day', day)
      .eq('lesson_key', lesson_key);
    if (existErr) throw new Error(existErr.message || 'Failed to check existing');
    if ((already || 0) > 0) {
      const used = count || 0;
      const remaining = safeRemaining(limit, used);
      const allowed = limit === Infinity ? true : used < limit;
      return NextResponse.json({ plan_tier, count: used, used, limit: safeLimit(limit), remaining, allowed, existing: true, day, timezone: tz || 'UTC' });
    }

    if (limit !== Infinity && (count || 0) >= limit) {
      const used = count || 0;
      return NextResponse.json({ error: 'Daily limit reached', plan_tier, count: used, used, limit, remaining: 0, allowed: false }, { status: 429 });
    }

    // Upsert unique start row; PK(user_id, day, lesson_key)
    const { error: upErr } = await svc
      .from('lesson_unique_starts')
      .upsert({ user_id: user.id, day, lesson_key }, { onConflict: 'user_id,day,lesson_key' });
    if (upErr) throw new Error(upErr.message || 'Failed to record lesson start');

    // Re-count after upsert to return latest unique count
    const { count: updatedCount, error: cntErr } = await svc
      .from('lesson_unique_starts')
      .select('lesson_key', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('day', day);
    if (cntErr) throw new Error(cntErr.message || 'Failed to read count');

    const used = updatedCount || 0;
    const remaining = safeRemaining(limit, used);
    const allowed = limit === Infinity ? true : used < limit;
    return NextResponse.json({ plan_tier, count: used, used, limit: safeLimit(limit), remaining, allowed, day, timezone: tz || 'UTC' });
  } catch (e) {
    // Surface helpful hint if table likely missing; return soft-fail 200 so UI can proceed in dev
    const msg = (e?.message || '').toLowerCase();
    const missing = msg.includes('relation "lesson_unique_starts" does not exist') || msg.includes('lesson_unique_starts');
    if (missing) {
      return NextResponse.json({ plan_tier: 'free', count: 0, used: 0, limit: 1, remaining: 1, allowed: true, timezone: 'UTC', hint: 'Run the SQL from docs/lesson-quota.md to create lesson_unique_starts. Proceeding without server quota in dev.' });
    }
    // Profile or other schema issues – default to free tier but do not block the UI
    return NextResponse.json({ plan_tier: 'free', count: 0, used: 0, limit: 1, remaining: 1, allowed: true, timezone: 'UTC', hint: 'Profile read failed; defaulting to free plan temporarily.' }, { status: 200 });
  }
}
