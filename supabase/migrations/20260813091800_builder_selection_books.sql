-- Client Selections Book storage.
-- Additive only. Stores editable selection-book JSON separately from project selections.

create extension if not exists pgcrypto;

create table if not exists public.builder_selection_books (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  estimate_snapshot_id uuid,
  inclusion_template_id uuid references public.builder_inclusion_templates(id) on delete set null,
  book_name text not null default 'Client Selections Book',
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'ready_to_import', 'imported', 'archived')),
  book_data jsonb not null default '{}'::jsonb,
  imported_at timestamptz,
  imported_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (estimate_snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null
);

create index if not exists builder_selection_books_workspace_idx
  on public.builder_selection_books(workspace_id);

create index if not exists builder_selection_books_project_idx
  on public.builder_selection_books(workspace_id, project_id);

create index if not exists builder_selection_books_snapshot_idx
  on public.builder_selection_books(workspace_id, estimate_snapshot_id);

alter table public.builder_selection_books enable row level security;

drop policy if exists builder_selection_books_select on public.builder_selection_books;
create policy builder_selection_books_select
  on public.builder_selection_books
  for select
  using (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_selection_books_insert on public.builder_selection_books;
create policy builder_selection_books_insert
  on public.builder_selection_books
  for insert
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_selection_books_update on public.builder_selection_books;
create policy builder_selection_books_update
  on public.builder_selection_books
  for update
  using (public.builder_commercial_is_workspace_member(workspace_id))
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_selection_books_delete on public.builder_selection_books;
create policy builder_selection_books_delete
  on public.builder_selection_books
  for delete
  using (public.builder_commercial_is_workspace_member(workspace_id));
