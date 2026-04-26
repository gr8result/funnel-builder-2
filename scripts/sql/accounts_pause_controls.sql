BEGIN;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_reason text;

-- Optional hardening for known lifecycle values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_status_allowed_values'
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_status_allowed_values
      CHECK (status IS NULL OR status IN ('pending', 'approved', 'paused', 'denied', 'deleted'));
  END IF;
END $$;

COMMIT;
