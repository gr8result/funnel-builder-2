# Client Selections — Completion Report (Claude, 15 Nov 2026)

Branch `recovery/live-snapshot-20261031`. Uncommitted, with no commit, reset or push. Port 3000 was never touched.

Real job: a read-only copy of `E:\dev\quotation-recovery-20261108\restored\New Job 03 09 LATEST VERSION 11-11.gr8job`.

Browser runs used the shared production build `.next-build` (BUILD_ID `5VB1H5ZVrlO55Wym_XHNK`), served read-only on 127.0.0.1:3101. Every Supabase and `/api` call was answered locally, no production request was made and no real account signed in.

## Release gates

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | Real-browser walkthrough of every category | **PASS** | `scripts/accept-client-selections-isolated-browser.mjs` phase `walkthrough`. Every Interior and Exterior category opened with no crash, raw value, phantom room or page error. 0 production requests. |
| 2 | Real-job room schedule | **PASS** | 25 project rooms, identical by name to the confirmed reference `live-rev14-reconciled.gr8job`. One Butler's Pantry, no Upstairs/Downstairs rooms, Staircase is not a project room. The earlier "24 rooms" note was wrong: the 2026-11-01 recovery doc records 25. |
| 3 | Product quantities | **PASS** | ICON toilet ×4 and Riviere 1700 bath ×1 on the real job. |
| 4 | Air conditioning: unit, save, progress | **PASS (repaired)** | Defect: the AC, ceiling-fan and lighting screens had only "Back", so the client could not move on. Added **Save and Continue**, which leaves the screen only after a successful save. Browser phase `hvac`: split system for a room, then Save and Continue, then reload; still saved. Zones: a ducted system shows the builder's zoning, and the client has no zone input by design. |
| 5 | Door hardware confirmation | **PASS** | Browser phase `doorHardware`: picking different internal door furniture, then Confirm Selection, then reload keeps it saved and shown. |
| 6 | Driveway / clothesline / letterbox | **Driveway PASS; clothesline, letterbox and house numbers FAIL (data)** | The requirements and UI exist, but the client-selectable catalogue has **0 products** for them, so customers cannot select one. This is a Product Library data gap; no price was invented. |
| 7 | Cabinetry, benchtops, flooring, painting, plumbing | **PASS** | Covered by the browser walkthrough, plus node suites re-run today: cabinetry selection-quote sync, invariants, handles, bulkhead finish, variant persistence, requirements import, benchtop selection, variation pricing, review readiness, selection-book reconciliation and save coalescing. |
| 8 | Save / reload / reopen persistence | **PASS** | Browser phases `hvac` and `doorHardware` read the saved job from IndexedDB after a reload. Phase `navigation` covers Back, Forward and reload. Phase `inAppBack` was **repaired**: the in-app Back to home left `?selectionArea=interior` in the URL, so a reload reopened Interior. |
| 9 | Pre-contract quotation update; post-contract variation protection | **PASS (P0 repaired)** | Defect proved on the real job: after a contract lock, a cabinetry change rewrote the contracted CABINETRY quote rows on the next save or reopen, because the cabinetry engine runs inside `normalizeWorkbook`. Now frozen under the lock: `test-client-selections-contract-lock-cabinetry.mjs`. The Quotation session made the shared changes, coordinated with me: `ignoreContractLock` only in the Reconcile proposal pass, and procurement held under the lock (`test-quotation-post-contract-procurement.mjs`). |
| 10 | Approval with rejection, revision and resubmission | **PASS (built today)** | Before, the builder could only sign off, and a rejected record could not be resubmitted (conflict error). Now: **Reject…** with a required reason in Variations; Client Selections shows the reason and clears the box; ticking it again resubmits the same record and keeps the rejection history. Node: `test-client-selections-variation-persistence.mjs` (API reject, resubmit, withdraw). Browser phase `rejection` on a contract-locked copy: the client saw the reason and the resubmission wrote `status: submitted`. |
| 11 | PDF from actual job data | **PASS (layout repaired)** | `accept-client-selections-v1-pdf.mjs`, then `inspect-client-selections-v1-pdf.mjs`: **24/24 checks**, 24 pages. Fixed: "Awaiting decision" was clipped in the variation status columns. Three checks were stale from before 11 Nov and were updated to the current rules: credit includes margin and GST, "Approved" wording, client-safe wording when the allowance is unknown. |
| 12 | Two-user database isolation | **PASS (isolated DB)** | New `test-client-selections-two-builder-rls.mjs`: PGlite built from the real migrations, two builders, 6 tables (projects, snapshots, sessions, client selections, selection books, variations), **96 checks**. Each owner is isolated on read, update, delete, insert and move, and a client-role member has no direct access. Also passing: `test-commercial-internal-member-rls.mjs` and `test-client-selections-authorisation.mjs`. **Real PostgreSQL 17.4 (16 Nov):** `test-client-selections-two-builder-rls-postgres.py` ran the same check in a fresh database inside the Quotation session's isolated Docker container (not a full Supabase stack; stub auth schema), and **all 6 tables passed**. Its database `cs_rls_1794766406` may still exist in that disposable container, because the drop was cut off when Docker stopped; it is noted in QUOTATION_GROK_REPORT.md for removal, and the script now drops with FORCE and verifies. **Live Supabase not verified.** |
| 13 | Production build | **PASS** | Shared build run by the Quotation session from this working tree: exit 0, 246/246 pages. One CSS-only change came after it (PDF status wrap); it was verified by re-rendering through the same library code. |

