import { createClient } from '@supabase/supabase-js';
import { ENTITLEMENTS } from '../../../../lib/entitlements';

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
      .select('plan_tier, mentor_sessions_used, mentor_addon_active, mentor_current_session_tokens, mentor_session_started_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ allowed: false, reason: 'Profile not found' }, { status: 404 });
    }

    const tier = profile.plan_tier || 'free';
    const entitlement = ENTITLEMENTS[tier] || ENTITLEMENTS.free;
    
    const sessionLimit = entitlement.mentorSessions;
    const hasAddon = profile.mentor_addon_active || false;

    // No Mr. Mentor access
    if (sessionLimit === 0) {
      return Response.json({ 
        allowed: false, 
        reason: 'Upgrade to Premium for Mr. Mentor access',
        tier 
      });
    }

    // Unlimited with addon
    if (sessionLimit === -1 || hasAddon) {
      return Response.json({ 
        allowed: true,
        unlimited: true,
        tier 
      });
    }

    // Check session quota
    const sessionsUsed = profile.mentor_sessions_used || 0;
    if (sessionsUsed >= sessionLimit) {
      return Response.json({ 
        allowed: false,
        reason: 'Session limit reached. Add Premium+ for unlimited access.',
        used: sessionsUsed,
        limit: sessionLimit,
        needsAddon: true,
        tier 
      });
    }

    // Has sessions remaining
    return Response.json({ 
      allowed: true,
      remaining: sessionLimit - sessionsUsed,
      used: sessionsUsed,
      limit: sessionLimit,
      tier 
    });

  } catch (error) {
    console.error('Error checking mentor quota:', error);
    return Response.json({ 
      allowed: false, 
      reason: 'Server error' 
    }, { status: 500 });
  }
}
