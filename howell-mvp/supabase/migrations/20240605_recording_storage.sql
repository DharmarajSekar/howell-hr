-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: AI Interview Recording Storage Setup
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure recording_url column exists on ai_interview_sessions
ALTER TABLE ai_interview_sessions
  ADD COLUMN IF NOT EXISTS recording_url text;

-- 2. Storage bucket policies for "interview-recordings"
--    BEFORE running this SQL, you MUST manually create the bucket:
--    → Supabase Dashboard → Storage → New Bucket
--    → Name: interview-recordings
--    → Public bucket: YES (toggle ON)
--    → Save

-- Allow anyone to read recordings (needed for video playback in HR review)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'interview_recordings_public_read'
  ) THEN
    CREATE POLICY "interview_recordings_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'interview-recordings');
  END IF;
END $$;

-- Allow service role to insert/upload recordings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'interview_recordings_service_insert'
  ) THEN
    CREATE POLICY "interview_recordings_service_insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'interview-recordings');
  END IF;
END $$;

-- Allow service role to upsert (overwrite) recordings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'interview_recordings_service_update'
  ) THEN
    CREATE POLICY "interview_recordings_service_update"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'interview-recordings');
  END IF;
END $$;
