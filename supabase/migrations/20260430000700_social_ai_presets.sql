-- 006_social_ai_presets.sql
-- Stores per-user AI content generation presets (topic, style, platforms, etc.)
-- so they sync across devices instead of being localStorage-only.

CREATE TABLE IF NOT EXISTS social_ai_presets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce unique preset names per user (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS social_ai_presets_user_name_idx
  ON social_ai_presets (user_id, lower(name));

ALTER TABLE social_ai_presets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'social_ai_presets' AND policyname = 'Users can manage their own AI presets'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can manage their own AI presets" ON social_ai_presets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;
