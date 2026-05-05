-- ============================================================
-- Communications & Onboarding Extension Schema
-- Run after: employees-onboarding-schema.sql
-- ============================================================

-- ── candidate_messages ───────────────────────────────────────
-- Persists every WhatsApp / Email / SMS sent or received
CREATE TABLE IF NOT EXISTS candidate_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name   TEXT NOT NULL,
  candidate_id     UUID REFERENCES candidates(id) ON DELETE SET NULL,
  application_id   UUID REFERENCES applications(id) ON DELETE SET NULL,
  channel          TEXT NOT NULL CHECK (channel IN ('WhatsApp','Email','SMS')),
  stage            TEXT,
  message          TEXT NOT NULL,
  direction        TEXT NOT NULL DEFAULT 'out' CHECK (direction IN ('out','in')),
  status           TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending','delivered','read','failed','received')),
  auto_triggered   BOOLEAN DEFAULT FALSE,
  provider_ref     TEXT,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_messages_candidate  ON candidate_messages(candidate_name);
CREATE INDEX IF NOT EXISTS idx_candidate_messages_channel    ON candidate_messages(channel);
CREATE INDEX IF NOT EXISTS idx_candidate_messages_stage      ON candidate_messages(stage);
CREATE INDEX IF NOT EXISTS idx_candidate_messages_sent_at    ON candidate_messages(sent_at DESC);

-- ── onboarding_feedback ──────────────────────────────────────
-- Day-30 / 60 / 90 check-in feedback with AI sentiment analysis
CREATE TABLE IF NOT EXISTS onboarding_feedback (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_record_id  UUID REFERENCES onboarding_records(id) ON DELETE CASCADE,
  employee_name         TEXT,
  employee_id           TEXT,
  check_in_day          INTEGER NOT NULL CHECK (check_in_day IN (30, 60, 90)),
  responses             JSONB NOT NULL DEFAULT '{}',
  sentiment             TEXT CHECK (sentiment IN ('positive','neutral','at_risk')),
  risk_score            INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  ai_summary            TEXT,
  flags                 JSONB DEFAULT '[]',
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_feedback_record   ON onboarding_feedback(onboarding_record_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_feedback_day      ON onboarding_feedback(check_in_day);
CREATE INDEX IF NOT EXISTS idx_onboarding_feedback_risk     ON onboarding_feedback(risk_score DESC);

-- ── Add due_date to onboarding_tasks ────────────────────────
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS due_date      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nudge_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS category_icon TEXT;

-- ── Add site_allocation columns to onboarding_records ───────
ALTER TABLE onboarding_records
  ADD COLUMN IF NOT EXISTS allocated_site TEXT,
  ADD COLUMN IF NOT EXISTS allocated_city TEXT;

-- ── Add site_allocation columns to applications ──────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS allocated_site TEXT,
  ADD COLUMN IF NOT EXISTS allocated_city TEXT;

-- ── Seed candidate_messages with realistic demo data ─────────
INSERT INTO candidate_messages (candidate_name, channel, stage, message, direction, status, auto_triggered, sent_at)
VALUES
  ('Rohit Sharma',   'WhatsApp', 'Shortlisted', 'Hi Rohit, great news! You have been shortlisted for Senior Site Engineer at Howell. Our team will contact you shortly to schedule an interview.',              'out', 'read',      TRUE,  NOW() - INTERVAL '5 days'),
  ('Rohit Sharma',   'WhatsApp', NULL,           'Thank you! I am available for the interview anytime this week.',                                                                                               'in',  'received',  FALSE, NOW() - INTERVAL '5 days' + INTERVAL '20 minutes'),
  ('Priya Nair',     'Email',    'Interview',    'Dear Priya, your interview for HR Manager is scheduled on 28 April at 10 AM. Meeting link has been sent to your registered email. Please confirm attendance.', 'out', 'delivered', TRUE,  NOW() - INTERVAL '4 days'),
  ('Amit Singh',     'Email',    'Offer',        'Dear Amit, we are delighted to extend an offer for the HRBP position at Howell. Please find the formal offer letter attached for your review.',               'out', 'read',      TRUE,  NOW() - INTERVAL '3 days'),
  ('Neha Gupta',     'WhatsApp', 'Hired',        'Welcome to Howell, Neha! 🎉 We are thrilled to have you on board as Data Analyst. Our HR team will reach out with your onboarding details.',                  'out', 'read',      TRUE,  NOW() - INTERVAL '2 days'),
  ('Karan Malhotra', 'SMS',      'Applied',      'Hi Karan, we received your application for Senior Site Engineer at Howell. We will review and get back to you within 3 business days.',                       'out', 'delivered', TRUE,  NOW() - INTERVAL '6 days'),
  ('Arjun Mehta',    'WhatsApp', 'Shortlisted',  'Hi Arjun, great news! You have been shortlisted for Senior Software Engineer at Howell. Our team will contact you shortly.',                                  'out', 'delivered', TRUE,  NOW() - INTERVAL '1 day'),
  ('Sneha Krishnan', 'Email',    'Interview',    'Dear Sneha, your interview for Data Analyst has been scheduled. Please check your email for the calendar invite and video conferencing link.',                 'out', 'read',      FALSE, NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- ── Seed onboarding_feedback ──────────────────────────────────
-- (requires at least one onboarding_record to exist — wrapped in a DO block)
DO $$
DECLARE
  rec_id UUID;
BEGIN
  SELECT id INTO rec_id FROM onboarding_records LIMIT 1;
  IF rec_id IS NOT NULL THEN
    INSERT INTO onboarding_feedback (onboarding_record_id, employee_name, employee_id, check_in_day, responses, sentiment, risk_score, ai_summary, flags)
    VALUES (
      rec_id,
      'Demo Employee',
      'EMP-0041',
      30,
      '{"overall_experience": 4, "it_setup_quality": 3, "team_welcome": 5, "role_clarity": 4, "would_recommend": "yes", "open_feedback": "Great team culture. IT setup took longer than expected but resolved."}'::jsonb,
      'positive',
      18,
      'Strong positive experience at Day 30. Minor delay in IT setup noted but resolved. High team satisfaction score.',
      '[]'::jsonb
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;
