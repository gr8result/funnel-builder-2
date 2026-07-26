-- Product Library rebuild — additive only.
-- Adds visual/non-visual distinction, pricing fields, minimal variant support,
-- and platform-default product support to the existing builder_products catalogue.
-- Does not drop, rename, or retype any existing column, and does not touch
-- Estimate Builder, Client Selections, Supplier Quotations, Procurement, or
-- Purchase Orders data. Existing builder_products rows and ids are untouched.

-- Allow platform-default products, matching the existing convention already used by
-- builder_product_categories/manufacturers/suppliers and builder_standard_specifications:
-- workspace_id is null => platform-owned, protected (RLS insert/update/delete already
-- require workspace_id is not null, so null-workspace rows can never be written to by
-- a tenant — no new column is needed to express "platform product").
alter table public.builder_products
  alter column workspace_id drop not null;

alter table public.builder_products
  add column if not exists is_visual_product boolean,
  add column if not exists requires_image boolean,
  add column if not exists library_scope text not null default 'CLIENT_SELECTION'
    check (library_scope in ('CLIENT_SELECTION', 'ESTIMATING', 'BOTH')),
  add column if not exists cost_price numeric(14,2),
  add column if not exists sell_price numeric(14,2),
  add column if not exists markup_percent numeric(6,2),
  add column if not exists pricing_mode text check (pricing_mode in ('markup', 'fixed_sell')),
  add column if not exists room_or_usage text,
  add column if not exists subcategory text,
  add column if not exists parent_product_id uuid references public.builder_products(id) on delete set null,
  add column if not exists is_variant boolean not null default false,
  add column if not exists variant_label text,
  add column if not exists last_price_update timestamptz;

create index if not exists builder_products_parent_idx on public.builder_products(parent_product_id) where parent_product_id is not null;
create index if not exists builder_products_requires_image_idx on public.builder_products(workspace_id, requires_image) where requires_image = true;
create index if not exists builder_products_visual_idx on public.builder_products(workspace_id, is_visual_product);
create index if not exists builder_products_library_scope_idx on public.builder_products(workspace_id, library_scope);

-- One report row per CSV import batch, holding the full preview/error report so it can
-- be downloaded/inspected later rather than only shown as a transient toast.
create table if not exists public.builder_product_library_import_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  batch_id uuid references public.builder_product_import_batches(id) on delete set null,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists builder_product_library_import_reports_workspace_idx
  on public.builder_product_library_import_reports(workspace_id);

alter table public.builder_product_library_import_reports enable row level security;

