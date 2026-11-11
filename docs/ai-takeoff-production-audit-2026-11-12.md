# AI Plan Takeoff: production-readiness audit, 12 November 2026

**Recommendation: NOT production ready.** Five critical items fail or were not tested (section 4, P0).
The takeoff part of the workflow works on both real vector plans: upload, calibrate, analyse, review, save,
reopen and rerun. But the code isn't committed, the full workflow into Job Setup and quotation isn't proven on
this code, and the sign-in/save lock fix, multi-user security and production build are still outstanding.

No code was changed during this audit. Nothing was started, stopped or touched on port 3000.

---

## 1. Version under audit

| Item | Finding |
|---|---|
| Repository | `E:\dev\funnel-builder-clean` |
| Branch | `recovery/live-snapshot-20261031` (tracks `origin/recovery/live-snapshot-20261031`) |
| HEAD | `f76415a` (9 Nov 2026), pushed to that branch |
| vs `origin/main` | 5 commits ahead, 15 behind: **main does not hold the current takeoff** |
| Uncommitted takeoff work | 14 modified files (+477 / −102 lines) and 4 new files never committed: `geometry/buildingOutline.js`, `geometry/electricalSymbols.js`, `geometry/exteriorContainment.js`, `roomSnapping.js`. The committed code at HEAD doesn't import the new files; only the uncommitted versions do. |
| Mounted implementation | `components/estimate-builder/EstimateBuilderWorkbook.js` loads `ai-plan-takeoff/AIPlanTakeoffPage.jsx`, which renders `AIPlanTakeoffStandalone.jsx`. No other takeoff screen is mounted. |
| Legacy / duplicates | `/modules/takeoff-v3` page removed, but `scripts/test-takeoff-v3-acceptance.mjs` still targets it. `components/estimate-builder/JobSetupTakeoffImport.jsx.bak`. Copies under `artifacts/takeoff-openings-work-20261102/` and `artifacts/takeoff-checkpoints/` (not loaded by the app). |
| AI dependency | "Run AI Takeoff" calls OpenAI through `pages/api/ai/takeoff-analyse.js` (paid). The local vector run (`buildLocalVectorAnalysis`) makes no AI call. |

## 2. How it was tested

- **Browser:** `scripts/test-takeoff-vector-plan-browser.mjs` on the original Liberty Terrace and Jesmond Road PDFs.
  - Each result is scored against independent hand-traced references.
  - Run through the memory-guarded runner on a random local port (never 3000), one run at a time.
  - The bundle was rebuilt from the current working tree on 12 Nov, 06:53.
  - Test Chrome used the isolated sign-in lock from branch `0039879`. The app's own lock is not in this run (see D1).
- **Stub provider:** the test stands in for the paid AI and supplies only sheet type and level. Every wall,
  opening, room and floor area below is the application's own measurement from the PDF linework, not mocked
  detection.
- **Deterministic suite:** 60 `scripts/test-takeoff-*.mjs` files. Shared JSON imports are handled with an import
  hook (see D18).
- **Excluded and not run:**
  - The two suites that load the app on `localhost:3000` (`v3-acceptance`, `emergency-recovery`).
  - `test-job-setup-takeoff-browser.mjs`, which also defaults to port 3000.

## 3. Test results

### 3.1 Browser run, 12 Nov 2026 (exit 1)

The run stopped at **Send to Quote Sheet**. The app refused, by design, with: "Takeoff is not ready for
quotation. Resolve or reject the 28 required review item(s)". The test has no step that resolves them, so Job
Setup and quotation were not reached. No browser errors were recorded, and memory stayed above 11 GB free.

| Step | Liberty Terrace (4 pages) | Jesmond Road (19 pages) |
|---|---|---|
| Upload | PASS, 5 s | PASS, 26 s |
| Calibration (1:100 = 0.0283465 px/mm) | PASS, 0.02834648 | PASS, 0.02834648 |
| Run (local vector engine) | PASS, 24 s | PASS, 60 s |
| First save | 13 s | **42 s** |
| Room approval persists | PASS (Bed 3 12.67 vs 12.69 m²) | PASS (Laundry 7.85 vs 7.88 m²) |
| Canvas: 16 px labels, window/door markers, overlay toggles | PASS | PASS (both sheets) |
| Wall checks saved and reread | PASS | PASS (kitchen false wall deleted) |
| Reopen keeps walls, openings, approvals | PASS (79 / 31 / 1) | PASS (139 / 46 / 1) |
| Rerun doesn't duplicate or overwrite | PASS | PASS |
| .gr8job export/import | NOT TESTED (skipped, ~300 MB) | NOT TESTED |
| Send to Quote Sheet → Job Setup → quotation | BLOCKED by review gate | BLOCKED by review gate |

