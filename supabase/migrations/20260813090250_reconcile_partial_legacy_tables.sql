-- Reconcile legacy tables that already exist in production with partial schemas.
-- Additive only; keeps existing rows and avoids replay conflicts when later
-- historical migrations create indexes/policies against these columns.

alter table if exists public.website_page_views
  add column if not exists viewed_at timestamptz not null default now();

alter table if exists public.communities
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists communities_workspace_idx
  on public.communities(workspace_id);
