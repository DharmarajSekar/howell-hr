-- ═══════════════════════════════════════════════════════════════
--  HOWELL HR — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  department      TEXT,
  location        TEXT,
  employment_type TEXT DEFAULT 'Full-time',
  experience_min  INTEGER DEFAULT 0,
  experience_max  INTEGER DEFAULT 5,
  salary_min      NUMERIC,
  salary_max      NUMERIC,
  status          TEXT DEFAULT 'active',
  description     TEXT,
  requirements    TEXT,
  nice_to_have    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Candidates
CREATE TABLE IF NOT EXISTS candidates (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name           TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  phone               TEXT,
  current_title       TEXT,
  current_company     TEXT,
  experience_years    INTEGER DEFAULT 0,
  skills              TEXT[],
  location            TEXT,
  salary_expectation  NUMERIC,
  source              TEXT DEFAULT 'direct',
  summary             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Applications
CREATE TABLE IF NOT EXISTS applications (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id            UUID REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id      UUID REFERENCES candidates(id) ON DELETE CASCADE,
  status            TEXT DEFAULT 'applied',
  ai_match_score    INTEGER,
  ai_match_summary  TEXT,
  ai_strengths      TEXT[],
  ai_gaps           TEXT[],
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id    UUID REFERENCES applications(id) ON DELETE CASCADE,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER DEFAULT 60,
  interview_type    TEXT DEFAULT 'video',
  meeting_link      TEXT,
  status            TEXT DEFAULT 'scheduled',
  feedback          TEXT,
  rating            INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_name  TEXT NOT NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  channel         TEXT DEFAULT 'email',
  subject         TEXT,
  message         TEXT NOT NULL,
  status          TEXT DEFAULT 'sent',
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Records
CREATE TABLE IF NOT EXISTS onboarding_records (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id    UUID REFERENCES candidates(id),
  job_id          UUID REFERENCES jobs(id),
  candidate_name  TEXT NOT NULL,
  job_title       TEXT NOT NULL,
  joining_date    DATE,
  status          TEXT DEFAULT 'in_progress',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Tasks
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id   UUID REFERENCES onboarding_records(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  title       TEXT NOT NULL,
  completed   BOOLEAN DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at        BEFORE UPDATE ON jobs        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Disable RLS for demo (service role handles security)
ALTER TABLE jobs              DISABLE ROW LEVEL SECURITY;
ALTER TABLE candidates        DISABLE ROW LEVEL SECURITY;
ALTER TABLE applications      DISABLE ROW LEVEL SECURITY;
ALTER TABLE interviews        DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     DISABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks  DISABLE ROW LEVEL SECURITY;
