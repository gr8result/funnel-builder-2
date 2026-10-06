-- Additive tenant foundation. workspace_id is the sole tenant key.
-- Existing workbook JSON, quantities, quote order and formula fields are never rewritten.
begin;

create table public.selection_slot_definitions (
  id text primary key, display_name text not null
);
insert into public.selection_slot_definitions (id, display_name) values
 ('kitchen_sink','Kitchen Sink'), ('kitchen_mixer','Kitchen Mixer'), ('oven','Oven'),
 ('cooktop','Cooktop'), ('dishwasher','Dishwasher'), ('toilet_suite','Toilet Suite'),
 ('basin','Basin'), ('basin_mixer','Basin Mixer'), ('bath','Bath'), ('shower_mixer','Shower Mixer'),
 ('shower_screen','Shower Screen'), ('mirror','Mirror'), ('floor_tile','Floor Tile'),
 ('wall_tile','Wall Tile'), ('carpet','Carpet'), ('timber_flooring','Timber Flooring'),
 ('internal_door_handle','Internal Door Handle'), ('external_door_handle','External Door Handle'), ('robe_fitout','Robe Fitout');
alter table public.selection_slot_definitions enable row level security;
create policy selection_slots_read on public.selection_slot_definitions for select to authenticated using (true);
grant select on public.selection_slot_definitions to authenticated;

alter table public.builder_products
  add column if not exists global_product_id text,
  add column if not exists selection_slot_ids text[] not null default '{}',
  add column if not exists unit text,
  add column if not exists variant_options jsonb not null default '{}';
create unique index if not exists builder_products_workspace_identity on public.builder_products(workspace_id,id);

create table public.builder_selection_configurations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  selection_slot_id text not null references public.selection_slot_definitions(id),
  builder_display_name text not null,
  builder_category text not null default '', builder_subcategory text not null default '',
  room_applicability jsonb not null default '[]', enabled boolean not null default false,
  allow_multiple boolean not null default false, allow_apply_to_all boolean not null default true,
  allow_room_override boolean not null default true,
  quantity_source text not null default 'TAKEOFF' check (quantity_source in ('TAKEOFF','SYSTEM_FORMULA','MANUAL')),
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id,selection_slot_id)
);
create table public.builder_selection_aliases (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  selection_slot_id text not null references public.selection_slot_definitions(id), alias text not null,
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id,alias)
);
create table public.builder_selection_quote_mappings (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  selection_slot_id text not null references public.selection_slot_definitions(id),
  template_id text not null default '', quote_section_id text, quote_row_id text,
  status text not null default 'UNMAPPED' check (status in ('UNMAPPED','MAPPED')),
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id,selection_slot_id,template_id),
  check (status <> 'MAPPED' or (nullif(quote_section_id,'') is not null and nullif(quote_row_id,'') is not null))
);
create table public.builder_product_configurations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  product_id uuid, catalogue_product_id text,
  purchase_price numeric(14,2), allowance_price numeric(14,2), active boolean not null default true,
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (num_nonnulls(product_id, catalogue_product_id) = 1),
  foreign key (workspace_id,product_id) references public.builder_products(workspace_id,id),
  unique (workspace_id,product_id), unique (workspace_id,catalogue_product_id)
);
create table public.builder_inclusion_schedules (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  name text not null check (length(trim(name)) > 0), display_name text not null,
  version integer not null default 1 check (version > 0), active boolean not null default true,
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id,id), unique (workspace_id,name)
);
create table public.builder_inclusion_schedule_items (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  inclusion_schedule_id uuid not null,
  selection_slot_id text not null references public.selection_slot_definitions(id),
  default_product_id uuid, default_catalogue_product_id text, location_id text,
  quantity_rules jsonb not null default '{}', allowance jsonb not null default '{}', notes text,
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (num_nonnulls(default_product_id,default_catalogue_product_id) <= 1),
  foreign key (workspace_id,inclusion_schedule_id) references public.builder_inclusion_schedules(workspace_id,id),
  foreign key (workspace_id,default_product_id) references public.builder_products(workspace_id,id)
);

