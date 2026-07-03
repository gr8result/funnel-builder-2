# Estimate Builder — Current Architecture (Discovery Report)

Phase 0 discovery only. No code has been modified. All line counts and file lists below were verified directly against the working tree (not taken on faith from any single source).

Scope note: the directive says "only replace the Estimate Builder module." The module boundary in this codebase is `/modules/estimate-builder/*` + `components/estimate-builder/**` + `hooks/estimate-builder/**`. Adjacent modules reachable from the same "Projects Hub" (Construction Hub) page — **Job Board** (`/modules/jobboard`), standalone **Gantt** (`/modules/gantt`), and **Production Flow** (`/modules/production`) — are separate modules and are NOT in scope, per "DO NOT TOUCH ... Marketing modules" / "Only replace the Estimate Builder module." One nuance: `components/estimate-builder/gantt/*` is a **Gantt tab embedded inside the Estimate Builder workbook itself** (only ever imported by `EstimateBuilderWorkbook.js`) — it is a different thing from the standalone `/modules/gantt` module and IS in scope since it lives inside the Estimate Builder component tree.

---

## 1. Folder Structure

```
components/estimate-builder/
  EstimateBuilderWorkbook.js          5,454 lines — main orchestrator (tabs, mode routing, job I/O wiring)
  ai-takeoff/
    AIPlanTakeoffPage.jsx               426 lines — takeoff tab shell, wires panels together
    PDFUploadPanel.jsx                  623 lines — PDF.js loader, multi-plan upload, page rasterization
    PlanCanvas.jsx                    1,109 lines — SVG drawing canvas (pan/zoom/rotate/draw)
    TakeoffToolbar.jsx                 ~150 lines — tool palette
    RoomPanel.jsx                       ~80 lines — room list + floor finish picker
    ObjectPanel.jsx                          — selected-overlay property editor
    AIReviewPanel.jsx                   ~80 lines — AI suggestion accept/reject UI
    RoomAnalysisPanel.jsx                    — per-room analysis display
    MeasurementSummary.jsx                   — takeoff totals
    OverlayLayer.jsx                         — SVG overlay rendering
    ScaleCalibrationPanel.jsx                — 2-point scale calibration UI
    PushToEstimatorPanel.jsx                 — takeoff → quotation bridge
    aiDetectionService.js                    — client for /api/ai/plan-detect, /api/ai/plan-orientation
    takeoffTypes.js                          — TOOLS/OT/STYLE/FLOOR_FINISHES/WALL_TYPES/LEVELS constants
    takeoffUtils.js                          — pure geometry (distance, polygon area, snap, rotation) + localStorage helpers
  gantt/                                     — embedded Gantt tab (used only by EstimateBuilderWorkbook.js)
    GanttBuilderPage.jsx                ~100 lines — orchestrator
    GanttChart.jsx                           — timeline renderer
    ScheduleReviewTable.jsx                  — pre-commit task review
    AIScheduleService.js                ~100 lines — client for /api/ai/generate-schedule
    ganttTypes.js                            — DEFAULT_STAGES, PROCUREMENT_TYPES, CONFIDENCE, task factory
    ganttUtils.js                            — task storage + dependency resolution (localStorage)

hooks/estimate-builder/
  useEstimateBuilderWorkbook.js       6,501 lines — master workbook state, page/tab management, data model

hooks/
  useJobFile.ts                        309 lines — NEW/untracked. File-open/save/save-as/recent/autosave hook

lib/
  jobFile.ts                           277 lines — NEW/untracked. FileSystemAccess wrapper + download fallback

lib/construction-estimation/          (30+ files, ~30K lines combined)
  estimateWorksheetV4Schema.js               — V4_PAGES, V4_DATA_SECTIONS, required fields, subcontractor deductions
  estimateWorksheetV4Calculations.js    788 lines — core formula engine (verified count; agent draft said 2,330 — corrected)
  estimateBuilderWorkbookCalculations.js     — linked/derived calculations
  estimateBuilderWorkbookDefaults.js         — default workbook shape
  estimateWorksheetV2*.js, V3*.js            — deprecated prior schema versions, still present
  areaCalculationEngine.js, quantityEngine.js, finalQuantityEngine.js, detailedQuantityEngine.js
  windowDoorApproximatePricing.js, windowDoorCalculations.js, humeEntryDoorPricing.js
  takeoffEngine.js                           — merges AI/manual takeoff overlays into quotation quantities
  durationEngine.js, assemblyEngine.js, procurementEngine.js
  inputDataSheetTemplate.js/.json, importedExcelWorkbookTemplate.json, appliancePackageRows.json, windowsDoorsWorkbookRows.json

pages/modules/estimate-builder/
  index.js            — entry point; mode query param (preview | open-job | open-recent) passed into EstimateBuilderWorkbook
  register-job.js     — job registration form (localStorage credits/pending job)
  buy-credits.js       — credit purchase UI
  payment.js           — payment flow stub
  recover-template.js  — template recovery

pages/modules/construction/index.js  — "Projects Hub": links to Job Board, Gantt, Production Flow (separate modules)
  and to Estimate Builder Preview / Register Job / Open Existing Job / Recent Jobs list (estimate-builder scope)

data/
  pricing.js           — module subscription pricing + credit packs (modified, shared across modules — DO NOT TOUCH broadly)
  platformPricing.js   185 lines — NEW/untracked, platform bundle tiers, unclear integration point yet
```

