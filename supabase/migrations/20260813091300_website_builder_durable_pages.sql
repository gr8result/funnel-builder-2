create extension if not exists pgcrypto;

create table if not exists public.website_builder_sites (
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id text not null,
  name text not null default 'Untitled Website',
  site_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, site_id)
);

create table if not exists public.website_builder_pages (
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id text not null,
  page_id text not null,
  name text not null,
  slug text not null,
  page_order integer not null default 0,
  page_data jsonb not null default '{}'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  chai_data jsonb,
  html text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, site_id, page_id),
  foreign key (user_id, site_id) references public.website_builder_sites(user_id, site_id) on delete cascade
);

create table if not exists public.website_builder_page_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id text not null,
  page_id text not null,
  page_name text not null,
  page_slug text not null,
  source text not null default 'save',
  reason text not null default '',
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists website_builder_pages_user_site_slug_idx
  on public.website_builder_pages(user_id, site_id, slug);

create index if not exists website_builder_pages_user_site_order_idx
  on public.website_builder_pages(user_id, site_id, page_order);

create index if not exists website_builder_page_versions_lookup_idx
  on public.website_builder_page_versions(user_id, site_id, page_id, created_at desc);

create or replace function public.set_website_builder_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_website_builder_sites_updated_at on public.website_builder_sites;
create trigger trg_website_builder_sites_updated_at
before update on public.website_builder_sites
for each row execute function public.set_website_builder_updated_at();

drop trigger if exists trg_website_builder_pages_updated_at on public.website_builder_pages;
create trigger trg_website_builder_pages_updated_at
before update on public.website_builder_pages
for each row execute function public.set_website_builder_updated_at();

alter table public.website_builder_sites enable row level security;
alter table public.website_builder_pages enable row level security;
alter table public.website_builder_page_versions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'website_builder_sites' and policyname = 'website_builder_sites_owner_all'
  ) then
    create policy website_builder_sites_owner_all
      on public.website_builder_sites
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'website_builder_pages' and policyname = 'website_builder_pages_owner_all'
  ) then
    create policy website_builder_pages_owner_all
      on public.website_builder_pages
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'website_builder_page_versions' and policyname = 'website_builder_page_versions_owner_all'
  ) then
    create policy website_builder_page_versions_owner_all
      on public.website_builder_page_versions
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

grant all on table public.website_builder_sites to service_role;
grant all on table public.website_builder_pages to service_role;
grant all on table public.website_builder_page_versions to service_role;
grant select, insert, update, delete on table public.website_builder_sites to authenticated;
grant select, insert, update, delete on table public.website_builder_pages to authenticated;
grant select, insert on table public.website_builder_page_versions to authenticated;
