-- Migration 0051: Per-user social platform app credentials
-- Each user stores their own app_id + encrypted secret per platform.
-- Run in Supabase SQL editor.

create table if not exists social_app_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform text not null,
  app_id text not null default '',
  encrypted_secret text,
  secret_iv text,
  secret_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

create index if not exists idx_social_app_creds_user_platform
  on social_app_credentials (user_id, platform);