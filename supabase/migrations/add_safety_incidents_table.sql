-- Content Safety Incident Logging Schema
-- Run this in your Supabase SQL editor to enable security audit logging

CREATE TABLE IF NOT EXISTS safety_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Feature context
    feature TEXT NOT NULL, -- 'ask', 'poem', 'story', 'fill_in_fun', 'general'
    
    -- What was blocked
    blocked_input TEXT NOT NULL,
    blocked_output TEXT, -- NULL if input was blocked, populated if output was blocked
    
    -- Why it was blocked
    reason TEXT NOT NULL, -- 'banned_keyword', 'prompt_injection', 'moderation_flagged', 'inappropriate_output'
    validation_details JSONB, -- Full validation response for debugging
    
    -- User context
    learner_id UUID, -- NULL if not authenticated
    session_id TEXT, -- Browser session ID for tracking patterns
    
    -- Request metadata
    ip_address TEXT,
    user_agent TEXT,
    
    -- Index for queries
    CONSTRAINT safety_incidents_feature_check CHECK (feature IN ('ask', 'poem', 'story', 'fill_in_fun', 'general'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_safety_incidents_created_at ON safety_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_feature ON safety_incidents(feature);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_learner_id ON safety_incidents(learner_id) WHERE learner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_safety_incidents_session_id ON safety_incidents(session_id) WHERE session_id IS NOT NULL;

-- Row Level Security (RLS)
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;

-- Only admins can read incident logs (adjust policy as needed)
CREATE POLICY "Admins can view all incidents" ON safety_incidents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- API can insert incidents (service role key)
CREATE POLICY "Service role can insert incidents" ON safety_incidents
    FOR INSERT
    WITH CHECK (true);

COMMENT ON TABLE safety_incidents IS 'Audit log for content safety violations and blocked attempts';
COMMENT ON COLUMN safety_incidents.blocked_input IS 'The user input that triggered the safety block';
COMMENT ON COLUMN safety_incidents.blocked_output IS 'The LLM output that was blocked (NULL if input validation failed)';
COMMENT ON COLUMN safety_incidents.reason IS 'Primary reason for blocking: banned_keyword, prompt_injection, moderation_flagged, inappropriate_output';
COMMENT ON COLUMN safety_incidents.validation_details IS 'Full JSON response from validation functions for debugging';
