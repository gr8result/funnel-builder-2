-- Product Library quote structure references.
-- Additive only. Products reference master Quote Structure items; Quote Structure rows are not duplicated here.

alter table public.builder_products
  add column if not exists quote_structure_section text,
  add column if not exists quote_structure_item text,
  add column if not exists quote_structure_row_id text,
  add column if not exists selection_type text,
  add column if not exists source_quote_item_name text,
  add column if not exists import_notes text;

create index if not exists builder_products_quote_structure_row_idx
  on public.builder_products(workspace_id, quote_structure_row_id);

create index if not exists builder_products_quote_structure_item_idx
  on public.builder_products(workspace_id, quote_structure_section, quote_structure_item);

