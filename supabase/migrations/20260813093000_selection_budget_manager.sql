-- Selections Budget Manager.
-- Extends the existing client selections workflow with persisted budget sessions,
-- detailed selectable product fields, role-safe summaries and audit history.

create extension if not exists pgcrypto;

create or replace function public.builder_selection_is_internal_role(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and coalesce(wm.status, 'active') = 'active'
      and coalesce(wm.role, '') in ('owner', 'admin', 'builder_admin', 'builder_staff', 'interior_designer')
  );
$$;

create or replace function public.builder_selection_can_edit_private_budget(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and coalesce(wm.status, 'active') = 'active'
      and coalesce(wm.role, '') in ('owner', 'admin', 'builder_admin', 'builder_staff')
  );
$$;

alter table public.builder_client_selections
  add column if not exists session_id uuid,
  add column if not exists subcategory text,
  add column if not exists room text,
  add column if not exists supplier text,
  add column if not exists brand text,
  add column if not exists product_name text,
  add column if not exists model_number text,
  add column if not exists supplier_sku text,
  add column if not exists manufacturer_sku text,
  add column if not exists image_url text,
  add column if not exists specification_url text,
  add column if not exists installation_guide_url text,
  add column if not exists warranty_url text,
  add column if not exists finish text,
  add column if not exists colour text,
  add column if not exists included_allowance numeric(14, 2) not null default 0,
  add column if not exists supplier_cost numeric(14, 2) not null default 0,
  add column if not exists builder_cost numeric(14, 2) not null default 0,
  add column if not exists installation_cost numeric(14, 2) not null default 0,
  add column if not exists builder_markup_percent numeric(8, 4) not null default 0,
  add column if not exists fixed_builder_markup numeric(14, 2) not null default 0,
  add column if not exists gst_rate numeric(8, 4) not null default 10,
  add column if not exists calculated_client_selection_price numeric(14, 2) not null default 0,
  add column if not exists manual_override_price numeric(14, 2),
  add column if not exists has_manual_override boolean not null default false,
  add column if not exists client_selection_price numeric(14, 2) not null default 0,
  add column if not exists variation_amount numeric(14, 2) not null default 0,
  add column if not exists selection_status text not null default 'not_selected',
  add column if not exists is_included_selection boolean not null default false,
  add column if not exists is_active boolean not null default true;

alter table public.builder_client_selections
  drop constraint if exists builder_client_selections_status_check;

alter table public.builder_client_selections
  add constraint builder_client_selections_status_check
  check (status in ('pending', 'selected', 'approved', 'declined', 'changed', 'cancelled', 'not_selected', 'replaced', 'removed'));

alter table public.builder_client_selections
  drop constraint if exists builder_client_selections_selection_status_check;

alter table public.builder_client_selections
  add constraint builder_client_selections_selection_status_check
  check (selection_status in ('not_selected', 'selected', 'replaced', 'removed', 'approved'));

create table if not exists public.builder_selection_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid,
  session_name text not null default 'Client Selections',
  original_estimate_total numeric(14, 2) not null default 0,
  private_upgrade_ceiling numeric(14, 2) not null default 0,
  current_net_selection_variation numeric(14, 2) not null default 0,
  current_updated_estimate_total numeric(14, 2) not null default 0,
  warning_threshold_percent numeric(8, 4) not null default 80,
  selection_budget_status text not null default 'within_budget'
    check (selection_budget_status in ('within_budget', 'approaching_limit', 'limit_reached', 'over_limit')),
  status text not null default 'active'
    check (status in ('draft', 'active', 'summary_ready', 'variation_created', 'archived')),
  variation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, project_id, snapshot_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null,
  foreign key (variation_id, workspace_id)
    references public.builder_variations(id, workspace_id) on delete set null
);

create table if not exists public.builder_selection_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  session_id uuid not null,
  category text not null,
  original_allowance numeric(14, 2) not null default 0,
  selected_value numeric(14, 2) not null default 0,
  net_difference numeric(14, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, session_id, category),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (session_id, workspace_id)
    references public.builder_selection_sessions(id, workspace_id) on delete cascade
);

