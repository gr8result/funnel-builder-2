begin read only;
select current_database(), current_user, current_setting('server_version');
select n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) as owner, c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('builder_products','builder_product_suppliers','builder_selection_aliases','builder_product_imports','workspace_members');
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner, p.proacl,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='commit_builder_product_import';
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns where table_schema='public'
and table_name in ('builder_products','builder_product_suppliers','builder_selection_aliases','builder_product_imports','workspace_members')
order by table_name, ordinal_position;
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename in ('builder_products','builder_product_imports');
select r.rolname, c.relname, privilege,
       has_table_privilege(r.oid,c.oid,privilege) as permitted
from pg_roles r cross join pg_class c cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege
where r.rolname in ('anon','authenticated','service_role')
and c.relnamespace='public'::regnamespace and c.relname='builder_product_imports';
select r.rolname, p.oid::regprocedure,
       has_function_privilege(r.oid,p.oid,'EXECUTE') as permitted
from pg_roles r cross join pg_proc p
where r.rolname in ('anon','authenticated','service_role')
and p.pronamespace='public'::regnamespace and p.proname='commit_builder_product_import';
select version, statements from supabase_migrations.schema_migrations
where version in ('20260813092100','20261003000100','20261004000100','20261010000100','20261011000100');
rollback;