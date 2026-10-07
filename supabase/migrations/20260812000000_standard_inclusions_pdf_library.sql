create table if not exists public.standard_inclusions_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  tier_key text,
  display_order integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  current_version_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.standard_inclusions_schedule_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  schedule_id uuid not null references public.standard_inclusions_schedules(id) on delete cascade,
  version_number integer not null,
  storage_bucket text not null default 'assets',
  storage_path text not null,
  public_url text,
  original_filename text not null,
  page_count integer not null default 0,
  file_size_bytes bigint,
  file_hash text,
  source text not null default 'pdf-upload',
  status text not null default 'active'
    check (status in ('active', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (schedule_id, version_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'standard_inclusions_schedules_current_version_fkey'
  ) then
    alter table public.standard_inclusions_schedules
      add constraint standard_inclusions_schedules_current_version_fkey
      foreign key (current_version_id)
      references public.standard_inclusions_schedule_versions(id)
      on delete set null;
  end if;
end $$;

create index if not exists standard_inclusions_schedules_workspace_idx
  on public.standard_inclusions_schedules (workspace_id, status, updated_at desc);

create index if not exists standard_inclusions_versions_schedule_idx
  on public.standard_inclusions_schedule_versions (workspace_id, schedule_id, version_number desc);

alter table public.standard_inclusions_schedules enable row level security;
alter table public.standard_inclusions_schedule_versions enable row level security;

drop policy if exists standard_inclusions_schedules_workspace_members_select on public.standard_inclusions_schedules;
create policy standard_inclusions_schedules_workspace_members_select
  on public.standard_inclusions_schedules
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = standard_inclusions_schedules.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

drop policy if exists standard_inclusions_versions_workspace_members_select on public.standard_inclusions_schedule_versions;
create policy standard_inclusions_versions_workspace_members_select
  on public.standard_inclusions_schedule_versions
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = standard_inclusions_schedule_versions.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );
