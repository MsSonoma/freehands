import { getSupabaseClient } from '@/app/lib/supabaseClient';

const DEFAULT_PREFS = {
  enabled: true,
  planned_unscheduled_enabled: true,
  expired_lessons_enabled: true,
  subscription_enabled: true
};

export async function getCurrentFacilitatorId() {
  const supabase = getSupabaseClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  const facilitatorId = session?.user?.id;
  if (!facilitatorId) throw new Error('Not signed in');
  return facilitatorId;
}

export async function ensureNotificationPrefs(facilitatorId) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('facilitator_notification_prefs')
    .select('*')
    .eq('facilitator_id', facilitatorId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const insertRow = { facilitator_id: facilitatorId, ...DEFAULT_PREFS };
  const { data: created, error: insertError } = await supabase
    .from('facilitator_notification_prefs')
    .insert(insertRow)
    .select('*')
    .single();

  if (insertError) throw insertError;
  return created;
}

export async function saveNotificationPrefs(facilitatorId, prefs) {
  const supabase = getSupabaseClient();

  const payload = {
    facilitator_id: facilitatorId,
    enabled: !!prefs.enabled,
    planned_unscheduled_enabled: !!prefs.planned_unscheduled_enabled,
    expired_lessons_enabled: !!prefs.expired_lessons_enabled,
    subscription_enabled: !!prefs.subscription_enabled,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('facilitator_notification_prefs')
    .upsert(payload, { onConflict: 'facilitator_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function seedDemoNotificationsIfEmpty(facilitatorId) {
  const supabase = getSupabaseClient();

  const { count, error: countError } = await supabase
    .from('facilitator_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('facilitator_id', facilitatorId);

  if (countError) throw countError;
  if ((count || 0) > 0) return;

  const now = new Date().toISOString();
  const seed = [
    {
      facilitator_id: facilitatorId,
      category: 'lesson-planning',
      type: 'planned_not_scheduled',
      title: 'Planned lessons need scheduling',
      body: 'You have planned lessons that are not on the calendar yet.',
      metadata: { demo: true },
      created_at: now
    },
    {
      facilitator_id: facilitatorId,
      category: 'lesson-expiry',
      type: 'scheduled_expired_uncompleted',
      title: 'A scheduled lesson expired',
      body: 'A scheduled lesson passed its end date without completion.',
      metadata: { demo: true },
      created_at: now
    },
    {
      facilitator_id: facilitatorId,
      category: 'subscription',
      type: 'subscription_expiring',
      title: 'Subscription expiring soon',
      body: 'Your subscription is set to expire soon.',
      metadata: { demo: true },
      created_at: now
    },
    {
      facilitator_id: facilitatorId,
      category: 'subscription',
      type: 'plan_changed',
      title: 'Plan change detected',
      body: 'Your subscription plan changed recently.',
      metadata: { demo: true },
      created_at: now
    },
    {
      facilitator_id: facilitatorId,
      category: 'subscription',
      type: 'usage_limit_hit',
      title: 'Usage limit reached',
      body: 'You hit a plan limit. Upgrade or wait for reset.',
      metadata: { demo: true },
      created_at: now
    }
  ];

  const { error: insertError } = await supabase
    .from('facilitator_notifications')
    .insert(seed);

  if (insertError) throw insertError;
}

export async function listNotifications(facilitatorId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('facilitator_notifications')
    .select('*')
    .eq('facilitator_id', facilitatorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function setNotificationRead(id, read) {
  const supabase = getSupabaseClient();
  const readAt = read ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from('facilitator_notifications')
    .update({ read_at: readAt })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
