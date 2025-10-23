-- Add support for draft conversation summaries
-- Drafts are updated live but only saved to memory when user approves

-- Table: conversation_drafts
-- Stores work-in-progress clipboard summaries (not yet approved by user)
CREATE TABLE IF NOT EXISTS conversation_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  
  -- Draft summary content (updated incrementally)
  draft_summary TEXT NOT NULL DEFAULT '',
  
  -- Recent conversation turns (for context)
  recent_turns JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  turn_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One draft per facilitator-learner pair
  CONSTRAINT unique_draft_conversation UNIQUE (facilitator_id, learner_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversation_drafts_facilitator 
  ON conversation_drafts(facilitator_id);
  
CREATE INDEX IF NOT EXISTS idx_conversation_drafts_learner 
  ON conversation_drafts(learner_id);

-- RLS policies
ALTER TABLE conversation_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facilitators can view their own conversation drafts"
  ON conversation_drafts FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert their own conversation drafts"
  ON conversation_drafts FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can update their own conversation drafts"
  ON conversation_drafts FOR UPDATE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can delete their own conversation drafts"
  ON conversation_drafts FOR DELETE
  USING (auth.uid() = facilitator_id);

COMMENT ON TABLE conversation_drafts IS 'Work-in-progress conversation summaries. Updated live but only saved to memory when user explicitly approves.';
