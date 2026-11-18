# AI Take-off module: audit

**Date:** 18 November 2026. **Branch:** `recovery/live-snapshot-20261031` (last commit touching the take-off: `6d47a4c`).

**How this audit was done:** by reading the code and running the existing test scripts. No existing file was changed to produce it.

**Uncommitted work:** more than 110 files under the take-off, `lib/construction-estimation` and `scripts` are uncommitted. Most of that is take-off work from the last few weeks. Everything below describes the working tree as it is now, not what is committed.

---

## 1. What the system does today, end to end

| Step | Where | How it works |
|---|---|---|
| Open a job | Estimate Builder → Take-off tab (`AIPlanTakeoffStandalone.jsx`, 6,858 lines) | The take-off is part of the Estimate Builder job (the "workbook"). It is saved with the job. |
| Upload plan | Same screen, "Open Plan" | pdf.js renders every PDF page in the browser to an image. The PDF's vector linework and text are kept for measuring. Page images are stored by content hash in browser storage (`planBlobStorage.js`). |
| Set levels | "Sheet N is which level?" control | The builder says which sheet is which floor. Only sheets given a level are measured. |
| Scale | Calibrate tool (two points plus a known distance), shared to other sheets at the same scale | Scale is set by the builder. A scale proposal from printed dimensions exists, but plans whose text is drawn as outlines (common) cannot be scaled automatically. |
| Measure (default) | "RUN TAKEOFF — MEASURE LOCALLY (NO AI CHARGES)" (`useAiTakeoffAnalysis.js` → `geometry/vectorWalls.js` → `planModelAdapter.js` / `planModel.js` → `vectorProductionAnalysis.js`) | All of it runs in the browser from the PDF's own linework: walls (paired lines), openings (gaps, door swings, frames), rooms (closed faces of the wall network), floor and outdoor areas. Room names and door/window size codes are read by local OCR (tesseract.js, in a web worker). No network calls. |
| Measure (optional, paid) | "AI-assisted analysis (OpenAI — paid)" behind an explicit confirmation → `/api/ai/takeoff-analyse` → `lib/construction-estimation/aiTakeoffAnalysis.js` | Page images go to OpenAI (`gpt-5.4`) for sheet reading and plan semantics. The AI's geometry is used only to label measured objects, never as quantities. |
| Review | Room panel, review list, wall-check per sheet, quotation gate | Every detected room, wall sheet and uncertain opening needs builder approval before its quantity is used. Approvals are stored on each object. |
| Quantities / BOQ | `takeoffSchedule.js` (2,023 lines), `constructionQuantities.js` | Builds the Takeoff Schedule: walls by type, openings and door and window schedules, rooms, floor areas, linings, skirting, cornice, insulation, electrical points, etc. |
| Export / pricing | "Takeoff Schedule" → "Send to Quote Sheet" / Job Setup payload; CSV and Excel XML export; HTML report (print to PDF) | Approved quantities feed the Quotation Builder. A quotation gate blocks transfer until review items are resolved. |
| Save | `useEstimateBuilderWorkbook.js` `saveStoredJob` → browser IndexedDB; optionally `lib/job-storage` (a job server the builder hosts) | The local browser is the primary store. Shared storage is optional and must be set up per company. |

### Works (verified by tests or real-plan runs)

**Local measuring on vector (CAD-exported) PDFs, against independent references:**

| Plan | Wall recall | Wall precision | Openings | Rooms |
|---|---|---|---|---|
| Liberty | 98.7% | 98.6% | 32 of 33 | 15 of 15 |
| Jesmond lower | 82.0% | 97.2% | 19 of 21 | 12 of 12 |
| Jesmond upper | 93.8% | 91.7% | 18 of 23 | 8 of 9 |

**Floor area against the printed area tables:**

| Plan | Measured | Printed |
|---|---|---|
| Sunshine Cove ground | 115.5 m² | 117.7 m² |
| Sunshine Cove upper | 116.2 m² | 115.6 m² |
| Chermside ground | −0.3% | |
| Chermside first | +1.4% | |
| Jesmond upper | −1.0% | |
| Jesmond lower | −0.5% | |
| Mountain Creek ground | +1.8% | |
| Mountain Creek first | +4.3% | |

**Also working:**
- **Zero paid calls by default.** Paid AI only runs after an explicit confirmation, enforced in the screen and again in the request client.
- **Save, reopen and rerun:** reopen restores identical counts, a rerun adds nothing, and re-measuring is refused once anything has been approved.
- **Review gating:** nothing unapproved reaches the quotation.
- **Tests:** a 105-script take-off regression suite passes (`scripts/test-takeoff-*`, `test-vector-*`, `test-plan-model-*` and related). Browser acceptance passes on Sunshine Cove, Liberty and Jesmond. A copy of a real saved job was re-measured, reviewed, saved and reopened in the browser.

### Half-built

