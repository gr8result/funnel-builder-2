# Phase 1: canonical canvas admission

This folder converts externally supplied detections into the active manual
Takeoff's objects. It performs no AI/network request, PDF analysis, quotation
update, or database write. `AIPlanTakeoffStandalone` remains the canvas owner.

## Adapter contract

`convertAiTakeoffDetections(batch, context)` is pure and throws on invalid input.
It validates the whole batch before the bridge commits any objects.

```js
const context = {
  jobId: 'current-job-id',
  takeoffId: 'current-takeoff-id',
  documentHash: 'canvas-sha256:...',
  pixelsPerMm: 0.1, // the existing global calibration; required, positive
  pages: [{ pageNumber: 1, logicalWidth: 1200, logicalHeight: 900 }],
  completedWallRuns: [], // current walls, for optional existing-host references
};

const batch = {
  jobId: context.jobId,
  takeoffId: context.takeoffId,
  documentHash: context.documentHash,
  runId: 'stable-analysis-run-id',
  modelVersion: 'producer-version',
  detections: [{
    detectionId: 'wall-1', // unique across the batch
    kind: 'wall',
    page: 1,              // positive integer, never a string
    confidence: 0.95,     // finite number in [0, 1]
    coordinates: { space: 'logical' },
    nodes: [{ x: 120, y: 180 }, { x: 520, y: 180 }],
    category: 'exterior',
    thicknessMm: 230,
    alignment: 'outer',
    exteriorType: 'Face Brick Veneer',
  }],
};
```

Coordinate modes are `logical` (unchanged scale-1 PDF viewport units),
`normalized` (full-page fractions from 0 to 1), or `image` (full-page raster
pixels, with required positive `coordinates.width` and `coordinates.height`).
All origins are top-left, X right, Y down. Out-of-bounds/nonfinite coordinates
are rejected. Crops, extra transforms, rotation metadata and mixed scales are
not supported in this phase. Optional supplied `pixelsPerMm` must match the
current global calibration. Never send zoomed screen coordinates.

Supported detections:

| `kind` | Required kind-specific fields | Output |
|---|---|---|
| `wall` | `nodes` (at least two distinct consecutive points), `category` (`exterior`/`interior`), `thicknessMm`, `alignment` (`outer`/`inner`) | `completedWallRuns` |
| `opening` | `x,y` or one-node `nodes`, `type` (`window`/`door`), `openingClass`, positive `widthMm,heightMm`, exactly one of `hostDetectionId` (batch wall) or `hostWallId` (existing wall) | `placedOpenings` |
| `floorplan` | `type` (`Footprint`, `Living`, `Garage`, `Alfresco`, `Patio`, `Balcony`, `Other`), polygon `nodes` | `completedFloorplans` |
| `area` | `category` (`Tiles`, `Hybrid`, `Carpets`, `Polished Concrete`, `exposed Agg`, `Roof Area`), polygon `nodes` | `completedAreas` |

Walls use the canvas's standard thicknesses: 70, 90, 100, 110, 140, 150, 200,
230, 270, 300, 350 mm. Optional exterior classes use `EXTERIOR_WALL_CLASSES`;
the default is `Other`. `linedFaces` defaults to 2,
`openingDeductionsEnabled` to true, and `wallHeightM` to null. Supplied
`lengthMm` is ignored: length is always computed from converted nodes divided
by the existing calibration. All eleven manual wall fields are emitted.

Opening classes are `Window`, `Internal Door`, `External Door`, `Garage Door`,
`Large Glazed/Stacker/Sliding Door` and `Other Opening`. `window` requires
`Window`; `door` requires one of the other classes. Host walls must exist on the
same numeric page, with compatible explicit levels. Optional string fields are
`itemTag`, `subType`, `glassType`, `frameMaterial`, `frameColour`, `sillType`,
`location` and `frameJambDetails`. The tag defaults to `W AI <detectionId>` or
`D AI <detectionId>`, subtype to `standard` for a window or its door class, and
other strings to empty. Optional `brickSillRequired` defaults to false. Each
opening represents one editable object, not an aggregate count. Existing load
normalization may add the usual `openingType` alias; it preserves AI metadata.

Polygons need three non-collinear vertices, no repeated closing vertex and no
self-intersection. Floorplan colours/labels match the manual tool. Finish
`exclusions: [{nodes}]` must be wholly internal and non-overlapping; roof
exclusions are rejected because the existing roof schedule does not deduct
them. Optional `level` is `Ground Floor`, `Second Level`, `Third Level` or
`Unassigned`; roofs default to `Unassigned`. There is no semantic
room inference or automatic floor classification. Callers must avoid submitting
overlapping aggregate and detailed Living polygons as separate quantities.

The result always has these six arrays:

```js
{
  completedWallRuns, placedOpenings, completedFloorplans, completedAreas,
  completedMeasurements: [], completedEaves: []
}
```

