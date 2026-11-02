# Landing Pages and Funnel Builder release verification

## Development sign-off

**Status: DEVELOPMENT COMPLETE — STAGING ACCEPTED — FEATURE FROZEN.**

Final verification completed 2026-11-02:

- real staging fourteen-migration application: PASS;
- real PostgreSQL RLS, tenant isolation and CRM-note security: PASS;
- master-template browser acceptance: 9/9 PASS;
- campaign browser acceptance: 18/18 PASS;
- production build: PASS, 249/249 static pages.

No further feature development is approved for this module. Changes after this
point must be limited to an approved production-release correction or a defect
demonstrated by release/smoke testing.

### Release identity and changed-file manifest

Release branch: `release/landing-pages-v1-20261102`.

Validated base HEAD: `22d7b655068628a09978f6e4d714f3ee240b5a68`.

**Validated release payload commit:
`158070c6f057daf97197bf22d30aefefb41aedc6`.**

This commit was created in an isolated clean worktree from the validated base
and contains exactly the 42 manifest files below. Source/isolated SHA-256 parity,
the seven release-migration SHA-256 checksums, normalized-content parity for
the seven unchanged prerequisite migrations, focused API/model/migration
suites, targeted ESLint (zero errors), and unrelated-path diff review passed.
The subsequent metadata-only commit records this immutable payload SHA in this
document. The final 249/249 production build and browser suites apply to the
byte-identical 42-file source copied into this payload; Git checkout filters
only normalize line endings.

Release source/documentation files:

- `components/landing-pages/editor/LandingPageEditor.jsx`
- `components/landing-pages/renderer/styles.js`
- `lib/funnels/formSubmissions.js`
- `lib/funnels/previewToken.js`
- `lib/funnels/templateContent.js`
- `modules/funnels/README.md`
- `modules/funnels/RELEASE-READINESS.md`
- `pages/api/forms/submit.js`
- `pages/api/funnels/create-with-pages.js`
- `pages/api/funnels/cron-sync.js`
- `pages/api/funnels/manage.js`
- `pages/api/funnels/preview-token.js`
- `pages/api/funnels/public-page.js`
- `pages/api/funnels/templates.js`
- `pages/api/funnels/usage.js`
- `pages/modules/funnels/edit/[id].js`
- `pages/modules/funnels/index.js`
- `pages/modules/funnels/new.js`
- `pages/modules/funnels/templates.js`
- `pages/p/[slug].js`
- `scripts/bootstrap-landing-pages-staging.ps1`
- `scripts/lib/mock-supabase-server.mjs`
- `scripts/lib/owned-test-process.mjs`
- `scripts/recover-landing-page-inventory.mjs`
- `scripts/test-campaign-master-templates.mjs`
- `scripts/test-crm-lead-notes-access.mjs`
- `scripts/test-funnel-form-crm.mjs`
- `scripts/test-funnel-manage-api.mjs`
- `scripts/test-funnel-master-template-browser.mjs`
- `scripts/test-funnel-master-template-migration.mjs`
- `scripts/test-funnel-master-templates.mjs`
- `scripts/test-landing-page-browser.mjs`
- `scripts/test-landing-page-migration.mjs`
- `scripts/test-landing-page-model.mjs`
- `scripts/test-landing-pages-staging-bootstrap.mjs`
- `supabase/migrations/20260813085900_landing_pages_legacy_baseline.sql`
- `supabase/migrations/20260813090550_landing_pages_storage_buckets.sql`
- `supabase/migrations/20261101000100_funnel_master_templates.sql`
- `supabase/migrations/20261101000200_crm_lead_notes_access.sql`
- `supabase/migrations/20261101000300_campaign_master_templates.sql`
- `supabase/migrations/20261101000400_funnel_form_crm.sql`
- `supabase/migrations/20261101000500_landing_pages_security_hardening.sql`

Recovery and browser-output directories are evidence, not release source, and
must not be added to the release commit wholesale:
`artifacts/funnel-recovery/`, `artifacts/funnel-master-template-e2e/` and
`artifacts/landing-pages-e2e/`.

### Production release handover

#### Production migration order

The fourteen-file bootstrap is for an empty Supabase project and must **not**
be replayed blindly against populated production. Before execution, compare the
production migration ledger and schema to staging. Production must already have
the legacy account/workspace/funnel/CRM tables,
`20261014000100_landing_page_campaigns.sql`, and
`20261028000100_workspace_members_rls_recursion_fix.sql`. If either prerequisite
or its required objects are absent, stop and prepare a separately reviewed
forward migration.

Expected pending production migrations, in order:

1. `20261101000100_funnel_master_templates.sql`
2. `20261101000200_crm_lead_notes_access.sql`
3. `20261101000300_campaign_master_templates.sql`
4. `20261101000400_funnel_form_crm.sql`
5. `20261101000500_landing_pages_security_hardening.sql`

Also verify the `assets` and `Private-assets` Storage buckets and their policies.
Apply `20260813090550_landing_pages_storage_buckets.sql` only if the reviewed
production inventory proves that this compatible bucket configuration is
missing. Never apply
`20260813085900_landing_pages_legacy_baseline.sql` to populated production
without a separate schema/data reconciliation review.

#### Backup and recovery prerequisites

Before migration approval:

1. Confirm the project reference/name is the intended production project.
2. Record the current migration ledger, schema fingerprint, grants and RLS
   policies.
3. Confirm a completed recoverable backup made immediately before execution.
4. Record whether PITR is enabled and its latest usable recovery point.
5. Confirm the authorized operator can initiate and monitor a restore.
6. Schedule downtime and prohibit concurrent schema/application releases.
7. Preserve a schema-only dump and the release/migration logs outside the
   application host.

If only physical backups are available, explicitly accept their recovery point
and data-loss window before migration.

#### Deployment procedure

1. Create and review the scoped release commit from the manifest above.
2. Reconfirm production ledger/schema prerequisites and backup status.
3. Put the Landing Pages/Funnel Builder release into a controlled maintenance
   window; do not modify unrelated modules.
4. Apply the five pending migrations in order, stopping at the first error.
   Do not improvise SQL repairs.
5. Run the post-migration assertions: exact ledger entries; expected columns,
   constraints and indexes; RLS on all module tables; grants/helper-function
   ACLs; anonymous CRM-note denial; Storage bucket/policy configuration.
6. Deploy the reviewed application commit through the normal production
   pipeline with required Supabase, Storage and `CRON_SECRET` configuration.
7. Run the live smoke checklist below with isolated disposable accounts/data.
8. Remove only disposable smoke-test records after evidence is retained.

