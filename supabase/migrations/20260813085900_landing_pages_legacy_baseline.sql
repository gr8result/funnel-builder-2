-- Minimum authoritative legacy baseline required by Landing Pages, funnels,
-- CRM delivery, authentication context, and optional email-list routing.
-- Column shapes are based on the existing development PostgREST schema.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text,
  full_name text,
  business_name text,
  business_logo text,
  business_logo_url text,
  approved boolean default false,
  is_approved boolean default false,
  status text default 'pending',
  subscription_status text default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create table if not exists public.email_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  owner uuid references auth.users(id) on delete set null default auth.uid(),
  list_id uuid references public.email_lists(id) on delete set null,
  affiliate_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  unique (user_id, email)
);

create table if not exists public.list_subscribers (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.email_lists(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (list_id, subscriber_id)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unique (user_id, name)
);

create table if not exists public.subscriber_tags (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (subscriber_id, tag_id)
);

create table if not exists public.funnels (
  id uuid primary key default gen_random_uuid(),
  name text,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  slug text,
  status text not null default 'draft',
  description text,
  notify_email text,
  default_list_id uuid references public.email_lists(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists funnels_slug_unique
  on public.funnels (slug) where slug is not null;

create table if not exists public.funnel_steps (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  title text not null,
  content text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funnel_steps_funnel_order_idx
  on public.funnel_steps (funnel_id, order_index);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  pipeline_id uuid,
  stage text,
  name text,
  email text,
  phone text,
  source text,
  lead_source text,
  tags text,
  notes text,
  avatar_icon text default 'person',
  avatar_color text default '#3b82f6',
  unsubscribed_at timestamptz,
  lead_owner_user_id uuid references auth.users(id) on delete set null,
  lead_status text default 'new',
  assigned_at timestamptz,
  company text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_user_email_idx
  on public.leads (user_id, lower(btrim(email)));

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz default now()
);
create index if not exists lead_notes_lead_created_idx
  on public.lead_notes (lead_id, created_at desc);

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  funnel_id uuid references public.funnels(id) on delete set null,
  step_id uuid references public.funnel_steps(id) on delete set null,
  list_id uuid references public.email_lists(id) on delete set null,
  name text,
  email text,
  payload jsonb default '{}'::jsonb,
  data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
alter table public.email_lists enable row level security;
alter table public.subscribers enable row level security;
alter table public.list_subscribers enable row level security;
alter table public.tags enable row level security;
alter table public.subscriber_tags enable row level security;
alter table public.funnels enable row level security;
alter table public.funnel_steps enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.form_submissions enable row level security;

revoke all on table
  public.accounts, public.email_lists, public.subscribers,
  public.list_subscribers, public.tags, public.subscriber_tags,
  public.funnels, public.funnel_steps, public.leads, public.lead_notes,
  public.form_submissions
from public, anon, authenticated;

grant all on table
  public.accounts, public.email_lists, public.subscribers,
  public.list_subscribers, public.tags, public.subscriber_tags,
  public.funnels, public.funnel_steps, public.leads, public.lead_notes,
  public.form_submissions
to service_role;

grant select, update on public.accounts to authenticated;
grant select, insert, update, delete on
  public.email_lists, public.subscribers, public.list_subscribers,
  public.tags, public.subscriber_tags, public.funnels, public.funnel_steps,
  public.leads
to authenticated;
grant select on public.lead_notes, public.form_submissions to authenticated;

drop policy if exists accounts_read_own on public.accounts;
drop policy if exists accounts_update_own on public.accounts;
drop policy if exists email_lists_owner_access on public.email_lists;
drop policy if exists subscribers_owner_access on public.subscribers;
drop policy if exists list_subscribers_owner_access on public.list_subscribers;
drop policy if exists tags_owner_access on public.tags;
drop policy if exists subscriber_tags_owner_access on public.subscriber_tags;
drop policy if exists funnels_owner_access on public.funnels;
drop policy if exists funnel_steps_owner_access on public.funnel_steps;
drop policy if exists leads_owner_access on public.leads;
drop policy if exists lead_notes_owner_read on public.lead_notes;
drop policy if exists form_submissions_owner_read on public.form_submissions;

create policy accounts_read_own on public.accounts for select to authenticated
  using (user_id = auth.uid());
create policy accounts_update_own on public.accounts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy email_lists_owner_access on public.email_lists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subscribers_owner_access on public.subscribers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy list_subscribers_owner_access on public.list_subscribers for all to authenticated
  using (exists (
    select 1 from public.email_lists l
    where l.id = list_subscribers.list_id and l.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.email_lists l
    where l.id = list_subscribers.list_id and l.user_id = auth.uid()
  ));
create policy tags_owner_access on public.tags for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subscriber_tags_owner_access on public.subscriber_tags for all to authenticated
  using (exists (
    select 1 from public.subscribers s
    where s.id = subscriber_tags.subscriber_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.subscribers s
    where s.id = subscriber_tags.subscriber_id and s.user_id = auth.uid()
  ));

create policy funnels_owner_access on public.funnels for all to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy funnel_steps_owner_access on public.funnel_steps for all to authenticated
  using (exists (
    select 1 from public.funnels f
    where f.id = funnel_steps.funnel_id and f.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.funnels f
    where f.id = funnel_steps.funnel_id and f.owner_user_id = auth.uid()
  ));
create policy leads_owner_access on public.leads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy lead_notes_owner_read on public.lead_notes for select to authenticated
  using (user_id = auth.uid());
create policy form_submissions_owner_read on public.form_submissions for select to authenticated
  using (user_id = auth.uid());
