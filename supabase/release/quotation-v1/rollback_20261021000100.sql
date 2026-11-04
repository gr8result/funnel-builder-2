-- Rollback for 20261021000100_builder_commercial_internal_member_rls.sql (release-candidate copy).
-- Restores the pre-migration access model: internal-member restrictive policies removed, the
-- requirement-mapping read policy put back to its 20261010000100 definition. Data is not touched.
-- Only run with owner approval, after taking the backup in docs/quotation-builder-v1-release.md.
begin;

do $$
declare
  t record;
begin
  for t in select tablename from pg_policies where schemaname = 'public' and policyname = 'internal_workspace_members_only' loop
    execute format('drop policy if exists internal_workspace_members_only on public.%I', t.tablename);
  end loop;
end $$;

do $$
begin
  if to_regclass('public.builder_requirement_quote_mappings') is not null then
    drop policy if exists tenant_read on public.builder_requirement_quote_mappings;
    create policy tenant_read on public.builder_requirement_quote_mappings for select to authenticated
      using (public.builder_selection_is_config_admin(workspace_id));
  end if;
end $$;

drop function if exists public.builder_commercial_is_internal_member(uuid);

delete from supabase_migrations.schema_migrations where version = '20261021000100';

commit;

-- 20261028000100 (membership recursion fix) is forward-only: rolling it back reintroduces the
-- 42P17 "infinite recursion" error. If it must be reverted, recreate the four policies exactly as
-- printed by section 4 of 00_precheck_readonly.sql taken before it was applied.
-- 20261010000100 / 20261011000100 only add a table and constraints that V1 code does not use; no
-- rollback is needed. If required: drop table public.builder_requirement_quote_mappings (only when empty).