Production migration approval, application deployment approval and live
smoke-test approval are three separate decisions.

#### Live smoke-test checklist

- Administrator can promote a disposable classic funnel and JSON campaign
  snapshot as masters.
- Subscriber catalogue lists, previews and clones both template kinds.
- Builder A and Builder B receive independent draft copies with new ownership,
  workspace IDs and remapped multi-step/page links.
- Master snapshots and original published records remain unchanged.
- Draft edit, save, refresh and reopen preserve content.
- Desktop, tablet and mobile previews render correctly.
- Publish, public URL, republish and unpublish work.
- Anonymous enquiry creates one correctly scoped submission, CRM lead and CRM
  note; duplicate submission does not create another lead/note.
- Anonymous CRM-note access is denied.
- Builder A cannot read or mutate Builder B funnels, campaigns, pages,
  submissions, leads, notes or private previews.
- Expired/mismatched preview tokens are denied.
- Storage upload/display works for permitted MIME/size limits; private assets
  do not leak into shared template snapshots.
- Retry scheduler authenticates with `CRON_SECRET` and processes only eligible
  failed CRM submissions.
- Existing published funnels/pages and recovered candidate documents remain
  present and unchanged.

#### Rollback procedure

On any unexpected migration error, stop immediately, preserve logs and do not
run repair SQL. If the chain is partially applied but the database is healthy,
keep additive schema and restrictive policies, disable the new application
surfaces, and prepare a reviewed forward-fix migration. Never weaken CRM-note
security, delete master snapshots, or drop subscriber data as rollback.

If integrity or availability cannot be restored safely with a forward fix,
restore the confirmed pre-release backup/PITR point using the approved Supabase
recovery procedure, then redeploy the previous application commit. After either
path, rerun schema/RLS assertions and the critical tenant-isolation smoke tests
before reopening the module.

---

The detailed chronology below is retained as historical evidence. Earlier
blocked verdicts and failed connection attempts are superseded by the
development sign-off and final gate table above.

No commits, pushes, deployments, production migrations, or production data
changes were made. The existing server on port 3000 was observed but not
touched. Final browser stacks ran sequentially on ports 3128/3129 with
isolated PGlite-backed mock databases on 54518/54519. Only verified test-owned
process trees were terminated.

The application verification gate passed, but the database release gate did
not. A DPAPI-protected staging URI is available, project identity has been
confirmed, and PostgreSQL read-only TLS authentication now passes. The staging
schema, migration compatibility, RLS policies, grants, tenant isolation and
recovery procedure still require real-database verification. PGlite results
below remain regression evidence only and are not represented as real staging
security proof.

### Real staging connection attempt — 2026-11-02

The DPAPI-protected credential at
`C:\Users\grant\.gr8result\staging-db.xml` was loaded under the current Windows
user without printing or writing its URI/password. Supabase management metadata
confirmed that its project reference is `gr8-result-staging`, its region is
Sydney, and its reference differs from the production project. The protected
URI is structurally a Sydney Supabase session-pooler URI and does not contain
an obvious placeholder.

The PostgreSQL TLS connection was rejected during password authentication.
Therefore no staging schema, data, grants, policies or migration history were
read, and no SQL was applied. To continue, replace/re-export the DPAPI file with
the current database password (or reset the staging database password and
export a new session-pooler URI), then repeat the read-only connection check.
Project identity is confirmed through Supabase management metadata; database
identity and schema compatibility remain unconfirmed until authentication
succeeds.

Retry at 07:18: the newly supplied path
`C:\Users\grant.gr8result\staging-db.xml` does not exist. The previously known
file at `C:\Users\grant\.gr8result\staging-db.xml` was updated at 07:01, but
its refreshed `PSCredential` contains a nonempty username, an empty protected
password, and no PostgreSQL URI in either field. A PostgreSQL authentication
attempt therefore cannot be made from the refreshed file. Re-export a
`PSCredential` whose protected value contains the complete session-pooler URI,
or whose username contains the URI and whose protected password contains the
current database password. Do not store an empty secure string.

Retry at 07:39: **PASS**. The corrected DPAPI file contains a structurally
valid PostgreSQL URI. A TLS session and explicitly read-only transaction
succeeded. `SELECT current_database(), current_user();` returned values matching
the protected database and pooler identity without printing either value.
Supabase management metadata independently confirmed `gr8-result-staging`,
Sydney region and a project reference different from production. No schema or
data mutation and no migration occurred.

### Real staging schema audit — 2026-11-02

The read-only PostgreSQL 17.11 audit completed against the confirmed staging
project.

**Existing state**

- Supabase platform schemas exist: `auth`, `extensions`, `graphql`,
  `graphql_public`, `realtime`, `storage` and `vault`.
- Platform roles `anon`, `authenticated`, `service_role` and
  `supabase_admin` exist with expected high-level attributes:
  `anon`/`authenticated` do not bypass RLS; `service_role` does.
- `auth.users`, `storage.objects`, `realtime.messages` and `vault.secrets`
  exist. Required extensions include `pgcrypto`, `uuid-ossp` and
  `supabase_vault`.
- The `public` schema contains **zero tables, zero policies, zero indexes and
  zero table constraints**. It contains only Supabase's `rls_auto_enable()`
  event-trigger helper. That platform function is `SECURITY DEFINER`, owned by
  `postgres`, fixed to `search_path=pg_catalog`, and executable by API roles,
  but its `event_trigger` return type prevents ordinary RPC use; preserve it.
- `supabase_migrations.schema_migrations` does not exist, so no GR8 Result
  migration has been recorded.
- No Storage buckets or Storage object/bucket policies exist. Both the public
  `assets` bucket and private `Private-assets` bucket are absent.
- `anon`, `authenticated` and `service_role` have `USAGE` but not `CREATE` on
  `public`, which is an appropriate starting boundary.

**Missing required objects**

Every queried module table is absent:

- Workspace: `workspaces`, `workspace_members`, `workspace_entitlements`,
  `communities`.
- Classic funnel/CRM: `funnels`, `funnel_steps`, `leads`, `lead_notes`,
  `form_submissions`.
- Landing Pages: `landing_campaigns`, `landing_pages`,
  `landing_page_versions`, `landing_page_submissions`,
  `landing_page_events`, `landing_audit_log`.
- Complete application integration also requires legacy `accounts`,
  `email_lists`, `subscribers`, `list_subscribers`, `tags` and
  `subscriber_tags`. No repository migration creates these tables.
