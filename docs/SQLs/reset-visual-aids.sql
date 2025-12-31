-- Reset Visual Aids
-- This script deletes all visual aids records to start fresh
-- Run this in your Supabase SQL editor

-- Delete all visual aids records
DELETE FROM visual_aids;

-- Verify deletion
SELECT COUNT(*) as remaining_records FROM visual_aids;
