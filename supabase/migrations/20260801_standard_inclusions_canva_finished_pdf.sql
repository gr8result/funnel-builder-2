create table if not exists public.canva_connections (
  id uuid primary key default gen_random_uuid(),
  organisation_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  canva_user_id text,
  canva_team_id text,
  access_token text not null,
  refresh_token text not null,
  scopes text[] not null default '{}',
  expires_at timestamptz not null,
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists canva_connections_org_user_uidx
  on public.canva_connections (organisation_id, user_id);

create table if not exists public.canva_oauth_states (
  state text primary key,
  organisation_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  return_to text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.canva_templates (
  id uuid primary key default gen_random_uuid(),
  organisation_id text not null,
  name text not null,
  canva_design_id text,
  canva_brand_template_id text,
  thumbnail_url text,
  page_count integer,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.standard_inclusions_documents') is null then
    raise notice 'Skipping standard_inclusions_documents Canva columns: public.standard_inclusions_documents does not exist.';
  else
    alter table public.standard_inclusions_documents
      add column if not exists organisation_id text,
      add column if not exists project_id text,
      add column if not exists template_id uuid references public.canva_templates(id) on delete set null,
      add column if not exists canva_design_id text,
      add column if not exists canva_brand_template_id text,
      add column if not exists thumbnail_url text,
      add column if not exists page_count integer,
      add column if not exists status text not null default 'active',
      add column if not exists original_pdf_storage_key text,
      add column if not exists current_export_pdf_storage_key text;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'standard_inclusions_documents'
        and column_name = 'tenant_id'
    ) then
      update public.standard_inclusions_documents
      set organisation_id = coalesce(organisation_id, tenant_id)
      where organisation_id is null;
    else
      raise notice 'Skipping organisation_id backfill: public.standard_inclusions_documents.tenant_id does not exist.';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'standard_inclusions_documents'
        and column_name = 'current_exported_pdf_asset_id'
    ) then
      update public.standard_inclusions_documents
      set current_export_pdf_storage_key = coalesce(current_export_pdf_storage_key, current_exported_pdf_asset_id)
      where current_export_pdf_storage_key is null;
    else
      raise notice 'Skipping current_export_pdf_storage_key backfill: public.standard_inclusions_documents.current_exported_pdf_asset_id does not exist.';
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.standard_inclusions_documents') is null then
    raise notice 'Skipping standard_inclusions_versions: public.standard_inclusions_documents does not exist.';
  else
    create table if not exists public.standard_inclusions_versions (
      id uuid primary key default gen_random_uuid(),
      document_id text not null references public.standard_inclusions_documents(id) on delete cascade,
      version_number integer not null,
      canva_design_id text,
      original_pdf_storage_key text,
      export_pdf_storage_key text,
      preview_storage_keys jsonb not null default '[]'::jsonb,
      created_reason text not null,
      created_by uuid references auth.users(id) on delete set null,
      created_at timestamptz not null default now(),
      unique (document_id, version_number)
    );
  end if;
end $$;

notify pgrst, 'reload schema';

create index if not exists canva_templates_org_idx on public.canva_templates (organisation_id, status);

do $$
begin
  if to_regclass('public.standard_inclusions_documents') is not null then
    create index if not exists standard_inclusions_documents_org_project_idx
      on public.standard_inclusions_documents (organisation_id, project_id);

    create index if not exists standard_inclusions_documents_canva_design_idx
      on public.standard_inclusions_documents (canva_design_id);
  else
    raise notice 'Skipping standard_inclusions_documents indexes: public.standard_inclusions_documents does not exist.';
  end if;

  if to_regclass('public.standard_inclusions_versions') is not null then
    create index if not exists standard_inclusions_versions_document_idx
      on public.standard_inclusions_versions (document_id, version_number desc);
  else
    raise notice 'Skipping standard_inclusions_versions index: public.standard_inclusions_versions does not exist.';
  end if;
end $$;

alter table if exists public.canva_connections enable row level security;
alter table if exists public.canva_oauth_states enable row level security;
alter table if exists public.canva_templates enable row level security;
alter table if exists public.standard_inclusions_versions enable row level security;

do $$
begin
  if to_regclass('public.canva_connections') is not null
    and not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'canva_connections'
        and policyname = 'canva_connections_owner_select'
    )
  then
    create policy canva_connections_owner_select on public.canva_connections
      for select using (auth.uid() = user_id);
  end if;

  if to_regclass('public.canva_templates') is not null
    and to_regclass('public.workspace_members') is not null
    and not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'canva_templates'
        and policyname = 'canva_templates_member_select'
    )
  then
    create policy canva_templates_member_select on public.canva_templates
      for select using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id::text = canva_templates.organisation_id
            and wm.user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  elsif to_regclass('public.workspace_members') is null then
    raise notice 'Skipping canva_templates_member_select policy: public.workspace_members does not exist.';
  end if;

  if to_regclass('public.standard_inclusions_versions') is not null
    and to_regclass('public.standard_inclusions_documents') is not null
    and to_regclass('public.workspace_members') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'standard_inclusions_documents'
        and column_name = 'tenant_id'
    )
    and not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'standard_inclusions_versions'
        and policyname = 'standard_inclusions_versions_member_select'
    )
  then
    create policy standard_inclusions_versions_member_select on public.standard_inclusions_versions
      for select using (
        exists (
          select 1
          from public.standard_inclusions_documents d
          join public.workspace_members wm on wm.workspace_id::text = coalesce(d.organisation_id, d.tenant_id)
          where d.id = standard_inclusions_versions.document_id
            and wm.user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  elsif to_regclass('public.workspace_members') is null then
    raise notice 'Skipping standard_inclusions_versions_member_select policy: public.workspace_members does not exist.';
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'standard_inclusions_documents'
      and column_name = 'tenant_id'
  ) then
    raise notice 'Skipping standard_inclusions_versions_member_select policy: public.standard_inclusions_documents.tenant_id does not exist.';
  end if;
end $$;
