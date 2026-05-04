-- ─────────────────────────────────────────────────────────────────────────────
-- Offers & Negotiation — Supabase schema migration
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offers (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id        uuid REFERENCES applications(id) ON DELETE SET NULL,

  -- Candidate & role (denormalised for quick access even if application is deleted)
  candidate_name        text NOT NULL,
  candidate_email       text,
  role                  text NOT NULL,
  department            text DEFAULT 'Engineering',
  location              text DEFAULT 'Chennai, India',
  joining_date          date,

  -- Compensation
  ctc_annual            numeric(12,2) NOT NULL,
  ctc_breakdown         jsonb DEFAULT '{}'::jsonb,
    -- { basic, hra, special_allowance, performance_bonus, pf_employer, gratuity }
    -- all values in LPA

  -- AI salary benchmark
  benchmark_min         numeric(12,2),
  benchmark_max         numeric(12,2),
  benchmark_median      numeric(12,2),
  ai_benchmark_notes    text,   -- Claude's market commentary

  -- Approval workflow (Manager → HR)
  -- Each step: { role, approver_name, status: 'pending'|'approved'|'rejected', approved_at, comments }
  approval_chain        jsonb DEFAULT '[
    {"step": 1, "role": "Hiring Manager", "approver_name": "Rajesh Kumar",   "status": "pending",  "approved_at": null, "comments": ""},
    {"step": 2, "role": "HR Admin",       "approver_name": "Dharmaraj Sekar","status": "waiting",  "approved_at": null, "comments": ""}
  ]'::jsonb,
  current_step          integer DEFAULT 0,
    -- 0 = draft (no approvals started)
    -- 1 = awaiting step-1 approval (Hiring Manager)
    -- 2 = awaiting step-2 approval (HR)
    -- 3 = fully approved → ready to send

  -- Offer lifecycle
  status                text DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','sent','accepted','declined','expired')),

  sent_at               timestamptz,
  accepted_at           timestamptz,
  declined_at           timestamptz,
  expiry_date           date,

  -- Digital signature
  candidate_signature   text,   -- base64 PNG of canvas signature
  signed_at             timestamptz,
  signature_ip          text,   -- optional, for audit trail

  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS offers_application_id_idx ON offers(application_id);
CREATE INDEX IF NOT EXISTS offers_status_idx ON offers(status);

-- ── Seed data ─────────────────────────────────────────────────────────────────
-- Three realistic seed offers mirroring existing Supabase candidates

INSERT INTO offers (
  candidate_name, candidate_email, role, department, location, joining_date,
  ctc_annual, ctc_breakdown,
  benchmark_min, benchmark_max, benchmark_median,
  ai_benchmark_notes,
  approval_chain, current_step, status,
  sent_at, accepted_at
) VALUES
(
  'Neha Gupta', 'neha.gupta@example.com',
  'Senior Site Engineer', 'Engineering', 'Mumbai, India', '2026-05-15',
  18, '{"basic": 7.2, "hra": 3.6, "special_allowance": 4.5, "performance_bonus": 1.8, "pf_employer": 0.54, "gratuity": 0.36}'::jsonb,
  15, 22, 18.5,
  'Market rate for Senior Site Engineers in Mumbai ranges ₹15–22 LPA. The offer at ₹18 LPA is competitive and within the median band.',
  '[
    {"step":1,"role":"Hiring Manager","approver_name":"Rajesh Kumar",   "status":"approved","approved_at":"2026-04-20T10:30:00Z","comments":"Strong candidate, approved."},
    {"step":2,"role":"HR Admin",      "approver_name":"Dharmaraj Sekar","status":"approved","approved_at":"2026-04-21T09:15:00Z","comments":"Cleared all checks."}
  ]'::jsonb,
  3, 'accepted',
  '2026-04-21T11:00:00Z', '2026-04-22T14:30:00Z'
),
(
  'Amit Singh', 'amit.singh@example.com',
  'HR Business Partner', 'Human Resources', 'Chennai, India', '2026-06-01',
  24, '{"basic": 9.6, "hra": 4.8, "special_allowance": 6.0, "performance_bonus": 2.4, "pf_employer": 0.72, "gratuity": 0.48}'::jsonb,
  20, 28, 24,
  'Senior HR Business Partner roles in Chennai command ₹20–28 LPA. This offer at ₹24 LPA is precisely at the median — strong market-aligned positioning.',
  '[
    {"step":1,"role":"Hiring Manager","approver_name":"Rajesh Kumar",   "status":"approved","approved_at":"2026-04-22T09:00:00Z","comments":"Approved — excellent fit."},
    {"step":2,"role":"HR Admin",      "approver_name":"Dharmaraj Sekar","status":"pending", "approved_at":null,"comments":""}
  ]'::jsonb,
  2, 'pending_approval',
  NULL, NULL
),
(
  'Rohit Sharma', 'rohit.sharma@example.com',
  'Senior Site Engineer', 'Engineering', 'Bangalore, India', '2026-06-15',
  16, '{"basic": 6.4, "hra": 3.2, "special_allowance": 4.0, "performance_bonus": 1.6, "pf_employer": 0.48, "gratuity": 0.32}'::jsonb,
  15, 22, 18.5,
  'Market rate for Senior Site Engineers in Bangalore ranges ₹15–22 LPA. The offer at ₹16 LPA is slightly below median — consider adding a performance bonus.',
  '[
    {"step":1,"role":"Hiring Manager","approver_name":"Rajesh Kumar",   "status":"pending","approved_at":null,"comments":""},
    {"step":2,"role":"HR Admin",      "approver_name":"Dharmaraj Sekar","status":"waiting","approved_at":null,"comments":""}
  ]'::jsonb,
  1, 'pending_approval',
  NULL, NULL
);
