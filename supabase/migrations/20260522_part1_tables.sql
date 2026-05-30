-- =============================================================================
-- PART 1: CREATE WORKSPACE TABLES + ADD COLUMNS
-- Paste this in Supabase SQL Editor and run it first.
-- Safe to run multiple times.
-- =============================================================================

-- 1. WORKSPACES
CREATE TABLE IF NOT EXISTS workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'starter',
  owner_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. WORKSPACE MEMBERS
CREATE TABLE IF NOT EXISTS workspace_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'sales',
  status       TEXT NOT NULL DEFAULT 'active',
  invited_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Patch workspace_members if created by an older migration without all columns
DO $$ BEGIN ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip workspace_members.workspace_id: %', SQLERRM; END $$;
DO $$ BEGIN ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip workspace_members.user_id: %', SQLERRM; END $$;
DO $$ BEGIN ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'sales';
EXCEPTION WHEN others THEN RAISE NOTICE 'skip workspace_members.role: %', SQLERRM; END $$;
DO $$ BEGIN ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
EXCEPTION WHEN others THEN RAISE NOTICE 'skip workspace_members.status: %', SQLERRM; END $$;
DO $$ BEGIN ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip workspace_members.invited_by: %', SQLERRM; END $$;
DO $$ BEGIN ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
EXCEPTION WHEN others THEN RAISE NOTICE 'skip workspace_members.created_at: %', SQLERRM; END $$;
DO $$ BEGIN ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
EXCEPTION WHEN others THEN RAISE NOTICE 'skip workspace_members.updated_at: %', SQLERRM; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON workspace_members(workspace_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'skip idx workspace_members_workspace: %', SQLERRM; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'skip idx workspace_members_user: %', SQLERRM; END $$;

-- 3. WORKSPACE ENTITLEMENTS
CREATE TABLE IF NOT EXISTS workspace_entitlements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module_id    TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  usage_limit  INTEGER,
  plan_tier    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, module_id)
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS workspace_entitlements_ws_idx ON workspace_entitlements(workspace_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'skip idx workspace_entitlements_ws: %', SQLERRM; END $$;

-- 4. ADD workspace_id TO leads
DO $$ BEGIN ALTER TABLE leads ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip leads.workspace_id: %', SQLERRM; END $$;
DO $$ BEGIN ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip leads.lead_owner_user_id: %', SQLERRM; END $$;
DO $$ BEGIN ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new';
EXCEPTION WHEN others THEN RAISE NOTICE 'skip leads.lead_status: %', SQLERRM; END $$;
DO $$ BEGIN ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source TEXT;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip leads.lead_source: %', SQLERRM; END $$;
DO $$ BEGIN ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip leads.assigned_at: %', SQLERRM; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS leads_workspace_idx ON leads(workspace_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'skip idx leads_workspace: %', SQLERRM; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(lead_status);
EXCEPTION WHEN others THEN RAISE NOTICE 'skip idx leads_status: %', SQLERRM; END $$;

-- 5. workspace_id on other tables (only if they exist)
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_stages' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE crm_stages ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE';
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip crm_stages.workspace_id: %', SQLERRM; END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_tasks' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE';
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip crm_tasks.workspace_id: %', SQLERRM; END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_calls' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE crm_calls ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE';
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip crm_calls.workspace_id: %', SQLERRM; END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'funnels' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE funnels ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE';
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip funnels.workspace_id: %', SQLERRM; END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_campaigns' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE';
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip email_campaigns.workspace_id: %', SQLERRM; END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bookings' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE';
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip bookings.workspace_id: %', SQLERRM; END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'automations' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE automations ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE';
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip automations.workspace_id: %', SQLERRM; END $$;

-- 6. COMMUNITIES
CREATE TABLE IF NOT EXISTS communities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS communities_workspace_idx ON communities(workspace_id);
EXCEPTION WHEN others THEN RAISE NOTICE 'skip idx communities_workspace: %', SQLERRM; END $$;

-- =============================================================================
-- VERIFY: This SELECT confirms what tables were created successfully
-- =============================================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('workspaces', 'workspace_members', 'workspace_entitlements', 'communities')
ORDER BY table_name;
