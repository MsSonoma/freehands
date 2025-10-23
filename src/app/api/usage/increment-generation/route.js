import { createClient } from '@supabase/supabase-js';
import { ENTITLEMENTS } from '../../../lib/entitlements';

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

    // Get current profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_tier, lifetime_generations_used, weekly_generation_date, weekly_generations_used')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ success: false, reason: 'Profile not found' }, { status: 404 });
    }

    const tier = profile.stripe_subscription_tier || 'free';
    const entitlement = ENTITLEMENTS[tier] || ENTITLEMENTS.free;
    
    const lifetimeLimit = entitlement.lifetimeGenerations;
    const weeklyLimit = entitlement.weeklyGenerations;
    const lifetimeUsed = profile.lifetime_generations_used || 0;

    let updateData = {};

    // Determine which counter to increment
    if (lifetimeLimit > 0 && lifetimeUsed < lifetimeLimit) {
      // Use lifetime generation
      updateData.lifetime_generations_used = lifetimeUsed + 1;
    } else if (weeklyLimit > 0) {
      // Use weekly generation
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Sunday
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      const lastWeekDate = profile.weekly_generation_date;
      const weeklyUsed = (lastWeekDate >= weekStartStr) ? profile.weekly_generations_used : 0;

      updateData.weekly_generations_used = weeklyUsed + 1;
      updateData.weekly_generation_date = new Date().toISOString().split('T')[0];
    } else {
      return Response.json({ 
        success: false, 
        reason: 'No generation quota available' 
      }, { status: 403 });
    }

    // Update the profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating generation count:', updateError);
      return Response.json({ success: false, reason: 'Update failed' }, { status: 500 });
    }

    return Response.json({ 
      success: true,
      updated: updateData
    });

  } catch (error) {
    console.error('Error incrementing generation:', error);
    return Response.json({ 
      success: false, 
      reason: 'Server error' 
    }, { status: 500 });
  }
}
