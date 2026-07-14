-- Standard Inclusions Template system.
-- Additive only. Does not modify estimator calculations, takeoff, plans, PDF, canvas, or measurement code.

create extension if not exists pgcrypto;

create table if not exists public.builder_inclusion_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  template_key text not null,
  template_name text not null,
  description text,
  template_type text not null default 'residential'
    check (template_type in ('residential', 'commercial', 'custom')),
  quality_level text not null default 'mid_range'
    check (quality_level in ('mid_range', 'higher_end', 'custom')),
  is_system_template boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'archived')),
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

create index if not exists builder_inclusion_templates_workspace_idx
  on public.builder_inclusion_templates(workspace_id);

create unique index if not exists builder_inclusion_templates_system_key_idx
  on public.builder_inclusion_templates(template_key)
  where is_system_template = true;

create index if not exists builder_inclusion_template_sections_template_idx
  on public.builder_inclusion_template_sections(template_id, sort_order);

create index if not exists builder_inclusion_template_items_template_idx
  on public.builder_inclusion_template_items(template_id, sort_order);

create index if not exists builder_inclusion_template_items_section_idx
  on public.builder_inclusion_template_items(section_id, sort_order);

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

drop policy if exists builder_inclusion_templates_delete on public.builder_inclusion_templates;
create policy builder_inclusion_templates_delete
  on public.builder_inclusion_templates
  for delete
  using (
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
      where t.id = template_id
        and (t.is_system_template = true or public.builder_commercial_is_workspace_member(t.workspace_id))
    )
  );

drop policy if exists builder_inclusion_template_sections_insert on public.builder_inclusion_template_sections;
create policy builder_inclusion_template_sections_insert
  on public.builder_inclusion_template_sections
  for insert
  with check (
    public.builder_commercial_is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.builder_inclusion_templates t
      where t.id = template_id
        and t.is_system_template = false
        and t.workspace_id = builder_inclusion_template_sections.workspace_id
    )
  );

drop policy if exists builder_inclusion_template_sections_update on public.builder_inclusion_template_sections;
create policy builder_inclusion_template_sections_update
  on public.builder_inclusion_template_sections
  for update
  using (public.builder_commercial_is_workspace_member(workspace_id))
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_inclusion_template_sections_delete on public.builder_inclusion_template_sections;
create policy builder_inclusion_template_sections_delete
  on public.builder_inclusion_template_sections
  for delete
  using (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_inclusion_template_items_select on public.builder_inclusion_template_items;
create policy builder_inclusion_template_items_select
  on public.builder_inclusion_template_items
  for select
  using (
    exists (
      select 1
      from public.builder_inclusion_templates t
      where t.id = template_id
        and (t.is_system_template = true or public.builder_commercial_is_workspace_member(t.workspace_id))
    )
  );

drop policy if exists builder_inclusion_template_items_insert on public.builder_inclusion_template_items;
create policy builder_inclusion_template_items_insert
  on public.builder_inclusion_template_items
  for insert
  with check (
    public.builder_commercial_is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.builder_inclusion_templates t
      where t.id = template_id
        and t.is_system_template = false
        and t.workspace_id = builder_inclusion_template_items.workspace_id
    )
  );

drop policy if exists builder_inclusion_template_items_update on public.builder_inclusion_template_items;
create policy builder_inclusion_template_items_update
  on public.builder_inclusion_template_items
  for update
  using (public.builder_commercial_is_workspace_member(workspace_id))
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_inclusion_template_items_delete on public.builder_inclusion_template_items;
create policy builder_inclusion_template_items_delete
  on public.builder_inclusion_template_items
  for delete
  using (public.builder_commercial_is_workspace_member(workspace_id));

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
  (
    null,
    'mid_range',
    'Mid Range Inclusions',
    'Standard residential inclusions for a practical mid-range estimate. Intended as Stage 1 estimate assumptions and a starting point for the final inclusions schedule.',
    'residential',
    'mid_range',
    true,
    '{"stage":"estimate","reusable":true}'::jsonb
  ),
  (
    null,
    'higher_end',
    'Higher End Inclusions',
    'Higher specification residential inclusions for premium estimates. Intended as Stage 1 estimate assumptions and a starting point for the final inclusions schedule.',
    'residential',
    'higher_end',
    true,
    '{"stage":"estimate","reusable":true}'::jsonb
  )
