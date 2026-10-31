-- Additive: a builder's verified requirement -> quotation-row mapping, reusable across that builder's jobs.
-- workspace_id is the sole tenant key. Jobs keep their own snapshot copy, so editing or retiring a mapping
-- never rewrites an existing job. Nothing is populated here: builders confirm mappings in Reconcile Selections.
begin;

create table public.builder_requirement_quote_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  template_id text not null default '',
  requirement_key text not null check (length(trim(requirement_key)) > 0),
  location_id text not null default '',
  mode text not null default 'PRODUCT_ROW' check (mode in ('PRODUCT_ROW','SPECIFICATION_ONLY')),
  quote_section_id text not null check (length(trim(quote_section_id)) > 0),
  quote_row_id text not null check (length(trim(quote_row_id)) > 0),
  status text not null default 'MAPPED' check (status in ('MAPPED','RETIRED')),
  version integer not null default 1 check (version > 0),
  verified_by uuid,
  verified_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, template_id, requirement_key, location_id)
);

create or replace function public.builder_requirement_mapping_version() returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  return new;
end $$;

-- A signed-in admin cannot attribute a mapping to someone else; service-role writes carry the verifier the API stamped.
create or replace function public.builder_requirement_mapping_stamp() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then new.verified_by := auth.uid(); end if;
  new.verified_at := coalesce(new.verified_at, now());
  return new;
end $$;

alter table public.builder_requirement_quote_mappings enable row level security;
create policy tenant_read on public.builder_requirement_quote_mappings for select to authenticated
  using (public.builder_commercial_is_workspace_member(workspace_id));
create policy tenant_write on public.builder_requirement_quote_mappings for all to authenticated
  using (public.builder_selection_is_config_admin(workspace_id)) with check (public.builder_selection_is_config_admin(workspace_id));
grant select, insert, update, delete on public.builder_requirement_quote_mappings to authenticated;
create trigger immutable_workspace before update on public.builder_requirement_quote_mappings for each row execute function public.builder_selection_immutable_workspace();
create trigger updated_at before update on public.builder_requirement_quote_mappings for each row execute function public.builder_commercial_set_updated_at();
create trigger mapping_version before update on public.builder_requirement_quote_mappings for each row execute function public.builder_requirement_mapping_version();
create trigger mapping_stamp before insert or update on public.builder_requirement_quote_mappings for each row execute function public.builder_requirement_mapping_stamp();

commit;
