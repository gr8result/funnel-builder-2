# Manual PDF Rotation Audit

## Root Cause Found

Manual rotation was not authoritative. The UI controls updated `userRotation`, then rendering calculated:

`metadataRotation + detectedRotation + userRotation`

as `finalRotation`.

That allowed diagnostics such as `detectedRotation: 180`, `userRotation: 0`, `finalRotation: 180` while the visible page could remain sideways or rotate unpredictably. Imported PDF pages also already had `imageDataUrl`, so some manual rotations rotated the existing raster image instead of re-rendering the PDF page through PDF.js.

## Rotation Path After Change

- `page.rotation` is the authoritative page value.
- PDF.js rendering uses `page.rotation` directly as the viewport rotation.
- Legacy fields `userRotation`, `finalRotation` and `planRotation` are still populated for compatibility and diagnostics, but are no longer combined for manual rendering.
- `metadataRotation` and `detectedRotation` remain diagnostic suggestions.
- Manual rotation marks `orientationConfirmed: true`.
- Manual PDF rotation re-renders from the original PDF data URL rather than CSS-rotating or rotating an already-rasterized PDF image.

## Files Changed

- `components/estimate-builder/ai-takeoff/pdfPlanRendering.js`
- `components/estimate-builder/ai-takeoff/AIPlanTakeoffPage.jsx`
- `components/estimate-builder/ai-takeoff/PDFUploadPanel.jsx`
- `components/estimate-builder/ai-takeoff/PlanCanvas.jsx`
- `components/estimate-builder/ai-takeoff/takeoffTypes.js`

## Rotation Variables Consolidated

- Authoritative: `page.rotation`
- Compatibility/diagnostic: `userRotation`, `finalRotation`, `planRotation`
- Diagnostic suggestions: `metadataRotation`, `detectedRotation`

## PDF.js Rendering Evidence

`renderPdfPageToDataUrl` now creates the viewport with:

```js
const viewport = page.getViewport({ scale: renderScale, rotation: finalRotation });
```

where `finalRotation` is resolved first from `rotationState.rotation` / `page.rotation`.

The live renderer stores:

- `viewportWidth`
- `viewportHeight`
- `canvasPixelWidth`
- `canvasPixelHeight`
- `canvasCssWidth`
- `canvasCssHeight`
- `renderScale`

These values are shown in the development debug panel.

## Width And Height Swapping

PDF.js viewport dimensions are now the source of truth. For a page with unrotated dimensions `2479 x 3508`, a `90` or `270` viewport rotation should report approximately `3508 x 2479` in:

- `viewportWidth`
- `viewportHeight`
- `canvasPixelWidth`
- `canvasPixelHeight`
- `normalizedWidth`
- `normalizedHeight`

## Persistence

`page.rotation` is saved on each page and mirrored to the plan record. Reloading the takeoff state normalizes pages using `page.rotation` first, then falls back to older saved fields.

## Verification Completed

- `npx tsc --noEmit`: passed.
- `node components/estimate-builder/ai-takeoff/planCoordinateUtils.test.mjs`: passed.
- `node components/estimate-builder/ai-takeoff/pdfPlanRendering.test.mjs`: passed.

## Visual Test Status

Not completed. No PDF fixture was attached for browser verification, and no screenshots were captured. The required visual sequence must still be run with a real PDF:

1. Upload PDF.
2. Click Rotate 90 degrees.
3. Confirm visible page rotates.
4. Confirm width/height swap in debug panel.
5. Rotate again, rotate 270 degrees, confirm result.
6. Set as correct orientation.
7. Refresh and confirm persistence.
8. Switch pages and return.
9. Confirm thumbnails and main viewer match.
10. Confirm no CSS rotation is masking dimensions.

