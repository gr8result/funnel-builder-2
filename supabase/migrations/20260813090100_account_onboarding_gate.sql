alter table if exists public.accounts
  add column if not exists phone text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists email_verified boolean not null default false,
  add column if not exists email_verified_at timestamptz,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists selected_plan text,
  add column if not exists dkim_domain text,
  add column if not exists dkim_verified boolean not null default false,
  add column if not exists sender_id text,
  add column if not exists sms_api_key text,
  add column if not exists sms_api_secret text,
  add column if not exists sms_activated boolean not null default false,
  add column if not exists phone_otp_pending text,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists accounts_user_id_unique on public.accounts(user_id);
