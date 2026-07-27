-- Versioned system-base Standard Inclusions Schedule template store.
-- Additive only — does not touch standard_inclusions_documents (PPTX/ONLYOFFICE),
-- Client Selections, Estimate Builder, or any other table.
--
-- The Document Engine's system-base template previously lived only as a static
-- bundled JSON file (standard-inclusions/premier-inclusions-template.full.json),
-- cloned per-builder by createPremierInclusionsWorkingCopy() — fine for a
-- build-time default, but with no way for an admin to promote a newly imported
-- PDF into "the" base template at runtime. This table adds that runtime store;
-- the static JSON file remains the fallback when no active row exists yet, so
-- existing templates/behaviour are unaffected until an admin explicitly saves
-- a new base template.
create table if not exists public.standard_inclusions_base_templates (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  version integer not null,
  document_json jsonb not null,
  source_file_name text,
  import_report jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz
);

create unique index if not exists standard_inclusions_base_templates_version_uidx
  on public.standard_inclusions_base_templates(version);

-- At most one row may be the live active base template at any time.
create unique index if not exists standard_inclusions_base_templates_single_active_uidx
  on public.standard_inclusions_base_templates((true))
  where status = 'active';

create index if not exists standard_inclusions_base_templates_status_idx
  on public.standard_inclusions_base_templates(status);

alter table public.standard_inclusions_base_templates enable row level security;

-- Every builder needs to read the active base template to clone it on first
-- open — readable by any authenticated user. There are deliberately no
-- insert/update policies: promoting/activating/archiving a version is a
-- privileged action performed only via the service-role API route
-- (pages/api/standard-inclusions/base-template.js), never a direct client write.
drop policy if exists standard_inclusions_base_templates_select on public.standard_inclusions_base_templates;
create policy standard_inclusions_base_templates_select
  on public.standard_inclusions_base_templates for select
  using (auth.uid() is not null);
