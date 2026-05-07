-- Add openings tracking to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS openings        INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS positions_filled INT NOT NULL DEFAULT 0;

-- Backfill existing jobs: assume 1 opening, 0 filled unless status=closed
UPDATE jobs SET openings = 1, positions_filled = 0 WHERE openings IS NULL;
