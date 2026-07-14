-- Appliance import bridge fields for Builder Product Library.
-- Additive only: preserves Quote Sheet source metadata without changing workbook data.

alter table public.builder_products
  add column if not exists source_quote_row_id text,
  add column if not exists source_quote_section text,
  add column if not exists source_quote_unit text,
  add column if not exists source_quote_rate numeric(14,2),
  add column if not exists source_quote_allowance numeric(14,2),
  add column if not exists source_workbook_metadata jsonb not null default '{}'::jsonb,
  add column if not exists primary_image_url text,
  add column if not exists image_source_url text,
  add column if not exists image_status text not null default 'missing'
    check (image_status in ('missing', 'manual', 'imported', 'uploaded', 'needs_review')),
  add column if not exists image_notes text;

create index if not exists builder_products_source_quote_row_idx
  on public.builder_products(workspace_id, source_quote_row_id);

create index if not exists builder_products_brand_model_idx
  on public.builder_products(workspace_id, manufacturer_id, model);