- `business_profile_vaults` has a repository migration, but that migration
  requires the missing legacy `accounts` table.
- Landing/funnel image upload requires the missing public Storage bucket
  `assets`. Business-profile documents require the missing private bucket
  `Private-assets`.

**Security and migration conflicts**

1. Staging's default privileges for tables created by `postgres` include
   non-DML table privileges for `anon` and `authenticated`. Several workspace,
   business-profile and landing-page migrations do not begin by revoking all
   client privileges. A reviewed hardening migration must explicitly revoke
   `PUBLIC`/`anon` access and grant only required operations per table; do not
   rely on default privileges.
2. Staging's default privileges for functions created by `postgres` grant
   execution only to `postgres`. `lp_is_workspace_member(uuid)` and
   `is_workspace_member(uuid)` are used inside authenticated RLS policies but
   their migrations do not explicitly grant execution to `authenticated`.
   Those policies would fail closed with function-permission errors. Revoke
   `PUBLIC`/`anon`, then grant execute to `authenticated` and `service_role`.
3. `assert_workspace_member(uuid,uuid)` is `SECURITY DEFINER` without a fixed
   `search_path` or explicit ACL. Harden it to `pg_catalog, public`, revoke
   `PUBLIC`/client execution and grant only the server role that needs it.
4. The 20260813 workspace migrations catch broad `WHEN others` exceptions.
   With the legacy tables absent they can appear successful while silently
   skipping required `leads` and `funnels` alterations. Baseline tables must
   exist first, and post-step schema assertions are mandatory.
5. `20260813090500_workspace_crm_refactor.sql` installs a recursive
   `workspace_members` policy. It must be followed by the 20261028
   security-definer recursion fix before any authenticated acceptance test.
6. `lead_notes` is scoped by `user_id`, not directly by workspace. Separate
   Builder A/B users can be isolated, but a user belonging to multiple
   workspaces is not strictly note-isolated. Prefer a policy joining the note's
   owning lead to `leads.workspace_id` plus active membership.
7. Funnel policies retain legacy rows whose `workspace_id` is null. On this
   empty staging project there is no compatibility need; a reviewed baseline
   should make workspace identity mandatory for new rows and define any
   production backfill separately.
8. Constraint-existence checks in the landing-page and campaign-template
   migrations use constraint name without relation identity. Fresh staging has
   no collision, but post-step assertions must bind each constraint to its
   intended table.
9. The selected chain contains no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`,
   bulk `DELETE` or destructive data rewrite. It does replace policies,
   triggers/functions and grants. Failure outside a transaction could leave a
   partially secured schema, so each file must run transactionally with
   stop-on-error and immediate assertions.

**Readiness verdict:** real schema inspection **PASS**. A baseline and
privilege/function hardening migration are now prepared and disposable
validation passes, but staging remains **not approved for migration** until
review, backup confirmation and a real staging dry-run complete.

### Landing Pages baseline recovery

The authoritative legacy column source is the existing development Supabase
PostgREST OpenAPI schema, inspected with the service credential in metadata-only
mode. It exposes 316 table definitions and was queried without selecting any
customer row. It confirmed current structures for `accounts`, `workspaces`,
`workspace_members`, `funnels`, `funnel_steps`, `leads`, `lead_notes`,
`form_submissions`, `email_lists`, `subscribers`, `tags` and
`subscriber_tags`.

Repository files `supabase/supabase-schema.sql` and
`supabase/bot-schema.sql` are small unrelated snapshots and are not an
authoritative application baseline. No historical migration creates the
legacy funnel/CRM/email tables. Development also lacks `list_subscribers`
despite the production form path requiring it; the baseline adds that
idempotent link table from the existing `lib/emailDB.js` contract and browser
acceptance schema.

Prepared bootstrap components:

- `supabase/migrations/20260813085900_landing_pages_legacy_baseline.sql`:
  minimum development-compatible accounts, funnel, CRM and email-list tables,
  keys, indexes, initial RLS and least-privilege grants.
- `supabase/migrations/20260813090550_landing_pages_storage_buckets.sql`:
  bounded public `assets` and private `Private-assets` buckets.
- `supabase/migrations/20261101000500_landing_pages_security_hardening.sql`:
  explicit table ACL normalization, membership-function ACL/search-path fixes,
  workspace-scoped lead/note policies, required workspace checks and
  non-demo workspace compatibility.
- `scripts/bootstrap-landing-pages-staging.ps1`: plan-only by default; creates
  an exact temporary Supabase workdir containing only the fourteen reviewed
  migrations. Dry-run/apply load the DPAPI credential without putting the
  password in command arguments. Apply requires both backup confirmation and
  the exact staging confirmation phrase.
- `scripts/test-landing-pages-staging-bootstrap.mjs`: disposable PGlite
  validation.

Disposable validation result: **PASS**. The complete chain applies twice,
creates every required table/bucket, enables RLS, removes anonymous table
access including `TRUNCATE`, grants the policy membership helpers correctly,
isolates Builder A from Builder B funnels/campaigns/leads/notes, denies
anonymous CRM-note access, and keeps campaign snapshots immutable.

The bootstrap package is ready for review and real staging **dry-run**, not
approved apply. PostgREST metadata does not expose development indexes, grants
or RLS policies; those security objects were deliberately reconstructed from
repository migrations and tightened, then tested in disposable PostgreSQL.
This residual difference must be accepted during review and proven on staging.

### Conditional staging migration plan

With read-only authentication established:

1. Connect over TLS in a read-only transaction. Reconfirm the database project
   reference against Supabase management metadata and prove it differs from
   production.
2. Export schema-only metadata and record `supabase_migrations` history,
   extensions, roles, table definitions, FKs, RLS flags, policies, grants,
   function owners, `SECURITY DEFINER` settings and function ACLs. Take or
   confirm a recoverable staging backup before any DDL.
3. Reconcile the actual schema against the missing legacy-table baseline. Do
   not apply a fixture-derived baseline. Create/recover a reviewed migration
   only for genuinely absent `funnels`, `funnel_steps`, `leads`, `lead_notes`
   and `form_submissions` tables/columns.
4. Apply each prerequisite migration in its own controlled transaction where
   PostgreSQL permits it. After every step, assert expected objects and abort
   if broad exception handlers skipped an alteration.
5. Apply the workspace foundation/refactor migrations, the landing campaign
   migration and the workspace recursion fix in the order documented below.
6. Apply the four 20261101 migrations in timestamp order. Re-run each once to
   confirm intended idempotence, then compare schema and policies to the
   reviewed expected state.
7. Create isolated Administrator, Builder A and Builder B identities/workspaces
   plus disposable records. Prove cross-builder denial for funnels, steps,
   campaigns, versions, submissions, leads and notes; prove anonymous CRM-note
   denial; prove service-only sync/clone functions; and verify campaign snapshot
   immutability.
8. Exercise application-first rollback: retain additive schema and restrictive
   policies, disable/revert application exposure if necessary, and use reviewed
   forward migrations for defects. Restore the staging backup only for a
   destructive migration failure. Never weaken CRM-note policies as a rollback.
9. Record PASS/FAIL evidence before requesting separate production migration
   approval. Staging success is not production or deployment approval.

### Reviewed execution order for this staging project

No step below is approved for execution yet. Before applying anything, capture
a staging schema-only dump plus Supabase project backup/PITR status and record
the empty-public-schema fingerprint and platform privilege metadata.

The exact reviewed migration order is:

1. `20260813085900_landing_pages_legacy_baseline.sql`
2. `20260813090100_account_onboarding_gate.sql`
3. `20260813090300_workspace_part1_tables.sql`
4. `20260813090400_workspace_part2_security.sql`
5. `20260813090500_workspace_crm_refactor.sql`
6. `20260813090550_landing_pages_storage_buckets.sql`
7. `20260813090600_business_profile_vault.sql`
8. `20261014000100_landing_page_campaigns.sql`
9. `20261028000100_workspace_members_rls_recursion_fix.sql`
10. `20261101000100_funnel_master_templates.sql`
11. `20261101000200_crm_lead_notes_access.sql`
12. `20261101000300_campaign_master_templates.sql`
13. `20261101000400_funnel_form_crm.sql`
14. `20261101000500_landing_pages_security_hardening.sql`

The runner must record every migration in `supabase_migrations`, stop on the
first error and run post-migration schema assertions. Only after schema
verification may disposable Administrator, Builder A, Builder B and anonymous
identities be created for real PostgreSQL RLS, cloning, immutability, CRM and
browser acceptance.

Recovery is application-first and forward-fix oriented. Because staging public
schema is currently empty, a failed first execution can be recovered from the
pre-migration backup after preserving failure evidence. Once test records
exist, retain additive schema/restrictive policies, disable application
exposure if needed and use reviewed forward migrations. Never restore
anonymous CRM access or delete template/campaign records as a rollback.

Approval-gated procedure:

```powershell
# Safe plan-only validation; no credential or database connection
.\scripts\bootstrap-landing-pages-staging.ps1 -Mode Plan