Measurement/eave detection conversion is not implemented in Phase 1. The bridge
already routes all six canonical collection slots to their existing setters.
Every converted object retains `source: 'ai'`, numeric `confidence`, and
`ai: {runId, detectionId, documentHash, sourcePage, modelVersion}`. IDs encode
job, takeoff, document, run, kind and detection identity deterministically.

## Bridge and persistence

`useAiTakeoffBridge` receives the current identity, loaded pages, global
calibration, six collections, six existing setters, lifecycle and completion
callback. `getContext()` verifies the loaded document; `appendDetections(batch)`
validates, checks identity again after asynchronous hashing, and performs only
functional appends. It resolves to `{status: 'appended', added: number}` or
`{status: 'duplicate', added: 0}`; invalid admission rejects with an error before
any collection update. It does not modify page, view, rotation, selection, tools or
unfinished drawings. It marks the normal canvas draft dirty.

`documentHash` fingerprints page PNG content and logical dimensions. It is the
identity of the actual saved canvas document, not a claimed original-PDF hash.
All images must be materialized first. Replacing a plan, changing calibration,
switching jobs, or closing during verification rejects the pending request.

Applied run receipts are retained in the existing canonical
`scheduleState.aiAppliedRuns`, scoped to job/takeoff/document/run. A replay adds
nothing, including after an AI object was edited or deleted and the job
reopened. Receipts are included in existing content checksums only when present;
legacy jobs retain their prior checksum shape. New jobs/replacement uploads
clear receipts; ordinary edits/deletions preserve them. No second persistence
system is introduced. Save/load, canonical workbook/mirror and portable files
continue to use the current pipeline. Canvas autosave remains disabled.

## Development action and acceptance

In a development build, opt in with `?aiTakeoffDevelopment=1` or the component
prop `enableAiTakeoffDevelopment`. `DEV / TEST: Inject AI fixture` adds two
exterior walls, one interior wall and one hosted window on the current page.
It uses `developmentFixture` -> bridge -> adapter -> existing canvas setters. The fixture action is absent
in production builds and is not a RUN AI TAKEOFF implementation.

Run:

```text
node scripts/test-takeoff-ai-adapter.mjs
node scripts/test-takeoff-ai-persistence.mjs
node scripts/test-takeoff-ai-bridge.mjs
node scripts/test-takeoff-ai-canvas-browser.mjs
```

The browser test uses the actual component, workbook hook, normal Save callback
and IndexedDB persistence in an isolated Chromium profile with a synthetic job.
It exercises real pointer selection, wall-vertex edits, deletion, manual drawing,
schedule quantities, close/reopen and page reload. Evidence is written under
`artifacts/test-artifacts/takeoff-ai-canvas/`. It never opens user job storage.

## Plan-set evidence, automatic resolution and the builder review

A floor plan is never analysed as an isolated image.

1. **Evidence pass** (`action: 'evidence'`, `planEvidence.js`). Before any sheet is measured, every
   sheet of the plan set (schedules, elevations, sections, details, floor plans, site plan) is read
   together, a few sheets per request, for: each level's external wall system and finish, ceiling
   height, frame sizes, any window/door schedule, the plan set's size-code convention, door height,
   eave width and roof pitch. A supporting sheet read upside-down takes the floor plans' orientation.
2. **Measurement** receives that evidence plus the Job Setup construction defaults
   (`projectDefaultsFromJobSetup`) in both halves (geometry and items).
3. **Resolution order** in `normalizePlanAnalysis`: what the sheet itself shows, then plan-set
   evidence (DERIVED), then the Job Setup default (ASSUMED), then unknown. Unknown is never guessed.
4. **Calibration.** The estimator's calibration is authoritative. `scheduleState.sheetCalibrations`
   records which sheet each calibration was measured on; other sheets use the takeoff calibration.
   Two sheets calibrated to different scales are a conflict, not an average (the canvas still
   measures with one calibration).
5. **What the estimator already measured is authoritative.** An AI detection of a wall, opening or
   area already in the takeoff is not added. On a sheet whose walls or openings are already
   measured, unmatched AI detections are not added either: a position read off a drawing image is
   only good to roughly a metre. They are put to the builder instead.
6. **Review** (`reviewSummary.js`). Every entry in `analysis.review` carries
   `audience: 'decision' | 'diagnostic'`. `buildTakeoffReview` derives the builder's decisions from
   the takeoff as it stands now (one item per question, however many walls are behind it) and
   returns `{ checklist, decisions, diagnostics }`. Both screens use it through
   `createJobSetupPayload(...).review`. Only decisions reach `payload.warnings`.

Tests: `scripts/test-takeoff-review-and-evidence.mjs`, `scripts/test-takeoff-review-screens.mjs`
(both need the extensionless and JSON loaders). `scripts/run-ai-takeoff-plan-set.mjs` runs the real
pipeline against a saved takeoff's plan set outside the browser; it spends provider credit unless
`--replay --offline` is given.
