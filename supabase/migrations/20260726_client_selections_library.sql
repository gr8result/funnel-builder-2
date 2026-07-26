-- Client Selections Library rebuild — additive only.
-- Adds the remaining product fields, selection-group taxonomy, standard-inclusion
-- conflict protection, and a versioned final inclusions schedule store.
-- Does not drop, rename, or retype any existing column and does not touch
-- Estimate Builder, Takeoff, Website Builder, or unrelated data.

-- 1. Remaining Client Selections product fields from the brief that had no column yet.
--    (product_name, description, sku, model, cost_price, base_allowance, upgrade_cost,
--    pricing_tier, library_scope, primary_image_url, datasheet_pdf_url, notes,
--    standard_included, active already exist — not re-added.)
alter table public.builder_products
  add column if not exists colour text,
  add column if not exists finish text,
  add column if not exists size_dimensions text,
  add column if not exists retail_price numeric(14,2),
  add column if not exists gst_included boolean not null default true,
  add column if not exists additional_image_urls jsonb not null default '[]'::jsonb,
  add column if not exists client_notes text,
  add column if not exists available_for_selection boolean not null default true,
  add column if not exists display_order integer not null default 0,
  add column if not exists upgrade_value_mode text not null default 'auto'
    check (upgrade_value_mode in ('auto', 'manual'));

comment on column public.builder_products.notes is 'Interior designer / staff-only notes. Never shown on client-facing output.';
comment on column public.builder_products.client_notes is 'Client-facing notes. May appear on the final inclusions schedule.';
comment on column public.builder_products.upgrade_cost is 'Effective upgrade value. When upgrade_value_mode = auto this is kept equal to cost_price - base_allowance by the API; when manual, it is a user override.';

create index if not exists builder_products_available_for_selection_idx
  on public.builder_products(workspace_id, available_for_selection);
create index if not exists builder_products_display_order_idx
  on public.builder_products(workspace_id, category_id, display_order);

-- 2. Prevent conflicting standard-inclusion products within the same category and
--    pricing tier (a category may still have a different standard product per tier,
--    e.g. Classic oven included / Premier oven +$450 / Premium oven +$1,100 are three
--    products, one standard_included row each, one per distinct pricing_tier).
--    coalesce() so platform rows (workspace_id null) and untiered rows (pricing_tier
--    null) still collide correctly instead of comparing as distinct nulls.
create unique index if not exists builder_products_standard_per_tier_uidx
  on public.builder_products (
    coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
    category_id,
    coalesce(pricing_tier, 'CLASSIC')
  )
  where standard_included = true and active = true and category_id is not null;

-- 3. Selection-group taxonomy: a denormalised grouping label on top of the existing
--    category table (Kitchen and appliances / Bathrooms / Laundry / ...), rather than
--    a second parent/child tree, so nothing that already reads builder_product_categories
--    flatly (Estimate Builder, CSV import/export, audit script) breaks.
alter table public.builder_product_categories
  add column if not exists selection_group text;

create index if not exists builder_product_categories_selection_group_idx
  on public.builder_product_categories(selection_group);