# Next approval step: real staging connection and migration dry-run only
.\scripts\bootstrap-landing-pages-staging.ps1 -Mode DryRun

# Do not run until backup and migration execution are separately approved
.\scripts\bootstrap-landing-pages-staging.ps1 `
  -Mode Apply `
  -BackupConfirmed `
  -Confirmation "APPLY gr8-result-staging"
```

The immediate approval requested is **DryRun only**. Apply remains blocked
until the dry-run output, reviewed SQL and staging backup/PITR status are
accepted.

### Authorised staging dry-run — 2026-11-02

**Verdict: BLOCKED pending explicit acceptance of the dry-run side effect and
recovery limitation.**

Plan mode passed without loading credentials or connecting to a database. The
first DryRun attempt exposed two Windows PowerShell 5 runner defects: native
stderr version notices were terminating errors, and multiline JSON from
`supabase projects list` was not joined before parsing. The runner now handles
native stderr without suppressing exit-code failures, parses the complete JSON
document, verifies the URI database name, prints the verified non-secret target
and records a SHA-256 manifest.

The corrected DryRun verified:

- project: `gr8-result-staging`;
- region: `ap-southeast-2` (Sydney);
- database: `postgres`;
- authenticated database role: `postgres`;
- all fourteen files exist in the exact reviewed order;
- Supabase CLI reported every file as “Would push” and reported that migrations
  would not be pushed;
- `public` still has zero base tables and zero policies;
- Storage still has zero buckets;
- migration history contains zero applied migration rows.

However, the remote schema is not byte-for-byte unchanged. Before DryRun the
read-only audit found no `supabase_migrations.schema_migrations` ledger. After
DryRun, read-only PostgreSQL inspection found empty
`supabase_migrations.schema_migrations` and
`supabase_migrations.seed_files` tables. This is consistent with Supabase CLI
v2.54.11 initializing migration metadata before producing its dry-run plan.
No application migration ran, but the requirement that no staging SQL/table
creation occur cannot be certified. These empty metadata tables have not been
removed because cleanup was not authorised.

Actual project recovery metadata:

- two physical backups report `COMPLETED`, at
  `2026-11-01T20:28:25.894Z` and `2026-11-01T21:48:00.099Z`;
- WAL-G reports enabled;
- PITR reports **disabled**.

Therefore recovery is limited to the available physical backup workflow; an
arbitrary pre-apply timestamp cannot be restored using PITR. A new completed
backup or explicit acceptance of the latest completed physical backup is
required before `-BackupConfirmed` can truthfully be supplied.

SQL review found no `DROP TABLE`, `DROP SCHEMA`, `DROP DATABASE`, `TRUNCATE`,
data `DELETE`, column drop or constraint drop in the fourteen-file chain.
Expected destructive-looking operations are limited to idempotent replacement
of RLS policies and triggers. Runtime functions update CRM synchronization
fields only when invoked after deployment. The workspace foundation migrations
contain broad `EXCEPTION WHEN others` compatibility blocks; the final hardening
migration assertions and post-apply verification remain mandatory so a skipped
dependency cannot be treated as success. Disposable full-chain execution twice
continues to pass.

Recorded SHA-256 manifest:

