-- Migration: Gantt module + job board ordered card type
-- Run this in: https://supabase.com/dashboard/project/bvtxfphktypdqmlnveqf/sql/new

-- 1. Job board: ordered card type column
ALTER TABLE job_board_tasks ADD COLUMN IF NOT EXISTS note_red TEXT;

-- 2. Gantt projects table
CREATE TABLE IF NOT EXISTS gantt_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New Build',
  client_name TEXT,
  job_address TEXT,
  job_type TEXT DEFAULT 'New Build',
  start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gantt_projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gantt_projects' AND policyname = 'own_gantt_projects'
  ) THEN
    CREATE POLICY own_gantt_projects ON gantt_projects
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Gantt tasks table
CREATE TABLE IF NOT EXISTS gantt_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES gantt_projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'General',
  phase_order INT DEFAULT 0,
  name TEXT NOT NULL,
  start_day INT DEFAULT 0,
  duration_days INT DEFAULT 7,
  status TEXT DEFAULT 'pending',
  assigned_trade TEXT,
  is_milestone BOOLEAN DEFAULT false,
  is_long_lead BOOLEAN DEFAULT false,
  dependencies JSONB DEFAULT '[]',
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gantt_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gantt_tasks' AND policyname = 'own_gantt_tasks'
  ) THEN
    CREATE POLICY own_gantt_tasks ON gantt_tasks
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM gantt_projects
          WHERE gantt_projects.id = gantt_tasks.project_id
            AND gantt_projects.user_id = auth.uid()
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
