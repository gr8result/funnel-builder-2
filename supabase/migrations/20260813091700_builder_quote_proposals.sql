-- Additive quote proposal builder storage.
-- Stores editable proposal pages as structured JSON without modifying estimate workbooks or pricing data.

create extension if not exists pgcrypto;

create table if not exists public.builder_quote_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.builder_commercial_projects(id) on delete set null,
  estimate_snapshot_id uuid references public.builder_estimate_snapshots(id) on delete set null,
  proposal_name text not null default 'Quote Proposal',
  status text not null default 'draft'
    check (status in ('draft', 'preview', 'approved', 'archived')),
  pages jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create index if not exists builder_quote_proposals_workspace_idx
  on public.builder_quote_proposals(workspace_id);

create index if not exists builder_quote_proposals_project_idx
  on public.builder_quote_proposals(workspace_id, project_id);

create index if not exists builder_quote_proposals_snapshot_idx
  on public.builder_quote_proposals(workspace_id, estimate_snapshot_id);

alter table public.builder_quote_proposals enable row level security;

drop policy if exists builder_quote_proposals_select on public.builder_quote_proposals;
create policy builder_quote_proposals_select
  on public.builder_quote_proposals
  for select
  using (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_quote_proposals_insert on public.builder_quote_proposals;
create policy builder_quote_proposals_insert
  on public.builder_quote_proposals
  for insert
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_quote_proposals_update on public.builder_quote_proposals;
create policy builder_quote_proposals_update
  on public.builder_quote_proposals
  for update
  using (public.builder_commercial_is_workspace_member(workspace_id))
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_quote_proposals_delete on public.builder_quote_proposals;
create policy builder_quote_proposals_delete
  on public.builder_quote_proposals
  for delete
  using (public.builder_commercial_is_workspace_member(workspace_id));

grant select, insert, update, delete on public.builder_quote_proposals to authenticated;
grant select, insert, update, delete on public.builder_quote_proposals to service_role;