| Migration | SHA-256 |
| --- | --- |
| `20260813085900_landing_pages_legacy_baseline.sql` | `8996fc5f5bf6f98b5f78299770540fc3c3f97c3f9c2d9ad0da3c56e0f5183d7c` |
| `20260813090100_account_onboarding_gate.sql` | `cbf4d51e2179d75c748048a0507dfa0d66b8c9a735a71a340158a97bc4f9adcf` |
| `20260813090300_workspace_part1_tables.sql` | `ced218febb1a785a0273788304e48458f8e89b2becd61814da3c6cc28ef7f4c2` |
| `20260813090400_workspace_part2_security.sql` | `c0ef123014b0f9e3d345ca8cdc4c896dc9f3c3842bcd9774f38c6cac3cffda3f` |
| `20260813090500_workspace_crm_refactor.sql` | `4af288d91082b284642644f1ee1c6a405343e1de0ae79a9921afc15d434d6300` |
| `20260813090550_landing_pages_storage_buckets.sql` | `786944763424c558d413a505be13ca0065d3335dde62973bea422876e60a5830` |
| `20260813090600_business_profile_vault.sql` | `3c894d59a094b96d532208799232c34e9a7b9d860e8174c7bb920202946be003` |
| `20261014000100_landing_page_campaigns.sql` | `80f435a51e41422f2c2064b9e3ee977a8e02d039576f45a02dfce6ecf417cef8` |
| `20261028000100_workspace_members_rls_recursion_fix.sql` | `16f6f7b537b7d52a86fd5ca1fcf8ded3debbe9abe0e9d9f99a4a3d1b9fc322f9` |
| `20261101000100_funnel_master_templates.sql` | `9b9304a908edd3221b4536ae26b31dbb0f39bc33ff4b44d37c9ec16fbac2aa89` |
| `20261101000200_crm_lead_notes_access.sql` | `da830840db43d7152de0c62525fc817bc35f689ed206881b030e592b834251a0` |
| `20261101000300_campaign_master_templates.sql` | `390fd41bef8716ab62143041956aa7568fb55c4b94ff07a7621b5e5b5e93ccee` |
| `20261101000400_funnel_form_crm.sql` | `9f5af8f342bc9f807eebce7711273ac430cd07571d838acf6ca4498542f35938` |
| `20261101000500_landing_pages_security_hardening.sql` | `23512f391070f4c820f75dc091dd33f521616e3e539ebe740b33b067eef71b00` |

If the empty CLI metadata tables and physical-backup-only recovery are accepted
under separate approval, the exact application command remains:

```powershell
.\scripts\bootstrap-landing-pages-staging.ps1 `
  -Mode Apply `
  -BackupConfirmed `
  -Confirmation "APPLY gr8-result-staging"
