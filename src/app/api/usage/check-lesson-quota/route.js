import { createClient } from '@supabase/supabase-js';
import { ENTITLEMENTS } from '../../../lib/entitlements';

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
      .select('stripe_subscription_tier, daily_lessons_count, last_lesson_date')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ allowed: false, reason: 'Profile not found' }, { status: 404 });
    }

    const tier = profile.stripe_subscription_tier || 'free';
    const entitlement = ENTITLEMENTS[tier] || ENTITLEMENTS.free;
    const dailyLimit = entitlement.dailyLessons;

    // Unlimited lessons
    if (dailyLimit === -1) {
      return Response.json({ 
        allowed: true, 
        remaining: -1,
        tier 
      });
    }

    // Check if we need to reset daily counter
    const today = new Date().toISOString().split('T')[0];
    const lastDate = profile.last_lesson_date;
    const currentCount = (lastDate === today) ? profile.daily_lessons_count : 0;

    const allowed = currentCount < dailyLimit;
    const remaining = Math.max(0, dailyLimit - currentCount);

    return Response.json({ 
      allowed, 
      remaining,
      used: currentCount,
      limit: dailyLimit,
      tier 
    });

  } catch (error) {
    console.error('Error checking lesson quota:', error);
    return Response.json({ 
      allowed: false, 
      reason: 'Server error' 
    }, { status: 500 });
  }
}
