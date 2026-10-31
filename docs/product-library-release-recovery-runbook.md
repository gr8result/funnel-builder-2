# Product Library Release and Recovery Runbook

## Current Evidence

This runbook is a proposed controlled procedure, not proof that a backup or restore has been performed.

- Production project ref: `bvtxfphktypdqmlnveqf`.
- Current workspace base: `05962e578ff8e6f7151f3d7a81350b58ef2a248d`; the worktree is dirty, so this is not a reviewed release commit.
- Requested CSV-import migration SHA-256: `A9B5F18CB8726156B02173BAF4E3E4DB0BE29EEE3EFAC8754FE05CB8E403169B`.
- Remote migration history does not list `20261004000100_builder_product_csv_import`.
- The earlier service-role HEAD probe falsely suggested the table was available. A bounded GET-only probe on 2026-10-24 returns `PGRST205` for `builder_product_imports` under both service and anonymous roles. Service-role OpenAPI advertises neither the import table nor the commit RPC; an earlier RPC probe returned `PGRST202`.
- Direct PostgreSQL schema/grant inspection was unavailable: there is no configured database URL and the Supabase CLI schema dump requires a running Docker engine. REST results do not distinguish absent objects from stale cache or missing grants. Run `supabase/review/product_library_release_readonly.sql` to settle this before repair.
- No full-project database plus Storage recovery point, isolated restore, or outbound-job suppression was demonstrated.
- Local Supabase is not running because Docker Desktop's engine is unavailable.

## Required Approvals

Before any production action, obtain written approval from:

1. The database owner for read-only schema inspection, the exact migration decision, and any separately reviewed forward repair.
2. The platform/release owner for a frozen candidate manifest, dependency/security exceptions, and deployment.
3. The backup/recovery owner for the recovery window, write freeze, and restore destination.
4. The builder/job owner for any job-specific price, GST, size, mapping, replacement, procurement, or variation confirmation.

Never put database passwords, service-role keys, or magic-link tokens in this document or chat.

## Read-Only Schema Inspection

Run these queries through an approved direct PostgreSQL session to the target project. Save the results with the change record; do not use the service-role API result as a substitute for PostgreSQL catalog evidence.

```sql
select current_database(), current_user, current_setting('server_version');
select to_regclass('public.builder_products') as builder_products,
       to_regclass('public.builder_product_suppliers') as builder_product_suppliers,
       to_regclass('public.builder_selection_aliases') as builder_selection_aliases,
       to_regclass('public.builder_product_imports') as builder_product_imports;
select to_regprocedure('public.commit_builder_product_import(uuid,uuid,uuid,integer[])') as commit_function;
select has_table_privilege('service_role', 'public.builder_product_imports', 'SELECT') as service_select,
       has_table_privilege('service_role', 'public.builder_product_imports', 'INSERT') as service_insert,
       has_table_privilege('authenticated', 'public.builder_product_imports', 'SELECT') as authenticated_select,
       has_table_privilege('anon', 'public.builder_product_imports', 'SELECT') as anon_select;
select has_function_privilege('service_role', 'public.commit_builder_product_import(uuid,uuid,uuid,integer[])', 'EXECUTE') as service_execute,
       has_function_privilege('authenticated', 'public.commit_builder_product_import(uuid,uuid,uuid,integer[])', 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', 'public.commit_builder_product_import(uuid,uuid,uuid,integer[])', 'EXECUTE') as anon_execute;
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename='builder_product_imports';
select version, statements from supabase_migrations.schema_migrations
where version='20261004000100';
```

Also inspect `pg_get_functiondef()` for the exact commit function, verify all referenced tables/columns and the workspace-admin membership guard, and compare grants against the migration source and SHA above.

### Proposed Repair Decision

- If the table is absent and all dependencies match, obtain approval to apply **only** `20261004000100_builder_product_csv_import.sql` in a transaction. Do not apply all pending migrations.
- If the table already exists but the function is absent or differs, do not rerun the non-idempotent `CREATE TABLE` migration. Prepare a separately reviewed forward repair for only the missing function/grants/policies, then record migration history only in the manner approved by the database owner.
- If PostgreSQL has the correct function/grants but PostgREST cannot resolve it, the owner may approve a schema-cache reload (for example `NOTIFY pgrst, 'reload schema'`) and then repeat the API checks. Do not reload or alter production schema without approval.
- Verify the anonymous and authenticated roles cannot read or execute staging/commit operations; verify service-role writes still enforce the function's workspace membership and stale-preview checks.

