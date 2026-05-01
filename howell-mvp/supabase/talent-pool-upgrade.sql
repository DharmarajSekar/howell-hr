-- ═══════════════════════════════════════════════════════════════
--  HOWELL HR — Talent Pool Upgrade Migration
--  Run this in: Supabase Dashboard → SQL Editor → New query
--  Adds: resume_url, referral tracking fields, resume_parsed flag
-- ═══════════════════════════════════════════════════════════════

-- Add resume storage field
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_url        TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_text       TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_parsed     BOOLEAN DEFAULT FALSE;

-- Add referral tracking fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS referred_by       TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS referral_notes    TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS referral_date     TIMESTAMPTZ;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
