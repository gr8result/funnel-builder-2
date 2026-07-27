-- Guided Client Selections workflow — additive only.
-- Adds: category selection-control-type, the admin-editable required-
-- selections checklist (data, not code), the missing External-group
-- categories, and a one-time import of the Quotation Builder's static
-- appliance seed (lib/construction-estimation/appliancePackageRows.json)
-- into the real builder_products catalogue so Estimating and Client
-- Selections share one appliance list instead of two unrelated ones.
-- EstimateBuilderWorkbook.js itself is not touched by this migration and
-- keeps reading its own static JSON — this is a one-time data import, not a
-- live sync (see plan for why).

-- 1. Category selection-control-type: cards / swatches / dropdown.
alter table public.builder_product_categories
  add column if not exists selection_control_type text
    check (selection_control_type in ('cards', 'swatches', 'dropdown'));

update public.builder_product_categories
set selection_control_type = 'swatches'
where selection_control_type is null
  and (category_key ilike '%colour%' or category_key ilike '%finish%' or category_key = 'paint_finishes');

update public.builder_product_categories
set selection_control_type = 'cards'
where selection_control_type is null;

-- 2. External-group categories that were never seeded — the brief's own
-- Colorbond/roofing/facade examples have nowhere to live without these.
insert into public.builder_product_categories (workspace_id, category_key, category_name, selection_group, sort_order, metadata, library_scope)
values
  (null, 'roof_material', 'Roof Material', 'External', 10, '{"default_requires_image": false}', 'CLIENT_SELECTION'),
  (null, 'roof_profile', 'Roof Profile', 'External', 12, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'roof_colour', 'Roof Colour', 'External', 14, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'roof_tile_range', 'Roof Tile Range', 'External', 16, '{"default_requires_image": false}', 'CLIENT_SELECTION'),
  (null, 'roof_tile_colour', 'Roof Tile Colour', 'External', 18, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'gutters_colour', 'Gutters', 'External', 20, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'fascia_colour', 'Fascia', 'External', 22, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'downpipes_colour', 'Downpipes', 'External', 24, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'external_wall_material', 'External Wall Material', 'External', 26, '{"default_requires_image": false}', 'CLIENT_SELECTION'),
  (null, 'brick_selection', 'Brick Selection', 'External', 28, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'render_colour', 'Render Colour', 'External', 30, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'cladding_profile', 'Cladding Profile', 'External', 32, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'cladding_colour', 'Cladding Colour', 'External', 34, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'window_frame_colour', 'Window Frame Colour', 'External', 36, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'window_glass_options', 'Window Glass Options', 'External', 38, '{"default_requires_image": false}', 'CLIENT_SELECTION'),
  (null, 'flyscreens', 'Flyscreens', 'External', 40, '{"default_requires_image": false}', 'CLIENT_SELECTION'),
  (null, 'security_screens', 'Security Screens', 'External', 42, '{"default_requires_image": false}', 'CLIENT_SELECTION'),
  (null, 'garage_door_profile', 'Garage Door Profile', 'External', 44, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'garage_door_colour', 'Garage Door Colour', 'External', 46, '{"default_requires_image": true}', 'CLIENT_SELECTION'),
  (null, 'retaining_wall_finish', 'Retaining Wall Finish', 'External', 48, '{"default_requires_image": true}', 'CLIENT_SELECTION')
on conflict do nothing;

update public.builder_product_categories
set selection_control_type = 'swatches'
where selection_control_type is null
  and category_key in ('roof_colour','roof_tile_colour','gutters_colour','fascia_colour','downpipes_colour','render_colour','cladding_colour','window_frame_colour','garage_door_colour');
update public.builder_product_categories
set selection_control_type = 'cards'
where selection_control_type is null;

