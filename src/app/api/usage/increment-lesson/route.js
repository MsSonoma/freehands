import { createClient } from '@supabase/supabase-js';

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
      .select('daily_lessons_count, last_lesson_date')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ success: false, reason: 'Profile not found' }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];
    const lastDate = profile.last_lesson_date;
    
    // Reset counter if it's a new day
    let newCount;
    if (lastDate !== today) {
      newCount = 1;
    } else {
      newCount = profile.daily_lessons_count + 1;
    }

    // Update the profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        daily_lessons_count: newCount,
        last_lesson_date: today
      })
      .eq('id', user.id);

    if (updateError) {
      // Error updating lesson count
      return Response.json({ success: false, reason: 'Update failed' }, { status: 500 });
    }

    return Response.json({ 
      success: true, 
      count: newCount,
      date: today
    });

  } catch (error) {
    // Error incrementing lesson
    return Response.json({ 
      success: false, 
      reason: 'Server error' 
    }, { status: 500 });
  }
}
