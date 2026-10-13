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

## Geometry from the drawing, plan reading as labels (plan-geometry-4)

Where a wall, opening or room boundary *is* comes from the sheet's own linework
(`geometry/planGeometry.js`); the plan reading supplies what the lines cannot say. `geometry/lineworkFusion.js`
joins the two for one sheet and returns a response in the contract's own shape, so the contract, the
adapter and the canvas are unchanged.

1. **Raster** (`geometry/planRaster.js`). A calibrated sheet is brought to about 0.09 image pixels per
   millimetre, up or down, before it is measured. Pages are stored at whatever the screen's pixel
   ratio gave when the plan was loaded; without this the same plan read differently on two machines.
2. **Walls.** Two long parallel faces a wall-thickness apart. Walls drawn at 45 degrees are found by
   re-indexing the sheet along its diagonals and kept only where they meet other wall.
3. **External or internal.** The outside is what a 1.5 m disc can reach from the edge of the drawing
   without crossing wall fabric or a gap in it. A wall with the outside against a face is external.
   The plan reading's own external/internal call is not used; a disagreement is reported.
4. **Openings.** A gap is a doorway when a door swing is drawn at it (the leaf is the swing radius) or
   an opening is located there. A frame drawn in an external wall is a window. The plan reading locates
   openings only to a metre or two, so its openings are matched to gaps and frames one to one by
   distance and width; what it missed but the drawing shows is added, flagged for class and height.
5. **Rooms.** A space the walls and confirmed openings enclose is measured (inside faces). Room names
   are assigned to spaces by least total distance, with size sanity (a WC is never 20 m2); names that
   share one unwalled space are returned as one open-plan room. The takeoff screen uses these
   boundaries as measured (`detectRoomBoundary`, `detectionMethod: 'wall-linework'`). "Re-measure from
   linework" in the rooms panel repeats this without a provider request, keeping confirmed and
   hand-edited boundaries.

Not measured from linework: walls at angles other than 0, 45 and 90 degrees, curved walls, door and
window heights and types, and outdoor areas (alfresco, patio, balcony), which have no enclosing walls.
Walls and openings use the takeoff's one shared calibration; only rooms follow a sheet's own.

Tests: `scripts/test-plan-geometry-engine.mjs`, `-stages.mjs`, `-fusion.mjs` (drawings with known
measurements), `scripts/test-takeoff-three-levels.mjs`, and on the recovered New Job 03/09 plans (skipped
when the recovery folder is absent): `scripts/test-plan-geometry-regression.mjs`,
`scripts/evaluate-linework-fusion.mjs` (saved provider responses, offline) and
`scripts/test-takeoff-real-plan-replay-browser.mjs` (the actual screen with those responses replayed).

## plan-geometry-5: per-sheet scale, doors from the drawing, review grading (2026-10-13)

- **Scale per sheet** (`sheetScale.js`). A sheet calibrated on its own is measured at that scale; every
  other sheet at the job scale, recorded as sheet 0 the first time any sheet is calibrated. The canvas
  works at the scale of the sheet on screen. The schedule and Job Setup builders restate geometry on a
  differently scaled sheet before measuring (`toCommonScale`), so nothing depends on which sheet is on
  screen. Recalibrating a sheet restates the stored run lengths of the sheets that follow that scale and
  no others. The contract and adapter measure each detection at its sheet's scale.
- **Doors.** A swing drawn at a gap confirms a doorway; a door drawn closed in its wall is found by its
  swing alone (a quarter circle and no more, one thin line through clear floor); a door-width gap
  between two ends of one wall is an opening whatever fills it (`basis: 'aligned-wall-ends'`).
- **Assignment.** Reported openings are assigned to measured gaps, frames and swings in one pass over
  the sheet (distance, kind, side of the building, either reading of a size code). An opening the
  linework does not show is **held**, never placed at the plan reading's coordinates or snapped to the
  nearest wall. A room the linework gives no boundary keeps its name only: a boundary the plan reading
  drew is not passed on.
