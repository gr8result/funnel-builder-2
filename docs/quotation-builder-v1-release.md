# Quotation Builder V1 – release, migration and deployment instructions

Status 2026-11-04: **PASS – ready for approved deployment.** Every engineering gate below passed on `release/quotation-v1` against an isolated Supabase stack and a production build on port 3107. Nothing has been deployed; no production database has been read or changed. Section 6 lists the owner approvals needed.

## 1. What the release contains (on top of `05962e5`)

Commits: `7405ae1` (floor-waste guard, takeoff calibration gate), `a3c7c17` (issue gate, concurrent issue, BOQ reconciliation, estimate PDF), and the final V1 commit (this document).

| Area | Files | Change |
|---|---|---|
| Issue workflow (builder-facing) | `components/estimate-builder/EstimateBuilderWorkbook.js`, `lib/builders/syncCommercialSnapshot.js` | Visible **Issue Quotation to Project Commercials** button for every builder (was a hidden developer control). Local price check first; unpriced or duplicate rows are listed and nothing is sent. Confirmation dialog shows the final total and GST. "Issuing…" disables the button and an in-flight guard ignores double clicks. Success message shows snapshot number and total. |
| Issue security and size | `pages/api/builders/sync-commercial-snapshot.js`, `lib/commercialAccess.js` (identical to the Client Selections release), `lib/builders/commercialSnapshotWorkbook.js` | Only internal builder roles may issue (client-role members get 403). The snapshot leaves out Project Estimate page artwork and AI takeoff drawings (real job: request 123 MB → 14.3 MB, under the 25 MB limit) and records which sections were left out. |
| Pricing safeguards | `lib/construction-estimation/quotationIssueGate.js` | Blocks charged rows that are quote-required, rate missing, price pending, $0 for a charged quantity (unless explicitly included/no charge), or an exact duplicate charge. A builder-typed manual rate or supplier quote clears a row only when it actually prices it. The gate never changes a row or sets a price. |
| Door Takeoff rows | `lib/construction-estimation/estimateBuilderWorkbookCalculations.js`, `hooks/estimate-builder/useEstimateBuilderWorkbook.js` | A typed price on a generated Door Takeoff row (e.g. internal door jambs) was discarded on every recalculation; it is now kept, like window-schedule rows. A regex typo (`jambd+` for `jamb\d+`) charged the same 19 internal door jambs in two sections; fixed. |
| BOQ | `lib/construction-estimation/finalQuotationBoq.js` (a3c7c17) | Engine rows named "TOTAL …"/"OVERHEAD …" stay in the BOQ. |
| Inclusions | `EstimateBuilderWorkbook.js` (card text) | Premier is the only and default package. The Standard Inclusions card now says "Classic and Premium are not available yet". |
| Floor-waste repair tool | `scripts/repair-isolated-floor-waste-duplicates.mjs` | Now corrects every quotation copy in a job package, including the priced `workbook.quotation` copy it previously missed, and reports the reduction per copy. Never writes the input. |
| Migration package | `supabase/release/quotation-v1/` | Exact copies of the four production candidates, read-only pre/post checks, rollback SQL. |
| Backup tools | `scripts/quotation-v1-backup.sh`, `scripts/quotation-v1-restore-verify.sh` | Guarded backup (refuses unless the typed project ref equals the linked project) and isolated restore verification. |
| Tests | `scripts/test-quotation-issue-gate.mjs`, `test-quotation-pricing-reconciliation.mjs`, `test-quotation-inclusion-packages.mjs`, `test-door-takeoff-builder-price.mjs`, `test-quotation-two-user-acceptance.mjs`, `test-quotation-builder-acceptance-browser.mjs`, `test-commercial-internal-member-rls.mjs` | See section 2. |

## 2. Evidence (isolated; port 3000 never used)

Stack `gr8-quotation-acceptance` (127.0.0.1:55521/55522); app = production build of this branch, `next start -p 3107`, env pointing only at that stack. Reports: `artifacts/test-artifacts/quotation-acceptance/` in `E:\dev\qv1-run`.

