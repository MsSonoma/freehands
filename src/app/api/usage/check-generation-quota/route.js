import { createClient } from '@supabase/supabase-js';
import { ENTITLEMENTS, resolveEffectiveTier } from '../../../lib/entitlements';

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

    // Get profile with usage data - include subscription_tier for Beta check
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, plan_tier, lifetime_generations_used, weekly_generation_date, weekly_generations_used')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ allowed: false, reason: 'Profile not found' }, { status: 404 });
    }

    const tier = resolveEffectiveTier(profile.subscription_tier, profile.plan_tier);
    const entitlement = ENTITLEMENTS[tier] || ENTITLEMENTS.free;
    
    // Quota check
    
    const lifetimeLimit = entitlement.lifetimeGenerations;
    const weeklyLimit = entitlement.weeklyGenerations;

    // Free tier has no generations
    if (lifetimeLimit === 0 && weeklyLimit === 0) {
      return Response.json({ 
        allowed: false, 
        reason: 'No generations available on free tier',
        tier 
      });
    }

    // Standard/Pro/Lifetime tiers have unlimited generations
    if (lifetimeLimit === Infinity) {
      return Response.json({ 
        allowed: true,
        source: 'unlimited',
        remaining: Infinity,
        tier 
      });
    }

    const lifetimeUsed = profile.lifetime_generations_used || 0;

    // Check if lifetime quota exceeded
    if (lifetimeLimit > 0 && lifetimeUsed >= lifetimeLimit) {
      // Check weekly allowance if available
      if (weeklyLimit > 0) {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Sunday
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        const lastWeekDate = profile.weekly_generation_date;
        const weeklyUsed = (lastWeekDate >= weekStartStr) ? profile.weekly_generations_used : 0;

        if (weeklyUsed < weeklyLimit) {
          return Response.json({ 
            allowed: true,
            source: 'weekly',
            remaining: weeklyLimit - weeklyUsed,
            used: weeklyUsed,
            limit: weeklyLimit,
            tier 
          });
        }

        return Response.json({ 
          allowed: false,
          reason: 'Weekly generation limit reached',
          nextReset: weekStartStr,
          tier 
        });
      }

      return Response.json({ 
        allowed: false,
        reason: 'Lifetime generation limit reached',
        tier 
      });
    }

    // Has lifetime generations remaining
    const lifetimeRemaining = lifetimeLimit - lifetimeUsed;
    return Response.json({ 
      allowed: true,
      source: 'lifetime',
      remaining: lifetimeRemaining,
      used: lifetimeUsed,
      limit: lifetimeLimit,
      tier 
    });

  } catch (error) {
    // Error checking generation quota
    return Response.json({ 
      allowed: false, 
      reason: 'Server error' 
    }, { status: 500 });
  }
}
