-- Quotation Builder V1 - READ-ONLY post-check after the candidates are applied. Makes no changes.

-- 1. All four recorded.
select version, name from supabase_migrations.schema_migrations
where version in ('20261010000100', '20261011000100', '20261021000100', '20261028000100') order by version;

-- 2. Restrictive internal-member policy present on every listed table that exists (expect 0 rows).
select t.table_name as missing_internal_policy
from unnest(array[
  'builder_commercial_projects','builder_estimate_snapshots','builder_boq_sections','builder_boq_items',
  'builder_procurement_items','builder_quote_approvals','builder_variations','builder_client_selections',
  'builder_requirement_quote_mappings'
]) as t(table_name)
where to_regclass('public.' || t.table_name) is not null
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.table_name
                  and p.policyname = 'internal_workspace_members_only' and p.permissive = 'RESTRICTIVE');

-- 3. Membership policies now use the security-definer predicate (expect 4 rows, each mentioning is_workspace_member).
select tablename, policyname, qual from pg_policies
where schemaname = 'public' and policyname in ('members_read_workspace','members_read_workspace_members','members_read_entitlements','members_read_communities');

-- 4. Helper functions exist and are not executable by anon.
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_workspace_member', 'builder_commercial_is_internal_member');
