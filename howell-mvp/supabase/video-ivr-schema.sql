-- ============================================================
-- Video Pre-Screen & IVR Schema Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- Add call_sid column to pre_screen_sessions (for IVR tracking)
ALTER TABLE pre_screen_sessions
  ADD COLUMN IF NOT EXISTS call_sid       TEXT,
  ADD COLUMN IF NOT EXISTS video_recordings JSONB  DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ;

-- Add ai_score and ai_evaluation columns if not already present
ALTER TABLE pre_screen_sessions
  ADD COLUMN IF NOT EXISTS ai_score       INTEGER,
  ADD COLUMN IF NOT EXISTS ai_evaluation  TEXT,
  ADD COLUMN IF NOT EXISTS ai_recommendation TEXT;

-- Index for fast IVR lookup by call_sid
CREATE INDEX IF NOT EXISTS idx_pre_screen_sessions_call_sid
  ON pre_screen_sessions (call_sid);

-- ============================================================
-- Verify
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pre_screen_sessions'
ORDER BY ordinal_position;
