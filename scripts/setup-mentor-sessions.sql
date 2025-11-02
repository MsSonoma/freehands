-- Mr. Mentor Session Management
-- Single-device enforcement and conversation persistence

-- Create mentor_sessions table
CREATE TABLE IF NOT EXISTS public.mentor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- Browser-generated unique session ID
  device_name TEXT, -- Optional device identifier
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_summary TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Only one active session per facilitator
  CONSTRAINT unique_active_session_per_facilitator UNIQUE (facilitator_id, is_active)
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_facilitator ON public.mentor_sessions(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_session_id ON public.mentor_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_active ON public.mentor_sessions(facilitator_id, is_active) WHERE is_active = TRUE;

-- RLS policies
ALTER TABLE public.mentor_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own sessions
CREATE POLICY "Users can manage their own mentor sessions"
  ON public.mentor_sessions
  FOR ALL
  USING (auth.uid() = facilitator_id)
  WITH CHECK (auth.uid() = facilitator_id);

-- Function to deactivate old sessions when a new one is created
CREATE OR REPLACE FUNCTION deactivate_old_mentor_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- Deactivate all other sessions for this facilitator
  UPDATE public.mentor_sessions
  SET is_active = FALSE
  WHERE facilitator_id = NEW.facilitator_id
    AND id != NEW.id
    AND is_active = TRUE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically deactivate old sessions
DROP TRIGGER IF EXISTS trigger_deactivate_old_mentor_sessions ON public.mentor_sessions;
CREATE TRIGGER trigger_deactivate_old_mentor_sessions
  AFTER INSERT ON public.mentor_sessions
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION deactivate_old_mentor_sessions();

-- Grant permissions
GRANT ALL ON public.mentor_sessions TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE public.mentor_sessions IS 'Tracks active Mr. Mentor sessions - enforces single device per facilitator';
COMMENT ON COLUMN public.mentor_sessions.session_id IS 'Browser-generated unique ID for this session instance';
COMMENT ON COLUMN public.mentor_sessions.conversation_history IS 'Full conversation history as JSON array';
COMMENT ON COLUMN public.mentor_sessions.is_active IS 'Only one active session allowed per facilitator at a time';
