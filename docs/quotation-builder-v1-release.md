# Quotation Builder V1 – release, migration and deployment instructions

Status 2026-10-29: **BLOCKED** until the isolated signed-in browser acceptance (including two-user editing) and the production build have run. Nothing below has been applied to production.

## 1. Commit (only these files)

Each listed file contains only Quotation Builder V1 changes (checked with `git diff --stat`). Do not use `git add -A`; five sessions share this working tree.

```
lib/builders/tilingFloorWasteDuplicates.js            # floor-waste clone detection/collapse
lib/construction-estimation/takeoffCalibrationGate.js # blocks mis-calibrated takeoff imports
components/client-selections/TilingRoomsWorkflow.jsx  # stops a second identical floor-waste line
components/estimate-builder/JobSetupTakeoffImport.jsx # applies the calibration gate
scripts/test-quotation-v1-safeguards.mjs
scripts/repair-isolated-floor-waste-duplicates.mjs
scripts/test-commercial-internal-member-rls.mjs
scripts/test-quotation-builder-acceptance-browser.mjs
scripts/test-auth-session-browser.mjs                 # now refuses port 3000
docs/quotation-builder-v1-release.md
```

Suggested message: `fix(quotation): V1 safeguards for duplicate floor-waste charges and uncalibrated takeoff imports`

## 2. Pre-deployment gates (isolated, port 3107, never 3000)

1. Free memory (needs roughly 6 GB of commit headroom), then start a separate Supabase stack (`project_id = "gr8-quotation-acceptance"`, ports 55520-55529). Do not reuse `gr8-product-library-synthetic-acceptance` or `builder-db-1`.
2. Apply `supabase/migrations` in filename order to that stack and record any file that fails on an empty database.
3. Create two disposable builders plus one disposable job with an unpriced row. Start `next dev -p 3107` with `NEXT_DIST_DIR=.next-quotation-acceptance` pointed at the local stack.
4. Run `node scripts/test-quotation-builder-acceptance-browser.mjs` (env vars are listed in the file header), then the two-user editing check.
5. Run `next build` with `NEXT_DIST_DIR=.next-quotation-build` (the build has known errors in other modules; record whether any Quotation file is involved).

## 3. Production migrations (only after written approval)

0. Backup first (mandatory): confirm the target project ref is the approved production project, then take a fresh backup (Supabase dashboard > Database > Backups, or `supabase db dump --linked -f prod-pre-quotation-v1.sql` plus `--data-only`), record its timestamp, and prove it is restorable by restoring it into the isolated stack. No migration runs without a verified backup.
1. Read-only first: `supabase migration list --linked` to see which of these are already applied.
2. Apply only the missing ones, in this order. Only `20261003000100` is on `release/quotation-v1`; the other four are uncommitted in the shared working tree (`20261021000100` is also on commit `70bbac6`, `20261028000100` is owned by the Product Library session). No released code depends on them. Check each file's SHA-256 against the copy tested in the isolated stack before applying:
   - `20261003000100_builder_selection_tenant_foundation.sql`
   - `20261010000100_builder_requirement_quote_mappings.sql`
   - `20261011000100_requirement_mapping_product_identity.sql`
   - `20261021000100_builder_commercial_internal_member_rls.sql` (client-role members lose direct access to internal pricing tables; Client Portal APIs are unaffected)
   - `20261028000100_workspace_members_rls_recursion_fix.sql`
3. After applying, check with a client-role and an estimator test account that the client sees no `builder_*` rows and the estimator's access is unchanged.

## 4. Deploy and accept

Deploy the commit. Then, signed in as a real builder: open a quotation, save and reopen, confirm QUOTE REQUIRED rows block issue/send, and confirm a takeoff import with mismatched sheet calibration is refused.

## 5. Rollback

Revert the commit. `20261021000100` can be reversed by dropping the `internal_workspace_members_only` policy from each listed table; the other migrations are additive.
