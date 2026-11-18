# Quotation Builder — release plan (16 Nov 2026)

Status: **prepared, not committed, not deployed.** Nothing here has touched the live database.

## 1. In plain English: the recommended way to release

**What is live today.** Customers use the "V1" version (Git `origin/main`, commit `93f3d5f`, 6 Nov).

**What we finished.** All Quotation Builder work since then lives in a newer copy of the whole platform
(branch `recovery/live-snapshot-20261031` plus uncommitted work). The two copies split on 10 Oct and now
differ in 1,036 files across every module, not just quotations.

**Recommendation: release the newer platform as a whole, in one coordinated release, instead of copying
only the quotation changes into the old live version.** The quotation now depends on newer Client
Selections, AI Takeoff and job-storage code. Copying only quotation files into V1 would create a
combination nobody has tested. The things V1 has that the newer copy lacked were checked:

| V1-only change | In the newer copy? |
|---|---|
| Issue gate, BOQ fee fix, snapshot ordering, jamb pricing, door takeoff price, inclusion wording | Yes — ported 12 Nov (`c21178c`) |
| Save "read-back" check (`93f3d5f`) | Yes — stronger version (checks inside the same database transaction and rolls back) |
| Template rate schedule (`7d510db` hotfix) | Not needed — replaced by the owner's own prices; that hotfix was rejected by the owner |
| Client Selections release candidate (Oct 21–27) | Superseded by the newer Client Selections module (owner of that module to confirm) |

**What this means for you:** the release happens once all three modules (Quotation, Client Selections,
AI Takeoff) say they are ready. Until then V1 stays live and nothing changes for builders.

## 2. Release steps (technical)

1. **Commit** (owner approval): Quotation commit per section 5; Client Selections and AI Takeoff commit their own files; one joint commit for the shared contract-lock files (section 5b).
2. **Release branch** from the committed branch; `git merge origin/main` into it (records V1 history; resolve conflicts in favour of the newer code except where section 1 says a V1 change must be kept). Never force-push `main`.
3. **Build** `npm run build` on the release branch (must be exit 0, 246 pages).
4. **Preview deployment** (Vercel preview of the release branch) pointed at production read-only data, smoke test: open a real job, Quotation Builder, all categories, save/reopen.
5. **Backup** (mandatory, owner approval): `scripts/quotation-v1-backup.sh --linked --confirm-project-ref <ref> <dir>`; prove it restores with `scripts/quotation-v1-restore-verify.sh <dir>` into an empty local stack.
6. **Read-only precheck**: run `supabase/release/quotation-v1/00_precheck_readonly.sql`, save output (it lists which migrations production already has and the current policies = rollback source).
7. **Migrations** (owner approval), only those missing, in order, each SHA-256 checked against `supabase/release/quotation-v1/SHA256SUMS.txt`:
   `01` 20261010000100 · `02` 20261011000100 · `03` 20261021000100 · `04` 20261028000100 · `05` 20261113000100 · `06` 20261116000100 (new forward fix, safe on either file version).
   Other modules' migrations in the tree (landing pages, trade payments, funnels, CRM) are released by their owners. The Freedom tables in production are left alone (never dropped).
8. **Postcheck**: `99_postcheck_readonly.sql`; sign in as a client-role and an estimator test account.
9. **Promote** the preview deployment to production.
10. **Verify** (section 4).

## 3. Rollback

- **Application:** redeploy the previous Vercel production deployment (instant; no data change).
- **Database:** every migration above is additive or a permission tightening. Rollback scripts: `rollback_20261021000100.sql`, `rollback_20261113000100.sql` (removes the promotion function, keeps all quotation data), `rollback_20261116000100.sql` (intentionally does not re-create the faulty constraint). `20261028000100` is reversed from the policy definitions saved by step 6.
- **Data restore** from the step-5 backup only if data were damaged (not expected: no migration rewrites rows).

## 4. Deployment verification checklist

- [ ] Open three existing jobs (incl. New Job 03/09); all saved categories visible (03/09: 176), totals unchanged from before release.
- [ ] Edit a quantity and a rate; totals recalculate; save, reload, values persist.
- [ ] Issue on a job with unpriced selected products is refused with the full list; on a fully priced job the confirmation shows the total incl. GST.
- [ ] Issue one real quotation the owner chooses; Project Commercials shows one current snapshot; BOQ total = quotation base.
- [ ] Project Estimate PDF downloads; Pricing page shows the quotation total.
- [ ] A client-role account sees no internal pricing; a second builder sees none of the first builder's quotations.
- [ ] Client Selections and AI Takeoff owners run their own post-release checks.

## 5. Commit preparation (not committed)

### 5a. Quotation Builder commit
```
git add \
  lib/construction-estimation/quotationIssueGate.js lib/builders/quotationRateReview.js \
  lib/builders/allocatedSelectionQuotation.js lib/builders/quotationFinancialImpact.js \
  lib/construction-estimation/windowsPriceListSync.js \
  pages/api/builders/sync-commercial-snapshot.js components/estimate-builder/EstimateBuilderWorkbook.js \
  components/construction-estimation/ai-plan-takeoff/planBlobStorage.js \
  supabase/migrations/20261010000100_builder_requirement_quote_mappings.sql \
  supabase/migrations/20261021000100_builder_commercial_internal_member_rls.sql \
  supabase/migrations/20261113000100_quotation_snapshot_promotion.sql \
  supabase/migrations/20261116000100_quotation_v1_forward_fixes.sql \
  supabase/release/quotation-v1/ \
  scripts/lib/quotation-acceptance-environment.mjs scripts/quotation-v1-backup.sh scripts/quotation-v1-restore-verify.sh \
  scripts/make-quotation-pdf-test-fixture.mjs scripts/test-windows-price-list-sync-action.mjs \
  scripts/test-quotation-*.mjs scripts/test-quotation-*.py scripts/test-commercial-internal-member-rls.mjs \
  scripts/test-plan-asset-storage.mjs \
  docs/quotation-builder-release-20261116.md QUOTATION_GROK_REPORT.md
```
`planBlobStorage.js` is an AI Takeoff file; its one hunk (missing-artwork fallback) was reviewed and accepted by the AI Takeoff session. All hunks in `EstimateBuilderWorkbook.js` are quotation sheet / quotation export code.

Message: `fix(quotation): pricing protection, compact layout, reopen and post-contract fixes, release package`

### 5b. Joint commit with Client Selections (contract lock / variations)
`lib/builders/contractLock.js`, `lib/builders/selectionReconciliation.js`, `hooks/estimate-builder/useEstimateBuilderWorkbook.js`, Client Selections' contract-lock tests (`scripts/test-quotation-post-contract-procurement.mjs` is already in 5a and needs these files, so commit 5a and 5b together). These files interleave both modules' changes (the post-contract procurement fix sits inside the contract-lock branch), so they go in together, with Client Selections' agreement.

### 5c. Not Quotation-owned (left for their owners)
Everything else in `git status` (Client Selections components and tests, AI Takeoff geometry, other modules' migrations, `scripts/inspect-client-selections-v1-pdf.mjs`, `scripts/test-client-selections-placeholder-quote-credit.mjs`).
