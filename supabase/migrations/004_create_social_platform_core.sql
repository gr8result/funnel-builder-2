-- Core schema for social module OAuth, publishing queue, and campaigns.

create extension if not exists pgcrypto;

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform text not null,
  content text not null,
  media_url text,
  status text not null default 'draft',
  platform_post_id text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists social_posts add column if not exists media_url text;
alter table if exists social_posts add column if not exists status text default 'draft';
alter table if exists social_posts add column if not exists platform_post_id text;
alter table if exists social_posts add column if not exists published_at timestamptz;
alter table if exists social_posts add column if not exists created_at timestamptz default now();
alter table if exists social_posts add column if not exists updated_at timestamptz default now();

create index if not exists idx_social_posts_user_created on social_posts (user_id, created_at desc);
create index if not exists idx_social_posts_user_platform on social_posts (user_id, platform);

create table if not exists social_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  post_id uuid not null references social_posts(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists social_schedule add column if not exists status text default 'scheduled';
alter table if exists social_schedule add column if not exists processed_at timestamptz;
alter table if exists social_schedule add column if not exists created_at timestamptz default now();
alter table if exists social_schedule add column if not exists updated_at timestamptz default now();

create index if not exists idx_social_schedule_due on social_schedule (status, scheduled_for);

create table if not exists social_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  post_id uuid not null references social_posts(id) on delete cascade,
  platform text,
  scheduled_for timestamptz,
  status text not null default 'queued',
  priority int not null default 1,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists social_queue add column if not exists platform text;
alter table if exists social_queue add column if not exists scheduled_for timestamptz;
alter table if exists social_queue add column if not exists status text default 'queued';
alter table if exists social_queue add column if not exists priority int default 1;
alter table if exists social_queue add column if not exists processed_at timestamptz;
alter table if exists social_queue add column if not exists last_error text;
alter table if exists social_queue add column if not exists created_at timestamptz default now();
alter table if exists social_queue add column if not exists updated_at timestamptz default now();

create index if not exists idx_social_queue_pick on social_queue (status, scheduled_for, priority desc, created_at asc);

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform text not null,
  account_id text not null,
  account_name text,
  access_token text,
  token_expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, account_id)
);

alter table if exists social_accounts add column if not exists account_name text;
alter table if exists social_accounts add column if not exists access_token text;
alter table if exists social_accounts add column if not exists token_expires_at timestamptz;
alter table if exists social_accounts add column if not exists is_active boolean default true;
alter table if exists social_accounts add column if not exists created_at timestamptz default now();
alter table if exists social_accounts add column if not exists updated_at timestamptz default now();

create index if not exists idx_social_accounts_user_platform on social_accounts (user_id, platform, updated_at desc);

create table if not exists social_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  platform text not null,
  encrypted_refresh_token text not null,
  refresh_token_iv text not null,
  refresh_token_tag text not null,
  refresh_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, social_account_id)
);

alter table if exists social_oauth_tokens add column if not exists refresh_expires_at timestamptz;
alter table if exists social_oauth_tokens add column if not exists created_at timestamptz default now();
alter table if exists social_oauth_tokens add column if not exists updated_at timestamptz default now();

create table if not exists social_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  user_id uuid not null,
  platform text not null,
  redirect_path text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table if exists social_oauth_states add column if not exists redirect_path text;
alter table if exists social_oauth_states add column if not exists used_at timestamptz;
alter table if exists social_oauth_states add column if not exists created_at timestamptz default now();
alter table if exists social_oauth_states add column if not exists code_verifier text;

create index if not exists idx_social_oauth_states_lookup on social_oauth_states (state, platform, expires_at);

create table if not exists social_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists social_campaigns add column if not exists description text;
alter table if exists social_campaigns add column if not exists created_at timestamptz default now();
alter table if exists social_campaigns add column if not exists updated_at timestamptz default now();

create table if not exists social_campaign_posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references social_campaigns(id) on delete cascade,
  post_id uuid not null references social_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (campaign_id, post_id)
);

alter table if exists social_campaign_posts add column if not exists created_at timestamptz default now();
