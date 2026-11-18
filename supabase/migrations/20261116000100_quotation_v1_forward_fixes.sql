-- Quotation V1 forward fixes (16 Nov 2026).
-- Three earlier migrations were corrected in place after they may already have run in production:
--   20261010000100 / 20261011000100: the old one-mapping-per-room unique constraint has a generated
--     name longer than 63 characters, so the original "drop constraint if exists <long name>" silently
--     did nothing and a second product in the same room was rejected;
--   20261021000100: anon was not explicitly revoked from builder_commercial_is_internal_member(uuid).
-- A migration that already ran is not re-run when its file changes, so the same end state is applied
-- here. Every statement is idempotent and changes no data: safe on a database with either version.
begin;

-- 1. Exactly one product-specific identity rule on requirement mappings; the per-room rule is removed
--    whatever it is called.
do $$
declare
  old_constraint text;
begin
  if to_regclass('public.builder_requirement_quote_mappings') is null then return; end if;
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
  if not exists (select 1 from pg_constraint where conrelid = 'public.builder_requirement_quote_mappings'::regclass
                 and conname = 'builder_requirement_quote_mappings_identity_unique') then
    alter table public.builder_requirement_quote_mappings
      add constraint builder_requirement_quote_mappings_identity_unique
      unique (workspace_id, template_id, requirement_key, product_id, location_id);
  end if;
end $$;

-- 2. The internal-member helper is not executable by anon (it reveals membership).
do $$
begin
  if to_regprocedure('public.builder_commercial_is_internal_member(uuid)') is not null then
    revoke all on function public.builder_commercial_is_internal_member(uuid) from public, anon;
  end if;
end $$;

commit;