create table if not exists public.builder_selection_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  session_id uuid,
  selection_id uuid,
  previous_selection_id uuid,
  replacement_selection_id uuid,
  action text not null,
  user_id uuid references auth.users(id) on delete set null,
  user_role text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  previous_variation numeric(14, 2),
  new_variation numeric(14, 2),
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (session_id, workspace_id)
    references public.builder_selection_sessions(id, workspace_id) on delete set null,
  foreign key (selection_id, workspace_id)
    references public.builder_client_selections(id, workspace_id) on delete set null,
  foreign key (previous_selection_id, workspace_id)
    references public.builder_client_selections(id, workspace_id) on delete set null,
  foreign key (replacement_selection_id, workspace_id)
    references public.builder_client_selections(id, workspace_id) on delete set null
);

create table if not exists public.builder_selection_budget_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  session_id uuid,
  private_upgrade_ceiling numeric(14, 2) not null default 0,
  warning_threshold_percent numeric(8, 4) not null default 80,
  category_markup_overrides jsonb not null default '{}'::jsonb,
  default_builder_markup_percent numeric(8, 4) not null default 0,
  default_gst_rate numeric(8, 4) not null default 10,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, project_id, session_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (session_id, workspace_id)
    references public.builder_selection_sessions(id, workspace_id) on delete cascade
);

alter table public.builder_client_selections
  drop constraint if exists builder_client_selections_session_id_workspace_fkey;

alter table public.builder_client_selections
  add constraint builder_client_selections_session_id_workspace_fkey
  foreign key (session_id, workspace_id)
  references public.builder_selection_sessions(id, workspace_id) on delete set null;

create or replace view public.builder_selection_items as
select * from public.builder_client_selections;

create index if not exists builder_client_selections_session_idx
  on public.builder_client_selections(workspace_id, session_id);

create index if not exists builder_selection_sessions_workspace_idx
  on public.builder_selection_sessions(workspace_id);

create index if not exists builder_selection_sessions_project_idx
  on public.builder_selection_sessions(workspace_id, project_id);

create index if not exists builder_selection_categories_session_idx
  on public.builder_selection_categories(workspace_id, session_id);

create index if not exists builder_selection_history_session_idx
  on public.builder_selection_history(workspace_id, session_id);

create index if not exists builder_selection_budget_settings_project_idx
  on public.builder_selection_budget_settings(workspace_id, project_id);

alter table public.builder_selection_sessions enable row level security;
alter table public.builder_selection_categories enable row level security;
alter table public.builder_selection_history enable row level security;
alter table public.builder_selection_budget_settings enable row level security;

drop policy if exists builder_selection_sessions_select on public.builder_selection_sessions;
create policy builder_selection_sessions_select on public.builder_selection_sessions
  for select using (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_selection_sessions_insert on public.builder_selection_sessions;
create policy builder_selection_sessions_insert on public.builder_selection_sessions
  for insert with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_selection_sessions_update on public.builder_selection_sessions;
create policy builder_selection_sessions_update on public.builder_selection_sessions
  for update using (public.builder_commercial_is_workspace_member(workspace_id))
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_selection_categories_all on public.builder_selection_categories;
create policy builder_selection_categories_all on public.builder_selection_categories
  for all using (public.builder_selection_is_internal_role(workspace_id))
  with check (public.builder_selection_is_internal_role(workspace_id));

drop policy if exists builder_selection_history_all on public.builder_selection_history;
create policy builder_selection_history_all on public.builder_selection_history
  for all using (public.builder_selection_is_internal_role(workspace_id))
  with check (public.builder_selection_is_internal_role(workspace_id));

drop policy if exists builder_selection_budget_settings_all on public.builder_selection_budget_settings;
drop policy if exists builder_selection_budget_settings_select on public.builder_selection_budget_settings;
create policy builder_selection_budget_settings_select on public.builder_selection_budget_settings
  for select using (public.builder_selection_is_internal_role(workspace_id));

drop policy if exists builder_selection_budget_settings_insert on public.builder_selection_budget_settings;
create policy builder_selection_budget_settings_insert on public.builder_selection_budget_settings
  for insert with check (public.builder_selection_can_edit_private_budget(workspace_id));

drop policy if exists builder_selection_budget_settings_update on public.builder_selection_budget_settings;
create policy builder_selection_budget_settings_update on public.builder_selection_budget_settings
  for update using (public.builder_selection_can_edit_private_budget(workspace_id))
  with check (public.builder_selection_can_edit_private_budget(workspace_id));
