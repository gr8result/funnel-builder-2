# Takeoff Legacy — Recovery Record

Archived: 2026-07-22, as part of the Takeoff Engine V2 rebuild. This is a **read-only reference copy**. The live code is still at its original location and is untouched by this archive.

## Provenance

- Branch at time of archive: `restore/working-takeoff-engine`
- Commit at time of archive: `03ba8fb45c4763e099e568fe549181ec5727a903` ("Backup current broken takeoff engine")
- Safety branch pointer created at that commit: `safety/pre-takeoff-v2-20260722`
- This copy reflects the **working-tree state at archive time**, including uncommitted edits — i.e. the actual broken behavior being replaced, not just the last commit.

## What's archived

- `ai-takeoff/` — copy of `components/estimate-builder/ai-takeoff/`. This is the **live production implementation**, wired into `components/estimate-builder/EstimateBuilderWorkbook.js` (imports at line 37-38, mounted at line ~800 as `<AIPlanTakeoffPage sheet={sheet} />`). Do not delete the original — it is still serving production traffic.
- `takeoff-engine/` — copy of `components/estimate-builder/takeoff-engine/`. A parallel, unfinished rebuild attempt. Only ever wired into a dev-only route, `pages/dev/takeoff-engine-test.jsx` — never reached production. As of the archive commit, its TypeScript architecture layer (`components/`, `detections/`, `interactions/`, `persistence/`, `processing/`, `rendering/`, `state/takeoffStore.ts`, `state/takeoffTypes.ts`) had already been deleted from both disk and the git index in the working tree — those files are **not** in this archive. They are only recoverable via `git show 03ba8fb:components/estimate-builder/takeoff-engine/<path>` and are treated as abandoned, not reused.

## Storage / persistence (why it broke)

- **No database table and no storage bucket back this feature at all.** Everything persists to a single browser `localStorage` key, `gr8:takeoff:v1` (see `ai-takeoff/takeoffUtils.js`), holding the entire project — every plan and every page, including full-resolution page images as base64 data URLs — as one JSON blob, saved by filtering the array and pushing a replacement (`saveProject()`). There is no per-page save boundary, which is the most likely mechanism behind "saved state overwrites live state."
- Uploaded PDF bytes are kept only in memory / as a data URL passed around React props (`originalFileUrl`) — never uploaded to a server endpoint. PDF rendering happens entirely client-side.

## Rotation (why it broke)

Six separate rotation fields were carried per page and per plan, meant to be kept in sync by hand at every call site in `PDFUploadPanel.jsx`:

- `metadataRotation` — from PDF metadata
- `detectedRotation` — from automatic orientation analysis
- `userRotation` — from manual rotate clicks
- `finalRotation` — a derived "resolved" value
- `rotation` — often but not always kept equal to `finalRotation`
- `planRotation` — mirrored onto the plan record separately from the page record

Multiple same-day sessions today already tried to consolidate these (see `docs/manual-pdf-rotation-audit.md`, `docs/takeoff-regression-restoration-audit.md` at repo root) by designating `page.rotation` authoritative, but left the other five fields populated "for compatibility," which keeps the underlying ambiguity alive. V2 does not carry any of these fields — `page.rotation` is the only one that exists.

## External dependencies

- PDF.js is **not** an npm package here — it's loaded at runtime via a `<script>` tag injected pointing at `cdnjs.cloudflare.com/ajax/libs/pdf.js/<version>/pdf.min.js` (see `ai-takeoff/pdfPlanRendering.js`, `takeoff-engine/import/pdfToRaster.js`). Requires network access even in local dev.
- AI detection calls `POST /api/ai/plan-detect` (`pages/api/ai/plan-detect.js`, GPT-4o vision) — not used by V2 until Phase 12.

## Full file inventory at archive time

`ai-takeoff/` (20 files): `AIPlanTakeoffPage.jsx`, `AIReviewPanel.jsx`, `MeasurementSummary.jsx`, `ObjectPanel.jsx`, `PDFUploadPanel.jsx`, `PlanCanvas.jsx`, `PushToEstimatorPanel.jsx`, `RoomAnalysisPanel.jsx`, `RoomPanel.jsx`, `ScaleCalibrationPanel.jsx`, `TakeoffToolbar.jsx`, `aiDetectionService.js`, `aiTakeoffPersistence.js`, `aiTakeoffPersistence.test.mjs`, `pdfPlanRendering.js`, `pdfPlanRendering.test.mjs`, `planCoordinateUtils.js`, `planCoordinateUtils.test.mjs`, `takeoffTypes.js`, `takeoffUtils.js`.

`takeoff-engine/` (36 files as of the archive commit, minus the already-deleted TS layer noted above): `analysis/{drawingBoundsAnalysis,imageOrientationAnalysis,imageTextAnalysis,titleBlockDetection}.js`, `core/{geometry,measurement,orientation,scale,snapping,types,viewTransform}.js`, `import/{imageNormalizer,pdfToRaster,scaleTextDetection}.js`, `state/{takeoffPersistence,takeoffReducer}.js`, `tests/*.test.mjs` (13 files), `tools/{AreaTool,MeasureTool,ScaleTool}.jsx`, `viewer/{TakeoffCanvas,TakeoffControls,TakeoffViewer}.jsx`, `workbook/TakeoffEngineWorkbookPage.jsx` (confirmed orphaned — zero importers anywhere).

## Recovery

To inspect the pre-deletion `takeoff-engine` TS architecture layer:

```
git show 03ba8fb:components/estimate-builder/takeoff-engine/components/TakeoffWorkspace.tsx
```

(substitute any path from the deleted set above). To restore the whole legacy tree to a working directory for comparison:

```
git worktree add ../takeoff-legacy-compare 03ba8fb
```
