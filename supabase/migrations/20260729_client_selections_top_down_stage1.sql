-- Stage 1 rebuild for Client Selections.
-- Non-destructive: preserves existing builder_client_selections and shared product,
-- estimate, quotation, pricing, supplier and media records.

create table if not exists public.builder_client_selection_legacy_backups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid,
  selection_id uuid,
  source_table text not null default 'builder_client_selections',
  record jsonb not null,
  backed_up_at timestamptz not null default now()
);

insert into public.builder_client_selection_legacy_backups (
  workspace_id,
  project_id,
  selection_id,
  record
)
select
  workspace_id,
  project_id,
  id,
  to_jsonb(builder_client_selections)
from public.builder_client_selections
where not exists (
  select 1
  from public.builder_client_selection_legacy_backups backup
  where backup.selection_id = builder_client_selections.id
);

create table if not exists public.builder_project_areas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  name text not null,
  area_type text not null,
  floor_level text not null default 'Ground floor',
  quantity integer not null default 1,
  display_order integer not null default 0,
  active boolean not null default true,
  included_in_project boolean not null default true,
  required boolean not null default true,
  group_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.builder_room_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  name text not null,
  group_type text not null,
  member_room_ids uuid[] not null default '{}',
  shared_selections jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.builder_project_areas
  drop constraint if exists builder_project_areas_group_id_fkey;

alter table public.builder_project_areas
  add constraint builder_project_areas_group_id_fkey
  foreign key (group_id) references public.builder_room_groups(id) on delete set null;

create table if not exists public.builder_area_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  name text not null,
  area_type text not null,
  pricing_tier text not null check (pricing_tier in ('Premium', 'Premier', 'Classic', 'Custom')),
  version integer not null default 1,
  categories jsonb not null default '[]'::jsonb,
  default_products jsonb not null default '{}'::jsonb,
  required_status jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.builder_template_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  project_area_id uuid references public.builder_project_areas(id) on delete cascade,
  room_group_id uuid references public.builder_room_groups(id) on delete cascade,
  template_id uuid references public.builder_area_templates(id) on delete set null,
  template_version integer not null default 1,
  applied_by uuid,
  applied_at timestamptz not null default now(),
  room_overrides jsonb not null default '{}'::jsonb,
  group_overrides jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.builder_selection_categories_stage1 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  name text not null,
  applicable_area_types text[] not null default '{}',
  applicable_groups text[] not null default '{}',
  selection_control_type text not null default 'text',
  required boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.builder_group_selections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  group_id uuid not null references public.builder_room_groups(id) on delete cascade,
  category_id uuid,
  category_key text not null,
  product_id uuid,
  value jsonb not null default '{}'::jsonb,
  colour text,
  finish text,
  price_effect numeric not null default 0,
  inherited_by_rooms uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.builder_room_selection_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  project_area_id uuid not null references public.builder_project_areas(id) on delete cascade,
  category_id uuid,
  category_key text not null,
  override_value jsonb not null default '{}'::jsonb,
  original_group_value jsonb not null default '{}'::jsonb,
  reason text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create table if not exists public.builder_project_selection_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  snapshot_version integer not null default 1,
  status text not null default 'draft',
  snapshot jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists builder_project_areas_project_idx
  on public.builder_project_areas(workspace_id, project_id, floor_level, display_order);

create index if not exists builder_room_groups_project_idx
  on public.builder_room_groups(workspace_id, project_id);

create index if not exists builder_group_selections_group_idx
  on public.builder_group_selections(workspace_id, project_id, group_id);

create index if not exists builder_room_selection_overrides_room_idx
  on public.builder_room_selection_overrides(workspace_id, project_id, project_area_id);

create index if not exists builder_project_selection_snapshots_project_idx
  on public.builder_project_selection_snapshots(workspace_id, project_id, snapshot_version);