drop policy if exists builder_product_library_import_reports_select on public.builder_product_library_import_reports;
create policy builder_product_library_import_reports_select
  on public.builder_product_library_import_reports for select
  using (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_library_import_reports_insert on public.builder_product_library_import_reports;
create policy builder_product_library_import_reports_insert
  on public.builder_product_library_import_reports for insert
  with check (public.builder_commercial_is_workspace_member(workspace_id));

-- Category seed: the top-level categories from the brief, each carrying a default
-- requires_image flag in metadata so the UI can suggest it per-category on new products.
-- "on conflict do nothing" relies on the existing partial unique index on
-- (category_key) where workspace_id is null.
insert into public.builder_product_categories (workspace_id, category_key, category_name, sort_order, metadata)
values
  (null, 'preliminaries', 'Preliminaries', 5, '{"default_requires_image": false, "library_scope": "ESTIMATING"}'),
  (null, 'site_works', 'Site Works', 10, '{"default_requires_image": false, "library_scope": "ESTIMATING"}'),
  (null, 'concrete', 'Concrete', 20, '{"default_requires_image": false, "library_scope": "ESTIMATING"}'),
  (null, 'structural_steel', 'Structural Steel', 25, '{"default_requires_image": false, "library_scope": "ESTIMATING"}'),
  (null, 'framing', 'Framing', 30, '{"default_requires_image": false, "library_scope": "ESTIMATING"}'),
  (null, 'roofing', 'Roofing', 40, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'windows', 'Windows', 50, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'external_doors', 'External Doors', 55, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'internal_doors', 'Internal Doors', 58, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'plumbing', 'Plumbing', 60, '{"default_requires_image": false, "library_scope": "BOTH"}'),
  (null, 'tapware', 'Tapware', 65, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'sanitaryware', 'Sanitaryware', 68, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'electrical', 'Electrical', 70, '{"default_requires_image": true, "library_scope": "BOTH"}'),
  (null, 'lighting', 'Lighting', 75, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'appliances', 'Appliances', 80, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'cabinetry', 'Cabinetry', 90, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'benchtops', 'Benchtops', 95, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'tiles', 'Tiles', 100, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'flooring', 'Flooring', 105, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'carpet', 'Carpet', 108, '{"default_requires_image": true, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'painting', 'Painting', 110, '{"default_requires_image": false, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'external_works', 'External Works', 120, '{"default_requires_image": false, "library_scope": "BOTH"}'),
  (null, 'landscaping', 'Landscaping', 130, '{"default_requires_image": false, "library_scope": "CLIENT_SELECTION"}'),
  (null, 'labour', 'Labour', 200, '{"default_requires_image": false, "library_scope": "ESTIMATING"}'),
  (null, 'hire', 'Hire', 210, '{"default_requires_image": false, "library_scope": "ESTIMATING"}'),
  (null, 'allowances', 'Allowances', 220, '{"default_requires_image": false, "library_scope": "ESTIMATING"}'),
  (null, 'other', 'Other', 999, '{"default_requires_image": false, "library_scope": "BOTH"}')
on conflict do nothing;

with category_scopes(category_key, library_scope) as (
  values
    ('preliminaries', 'ESTIMATING'),
    ('site_works', 'ESTIMATING'),
    ('concrete', 'ESTIMATING'),
    ('structural_steel', 'ESTIMATING'),
    ('framing', 'ESTIMATING'),
    ('roofing', 'CLIENT_SELECTION'),
    ('windows', 'CLIENT_SELECTION'),
    ('external_doors', 'CLIENT_SELECTION'),
    ('internal_doors', 'CLIENT_SELECTION'),
    ('plumbing', 'BOTH'),
    ('tapware', 'CLIENT_SELECTION'),
    ('sanitaryware', 'CLIENT_SELECTION'),
    ('electrical', 'BOTH'),
    ('lighting', 'CLIENT_SELECTION'),
    ('appliances', 'CLIENT_SELECTION'),
    ('cabinetry', 'CLIENT_SELECTION'),
    ('benchtops', 'CLIENT_SELECTION'),
    ('tiles', 'CLIENT_SELECTION'),
    ('flooring', 'CLIENT_SELECTION'),
    ('carpet', 'CLIENT_SELECTION'),
    ('painting', 'CLIENT_SELECTION'),
    ('external_works', 'BOTH'),
    ('landscaping', 'CLIENT_SELECTION'),
    ('labour', 'ESTIMATING'),
    ('hire', 'ESTIMATING'),
    ('allowances', 'ESTIMATING'),
    ('other', 'BOTH')
)
update public.builder_product_categories category
set metadata = coalesce(category.metadata, '{}'::jsonb) || jsonb_build_object('library_scope', category_scopes.library_scope)
from category_scopes
where category.workspace_id is null
  and category.category_key = category_scopes.category_key;

update public.builder_products product
set library_scope = coalesce(category.metadata->>'library_scope', product.library_scope, 'CLIENT_SELECTION')
from public.builder_product_categories category
where product.category_id = category.id
  and product.library_scope = 'CLIENT_SELECTION'
  and category.metadata ? 'library_scope';

-- builder_product_suppliers had no uniqueness constraint at all (unlike categories),
-- so the seed below would duplicate on every re-run without this. Same partial-unique
-- pattern already used by builder_product_categories_system_key_uidx.
create unique index if not exists builder_product_suppliers_system_name_uidx
  on public.builder_product_suppliers(supplier_name)
  where workspace_id is null;

-- Supplier seed: named platform-default suppliers so products can be linked to a real
-- record instead of free text. Uncontrolled free-text supplier entry is still possible
-- via ensureSupplier() for anything not in this list.
insert into public.builder_product_suppliers (workspace_id, supplier_name)
values
  (null, 'Harvey Norman Commercial'),
  (null, 'Reece'),
  (null, 'Clipsal'),
  (null, 'PGH'),
  (null, 'Colorbond'),
  (null, 'Lysaght'),
  (null, 'Boral'),
  (null, 'National Tiles'),
  (null, 'Hume'),
  (null, 'Gainsborough'),
  (null, 'Dowell'),
  (null, 'Bradnam''s'),
  (null, 'CSR'),
  (null, 'Polytec'),
  (null, 'Laminex'),
  (null, 'Handle House'),
  (null, 'Caesarstone'),
  (null, 'Trend Windows'),
  (null, 'Austral'),
  (null, 'James Hardie'),
  (null, 'Lawrence & Hanson'),
  (null, 'Middy''s'),
  (null, 'Smartstone'),
  (null, 'Stegbar'),
  (null, 'Tradelink')
on conflict do nothing;