-- New granular selection categories from the brief's room/selection-group list.
-- "on conflict do nothing" relies on the existing partial unique index on
-- (category_key) where workspace_id is null.
insert into public.builder_product_categories (workspace_id, category_key, category_name, selection_group, sort_order, metadata)
values
  (null, 'ovens', 'Ovens', 'Kitchen and appliances', 300, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'cooktops', 'Cooktops', 'Kitchen and appliances', 302, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'rangehoods', 'Rangehoods', 'Kitchen and appliances', 304, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'dishwashers', 'Dishwashers', 'Kitchen and appliances', 306, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'microwaves', 'Microwaves', 'Kitchen and appliances', 308, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'refrigerators', 'Refrigerators', 'Kitchen and appliances', 310, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'wine_fridges', 'Wine Fridges', 'Kitchen and appliances', 312, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'kitchen_sinks', 'Kitchen Sinks', 'Kitchen and appliances', 314, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'kitchen_tapware', 'Kitchen Tapware', 'Kitchen and appliances', 316, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'cabinet_finishes', 'Cabinet Finishes', 'Kitchen and appliances', 318, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'cabinet_handles', 'Cabinet Handles', 'Kitchen and appliances', 320, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'splashbacks', 'Splashbacks', 'Kitchen and appliances', 322, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),

  (null, 'baths', 'Baths', 'Bathrooms', 330, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'basins', 'Basins', 'Bathrooms', 332, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'toilets', 'Toilets', 'Bathrooms', 334, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'vanity_units', 'Vanity Units', 'Bathrooms', 336, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'mixers', 'Mixers', 'Bathrooms', 338, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'shower_rails', 'Shower Rails', 'Bathrooms', 340, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'shower_heads', 'Shower Heads', 'Bathrooms', 342, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'shower_screens', 'Shower Screens', 'Bathrooms', 344, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'mirrors', 'Mirrors', 'Bathrooms', 346, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'bathroom_accessories', 'Bathroom Accessories', 'Bathrooms', 348, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),

  (null, 'laundry_tubs', 'Laundry Tubs', 'Laundry', 360, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'laundry_cabinetry', 'Laundry Cabinetry', 'Laundry', 362, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'laundry_tapware', 'Laundry Tapware', 'Laundry', 364, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'laundry_benchtops', 'Laundry Benchtops', 'Laundry', 366, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),

  (null, 'timber_flooring', 'Timber', 'Flooring', 380, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'hybrid_flooring', 'Hybrid', 'Flooring', 382, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'vinyl_flooring', 'Vinyl', 'Flooring', 384, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'laminate_flooring', 'Laminate', 'Flooring', 386, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'floor_tiles', 'Floor Tiles', 'Flooring', 388, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'wall_tiles', 'Wall Tiles', 'Flooring', 390, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),

  (null, 'entrance_doors', 'Entrance Doors', 'Doors and hardware', 400, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'door_handles', 'Door Handles', 'Doors and hardware', 402, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'locks', 'Locks', 'Doors and hardware', 404, '{"library_scope":"CLIENT_SELECTION","default_requires_image":false}'),
  (null, 'door_finishes', 'Door Finishes', 'Doors and hardware', 406, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),

  (null, 'switches', 'Switches', 'Electrical and lighting', 420, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'power_points', 'Power Points', 'Electrical and lighting', 422, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'downlights', 'Downlights', 'Electrical and lighting', 424, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'pendant_lights', 'Pendant Lights', 'Electrical and lighting', 426, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'ceiling_fans', 'Ceiling Fans', 'Electrical and lighting', 428, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'feature_lighting', 'Feature Lighting', 'Electrical and lighting', 430, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'exhaust_fans', 'Exhaust Fans', 'Electrical and lighting', 432, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),

  (null, 'heating', 'Heating', 'Climate', 440, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'fireplaces', 'Fireplaces', 'Climate', 442, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),

  (null, 'internal_colours', 'Internal Colours', 'Painting and colours', 450, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'external_colours', 'External Colours', 'Painting and colours', 452, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'feature_walls', 'Feature Walls', 'Painting and colours', 454, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'paint_finishes', 'Paint Finishes', 'Painting and colours', 456, '{"library_scope":"CLIENT_SELECTION","default_requires_image":false}'),

  (null, 'wardrobe_sliding_doors', 'Sliding Doors', 'Wardrobes', 460, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'wardrobe_shelving', 'Shelving', 'Wardrobes', 462, '{"library_scope":"CLIENT_SELECTION","default_requires_image":false}'),
  (null, 'wardrobe_fitouts', 'Internal Fitouts', 'Wardrobes', 464, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'wardrobe_handles_finishes', 'Handles and Finishes', 'Wardrobes', 466, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),

  (null, 'blinds', 'Blinds', 'Window furnishings', 470, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'curtains', 'Curtains', 'Window furnishings', 472, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'plantation_shutters', 'Plantation Shutters', 'Window furnishings', 474, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),

  (null, 'outdoor_kitchens', 'Outdoor Kitchens', 'Outdoor selections', 480, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'bbqs', 'BBQs', 'Outdoor selections', 482, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'decking_finishes', 'Decking Finishes', 'Outdoor selections', 484, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'pergola_finishes', 'Pergola Finishes', 'Outdoor selections', 486, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}'),
  (null, 'external_fixtures', 'External Fixtures', 'Outdoor selections', 488, '{"library_scope":"CLIENT_SELECTION","default_requires_image":true}')
