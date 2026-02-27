import { createClient } from '@supabase/supabase-js';
import { featuresForTier, resolveEffectiveTier } from '../../../lib/entitlements';

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ allowed: false, reason: 'Not authenticated' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return Response.json({ allowed: false, reason: 'Invalid auth' }, { status: 401 });
    }

    // Get profile with usage data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, plan_tier, daily_lessons_count, last_lesson_date')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ allowed: false, reason: 'Profile not found' }, { status: 404 });
    }

    const tier = resolveEffectiveTier(profile.subscription_tier, profile.plan_tier);
    const dailyLimit = featuresForTier(tier).lessonsPerDay;

    // Unlimited lessons (-1 = unlimited sentinel; Infinity cannot be JSON-serialized)
    if (dailyLimit === Infinity) {
      return Response.json({
        allowed: true,
        remaining: -1,
        used: 0,
        limit: -1,
        tier
      });
    }

    // Check if we need to reset daily counter
    const today = new Date().toISOString().split('T')[0];
    const lastDate = profile.last_lesson_date;
    const currentCount = (lastDate === today) ? profile.daily_lessons_count : 0;

    const limitNumber = Number.isFinite(Number(dailyLimit)) ? Number(dailyLimit) : 1;
    const allowed = currentCount < limitNumber;
    const remaining = Math.max(0, limitNumber - currentCount);

    return Response.json({ 
      allowed, 
      remaining,
      used: currentCount,
      limit: limitNumber,
      tier 
    });

  } catch (error) {
    // Error checking lesson quota
    return Response.json({ 
      allowed: false, 
      reason: 'Server error' 
    }, { status: 500 });
  }
}
