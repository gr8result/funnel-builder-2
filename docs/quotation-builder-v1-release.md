# Quotation Builder V1 – release, migration and deployment instructions

Status 2026-11-04: **READY FOR CONTROLLED RELEASE once the owner actions in section 6 are done.** All engineering gates below passed on branch `release/quotation-v1` in an isolated stack. Nothing has been deployed and no production migration has been applied.

## 1. What this branch changes (on top of `05962e5`)

Commit `7405ae1` (29 Oct): floor-waste duplicate guard, takeoff calibration gate, tests.

This release commit (4 Nov):

| File | Change |
|---|---|
| `lib/construction-estimation/quotationIssueGate.js` (new) | A charged quotation row with no confirmed price (quote required, rate missing, price pending) blocks issue. Catalogue rows with no quantity, excluded and hidden rows never block. A price the builder types in (manual rate / supplier quote) clears it. |
| `pages/api/builders/sync-commercial-snapshot.js` | Runs the gate before anything is written (409 `QUOTATION_MISSING_PRICES` with the row list). Two people issuing the same job at once no longer fail with a duplicate snapshot number (retry), and the newest snapshot is always the only current one. |
| `lib/construction-estimation/finalQuotationBoq.js` | Engine rate rows whose names contain words like "total" or "overhead" (e.g. `TOTAL GROUND FLOOR AREA` slab line, `OVERHEAD CUPBOARDS`) are no longer dropped from the BOQ. On the real job the BOQ was $28,195.00 short of the quote; it now reconciles exactly. |
| `components/estimate-builder/project-estimate/pages/AboutBuilderPage.tsx` | The default About Us page overflowed A4 by 31 px, which made the Project Estimate PDF export refuse to run. Hero area 292→256 px; text sizes unchanged. |
| `scripts/test-quotation-issue-gate.mjs`, `test-quotation-pricing-reconciliation.mjs`, `test-quotation-two-user-acceptance.mjs` (new) | Logic, real-job pricing/GST, and authenticated two-user/isolation/concurrency tests. |
| `scripts/test-quotation-builder-acceptance-browser.mjs` | Rewritten for the real V1 screens (the earlier prepared version assumed a QUOTE REQUIRED label and issue button that do not exist). |
| `scripts/test-commercial-internal-member-rls.mjs` | `QB_MIGRATIONS_DIR` override; accepts the intended read grant on requirement mappings in the release-candidate migration. |

## 2. Gate evidence (isolated, never port 3000)

Stack: Docker Supabase `gr8-quotation-acceptance` (API 127.0.0.1:55521, DB 55522; Studio/Realtime/etc. off). App: production build of this branch, `next start -p 3107`, `NEXT_DIST_DIR=.next-quotation-build`, env pointing only at the local stack. Reports: `artifacts/test-artifacts/quotation-acceptance/`.

- Two-user / isolation / concurrency (`test-quotation-two-user-acceptance.mjs`, real Supabase sign-in): 8/8, repeated 4 times. Against the original API code the same test fails 2/8 (unpriced quotation accepted; simultaneous issue returns 500 duplicate key).
- Signed-in browser (`test-quotation-builder-acceptance-browser.mjs`): three users sign in at once, create job, Quote Sheet with GST, save + reload/reopen, issue refused for an incomplete quotation with nothing stored, other builder cannot see the job or project, Project Estimate PDF downloads as a valid PDF.
- Pricing (`test-quotation-pricing-reconciliation.mjs`, isolated copy of the real job): BOQ = quote base $475,903.79; GST 10% of $629,382.76 = $62,938.28; final $721,167.75 adds up; 25 charged rows have no price and block issue.
- Internal pricing RLS (PGlite, release-candidate migrations): 14/14; proves that before `20261021000100` a client-role member can read `builder_commercial_projects`.
- Logic suites: safeguards 7/7, issue gate 8/8, BOQ filter, row cost, order persistence, subgroups, selection quote engine, client-selection pricing, door/window quotation, tenant foundation, inclusions assignment, Job Setup takeoff import (8 suites). Pre-existing failures unrelated to this change (identical with the change reverted): save/reopen source-text checks for later persistence work, Bosch catalogue count, cabinetry catalogue/taxonomy, entry-door price, inclusions schedule order, wall-linings fixture missing.
- Production build: passes (243 pages). This machine needs `experimental.cpus: 2` set locally (not committed) or static generation runs out of Windows commit memory.
- Tiers: Premier is the only and default inclusion package (`is_default`). Classic and Premium exist only as product-library tier labels and `UNMAPPED` schedule seeds; they do not change pricing. Three-tier mapping is Standard Inclusions work and is not in V1.

## 3. Migrations

Tested from an empty database (repo order):
- All 20 quotation-relevant migrations apply cleanly.
- 4 fail only because of ordering (e.g. `20260812000000_standard_inclusions_pdf_library` runs before `workspaces` exists); they apply on a second pass. Production is unaffected (applied historically), but a fresh environment needs a second pass.
- 12 need legacy tables no migration creates (`accounts`, `profiles`, `leads`, `vendors`, `sms_queue`, `gantt_*`), including `20260901000100_client_portal_operational_layer`. A baseline schema migration is needed before any fresh environment (and before Client Portal work).

Production candidates (none used by V1 code; apply for security):

| Migration | Source | SHA-256 (LF-normalised, first 16) |
|---|---|---|
| `20261010000100_builder_requirement_quote_mappings.sql` | `release/client-selections-20261021` | `6170f6453f0922e0` |
| `20261011000100_requirement_mapping_product_identity.sql` | `release/client-selections-20261021` | `fb8d732e4475e203` |
| `20261021000100_builder_commercial_internal_member_rls.sql` | `release/client-selections-20261021` | `5b43d2626bd0d092` |
| `20261028000100_workspace_members_rls_recursion_fix.sql` | shared tree (Product Library) | `8936c24e4abe248d` |

The shared working tree holds different versions of the first three. Use the Client Selections release copies (tested here); do not apply the shared-tree copies.

## 4. Production steps (only after written approval)

0. Backup (mandatory): confirm the project ref, then `supabase db dump --linked -f prod-schema.sql`, `--role-only -f prod-roles.sql`, `--data-only -f prod-data.sql`; record timestamps and SHA-256; restore the schema and data into an isolated stack and compare row counts and `pg_policies`. Rehearsed here on the isolated stack: identical rows and all 341 policies; only Supabase-managed objects (default privileges, vault, extensions) cannot be recreated by `postgres`, as expected.
1. `supabase migration list --linked` (read-only).
2. Apply only the missing candidates above, in order, after checking each SHA-256.
3. Check with a client-role and an estimator account: client sees no `builder_*` rows, estimator unchanged.
4. Deploy the commit. Signed in as a real builder: open a quotation, save/reopen, confirm Sync to Project Commercials refuses unpriced rows and lists them, download the Project Estimate PDF.

## 5. Rollback

Revert the release commits and redeploy. `20261021000100`: drop policy `internal_workspace_members_only` on each listed table and `tenant_read` on `builder_requirement_quote_mappings`; the other migrations are additive. Restore from the step-0 backup only if data was damaged.

## 6. Owner actions before release

- Approve production backup, migrations and deployment.
- Real job New Job 03/09: 25 charged rows have no price (mostly tiling labour, two fixed-glass windows, door jambs). It cannot be issued until priced or excluded.
- Floor-waste corrected copy (-$150 ex GST) still awaits approval.
- Issuing to Project Commercials is only reachable through developer controls or "Attach to Platform Project". Decide whether V1 needs a visible builder button.
