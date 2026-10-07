-- Project Estimate multi-user page builder — persistence foundation.
-- Additive only. Mirrors the website_builder_* durable-page pattern
-- (20260622_website_builder_durable_pages.sql) and the workspace RLS
-- pattern already used by builder_commercial_projects / builder_estimate_snapshots
-- (20260705_estimate_builder_commercial_backbone_stage1.sql).
--
-- Native page elements are stored as a `blocks jsonb` array per page row
-- (not one row per element) so the existing render/edit/undo/PDF-export
-- pipeline in EstimateBuilderWorkbook.js / project-estimate/** can consume
-- them unchanged. A NULL `blocks` value on a page row means "use the
-- compiled-in defaults from ProjectEstimateRegistry for this page" — this
-- is how the system-default template stays permanently in sync with the
-- approved template defined in code, without duplicating that content here.

create extension if not exists pgcrypto;

create or replace function public.estimate_builder_is_workspace_member(p_workspace_id uuid)
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
  );
$$;

create or replace function public.estimate_builder_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── estimate_templates ──────────────────────────────────────────────────────
create table if not exists public.estimate_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  template_name text not null,
  description text not null default '',
  is_system_default boolean not null default false,
  is_organisation_default boolean not null default false,
  page_order jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  source_template_id uuid references public.estimate_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_templates_system_default_no_workspace
    check (not is_system_default or workspace_id is null)
);

create index if not exists estimate_templates_workspace_idx
  on public.estimate_templates(workspace_id);

create unique index if not exists estimate_templates_one_org_default_idx
  on public.estimate_templates(workspace_id)
  where is_organisation_default = true;

drop trigger if exists trg_estimate_templates_updated_at on public.estimate_templates;
create trigger trg_estimate_templates_updated_at
before update on public.estimate_templates
for each row execute function public.estimate_builder_set_updated_at();

-- ── estimate_template_pages ─────────────────────────────────────────────────
create table if not exists public.estimate_template_pages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.estimate_templates(id) on delete cascade,
  page_key text not null,
  page_name text not null,
  page_type text not null,
  page_order integer not null default 0,
  width integer not null default 794,
  height integer not null default 1123,
  orientation text not null default 'portrait' check (orientation in ('portrait', 'landscape')),
  background jsonb not null default '{}'::jsonb,
  imported_document jsonb,
  blocks jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, page_key)
);

create index if not exists estimate_template_pages_template_order_idx
  on public.estimate_template_pages(template_id, page_order);

drop trigger if exists trg_estimate_template_pages_updated_at on public.estimate_template_pages;
create trigger trg_estimate_template_pages_updated_at
before update on public.estimate_template_pages
for each row execute function public.estimate_builder_set_updated_at();

-- ── estimate_template_versions ──────────────────────────────────────────────
create table if not exists public.estimate_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.estimate_templates(id) on delete cascade,
  version_number integer not null,
  label text not null default '',
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

create index if not exists estimate_template_versions_template_idx
  on public.estimate_template_versions(template_id, created_at desc);

-- ── project_estimate_instances ──────────────────────────────────────────────
create table if not exists public.project_estimate_instances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- Text, not uuid: this is often a legacy per-job identifier
  -- (sheet.workbook.id / jobId) rather than a real builder_commercial_projects
  -- row, since commercial-project linkage is optional/additive.
  project_id text,
  template_id uuid references public.estimate_templates(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  page_order jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_estimate_instances_workspace_idx
  on public.project_estimate_instances(workspace_id);

create unique index if not exists project_estimate_instances_project_idx
  on public.project_estimate_instances(workspace_id, project_id)
  where project_id is not null;

drop trigger if exists trg_project_estimate_instances_updated_at on public.project_estimate_instances;
create trigger trg_project_estimate_instances_updated_at
before update on public.project_estimate_instances
for each row execute function public.estimate_builder_set_updated_at();

-- ── project_estimate_instance_pages ─────────────────────────────────────────
create table if not exists public.project_estimate_instance_pages (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.project_estimate_instances(id) on delete cascade,
  page_key text not null,
  page_name text not null,
  page_type text not null,
  page_order integer not null default 0,
  width integer not null default 794,
  height integer not null default 1123,
  orientation text not null default 'portrait' check (orientation in ('portrait', 'landscape')),
  background jsonb not null default '{}'::jsonb,
  imported_document jsonb,
  blocks jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, page_key)
);

create index if not exists project_estimate_instance_pages_instance_order_idx
  on public.project_estimate_instance_pages(instance_id, page_order);

drop trigger if exists trg_project_estimate_instance_pages_updated_at on public.project_estimate_instance_pages;
create trigger trg_project_estimate_instance_pages_updated_at
before update on public.project_estimate_instance_pages
for each row execute function public.estimate_builder_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.estimate_templates enable row level security;
alter table public.estimate_template_pages enable row level security;
alter table public.estimate_template_versions enable row level security;
alter table public.project_estimate_instances enable row level security;
alter table public.project_estimate_instance_pages enable row level security;

do $$
begin
  -- Any authenticated user may read the system default template + its pages;
  -- otherwise scoped to workspace membership. System-default rows can never
  -- be inserted/updated/deleted through RLS — only via a direct migration.
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'estimate_templates' and policyname = 'estimate_templates_select'
  ) then
    create policy estimate_templates_select on public.estimate_templates
      for select
      using (is_system_default = true or public.estimate_builder_is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'estimate_templates' and policyname = 'estimate_templates_insert'
  ) then
    create policy estimate_templates_insert on public.estimate_templates
      for insert
      with check (is_system_default = false and public.estimate_builder_is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'estimate_templates' and policyname = 'estimate_templates_update'
  ) then
    create policy estimate_templates_update on public.estimate_templates
      for update
      using (is_system_default = false and public.estimate_builder_is_workspace_member(workspace_id))
      with check (is_system_default = false and public.estimate_builder_is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'estimate_templates' and policyname = 'estimate_templates_delete'
  ) then
    create policy estimate_templates_delete on public.estimate_templates
      for delete
      using (is_system_default = false and public.estimate_builder_is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'estimate_template_pages' and policyname = 'estimate_template_pages_select'
  ) then
    create policy estimate_template_pages_select on public.estimate_template_pages
      for select
      using (exists (
        select 1 from public.estimate_templates t
        where t.id = template_id
          and (t.is_system_default = true or public.estimate_builder_is_workspace_member(t.workspace_id))
      ));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'estimate_template_pages' and policyname = 'estimate_template_pages_write'
  ) then
    create policy estimate_template_pages_write on public.estimate_template_pages
      for all
      using (exists (
        select 1 from public.estimate_templates t
        where t.id = template_id and t.is_system_default = false and public.estimate_builder_is_workspace_member(t.workspace_id)
      ))
      with check (exists (
        select 1 from public.estimate_templates t
        where t.id = template_id and t.is_system_default = false and public.estimate_builder_is_workspace_member(t.workspace_id)
      ));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'estimate_template_versions' and policyname = 'estimate_template_versions_all'
  ) then
    create policy estimate_template_versions_all on public.estimate_template_versions
      for all
      using (exists (
        select 1 from public.estimate_templates t
        where t.id = template_id
          and (t.is_system_default = true or public.estimate_builder_is_workspace_member(t.workspace_id))
      ))
      with check (exists (
        select 1 from public.estimate_templates t
        where t.id = template_id and t.is_system_default = false and public.estimate_builder_is_workspace_member(t.workspace_id)
      ));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'project_estimate_instances' and policyname = 'project_estimate_instances_all'
  ) then
    create policy project_estimate_instances_all on public.project_estimate_instances
      for all
      using (public.estimate_builder_is_workspace_member(workspace_id))
      with check (public.estimate_builder_is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'project_estimate_instance_pages' and policyname = 'project_estimate_instance_pages_all'
  ) then
    create policy project_estimate_instance_pages_all on public.project_estimate_instance_pages
      for all
      using (exists (
        select 1 from public.project_estimate_instances i
        where i.id = instance_id and public.estimate_builder_is_workspace_member(i.workspace_id)
      ))
      with check (exists (
        select 1 from public.project_estimate_instances i
        where i.id = instance_id and public.estimate_builder_is_workspace_member(i.workspace_id)
      ));
  end if;
end $$;

grant all on table public.estimate_templates to service_role;
grant all on table public.estimate_template_pages to service_role;
grant all on table public.estimate_template_versions to service_role;
grant all on table public.project_estimate_instances to service_role;
grant all on table public.project_estimate_instance_pages to service_role;

grant select, insert, update, delete on table public.estimate_templates to authenticated;
grant select, insert, update, delete on table public.estimate_template_pages to authenticated;
grant select, insert, update, delete on table public.estimate_template_versions to authenticated;
grant select, insert, update, delete on table public.project_estimate_instances to authenticated;
grant select, insert, update, delete on table public.project_estimate_instance_pages to authenticated;

-- ── Seed: system default template ("approved-project-estimate") ────────────
-- Page rows carry blocks = NULL, meaning "resolve from the compiled
-- ProjectEstimateRegistry defaults for this page_type at render time" —
-- this is what keeps the system default permanently identical to the
-- approved template in code with no risk of the seed drifting stale.
do $$
declare
  v_template_id uuid;
begin
  select id into v_template_id from public.estimate_templates where is_system_default = true limit 1;

  if v_template_id is null then
    insert into public.estimate_templates (
      workspace_id, owner_user_id, template_name, description,
      is_system_default, is_organisation_default, page_order, settings, version
    ) values (
      null, null, 'Approved Project Estimate', 'Protected system default Project Estimate template.',
      true, false,
      '["cover","estimateSummary","about","standardInclusions","pricedPlans","pricingSummary","importantEstimateNotice","acceptance"]'::jsonb,
      '{}'::jsonb, 1
    ) returning id into v_template_id;

    insert into public.estimate_template_pages
      (template_id, page_key, page_name, page_type, page_order, width, height, orientation, background, blocks)
    values
      (v_template_id, 'cover', 'Cover', 'cover', 0, 794, 1123, 'portrait', '{}'::jsonb, null),
      (v_template_id, 'estimateSummary', 'Estimate Summary', 'estimateSummary', 1, 794, 1123, 'portrait', '{}'::jsonb, null),
      (v_template_id, 'about', 'About Us', 'about', 2, 794, 1123, 'portrait', '{}'::jsonb, null),
      (v_template_id, 'standardInclusions', 'Standard Inclusions Schedule', 'standardInclusions', 3, 794, 1123, 'portrait', '{}'::jsonb, null),
      (v_template_id, 'pricedPlans', 'Plans', 'pricedPlans', 4, 794, 1123, 'portrait', '{}'::jsonb, null),
      (v_template_id, 'pricingSummary', 'Pricing', 'pricingSummary', 5, 794, 1123, 'portrait', '{}'::jsonb, null),
      (v_template_id, 'importantEstimateNotice', 'Important Estimate Notice', 'importantEstimateNotice', 6, 794, 1123, 'portrait', '{}'::jsonb, null),
      (v_template_id, 'acceptance', 'Acceptance', 'acceptance', 7, 794, 1123, 'portrait', '{}'::jsonb, null);
  end if;
end $$;
