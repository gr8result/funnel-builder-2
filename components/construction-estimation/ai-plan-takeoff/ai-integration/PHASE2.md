# Phase 2: real plan analysis

`RUN AI TAKEOFF` reads the pages already uploaded into the existing Takeoff.
It inspects every supplied page, confirms calibration where needed, measures
relevant floor plans, validates the results, and calls the Phase 1 append bridge.
The existing canvas, schedule, manual tools and Save action own the resulting
objects. No pricing, material recipes, new database or alternate geometry store
is introduced.

## Flow and files

1. `analysisPages.js` extracts optional PDF text/paper-unit evidence during the
   existing upload, and prepares bounded full-page JPEGs for vision. Inspection
   determines reading direction. A temporary image rotation makes the drawing
   readable; inverse coordinate mapping restores original logical canvas space.
2. `useAiTakeoffAnalysis.js` orchestrates inspection, scale confirmation and
   measurement automatically. `AiTakeoffAction.jsx` supplies the single action,
   progress, review information and buttons for the existing schedule and Save.
3. `analysisClient.js` uses the existing Supabase session to call
   `/api/ai/takeoff-analyse`. That new route reuses `withAuth` and delegates to
   `lib/construction-estimation/aiTakeoffAnalysis.js`.
4. `analysisContract.js` converts provider findings into Phase 1 detections.
   `analysisEvidence.js` validates additive provenance. The existing adapter
   calculates canonical wall lengths and validates all accepted geometry.
5. `useAiTakeoffBridge.appendDetections(batch, {signal})` appends through the
   existing six array setters. Its optional cancellation guard supplements the
   existing identity, calibration, lifecycle and duplicate-run checks.

The legacy `/api/ai/plan-detect` was audited: it uses authenticated GPT-4o calls
but returns obsolete overlay objects. It remains independent for compatibility;
its response is never used as a Takeoff persistence format.

## Provider and transport contract

Default: OpenAI Responses API, `gpt-5.4`, configurable server-side with
`OPENAI_TAKEOFF_MODEL`; credentials come only from `OPENAI_API_KEY` on the server.
Supported models use `detail: original` for dense drawings. Requests use strict
JSON schemas, bounded image/text input, a provider timeout, server-side output
validation, per-user limits and in-flight request deduplication. Provider errors
produce a failure response, never fixture geometry or apparent success.

```js
// POST /api/ai/takeoff-analyse with the existing user's Bearer session.
{
  action: 'inspect' | 'measure',
  jobId, takeoffId, documentHash, runId,
  page: {
    pageNumber, logicalWidth, logicalHeight,
    imageDataUrl, imageRotation, pdfUnits, textItems,
    drawingType, level
  },
  pixelsPerMm, // required for measure; omitted before calibration
  contextPages // up to three supporting schedules/elevations/sections
}

// Successful response
{ ok: true, provider, model, requestId, analysis }
```

Inspection returns page identity, drawing type, level, relevance, reading
direction/orientation, printed scale and written dimension references.
Measurement returns walls, openings, aggregate building areas, named spaces,
fixtures, documented quantities and review notes. These are transient analysis
findings. All editable geometry is normalized and passed through
`convertAiTakeoffDetections` and the existing append bridge.

## Calibration and evidence

Precedence is explicit dimension lines, detected drawing scale, existing
confirmed calibration, then reliable derived dimensions. A PDF's known paper
units permit converting a printed ratio to the existing logical pixels/mm.
An arbitrary raster image cannot acquire a calibration from `1:100` alone.
Detected calibration requires confirmation; changing a calibration underlying
existing objects requires the existing manual calibration workflow.

Window shorthand is height first: `1218` is **1200H × 1800W**. The original code
and tag survive. Explicit dimensions override shorthand and conflicts become
review items. Door/window size codes are not independent calibration distances.
Only reliable dimension-line evidence can establish a calibration reference.

Each admitted object retains `source: ai`, confidence and original Phase 1
identity metadata. Optional `ai.analysisEvidence` contains OBSERVED, DERIVED or
ASSUMED basis, evidence text and per-field provenance. Missing wall thickness
uses the manual display default with an explicit assumption; unknown wall
height stays null. Unknown opening dimensions are withheld rather than invented.
Opening positions must be close to their claimed wall; small projections onto
the host are marked DERIVED. Unreliable geometry and unsafe overlapping areas
are withheld with review reasons.

Named rooms and observed fixtures remain review metadata. They do not become
additional Living polygons or unsolicited Job Setup/quotation updates. Aggregate
areas use existing supported floorplan categories, including Porch. Printed
quantities are comparison benchmarks; they never replace measured geometry or
force a trace to fit an expected value.

## Persistence and operational limits

Geometry persists only in the existing canonical arrays. Semantic findings,
benchmarks and review evidence persist in the same job's optional
`scheduleState.aiAnalysis`. Existing `aiAppliedRuns` receipts prevent replay,
including deletion, reopen and attaching the same takeoff to another project.
Replacing a plan explicitly clears these fields through the existing save merge.
Both optional fields participate in content verification when populated;
legacy empty-state checksums retain their previous shape.

A completed run is not automatically repeated for the same takeoff/document.
Review and edits remain authoritative. Cancel, document replacement, job changes
and calibration changes prevent late responses from inserting geometry.

The existing canvas still has one global calibration. Conflicting scales across
relevant pages and ambiguous duplicate floor-plan sheets stop for review.
Supporting imagery is bounded to three reference sheets per measurement request.
Unresolved openings/fixtures remain visible in saved analysis metadata. They do
not silently increase measured schedule quantities.

## Verification

```text
node scripts/test-takeoff-ai-analysis-contract.mjs
node scripts/test-takeoff-ai-server.mjs
node scripts/test-takeoff-ai-orchestration.mjs
node scripts/test-takeoff-ai-bridge.mjs
node scripts/test-takeoff-ai-real-browser.mjs
```

The real browser test uploads the actual Kress Road PDF into an isolated job,
uses a genuine authenticated API request and provider response, then exercises
canvas editing, the displayed schedule, ordinary persistence and reopening.
Evidence and independent printed benchmarks are under
`artifacts/test-artifacts/takeoff-ai-real/`. Unit provider stubs are confined to
unit tests; the browser acceptance route never substitutes fixture responses.

Official API references used for implementation:
[vision and coordinate handling](https://developers.openai.com/api/docs/guides/images-vision),
[structured output](https://developers.openai.com/api/docs/guides/structured-outputs),
[GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4).