### 3.2 Detection accuracy against independent references

| Measure | Liberty Ground | Jesmond Lower | Jesmond Upper |
|---|---|---|---|
| Wall recall (share of reference walls found) | 0.958 | **0.820** | 0.938 |
| Wall precision (share of found walls that are real) | 0.985 | 0.972 | **0.915** |
| Exterior/interior class correct | 0.979 | 0.999 | 0.947 |
| Openings matched / reference | 29 / 33 (88%) | 19 / 21 (90%) | 19 / 23 (83%) |
| Openings awaiting builder | 4 | 1 | 2 |
| Rooms matched / reference | 15 / 15 | 12 / 12 | 8 / 9 (cupboard missed) |
| Footprint vs printed living area | 261.77 m², no printed or traced reference: **unverified** | 135.01 vs 136.25 (−0.9%) | 163.20 vs 165.14 (−1.2%) |

Rooms with area error over 5%:

| Room | Area error | Boundary overlap with reference |
|---|---|---|
| Jesmond Upper Powder | +17.5% | 0.85 |
| Jesmond Upper WIR | −15.4% | 0.85 |
| Jesmond Upper Linen | −12.8% | 0.90 |
| Jesmond Upper Pantry | −6.7% | 0.86 |
| Jesmond Lower B3 WIR | −7.2% | 0.93 |
| Liberty Dining/Family/Kitchen | −7.6% | 0.90 |
| Liberty WC | −5.4% | 0.95 |

All other rooms are within ±4.2%.

Outdoor areas (11 Nov measurement, still AI-sourced):

| Area | Measured | Printed |
|---|---|---|
| Jesmond balcony | 14.71 m² | 24.49 m² |
| Jesmond terrace | 6.87 m² | 48.84 m² |

New Job 03/09 was **not run today**. Its last replay (8 Nov) was a raster plan:

| Level | Footprint after wall constraint | Printed |
|---|---|---|
| Ground | 224.80 m² | 225.31 m² |
| Upper | 165.13 m² | 152.86 m² (balcony open-edge leak) |

### 3.3 Deterministic suites: 54 pass, 6 fail

Six suites fail. All six failed at the earlier baseline `8ad75b7` too:

| Suite | Failure | Assessment |
|---|---|---|
| `rooms-from-plans` | Rooms rows 50, expected 25 | Stale test. Each room now has a floor-area row and a ceiling-area row by design; no quantity is counted twice. |
| `review-and-evidence` | Printed living area fallback `undefined`, expected 148.02 | Behaviour change: printed areas now need confirmation first. The test or the rule needs a decision. |
| `ai-adapter` | Area from adapted polygon `undefined`, expected 8 | Stale API in test |
| `unconfirmed-gap-review` | 2 faces, expected 1 | Behaviour change; needs a decision |
| `material-flow` | `browserWorkspaceId is not defined` | Test harness (Estimate Builder) |
| `plan-asset-storage` | Can't resolve `knownAssetIds.js` in browser harness | Test harness |

One suite skipped: `two-tenant-isolated` (no isolated stack configured).

## 4. Defect and outstanding-work register

Status key: PASS, FAIL, BLOCKED, NOT TESTED. "Confirmed" means a defect shown by evidence today or in a
recorded run. "Unverified" means a requirement that hasn't been tested.

### P0: must be fixed before release

| # | Issue | File / component | Evidence | Required repair | Acceptance test | Status |
|---|---|---|---|---|---|---|
| D1 | **Confirmed.** Sign-in/save lock fails permanently after a main-thread stall: a single tab gets "Another tab is still saving or signing in". | `lib/nonStealingLock.js` (shared by all modules) | Real-browser check 9 Nov: current lock fails every freeze scenario. The fix on branch `takeoff/auth-lock-repair-20261108` (`0039879`) passes them. Today's browser run used the fix, not the app's lock. | Apply `0039879` after a cross-module sign-in regression (Takeoff, Client Selections, Quotation). | `test/non-stealing-lock-stall.test.mjs` plus a real two-tab sign-in in each module | FAIL |
| D2 | **Confirmed.** Current takeoff code isn't committed: 18 files, 4 never tracked. `main` is 15 commits behind and lacks it. | Working tree | `git status` (section 1) | Owner-approved commit on a takeoff branch, including the 4 new files, then merge plan to main | Clean checkout of the commit passes the suite and the browser run | FAIL |
| D3 | **Confirmed.** Takeoff → Job Setup → Quotation is not proven on the current code. The browser run stops at the review gate (28 items). | `scripts/test-takeoff-vector-plan-browser.mjs` | Section 3.1; the last full pass was 3 Nov on older code | Add a harness step that resolves or rejects each review item the way a builder would. Then run through Job Setup and quotation and reconcile each quantity with its takeoff object. | Browser run exits 0 with a quantity reconciliation table | BLOCKED |
| D4 | **Unverified.** Tenant isolation, role permissions, two simultaneous users, save conflicts | `test-takeoff-two-tenant-isolated.mjs`, job storage | Suite skipped: `TAKEOFF_ISOLATED_ENV` not set | Stand up the isolated Supabase stack (not production) and run the two-tenant and two-user tests | Both suites pass against live RLS | NOT TESTED |
| D5 | **Unverified.** Production build of the current tree | Whole app | Last `npm run build` passed at `f76415a` (9 Nov), without the uncommitted takeoff work | Build in `.next-build`, coordinated with the other sessions | Build exits 0 | NOT TESTED |