-- 3. Required-selections checklist — data, not code. Admin-editable
-- (add/rename/reorder/require/deactivate). Platform-default rows
-- (workspace_id null) seed every workspace; a workspace can add its own.
create table if not exists public.builder_selection_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  selection_group text not null,
  room text,
  item_label text not null,
  category_id uuid references public.builder_product_categories(id) on delete set null,
  required boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  builder_standard_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists builder_selection_checklist_items_workspace_idx on public.builder_selection_checklist_items(workspace_id);
create index if not exists builder_selection_checklist_items_group_idx on public.builder_selection_checklist_items(selection_group, sort_order);
create index if not exists builder_selection_checklist_items_category_idx on public.builder_selection_checklist_items(category_id) where category_id is not null;

alter table public.builder_selection_checklist_items enable row level security;

drop policy if exists builder_selection_checklist_items_select on public.builder_selection_checklist_items;
create policy builder_selection_checklist_items_select
  on public.builder_selection_checklist_items for select
  using (workspace_id is null or public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_selection_checklist_items_insert on public.builder_selection_checklist_items;
create policy builder_selection_checklist_items_insert
  on public.builder_selection_checklist_items for insert
  with check (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_selection_checklist_items_update on public.builder_selection_checklist_items;
create policy builder_selection_checklist_items_update
  on public.builder_selection_checklist_items for update
  using (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id))
  with check (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_selection_checklist_items_delete on public.builder_selection_checklist_items;
create policy builder_selection_checklist_items_delete
  on public.builder_selection_checklist_items for delete
  using (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id));

-- Checklist seed: (selection_group, room, item_label, category_key). Mapped
-- against categories already seeded by the 2026-07-26 Client Selections
-- Library migration plus the External categories added above. Resolved to
-- category_id via a join below; a category_key with no matching row leaves
-- category_id null rather than guessing.
with checklist_seed(selection_group, room, item_label, category_key, seed_order) as (
  values
    ('External', null, 'Roof material', 'roof_material', 1),
    ('External', null, 'Roof profile', 'roof_profile', 2),
    ('External', null, 'Roof colour', 'roof_colour', 3),
    ('External', null, 'Roof-tile range', 'roof_tile_range', 4),
    ('External', null, 'Roof-tile colour', 'roof_tile_colour', 5),
    ('External', null, 'Gutters', 'gutters_colour', 6),
    ('External', null, 'Fascia', 'fascia_colour', 7),
    ('External', null, 'Downpipes', 'downpipes_colour', 8),
    ('External', null, 'External wall material', 'external_wall_material', 9),
    ('External', null, 'Brick selection', 'brick_selection', 10),
    ('External', null, 'Render colour', 'render_colour', 11),
    ('External', null, 'Cladding profile', 'cladding_profile', 12),
    ('External', null, 'Cladding colour', 'cladding_colour', 13),
    ('External', null, 'Window-frame colour', 'window_frame_colour', 14),
    ('External', null, 'Window glass options', 'window_glass_options', 15),
    ('External', null, 'Flyscreens', 'flyscreens', 16),
    ('External', null, 'Security screens', 'security_screens', 17),
    ('External', null, 'Garage-door profile', 'garage_door_profile', 18),
    ('External', null, 'Garage-door colour', 'garage_door_colour', 19),
    ('External', null, 'Entry-door design', 'entrance_doors', 20),
    ('External', null, 'Entry-door colour', 'door_finishes', 21),
    ('External', null, 'Entry-door hardware', 'door_handles', 22),
    ('External', null, 'External door hardware', 'door_handles', 23),
    ('External', null, 'External paint colours', 'external_colours', 24),
    ('External', null, 'Retaining-wall visible system', 'retaining_wall_finish', 25),

    ('Kitchen', 'Kitchen', 'Oven', 'ovens', 30),
    ('Kitchen', 'Kitchen', 'Cooktop', 'cooktops', 31),
    ('Kitchen', 'Kitchen', 'Rangehood', 'rangehoods', 32),
    ('Kitchen', 'Kitchen', 'Dishwasher', 'dishwashers', 33),
    ('Kitchen', 'Kitchen', 'Microwave', 'microwaves', 34),
    ('Kitchen', 'Kitchen', 'Refrigerator', 'refrigerators', 35),
    ('Kitchen', 'Kitchen', 'Kitchen sink', 'kitchen_sinks', 36),
    ('Kitchen', 'Kitchen', 'Kitchen mixer', 'kitchen_tapware', 37),
    ('Kitchen', 'Kitchen', 'Cabinet door profile', 'cabinet_finishes', 38),
    ('Kitchen', 'Kitchen', 'Cabinet colour', 'cabinet_finishes', 39),
    ('Kitchen', 'Kitchen', 'Cabinet finish', 'cabinet_finishes', 40),
    ('Kitchen', 'Kitchen', 'Cabinet handles', 'cabinet_handles', 41),
    ('Kitchen', 'Kitchen', 'Benchtop material', 'benchtops', 42),
    ('Kitchen', 'Kitchen', 'Benchtop colour', 'benchtops', 43),
    ('Kitchen', 'Kitchen', 'Benchtop edge', 'benchtops', 44),
    ('Kitchen', 'Kitchen', 'Splashback', 'splashbacks', 45),
    ('Kitchen', 'Kitchen', 'Pantry configuration', 'cabinetry', 46),
    ('Kitchen', 'Kitchen', 'Feature lighting', 'feature_lighting', 47),

    ('Laundry', 'Laundry', 'Laundry tub', 'laundry_tubs', 50),
    ('Laundry', 'Laundry', 'Laundry mixer', 'laundry_tapware', 51),
    ('Laundry', 'Laundry', 'Cabinet colour', 'laundry_cabinetry', 52),
    ('Laundry', 'Laundry', 'Cabinet handles', 'laundry_cabinetry', 53),
    ('Laundry', 'Laundry', 'Benchtop', 'laundry_benchtops', 54),
    ('Laundry', 'Laundry', 'Splashback', 'splashbacks', 55),
    ('Laundry', 'Laundry', 'Flooring', 'floor_tiles', 56),

    ('Bathrooms', 'Main Bathroom', 'Toilet', 'toilets', 60),
    ('Bathrooms', 'Main Bathroom', 'Vanity', 'vanity_units', 61),
    ('Bathrooms', 'Main Bathroom', 'Vanity colour', 'vanity_units', 62),
    ('Bathrooms', 'Main Bathroom', 'Vanity benchtop', 'vanity_units', 63),
    ('Bathrooms', 'Main Bathroom', 'Basin', 'basins', 64),
    ('Bathrooms', 'Main Bathroom', 'Basin mixer', 'mixers', 65),
    ('Bathrooms', 'Main Bathroom', 'Shower mixer', 'mixers', 66),
    ('Bathrooms', 'Main Bathroom', 'Shower rail', 'shower_rails', 67),
    ('Bathrooms', 'Main Bathroom', 'Shower head', 'shower_heads', 68),
    ('Bathrooms', 'Main Bathroom', 'Bath', 'baths', 69),
    ('Bathrooms', 'Main Bathroom', 'Bath mixer', 'mixers', 70),
    ('Bathrooms', 'Main Bathroom', 'Shower screen', 'shower_screens', 71),
    ('Bathrooms', 'Main Bathroom', 'Mirror', 'mirrors', 72),
    ('Bathrooms', 'Main Bathroom', 'Accessories', 'bathroom_accessories', 73),
    ('Bathrooms', 'Main Bathroom', 'Floor tile', 'floor_tiles', 74),
    ('Bathrooms', 'Main Bathroom', 'Wall tile', 'wall_tiles', 75),
    ('Bathrooms', 'Main Bathroom', 'Feature tile', 'wall_tiles', 76),
    ('Bathrooms', 'Main Bathroom', 'Grout colour', 'wall_tiles', 77),

    ('Bathrooms', 'Ensuite', 'Toilet', 'toilets', 80),
    ('Bathrooms', 'Ensuite', 'Vanity', 'vanity_units', 81),
    ('Bathrooms', 'Ensuite', 'Vanity colour', 'vanity_units', 82),
    ('Bathrooms', 'Ensuite', 'Vanity benchtop', 'vanity_units', 83),
    ('Bathrooms', 'Ensuite', 'Basin', 'basins', 84),
    ('Bathrooms', 'Ensuite', 'Basin mixer', 'mixers', 85),
    ('Bathrooms', 'Ensuite', 'Shower mixer', 'mixers', 86),
    ('Bathrooms', 'Ensuite', 'Shower rail', 'shower_rails', 87),
    ('Bathrooms', 'Ensuite', 'Shower head', 'shower_heads', 88),
    ('Bathrooms', 'Ensuite', 'Shower screen', 'shower_screens', 89),
    ('Bathrooms', 'Ensuite', 'Mirror', 'mirrors', 90),
    ('Bathrooms', 'Ensuite', 'Accessories', 'bathroom_accessories', 91),
    ('Bathrooms', 'Ensuite', 'Floor tile', 'floor_tiles', 92),
    ('Bathrooms', 'Ensuite', 'Wall tile', 'wall_tiles', 93),
    ('Bathrooms', 'Ensuite', 'Feature tile', 'wall_tiles', 94),
    ('Bathrooms', 'Ensuite', 'Grout colour', 'wall_tiles', 95),

    ('Bathrooms', 'Powder Room', 'Toilet', 'toilets', 100),
    ('Bathrooms', 'Powder Room', 'Basin', 'basins', 101),
    ('Bathrooms', 'Powder Room', 'Basin mixer', 'mixers', 102),
    ('Bathrooms', 'Powder Room', 'Mirror', 'mirrors', 103),
    ('Bathrooms', 'Powder Room', 'Accessories', 'bathroom_accessories', 104),
    ('Bathrooms', 'Powder Room', 'Floor tile', 'floor_tiles', 105),
    ('Bathrooms', 'Powder Room', 'Wall tile', 'wall_tiles', 106),

    ('Flooring', null, 'Carpet range', 'carpet', 110),
    ('Flooring', null, 'Carpet colour', 'carpet', 111),
    ('Flooring', null, 'Hybrid flooring range', 'hybrid_flooring', 112),
    ('Flooring', null, 'Hybrid flooring colour', 'hybrid_flooring', 113),
    ('Flooring', null, 'Timber flooring', 'timber_flooring', 114),
    ('Flooring', null, 'Vinyl', 'vinyl_flooring', 115),
    ('Flooring', null, 'Laminate', 'laminate_flooring', 116),
    ('Flooring', null, 'Floor tiles', 'floor_tiles', 117),
    ('Flooring', null, 'Skirting finish', 'door_finishes', 118),

    ('Doors and hardware', null, 'Internal-door style', 'internal_doors', 120),
    ('Doors and hardware', null, 'Internal-door colour', 'internal_doors', 121),
    ('Doors and hardware', null, 'Door handles', 'door_handles', 122),
    ('Doors and hardware', null, 'Privacy sets', 'locks', 123),
    ('Doors and hardware', null, 'Wardrobe doors', 'wardrobe_sliding_doors', 124),
    ('Doors and hardware', null, 'Wardrobe finishes', 'wardrobe_handles_finishes', 125),

    ('Electrical and lighting', null, 'Switch range', 'switches', 130),
    ('Electrical and lighting', null, 'Power-point range', 'power_points', 131),
    ('Electrical and lighting', null, 'Switch colour', 'switches', 132),
    ('Electrical and lighting', null, 'Downlights', 'downlights', 133),
    ('Electrical and lighting', null, 'Pendant lights', 'pendant_lights', 134),
    ('Electrical and lighting', null, 'Ceiling fans', 'ceiling_fans', 135),
    ('Electrical and lighting', null, 'Exhaust fans', 'exhaust_fans', 136),
    ('Electrical and lighting', null, 'Feature lighting', 'feature_lighting', 137),
    ('Electrical and lighting', null, 'External lighting', 'feature_lighting', 138),

    ('Painting and colours', null, 'Internal wall colour', 'internal_colours', 140),
    ('Painting and colours', null, 'Ceiling colour', 'internal_colours', 141),
    ('Painting and colours', null, 'Trim colour', 'internal_colours', 142),
    ('Painting and colours', null, 'Door colour', 'door_finishes', 143),
    ('Painting and colours', null, 'Feature-wall colours', 'feature_walls', 144),
    ('Painting and colours', null, 'External colours', 'external_colours', 145),

    ('Wardrobes', null, 'Door type', 'wardrobe_sliding_doors', 150),
    ('Wardrobes', null, 'Door finish', 'wardrobe_handles_finishes', 151),
    ('Wardrobes', null, 'Internal shelving', 'wardrobe_shelving', 152),
    ('Wardrobes', null, 'Drawer configuration', 'wardrobe_fitouts', 153),
    ('Wardrobes', null, 'Hanging configuration', 'wardrobe_fitouts', 154),

    ('Climate', null, 'Air-conditioning outlets', 'air_conditioning', 160),
    ('Climate', null, 'Controllers', 'air_conditioning', 161),
    ('Climate', null, 'Fireplace model and finish', 'fireplaces', 162)
)
insert into public.builder_selection_checklist_items (workspace_id, selection_group, room, item_label, category_id, sort_order)
select null, seed.selection_group, seed.room, seed.item_label, category.id, seed.seed_order
from checklist_seed seed
left join public.builder_product_categories category
  on category.category_key = seed.category_key and category.workspace_id is null
where not exists (
  select 1 from public.builder_selection_checklist_items existing
  where existing.workspace_id is null
    and existing.selection_group = seed.selection_group
    and coalesce(existing.room, '') = coalesce(seed.room, '')
    and existing.item_label = seed.item_label
);

-- 4. One-time appliance catalogue import from the Quotation Builder's static
-- seed file (lib/construction-estimation/appliancePackageRows.json),
-- library_scope='BOTH' so the same row is visible to both Estimating and
-- Client Selections. Deduplicated against pack-summary rows (kept only
-- individual "- BRAND ... MODEL" lines) and against repeated appearances of
-- the same appliance across multiple packs. Brand corrected against the
-- item's own name where the source JSON's brand field is wrong (a known
-- copy-paste data issue: several OMEGA/BLANCO/WESTINGHOUSE/SMEG rows carry
-- brand:"ARISTON" in the source file) — the item name is per-row authored
-- text, not a template copy, so it's the more reliable of the two fields.
-- Width/fuel-type are deliberately NOT parsed out of the free-text name —
-- per the brief, that would be inventing structured data rather than using
-- what was actually recorded; those fields are left for admin CSV/manual
-- entry.
insert into public.builder_product_manufacturers (workspace_id, manufacturer_name)
values (null, 'EUROMAID'), (null, 'ARISTON'), (null, 'OMEGA'), (null, 'BLANCO'), (null, 'WESTINGHOUSE'), (null, 'SMEG')
on conflict (manufacturer_name) where workspace_id is null do nothing;

with appliance_seed(product_name, category_key, brand, model, cost_price) as (
  values
  ('EUROMAID 60CM 5 FUNCTION BUILT-IN OVEN EO605DTB', 'ovens', 'EUROMAID', 'EO605DTB', 500),
  ('EUROMAID 60CM CERAMIC COOKTOP KCS4', 'cooktops', 'EUROMAID', 'KCS4', 336),
  ('EUROMAID 60CM SLIDE OUT RANGEHOOD RS6S', 'rangehoods', 'EUROMAID', 'RS6S', 249),
  ('EUROMAID 60CM DISHWASHER EDW14S', 'dishwashers', 'EUROMAID', 'EDW14S', 599),
  ('EUROMAID 60CM GAS COOKTOP WK60S', 'cooktops', 'EUROMAID', 'WK60S', 250),
  ('EUROMAID 90CM BUILT-IN OVEN EO916ASTB', 'ovens', 'EUROMAID', 'EO916ASTB', 1199),
  ('EUROMAID 90CM CERAMIC COOKTOP ECCK900', 'cooktops', 'EUROMAID', 'ECCK900', 899),
  ('EUROMAID 90CM SLIDE OUT RANGEHOOD RS9S', 'rangehoods', 'EUROMAID', 'RS9S', 399),
  ('EUROMAID 90CM GAS COOKTOP GC90S', 'cooktops', 'EUROMAID', 'GC90S', 599),
  ('EUROMAID 90CM DUAL FUEL FREESTANDING COOKER GG90S', 'ovens', 'EUROMAID', 'GG90S', 1699),
  ('EUROMAID 90CM PYRAMID CANOPY RANGEHOOD CPT9MB', 'rangehoods', 'EUROMAID', 'CPT9MB', 505),
  ('EUROMAID 90CM FIXED/UNDERCUPBOARD RANGEHOOD FS90S', 'rangehoods', 'EUROMAID', 'FS90S', 299),
  ('ARISTON 60CM ELECTRIC OVEN FA5834HIXAAUS', 'ovens', 'ARISTON', 'FA5834HIXAAUS', 1199),
  ('ARISTON 60CM ELECTRIC COOKTOP PF604IX', 'cooktops', 'ARISTON', 'PF604IX', 699),
  ('ARISTON 60CM SLIDE OUT RANGEHOOD ARHS60X', 'rangehoods', 'ARISTON', 'ARHS60X', 399),
  ('ARISTON 60CM DISHWASHER LFO3C23WF', 'dishwashers', 'ARISTON', 'LFO3C23WF', 799),
  ('ARISTON 60CM GAS COOKTOP PC640NTX', 'cooktops', 'ARISTON', 'PC640NTX', 699),
  ('ARISTON 90CM BUILT-IN OVEN FI9 891 SP IX A AUS', 'ovens', 'ARISTON', null, 1899),
  ('ARISTON 90CM INDUCTION COOKTOP NIO 844 DO B AUS', 'cooktops', 'ARISTON', null, 1399),
  ('ARISTON 90CM SLIDE OUT RANGEHOOD ARHS90X', 'rangehoods', 'ARISTON', 'ARHS90X', 499),
  ('ARISTON 90CM GAS COOKTOP PKQ 755 D GH AUS', 'cooktops', 'ARISTON', null, 999),
  ('ARISTON 90CM DUAL FUEL FREESTANDING COOKER CP059MDX', 'ovens', 'ARISTON', 'CP059MDX', 2899),
  ('ARISTON 90CM CANOPY RANGEHOOD ARHC90X', 'rangehoods', 'ARISTON', 'ARHC90X', 699),
  ('ARISTON 90CM UNDER CUPBOARD RANGEHOOD ARU90X', 'rangehoods', 'ARISTON', 'ARU90X', 499),
  ('OMEGA 60CM 4 FUNCTION OVEN OBO660X', 'ovens', 'OMEGA', 'OBO660X', 599),
  ('OMEGA 60CM INDUCTION COOKTOP OCI64Z', 'cooktops', 'OMEGA', 'OCI64Z', 899),
  ('OMEGA 60CM SLIDE OUT RANGEHOOD ORT6WBA', 'rangehoods', 'OMEGA', 'ORT6WBA', 299),
  ('OMEGA 60CM FREESTANDING DISHWASHER ODW702XB', 'dishwashers', 'OMEGA', 'ODW702XB', 699),
  ('OMEGA 60CM 4 BURNER GAS COOKTOP OCG604X', 'cooktops', 'OMEGA', 'OCG604X', 399),
  ('OMEGA 90CM 9 FUNCTION OVEN OBO960X1', 'ovens', 'OMEGA', 'OBO960X1', 1199),
  ('OMEGA 90CM INDUCTION COOKTOP OI90Z', 'cooktops', 'OMEGA', 'OI90Z', 1399),
  ('OMEGA 90CM SLIDE OUT RANGEHOOD ORT9WXA', 'rangehoods', 'OMEGA', 'ORT9WXA', 399),
  ('OMEGA 90CM 9 FUNCTION FREESTANDING OVEN OF916FX', 'ovens', 'OMEGA', 'OF916FX', 1899),
  ('OMEGA 90CM CANOPY RANGEHOOD ORC90X', 'rangehoods', 'OMEGA', 'ORC90X', 549),
  ('OMEGA 90CM FIXED RANGEHOOD ORF90X', 'rangehoods', 'OMEGA', 'ORF90X', 349),
  ('BLANCO 60CM ELECTRIC OVEN BOSE65XM', 'ovens', 'BLANCO', 'BOSE65XM', 899),
  ('BLANCO 60CM CERAMIC COOKTOP BCC604T', 'cooktops', 'BLANCO', 'BCC604T', 599),
  ('BLANCO 60CM SLIDE OUT RANGEHOOD BRU53X', 'rangehoods', 'BLANCO', 'BRU53X', 449),
  ('BLANCO 60CM FREESTANDING DISHWASHER BDW146X', 'dishwashers', 'BLANCO', 'BDW146X', 799),
  ('BLANCO 60CM GAS COOKTOP BCG604WX', 'cooktops', 'BLANCO', 'BCG604WX', 599),
  ('BLANCO 90CM ELECTRIC OVEN BOSE90X', 'ovens', 'BLANCO', 'BOSE90X', 1599),
  ('BLANCO 90CM INDUCTION COOKTOP BIC90X', 'cooktops', 'BLANCO', 'BIC90X', 1499),
  ('BLANCO 90CM SLIDE OUT RANGEHOOD BRU90X', 'rangehoods', 'BLANCO', 'BRU90X', 599),
  ('BLANCO 90CM GAS COOKTOP BCG905WX', 'cooktops', 'BLANCO', 'BCG905WX', 899),
  ('BLANCO 90CM DUAL FUEL FREESTANDING COOKER BFS90WX', 'ovens', 'BLANCO', 'BFS90WX', 2499),
  ('BLANCO 90CM CANOPY RANGEHOOD BRC90X', 'rangehoods', 'BLANCO', 'BRC90X', 799),
  ('BLANCO 90CM UNDERMOUNT RANGEHOOD BRU90UX', 'rangehoods', 'BLANCO', 'BRU90UX', 899),
  ('WESTINGHOUSE 60CM MULTIFUNCTION OVEN WVE6314DD', 'ovens', 'WESTINGHOUSE', 'WVE6314DD', 799),
  ('WESTINGHOUSE 60CM CERAMIC COOKTOP WHC642BC', 'cooktops', 'WESTINGHOUSE', 'WHC642BC', 699),
  ('WESTINGHOUSE 60CM SLIDEOUT RANGEHOOD WRR614SB', 'rangehoods', 'WESTINGHOUSE', 'WRR614SB', 449),
  ('WESTINGHOUSE 60CM FREESTANDING DISHWASHER WSF6606X', 'dishwashers', 'WESTINGHOUSE', 'WSF6606X', 799),
  ('WESTINGHOUSE 60CM GAS COOKTOP WHG644SC', 'cooktops', 'WESTINGHOUSE', 'WHG644SC', 699),
  ('WESTINGHOUSE 90CM ELECTRIC OVEN WVE916SC', 'ovens', 'WESTINGHOUSE', 'WVE916SC', 1999),
  ('WESTINGHOUSE 90CM INDUCTION COOKTOP WHI955BD', 'cooktops', 'WESTINGHOUSE', 'WHI955BD', 1799),
  ('WESTINGHOUSE 90CM SLIDEOUT RANGEHOOD WRI930SB', 'rangehoods', 'WESTINGHOUSE', 'WRI930SB', 599),
  ('WESTINGHOUSE 90CM GAS COOKTOP WHG958SC', 'cooktops', 'WESTINGHOUSE', 'WHG958SC', 1099),
  ('WESTINGHOUSE 90CM DUAL FUEL FREESTANDING COOKER WFE9515SD', 'ovens', 'WESTINGHOUSE', 'WFE9515SD', 1444),
  ('WESTINGHOUSE 90CM CANOPY RANGEHOOD WRC914SD', 'rangehoods', 'WESTINGHOUSE', 'WRC914SD', 599),
  ('WESTINGHOUSE 90CM FIXED RANGEHOOD WRF910WA', 'rangehoods', 'WESTINGHOUSE', 'WRF910WA', 298),
  ('SMEG 60CM CLASSIC ELECTRIC OVEN SF64M3TVX', 'ovens', 'SMEG', 'SF64M3TVX', 1299),
  ('SMEG 60CM INDUCTION COOKTOP SI2641D', 'cooktops', 'SMEG', 'SI2641D', 1299),
  ('SMEG 60CM SLIDEOUT RANGEHOOD STH600X', 'rangehoods', 'SMEG', 'STH600X', 899),
  ('SMEG 60CM FREESTANDING DISHWASHER DWAU6315X3', 'dishwashers', 'SMEG', 'DWAU6315X3', 1599),
  ('SMEG 60CM GAS COOKTOP PGA64', 'cooktops', 'SMEG', 'PGA64', 1199),
  ('SMEG 90CM CLASSIC THERMOSEAL OVEN SFPA9395X1', 'ovens', 'SMEG', 'SFPA9395X1', 3999),
  ('SMEG 90CM INDUCTION COOKTOP SAI4954D', 'cooktops', 'SMEG', 'SAI4954D', 3299),
  ('SMEG 90CM SLIDEOUT RANGEHOOD STH900X', 'rangehoods', 'SMEG', 'STH900X', 1199),
  ('SMEG 90CM GAS COOKTOP PGA95', 'cooktops', 'SMEG', 'PGA95', 1999),
  ('SMEG 90CM DUAL FUEL FREESTANDING COOKER FS9606AS-1', 'ovens', 'SMEG', 'FS9606AS-1', 2690),
  ('SMEG 90CM CANOPY RANGEHOOD SHW910X2', 'rangehoods', 'SMEG', 'SHW910X2', 1750),
  ('SMEG 90CM UNDERMOUNT RANGEHOOD PUM901X', 'rangehoods', 'SMEG', 'PUM901X', 1499)
)
insert into public.builder_products (
  workspace_id, product_name, category_id, manufacturer_id, model, sku,
  cost_price, base_allowance, upgrade_value_mode, library_scope,
  is_visual_product, requires_image, verification_status, active,
  source_type
)
select
  null, seed.product_name, category.id, manufacturer.id, seed.model, seed.model,
  seed.cost_price, 0, 'auto', 'BOTH',
  true, true, 'unverified', true,
  'manual'
from appliance_seed seed
left join public.builder_product_categories category
  on category.category_key = seed.category_key and category.workspace_id is null
left join public.builder_product_manufacturers manufacturer
  on manufacturer.manufacturer_name = seed.brand and manufacturer.workspace_id is null
where not exists (
  select 1 from public.builder_products existing
  where existing.workspace_id is null and existing.product_name = seed.product_name
);