on conflict (template_key) where is_system_template = true do update
set
  template_name = excluded.template_name,
  description = excluded.description,
  template_type = excluded.template_type,
  quality_level = excluded.quality_level,
  metadata = excluded.metadata,
  updated_at = now();

with templates as (
  select id, template_key
  from public.builder_inclusion_templates
  where is_system_template = true
    and template_key in ('mid_range', 'higher_end')
),
section_seed as (
  select * from (values
    ('external', 'External Selections', 'Facade, roofing, windows, external doors, garage, driveway and landscape allowance.', 10),
    ('internal', 'Internal Selections', 'Internal linings, flooring, cabinetry, fixtures, appliances, paint and fit-off selections.', 20),
    ('services', 'Services & Compliance', 'Electrical, plumbing, HVAC, insulation, waterproofing, compliance and commissioning allowances.', 30)
  ) as seed(section_key, section_name, description, sort_order)
)
insert into public.builder_inclusion_template_sections (
  template_id,
  workspace_id,
  section_key,
  section_name,
  description,
  sort_order
)
select
  templates.id,
  null,
  section_seed.section_key,
  section_seed.section_name,
  section_seed.description,
  section_seed.sort_order
from templates
cross join section_seed
on conflict (template_id, section_key) do update
set
  section_name = excluded.section_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

delete from public.builder_inclusion_template_items
where template_id in (
  select id
  from public.builder_inclusion_templates
  where is_system_template = true
    and template_key in ('mid_range', 'higher_end')
);