on conflict do nothing;

-- Backfill selection_group on pre-existing categories that already cover a brief
-- category one-for-one, instead of inserting duplicates.
update public.builder_product_categories set selection_group = 'Kitchen and appliances' where workspace_id is null and category_key in ('appliances', 'kitchen', 'butlers_pantry', 'cabinetry', 'benchtops');
update public.builder_product_categories set selection_group = 'Bathrooms' where workspace_id is null and category_key in ('bathroom', 'ensuite', 'sanitaryware', 'tapware');
update public.builder_product_categories set selection_group = 'Laundry' where workspace_id is null and category_key = 'laundry';
update public.builder_product_categories set selection_group = 'Flooring' where workspace_id is null and category_key in ('flooring', 'carpet', 'tiles');
update public.builder_product_categories set selection_group = 'Doors and hardware' where workspace_id is null and category_key in ('internal_doors', 'external_doors', 'garage_doors');
update public.builder_product_categories set selection_group = 'Electrical and lighting' where workspace_id is null and category_key in ('electrical', 'lighting');
update public.builder_product_categories set selection_group = 'Climate' where workspace_id is null and category_key = 'air_conditioning';
update public.builder_product_categories set selection_group = 'Painting and colours' where workspace_id is null and category_key in ('paint', 'painting');
update public.builder_product_categories set selection_group = 'Outdoor selections' where workspace_id is null and category_key in ('external_works', 'landscaping', 'gutters');
update public.builder_product_categories set selection_group = 'Doors and hardware' where workspace_id is null and category_key = 'windows';
update public.builder_product_categories set selection_group = 'Kitchen and appliances' where workspace_id is null and category_key = 'roofing';

-- 4. Final inclusions schedule — versioned, never overwritten in place. Regenerating
--    after a signed version inserts a new row with version = previous + 1; the signed
--    row is left untouched.
create table if not exists public.builder_inclusions_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.builder_commercial_projects(id) on delete cascade,
  version integer not null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'signed')),
  snapshot jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz,
  client_signed_name text,
  client_signature_data text,
  builder_signed_name text,
  builder_signature_data text,
  pdf_url text,
  created_at timestamptz not null default now()
);

create unique index if not exists builder_inclusions_schedules_version_uidx
  on public.builder_inclusions_schedules(project_id, version);
create index if not exists builder_inclusions_schedules_project_idx
  on public.builder_inclusions_schedules(workspace_id, project_id, version desc);

alter table public.builder_inclusions_schedules enable row level security;

drop policy if exists builder_inclusions_schedules_select on public.builder_inclusions_schedules;
create policy builder_inclusions_schedules_select
  on public.builder_inclusions_schedules for select
  using (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_inclusions_schedules_insert on public.builder_inclusions_schedules;
create policy builder_inclusions_schedules_insert
  on public.builder_inclusions_schedules for insert
  with check (public.builder_commercial_is_workspace_member(workspace_id));

-- Signing only ever adds signature fields to a still-draft/issued row; a signed row
-- is never targeted (enforced in the API, not just here) — the update policy still
-- requires workspace membership as a floor.
drop policy if exists builder_inclusions_schedules_update on public.builder_inclusions_schedules;
create policy builder_inclusions_schedules_update
  on public.builder_inclusions_schedules for update
  using (public.builder_commercial_is_workspace_member(workspace_id))
  with check (public.builder_commercial_is_workspace_member(workspace_id));
