-- =============================================================================
-- WORKSPACE SYSTEM + CRM REFACTOR MIGRATION
-- Run this in Supabase SQL Editor.
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. WORKSPACES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE,                -- optional vanity slug
  plan          TEXT NOT NULL DEFAULT 'starter', -- starter | growth | professional
  owner_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. WORKSPACE MEMBERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'sales',  -- owner | admin | sales | marketing | support
  status        TEXT NOT NULL DEFAULT 'active', -- active | invited | suspended
  invited_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Ensure all required columns exist (safe if table was created by an older migration)
DO $$ BEGIN
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN RAISE NOTICE 'workspace_members.workspace_id: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN RAISE NOTICE 'workspace_members.user_id: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'sales';
EXCEPTION WHEN others THEN RAISE NOTICE 'workspace_members.role: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
EXCEPTION WHEN others THEN RAISE NOTICE 'workspace_members.status: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN RAISE NOTICE 'workspace_members.invited_by: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
EXCEPTION WHEN others THEN RAISE NOTICE 'workspace_members.created_at: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
EXCEPTION WHEN others THEN RAISE NOTICE 'workspace_members.updated_at: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON workspace_members(workspace_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'workspace_members_workspace_idx: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'workspace_members_user_idx: %', SQLERRM; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. WORKSPACE PLAN ENTITLEMENTS
--    Replaces cookie-based entitlements and user_modules table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_entitlements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module_id     TEXT NOT NULL,               -- matches MODULES in modules-catalog.js
  enabled       BOOLEAN NOT NULL DEFAULT true,
  usage_limit   INTEGER,                     -- NULL = unlimited
  plan_tier     TEXT,                        -- starter | growth | professional
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, module_id)
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS workspace_entitlements_ws_idx ON workspace_entitlements(workspace_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'workspace_entitlements_ws_idx: %', SQLERRM; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ADD workspace_id TO CRM TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. leads (each column in its own block so one failure can't block the rest)
DO $$ BEGIN
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN RAISE NOTICE 'leads.workspace_id: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN RAISE NOTICE 'leads.lead_owner_user_id: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new';
EXCEPTION WHEN others THEN RAISE NOTICE 'leads.lead_status: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source TEXT;
EXCEPTION WHEN others THEN RAISE NOTICE 'leads.lead_source: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
EXCEPTION WHEN others THEN RAISE NOTICE 'leads.assigned_at: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
EXCEPTION WHEN others THEN RAISE NOTICE 'leads.updated_at: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS leads_workspace_idx ON leads(workspace_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'leads_workspace_idx: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS leads_owner_idx ON leads(lead_owner_user_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'leads_owner_idx: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(lead_status);
EXCEPTION WHEN others THEN RAISE NOTICE 'leads_status_idx: %', SQLERRM; END $$;

-- 4b. crm_stages
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_stages') THEN
    ALTER TABLE crm_stages ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS crm_stages_workspace_idx ON crm_stages(workspace_id);
  END IF;
END $$;

-- 4c. crm_tasks
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_tasks') THEN
    ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS crm_tasks_workspace_idx ON crm_tasks(workspace_id);
  END IF;
END $$;

-- 4d. crm_calls
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_calls') THEN
    ALTER TABLE crm_calls ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS crm_calls_workspace_idx ON crm_calls(workspace_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ADD workspace_id TO OTHER MODULE TABLES (safe - only if tables exist)
-- ─────────────────────────────────────────────────────────────────────────────

-- Funnels
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'funnels') THEN
    ALTER TABLE funnels ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS funnels_workspace_idx ON funnels(workspace_id);
  END IF;
END $$;

-- Email campaigns / broadcasts
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_campaigns') THEN
    ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Bookings
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bookings') THEN
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Automations
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'automations') THEN
    ALTER TABLE automations ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. COMMUNITIES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS communities_workspace_idx ON communities(workspace_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'communities_workspace_idx: %', SQLERRM; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. UPDATED_AT TRIGGERS (workspace & member tables)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'workspaces_updated_at') THEN
    CREATE TRIGGER workspaces_updated_at
      BEFORE UPDATE ON workspaces
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'workspace_members_updated_at') THEN
    CREATE TRIGGER workspace_members_updated_at
      BEFORE UPDATE ON workspace_members
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'workspace_entitlements_updated_at') THEN
    CREATE TRIGGER workspace_entitlements_updated_at
      BEFORE UPDATE ON workspace_entitlements
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE workspaces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities          ENABLE ROW LEVEL SECURITY;

-- Members can read their own workspaces
DROP POLICY IF EXISTS "members_read_workspace" ON workspaces;
CREATE POLICY "members_read_workspace"
  ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Members can read their own membership rows + workspace members
DROP POLICY IF EXISTS "members_read_workspace_members" ON workspace_members;
CREATE POLICY "members_read_workspace_members"
  ON workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Members can read their workspace entitlements
DROP POLICY IF EXISTS "members_read_entitlements" ON workspace_entitlements;
CREATE POLICY "members_read_entitlements"
  ON workspace_entitlements FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Communities are readable by workspace members
DROP POLICY IF EXISTS "members_read_communities" ON communities;
CREATE POLICY "members_read_communities"
  ON communities FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. HELPER FUNCTION: assert_workspace_member(user_id, workspace_id)
--    Returns the member role or raises an exception.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assert_workspace_member(p_user_id UUID, p_workspace_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM workspace_members
  WHERE user_id = p_user_id
    AND workspace_id = p_workspace_id
    AND status = 'active';

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User % is not a member of workspace %', p_user_id, p_workspace_id;
  END IF;

  RETURN v_role;
END;
$$;