### P1: wrong or incomplete quantities and workflows

| # | Issue | File / component | Evidence | Required repair | Acceptance test | Status |
|---|---|---|---|---|---|---|
| D6 | **Confirmed.** Balcony, terrace and alfresco outer edges come from the AI, not the drawing | `ai-integration/vectorProductionAnalysis.js` (`measuredBuildingAreas`) | Balcony 14.71 vs 24.49 m², terrace 6.87 vs 48.84 m² | Trace outdoor areas from the drawn slab and decking edges in the vector linework | Within 4% of printed areas on Jesmond and New Job 03/09 | FAIL |
| D7 | **Confirmed.** Jesmond Lower misses 18% of reference walls (recall 0.82); Upper precision 0.915 (false walls such as joinery) | `geometry/vectorWalls.js`, `geometry/elementClassifier.js` | Section 3.2 | Investigate the missed walls one by one (retaining, nibs, cupboard) against the reference | Recall ≥ 0.95 and precision ≥ 0.95 on all three sheets | FAIL |
| D8 | **Confirmed.** Openings missed: Liberty 4 of 33, Jesmond Upper 4 of 23, Lower 2 of 21. Most door heights unread ("height to confirm"), so wall and plasterboard deductions are incomplete. | `geometry/openingLabels.js`, `vectorDoorSwings.js`, `openingMarkers.js` | Section 3.2; canvas samples "D4 · 1438W · height to confirm" | Read door heights from schedules or defaults the builder approves. Close the missed openings. | 100% of reference openings, each with a width and height | FAIL |
| D9 | **Confirmed.** Small rooms off by 6–18%; one Jesmond cupboard missed | `planModel.js` room enclosure | Section 3.2 | Divider and enclosure rules for small rooms | Every room ≤ 5% area error | FAIL |
| D10 | **Confirmed.** Jesmond first save takes 42 s. Closing the tab during a save is a data-loss risk. | Save path (`useEstimateBuilderWorkbook`, job storage) | Section 3.1 | Profile and cut save size; warn on close while saving | Save ≤ 5 s; a close-during-save test loses nothing | FAIL |
| D11 | **Unverified.** Previously reported plasterboard discrepancy, short nibs, retaining wall and window classes not re-measured today. 8 Nov run: north retaining wall 23.61 vs 23.82 m (fixed); Lower internal walls +2.9 m from 3 wet-area nibs and a 150 mm WIR wall; Upper SGD class fixed. | `takeoffSchedule.js` plasterboard, `elementClassifier.js` | Recorded 8 Nov run, not today's | Add plasterboard m² and retaining wall to the browser report and score them against the reference | Within 2% of reference | NOT TESTED |
| D12 | **Unverified.** Live AI provider path ("Run AI Takeoff") not run on current code; it's a paid OpenAI dependency | `pages/api/ai/takeoff-analyse.js` | No paid runs approved | One approved live run, or make the local vector run the default and the AI optional | Live run completes and matches the local measurements | NOT TESTED |
| D13 | **Unverified.** .gr8job export/import of a full job (~300 MB) in the browser | `jobPersistence.js`, `.gr8job` export | Skipped in today's run | Run the export step on its own, with the memory guard | Export, import and identical quantities | NOT TESTED |
| D14 | **Unverified.** Crash recovery with corrupted records, missing plan assets, interrupted saves, stale browser data | Recovery and storage | Contract tests pass (`recovery-contract`, `overwrite-guard`, `save-reliability`, `original-protection`). The browser recovery suite needs port 3000, so it was not run. | Point `emergency-recovery` at an isolated port and add interrupted-save and missing-asset cases | All cases recover without loss | NOT TESTED |
| D15 | **Missing requirement.** No takeoff quantities for insulation, waterproofing (wet-area floor + upturn), skirting/cornice or stairs. Roof is eaves-based (fascia, gutter); there's no roof pitch or plan-roof measurement. | `takeoffSchedule.js` | Code search: no matches in the takeoff or takeoff material libs | Owner to confirm which belong in Takeoff vs Estimate Builder, then add them | Quantities match a hand takeoff on Jesmond | FAIL (missing) |
| D16 | **Unverified.** Electrical symbol counting has been tested only on a test PDF built for the purpose and on Jesmond's smoke-alarm labels (2 + 5, correct). No real electrical layout plan has been tested. | `geometry/electricalSymbols.js` | `test-takeoff-electrical-symbols.mjs` | Test on a real electrical plan | Counts match a hand count | NOT TESTED |
| D17 | **Unverified.** Liberty footprint 261.77 m² has no reference. The browser report doesn't show how a footprint was measured (`measuredFrom` reads null). | `test-takeoff-vector-plan-browser.mjs` | Section 3.2 | Hand-trace the Liberty footprint; read the measurement source from the saved area | Within 2% | NOT TESTED |
| D18 | **Confirmed.** Three takeoff suites fail under plain Node because shared pricing libraries import JSON without import attributes. The libraries are owned by another session, e.g. `ownerQuotePrices.js` (new 11 Nov). | `lib/construction-estimation/*` | All three pass with an import hook | Owning session adds `with { type: 'json' }`, or the test runner carries the hook | Suites pass under plain `node` | FAIL |