- **Shared, multi-user storage** (`lib/job-storage`). The job server, revisions, conflict refusal and per-company authorisation are built and tested with several processes, and wired to commit after a local save. Not done:
  - no hosted cloud provider (S3 or similar);
  - no automatic pull of newer revisions into an open tab;
  - offline commits retry only on the next save;
  - most companies would run in Local Only mode, which means one browser per job.
- **Scale detection:** manual calibration works. Automatic scale works only where the PDF has a text layer.
- **Room naming:** works where names are printed or read by OCR. Labels crossed by door swings (PWD, WC on Sunshine Cove) stay unnamed. Open-plan spaces with no walls between them are one room.
- **BOQ export:** CSV, Excel XML and an HTML report exist. There is no priced BOQ document of its own; pricing happens in the Quotation Builder.
- **Room overview UI** (rebuilt today, uncommitted):
  - visibility switches;
  - centred, fitted room labels;
  - pick a room from the list to centre it on the plan;
  - outdoor areas listed separately;
  - re-measure with the current rules.

  Verified on a copy of the real Sunshine Cove job. The Liberty and Jesmond browser tests were updated for the new overlay switches, but the rerun was interrupted, so they are not re-proven on this build.

### Broken or wrong (known)

- **Scanned (image-only) plans** cannot be measured locally. The raster engine was tested and is not accurate enough. Such sheets are named and skipped.
- **Upper floors over a lower roof:** a parapet over a lower roof is counted as an external wall (Mountain Creek first floor +4.3%).
- **Joinery read as walls:** benches, robes and joinery double lines can be read as walls. A per-sheet "check the walls" step is mandatory for that reason.
- **Small rooms:** some come out unnamed (OCR) and must be named by hand.
- **Printed versus drawn areas:** Sunshine Cove's balcony draws as 7.5 m² against 9.82 m² printed. The tool reports what is drawn.

### Unused or dead code

- **`pages/api/ai/plan-detect.js`:** the old GPT-4o plan reader. No callers, but still a live, signed-in-only paid endpoint (see Risks).
- **`pages/api/builders/johnson-takeoff-recovery-preview.js`:** disabled (returns 410).
- **`pages/api/recovery/restored-takeoff.js`:** development-only one-off recovery route; its own comment says to delete it.
- **Never imported by the app:** `geometry/planAccuracy.js`, `geometry/roomReferenceMetrics.js`, `geometry/wallPaths.js` and `OpeningsModal.jsx`. The first two are probably used only by test scripts.
- **Raster pipeline** (`geometry/planGeometry.js`, `geometry/lineworkFusion.js`, about 2,200 lines): still imported, but only reachable for scanned plans, where it is not trusted.
- **Legacy browser stores** read only for recovery: `estimate-builder-template-db` (unscoped), `gr8-ai-plan-takeoff-recovery-db` and `gr8:ai-plan-takeoff:recovery:*` localStorage keys.

---

## 2. Multi-user readiness

| Area | State |
|---|---|
| Login | Supabase Auth with Bearer JWT on API routes (`lib/withWorkspace.js`). |
| Companies | A "workspace" is a builder company: `workspaces` plus `workspace_members` with RLS. The job's `workspaceId` is checked when a job is loaded in the browser (`scopeBrowserWorkbook`). |
| Roles | Workspace roles: owner, admin, builder, builder_admin, builder_staff, estimator, interior_designer, sales. The job server has its own roles: admin, member, viewer. The take-off screen checks no role: anyone who can open the job can measure, approve and send to the quote. |
| Data separation in the browser | The Estimate Builder scopes its IndexedDB and localStorage keys by workspace (`browserTenantStorage.js`). The take-off's own stores are not scoped: plan images (`gr8-takeoff-plan-assets-v1`), recent take-off jobs (`gr8:ai-plan-takeoff:recent-jobs`), the legacy job database (`estimate-builder-template-db`, read by recovery and listing functions) and recovery snapshots. On a shared computer, one company's user could see another company's recent take-off list and plan images through recovery screens. |
| Data separation on the server | Commercial snapshots go through `withWorkspace` with role checks and workspace-scoped RPCs. The take-off analysis route uses only `withAuth`: it knows the user, not the company, so there is no per-company budget or audit. |
| Two people on one job | Local Only mode means the job lives in one browser, so there is no real multi-user editing. A same-browser, other-tab stale save is refused (`takeoffFreshnessGuard.js`, job revisions). With the builder's job server, saves use optimistic concurrency: a stale save gets HTTP 409, the second person must reopen the latest version, and there is no merge. The take-off's approvals and review answers are part of the job record, so the last save wins once a conflict is resolved by reopening. |

**Verdict:** single-user per job is solid. Several staff on one job at the same time is not ready; it needs the shared storage finished, plus conflict handling for the take-off.

---

## 3. Take-off pipeline: where it fails or gives wrong numbers

