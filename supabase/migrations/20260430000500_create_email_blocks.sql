-- Create email_blocks table for user-saved custom email blocks
-- Users can save reusable HTML sections from the email editor

CREATE TABLE IF NOT EXISTS email_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast per-user lookups (newest first)
CREATE INDEX IF NOT EXISTS idx_email_blocks_user_created
  ON email_blocks(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE email_blocks ENABLE ROW LEVEL SECURITY;

-- Users can only see, insert, update, and delete their own blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_blocks' AND policyname = 'email_blocks: user select own'
  ) THEN
    EXECUTE 'CREATE POLICY "email_blocks: user select own" ON email_blocks FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_blocks' AND policyname = 'email_blocks: user insert own'
  ) THEN
    EXECUTE 'CREATE POLICY "email_blocks: user insert own" ON email_blocks FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_blocks' AND policyname = 'email_blocks: user update own'
  ) THEN
    EXECUTE 'CREATE POLICY "email_blocks: user update own" ON email_blocks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_blocks' AND policyname = 'email_blocks: user delete own'
  ) THEN
    EXECUTE 'CREATE POLICY "email_blocks: user delete own" ON email_blocks FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;
