-- Additive Product Library fields used by Inclusions & Selections compatibility.
-- Existing product data is preserved.

alter table public.builder_products
  add column if not exists product_type text,
  add column if not exists requirement_tags text,
  add column if not exists compatible_area_types text,
  add column if not exists fuel_type text,
  add column if not exists mounting_type text,
  add column if not exists installation_type text,
  add column if not exists availability_status text not null default 'available'
    check (availability_status in ('available', 'supplier_quote_required', 'unavailable', 'discontinued'));

create index if not exists builder_products_requirement_tags_idx
  on public.builder_products using gin (to_tsvector('simple', coalesce(requirement_tags, '')));

create index if not exists builder_products_availability_status_idx
  on public.builder_products(workspace_id, availability_status);