| Stage | Failure modes |
|---|---|
| PDF upload | Every page is rendered to an image in the browser, which is heavy on large plan sets; the commit limit on this machine has crashed sessions. Plan images live only in that browser: opening a saved job elsewhere shows "Plan image missing" until the PDF is relinked. That relink was broken (it opened an empty take-off) and was fixed today, uncommitted. |
| Sheet levels | Wrong levels give wrong floors. The live Sunshine Cove job had the elevations sheet set to Ground Floor, so the ground floor came out empty. Fixed today (uncommitted): when two sheets share a level, the sheet that reads as a floor plan is measured and the builder is told. |
| Scale | Manual calibration is the single biggest error source. A wrong calibration scales every quantity. The sheet's printed dimensions are compared when there is a text layer; outlined-text PDFs cannot be checked automatically. |
| Walls | Joinery and fixtures can be read as walls. Walls in an unusual pen or thickness are held for review and excluded from quantities until classified, so a total can be low until review is done. Parapets over a lower roof count as external walls. |
| Openings | Doors are found from swings and gaps, windows from frames and printed codes. Heights come only from printed codes, otherwise "to confirm". Frames across closed sides and robe doors are listed for review, not counted. |
| Rooms | Rooms are closed faces of the wall network. If one wall is missing, two rooms merge or a room disappears. This happened with Bedroom 4 on Sunshine Cove before today's fixes. Open-plan spaces are one room. |
| Areas | The footprint follows the outer wall faces. Roof-only areas are excluded only when a roof word is printed inside them. Balconies and outdoor areas are measured separately, from their drawn outline. |
| Quantities | Derived quantities (skirting, cornice, linings, insulation) depend on approved rooms and wall heights. Anything not approved is withheld, so an under-reviewed job gives a short BOQ, never an inflated one. |
| Export | Only approved quantities transfer. The quotation gate blocks until review items are resolved. |

---

## 4. Production gaps

- **Long jobs and background work:**
  - Measuring runs on the browser's main thread, apart from OCR in a web worker. A large sheet freezes the screen for seconds; closing the tab loses the run.
  - There is no server job queue. Paid AI calls are made one per page from the browser, through a server route with `maxDuration: 300`.
- **Error handling:** user-facing messages are good, and failures fall back to local measurement and never discard local results. There is no error reporting service (no Sentry or similar); server errors go to `console.error` only.
- **Logging and audit:** no audit trail of who approved which quantity, beyond `approvedAt` on the object. AI requests are logged to the console only.
- **AI cost controls:**
  - Paid analysis needs explicit authorisation per run.
  - The server limits each user to 160 page analyses an hour and two at a time, but only in memory: the counter resets on restart and is per server instance (serverless gives many instances).
  - There is no per-company budget, no stored usage ledger and no cost shown to the builder after a run.
  - `plan-detect.js` has no limit at all.
- **Security:**
  - The take-off analysis route checks the user but not the workspace.
  - Request size is limited (12 MB body, 3 MB per image).
  - The take-off's browser storage is not scoped by company.
  - Some routes exist for one-off recovery and should be removed.
  - The job server is designed for the builder to host (HTTPS enforced on a network).
- **Tests:**
  - 121 take-off test scripts exist (568 test scripts in the repo), but none run in CI. The only workflow is `standard-inclusions-acceptance.yml`, and there is no `npm test` for the take-off.
  - Browser acceptance needs local Chrome, about 2 GB of free memory and plan PDFs that are not in the repo.
- **Build:** `npm run build` last passed on 9 November (`f76415a`). It has not been run on the current uncommitted tree.
- **Deployment:** `vercel.json` with Next.js 15. There is no staging checklist, no migration runbook for the job-storage database, and the job server is a separate process the builder must run.

---

## 5. Risks

| Risk | Severity | Why |
|---|---|---|
| Cross-company data on a shared computer | High | The take-off's browser stores (plan images, recent jobs, recovery copies, the legacy job database) are not scoped by workspace. A different company's user on the same browser profile can reach them through recovery or listing screens. |
| Unmetered paid endpoint | High | `/api/ai/plan-detect` is live, needs only a login, calls GPT-4o and has no limit or callers. |
| AI cost per company not controlled | Medium | The in-memory per-user limit resets and is per instance. There is no company budget or usage record. |
| Data loss: job lives in one browser | High | In Local Only mode the job and its plan images exist only in that browser's storage. Clearing site data loses them; this happened on 2 October. Exports and backups are manual. |
| Data loss: overwrite on conflict | Medium | Stale saves are refused, but the take-off has no merge, so resolving a conflict means one person's edits are re-done. |
| Wrong quantities from a wrong scale | High (commercial) | One bad calibration scales everything. Printed-dimension checks exist only for text-layer PDFs. |
| Wrong quantities from unreviewed geometry | Mitigated | Gates hold unapproved items back. The risk is a short BOQ, not an inflated one. |
| Large uncommitted working tree | High | Weeks of take-off work is uncommitted on a recovery branch, edited by several parallel sessions. One bad reset loses it. |
| Untested build | Medium | The current tree has not been built for production. |

