-- Production module tables
-- Run this in your Supabase SQL editor

-- Jobs list (index board)
CREATE TABLE IF NOT EXISTS production_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  client_name TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

-- Steps for the index board (one row per job × stage)
CREATE TABLE IF NOT EXISTS production_job_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  step_key     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  notes        TEXT,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, step_key)
);

-- Items for the detail board (rows within a job)
CREATE TABLE IF NOT EXISTS production_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  category   TEXT,
  supplier   TEXT,
  notes      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stage status per item (one row per item × stage)
CREATE TABLE IF NOT EXISTS production_item_stages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  stage_key    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  notes        TEXT,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_id, stage_key)
);

-- RLS
ALTER TABLE production_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_job_steps   ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_item_stages ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see/modify their own data
CREATE POLICY "production_jobs_user" ON production_jobs
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "production_job_steps_user" ON production_job_steps
  USING (job_id IN (SELECT id FROM production_jobs WHERE user_id = auth.uid()));

CREATE POLICY "production_items_user" ON production_items
  USING (job_id IN (SELECT id FROM production_jobs WHERE user_id = auth.uid()));

CREATE POLICY "production_item_stages_user" ON production_item_stages
  USING (item_id IN (SELECT id FROM production_items WHERE job_id IN (SELECT id FROM production_jobs WHERE user_id = auth.uid())));