### P2: tests, hygiene, usability

| # | Issue | File | Required repair | Status |
|---|---|---|---|---|
| D19 | 6 failing suites (section 3.3): stale tests or behaviour changes needing a decision | `scripts/test-takeoff-*` | Update the four stale tests; decide the two behaviour changes | FAIL |
| D20 | `test-takeoff-v3-acceptance` targets a removed page; it and `emergency-recovery` default to `localhost:3000` | Those scripts | Retire v3-acceptance; make recovery take an isolated port and refuse 3000 | FAIL |
| D21 | Leftover `JobSetupTakeoffImport.jsx.bak` and working copies in `artifacts/` | Repo | Remove after owner approval | FAIL |
| D22 | Opening labels crowd the plan ("D2 · 4868W · height to confirm") | `openingMarkers.js` | Size only on the plan, full detail on hover | FAIL |

### What passed (evidence today)

| Area | Result |
|---|---|
| PDF import | Multi-page navigation (4- and 19-page sets) |
| Calibration | Exact to 0.00001 px/mm |
| Canvas | 16 px opening labels, window dots and door triangles, overlay toggles keep the view |
| Saved state | Wall checks, room approvals, reopen and rerun all keep state without duplicates |
| Room accuracy | Liberty 15/15 and Jesmond Lower 12/12 rooms matched, most within 2% |
| Floor areas | Footprints within 1.2% of printed |
| Review gate | Unapproved quantities can't reach a quotation: the gate refused Send to Quote Sheet with 28 items open |
| Deterministic suites | 54 pass, including overwrite protection, save verification, freshness guard, calibration per sheet, commercial safety and AI server request bounds |

## 5. Completion plan, in order

1. **Secure the work (D2).** Owner-approved commit of the takeoff files on a takeoff branch, then check a clean
   checkout runs. Nothing else is safe until this is done.
2. **Sign-in lock (D1).** Run the cross-module sign-in regression, then apply `0039879`. Rerun the browser test
   with the app's own lock.
3. **Prove the full workflow (D3).** Harness step to settle the review items. Then Takeoff → Job Setup →
   Quotation on Jesmond and Liberty, with each quantity reconciled to its source object. Unblocks every
   downstream check.
4. **Build and security (D5, D4).** Production build of the committed tree. Isolated Supabase stack for
   two-tenant, two-user and conflict tests.
5. **Quantity accuracy (D6, D8, D7, D9, D11).** Outdoor areas from the drawing first: balcony and terrace are the
   largest errors in m². Then door heights and missed openings, which feed plasterboard and lining deductions.
   Then wall recall on Jesmond Lower, small-room enclosure, and plasterboard/retaining scoring in the report.
6. **Reliability (D10, D13, D14).** Save time and close-during-save, .gr8job round trip, recovery cases on an
   isolated port.
7. **Scope decisions (D15, D12, D16).**
   - Owner decides which missing quantity types belong in Takeoff.
   - Choose between local-first and a paid AI run.
   - Test electrical counting on a real electrical plan.
8. **Clean-up (D18–D22, D17).**
   - Test fixes and retirements.
   - JSON import attributes (with the owning session).
   - Leftover files.
   - Label decluttering.
   - Liberty footprint reference.

Release is possible when steps 1–5 pass. Steps 6 and 7 should pass before builders rely on it commercially.
