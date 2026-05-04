-- ─────────────────────────────────────────────────────────────────────────────
-- HRMS Employees table + Onboarding record enhancements
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Employees (HRMS records, auto-created on Day 1 onboarding) ───────────────
CREATE TABLE IF NOT EXISTS employees (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id       text UNIQUE NOT NULL,       -- e.g. EMP-0042
  candidate_id      uuid REFERENCES candidates(id) ON DELETE SET NULL,
  application_id    uuid REFERENCES applications(id) ON DELETE SET NULL,
  onboarding_id     uuid,                       -- ref to onboarding_records

  full_name         text NOT NULL,
  personal_email    text,
  corporate_email   text UNIQUE,                -- auto-generated: first.last@howellgroup.com
  phone             text,
  job_title         text NOT NULL,
  department        text DEFAULT 'Engineering',
  location          text DEFAULT 'Chennai, India',
  joining_date      date,
  manager_name      text DEFAULT 'Rajesh Kumar',

  -- IT Provisioning
  it_provisioned    boolean DEFAULT false,
  systems_access    jsonb DEFAULT '[]'::jsonb,
    -- [{ "system": "Google Workspace", "account": "...", "status": "active" }, ...]

  -- Communication
  welcome_email_sent  boolean DEFAULT false,
  welcome_email_at    timestamptz,
  kit_dispatched      boolean DEFAULT false,
  kit_dispatched_at   timestamptz,

  status            text DEFAULT 'active' CHECK (status IN ('active','inactive','terminated')),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employees_candidate_id_idx ON employees(candidate_id);
CREATE INDEX IF NOT EXISTS employees_employee_id_idx  ON employees(employee_id);

-- ── Employee ID sequence helper (auto-increment readable ID) ─────────────────
CREATE SEQUENCE IF NOT EXISTS employee_id_seq START 43;

-- ── Add columns to onboarding_records if they don't exist ────────────────────
ALTER TABLE onboarding_records ADD COLUMN IF NOT EXISTS employee_id      text;
ALTER TABLE onboarding_records ADD COLUMN IF NOT EXISTS candidate_id     uuid;
ALTER TABLE onboarding_records ADD COLUMN IF NOT EXISTS corporate_email  text;
ALTER TABLE onboarding_records ADD COLUMN IF NOT EXISTS department        text DEFAULT 'Engineering';
ALTER TABLE onboarding_records ADD COLUMN IF NOT EXISTS welcome_email_sent  boolean DEFAULT false;
ALTER TABLE onboarding_records ADD COLUMN IF NOT EXISTS kit_dispatched      boolean DEFAULT false;
ALTER TABLE onboarding_records ADD COLUMN IF NOT EXISTS welcome_email_content text;
ALTER TABLE onboarding_records ADD COLUMN IF NOT EXISTS kit_items           jsonb DEFAULT '[]'::jsonb;

-- ── Add ocr_data column to bgv_documents ─────────────────────────────────────
ALTER TABLE bgv_documents ADD COLUMN IF NOT EXISTS ocr_data    jsonb DEFAULT '{}'::jsonb;
ALTER TABLE bgv_documents ADD COLUMN IF NOT EXISTS classified_as text;

-- ── Seed employees from existing hired candidates ─────────────────────────────
-- (safe to run multiple times — uses ON CONFLICT DO NOTHING)
INSERT INTO employees (employee_id, full_name, corporate_email, job_title, department, joining_date, welcome_email_sent, kit_dispatched, it_provisioned, systems_access)
VALUES
(
  'EMP-0041',
  'Dharmaraj Sekar',
  'dharmaraj.sekar@howellgroup.com',
  'HR Admin',
  'Human Resources',
  '2024-01-15',
  true, true, true,
  '[{"system":"Google Workspace","account":"dharmaraj.sekar@howellgroup.com","status":"active"},{"system":"Zoho HRMS","account":"dharmaraj.sekar","status":"active"},{"system":"Slack","account":"@dharmaraj.sekar","status":"active"}]'::jsonb
),
(
  'EMP-0042',
  'Neha Gupta',
  'neha.gupta@howellgroup.com',
  'Senior Site Engineer',
  'Engineering',
  '2026-05-15',
  true, true, false,
  '[{"system":"Google Workspace","account":"neha.gupta@howellgroup.com","status":"active"},{"system":"Jira","account":"neha.gupta","status":"pending"},{"system":"Slack","account":"@neha.gupta","status":"active"}]'::jsonb
)
ON CONFLICT (employee_id) DO NOTHING;
