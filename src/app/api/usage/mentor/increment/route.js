import { createClient } from '@supabase/supabase-js';
import { ENTITLEMENTS } from '../../../../lib/entitlements';

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ success: false, reason: 'Not authenticated' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return Response.json({ success: false, reason: 'Invalid auth' }, { status: 401 });
    }

    const body = await request.json();
    const { action, tokens } = body; // action: 'start' | 'add_tokens' | 'end'

    // Get current profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_tier, mentor_sessions_used, mentor_addon_active, mentor_current_session_tokens, mentor_session_started_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ success: false, reason: 'Profile not found' }, { status: 404 });
    }

    const tier = profile.stripe_subscription_tier || 'free';
    const entitlement = ENTITLEMENTS[tier] || ENTITLEMENTS.free;
    const tokenLimit = entitlement.mentorSessionTokens || 10000;

    let updateData = {};

    if (action === 'start') {
      // Start a new session
      updateData = {
        mentor_sessions_used: (profile.mentor_sessions_used || 0) + 1,
        mentor_current_session_tokens: 0,
        mentor_session_started_at: new Date().toISOString()
      };
    } else if (action === 'add_tokens') {
      // Add tokens to current session
      const currentTokens = profile.mentor_current_session_tokens || 0;
      const newTotal = currentTokens + (tokens || 0);

      // Check if over limit (unless unlimited addon)
      if (!profile.mentor_addon_active && entitlement.mentorSessions !== -1) {
        if (newTotal > tokenLimit) {
          return Response.json({ 
            success: false, 
            reason: 'Token limit exceeded for this session',
            limit: tokenLimit,
            current: currentTokens
          }, { status: 403 });
        }
      }

      updateData = {
        mentor_current_session_tokens: newTotal
      };
    } else if (action === 'end') {
      // End session
      updateData = {
        mentor_current_session_tokens: 0,
        mentor_session_started_at: null
      };
    } else {
      return Response.json({ success: false, reason: 'Invalid action' }, { status: 400 });
    }

    // Update the profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating mentor session:', updateError);
      return Response.json({ success: false, reason: 'Update failed' }, { status: 500 });
    }

    return Response.json({ 
      success: true,
      updated: updateData
    });

  } catch (error) {
    console.error('Error incrementing mentor session:', error);
    return Response.json({ 
      success: false, 
      reason: 'Server error' 
    }, { status: 500 });
  }
}