| Gate | Result | Evidence |
|---|---|---|
| Production build | PASS | 243/243 pages (local `experimental.cpus: 2` needed on this PC; not committed) |
| Signed-in browser acceptance | PASS 10/10, 0 page errors | 3 users sign in at once; create job; Quote Sheet with GST; save + reload/reopen; visible Issue button refuses an empty quotation; other builder sees nothing; Project Estimate PDF (6 pages); **real job copy**: Issue lists 24 unpriced rows, no dialog, nothing stored; **fully priced real job copy**: dialog total $723,645.81, double click → exactly one snapshot ($723,645.81, GST $63,154.54), button showed "Issuing…" disabled, 251 BOQ lines = all charged rows, 5 floor-waste lines, no duplicates |
| Two users / isolation / concurrency | PASS 9/9 | Real Supabase sign-in; unpriced refused; 401 without/invalid token; other builder 403; **client-role member 403**; other builder can't touch A's project; RLS (other builder and client see nothing, estimator sees own); 3 simultaneous issues → unique numbers, one current |
| Pricing / GST / BOQ (real job copies) | PASS 8/8 | Every section's BOQ = quote subtotal (slab, cabinetry, tiling…); GST 10% of pre-GST subtotal; totals add up |
| Issue gate | PASS 13/13 | incl. duplicates, $0 rows, typed rates that don't price, never mutates |
| Door Takeoff typed price | PASS 5/5 | Jambs charged once; supplier quote survives recalculation; old engine fails (jambs twice) |
| Inclusion packages | PASS 5/5 | Premier only + default; no Classic/Premium package; other builders get none invented; seeds UNMAPPED |
| Internal pricing RLS (PGlite) | PASS 14/14 | With the release-candidate migrations |
| Existing suites | PASS 25 suites | safeguards, BOQ filter, row cost, order persistence, subgroups, selection quote engine, client-selection pricing, door/window quotation, tenant foundation, inclusions assignment, Job Setup / takeoff import (8), live cabinetry |
| Migration rehearsal | PASS | Pre-check and post-check run; rollback of 20261021 restores the old model (client can read again, 8/9) and re-apply restores 9/9 |
| Backup / restore rehearsal | PASS | Backup script against the isolated stack; restore into a fresh Supabase stack: 201 tables, 0 row mismatches, 350/350 policies; app 9/9 against the restored copy |

Known pre-existing test failures not caused by this release (identical with the changes reverted): save/reopen source-text checks for later persistence work, Bosch catalogue count, cabinetry catalogue/taxonomy, entry-door price, inclusions schedule order, wall-linings fixture missing.

## 3. Floor-waste discrepancy (verified, real job untouched)

Original: `recovery/quotation-changes-2026-10-03/current-job-verified-1790977156917.gr8job` (SHA-256 `e233d67b8c31…`, unchanged after all runs).

- The Client Selections tiling editor had appended identical floor-waste entries. Five are duplicates of the Forme Square floor waste at $30.00 ex GST each: Laundry 1, Main Bathroom 2, 2nd Bedroom Ensuite 1, Ensuite 1.
- Cost effect: **$150.00 ex GST**. Through the job's markups (overheads 5 %, margin 10 %, profit 15 %, GST 10 %, sales commission 4 %) the client price falls by **$227.30 incl. GST** (GST part $19.84): $721,167.75 → $720,940.45.
- The 29 Oct "corrected" copy did not change the quote: the repair tool fixed an export copy and stopped before the priced `workbook.quotation`; its "$300" report counted the same $150 twice. Fixed tool output: `test-artifacts/isolated-jobs/floor-waste-corrected-v2/new-job-0309-floor-waste-corrected.gr8job` + `repair-report.json` (priced copy reduction $150.00).
- The duplicate-charge rule in the issue gate now refuses the original until it is corrected.

## 4. Production migrations

Package `supabase/release/quotation-v1/` (apply in this order only; never the whole migrations folder):

