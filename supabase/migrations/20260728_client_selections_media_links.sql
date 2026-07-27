-- Client Selections Library: verified product media/links.
-- Additive only — no drop/rename/retype of any existing column.
-- product_url and supplier_website_url already exist (20260707/20260723) and are
-- reused as "Supplier Product URL" / general supplier site link; this migration
-- adds only what's genuinely missing: a manufacturer link, image provenance,
-- and a verification workflow so nobody mistakes an unverified/model-family
-- image for a confirmed exact-model photo.

alter table public.builder_products
  add column if not exists manufacturer_product_url text,
  add column if not exists image_source_url text,
  add column if not exists image_source_type text
    check (image_source_type in ('supplier', 'manufacturer', 'manual_upload', 'staff_photo', 'other')),
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'exact_model_verified', 'model_family_only', 'image_unavailable', 'discontinued', 'link_broken')),
  add column if not exists date_last_verified date;

create index if not exists builder_products_verification_status_idx
  on public.builder_products(workspace_id, verification_status);
create index if not exists builder_products_product_url_idx
  on public.builder_products(workspace_id, product_url) where product_url is not null;
create index if not exists builder_products_sku_idx
  on public.builder_products(workspace_id, sku) where sku is not null;

-- Data hygiene: flag (never delete) any already-stored image that points at a
-- known stock-photo domain, so it surfaces in the admin media report instead
-- of silently continuing to display as if it were a real product photo. An
-- admin reviews and replaces it — this migration does not guess a replacement.
update public.builder_products
set verification_status = 'image_unavailable'
where verification_status = 'unverified'
  and (
    primary_image_url ilike '%unsplash.com%'
    or primary_image_url ilike '%pexels.com%'
    or primary_image_url ilike '%pixabay.com%'
    or primary_image_url ilike '%shutterstock.com%'
    or primary_image_url ilike '%istockphoto.com%'
    or additional_image_urls::text ilike '%unsplash.com%'
    or additional_image_urls::text ilike '%pexels.com%'
    or additional_image_urls::text ilike '%pixabay.com%'
    or additional_image_urls::text ilike '%shutterstock.com%'
    or additional_image_urls::text ilike '%istockphoto.com%'
  );
