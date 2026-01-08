-- Facilitator notifications + preferences

-- Notifications table (per facilitator)
CREATE TABLE IF NOT EXISTS public.facilitator_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Grouping and type
  category text NOT NULL,
  type text NOT NULL,

  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_facilitator_notifications_facilitator
  ON public.facilitator_notifications(facilitator_id);

CREATE INDEX IF NOT EXISTS idx_facilitator_notifications_facilitator_read
  ON public.facilitator_notifications(facilitator_id, read_at);

-- Preferences table (per facilitator)
CREATE TABLE IF NOT EXISTS public.facilitator_notification_prefs (
  facilitator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  enabled boolean NOT NULL DEFAULT true,
  planned_unscheduled_enabled boolean NOT NULL DEFAULT true,
  expired_lessons_enabled boolean NOT NULL DEFAULT true,
  subscription_enabled boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facilitator_notification_prefs_facilitator
  ON public.facilitator_notification_prefs(facilitator_id);

-- Enable RLS
ALTER TABLE public.facilitator_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilitator_notification_prefs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: facilitator_notifications
CREATE POLICY "Facilitators can view their own notifications"
  ON public.facilitator_notifications FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert their own notifications"
  ON public.facilitator_notifications FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can update their own notifications"
  ON public.facilitator_notifications FOR UPDATE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can delete their own notifications"
  ON public.facilitator_notifications FOR DELETE
  USING (auth.uid() = facilitator_id);

-- RLS Policies: facilitator_notification_prefs
CREATE POLICY "Facilitators can view their own notification prefs"
  ON public.facilitator_notification_prefs FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert their own notification prefs"
  ON public.facilitator_notification_prefs FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can update their own notification prefs"
  ON public.facilitator_notification_prefs FOR UPDATE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can delete their own notification prefs"
  ON public.facilitator_notification_prefs FOR DELETE
  USING (auth.uid() = facilitator_id);
