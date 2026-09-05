-- =============================================================================
-- PART 2: RLS POLICIES + HELPER FUNCTION
-- Run this AFTER Part 1 succeeds.
-- =============================================================================

-- Enable RLS (our API uses service_role key which bypasses RLS, so no policies needed yet)
ALTER TABLE workspaces             ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities            ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'workspaces_updated_at') THEN
    CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'workspace_members_updated_at') THEN
    CREATE TRIGGER workspace_members_updated_at BEFORE UPDATE ON workspace_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'workspace_entitlements_updated_at') THEN
    CREATE TRIGGER workspace_entitlements_updated_at BEFORE UPDATE ON workspace_entitlements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

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

SELECT 'Part 2 complete' as result;
