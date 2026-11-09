-- Product-specific fixture mappings: one requirement can select several distinct lights/fans.
-- Preserve existing mappings as the empty product_id default; new mappings use the stable Product Library ID.
begin;

alter table public.builder_requirement_quote_mappings
  add column if not exists product_id text not null default '';

-- Drop the old one-mapping-per-room rule whatever it is called. Its generated name is longer than
-- PostgreSQL's 63-character limit, so dropping it by the untruncated name silently did nothing and
-- left a second product in the same room rejected.
do $$
declare
  old_constraint text;
begin
  for old_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.builder_requirement_quote_mappings'::regclass
      and c.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname)
           from unnest(c.conkey) as k(attnum)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum)
          = array['location_id', 'requirement_key', 'template_id', 'workspace_id']
  loop
    execute format('alter table public.builder_requirement_quote_mappings drop constraint %I', old_constraint);
  end loop;
end $$;

alter table public.builder_requirement_quote_mappings
  drop constraint if exists builder_requirement_quote_mappings_identity_unique;
alter table public.builder_requirement_quote_mappings
  add constraint builder_requirement_quote_mappings_identity_unique
  unique (workspace_id, template_id, requirement_key, product_id, location_id);

commit;
