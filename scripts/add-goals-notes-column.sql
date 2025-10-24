-- Add goals_notes column to learners table
-- This stores persistent goals/notes that facilitators set for each learner
-- Character limit: 600 characters enforced in UI

ALTER TABLE learners 
ADD COLUMN IF NOT EXISTS goals_notes TEXT;

-- Add goals_notes column to profiles table
-- This stores the facilitator's own personal goals
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS goals_notes TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_learners_goals_notes ON learners(id) WHERE goals_notes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_goals_notes ON profiles(id) WHERE goals_notes IS NOT NULL;