## 2. Data Flow

`PDF Upload → Plan Viewer → Scale Calibration → Takeoff → (optional AI detect) → Push to Quotation → Pricing/Quote → Gantt`

1. **Upload** (`PDFUploadPanel.jsx`): loads PDF.js from CDN at runtime (not an npm dependency), rasterizes each page to a canvas at 2x scale, stores `page = { id, imageDataUrl, naturalWidth, naturalHeight, pdfPageRotation, scale, overlays[] }`.
2. **View/Calibrate** (`PlanCanvas.jsx` + `ScaleCalibrationPanel.jsx`): SVG-rendered background image with pan/zoom/rotate; user draws a 2-point reference line and enters real-world distance → `pixelsPerMetre` stored per-page.
3. **Takeoff** (`PlanCanvas.jsx` + toolbar): manual drawing tools (walls, rooms, doors, windows, columns, area, measure) produce `overlay = { id, type, points[], status: suggested|edited|confirmed, source, confidence }`, held in `state.pages[i].overlays[]`, autosaved to `localStorage["gr8:takeoff:v1"]`.
4. **AI Detection** (optional, `AIReviewPanel.jsx` → `aiDetectionService.js` → `/api/ai/plan-detect`, GPT-4o vision): returns candidate walls/rooms/doors/windows with confidence; merged into overlays without clobbering user edits.
5. **Push to Quotation** (`PushToEstimatorPanel.jsx` → `takeoffEngine.js`): converts confirmed overlays into room/opening counts feeding the Data Input sheet.
6. **Quotation** (`estimateWorksheetV4Calculations.js`, `estimateBuilderWorkbookCalculations.js`): qty × rate per line item, subcontractor deductions, margin, GST → totals.
7. **Gantt tab** (`GanttBuilderPage.jsx` → `AIScheduleService.js` → `/api/ai/generate-schedule`): summarizes the workbook, gets back a task list with dependencies, stored to `localStorage["gr8:gantt:v1"]`.

## 3. Storage Mechanism

Entirely client-side today — **no Supabase table backs the Estimate Builder module itself.**

- `localStorage["gr8:takeoff:v1"]` — array of takeoff projects (pages, overlays, plans)
- `localStorage["gr8:gantt:v1"]` — array of embedded-Gantt-tab projects (draft/approved schedules)
- `localStorage["gr8-job-recent-files"]` — recent-file metadata (id, jobName, clientName, fileName, lastModified)
- `IndexedDB["gr8-job-file-handles"]` (store `handles`) — persisted `FileSystemFileHandle` objects, keyed by id
- `localStorage["estimate-builder-credits"]` — job credit balance
- `localStorage["estimate-builder-registered-jobs"]` — registered jobs list
- **`.gr8job` file** (via `lib/jobFile.ts` + `hooks/useJobFile.ts`, File System Access API with download-fallback): the actual save/save-as unit is a JSON file: `{ jobName, clientName, jobNumber, address, notes, rooms[], products[], pricing{}, created, lastModified, workbook{...} }`. Autosave debounces ~3s.

