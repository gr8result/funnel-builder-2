-- Colorbond colour range + Monier tile range seed data.
-- Additive only. The categories these belong to (roof_colour, roof_tile_range,
-- roof_tile_colour, gutters_colour, fascia_colour, downpipes_colour,
-- roof_material) were created empty by 20260729_guided_selections_workflow.sql
-- — the guided workflow's Colorbond/Monier examples had nowhere to select
-- from until real rows exist. Colour names and swatch hex approximations are
-- BlueScope's published Colorbond(R) steel range and Monier's long-standing
-- concrete roof tile range names — real, publicly documented product/colour
-- names, not invented. Pricing/allowance is intentionally $0 (unset) and
-- verification_status is 'unverified' (no licensed product photography or
-- confirmed current pricing exists here yet) — this surfaces correctly in
-- the Client Selections Library's media/verification report so an admin
-- knows exactly what still needs a real photo and allowance figure, rather
-- than silently presenting placeholder data as verified.

insert into public.builder_product_manufacturers (workspace_id, manufacturer_name)
values (null, 'Colorbond'), (null, 'Monier')
on conflict (manufacturer_name) where workspace_id is null do nothing;

-- Roof material — the top-level choice the brief's example starts with.
insert into public.builder_products (workspace_id, product_name, category_id, cost_price, base_allowance, upgrade_value_mode, library_scope, is_visual_product, requires_image, verification_status, active, standard_included, source_type)
select null, name, category.id, 0, 0, 'auto', 'CLIENT_SELECTION', true, true, 'unverified', true, standard, 'manual'
from (values
  ('Colorbond Steel', true),
  ('Concrete Roof Tiles', false),
  ('Terracotta Roof Tiles', false)
) as material(name, standard)
join public.builder_product_categories category on category.category_key = 'roof_material' and category.workspace_id is null
where not exists (select 1 from public.builder_products p where p.workspace_id is null and p.product_name = material.name);

-- Roof profile (Colorbond steel profiles).
insert into public.builder_products (workspace_id, product_name, category_id, manufacturer_id, cost_price, base_allowance, upgrade_value_mode, library_scope, is_visual_product, requires_image, verification_status, active, standard_included, source_type)
select null, name, category.id, manufacturer.id, 0, 0, 'auto', 'CLIENT_SELECTION', true, true, 'unverified', true, standard, 'manual'
from (values
  ('Corrugated', true),
  ('Trimdek', false),
  ('Klip-Lok', false)
) as profile(name, standard)
join public.builder_product_categories category on category.category_key = 'roof_profile' and category.workspace_id is null
join public.builder_product_manufacturers manufacturer on manufacturer.manufacturer_name = 'Colorbond' and manufacturer.workspace_id is null
where not exists (select 1 from public.builder_products p where p.workspace_id is null and p.product_name = name);

-- Colorbond(R) colour range — real published colour names. Seeded for roof
-- colour and reused (as separate product rows, since they're physically
-- different items) for gutters/fascia/downpipes so a matching colour can be
-- suggested across all four, per the brief, while still letting the designer
-- choose a different colour for each independently.
with colorbond_colours(colour_name, swatch_hex) as (
  values
    ('Surfmist', '#e5e0d3'),
    ('Shale Grey', '#9a9a94'),
    ('Dune', '#8a7d6b'),
    ('Windspray', '#7c8285'),
    ('Wallaby', '#7a7367'),
    ('Basalt', '#54595c'),
    ('Woodland Grey', '#4c4c48'),
    ('Monument', '#323233'),
    ('Night Sky', '#1c1c1c'),
    ('Classic Cream', '#e8dcb8'),
    ('Cottage Green', '#37473a'),
    ('Manor Red', '#6b2a26'),
    ('Deep Ocean', '#1f2e35'),
    ('Jasper', '#5b3a2e')
),
colour_categories(category_key, name_suffix) as (
  values
    ('roof_colour', 'Roofing'),
    ('gutters_colour', 'Gutter'),
    ('fascia_colour', 'Fascia'),
    ('downpipes_colour', 'Downpipe')
)
insert into public.builder_products (
  workspace_id, product_name, category_id, manufacturer_id, colour,
  cost_price, base_allowance, upgrade_value_mode, library_scope,
  is_visual_product, requires_image, verification_status, active, standard_included, source_type
)
select
  null,
  'Colorbond ' || colour.colour_name || ' ' || cat.name_suffix,
  category.id,
  manufacturer.id,
  colour.swatch_hex,
  0, 0, 'auto', 'CLIENT_SELECTION',
  true, true, 'unverified', true,
  colour.colour_name = 'Surfmist',
  'manual'
from colorbond_colours colour
cross join colour_categories cat
join public.builder_product_categories category on category.category_key = cat.category_key and category.workspace_id is null
join public.builder_product_manufacturers manufacturer on manufacturer.manufacturer_name = 'Colorbond' and manufacturer.workspace_id is null
where not exists (
  select 1 from public.builder_products p
  where p.workspace_id is null and p.product_name = 'Colorbond ' || colour.colour_name || ' ' || cat.name_suffix
);

-- Monier concrete roof tile ranges (product-type level) and a representative
-- colour set (profile/finish varies by range in reality — left for admin
-- completion per-range, matching the brief's "administration workflow for
-- importing real product records" rather than guessing per-range specifics).
insert into public.builder_products (workspace_id, product_name, category_id, manufacturer_id, cost_price, base_allowance, upgrade_value_mode, library_scope, is_visual_product, requires_image, verification_status, active, source_type)
select null, 'Monier ' || name, category.id, manufacturer.id, 0, 0, 'auto', 'CLIENT_SELECTION', true, true, 'unverified', true, 'manual'
from (values ('Horizon'), ('Elabana'), ('Shingle')) as tile_range(name)
join public.builder_product_categories category on category.category_key = 'roof_tile_range' and category.workspace_id is null
join public.builder_product_manufacturers manufacturer on manufacturer.manufacturer_name = 'Monier' and manufacturer.workspace_id is null
where not exists (select 1 from public.builder_products p where p.workspace_id is null and p.product_name = 'Monier ' || name);

with monier_colours(colour_name, swatch_hex) as (
  values
    ('Barramundi', '#7d746a'),
    ('Charcoal', '#3a3a3a'),
    ('Terrain', '#8a6f56'),
    ('Bushland', '#5c6650')
)
insert into public.builder_products (workspace_id, product_name, category_id, manufacturer_id, colour, cost_price, base_allowance, upgrade_value_mode, library_scope, is_visual_product, requires_image, verification_status, active, source_type)
select null, 'Monier ' || colour_name, category.id, manufacturer.id, swatch_hex, 0, 0, 'auto', 'CLIENT_SELECTION', true, true, 'unverified', true, 'manual'
from monier_colours
join public.builder_product_categories category on category.category_key = 'roof_tile_colour' and category.workspace_id is null
join public.builder_product_manufacturers manufacturer on manufacturer.manufacturer_name = 'Monier' and manufacturer.workspace_id is null
where not exists (select 1 from public.builder_products p where p.workspace_id is null and p.product_name = 'Monier ' || colour_name);
