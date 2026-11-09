# Client Selections — database release package (prepared 2026-11-01, NOTHING APPLIED)

Needs the owner's approval for each step. Run as the Supabase service role, in a maintenance window,
after a backup. Production was not read for this package (read access to production was not available
in this session); the production facts below were measured read-only on 2026-10-29/30 and must be
re-checked with the pre-checks in step 1.

## Migrations (main checkout, in this order)

| # | File | SHA-256 (first 12) | What it does |
|---|---|---|---|
| 1 | `supabase/migrations/20261010000100_builder_requirement_quote_mappings.sql` | `046ec97e5ece` | Creates `builder_requirement_quote_mappings` (the table behind Client Selections' HTTP 503 `REQUIREMENT_MAPPINGS_MIGRATION_REQUIRED`): RLS on, workspace members read, config admins write; version/stamp/updated_at/immutable-workspace triggers. |
| 2 | `supabase/migrations/20261011000100_requirement_mapping_product_identity.sql` | `24fff923c5dd` | Adds `product_id`; one mapping per (workspace, template, requirement, product, location). Finds and drops the old unique rule by its columns, not by a truncated name. |
| 3 | `supabase/migrations/20261021000100_builder_commercial_internal_member_rls.sql` | `b99248332102` | Adds `builder_commercial_is_internal_member()` and a RESTRICTIVE policy `internal_workspace_members_only` on 49 commercial / client-portal tables (including the mappings table). Enables RLS on any listed table where it is off. |

Verification already run (main checkout, 2026-11-01, all PASS):
- `scripts/test-client-selections-migrations.mjs` — all three on real PostgreSQL (PGlite), 12/12 checks.
- `scripts/test-commercial-internal-member-rls.mjs`, `scripts/test-requirement-mapping-migration.mjs`, `scripts/test-builder-tenant-foundation.mjs`.

## The marketing-role consequence (decision required before migration 3)

Migration 3 lets only `owner, admin, builder, builder_admin, builder_staff, estimator, interior_designer, sales`
read or change commercial data. Measured 2026-10-30: 562 workspace members, 561 `owner`, **one `marketing`**:
user `3d329181-20ea-4eab-ab9f-d35d2048f36b` (`gr***@gr8result.com`), workspace "support" (`846885cd-…`, the
builder workspace of this job), active since 2026-05-23. After migration 3 that user loses all access to that
workspace's projects, estimates, quotes, selections, selection books, procurement, BOQ, variations,
client-portal records and quote mappings. Marketing modules (email/SMS/CRM, landing pages) are unaffected.

Choose one: (a) apply as is; (b) add `'marketing'` to the role list in migration 3 first; (c) change that
member's role first.

## Step 1 — pre-checks (read-only; stop if any result differs)

```sql
-- Helper functions the migrations call must exist.
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in
 ('builder_commercial_is_workspace_member','builder_selection_is_config_admin',
  'builder_selection_immutable_workspace','builder_commercial_set_updated_at');          -- expect 4 rows
-- Not yet applied.
select to_regclass('public.builder_requirement_quote_mappings');                          -- expect NULL
select count(*) from pg_proc where proname = 'builder_commercial_is_internal_member';     -- expect 0
-- Roles that migration 3 would exclude (re-check the marketing member).
select role, count(*) from public.workspace_members group by role order by 2 desc;
select user_id, workspace_id, role, status from public.workspace_members
 where role not in ('owner','admin','builder','builder_admin','builder_staff','estimator','interior_designer','sales');
-- Tables migration 3 touches whose RLS is currently OFF (record them: the rollback does not turn RLS off again).
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
-- No commercial row without a workspace (such a row would disappear from every user after migration 3).
-- Run per table in migration 3's list: select count(*) from public.<table> where workspace_id is null;   -- expect 0
```

## Step 2 — backup

Take a Supabase point-in-time backup (or `pg_dump --schema-only` plus a data dump of the 49 tables in migration 3's list
and `public.workspace_members`). Keep the output of step 1 with it.

## Step 3 — apply (one transaction per file; each file already has begin/commit)

Apply 1, then 2, then 3. Stop on the first error (the file's own transaction rolls back).

## Step 4 — post-migration tests

```sql
select to_regclass('public.builder_requirement_quote_mappings');                          -- not NULL
select conname from pg_constraint where conrelid = 'public.builder_requirement_quote_mappings'::regclass and contype = 'u';
                                                                                         -- only builder_requirement_quote_mappings_identity_unique
select count(*) from pg_policies where schemaname = 'public' and policyname = 'internal_workspace_members_only';   -- 49
```
Then in the app (isolated build, real sign-in, a disposable project — never the live job):
1. Client Selections save no longer reports `REQUIREMENT_MAPPINGS_MIGRATION_REQUIRED`.
2. Reconcile Selections → confirm a mapping with "Reuse confirmed mappings" (owner/admin): the row appears in
   `builder_requirement_quote_mappings` with `product_id`, `version 1`; confirming again bumps `version`.
3. An owner still opens projects, estimates, selection books and the client portal.
4. If option (a) was chosen: the marketing user gets no rows from `projects` / `builder_selection_books`.
5. `scripts/test-commercial-internal-member-rls.mjs` and `scripts/test-client-selections-migrations.mjs` still pass.

## Rollback (service role; only if needed)

```sql
-- 3
do $$ declare t text; begin
  for t in select tablename from pg_policies where schemaname = 'public' and policyname = 'internal_workspace_members_only' loop
    execute format('drop policy internal_workspace_members_only on public.%I', t);
  end loop; end $$;
drop function if exists public.builder_commercial_is_internal_member(uuid);
-- (RLS stays enabled on tables where migration 3 turned it on; restore from the step-1 list if required.)
-- 2 and 1 — only while the table holds no mappings worth keeping (export it first):
drop table if exists public.builder_requirement_quote_mappings;
drop function if exists public.builder_requirement_mapping_version();
drop function if exists public.builder_requirement_mapping_stamp();
```

## Empty production selection book (project 244aedc0-c0ff-4f39-b8de-75ddb0ec3050)

Verified 2026-11-01 from the backups (`C:\Users\grant\cs-backup-20261031\prod-backup\`):
- `builder_selection_books-244aedc0-20261030.json`: 1 row, id `ee973186-7a42-4b31-96b3-74cb81a32615`, created 2026-10-30 10:06:33 +10.
- `builder_client_selections-244aedc0-20261030.json`: 157 rows, all `metadata.selection_book_id = ee973186-…`, all project 244aedc0,
  updated 2026-10-30 10:06:38–10:07:03 +10 (00:06–00:07 UTC), so both conditions of the recovery SQL below select exactly these rows.

Recovery (after approval; check both counts before commit):
```sql
begin;
delete from public.builder_client_selections
 where project_id = '244aedc0-c0ff-4f39-b8de-75ddb0ec3050'
   and metadata->>'selection_book_id' = 'ee973186-7a42-4b31-96b3-74cb81a32615'
   and updated_at >= '2026-10-30T00:00:00Z';          -- expect 157
delete from public.builder_selection_books
 where id = 'ee973186-7a42-4b31-96b3-74cb81a32615'
   and project_id = '244aedc0-c0ff-4f39-b8de-75ddb0ec3050'
   and created_at >= '2026-10-30T00:00:00Z';          -- expect 1
-- counts as expected: commit;   otherwise: rollback;
```
If either count differs, roll back: the book has since been overwritten by a real save from the job, which is the
alternative recovery (no deletion needed). Restore, if ever required, is an insert of the JSON backups.

Note (2026-11-01): the browser copy of the live job is gone (see `client-selections-live-job-recovery-20261101.md`).
Do not "recover" the job from this cloud book: it is the empty template book, not the job's selections.