| File | Source | SHA-256 (LF, first 16) |
|---|---|---|
| `01_20261010000100_builder_requirement_quote_mappings.sql` | byte-identical to `release/client-selections-20261021` | `6170f6453f0922e0` |
| `02_20261011000100_requirement_mapping_product_identity.sql` | byte-identical to the Client Selections release | `fb8d732e4475e203` |
| `03_20261021000100_builder_commercial_internal_member_rls.sql` | byte-identical to the Client Selections release | `5b43d2626bd0d092` |
| `04_20261028000100_workspace_members_rls_recursion_fix.sql` | byte-identical to the shared tree (Product Library) | `8936c24e4abe248d` |

The shared working tree has *different* versions of 01–03; do not apply those. Dependencies (checked by `00_precheck_readonly.sql`): `workspaces`, `workspace_members`, `workspace_entitlements`, `communities`, `builder_selection_is_config_admin`, `builder_selection_immutable_workspace`, `builder_commercial_set_updated_at` (from `20261003000100`). No V1 code depends on 01/02; 03 removes direct access to internal pricing tables for client-role members (verified: today they can read `builder_commercial_projects`); 04 fixes the live 42P17 recursion on `workspace_members`.

Low-severity note: the helper functions in 03/04 remain executable by `anon` through Supabase default grants; they return false without a signed-in user, so nothing is exposed. Optional follow-up for the owning sessions: `revoke execute on function public.is_workspace_member(uuid), public.builder_commercial_is_internal_member(uuid) from anon;`.

From an empty database (fresh environments only): 4 repo migrations fail only on ordering and apply on a second pass; 12 need legacy tables no migration creates (`accounts`, `profiles`, `leads`, `vendors`, `sms_queue`, `gantt_*`). Production is unaffected; a baseline migration is needed before any new environment.

## 5. Deployment steps (each needs written approval)

1. **Confirm the project.** Linked project: `funnel-builder-db`, ref `bvtxfphktypdqmlnveqf` (`supabase/.temp/project-ref`). Confirm this is production.
2. **Backup:** `scripts/quotation-v1-backup.sh --linked --confirm-project-ref bvtxfphktypdqmlnveqf <new-dir>` (read-only). Keep `SHA256SUMS` and `manifest.txt`.
3. **Verify the backup in isolation:** start an empty local stack, `scripts/quotation-v1-restore-verify.sh <dir>` → must print `RESTORE VERIFIED`.
4. **Pre-check (read-only):** run `00_precheck_readonly.sql` in the SQL editor; save the output (rollback source for 04).
5. **Apply** 01 → 04 in order, each in its own run, checking SHA-256 first; record each in migration history.
6. **Post-check:** `99_postcheck_readonly.sql` (0 missing policies; 4 membership policies use `is_workspace_member`).
7. **Deploy the release commit.** Smoke test as a real builder: open a quotation, save/reopen, press **Issue Quotation to Project Commercials** on a job with unpriced rows (rows listed, nothing issued), then on a priced job (confirm → issued), download the Project Estimate PDF, and confirm a client-role account sees no `builder_*` rows.

## 6. Owner approvals needed

1. Approve reading production for the backup (step 2) – read-only, no changes.
2. Approve applying the four migrations (steps 4–6).
3. Approve deploying the release commit (step 7).
4. Real job New Job 03/09: approve correcting the five duplicate floor wastes (−$150.00 ex GST / −$227.30 incl. GST) in the live job, and enter prices for its 24 unpriced charged rows (mostly tiling labour, two fixed-glass window sizes, door-jamb materials) before it can be issued. Nothing in the live job has been changed.

## 7. Rollback

- Code: redeploy the previous production commit (`origin/main` 95ee547 at the time of writing).
- 03: `supabase/release/quotation-v1/rollback_20261021000100.sql` (rehearsed).
- 04: forward-only (rolling back reintroduces 42P17); if required, recreate the four policies from the step-4 pre-check output.
- 01/02: additive and unused by V1; no rollback needed.
- Data: restore the step-2 backup only if data was damaged.

## 8. Integration with other release branches

`release/client-selections-20261021` also changes `pages/api/builders/sync-commercial-snapshot.js` and `EstimateBuilderWorkbook.js`. `lib/commercialAccess.js` and the four migrations are byte-identical between the branches. The integration owner must merge the API by hand (both sides add checks before the snapshot is written; keep both). See the trial-merge result in the final report.
