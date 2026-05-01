-- ══════════════════════════════════════════════════════════
-- HOWELL HR — AI Screening Schema
-- Run in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. Knockout questions per job
--    If a candidate answers any of these "wrong", they are auto-rejected
CREATE TABLE IF NOT EXISTS knockout_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid REFERENCES jobs(id) ON DELETE CASCADE,
  question        text NOT NULL,
  question_type   text NOT NULL DEFAULT 'yes_no',  -- 'yes_no' | 'min_value' | 'multiple_choice'
  pass_answer     text NOT NULL,                   -- the answer required to PASS (e.g. 'yes', '5', 'Mumbai')
  reject_message  text DEFAULT 'You do not meet the minimum requirements for this role.',
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. Screening results per application
CREATE TABLE IF NOT EXISTS screening_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        uuid REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
  -- Eligibility checks
  experience_check      text NOT NULL DEFAULT 'pending', -- 'pass' | 'fail' | 'pending'
  experience_detail     text,
  salary_check          text NOT NULL DEFAULT 'pending',
  salary_detail         text,
  location_check        text NOT NULL DEFAULT 'pending',
  location_detail       text,
  -- Knockout
  knockout_passed       boolean,
  knockout_failed_q     text,   -- the question that caused rejection
  -- AI scoring
  ai_score              int,
  ai_summary            text,
  ai_strengths          text[],
  ai_gaps               text[],
  -- Overall result
  overall_result        text NOT NULL DEFAULT 'pending', -- 'pass' | 'fail' | 'review' | 'pending'
  auto_rejected         boolean NOT NULL DEFAULT false,
  reject_reason         text,
  screened_at           timestamptz DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 3. Add auto_shortlist_threshold to interview_pipeline_configs
ALTER TABLE interview_pipeline_configs
  ADD COLUMN IF NOT EXISTS auto_shortlist_threshold  int NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS auto_reject_below         int NOT NULL DEFAULT 40;

-- 4. Disable RLS for demo
ALTER TABLE knockout_questions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE screening_results   DISABLE ROW LEVEL SECURITY;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