-- Ownership cannot be moved, including by a user who happens to belong to both builders.
create function public.builder_selection_immutable_workspace() returns trigger language plpgsql as $$
begin
  if new.workspace_id is distinct from old.workspace_id then raise exception 'Workspace ownership is immutable' using errcode = '23514'; end if;
  return new;
end $$;
create function public.builder_selection_is_config_admin(p_workspace_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace_id
    and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin'));
$$;
do $$ declare t text; begin
  foreach t in array array['builder_selection_configurations','builder_selection_aliases','builder_selection_quote_mappings',
    'builder_product_configurations','builder_inclusion_schedules','builder_inclusion_schedule_items'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy tenant_read on public.%I for select to authenticated using (public.builder_commercial_is_workspace_member(workspace_id))',t);
    execute format('create policy tenant_write on public.%I for all to authenticated using (public.builder_selection_is_config_admin(workspace_id)) with check (public.builder_selection_is_config_admin(workspace_id))',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
    execute format('create trigger immutable_workspace before update on public.%I for each row execute function public.builder_selection_immutable_workspace()',t);
    execute format('create trigger updated_at before update on public.%I for each row execute function public.builder_commercial_set_updated_at()',t);
    execute format('create index on public.%I(workspace_id)',t);
  end loop;
end $$;

-- Version master schedules on every change, including edits to an item.
create function public.builder_selection_schedule_version() returns trigger language plpgsql as $$
begin new.version := old.version + 1; return new; end $$;
create trigger schedule_version before update on public.builder_inclusion_schedules for each row execute function public.builder_selection_schedule_version();
create function public.builder_selection_item_version() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then update public.builder_inclusion_schedules set updated_at = now() where workspace_id = old.workspace_id and id = old.inclusion_schedule_id; end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.inclusion_schedule_id <> old.inclusion_schedule_id) then
    update public.builder_inclusion_schedules set updated_at = now() where workspace_id = new.workspace_id and id = new.inclusion_schedule_id;
  end if;
  return null;
end $$;
create trigger item_version after insert or update or delete on public.builder_inclusion_schedule_items for each row execute function public.builder_selection_item_version();

alter table public.builder_commercial_projects
  add column if not exists job_inclusion_schedule_id uuid,
  add column if not exists job_inclusion_schedule_name text,
  add column if not exists job_inclusion_schedule_version integer,
  add column if not exists job_inclusion_snapshot jsonb,
  add column if not exists inclusion_applied_at timestamptz,
  add constraint job_inclusion_same_workspace foreign key (workspace_id,job_inclusion_schedule_id) references public.builder_inclusion_schedules(workspace_id,id);
alter table public.builder_client_selections
  add column if not exists selection_slot_id text references public.selection_slot_definitions(id),
  add column if not exists baseline_product_id text,
  add column if not exists baseline_unit_price numeric(14,2),
  add column if not exists active_product_id text,
  add column if not exists active_unit_price numeric(14,2),
  add column if not exists location_id text,
  add column if not exists selection_source text check (selection_source in ('INCLUSION_SCHEDULE','CLIENT_SELECTION','MANUAL_OVERRIDE','TAKEOFF','SYSTEM_FORMULA'));

-- Current builder only, identified by existing production jobs and recovery fixtures.
-- Nothing is populated from quote rows. Other workspaces start with zero schedules.
insert into public.builder_inclusion_schedules (workspace_id,name,display_name,metadata)
select w.id,n.name,n.name,'{"seed":"current-builder-foundation","mappingStatus":"UNMAPPED"}'::jsonb
from public.workspaces w cross join (values ('Classic Inclusions'),('Premier Inclusions'),('Premium Inclusions')) n(name)
where w.id = '846885cd-25b9-4eca-b9f9-3fd02f5882d8';

insert into public.builder_selection_configurations (workspace_id,selection_slot_id,builder_display_name,enabled)
select w.id,s.id,s.display_name,true from public.workspaces w cross join public.selection_slot_definitions s
where w.id = '846885cd-25b9-4eca-b9f9-3fd02f5882d8';
insert into public.builder_selection_aliases (workspace_id,selection_slot_id,alias)
select workspace_id,selection_slot_id,replace(selection_slot_id,'_','-') from public.builder_selection_configurations
where workspace_id = '846885cd-25b9-4eca-b9f9-3fd02f5882d8';

-- Retain the original builder's legacy document/specification records and IDs in place.
-- Unrecognised unowned records stay quarantined; no tenant is guessed for them.
update public.builder_inclusion_templates set workspace_id = '846885cd-25b9-4eca-b9f9-3fd02f5882d8', is_system_template = false
where workspace_id is null and is_system_template and template_key in ('mid_range','higher_end')
  and exists (select 1 from public.workspaces where id = '846885cd-25b9-4eca-b9f9-3fd02f5882d8');
update public.builder_inclusion_template_sections s set workspace_id = t.workspace_id
from public.builder_inclusion_templates t where s.template_id = t.id and s.workspace_id is null and t.workspace_id is not null;
update public.builder_inclusion_template_items s set workspace_id = t.workspace_id
from public.builder_inclusion_templates t where s.template_id = t.id and s.workspace_id is null and t.workspace_id is not null;
update public.builder_standard_specifications set workspace_id = '846885cd-25b9-4eca-b9f9-3fd02f5882d8', is_platform_default = false
where workspace_id is null and is_platform_default and template_key in ('mid_range_residential','higher_end_residential')
  and exists (select 1 from public.workspaces where id = '846885cd-25b9-4eca-b9f9-3fd02f5882d8');
update public.builder_standard_specification_items s set workspace_id = t.workspace_id
from public.builder_standard_specifications t where s.specification_id = t.id and s.workspace_id is null and t.workspace_id is not null;

-- Restrictive policies close older permissive "system template" / null-owner policies.
-- The only shared classification data is product categories; commercial data always has an owner.
do $$ declare t text; begin
  foreach t in array array['builder_products','builder_product_suppliers','builder_product_manufacturers',
    'builder_product_images','builder_product_documents','builder_product_specifications','builder_product_colours',
    'builder_product_finish_options','builder_product_price_options',
    'builder_inclusion_templates','builder_inclusion_template_sections','builder_inclusion_template_items',
    'builder_standard_specifications','builder_standard_specification_items',
    'builder_commercial_projects','builder_estimate_snapshots','builder_client_selections','builder_selection_sessions','builder_selection_books'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy tenant_boundary on public.%I as restrictive for all to authenticated using (public.builder_commercial_is_workspace_member(workspace_id)) with check (public.builder_commercial_is_workspace_member(workspace_id))',t);
    execute format('create trigger immutable_workspace before update on public.%I for each row execute function public.builder_selection_immutable_workspace()',t);
  end loop;
end $$;

-- Old single-column FKs prove existence but not ownership. Check the referenced owner's workspace
-- on every new write, including writes through service-role APIs. Existing jobs are not rewritten.
create function public.builder_selection_check_references() returns trigger language plpgsql security definer set search_path = public as $$
declare ref record; reference_id text; parent_workspace uuid;
begin
  for ref in
    select c.confrelid::regclass as parent_table, a.attname as child_column, p.attname as parent_column
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute p on p.attrelid = c.confrelid and p.attnum = c.confkey[1]
    where c.conrelid = tg_relid and c.contype = 'f' and cardinality(c.conkey) = 1
      and exists (select 1 from pg_attribute w where w.attrelid = c.confrelid and w.attname = 'workspace_id' and not w.attisdropped)
  loop
    reference_id := to_jsonb(new)->>ref.child_column;
    if reference_id is null then continue; end if;
    execute format('select workspace_id from %s where %I::text = $1', ref.parent_table, ref.parent_column) into parent_workspace using reference_id;
    if parent_workspace is distinct from new.workspace_id then
      if parent_workspace is null and ref.parent_table = 'public.builder_product_categories'::regclass then continue; end if;
      raise exception 'Cross-workspace reference: %', ref.child_column using errcode = '23503';
    end if;
  end loop;
  return new;
end $$;
do $$ declare t record; begin
  for t in select c.oid::regclass as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'builder_%'
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'workspace_id' and not a.attisdropped)
  loop
    execute format('create trigger tenant_references before insert or update on %s for each row execute function public.builder_selection_check_references()',t.name);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