with template_rows as (
  select id, template_key
  from public.builder_inclusion_templates
  where is_system_template = true
    and template_key in ('mid_range', 'higher_end')
),
section_rows as (
  select s.id, s.template_id, s.section_key
  from public.builder_inclusion_template_sections s
  join template_rows t on t.id = s.template_id
),
item_seed as (
  select * from (values
    -- Mid Range external
    ('mid_range', 'external', 'Facade', 'External wall finish', 'Rendered and painted lightweight cladding or brickwork to nominated areas.', null::numeric, null, null, 'Builder standard colour range', null, null, 'Final colour selections to be confirmed during quote stage.', true, 10),
    ('mid_range', 'external', 'Roofing', 'Roof covering', 'Colorbond roof sheeting or concrete roof tiles from standard builder range.', null::numeric, 'Colorbond or equivalent', null, 'Standard colour range', null, null, null, true, 20),
    ('mid_range', 'external', 'Windows', 'Aluminium windows', 'Powdercoated aluminium windows with standard clear glazing.', null::numeric, null, null, 'Standard powdercoat colour', 'Window supplier', null, null, true, 30),
    ('mid_range', 'external', 'External Doors', 'Front entry door', 'Paint grade or stained entry door from builder standard range including basic lockset.', 1200::numeric, null, null, 'Standard paint or stain finish', null, null, null, true, 40),
    ('mid_range', 'external', 'Garage', 'Garage sectional door', 'Sectional overhead garage door with standard motor where garage is included.', 2600::numeric, null, null, 'Standard colour range', null, null, null, true, 50),
    ('mid_range', 'external', 'Driveway', 'Driveway allowance', 'Plain concrete driveway allowance subject to site conditions and council requirements.', 6500::numeric, null, null, 'Plain concrete', null, null, 'Decorative concrete excluded unless upgraded.', true, 60),
    ('mid_range', 'external', 'Landscaping', 'Basic landscaping allowance', 'Basic turf, garden bed and mulch allowance to nominated areas.', 3500::numeric, null, null, null, null, null, 'Retaining walls, irrigation and mature planting excluded unless specified.', true, 70),

    -- Mid Range internal
    ('mid_range', 'internal', 'Flooring', 'Floor finishes', 'Carpet to bedrooms and hybrid/vinyl plank or tiles to living and wet areas.', 85::numeric, null, null, 'Builder standard range', 'Flooring supplier', null, 'Allowance amount is per square metre where applicable.', true, 110),
    ('mid_range', 'internal', 'Kitchen', 'Kitchen cabinetry', 'Laminate cabinetry with soft-close doors and drawers, laminate benchtops and standard handles.', 14000::numeric, null, null, 'Laminate standard range', 'Cabinet maker', null, null, true, 120),
    ('mid_range', 'internal', 'Appliances', 'Appliance package', 'Standard electric oven, cooktop, rangehood and dishwasher allowance.', 3500::numeric, null, null, 'Stainless or black standard range', 'Appliance supplier', null, null, true, 130),
    ('mid_range', 'internal', 'Bathroom', 'Bathroom fixtures', 'Standard vanity, toilet suite, shower screen, mirror and tapware allowance.', 6500::numeric, null, null, 'Chrome / standard white', 'Plumbing supplier', null, null, true, 140),
    ('mid_range', 'internal', 'Tiles', 'Wall and floor tiling', 'Ceramic tile allowance to wet areas with standard set-out and trims.', 55::numeric, null, null, 'Builder standard range', 'Tile supplier', null, 'Feature tiles and complex patterns excluded unless upgraded.', true, 150),
    ('mid_range', 'internal', 'Paint', 'Internal painting', 'Three-coat internal paint system using builder standard colours.', null::numeric, null, null, 'Standard colour range', null, null, null, true, 160),
    ('mid_range', 'internal', 'Window Furnishings', 'Curtains and blinds', 'Window furnishings are excluded unless separately selected.', null::numeric, null, null, null, null, null, null, false, 170),

    -- Mid Range services
    ('mid_range', 'services', 'Electrical', 'Electrical fit-off', 'Standard LED downlights, switches, power points and smoke alarms to plan allowance.', 6500::numeric, null, null, 'White standard fittings', 'Electrician', null, null, true, 210),
    ('mid_range', 'services', 'Plumbing', 'Plumbing fixtures', 'Standard plumbing rough-in and fit-off to included wet areas.', null::numeric, null, null, 'Chrome standard fittings', 'Plumber', null, null, true, 220),
    ('mid_range', 'services', 'HVAC', 'Air conditioning', 'Air conditioning excluded unless included as a separate allowance or upgrade.', null::numeric, null, null, null, null, null, null, false, 230),
    ('mid_range', 'services', 'Insulation', 'Insulation', 'Ceiling and wall insulation to statutory requirements.', null::numeric, null, null, null, null, null, null, true, 240),
    ('mid_range', 'services', 'Waterproofing', 'Wet area waterproofing', 'Waterproofing to wet areas in accordance with applicable standards.', null::numeric, null, null, null, null, null, null, true, 250),

    -- Higher End external
    ('higher_end', 'external', 'Facade', 'Architectural external wall finish', 'Combination of premium render, feature cladding, brickwork or stone-look feature elements as nominated.', 18000::numeric, null, null, 'Premium selected palette', null, null, 'Final specification to be confirmed in full quote.', true, 10),
    ('higher_end', 'external', 'Roofing', 'Premium roof covering', 'Colorbond roof sheeting or selected roof tiles with upgraded profiles and accessories.', null::numeric, 'Colorbond or equivalent', null, 'Premium colour range', null, null, null, true, 20),
    ('higher_end', 'external', 'Windows', 'Upgraded aluminium windows', 'Powdercoated aluminium windows with upgraded frame colour and performance glazing allowance.', null::numeric, null, null, 'Premium powdercoat colour', 'Window supplier', null, null, true, 30),
    ('higher_end', 'external', 'External Doors', 'Feature entry door', 'Feature entry door and upgraded architectural lockset allowance.', 2800::numeric, null, null, 'Selected stain, paint or powdercoat', null, null, null, true, 40),
    ('higher_end', 'external', 'Garage', 'Premium garage sectional door', 'Architectural profile sectional garage door with motor and remotes.', 4200::numeric, null, null, 'Premium colour/profile', null, null, null, true, 50),
    ('higher_end', 'external', 'Driveway', 'Decorative driveway allowance', 'Exposed aggregate or decorative concrete driveway allowance subject to site conditions.', 11000::numeric, null, null, 'Selected decorative finish', null, null, null, true, 60),
    ('higher_end', 'external', 'Landscaping', 'Enhanced landscaping allowance', 'Enhanced turf, planting, garden edging, mulch and entry feature allowance.', 9000::numeric, null, null, null, null, null, 'Retaining walls and irrigation still subject to final quotation.', true, 70),

    -- Higher End internal
    ('higher_end', 'internal', 'Flooring', 'Premium floor finishes', 'Engineered timber, quality hybrid flooring, upgraded carpet and premium wet area tile allowance.', 145::numeric, null, null, 'Premium selected range', 'Flooring supplier', null, 'Allowance amount is per square metre where applicable.', true, 110),
    ('higher_end', 'internal', 'Kitchen', 'Premium kitchen cabinetry', 'Two-pack or premium laminate cabinetry, soft-close hardware, stone benchtops and upgraded handles.', 32000::numeric, null, null, 'Premium cabinet and stone selections', 'Cabinet maker', null, null, true, 120),
    ('higher_end', 'internal', 'Appliances', 'Premium appliance package', 'Upgraded oven, cooktop, rangehood and dishwasher package allowance.', 8500::numeric, null, null, 'Premium stainless, black or integrated finish', 'Appliance supplier', null, null, true, 130),
    ('higher_end', 'internal', 'Bathroom', 'Premium bathroom fixtures', 'Wall-hung vanity allowance, upgraded toilet suite, frameless shower screen, mirror cabinet and tapware.', 14000::numeric, null, null, 'Brushed nickel, gunmetal, matte black or chrome', 'Plumbing supplier', null, null, true, 140),
    ('higher_end', 'internal', 'Tiles', 'Premium wall and floor tiling', 'Porcelain tile allowance to wet areas with selected feature tile allowance.', 95::numeric, null, null, 'Premium selected range', 'Tile supplier', null, 'Complex layouts and large format installation to be confirmed.', true, 150),
    ('higher_end', 'internal', 'Paint', 'Premium internal painting', 'Premium internal paint system with selected feature colours included.', null::numeric, null, null, 'Selected premium colours', null, null, null, true, 160),
    ('higher_end', 'internal', 'Window Furnishings', 'Window furnishings allowance', 'Allowance for selected blinds or curtains to nominated rooms.', 6500::numeric, null, null, 'Selected fabric/finish', null, null, null, true, 170),

    -- Higher End services
    ('higher_end', 'services', 'Electrical', 'Upgraded electrical fit-off', 'Upgraded LED lighting, feature pendants allowance, additional power points, data points and smoke alarms.', 12500::numeric, null, null, 'Premium switchgear allowance', 'Electrician', null, null, true, 210),
    ('higher_end', 'services', 'Plumbing', 'Upgraded plumbing fixtures', 'Premium plumbing rough-in and fit-off allowance to included wet areas.', null::numeric, null, null, 'Premium selected fixtures', 'Plumber', null, null, true, 220),
    ('higher_end', 'services', 'HVAC', 'Ducted air conditioning allowance', 'Ducted air conditioning allowance subject to final design, zoning and load requirements.', 18000::numeric, null, null, null, 'HVAC supplier', null, null, true, 230),
    ('higher_end', 'services', 'Insulation', 'Enhanced insulation', 'Enhanced ceiling and wall insulation allowance above minimum statutory requirement where practical.', null::numeric, null, null, null, null, null, null, true, 240),
    ('higher_end', 'services', 'Waterproofing', 'Wet area waterproofing', 'Waterproofing to wet areas in accordance with applicable standards.', null::numeric, null, null, null, null, null, null, true, 250)
  ) as seed(template_key, section_key, category, item_name, description, allowance_amount, brand, model, finish_colour, supplier, image_url, notes, included, sort_order)
)
insert into public.builder_inclusion_template_items (
  template_id,
  section_id,
  workspace_id,
  section,
  category,
  item_name,
  description,
  allowance_amount,
  brand,
  model,
  finish_colour,
  supplier,
  image_url,
  notes,
  included,
  sort_order
)
select
  t.id,
  s.id,
  null,
  s.section_key,
  item_seed.category,
  item_seed.item_name,
  item_seed.description,
  item_seed.allowance_amount,
  item_seed.brand,
  item_seed.model,
  item_seed.finish_colour,
  item_seed.supplier,
  item_seed.image_url,
  item_seed.notes,
  item_seed.included,
  item_seed.sort_order
from item_seed
join template_rows t on t.template_key = item_seed.template_key
join section_rows s on s.template_id = t.id and s.section_key = item_seed.section_key;