- **Outdoor areas.** An alfresco, patio or balcony drawn as a closed outline is measured to that outline
  (`traceOutlinedArea`, `detectionMethod: 'drawn-outline'`), always flagged; an open-sided one gets none.
- **Built-in robes** carry `robeOf` (their bedroom) and take its floor finish unless given their own.
- **Review.** Fusion findings carry codes; `groupReviewItems` merges identical findings and grades each
  `critical` (geometry to correct), `uncertain` (to confirm) or `informational`.

Known errors on New Job 03/09, kept visible by the reference fixtures rather than tuned away: the
laundry measures 57 % small (its tub bench reads as wall); cavity sliders and robe sliders are found only
where an opening is located on them; walls at angles other than 0, 45 and 90 degrees and curved walls
are not measured.

## Completion phase: open-plan rooms, doors drawn across wide openings, coarse sheets, save order (2026-10-13)

- **Open-plan rooms.** Several names in one space with no wall between them no longer produce an
  extra combined room. The first name carries the measured boundary and the whole floor once
  (`openPlanWith: [other names]`); each other name stays in the room list with no boundary and no
  area (`openPlanIn: <first name>`). Room names and floor areas are therefore unique downstream.
- **Smallest room for a name** (`roomMinimumM2`): an ensuite, bathroom or laundry is not given a
  pocket under 1.8 m2, a WC/powder/pantry/WIR under 0.8 m2, a robe/linen/store under 0.3 m2.
- **Doors drawn across wide openings** (`basis: 'door-line-across'`). A gap wider than a doorway
  between two ends of one wall is a door where one unbroken line is drawn along at least 85% of it
  (`wideDoorLineShare`): a robe slider, a cavity slider, a garage door. A dashed bulkhead line or an
  empty open-plan opening is not. Measured on New Job 03/09: robe slider 0.95, garage door 1.00,
  the four other wide gaps 0.04-0.54. Emitted from linework as `Internal Door`, or `Garage Door`
  where the gap is in an external wall and at least 2200 mm, always with `needsClassification`.
- **Sheets stored too coarsely.** `readPlanRaster` records what the stored image resolves
  (`raster.storedPixelsPerMm`). Below `minimumStoredPixelsPerMm` (0.05: a 70 mm wall under 3.5
  pixels) the sheet is not measured at all; the review carries a critical `linework-failed` item
  saying to import the sheet at a higher resolution. Enlarging a coarse image adds no wall faces.
- **Building selection.** The drawing with the most wall linework is chosen with each piece's
  contribution capped, so a title block or border with long ruled lines is not taken for the plan.
- **Sheet scales in saved objects.** `stampSheetScales` marks each saved object that is on a sheet
  whose scale differs from the saved `pixelsPerMm` with `sheetPixelsPerMm`; `toCommonScale` uses
  that mark when no calibration record is passed. Takeoffs whose sheets share one scale are saved
  exactly as before.
- **Save order.** A manual Save waits for an autosave that is already writing, so the newer copy
  is always written last.

### What other modules need to do (not changed here)

1. `lib/builders/carpetSelection.js` `measuredFlooringRooms`: the "unsynchronised plan polygons"
   branch divides by `job.pixelsPerMm` only. On a takeoff with differently scaled sheets it must
   use `item.sheetPixelsPerMm || job.pixelsPerMm` for each saved area.
2. Any module that measures saved takeoff objects itself (not through `takeoffSchedule.js`) must do
   the same. The schedule builders already do.
3. Rooms with `openPlanIn` have `areaM2: null`. A module listing rooms with areas should show them
   as part of the named room, not as a room with a missing measurement.
4. Openings with `needsClassification` are measured positions and widths with an unconfirmed type;
   they should not be priced until confirmed in the takeoff.

Pinned by `scripts/test-takeoff-output-contract.mjs`.
