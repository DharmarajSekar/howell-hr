-- ── Migration: BGV backfill for hired candidates ──────────────────────────────
-- Run this once to create BGV records for any candidate already marked "hired"
-- who slipped through before the autoBGV() schema fix.
--
-- Root causes fixed in app code (app/api/applications/[id]/route.ts):
--   1. job_title (NOT NULL) was missing from the INSERT → silent DB error
--   2. reference_check column doesn't exist → should be address_check + criminal_check
--   3. notes column doesn't exist in bgv_records
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO bgv_records (
  candidate_id,
  application_id,
  candidate_name,
  job_title,
  status,
  identity_check,
  education_check,
  employment_check,
  address_check,
  criminal_check,
  fraud_flag,
  initiated_at
)
SELECT
  a.candidate_id,
  a.id             AS application_id,
  COALESCE(c.full_name, a.candidate_name, 'Unknown') AS candidate_name,
  COALESCE(j.title, a.job_title, 'Unknown Role')     AS job_title,
  'initiated'      AS status,
  'pending'        AS identity_check,
  'pending'        AS education_check,
  'pending'        AS employment_check,
  'pending'        AS address_check,
  'pending'        AS criminal_check,
  false            AS fraud_flag,
  NOW()            AS initiated_at
FROM applications a
LEFT JOIN candidates c ON c.id = a.candidate_id
LEFT JOIN jobs j       ON j.id = a.job_id
WHERE a.status = 'hired'
  AND NOT EXISTS (
    SELECT 1 FROM bgv_records b WHERE b.application_id = a.id
  );
