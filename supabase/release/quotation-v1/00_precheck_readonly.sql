-- Quotation Builder V1 - READ-ONLY pre-check. Run before applying anything; save the full output.
-- Makes no changes. The policy definitions printed in section 4 are the exact rollback source for
-- 20261028000100 (and for any policy 20261021000100 replaces).

-- 1. Confirm the database (compare with the approved production project before continuing).
select current_database() as database, inet_server_addr() as server, now() as checked_at;

-- 2. Which candidate migrations are already recorded?
select version, name from supabase_migrations.schema_migrations
where version in ('20261003000100', '20261004000100', '20261010000100', '20261011000100', '20261021000100', '20261028000100')
order by version;

-- 3. Dependencies the candidates need (all must be non-null).
select
  to_regclass('public.workspaces') as workspaces,
  to_regclass('public.workspace_members') as workspace_members,
  to_regclass('public.workspace_entitlements') as workspace_entitlements,
  to_regclass('public.communities') as communities,
  to_regclass('public.builder_commercial_projects') as builder_commercial_projects,
  to_regclass('public.builder_estimate_snapshots') as builder_estimate_snapshots,
  to_regclass('public.builder_requirement_quote_mappings') as builder_requirement_quote_mappings,
  to_regprocedure('public.builder_selection_is_config_admin(uuid)') as builder_selection_is_config_admin,
  to_regprocedure('public.builder_selection_immutable_workspace()') as builder_selection_immutable_workspace,
  to_regprocedure('public.builder_commercial_set_updated_at()') as builder_commercial_set_updated_at;

-- 4. Current policies on the tables these migrations change (rollback source - keep this output).
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (tablename in ('workspaces', 'workspace_members', 'workspace_entitlements', 'communities', 'builder_requirement_quote_mappings')
       or policyname = 'internal_workspace_members_only')
order by tablename, policyname;

-- 5. Current function definitions that 20261028000100 / 20261021000100 replace or add.
select p.oid::regprocedure as function, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_workspace_member', 'builder_commercial_is_internal_member');

-- 6. Member roles in use (any role outside the internal list loses direct access to internal tables).
select role, status, count(*) from public.workspace_members group by role, status order by role, status;
