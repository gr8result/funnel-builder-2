-- Selections Book prepopulation templates and quote-row selection metadata.
-- Additive/idempotent only. Does not touch takeoff, plan import, canvas, measurement, orientation, or pricing calculations.

create extension if not exists pgcrypto;

create table if not exists public.builder_inclusion_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  template_key text not null,
  template_name text not null,
  description text,
  template_type text not null default 'residential',
  quality_level text not null default 'mid_range',
  is_system_template boolean not null default false,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, template_key)
);

create table if not exists public.builder_inclusion_template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.builder_inclusion_templates(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  section_key text not null,
  section_name text not null,
  description text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, section_key)
);

create table if not exists public.builder_inclusion_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.builder_inclusion_templates(id) on delete cascade,
  section_id uuid references public.builder_inclusion_template_sections(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  section text not null,
  category text,
  item_name text not null,
  description text,
  allowance_amount numeric(14, 2),
  brand text,
  model text,
  finish_colour text,
  supplier text,
  image_url text,
  notes text,
  included boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.builder_inclusion_template_items
  add column if not exists default_selection_specification text,
  add column if not exists estimated_base_cost numeric(14, 2),
  add column if not exists price_band text default 'mid_range',
  add column if not exists upgrade_options jsonb not null default '[]'::jsonb;

create unique index if not exists builder_inclusion_templates_system_key_idx
  on public.builder_inclusion_templates(template_key)
  where is_system_template = true;

create index if not exists builder_inclusion_template_items_template_idx
  on public.builder_inclusion_template_items(template_id, sort_order);

alter table public.builder_inclusion_templates enable row level security;
alter table public.builder_inclusion_template_sections enable row level security;
alter table public.builder_inclusion_template_items enable row level security;

drop policy if exists builder_inclusion_templates_select on public.builder_inclusion_templates;
create policy builder_inclusion_templates_select
  on public.builder_inclusion_templates
  for select
  using (
    is_system_template = true
    or public.builder_commercial_is_workspace_member(workspace_id)
  );

drop policy if exists builder_inclusion_templates_insert on public.builder_inclusion_templates;
create policy builder_inclusion_templates_insert
  on public.builder_inclusion_templates
  for insert
  with check (
    is_system_template = false
    and public.builder_commercial_is_workspace_member(workspace_id)
  );

drop policy if exists builder_inclusion_templates_update on public.builder_inclusion_templates;
create policy builder_inclusion_templates_update
  on public.builder_inclusion_templates
  for update
  using (
    is_system_template = false
    and public.builder_commercial_is_workspace_member(workspace_id)
  )
  with check (
    is_system_template = false
    and public.builder_commercial_is_workspace_member(workspace_id)
  );

drop policy if exists builder_inclusion_template_sections_select on public.builder_inclusion_template_sections;
create policy builder_inclusion_template_sections_select
  on public.builder_inclusion_template_sections
  for select
  using (
    exists (
      select 1
      from public.builder_inclusion_templates t
      where t.id = builder_inclusion_template_sections.template_id
        and (t.is_system_template = true or public.builder_commercial_is_workspace_member(t.workspace_id))
    )
  );

drop policy if exists builder_inclusion_template_items_select on public.builder_inclusion_template_items;
create policy builder_inclusion_template_items_select
  on public.builder_inclusion_template_items
  for select
  using (
    exists (
      select 1
      from public.builder_inclusion_templates t
      where t.id = builder_inclusion_template_items.template_id
        and (t.is_system_template = true or public.builder_commercial_is_workspace_member(t.workspace_id))
    )
  );

insert into public.builder_inclusion_templates (
  workspace_id,
  template_key,
  template_name,
  description,
  template_type,
  quality_level,
  is_system_template,
  metadata
)
values
  (null, 'mid_range', 'Mid Range Inclusions', 'Standard residential selections used as Stage 1 estimate assumptions and as the starting point for the final selections schedule.', 'residential', 'mid_range', true, '{"entry_points":["crm_lead","walk_in_client","own_plans","builder_designed","external_designer","renovation_tender"],"reusable":true}'::jsonb),
  (null, 'higher_end', 'Higher End Inclusions', 'Higher specification residential selections used as Stage 1 estimate assumptions and as the starting point for the final selections schedule.', 'residential', 'higher_end', true, '{"entry_points":["crm_lead","walk_in_client","own_plans","builder_designed","external_designer","renovation_tender"],"reusable":true}'::jsonb)
on conflict (template_key) where is_system_template = true do update
set
  template_name = excluded.template_name,
  description = excluded.description,
  quality_level = excluded.quality_level,
  metadata = excluded.metadata,
  updated_at = now();

with templates as (
  select id, template_key from public.builder_inclusion_templates where is_system_template = true and template_key in ('mid_range', 'higher_end')
),
section_seed as (
  select * from (values
    ('site_works_earthworks', 'Site Works & Earthworks', 10),
    ('retaining_walls', 'Retaining Walls', 20),
    ('concrete_slab', 'Concrete & Slab', 30),
    ('brickwork_cladding', 'Brickwork / Cladding', 40),
    ('roofing', 'Roofing', 50),
    ('gutters_fascia', 'Gutters & Fascia', 60),
    ('windows_external_doors', 'Windows & External Doors', 70),
    ('garage_door', 'Garage Door', 80),
    ('external_colours', 'External Colours', 90),
    ('landscaping', 'Landscaping', 100),
    ('flooring', 'Flooring', 110),
    ('internal_paint', 'Internal Paint', 120),
    ('doors_handles_trim', 'Doors / Handles / Trim', 130),
    ('kitchen', 'Kitchen', 140),
    ('butlers_pantry', 'Butler''s Pantry', 150),
    ('laundry', 'Laundry', 160),
    ('bathroom', 'Bathroom', 170),
    ('ensuite', 'Ensuite', 180),
    ('powder_room', 'Powder Room', 190),
    ('appliances', 'Appliances', 200),
    ('electrical', 'Electrical', 210),
    ('lighting', 'Lighting', 220),
    ('plumbing_fixtures', 'Plumbing Fixtures', 230),
    ('air_conditioning', 'Air Conditioning', 240)
  ) as seed(section_key, section_name, sort_order)
)
insert into public.builder_inclusion_template_sections (template_id, workspace_id, section_key, section_name, description, sort_order)
select t.id, null, s.section_key, s.section_name, 'Selections for ' || s.section_name || '.', s.sort_order
from templates t
cross join section_seed s
on conflict (template_id, section_key) do update
set section_name = excluded.section_name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    updated_at = now();

delete from public.builder_inclusion_template_items
where template_id in (
  select id from public.builder_inclusion_templates where is_system_template = true and template_key in ('mid_range', 'higher_end')
);

with templates as (
  select id, template_key from public.builder_inclusion_templates where is_system_template = true and template_key in ('mid_range', 'higher_end')
),
sections as (
  select s.id, s.template_id, s.section_key, s.section_name
  from public.builder_inclusion_template_sections s
  join templates t on t.id = s.template_id
),
base_items as (
  select * from (values
    ('site_works_earthworks','Site preparation','Site clearance and preparation','Clear vegetation, rubbish, minor levelling and prepare building platform.','Site Works',3500,5200,'Site contractor','Builder Standard','SW-STD','Included in standard scope','https://placehold.co/640x420?text=Site+Works',10),
    ('retaining_walls','Retaining wall allowance','Retaining walls if required','Timber or block retaining allowance where shown or required by site conditions.','External Works',2500,6800,'Landscape contractor','Builder Standard','RET-STD','Subject to engineering and site levels','https://placehold.co/640x420?text=Retaining+Walls',20),
    ('concrete_slab','Concrete slab finish','Concrete slab / footings','Standard engineered slab and footings to plans and soil classification.','Concrete',0,0,'Concretor','Engineered Standard','SLAB-STD','To engineering and building code requirements','https://placehold.co/640x420?text=Concrete+Slab',30),
    ('brickwork_cladding','External wall finish','Brickwork / cladding selection','Selected brickwork, render, lightweight cladding or mixed facade treatment.','Facade',4800,14000,'Facade supplier','Austral / James Hardie','FACADE-STD','Confirm final colours before order','https://placehold.co/640x420?text=Brickwork+Cladding',40),
    ('roofing','Roof covering','Roofing material and colour','Colorbond or roof tile profile selected from the template allowance range.','Roofing',0,0,'Roofing supplier','Colorbond','ROOF-STD','Includes standard trims and accessories','https://placehold.co/640x420?text=Roofing',50),
    ('gutters_fascia','Gutters and fascia','Gutters, fascia and downpipes','Standard Colorbond gutters, fascia and downpipes in selected colour.','External Colours',0,0,'Roof plumbing supplier','Colorbond','GUTTER-STD','Profile subject to builder standard range','https://placehold.co/640x420?text=Gutters+Fascia',60),
    ('windows_external_doors','Windows and external doors','Windows, sliding doors and entry door','Powdercoated aluminium windows/doors and selected front entry door.','Windows & Doors',3200,9200,'Window supplier','Dowell / AWS','WINDOW-STD','Glazing and frame colour to be confirmed','https://placehold.co/640x420?text=Windows+Doors',70),
    ('garage_door','Garage door','Sectional garage door','Motorised sectional overhead garage door in selected profile and colour.','Garage',2600,4800,'Garage door supplier','B&D / Steel-Line','GARAGE-STD','Remote controls included where nominated','https://placehold.co/640x420?text=Garage+Door',80),
    ('external_colours','External colour palette','External colours and finishes','Roof, gutter, fascia, wall, window and feature colour selections.','External Colours',0,0,'Builder','Builder Palette','EXT-COLOUR','Record approved colour schedule','https://placehold.co/640x420?text=External+Colours',90),
    ('landscaping','Landscape allowance','Landscaping and driveway selections','Driveway, turf, garden edging and planting allowance.','Landscaping',6500,14000,'Landscape contractor','Builder Standard','LAND-STD','Retaining and irrigation separate unless included','https://placehold.co/640x420?text=Landscaping',100),
    ('flooring','Floor finishes','Flooring selections','Carpet, hybrid, timber, tile or vinyl flooring selections by room.','Flooring',85,165,'Flooring supplier','Choices / Andersens','FLOOR-STD','Allowance may be per m2 where applicable','https://placehold.co/640x420?text=Flooring',110),
    ('internal_paint','Internal paint palette','Internal paint colours','Wall, ceiling, trim and feature colour selections.','Paint',0,0,'Painter','Dulux','PAINT-STD','Includes builder standard paint system','https://placehold.co/640x420?text=Internal+Paint',120),
    ('doors_handles_trim','Internal doors and hardware','Doors, handles and trim','Internal door style, passage/privacy handles, skirting and architraves.','Fix Out',1800,4800,'Hardware supplier','Hume / Gainsborough','DOOR-HANDLE-STD','Confirm handle finish and door profile','https://placehold.co/640x420?text=Doors+Handles+Trim',130),
    ('kitchen','Kitchen selections','Kitchen cabinetry, benchtops and splashback','Cabinet finish, benchtop, splashback, handles and sink/tap selection.','Kitchen',14000,34000,'Cabinet maker','Polytec / Caesarstone','KITCHEN-STD','Final cabinet drawings required before manufacture','https://placehold.co/640x420?text=Kitchen',140),
    ('butlers_pantry','Butler''s pantry selections','Butler''s pantry finishes','Cabinetry, benchtop, sink, tap and shelving selections.','Cabinetry',4500,14000,'Cabinet maker','Polytec / Caesarstone','PANTRY-STD','Optional where included in design','https://placehold.co/640x420?text=Butlers+Pantry',150),
    ('laundry','Laundry selections','Laundry cabinetry and fixtures','Laundry tub, tapware, bench, cabinetry and splashback selections.','Laundry',3500,9000,'Cabinet maker','Polytec / Caroma','LAUNDRY-STD','Confirm appliance spaces','https://placehold.co/640x420?text=Laundry',160),
    ('bathroom','Bathroom selections','Main bathroom fixtures and finishes','Tiles, vanity, basin, mirror, shower screen, toilet, tapware and accessories.','Bathroom',6500,16000,'Plumbing supplier','Caroma / Reece','BATH-STD','Selection affects allowance adjustment','https://placehold.co/640x420?text=Bathroom',170),
    ('ensuite','Ensuite selections','Ensuite fixtures and finishes','Tiles, vanity, basin, mirror, shower screen, toilet, tapware and accessories.','Ensuite',6500,18000,'Plumbing supplier','Caroma / Reece','ENS-STD','Selection affects allowance adjustment','https://placehold.co/640x420?text=Ensuite',180),
    ('powder_room','Powder room selections','Powder room fixtures and finishes','Toilet, basin, mirror, tapware and feature finish selections.','Powder Room',2200,7000,'Plumbing supplier','Caroma / Reece','POWDER-STD','Optional where included in design','https://placehold.co/640x420?text=Powder+Room',190),
    ('appliances','Appliance package','Kitchen and laundry appliances','Oven, cooktop, rangehood, dishwasher and optional appliance selections.','Appliances',3500,9500,'Appliance supplier','Westinghouse / Bosch','APP-STD','Model numbers required before ordering','https://placehold.co/640x420?text=Appliances',200),
    ('electrical','Electrical fit-off','Switches, power, data and fit-off','Power points, switches, data points, fans and electrical fit-off selections.','Electrical',6500,13500,'Electrician','Clipsal','ELEC-STD','Changes may require variation approval','https://placehold.co/640x420?text=Electrical',210),
    ('lighting','Lighting selections','Internal and external lighting','Downlights, pendants, feature lighting and exterior lighting selections.','Lighting',2800,9800,'Lighting supplier','Beacon / Clipsal','LIGHT-STD','Feature lights above allowance create adjustment','https://placehold.co/640x420?text=Lighting',220),
    ('plumbing_fixtures','Plumbing fixtures','Tapware, sinks, basins and accessories','Kitchen, laundry, bathroom and ensuite plumbing fixture selections.','Plumbing Fixtures',4200,11500,'Plumbing supplier','Caroma / Reece','PLUMB-STD','Finish and model to be confirmed before rough-in','https://placehold.co/640x420?text=Plumbing+Fixtures',230),
    ('air_conditioning','Air conditioning','Heating and cooling selection','Split system or ducted air conditioning allowance depending on template level.','HVAC',0,18000,'HVAC supplier','Daikin / Mitsubishi','HVAC-STD','Final load/design required before order','https://placehold.co/640x420?text=Air+Conditioning',240)
  ) as seed(section_key, item_name, default_selection, description, category, mid_allowance, high_allowance, supplier, brand, model, notes, image_url, sort_order)
),
expanded as (
  select
    t.id as template_id,
    t.template_key,
    s.id as section_id,
    s.section_name,
    b.category,
    b.item_name,
    case when t.template_key = 'higher_end' then 'Higher end ' || lower(b.default_selection) else 'Mid range ' || lower(b.default_selection) end as default_selection_specification,
    b.description,
    case when t.template_key = 'higher_end' then b.high_allowance else b.mid_allowance end::numeric as allowance_amount,
    case when t.template_key = 'higher_end' then b.high_allowance else b.mid_allowance end::numeric as estimated_base_cost,
    case when t.template_key = 'higher_end' then 'higher_end' else 'mid_range' end as price_band,
    b.supplier,
    b.brand,
    b.model,
    b.notes,
    b.image_url,
    b.sort_order,
    jsonb_build_array(
      jsonb_build_object('label','Builder standard','price_band','mid_range','cost',b.mid_allowance,'brand',b.brand,'model',b.model),
      jsonb_build_object('label','Premium upgrade','price_band','higher_end','cost',b.high_allowance,'brand',b.brand,'model',b.model || '-PREM'),
      jsonb_build_object('label','Luxury upgrade','price_band','luxury','cost',round((b.high_allowance * 1.45)::numeric, 2),'brand',b.brand,'model',b.model || '-LUX')
    ) as upgrade_options
  from templates t
  join sections s on s.template_id = t.id
  join base_items b on b.section_key = s.section_key
)
insert into public.builder_inclusion_template_items (
  template_id,
  section_id,
  workspace_id,
  section,
  category,
  item_name,
  description,
  default_selection_specification,
  allowance_amount,
  estimated_base_cost,
  price_band,
  brand,
  model,
  finish_colour,
  supplier,
  image_url,
  notes,
  included,
  sort_order,
  upgrade_options,
  metadata
)
select
  template_id,
  section_id,
  null,
  section_name,
  category,
  item_name,
  description,
  default_selection_specification,
  allowance_amount,
  estimated_base_cost,
  price_band,
  brand,
  model,
  'To be selected',
  supplier,
  image_url,
  notes,
  true,
  sort_order,
  upgrade_options,
  jsonb_build_object('source','system_seed','template_level',template_key,'default_status','selected','default_included_item',default_selection_specification)
from expanded;
