-- ══════════════════════════════════════════════════════════
-- HOWELL HR — AI Interview System Schema
-- Run in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. Interview pipeline configuration per job
CREATE TABLE IF NOT EXISTS interview_pipeline_configs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                uuid REFERENCES jobs(id) ON DELETE CASCADE,
  name                  text NOT NULL DEFAULT 'Standard Pipeline',
  auto_schedule_enabled boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);

-- 2. Individual round definitions within a pipeline
CREATE TABLE IF NOT EXISTS interview_rounds (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id             uuid REFERENCES interview_pipeline_configs(id) ON DELETE CASCADE,
  round_number          int NOT NULL,
  name                  text NOT NULL,            -- e.g. "AI Screening", "Technical Round"
  type                  text NOT NULL DEFAULT 'ai', -- 'ai' | 'manual' | 'panel'
  duration_minutes      int NOT NULL DEFAULT 30,
  -- AI settings (only for type='ai')
  tavus_persona_id           text,                -- Tavus persona/replica ID
  ai_questions               jsonb DEFAULT '[]',  -- array of question strings (used if auto_generate is off)
  ai_auto_generate_questions boolean NOT NULL DEFAULT true, -- generate questions per candidate using AI
  -- Scoring & progression
  pass_score_threshold  int NOT NULL DEFAULT 60,  -- score >= this to pass to next round
  -- Auto-scheduling settings
  auto_schedule         boolean NOT NULL DEFAULT false,
  score_trigger         int NOT NULL DEFAULT 70,  -- application ai_match_score to trigger this round
  delay_hours           int NOT NULL DEFAULT 24,  -- hours to wait before auto-scheduling
  requires_approval     boolean NOT NULL DEFAULT false, -- HR must approve before scheduling
  -- Order & status
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 3. AI interview sessions (each time an AI round is conducted)
CREATE TABLE IF NOT EXISTS ai_interview_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        uuid REFERENCES applications(id) ON DELETE CASCADE,
  round_id              uuid REFERENCES interview_rounds(id),
  -- Tavus session
  tavus_conversation_id text,
  tavus_conversation_url text,
  -- Status
  status                text NOT NULL DEFAULT 'scheduled', -- scheduled|in_progress|completed|failed|cancelled
  -- Recording (Supabase Storage)
  recording_path        text,                     -- path in supabase storage bucket
  recording_url         text,                     -- public/signed URL
  recording_duration_s  int,
  -- Results
  transcript            jsonb DEFAULT '[]',        -- [{role, content, timestamp}]
  ai_score              int,                       -- 0-100 score from AI analysis
  ai_evaluation         text,                      -- written evaluation summary
  strengths             jsonb DEFAULT '[]',
  concerns              jsonb DEFAULT '[]',
  recommendation        text,                      -- 'pass' | 'fail' | 'maybe'
  -- Timestamps
  scheduled_at          timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 4. Auto-schedule queue (candidates waiting to be scheduled)
CREATE TABLE IF NOT EXISTS interview_auto_queue (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        uuid REFERENCES applications(id) ON DELETE CASCADE,
  round_id              uuid REFERENCES interview_rounds(id),
  trigger_score         int,
  scheduled_for         timestamptz,              -- when to fire the schedule
  status                text NOT NULL DEFAULT 'pending', -- pending|approved|rejected|done
  hr_approved_by        text,
  hr_approved_at        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE interview_pipeline_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_rounds            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interview_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_auto_queue        ENABLE ROW LEVEL SECURITY;

-- Create Supabase Storage bucket for recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('interview-recordings', 'interview-recordings', false)
ON CONFLICT (id) DO NOTHING;