## Database and Storage Recovery

A Postgres dump alone is not a complete Supabase recovery point. Record a database snapshot and a separate Storage object recovery point, with timestamps and hashes.

1. Freeze the candidate commit, manifest, migration checksum, and current migration history. Confirm the exact production project ref.
2. Obtain a full-project database recovery point using the approved Supabase backup/PITR mechanism. Record snapshot ID, timestamp, project ref, retention, and restore permissions. Verify the recovery point can be selected before proceeding.
3. Inventory all required Storage buckets and objects. Obtain a versioned bucket/provider snapshot or download a complete object manifest and bytes. Record per-object key, byte length, content type, and SHA-256; include the assets used by Product Library and job files. Verify object counts and hashes after restore.
4. Coordinate a maintenance window. Inventory database schedulers (`pg_cron`/Supabase scheduled functions), Vercel or external cron triggers, queue workers, email/SMS senders, webhooks, and payment integrations. Pause dispatch in the restore environment, replace provider credentials with disabled/sink credentials, and block outbound network egress. Record the scheduler/job IDs and a reversible re-enable sequence. Do not suppress production sends without explicit operator approval.
5. Restore the database and Storage snapshots into a separate, isolated Supabase project. Never restore over production for the demonstration.
6. Keep scheduled/outbound jobs disabled for the entire restore test. Verify no job is pending/running and no provider endpoint is reachable from the isolated environment.
7. Compare schema/migration history, RLS policies/grants, row counts for Product Library/configuration/import, selections, quote, procurement, and job snapshot tables. Compare Storage object counts, content types, lengths, and hashes. Validate foreign keys and workspace ownership.
8. Run authenticated Builder A/B acceptance against only the isolated project. Verify A cannot list/read/write B's products/imports/jobs and vice versa. Verify a fresh session can open/reopen, resync is idempotent, quote quantities/prices/GST remain correct, and unrelated approved job snapshots are unchanged.
9. Attach the restore logs, comparison report, object-hash report, scheduler suppression evidence, and test results to the release approval. Only then mark recovery verified.
10. Destroy the isolated restore only after the database/recovery owner confirms the evidence is retained and no outbound job ran.

## Release Acceptance Sequence

1. Freeze and hash an exact, reviewable Product Library/integration file manifest. Exclude unrelated worktree changes, incomplete modules, generated temp trees, environment files, and secrets.
2. Regenerate the lock only for the frozen manifest. Run `npm ci` with lifecycle scripts enabled in a supported clean environment; this Windows host's bundled node-gyp 11.2 cannot recognize VS18 for `better-sqlite3`. A scripts-disabled install is lock-integrity evidence only, not a complete install pass.
3. Run the production build from the clean install and the focused Product Library, selection-integrity, quotation save/reopen, procurement, security and browser suites.
4. Complete the authenticated Builder A/B workflow in isolated Supabase: import a source-backed test product, save to the database, select it, quote it, procure it, close/reopen with a fresh session, and resync. Verify replacement, quantity, GST basis, duplicate prevention, and preservation of unrelated approved job state.
5. Verify the exact production schema discrepancy read-only and obtain approval for one migration/repair only.
6. Recheck security audit findings and secret scanning for the frozen manifest. Any unresolved critical/high advisory requires a documented security-owner exception or a dependency fix plus regression run.
7. Obtain separate approvals for migration and deployment. Only then may the approved operation be run, followed by authenticated Builder A/B post-deployment smoke tests.

## Never Do

- Do not apply all pending migrations as a batch.
- Do not apply the requested migration until direct schema inspection establishes whether its table and function are absent or hidden from the REST schema cache.
- Do not use a localStorage-only Product Library entry as evidence of durable storage.
- Do not mutate production customer jobs to test pricing, replacement, variations, or resync.
- Do not claim backup/restore, authenticated production acceptance, or production readiness until their evidence is attached.