Correction to initial draft of this report: a Supabase-backed system **does** exist for the **separate, out-of-scope** Gantt/Job Board modules — tables `gantt_projects`, `gantt_tasks`, `gantt_contacts`, `gantt_delays` (see `supabase/migrations/20260605_gantt_*.sql`, `20260606_gantt_*.sql`), written via `pages/api/gantt/send-delay-update.js` and `send-work-orders.js`. This is unrelated to the embedded Gantt tab's `localStorage` persistence and unrelated to Estimate Builder job storage. Flagging so the rebuild doesn't assume Estimate Builder has zero backend precedent in this codebase — there's a working pattern to reference for `/modules/jobboard`-style Supabase persistence, even though Estimate Builder itself doesn't use it yet.

No `jobs`, `estimates`, `estimate_items`, or `takeoff_overlays` tables exist in `supabase/migrations/`. Any such tables mentioned in a prior draft of this report were speculative, not verified — disregard.

## 4. Existing Reusable Components (candidates to carry into the rebuild)

- **`lib/jobFile.ts` + `hooks/useJobFile.ts`** — File System Access API wrapper with open/save/save-as/recent-files/autosave, download fallback for unsupported browsers. Generic, not estimate-specific. Appears complete and freshly written (currently mid-integration into `EstimateBuilderWorkbook.js`). **Strong candidate to reuse as-is** in the new module's `storage/` layer — this is exactly the file-based job storage Phase 2 of the directive asks for.
- **`takeoffUtils.js`** — dependency-free geometry (distance, polyline length, polygon area, rotation, snapping). Reusable for the new `measurement/` layer.
- **PDF.js loading pattern** (`PDFUploadPanel.jsx` lines 7–37) — works, but loads v3.11.174 from a CDN at runtime rather than as an npm dependency (`pdfjs-dist` is not in `package.json`). For the rebuild this should become a proper npm dependency instead of a CDN `<script>` injection (more reliable offline/CSP behavior, version pinning via lockfile).
- **SVG-based canvas approach** (`PlanCanvas.jsx`) — no canvas library dependency (not Konva/Fabric/native-canvas); pan/zoom/rotate via SVG `transform`. Works but is a 1,109-line monolith mixing rendering, hit-testing, and tool-state. The *approach* (SVG, no heavy canvas lib) is reasonable to keep; the *implementation* should be decomposed, not ported wholesale.
- **`estimateWorksheetV4Calculations.js`** and the rest of `lib/construction-estimation/` — this is the pricing/formula engine and is explicitly what Phase 6 ("Connect measurements to pricing") depends on. It is NOT part of "Estimate Builder" UI/viewer/takeoff code — it's the pricing domain logic. Recommend treating it as a stable dependency to keep calling into, not something to rebuild, unless it proves to be the source of the current instability.
- **`/api/ai/plan-detect`, `/api/ai/plan-orientation`, `/api/ai/generate-schedule`** — working AI endpoints, framework-agnostic on the client side. Reusable.

## 5. Existing APIs touched by this module

| Route | Method | Purpose |
|---|---|---|
| `/api/ai/plan-detect` | POST | GPT-4o vision: detects walls/rooms/doors/windows from a plan image |
| `/api/ai/plan-orientation` | POST | Detects/scores plan rotation |
| `/api/ai/generate-schedule` | POST | Generates Gantt task list from a workbook summary |
| `/api/gantt/send-delay-update.js`, `/api/gantt/send-work-orders.js` | POST | Belong to the **separate** Job Board/Gantt Supabase-backed system, not Estimate Builder — listed for completeness since the code lives near the embedded Gantt tab's naming, but out of scope. |

