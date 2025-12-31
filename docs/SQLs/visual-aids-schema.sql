-- Visual Aids Storage Schema
-- Stores facilitator-specific visual aids for any lesson (public or private)
-- This allows facilitators to customize visual aids without copying entire lessons

CREATE TABLE IF NOT EXISTS visual_aids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_key TEXT NOT NULL, -- e.g., "math/4th-fractions.json" or "facilitator/my-lesson.json"
  
  -- All generated images (up to 12)
  generated_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Selected images for session use (up to 3)
  selected_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Generation tracking
  generation_count INTEGER NOT NULL DEFAULT 0,
  max_generations INTEGER NOT NULL DEFAULT 4,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One visual aids record per facilitator per lesson
  UNIQUE(facilitator_id, lesson_key)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_visual_aids_facilitator_lesson 
  ON visual_aids(facilitator_id, lesson_key);

-- Enable Row Level Security
ALTER TABLE visual_aids ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own visual aids
CREATE POLICY visual_aids_select_own 
  ON visual_aids 
  FOR SELECT 
  USING (auth.uid() = facilitator_id);

-- Policy: Users can only insert their own visual aids
CREATE POLICY visual_aids_insert_own 
  ON visual_aids 
  FOR INSERT 
  WITH CHECK (auth.uid() = facilitator_id);

-- Policy: Users can only update their own visual aids
CREATE POLICY visual_aids_update_own 
  ON visual_aids 
  FOR UPDATE 
  USING (auth.uid() = facilitator_id);

-- Policy: Users can only delete their own visual aids
CREATE POLICY visual_aids_delete_own 
  ON visual_aids 
  FOR DELETE 
  USING (auth.uid() = facilitator_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_visual_aids_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER visual_aids_updated_at
  BEFORE UPDATE ON visual_aids
  FOR EACH ROW
  EXECUTE FUNCTION update_visual_aids_updated_at();

-- Comments
COMMENT ON TABLE visual_aids IS 'Stores facilitator-specific visual aids for lessons';
COMMENT ON COLUMN visual_aids.lesson_key IS 'Lesson identifier (e.g., math/4th-fractions.json)';
COMMENT ON COLUMN visual_aids.generated_images IS 'Array of all generated images with url, prompt, description, id';
COMMENT ON COLUMN visual_aids.selected_images IS 'Array of selected images (max 3) for session use';
COMMENT ON COLUMN visual_aids.generation_count IS 'Number of generations used (0-4)';
