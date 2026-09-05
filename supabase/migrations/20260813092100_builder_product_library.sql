-- Builder Product Library
-- Additive master catalogue for selectable construction products.
-- This does not modify Estimate Builder calculations, takeoff, snapshots, selections, or proposal data.

create table if not exists public.builder_product_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  category_key text not null,
  category_name text not null,
  parent_category_id uuid references public.builder_product_categories(id) on delete set null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_product_manufacturers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  manufacturer_name text not null,
  website_url text,
  support_url text,
  notes text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_product_suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  supplier_name text not null,
  contact_name text,
  email text,
  phone text,
  website_url text,
  api_provider text,
  external_id text,
  api_sync_enabled boolean not null default false,
  last_synced_at timestamptz,
  sync_metadata jsonb not null default '{}'::jsonb,
  notes text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid references public.builder_product_categories(id) on delete set null,
  manufacturer_id uuid references public.builder_product_manufacturers(id) on delete set null,
  supplier_id uuid references public.builder_product_suppliers(id) on delete set null,
  product_name text not null,
  sku text,
  model text,
  description text,
  price_band text not null default 'mid_range'
    check (price_band in ('budget', 'mid_range', 'higher_end', 'luxury')),
  standard_included boolean not null default false,
  base_allowance numeric(14,2) not null default 0,
  upgrade_cost numeric(14,2) not null default 0,
  primary_image_url text,
  datasheet_pdf_url text,
  warranty_summary text,
  warranty_document_url text,
  product_url text,
  supplier_website_url text,
  external_source text,
  external_id text,
  api_sync_enabled boolean not null default false,
  last_synced_at timestamptz,
  sync_metadata jsonb not null default '{}'::jsonb,
  notes text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_product_images (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.builder_products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_standard_specifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  specification_name text not null,
  specification_type text not null default 'standard',
  description text,
  price_band text not null default 'mid_range'
    check (price_band in ('budget', 'mid_range', 'higher_end', 'luxury')),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_standard_specification_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  specification_id uuid not null references public.builder_standard_specifications(id) on delete cascade,
  category_id uuid references public.builder_product_categories(id) on delete set null,
  product_id uuid references public.builder_products(id) on delete set null,
  item_name text not null,
  description text,
  allowance_amount numeric(14,2) not null default 0,
  included boolean not null default true,
  sort_order integer not null default 0,
  notes text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_product_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.builder_products(id) on delete cascade,
  document_type text not null default 'other'
    check (document_type in ('datasheet', 'brochure', 'warranty', 'installation_notes', 'safety', 'other')),
  title text not null,
  document_url text not null,
  notes text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_product_specifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.builder_products(id) on delete cascade,
  spec_key text,
  spec_label text not null,
  spec_value text not null,
  unit text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_product_colours (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.builder_products(id) on delete cascade,
  colour_name text not null,
  colour_code text,
  image_url text,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_product_finish_options (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.builder_products(id) on delete cascade,
  finish_name text not null,
  finish_type text,
  image_url text,
  upgrade_cost numeric(14,2) not null default 0,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_product_price_options (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.builder_products(id) on delete cascade,
  price_band text not null default 'mid_range'
    check (price_band in ('budget', 'mid_range', 'higher_end', 'luxury')),
  label text not null,
  base_allowance numeric(14,2) not null default 0,
  upgrade_cost numeric(14,2) not null default 0,
  supplier_cost numeric(14,2) not null default 0,
  sell_price numeric(14,2) not null default 0,
  notes text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists builder_product_categories_workspace_idx on public.builder_product_categories(workspace_id);
create index if not exists builder_product_categories_key_idx on public.builder_product_categories(category_key);
create unique index if not exists builder_product_categories_system_key_uidx
  on public.builder_product_categories(category_key)
  where workspace_id is null;
create unique index if not exists builder_product_categories_workspace_key_uidx
  on public.builder_product_categories(workspace_id, category_key)
  where workspace_id is not null;

create index if not exists builder_product_manufacturers_workspace_idx on public.builder_product_manufacturers(workspace_id);
create index if not exists builder_product_suppliers_workspace_idx on public.builder_product_suppliers(workspace_id);
create index if not exists builder_product_suppliers_api_idx on public.builder_product_suppliers(api_provider, external_id)
  where api_provider is not null;

create index if not exists builder_products_workspace_idx on public.builder_products(workspace_id);
create index if not exists builder_products_category_idx on public.builder_products(workspace_id, category_id);
create index if not exists builder_products_manufacturer_idx on public.builder_products(workspace_id, manufacturer_id);
create index if not exists builder_products_supplier_idx on public.builder_products(workspace_id, supplier_id);
create index if not exists builder_products_price_band_idx on public.builder_products(workspace_id, price_band);
create index if not exists builder_products_active_idx on public.builder_products(workspace_id, active);
create index if not exists builder_products_sku_idx on public.builder_products(workspace_id, sku);
create index if not exists builder_products_external_idx on public.builder_products(external_source, external_id)
  where external_source is not null and external_id is not null;

create index if not exists builder_product_images_product_idx on public.builder_product_images(workspace_id, product_id);
create unique index if not exists builder_product_images_primary_uidx
  on public.builder_product_images(workspace_id, product_id)
  where is_primary = true;

create index if not exists builder_standard_specifications_workspace_idx on public.builder_standard_specifications(workspace_id);
create index if not exists builder_standard_specification_items_workspace_idx on public.builder_standard_specification_items(workspace_id);
create index if not exists builder_standard_specification_items_specification_idx on public.builder_standard_specification_items(workspace_id, specification_id);
create index if not exists builder_standard_specification_items_product_idx on public.builder_standard_specification_items(workspace_id, product_id);

create index if not exists builder_product_documents_product_idx on public.builder_product_documents(workspace_id, product_id);
create index if not exists builder_product_specifications_product_idx on public.builder_product_specifications(workspace_id, product_id);
create index if not exists builder_product_colours_product_idx on public.builder_product_colours(workspace_id, product_id);
create index if not exists builder_product_finish_options_product_idx on public.builder_product_finish_options(workspace_id, product_id);
create index if not exists builder_product_price_options_product_idx on public.builder_product_price_options(workspace_id, product_id);

alter table public.builder_product_categories enable row level security;
alter table public.builder_product_manufacturers enable row level security;
alter table public.builder_product_suppliers enable row level security;
alter table public.builder_products enable row level security;
alter table public.builder_product_images enable row level security;
alter table public.builder_product_documents enable row level security;
alter table public.builder_product_specifications enable row level security;
alter table public.builder_product_colours enable row level security;
alter table public.builder_product_finish_options enable row level security;
alter table public.builder_product_price_options enable row level security;
alter table public.builder_standard_specifications enable row level security;
alter table public.builder_standard_specification_items enable row level security;

drop policy if exists builder_product_categories_select on public.builder_product_categories;
create policy builder_product_categories_select
  on public.builder_product_categories for select
  using (workspace_id is null or public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_categories_insert on public.builder_product_categories;
create policy builder_product_categories_insert
  on public.builder_product_categories for insert
  with check (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_categories_update on public.builder_product_categories;
create policy builder_product_categories_update
  on public.builder_product_categories for update
  using (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id))
  with check (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_categories_delete on public.builder_product_categories;
create policy builder_product_categories_delete
  on public.builder_product_categories for delete
  using (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'builder_product_manufacturers',
    'builder_product_suppliers',
    'builder_products',
    'builder_product_images',
    'builder_product_documents',
    'builder_product_specifications',
    'builder_product_colours',
    'builder_product_finish_options',
    'builder_product_price_options',
    'builder_standard_specifications',
    'builder_standard_specification_items'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format(
      'create policy %I on public.%I for select using (workspace_id is null or public.builder_commercial_is_workspace_member(workspace_id))',
      table_name || '_select',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert with check (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id))',
      table_name || '_insert',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format(
      'create policy %I on public.%I for update using (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id)) with check (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id))',
      table_name || '_update',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
    execute format(
      'create policy %I on public.%I for delete using (workspace_id is not null and public.builder_commercial_is_workspace_member(workspace_id))',
      table_name || '_delete',
      table_name
    );
  end loop;
end $$;

insert into public.builder_product_categories (workspace_id, category_key, category_name, sort_order)
values
  (null, 'site_works', 'Site Works', 10),
  (null, 'concrete', 'Concrete', 20),
  (null, 'brickwork', 'Brickwork', 30),
  (null, 'roofing', 'Roofing', 40),
  (null, 'gutters', 'Gutters', 50),
  (null, 'windows', 'Windows', 60),
  (null, 'garage_doors', 'Garage Doors', 70),
  (null, 'flooring', 'Flooring', 80),
  (null, 'paint', 'Paint', 90),
  (null, 'kitchen', 'Kitchen', 100),
  (null, 'butlers_pantry', 'Butler''s Pantry', 110),
  (null, 'laundry', 'Laundry', 120),
  (null, 'bathroom', 'Bathroom', 130),
  (null, 'ensuite', 'Ensuite', 140),
  (null, 'appliances', 'Appliances', 150),
  (null, 'electrical', 'Electrical', 160),
  (null, 'lighting', 'Lighting', 170),
  (null, 'plumbing', 'Plumbing', 180),
  (null, 'air_conditioning', 'Air Conditioning', 190),
  (null, 'landscaping', 'Landscaping', 200)
on conflict do nothing;
