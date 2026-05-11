-- ────────────────────────────────────────────────────────────────────────────
-- Migration: Recall.ai live scoring columns for the interviews table
-- Run this in Supabase → SQL Editor before deploying the live scoring feature.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Recall.ai bot tracking
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS recall_bot_id     TEXT,
  ADD COLUMN IF NOT EXISTS recall_bot_status TEXT;      -- 'created' | 'in_call_recording' | 'done'

-- 2. Google Meet / Calendar event tracking
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS google_event_id   TEXT;

-- 3. Live scoring columns (updated in real-time by the webhook)
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS live_score         INTEGER,  -- running average 0–100
  ADD COLUMN IF NOT EXISTS live_last_score    INTEGER,  -- score for the last candidate utterance
  ADD COLUMN IF NOT EXISTS live_last_signal   TEXT,     -- 'Strong' | 'Good' | 'Neutral' | 'Weak' | 'Poor'
  ADD COLUMN IF NOT EXISTS live_last_tip      TEXT,     -- coaching tip for the interviewer (≤12 words)
  ADD COLUMN IF NOT EXISTS live_scores_array  INTEGER[] DEFAULT '{}',   -- all per-utterance scores
  ADD COLUMN IF NOT EXISTS live_transcript    JSONB     DEFAULT '[]';   -- array of transcript entries

-- 4. Final post-interview AI summary (generated when bot.done fires)
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS final_ai_summary   TEXT;     -- JSON string: {summary, strengths, gaps, recommendation}

-- 5. Indexes for fast bot-id lookups from the webhook
CREATE INDEX IF NOT EXISTS idx_interviews_recall_bot_id
  ON interviews (recall_bot_id)
  WHERE recall_bot_id IS NOT NULL;

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Recall.ai live scoring migration complete.';
  RAISE NOTICE 'New columns: recall_bot_id, recall_bot_status, google_event_id,';
  RAISE NOTICE '             live_score, live_last_score, live_last_signal, live_last_tip,';
  RAISE NOTICE '             live_scores_array, live_transcript, final_ai_summary';
END $$;
