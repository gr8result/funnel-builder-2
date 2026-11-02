# Funnels catalogue

The module owns reusable funnel sections, service templates, image selection,
and page assembly. Next.js routes remain under `pages/` and consume `index.js`;
the image API and shared media consumers import the dedicated image service.

- `data/themes/`: one complete theme per existing service slug; `index.js`
  preserves the catalogue's original order.
- `data/serviceImages.js`: image pools, search terms, and service group mappings.
- `sections/`: generic and service section HTML.
- `templates/serviceVariants.js`: long/short template structure and descriptions.
- `services/images.js`: template image URLs, fallback selection, and asset listing.
- `catalogue.js`: ordered section and funnel registrations.
- `assemblePage.js`: section lookup and existing typography normalization.

The decomposition preserves the original templates and rendering behavior.
There is no compatibility file at the previous shared-library location.

## Master templates

The shared GR8 Result master catalogue is served by
`pages/api/funnels/templates.js`. Workspace owners and admins can save an
existing funnel from its editor; subscribers can preview and create their own
draft copies from `/modules/funnels/templates`. Copies use the active
authenticated user and workspace, and do not inherit master CRM list or
notification settings. The originals remain flagged as master templates and
are excluded from the subscriber funnel manager.
Classic previews and copies remove hidden master routing and ownership inputs
from application-managed enquiry forms without modifying the originals.

The campaign editor also supports Save as Master Template. It creates an
immutable JSON snapshot in the same catalogue, without changing the original
campaign, page documents, or published versions. Campaign templates retain the
native JSON renderer/editor. Cloning creates a new draft campaign and every
page/version atomically, remaps links between copied pages, and replaces the
master notification email with the authenticated subscriber's email.
Clone request IDs make retries idempotent. Private signed asset references
cannot be registered as shared template assets.

Apply `supabase/migrations/20261101000100_funnel_master_templates.sql` before
enabling this catalogue and
`supabase/migrations/20261101000200_crm_lead_notes_access.sql` before using CRM
lead notes with the builder. Campaign templates additionally require
`supabase/migrations/20261101000300_campaign_master_templates.sql`; classic
funnel CRM capture requires
`supabase/migrations/20261101000400_funnel_form_crm.sql`.
Apply them in timestamp order through the
organisation's approved migration workflow. The first migration adds catalogue
metadata to `funnels` and enforces owner/workspace access on `funnels` and
`funnel_steps`; the second removes anonymous and direct client write access to
`lead_notes`, while retaining service-role writes and authenticated reads of a
user's own notes.

Before any shared or production application, verify the existing table
definitions, grants, policies, and migration history against the target
database, then run all four migrations in an isolated staging database with
separate builder identities. The repository tests exercise an isolated PGlite
schema and do not establish that the live database has the expected schema or
that these migrations have been applied:

```powershell
node scripts/test-funnel-master-template-migration.mjs
node scripts/test-crm-lead-notes-access.mjs
node --import ./scripts/register-extensionless-loader.mjs scripts/test-funnel-manage-api.mjs
node --import ./scripts/register-extensionless-loader.mjs scripts/test-funnel-master-templates.mjs
node --import ./scripts/register-extensionless-loader.mjs scripts/test-campaign-master-templates.mjs
node --import ./scripts/register-extensionless-loader.mjs scripts/test-funnel-form-crm.mjs
```

Classic public forms now receive a stable request key per rendered form and
derive ownership, workspace, list and notification routing from the published
funnel. They record the enquiry before attempting atomic CRM delivery, even
when no email list is configured. Failed CRM writes remain retryable. Approve
and configure an authenticated scheduler for `/api/funnels/cron-sync`, using
the existing `CRON_SECRET` contract, before release. Anonymous archive reads,
direct client writes, and direct client CRM sync calls are denied. Non-funnel
email signup forms retain their existing API behavior.
Explicit next-step enquiry redirects are remapped to the current subscriber's
funnel, never the master or an external destination.

Do not roll back by dropping the catalogue columns, deleting master rows, or
restoring anonymous/direct-client CRM-note access. If an application release
must be rolled back, disable the catalogue/editor feature in the application
release while retaining the schema, master metadata, and restrictive CRM
policies. Resolve any migration defect with a reviewed forward migration; a
database rollback that weakens access controls requires explicit security
approval and a tested replacement policy. Production migration and application
release require separate approval.

Read-only recovery identified eight non-archived JSON campaign pages and one
archived duplicate in the documented recovery workspace. Their complete
documents, referenced published versions, content hashes, and two import-source
links are preserved in
`artifacts/funnel-recovery/landing-page-inventory-2026-11-01T04-58-26-793Z.json`.
Re-run the bounded, read-only export with
`node scripts/recover-landing-page-inventory.mjs`; it never registers templates
or changes database records.

These are campaign-page candidates, not confirmed original master funnels.
Only two have direct local import provenance. The catalogue now supports
immutable JSON campaign snapshots as well as classic HTML funnels, but none
of these eight has been registered through it. Their original-master
designation remains unconfirmed. Do not flatten the documents into HTML or
alter their published originals.
See [release verification](RELEASE-READINESS.md) for the inventory, actual test
results, remaining implementation gaps, and required approvals.

## Reconciliation

Run `node --test modules/funnels/tests/catalogue-reconciliation.test.mjs`.

The baseline was captured from the original 4,885-line source before migration
(SHA-256 `7c83d7fbf3c93237e5d39cd2f6c203634b124dda8848551b6d7b8fe7d56a9c51`).
It records 38 complete themes, 291 ordered blocks, 90 funnel definitions,
178 rendered funnel pages, 76 image assets, public section outputs, and 1,280
image fallback cases. Hashes cover all object fields and exact generated HTML.
The test also rejects duplicate theme, block, and funnel IDs.
