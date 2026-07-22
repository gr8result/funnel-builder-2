# Takeoff Regression Restoration Audit

Date: 2026-07-22

## Phase 1 Audit

1. Last known working commit for the live zoom/pan/scale workflow: `e629318` (`Update website builder estimate builder and platform modules`, 2026-07-15). This commit contains the live `AIPlanTakeoffPage` wired into `EstimateBuilderWorkbook`, with `PlanCanvas` providing fit-to-view, wheel zoom, panning, calibration preview, measurement overlays and persisted view state.
2. Exact live files used in that version:
   - `components/estimate-builder/EstimateBuilderWorkbook.js`
   - `components/estimate-builder/ai-takeoff/AIPlanTakeoffPage.jsx`
   - `components/estimate-builder/ai-takeoff/PDFUploadPanel.jsx`
   - `components/estimate-builder/ai-takeoff/PlanCanvas.jsx`
   - `components/estimate-builder/ai-takeoff/ScaleCalibrationPanel.jsx`
   - `components/estimate-builder/ai-takeoff/TakeoffToolbar.jsx`
   - `components/estimate-builder/ai-takeoff/takeoffTypes.js`
   - `components/estimate-builder/ai-takeoff/takeoffUtils.js`
   - `components/estimate-builder/ai-takeoff/planCoordinateUtils.js`
   - `components/estimate-builder/ai-takeoff/pdfPlanRendering.js`
   - `components/estimate-builder/ai-takeoff/aiTakeoffPersistence.js`
3. Files later modified or replaced:
   - `0a49e39` replaced the live `AIPlanTakeoffPage.jsx` with a wrapper around `../takeoff-engine/components/TakeoffWorkspace`.
   - The current worktree has `components/estimate-builder/takeoff-engine/components/TakeoffWorkspace.tsx`, `PlanViewport.tsx`, `PlanToolbar.tsx`, `PlanPageList.tsx`, `PropertiesPanel.tsx`, `ProcessingStatus.tsx`, the interaction controllers, renderers and repository files deleted.
   - The current worktree has a restored `AIPlanTakeoffPage.jsx`, plus rotation-related edits in `PDFUploadPanel.jsx`, `PlanCanvas.jsx`, `pdfPlanRendering.js` and `takeoffTypes.js`.
4. Working components still present:
   - Live manual canvas: `components/estimate-builder/ai-takeoff/PlanCanvas.jsx`.
   - Live scale panel: `components/estimate-builder/ai-takeoff/ScaleCalibrationPanel.jsx`.
   - Live persistence helpers: `components/estimate-builder/ai-takeoff/aiTakeoffPersistence.js` and `takeoffUtils.js`.
   - Live PDF renderer: `components/estimate-builder/ai-takeoff/pdfPlanRendering.js`.
   - Separate dev viewer path: `components/estimate-builder/takeoff-engine/viewer/TakeoffViewer.jsx`, `TakeoffCanvas.jsx`, `TakeoffControls.jsx`.
5. Components no longer mounted:
   - `components/estimate-builder/takeoff-engine/workbook/TakeoffEngineWorkbookPage.jsx` has no production importer.
   - `components/estimate-builder/takeoff-engine/components/TakeoffWorkspace.tsx` was mounted by the broken `AIPlanTakeoffPage.jsx` in `0a49e39`, but is deleted in the current worktree.
   - The deleted `takeoff-engine/components/*`, `interactions/*`, `rendering/*`, `processing/*` and `persistence/*` TypeScript files are not mounted by the restored live `ai-takeoff` workflow.
6. Likely root cause:
   - The live Estimate Builder page was redirected from the mature `ai-takeoff` implementation into a newer `takeoff-engine` workspace in `0a49e39`.
   - That replacement path was incomplete and then partially deleted, disconnecting the known-good PDF upload, fit, zoom, pan, calibration and measurement workflow.
   - Rotation also regressed because multiple fields (`metadataRotation`, `detectedRotation`, `userRotation`, `finalRotation`, `planRotation`) could be combined or applied to an already-rasterized image instead of using one authoritative `page.rotation` in PDF.js rendering.
7. Safest restoration approach:
   - Keep the live `EstimateBuilderWorkbook -> AIPlanTakeoffPage -> PlanCanvas` mounting path.
   - Use `page.rotation` as the authoritative 0/90/180/270 value.
   - Render initial PDF imports unrotated, with automatic orientation disabled.
   - On manual rotate, re-render PDFs from the original PDF data URL through PDF.js with `page.rotation`.
   - Keep saved points in page coordinates and expose `screenToPagePoint` / `pageToScreenPoint` as explicit aliases over the existing plan-coordinate transform.
   - Leave AI detection and automatic orientation out of this restoration.

## Phase 2 Restoration

Changed files:
 - `components/estimate-builder/ai-takeoff/PDFUploadPanel.jsx`
 - `components/estimate-builder/ai-takeoff/planCoordinateUtils.js`
 - `components/estimate-builder/ai-takeoff/planCoordinateUtils.test.mjs`

Existing restored files from the current worktree that remain part of the fix:
 - `components/estimate-builder/ai-takeoff/AIPlanTakeoffPage.jsx`
 - `components/estimate-builder/ai-takeoff/PlanCanvas.jsx`
 - `components/estimate-builder/ai-takeoff/pdfPlanRendering.js`
 - `components/estimate-builder/ai-takeoff/takeoffTypes.js`

Restored behavior:
 - Initial PDF import renders at `page.rotation = 0` without automatic orientation analysis.
 - Initial image import also starts unrotated.
 - Manual PDF rotation uses `page.rotation`, re-renders from the original PDF data URL, and stores the same value on the plan/page compatibility fields.
 - Width and height are refreshed from the PDF.js rotated viewport metadata.
 - Calibration and measurements continue to use saved page coordinates.
 - `screenToPagePoint` and `pageToScreenPoint` are now explicit exported functions.

## Verification

Passed:
 - `node components/estimate-builder/ai-takeoff/planCoordinateUtils.test.mjs`
 - `node components/estimate-builder/ai-takeoff/pdfPlanRendering.test.mjs`
 - `node components/estimate-builder/ai-takeoff/aiTakeoffPersistence.test.mjs`
 - `npx tsc --noEmit`
 - `npm run lint` exits 0, with existing warnings elsewhere in the app.

Browser acceptance not completed:
 - No supplied plan PDF exists in the workspace (`rg --files -g "*.pdf"` returned none).
 - `http://localhost:3000/modules/estimate-builder` redirects to `/login?redirect=/modules/estimate-builder` in the local browser session.
 - Local dev bypass credentials are not configured in `.env.local` or `.env`.
 - Because of that, screenshots for manual rotation, calibration line, verified measurement, save/reload and page-switch persistence could not be captured in this environment.

Stop point:
 - No OCR, wall detection, windows, doors, rooms, UI redesign or automatic orientation work was added.
