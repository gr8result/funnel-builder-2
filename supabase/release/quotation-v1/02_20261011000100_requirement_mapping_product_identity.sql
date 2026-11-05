-- Product-specific fixture mappings: one requirement can select several distinct lights/fans.
-- Preserve existing mappings as the empty product_id default; new mappings use the stable Product Library ID.
begin;

alter table public.builder_requirement_quote_mappings
  add column if not exists product_id text not null default '';

alter table public.builder_requirement_quote_mappings
  drop constraint if exists builder_requirement_quote_mappings_workspace_id_template_id_requirement_key_location_id_key;

alter table public.builder_requirement_quote_mappings
  add constraint builder_requirement_quote_mappings_identity_unique
  unique (workspace_id, template_id, requirement_key, product_id, location_id);

commit;