**Regression re-run (15 Nov, later):** the Quotation session fixed a job-reopen defect in `planBlobStorage.js` (a missing artwork asset stopped the whole job reopening) and rebuilt: BUILD_ID `6Nv3rhCS_h8i27TDmFZwu`, exit 0, 246/246 pages. On that build all 8 browser phases passed again, including rejection on a contract-locked copy, with 0 production requests.

## Repairs made today (files)
- `lib/construction-estimation/cabinetryRequirements.js`: contract-lock guard and the `ignoreContractLock` option.
- `components/client-selections/BuilderStandardRangeWorkflow.jsx` and `pages/modules/builders/selections-book.js`: Save and Continue; in-app Back clears the selection URL; builder rejection loaded and shown.
- `lib/builders/contractLock.js`, `pages/api/builders/selection-variation.js`, `pages/modules/builders/variations.js`, `lib/builders/selectionVariationPersistence.js` and `components/client-selections/VariationSummaryPanel.jsx`: reject, resubmit and history.
- `lib/builders/selectionsScheduleHtml.js`: status cells wrap in the PDF.
- `pages/modules/builders/client-selections.js` (secondary DB showroom page): Grok's URL restore never took effect, because the no-project reset wiped it and the project was not in the URL. Fixed, and the push was gated on hydration. The `VariationSummaryPanel` label also now uses the guarded figure.
- New tests: `scripts/test-client-selections-contract-lock-cabinetry.mjs`, `scripts/test-client-selections-two-builder-rls.mjs` and `scripts/accept-client-selections-isolated-browser.mjs`. Extended: `test-client-selections-variation-persistence.mjs` and `test-builder-standard-hvac-browser.mjs` (Save and Continue step; defaults to 3101 and refuses port 3000). Updated: `inspect-client-selections-v1-pdf.mjs`.

## Still blocking production
1. **Clothesline, letterbox and house numbers have no catalogue products.** Product Library must import supplier products, or the owner decides on a "builder standard / to be specified" option.
2. **Live Supabase RLS not verified.** Confirm migration `20261021000100` (and the recursion fix `20261028000100`) is applied in production with a read-only check by the owner.
3. **Owner decision on allowances:** the client view and PDF show "Standard: Allowance $…". The 11 Nov privacy note says the client sees differences only, but allowances appear throughout the client screens, so this needs a product decision.
4. Benchtop price-group mapping is per browser (localStorage). Saved surfaces keep their range, so nothing is lost, but a browser with a different mapping re-ranges them. Moving it to a workspace table needs a coordinated migration (P1).
5. Known, unchanged: O.Novo is labelled Bath ×4 on the real job, and the builder must re-pick Shower.
6. **Full node suite (16 Nov):** `npm run test:client-selections` found 65 suites. 60 passed, 1 failed and 4 were skipped.
   - The failure was `test-client-selections-migrations.mjs`: the test database lacked the `anon` role that Supabase always has, so it was a harness gap, not a migration defect. The role was added and all 12 checks now pass.
   - The two fixture-dependent suites (`test-selection-allocation-rooms` and `test-selection-cross-category-duplicates`) pass against `C:\Users\grant\cs-backup-20261031\recovered-03-09-123-profile.gr8job`.
   - Result: **63/65 pass.** The 2 remaining skips need a browser: the memory soak and the cover PDF.
