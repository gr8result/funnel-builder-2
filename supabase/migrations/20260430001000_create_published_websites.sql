CREATE TABLE IF NOT EXISTS published_websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  primary_domain text NOT NULL UNIQUE,
  custom_domain text UNIQUE,
  domain_status text NOT NULL DEFAULT 'generated',
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  site_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_published_websites_user_id ON published_websites(user_id);
CREATE INDEX IF NOT EXISTS idx_published_websites_project_id ON published_websites(project_id);
CREATE INDEX IF NOT EXISTS idx_published_websites_published ON published_websites(published);

CREATE OR REPLACE FUNCTION set_published_websites_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_published_websites_updated_at ON published_websites;
CREATE TRIGGER trg_published_websites_updated_at
BEFORE UPDATE ON published_websites
FOR EACH ROW
EXECUTE FUNCTION set_published_websites_updated_at();

ALTER TABLE published_websites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'published_websites'
      AND policyname = 'published_websites_owner_all'
  ) THEN
    EXECUTE 'CREATE POLICY published_websites_owner_all ON published_websites USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'published_websites'
      AND policyname = 'published_websites_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY published_websites_public_read ON published_websites FOR SELECT USING (published = true)';
  END IF;
END $$;