-- Interview Routing Rules Schema
-- Run this in Supabase SQL Editor to enable rule-based interview scheduling.
--
-- Rules are evaluated in order of priority (highest first).
-- The first matching rule determines the interview type.

CREATE TABLE IF NOT EXISTS interview_routing_rules (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Human-readable rule name
  name              TEXT        NOT NULL,

  -- Role level to match: 'junior', 'mid', 'senior', 'lead', 'any'
  -- Matched against the job's experience_min:
  --   junior = 0-2 yrs, mid = 3-5 yrs, senior = 6-10 yrs, lead = 11+ yrs
  role_level        TEXT        NOT NULL DEFAULT 'any',

  -- Candidate location keyword to match (case-insensitive substring)
  -- e.g. 'New Delhi', 'Mumbai', '' means any location
  candidate_location TEXT       NOT NULL DEFAULT '',

  -- Your office/hub location (for reference / UI display)
  office_location   TEXT        NOT NULL DEFAULT '',

  -- Interview format to apply: 'in_person', 'video', 'phone'
  interview_type    TEXT        NOT NULL,

  -- Optional platform: 'zoom', 'google_meet', 'ms_teams', null = any
  interview_platform TEXT,

  -- Higher priority rules win when multiple rules match
  priority          INTEGER     NOT NULL DEFAULT 0,

  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with the two example rules from the product spec
INSERT INTO interview_routing_rules (name, role_level, candidate_location, office_location, interview_type, interview_platform, priority)
VALUES
  ('Junior role – local (in-person)', 'junior', '', 'New Delhi', 'in_person', null, 10),
  ('Junior role – outside New Delhi (Zoom)', 'junior', '', 'New Delhi', 'video', 'zoom', 5)
ON CONFLICT DO NOTHING;
