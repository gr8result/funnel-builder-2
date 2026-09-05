create table if not exists public.website_subscribers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  workspace_id uuid null,
  website_id uuid not null,
  project_id text null,
  email text not null,
  source text not null default 'Website Footer',
  page_url text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_subscribers_status_check check (status in ('active', 'unsubscribed', 'bounced'))
);

create unique index if not exists website_subscribers_active_email_idx
  on public.website_subscribers (website_id, lower(email))
  where status = 'active';

create index if not exists website_subscribers_account_idx
  on public.website_subscribers (account_id, created_at desc);

create index if not exists website_subscribers_project_idx
  on public.website_subscribers (project_id, created_at desc);
