-- Add source, candidate_name, job_title columns to applications table
-- These are needed for talent-pool "Apply to Job", pipeline filtering,
-- and notification messages.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS source          TEXT DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS candidate_name  TEXT,
  ADD COLUMN IF NOT EXISTS job_title       TEXT;

-- Index for fast pipeline filtering by source
CREATE INDEX IF NOT EXISTS idx_applications_source ON applications(source);