```

### Staging application and security acceptance — 2026-11-02

The CLI metadata side effect and physical-backup-only recovery were explicitly
accepted for staging. Recovery was verified before application:

- two pre-apply physical backups were `COMPLETED`;
- the latest usable pre-apply backup is
  `2026-11-01T21:48:00.099Z`;
- Supabase documents full-project restore through Dashboard >
  Database > Backups by selecting the closest backup before the failure;
- for a partial chain, execution stops, logs are retained, no repair SQL is
  attempted, and staging is restored wholesale to that pre-apply backup;
- PITR remains disabled, so arbitrary timestamp recovery is unavailable.

The approval-gated runner re-verified `gr8-result-staging`,
`ap-southeast-2`, database `postgres`, and printed the reviewed SHA-256
manifest immediately before execution. All fourteen migrations applied in
order with exit code 0. Output contained only expected idempotent
“does not exist, skipping” and “already exists, skipping” notices; no
unexpected migration error or improvised repair occurred.

Post-apply read-only inspection:

- migration ledger: all fourteen exact versions, in order;
- public base tables: 23;
- public base tables with RLS enabled: 23;
- Storage buckets: public `assets`, private `Private-assets`.

Real PostgreSQL security acceptance used disposable Administrator, Builder A
and Builder B identities in one transaction that was always rolled back.
Results:

- Builder A and Builder B see only their own funnels, steps, campaigns, leads
  and CRM notes;
- cross-workspace funnel insertion is denied by RLS;
- anonymous CRM-note reads are denied with SQLSTATE `42501`;
- the same campaign master creates independent two-page draft clones for both
  builders;
- cloned campaigns and pages have the correct workspace and creator;
- the master snapshot remains unchanged and mutation is denied;
- cross-tenant clone requests are denied;
- CRM synchronization produces a workspace-scoped lead and one note;
- repeated synchronization is idempotent;
- Builder B cannot read Builder A's synchronized lead or note.

Current API/model/migration acceptance passed after invoking the established
extensionless-import loader:

- Landing Page campaign API: passed;
- Landing Page model: passed;
- classic master-template API: passed;
- funnel management API: passed;
- JSON campaign masters: passed;
- classic funnel CRM: passed;
- combined campaign/CRM-note migration: passed;
- funnel master migration: passed.

Final browser and production-build reruns are **BLOCKED, not passed**. The
first preflight reported 8000 MB commit headroom, below the established
8192 MB minimum. A later check recovered to 8330 MB, allowing one isolated
master-template browser run. That run passed 8/9 scenarios:

- all eight classic funnel scenarios passed;
- the final JSON-native scenario successfully promoted, previewed and cloned
  the campaign, saved the page with HTTP 200, reloaded it with HTTP 200 and
  fetched the page with HTTP 200;
- its final browser wait for the saved headline timed out after 240 seconds.

The same scenario passed in the previous 9/9 final-release run, while the
current server log contains no failed request. One isolated retry was planned,
but post-cleanup commit headroom was 6968 MB and, after 60 seconds, 7460 MB.
Both are below the safety threshold, so no retry was launched. The campaign
browser harness and production build were not started. Physical memory remained
above 9 GB; commit headroom was the sole resource blocker.

Follow-up diagnosis confirmed an unreliable browser assertion rather than an
editor persistence defect. Editable text commits through React `onBlur`, but
the harness blurred the headline and immediately clicked Save without waiting
for React to publish the updated document to `docRef`. The intermittent race
could therefore send a valid HTTP 200 save containing the pre-edit snapshot,
which matches the failed run: save, reload and fetch all succeeded, but the
reloaded headline remained old. The harness now waits for the visible
`Unsaved` state before clicking Save. No application persistence code changed.

The first required rerun was deferred when preflight reported 6514 MB commit
headroom, exactly 1678 MB below the 8192 MB safety requirement. Once resources
recovered, all remaining operations passed their separate preflights and ran
sequentially:

- master browser: 9387 MB preflight, then **9/9 PASS**;
- complete fixture-backed campaign browser: 9084 MB preflight, then
  **18/18 PASS**;
- production build: 9253 MB preflight, exit 0, compiled successfully in
  5.3 minutes and generated **249/249** static pages.

The corrected master-browser run proves that the previous failure was the
harness race, not lost persistence. An initial plain campaign invocation
correctly stopped at publish because regression mode omits the fixture-only
photography completion scenarios. The documented complete acceptance was then
run with `LP_E2E_FIXTURES=1` and passed 18/18.

Current release-gate matrix:

| Gate | Current result |
| --- | --- |
| Recovery procedure and completed pre-apply backup | PASS |
| Staging target and reviewed checksum manifest | PASS |
| Fourteen-migration staging application | PASS |
| Migration ledger, schema, RLS and Storage assertions | PASS |
| Real PostgreSQL Builder A/Builder B isolation | PASS |
| Anonymous CRM-note denial | PASS |
| Master immutability and tenant-safe two-page cloning | PASS |
| CRM routing and duplicate synchronization protection | PASS |
| API/model/migration suites | PASS |
| Master-template browser | PASS — 9/9 |
| Campaign browser | PASS — 18/18 |
| Production build | PASS — exit 0; 249/249 static pages |

**STAGING ACCEPTANCE PASSED.** Production remains unchanged and still requires
separate backup/recovery, migration, deployment and live smoke-test approvals.

### Resolved staging migration prerequisites

Repository dependency analysis originally found that a fresh Supabase project
could not apply the four Landing Pages migrations directly:

1. Recover or create a reviewed GR8 Result baseline migration for the legacy
   `funnels`, `funnel_steps`, `leads`, `lead_notes`, and `form_submissions`
   tables. No repository migration creates these tables. The baseline must
   preserve the columns and foreign keys used by the current APIs; do not infer
   a production schema from test fixtures.
2. Apply `20260813090300_workspace_part1_tables.sql`, then
   `20260813090400_workspace_part2_security.sql`, then
   `20260813090500_workspace_crm_refactor.sql`. These create/patch the workspace
   foundation and add required workspace/CRM compatibility columns.
3. Apply `20261014000100_landing_page_campaigns.sql`. It creates campaigns,
   pages, versions, submissions, events, audit records and the campaign CRM
   sync, but requires the workspace foundation and legacy `leads`/`lead_notes`
   tables first.
4. Apply `20261028000100_workspace_members_rls_recursion_fix.sql` after the
   workspace refactor. The earlier refactor installs a self-referencing
   `workspace_members` policy; this migration replaces it with a
   security-definer membership predicate.
5. Only then apply the four module migrations in their existing order:
   `20261101000100`, `20261101000200`, `20261101000300`,
   `20261101000400`.

This dependency order was resolved by the reviewed fourteen-migration staging
bootstrap. It is not authorization to skip unrelated migrations required by
the complete GR8 Result production application.

Security concerns verified on real staging:

- The reviewed legacy baseline applied successfully.
- Workspace migrations contain broad `EXCEPTION WHEN others` blocks that can
  hide skipped compatibility operations; final assertions passed and all
  fourteen ledger versions were recorded.
- `20260813090500_workspace_crm_refactor.sql` temporarily creates recursive
  membership RLS; the 20261028 correction applied later in the same chain.
- Lead-note access is constrained through the owning lead workspace; Builder
  A/B isolation and anonymous denial passed against real PostgreSQL.
- New funnels and leads require workspace identity.
- Security-definer search paths, execute revocations and client grants passed
  real-role verification.

## Final release gates

| Gate | Verdict | Evidence |
| --- | --- | --- |
| Production build | PASS | Exit 0; compiled in 5.3 minutes; 249/249 static pages generated from final code |
| Master-template browser acceptance | PASS | 9/9 on isolated ports; administrator promotion, two-builder cloning/isolation, immutable originals and native JSON reopening |
| Campaign browser acceptance | PASS | 18/18 on isolated ports; editing, persistence, publishing, CRM delivery, duplicate protection, responsive rendering and unpublish recovery |
| API/model regression | PASS | Campaign API 28; model 45; JSON masters 8/8; classic CRM 8/8; classic master and management APIs passed |
| Real PostgreSQL connection/schema inventory | PASS | Confirmed non-production Sydney project; all fourteen migrations recorded; 23/23 public tables have RLS |
| Real PostgreSQL migration compatibility | PASS | Reviewed fourteen-file chain applied in order with no unexpected migration errors |
| Real PostgreSQL RLS/grant proof | PASS | Administrator, Builder A, Builder B and anonymous-role security scenarios passed and disposable records rolled back |
| Staging recovery readiness | PASS | Two completed pre-apply physical backups and documented full-project restore procedure; PITR remains disabled and accepted for staging |
| **Overall staging acceptance** | **PASS** | Production still requires separate backup/recovery, migration, deployment and live smoke-test approvals |

## Production-pending module migrations

Apply only to approved production after the prerequisite inventory and backup
steps in the handover above:

| Order | Migration | Real staging | Production |
| --- | --- | --- | --- |
| 1 | `20261101000100_funnel_master_templates.sql` | APPLIED/PASS | PENDING APPROVAL |
| 2 | `20261101000200_crm_lead_notes_access.sql` | APPLIED/PASS | PENDING APPROVAL |
| 3 | `20261101000300_campaign_master_templates.sql` | APPLIED/PASS | PENDING APPROVAL |
| 4 | `20261101000400_funnel_form_crm.sql` | APPLIED/PASS | PENDING APPROVAL |
| 5 | `20261101000500_landing_pages_security_hardening.sql` | APPLIED/PASS | PENDING APPROVAL |

The prerequisite campaign schema migration
`20261014000100_landing_page_campaigns.sql` and workspace-recursion correction
`20261028000100_workspace_members_rls_recursion_fix.sql` must already be
present in production. Do not blindly reapply either to populated production.

## Security-role evidence

| Identity | Isolated application/PGlite evidence | Real staging PostgreSQL verdict |
| --- | --- | --- |
| Administrator | PASS: promotes classic and JSON masters; source records remain unchanged | PASS |
| Builder A | PASS: sees/edits only owned copies, campaigns, leads and notes | PASS |
| Builder B | PASS: cannot read Builder A funnels, campaigns, submissions, copies or CRM notes | PASS |
| Anonymous | PASS in PGlite: private funnels/steps and populated CRM notes denied; public form capture follows server-derived routing | PASS: CRM-note access denied with SQLSTATE `42501` |

## Actual acceptance results

| Verification | Result | Scope |
| --- | --- | --- |
| Classic + JSON master browser acceptance | 9/9 passed | Administrator promotion; subscriber catalogue and desktop/mobile preview; multi-step draft cloning; native JSON editing; CRM setting separation; edit/save/reopen; publish/unpublish; anonymous classic enquiry delivery to CRM and the correct email list; duplicate protection; independent subscribers; cross-builder preview and token denial; published originals preserved |
| Campaign browser acceptance | 18/18 passed | Creation/interview; deterministic AI/image fixtures; headline and assistant edits; uploads; save/reload; incomplete-imagery publish refusal; public desktop/mobile layouts; enquiry and CRM attribution; duplicate submission protection; republish; tenant isolation; five business fixtures at desktop/tablet/mobile; unpublish failure feedback and successful retry |
| Campaign API scenarios | 28 passed | Real handlers against isolated data; version conflict; CRM outage/retry; expired forms; failed persistence; duplicate protection; isolation; publishing and archiving; provider fallback reporting |
| Landing-page model | 45 passed | Generation, editing, validated structure, forms, image selection, factual copy, provider evidence, budgets, publish checks and readiness |
| Master API and funnel management API | Passed | Authenticated ownership; CRM list validation; multi-step copying; preview tokens/expiry; administrator gate; failure recovery |
| JSON campaign master scenarios | 8/8 passed | Immutable/idempotent snapshots; two independent builders; remapped page links; private asset refusal; idempotent clone receipts; atomic rollback; direct RLS/RPC denial; published clone CRM delivery without notifying the master |
| Classic funnel CRM scenarios | 8/8 passed | Owner derived from published funnel without a list; spoofed routing ignored; durable capture before CRM; duplicate protection; outage rollback/retry; invalid/draft/master forms denied; archive failure explicitly fails; safe redirects; archive RLS and scheduler authorization |
| Master migration regression | Passed in PGlite only | Idempotence; separate builder identities; direct table RLS; protected master metadata |
| Campaign + CRM-note migration regression | Passed in PGlite only | Applied twice to isolated schema; atomic CRM sync still creates notes; grants/RLS and tenant isolation |
| CRM-note migration regression | Passed in PGlite only | Anonymous SELECT denied on populated table; authenticated reads isolated; direct writes denied; service-role writes retained |
| Targeted ESLint | Passed | Final routing/sanitizer, catalogue API, campaign editor and associated harnesses: zero errors, three existing public-renderer hook warnings; scoped whitespace check passed |
| Final production build | Passed | Final source including routing sanitization and continuation redirects; exit 0, compiled in 6.3 minutes, 249/249 static pages generated; isolated output and fake Supabase credentials, paid-provider keys blank |

Browser evidence:

- Final classic/JSON browser results:
  `artifacts/funnel-master-template-e2e/2026-11-02-final-release/results.json`.
- Final campaign results:
  `artifacts/landing-pages-e2e/final-release-2026-11-02/results.json`.
- Campaign design screenshots and fixture composition evidence are alongside
  those results. Two unavailable-Twilio errors on the Leads page were explicitly
  outside this module; no telephony code was changed.

Earlier campaign runs failed because the wrong fixture flag was used, a native
confirmation dialog was unhandled, and the failure assertion expected a raw
database message instead of the repository-standard retryable response. These
are not counted as passes. All were corrected before the final 18/18 run.
The unpublish UI had a genuine missing-error-handling defect: it now reports
failed requests, prevents overlapping publish/unpublish actions and permits
retry. An isolated failing database trigger verified this behavior.
The first JSON integration also exposed a misplaced handler declaration, which
was corrected. A later fixture authentication request failed with
`ECONNRESET`, not an invalid role or Windows allocation failure. Mock responses
now close connections explicitly to avoid stale keep-alive reuse, and anonymous
visitors use their own browser context. The final browser suites passed after
these corrections.

Classic template previews and copies also scrub hidden master ownership, list,
notification and submission-routing inputs without changing original content.
Public forms inject only their current funnel/step identity and request key.
Explicit next-step redirects are remapped into the subscriber's own funnel;
external destinations cannot redirect an enquiry to the master or another site.
The final 9/9 browser run and both 8/8 API suites passed after this correction.

Windows preflight required at least 8192 MB commit headroom and 4096 MB
available physical memory. The final production rebuild had 14261 MB commit
headroom and 9184 MB available physical memory before launch. Earlier memory
allocation failures are not evidence of a failed
permission check. The editor readiness path no longer waits for optional asset
listing; workspace loading and stale request cancellation are handled.

## Eight-page recovery evidence

The bounded read-only export was fetched at `2026-11-01T04:58:26.793Z`.
It includes full current JSON documents, referenced published-version
documents, serialized-document SHA256 fingerprints, statuses and import-source
provenance:

`artifacts/funnel-recovery/landing-page-inventory-2026-11-01T04-58-26-793Z.json`

Final preservation verification found nine complete entries: eight
non-archived candidates and one archived duplicate, with no missing page IDs.
The export remains read-only, `designationConfirmed` remains false, and its
SHA-256 is
`49c8e16725c576c75fb9597b2ddc08bee466015cc7d4f2b9566abbc6d7634ecd`.

All nine queried records were present and complete, including the archived
duplicate. The eight non-archived candidates are:

| Stored page title | Campaign ID | Page ID | Status | Sections |
| --- | --- | --- | --- | --- |
| Platform prelaunch | `359db625-df54-41ad-91fb-e46a30fd4be5` | `fb1ada85-b9ea-4a43-a163-c34c72115546` | Published | 10 |
| Prelaunch campaign | `e69530c7-da3d-4e8b-aa24-eb4ff4e7c26c` | `06a812a4-1b4a-4751-96c1-b226a106985d` | Published | 7 |
| GR8 Result quality candidate | `f2a028bb-8231-45ce-b89a-411d1a5600c9` | `e0291644-ea05-43b4-b81e-3304a83f0518` | Unpublished; published version retained | 9 |
| Paperbark Creative release check 1792800685300 | `39db9db8-4166-4f25-a479-a563e02519df` | `6c8e4e52-a20b-4ab3-b51b-6729e625bdec` | Draft | 7 |
| Build you Dream home n 2027 | `53052e4d-5b77-40d9-a21d-bc41fd7e27ec` | `76ddafb7-77e4-4624-9396-434ead9929a4` | Draft | 8 |
| Special saving promotion for first home buyers | `f2511df1-b51f-469e-88b8-816a9be78d43` | `2a444d97-551c-4f29-88cf-533dfa1bfee2` | Draft | 8 |
| Create a substantial booking and enquiry landing page for Tide & Timber Coastal Retreat, a boutique wellness retreat in | `a15541d2-0dfa-4eaf-8fdc-cd9c124841fb` | `cc1d671f-01cd-4030-bb74-9d58e6af84a8` | Draft | 8 |
| Coastal Cuts is a family-friendly barbershop and hair salon in Noosa, Queensland | `c2fc559a-03d7-47a9-a314-88e4937ecf56` | `ab8967bb-7282-4e1f-82a8-bf1072316d03` | Draft | 7 |

The archived duplicate remains preserved: campaign
`d84c4bf7-0990-44cb-9194-baab5ed8b8f0`, page
`202093a1-abdd-46fd-82c0-df92ac66a76d`. Its document fingerprint matches the
non-archived Paperbark page.

Recovery attempts were limited to the documented workspace, known page and
campaign identifiers, the documented prior owner, and local
`artifacts/funnel-dashboard-import/` inventory/content. No classic funnel rows
were found in the documented workspace or for that prior owner.

The local import report links only:

- GR8 Result source page `2022a330-1ac0-4bff-a23f-7cdd40f580e0`.
- Paperbark source page `2c765539-2ae6-4d10-aabf-ca4c73f4590d`.

**Still missing:** authoritative designation tying the other six records to
the intended original eight masters; original backup/import provenance for
those six; and approved registration of the intended originals in the catalogue.
The count of eight is not proof of master designation. No replacement pages
were invented and none of the originals was promoted or modified.

## Remaining implementation and verification gaps

1. The approved JSON-native catalogue extension is implemented and passes
   isolated API, RLS and browser acceptance. The real eight candidates remain
   unregistered and unconfirmed. Migration application and real-asset
   registration require separate approval.
2. Classic `/api/forms/submit` now derives routing from the published funnel
   and delivers durable, idempotent CRM enquiries. Its migration and production
   retry schedule still need approval. Invalid existing list configurations
   fail explicitly rather than routing to another builder; no real records
   were changed to repair such configurations.
3. Real OpenAI and paid image-provider tests have not been run. Configured keys
   do not verify credit availability or authorize paid requests. The user
   authorized a budget of USD 0, so no real-provider calls were made.
   Fixture and transport-simulation passes are not real-provider acceptance.
4. Live database RLS/grants and live separate-builder authorization have not
   been verified with approved isolated identities. The isolated migration and
   browser tests establish behavior only in the tested schema/fixtures.
5. Preview expiry is covered by API/token tests, not a browser waiting through
   the real expiry interval. Catalogue registration of the recovered pages is
   still untested against real records because it is not authorized.
6. The separate campaign-quality harness has not been run in this continuation.
   It is not counted as passed, nor is it a substitute for the completed
   deterministic multi-business browser checks.

## Database release and approvals

Read-only target projections confirmed expected base columns on `funnels`,
`funnel_steps`, `workspace_members`, and `lead_notes`. Projecting the master
metadata failed with PostgreSQL `42703`:
`column funnels.is_master_template does not exist`.
The target therefore still needs the master migration; isolated successes do
not mean it is deployed.
Additional zero-row projections confirmed the expected classic
`form_submissions` and CRM `leads` base columns. Column availability is not
complete verification of target constraints, grants or policies.

An anonymous zero-row `lead_notes` probe returned HTTP 200 and no rows. This is
**inconclusive**, not a denied-access test. The prepared restrictive migration
passes isolated populated-table denial tests but has not been applied to
production. The live CRM-note issue remains release-blocking.

Required approvals:

1. Confirm the intended database project and recoverable backup; approve an
   isolated staging environment and two test-builder identities.
2. Review target definitions, existing grants/policies, and migration history;
   approve staging application of the following migrations in timestamp order:
   - `supabase/migrations/20261101000100_funnel_master_templates.sql`
   - `supabase/migrations/20261101000200_crm_lead_notes_access.sql`
   - `supabase/migrations/20261101000300_campaign_master_templates.sql`
   - `supabase/migrations/20261101000400_funnel_form_crm.sql`
   Confirm the existing campaign migration
   `20261014000100_landing_page_campaigns.sql` is present; do not blindly reapply
   it to production.
3. After isolated target-compatible verification, separately approve production
   migration application and verify anonymous CRM-note denial with populated
   controlled data and two-builder isolation.
4. Confirm master designation and approve any registration of the eight real
   assets. Do not alter or unregister their published originals.
5. Authorize a bounded real-provider test budget and confirm provider access.
   Current approval is USD 0; fixture-only acceptance remains explicit.
   Also approve the secured classic funnel retry schedule and its
   `CRON_SECRET` configuration.
6. Approve production deployment only after the remaining implementation gaps
   and critical acceptance tests pass. Migration approval is not deployment
   approval.

Rollback is application-first: disable/revert the catalogue feature in the
application release while retaining master metadata, recovered documents,
published records and restrictive CRM-note policies. Do not drop tables or
columns, delete masters, or restore anonymous/direct-client note access.
Migration defects require reviewed forward fixes. Any policy-weakening rollback
requires explicit security approval and a tested replacement.

## Files changed in this continuation

- `components/landing-pages/editor/LandingPageEditor.jsx`: unpublish failure
  feedback, action-in-flight guards, safe retry and administrator campaign
  snapshot saving.
- `scripts/test-landing-page-browser.mjs`: unpublish, preserved versions,
  simulated failure/retry and native confirmation acceptance.
- `scripts/test-funnel-master-template-browser.mjs`: page-content persistence
  and independent subscriber content assertions; JSON-native template flow;
  anonymous classic enquiry, correct email list and CRM delivery.
- `pages/api/funnels/templates.js` and `pages/modules/funnels/templates.js`:
  unified catalogue, JSON previews and idempotent native campaign clones.
- `lib/funnels/formSubmissions.js`, `pages/api/forms/submit.js`,
  `pages/api/funnels/cron-sync.js` and `pages/p/[slug].js`: server-derived
  classic form routing, per-form keys, durable CRM delivery, secured retry and
  own-funnel continuation redirects.
- `lib/funnels/templateContent.js`: shared removal of private routing inputs
  from classic template previews/copies and public form injection.
- `supabase/migrations/20261101000300_campaign_master_templates.sql` and
  `20261101000400_funnel_form_crm.sql`: catalogue snapshots/atomic cloning and
  durable private classic enquiries.
- `scripts/test-campaign-master-templates.mjs` and
  `scripts/test-funnel-form-crm.mjs`: new isolation/reliability acceptance.
- `scripts/lib/mock-supabase-server.mjs`: fixture-only connection cleanup.
- `scripts/test-landing-page-migration.mjs`: combined campaign/CRM-note
  migration verification.
- `scripts/recover-landing-page-inventory.mjs`: bounded read-only content export.
- `modules/funnels/README.md` and this report: recovery and release status.

Earlier readiness, slug, memory/process ownership, fixture storage, mobile
readability, master API/RLS and editor changes remain preserved. Unrelated
Client Selections, Quotation Builder, AI Takeoff and Product Library work was
not modified. Named test-created build caches were removed only after isolated
listeners stopped; browser evidence and the recovery inventory were retained.
