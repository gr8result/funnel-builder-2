-- Seed Gr8 Result platform default standard specifications.
-- These are system defaults only. Builders can copy and customise them later.
-- No builder_products records are created by this seed.

alter table public.builder_standard_specifications
  alter column workspace_id drop not null,
  add column if not exists template_key text,
  add column if not exists is_platform_default boolean not null default false;

alter table public.builder_standard_specification_items
  alter column workspace_id drop not null,
  add column if not exists default_product_name text,
  add column if not exists manufacturer_name text,
  add column if not exists supplier_name text,
  add column if not exists price_band text not null default 'mid_range'
    check (price_band in ('budget', 'mid_range', 'higher_end', 'luxury'));

create unique index if not exists builder_standard_specifications_platform_key_uidx
  on public.builder_standard_specifications(template_key)
  where is_platform_default = true;

drop policy if exists builder_standard_specifications_select on public.builder_standard_specifications;
create policy builder_standard_specifications_select
  on public.builder_standard_specifications for select
  using (is_platform_default = true or public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_standard_specification_items_select on public.builder_standard_specification_items;
create policy builder_standard_specification_items_select
  on public.builder_standard_specification_items for select
  using (
    exists (
      select 1
      from public.builder_standard_specifications s
      where s.id = specification_id
        and (s.is_platform_default = true or public.builder_commercial_is_workspace_member(s.workspace_id))
    )
  );

insert into public.builder_standard_specifications (
  workspace_id,
  template_key,
  specification_name,
  specification_type,
  description,
  price_band,
  is_platform_default,
  active
)
values
  (
    null,
    'mid_range_residential',
    'Mid Range Residential',
    'residential',
    'Gr8 Result default mid range residential inclusions specification.',
    'mid_range',
    true,
    true
  ),
  (
    null,
    'higher_end_residential',
    'Higher End Residential',
    'residential',
    'Gr8 Result default higher end residential inclusions specification.',
    'higher_end',
    true,
    true
  )
on conflict (template_key)
where is_platform_default = true
do update set
  specification_name = excluded.specification_name,
  specification_type = excluded.specification_type,
  description = excluded.description,
  price_band = excluded.price_band,
  active = true,
  updated_at = now();

with category_seed(category_key, category_name, sort_order) as (
  values
    ('roofing', 'Roofing', 40),
    ('gutters', 'Gutters', 50),
    ('fascia', 'Fascia', 51),
    ('downpipes', 'Downpipes', 52),
    ('windows', 'Windows', 60),
    ('garage_doors', 'Garage Doors', 70),
    ('insulation', 'Insulation', 75),
    ('paint', 'Paint', 90),
    ('appliances', 'Appliances', 150),
    ('tapware', 'Tapware', 181),
    ('toilets', 'Toilets', 182),
    ('vanities', 'Vanities', 183),
    ('flooring', 'Flooring', 80),
    ('tiles', 'Tiles', 84)
)
insert into public.builder_product_categories (
  workspace_id,
  category_key,
  category_name,
  sort_order,
  active
)
select
  null,
  category_key,
  category_name,
  sort_order,
  true
from category_seed
on conflict do nothing;

delete from public.builder_standard_specification_items
where specification_id in (
  select id
  from public.builder_standard_specifications
  where template_key in ('mid_range_residential', 'higher_end_residential')
    and is_platform_default = true
);

with spec as (
  select id, template_key
  from public.builder_standard_specifications
  where template_key in ('mid_range_residential', 'higher_end_residential')
    and is_platform_default = true
),
items(template_key, section_name, category_key, item_name, default_product_name, manufacturer_name, supplier_name, price_band, sort_order) as (
  values
    ('mid_range_residential', 'External', 'roofing', 'Roofing', 'Colorbond Corrugated', 'Colorbond', 'Colorbond', 'mid_range', 10),
    ('mid_range_residential', 'External', 'gutters', 'Gutters', 'Colorbond Quad', 'Colorbond', 'Colorbond', 'mid_range', 20),
    ('mid_range_residential', 'External', 'fascia', 'Fascia', 'Colorbond', 'Colorbond', 'Colorbond', 'mid_range', 30),
    ('mid_range_residential', 'External', 'downpipes', 'Downpipes', '90 mm PVC', 'PVC', 'Plumbing supplier', 'mid_range', 40),
    ('mid_range_residential', 'External', 'windows', 'Windows & Sliding Doors', 'Dowell', 'Dowell', 'Dowell', 'mid_range', 50),
    ('mid_range_residential', 'External', 'garage_doors', 'Garage Door', 'B&D', 'B&D', 'B&D', 'mid_range', 60),
    ('mid_range_residential', 'External', 'insulation', 'Wall Insulation', 'Bradford', 'Bradford', 'Bradford', 'mid_range', 70),
    ('mid_range_residential', 'External', 'insulation', 'Roof Insulation', 'Bradford', 'Bradford', 'Bradford', 'mid_range', 80),
    ('mid_range_residential', 'External', 'paint', 'External Paint', 'Dulux', 'Dulux', 'Dulux', 'mid_range', 90),
    ('mid_range_residential', 'Internal', 'appliances', 'Appliances', 'Westinghouse', 'Westinghouse', 'Appliance supplier', 'mid_range', 100),
    ('mid_range_residential', 'Internal', 'tapware', 'Tapware', 'Phoenix Vivid', 'Phoenix', 'Plumbing supplier', 'mid_range', 110),
    ('mid_range_residential', 'Internal', 'toilets', 'Toilets', 'Caroma Luna', 'Caroma', 'Plumbing supplier', 'mid_range', 120),
    ('mid_range_residential', 'Internal', 'vanities', 'Vanities', 'Timberline', 'Timberline', 'Bathroom supplier', 'mid_range', 130),
    ('mid_range_residential', 'Internal', 'paint', 'Paint', 'Dulux Wash & Wear', 'Dulux', 'Dulux', 'mid_range', 140),
    ('mid_range_residential', 'Internal', 'flooring', 'Carpet', 'Godfrey Hirst', 'Godfrey Hirst', 'Flooring supplier', 'mid_range', 150),
    ('mid_range_residential', 'Internal', 'tiles', 'Tiles', 'National Tiles Standard Collection', 'National Tiles', 'National Tiles', 'mid_range', 160),

    ('higher_end_residential', 'External', 'roofing', 'Roofing', 'Premium Colorbond Profile', 'Colorbond', 'Colorbond', 'higher_end', 10),
    ('higher_end_residential', 'External', 'gutters', 'Gutters', 'Premium Colorbond', 'Colorbond', 'Colorbond', 'higher_end', 20),
    ('higher_end_residential', 'External', 'fascia', 'Fascia', 'Premium Colorbond', 'Colorbond', 'Colorbond', 'higher_end', 30),
    ('higher_end_residential', 'External', 'downpipes', 'Downpipes', '90 mm PVC', 'PVC', 'Plumbing supplier', 'higher_end', 40),
    ('higher_end_residential', 'External', 'windows', 'Windows & Sliding Doors', 'Bradnam''s', 'Bradnam''s', 'Bradnam''s', 'higher_end', 50),
    ('higher_end_residential', 'External', 'garage_doors', 'Garage Door', 'B&D Premium', 'B&D', 'B&D', 'higher_end', 60),
    ('higher_end_residential', 'External', 'insulation', 'Wall Insulation', 'Bradford Premium', 'Bradford', 'Bradford', 'higher_end', 70),
    ('higher_end_residential', 'External', 'insulation', 'Roof Insulation', 'Bradford Premium', 'Bradford', 'Bradford', 'higher_end', 80),
    ('higher_end_residential', 'External', 'paint', 'External Paint', 'Dulux Premium', 'Dulux', 'Dulux', 'higher_end', 90),
    ('higher_end_residential', 'Internal', 'appliances', 'Appliances', 'Bosch', 'Bosch', 'Appliance supplier', 'higher_end', 100),
    ('higher_end_residential', 'Internal', 'tapware', 'Tapware', 'Caroma Premium', 'Caroma', 'Plumbing supplier', 'higher_end', 110),
    ('higher_end_residential', 'Internal', 'toilets', 'Toilets', 'Caroma Premium', 'Caroma', 'Plumbing supplier', 'higher_end', 120),
    ('higher_end_residential', 'Internal', 'vanities', 'Vanities', 'Timberline Premium', 'Timberline', 'Bathroom supplier', 'higher_end', 130),
    ('higher_end_residential', 'Internal', 'paint', 'Paint', 'Dulux Premium', 'Dulux', 'Dulux', 'higher_end', 140),
    ('higher_end_residential', 'Internal', 'flooring', 'Carpet', 'Godfrey Hirst Premium', 'Godfrey Hirst', 'Flooring supplier', 'higher_end', 150),
    ('higher_end_residential', 'Internal', 'tiles', 'Tiles', 'National Tiles Premium Collection', 'National Tiles', 'National Tiles', 'higher_end', 160)
)
insert into public.builder_standard_specification_items (
  workspace_id,
  specification_id,
  category_id,
  product_id,
  item_name,
  default_product_name,
  manufacturer_name,
  supplier_name,
  description,
  allowance_amount,
  included,
  sort_order,
  notes,
  price_band,
  active,
  metadata
)
select
  null,
  spec.id,
  category.id,
  null,
  items.item_name,
  items.default_product_name,
  items.manufacturer_name,
  items.supplier_name,
  items.section_name || ' - ' || items.item_name || ': ' || items.default_product_name,
  0,
  true,
  items.sort_order,
  'Platform default specification item. Copy into a workspace specification before customising.',
  items.price_band,
  true,
  jsonb_build_object(
    'section', items.section_name,
    'platform_default', true
  )
from items
join spec on spec.template_key = items.template_key
left join public.builder_product_categories category
  on category.workspace_id is null
  and category.category_key = items.category_key;