No save/load API exists for Estimate Builder jobs — persistence is 100% client-side (file + localStorage), which is consistent with `useJobFile.ts` being a from-scratch, backend-independent design.

## 6. Existing Database Tables

None for Estimate Builder. (See §3 correction re: `gantt_projects`/`gantt_tasks`/`gantt_contacts`/`gantt_delays`, which belong to the separate, out-of-scope Job Board module.)

## 7. PDF Library

**PDF.js v3.11.174**, loaded from `cdnjs.cloudflare.com` at runtime — not an npm dependency. `pdf-lib` is in `package.json` but is used elsewhere for PDF *generation*, not viewing, and is not used by this module.

## 8. Canvas Library

None. `PlanCanvas.jsx` is raw SVG + DOM pointer events, no Konva/Fabric/Three.js. `fabric` v5.5.2 exists in `package.json` but is used by the Website Builder, not Estimate Builder.

## 9. In-Progress / Uncommitted Work (current git status)

Modified (mid-refactor, uncommitted):
- `components/estimate-builder/EstimateBuilderWorkbook.js`
- `components/estimate-builder/ai-takeoff/{AIPlanTakeoffPage.jsx, PDFUploadPanel.jsx, PlanCanvas.jsx, TakeoffToolbar.jsx}`
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js`
- `data/pricing.js`

New/untracked (appear to be a **complete, not-yet-fully-wired feature**: job file management):
- `hooks/useJobFile.ts`, `lib/jobFile.ts` — File System Access-based save/open/recent/autosave, referenced from `EstimateBuilderWorkbook.js`
- `data/platformPricing.js` — platform bundle tier data, integration point not yet clear from the estimate-builder code path

This matches the directive's premise ("unreliable after multiple iterations") — there's a half-landed job-file-management feature sitting on top of an already-large `EstimateBuilderWorkbook.js` (5,454 lines) / `useEstimateBuilderWorkbook.js` (6,501 lines) pair that mixes tab orchestration, workbook data model, and now file I/O concerns in two files.

---

## What should be reused

- `lib/jobFile.ts` + `hooks/useJobFile.ts` (job file save/open/recent/autosave) — closest thing to Phase 2 already built; adopt into the new `storage/` layer with minimal changes.
- `takeoffUtils.js` geometry functions — pure, dependency-free, portable into `measurement/utils/`.
- `lib/construction-estimation/**` (pricing/formula engine) — out of scope for rebuild; keep as the `pricing/` and `services/` dependency the new module calls into, unless investigation during Phase 6 finds it's actually the source of instability.
- The AI endpoints (`/api/ai/plan-detect`, `plan-orientation`, `generate-schedule`) — keep as-is, client-agnostic.
- The SVG-without-heavy-canvas-lib *strategy* — validated approach, worth keeping conceptually even though the concrete `PlanCanvas.jsx` implementation should not be ported wholesale.

## What should be discarded (archived, not ported)

- `EstimateBuilderWorkbook.js` (5,454 lines) and `useEstimateBuilderWorkbook.js` (6,501 lines) as monoliths — these conflate tab routing, the entire workbook data model, and (now) file I/O in two files. This pairing is almost certainly the core of "unreliable after multiple iterations." Rebuild as the `state/`, `components/`, and `models/` layers per the new structure.
- `PlanCanvas.jsx` (1,109 lines) as a single file — rebuild into the new `viewer/` + `measurement/` split (rendering vs. tool/hit-test logic vs. state).
- PDF.js-via-CDN-`<script>` loading — replace with an npm dependency (`pdfjs-dist`) in the new `viewer/`.
- `estimateWorksheetV2*.js` / `V3*.js` deprecated schema versions still sitting in `lib/construction-estimation/` — dead weight, archive alongside v1 of the UI.
- `data/platformPricing.js` — new, uncommitted, and its integration point isn't yet established anywhere in the estimate-builder code path; needs a decision before Phase 1, not a silent carry-forward.

---

**Awaiting approval before proceeding to Phase 1 (Foundation).** No code has been changed as part of this discovery.
