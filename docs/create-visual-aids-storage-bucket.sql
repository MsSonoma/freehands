-- Create visual-aids storage bucket for permanent image storage
-- Run this once in Supabase SQL Editor

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('visual-aids', 'visual-aids', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for visual-aids bucket
-- Facilitators can upload/update their own visual aids
CREATE POLICY "Facilitators can upload visual aids"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'visual-aids' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Facilitators can update their visual aids"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'visual-aids'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone can read visual aids (public bucket)
CREATE POLICY "Anyone can read visual aids"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'visual-aids');

-- Facilitators can delete their own visual aids
CREATE POLICY "Facilitators can delete their visual aids"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'visual-aids'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
