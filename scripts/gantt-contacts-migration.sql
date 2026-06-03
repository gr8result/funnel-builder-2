-- Migration: Trade Contacts for Gantt Module
-- Run in: https://supabase.com/dashboard/project/bvtxfphktypdqmlnveqf/sql/new

-- 1. Contacts table (shared across all projects for a user)
CREATE TABLE IF NOT EXISTS gantt_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  company     TEXT,
  email       TEXT,
  phone       TEXT,
  tags        TEXT[] DEFAULT '{}',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gantt_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gantt_contacts' AND policyname = 'own_gantt_contacts'
  ) THEN
    CREATE POLICY own_gantt_contacts ON gantt_contacts
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Link tasks → contacts
ALTER TABLE gantt_tasks
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES gantt_contacts(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
