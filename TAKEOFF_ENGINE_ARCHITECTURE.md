# Takeoff Engine Architecture And Build Specification

## Document Status

This document is the master rulebook for all future Takeoff Engine work.

It defines the engineering standard, product vision, layered architecture, data model, persistence rules, viewer strategy, vision strategy, testing rules, and phased delivery order.

No implementation work should start unless it conforms to this document.

## Product Vision

The Takeoff Engine will become the plan-viewing, measurement, snapping, image-analysis, and construction-geometry foundation for a commercial construction estimating platform.

The benchmark is not the previous internal takeoff module. The benchmark is professional takeoff and CAD software:

- CostX
- Bluebeam Revu
- Planswift
- Buildxact
- Project Takeoff
- Cubit
- On-Screen Takeoff

The engine must feel like a professional desktop takeoff application:

- Fast
- Precise
- Predictable
- Stable under large plans
- Reliable after save/reload
- Designed around construction workflows
- Comfortable for daily professional use

The user should feel they are working in a serious estimating tool, not in a web page that happens to display a PDF.

## Core Product Principles

Professional takeoff users care about:

- Speed of opening plans.
- Confidence that the plan is upright and sharp.
- Smooth pan and zoom.
- Accurate scale.
- Precise snapping.
- Fast measurement workflows.
- Clear visual feedback.
- Reliable save/reload.
- Easy correction when automation is wrong.
- No hidden mutation of confirmed work.

The engine must optimize for trust. A user must be able to believe that a measurement made today will remain the same after zooming, panning, saving, reloading, rotating, or reopening the job.

## Non-Negotiable Engineering Rules

1. Do not patch around architectural faults.
2. Do not guess when the root cause can be inspected.
3. Do not build new features before the current phase passes manual and automated regression.
4. Do not rebuild mature graphics, imaging, OCR, computer vision, tiling, or coordinate-transform functionality when a proven library solves it better.
5. Do not use live PDF pages as the measuring surface.
6. Do not use CSS rotation as the source of truth.
7. Do not store geometry in screen coordinates.
8. Do not allow zoom or pan to mutate stored geometry.
9. Do not allow caches to recreate deleted workbook data.
10. Do not allow AI or computer vision to overwrite confirmed user geometry.
11. Do not move to a later roadmap phase until the current phase passes regression.
12. Do not touch unrelated product modules while working on the Takeoff Engine.

## Scope Boundaries

The Takeoff Engine owns:

- Plan import.
- Raster image normalization.
- Tile metadata.
- Viewer state.
- Coordinate transforms.
- Scale state.
- Measurement geometry.
- Area geometry.
- Snapping state.
- Vision analysis outputs.
- Orientation analysis.
- OCR analysis outputs.
- Takeoff object model.
- Workbook serialization for takeoff data.

The Takeoff Engine does not own:

- BOQ generation.
- Purchase orders.
- Variations.
- CRM.
- Client portal.
- Website builder.
- Billing.
- Global layout.
- Authentication.

Those modules may consume Takeoff Engine outputs through defined integration boundaries, but the engine must not implement their workflows.

## Build Philosophy

Use proven foundations for low-level hard problems:

- Viewer.
- Imaging.
- OCR.
- Computer vision.
- Coordinate transforms.
- Tiling.

Build custom advantage in construction-specific layers:

- Takeoff workflow.
- Estimator interaction model.
- Construction object model.
- Scale and measurement UX.
- Trade-specific logic.
- AI review workflow.
- Workbook persistence.
- Integrations into estimating.

The architecture should be modular enough that a foundation can be replaced without rewriting construction logic.

## Layered Architecture

The engine is layered from low-level foundations to construction-specific workflows.

### Layer 1: Import Layer

Responsibilities:

- Accept PDFs and raster images as upload sources.
- Convert PDF pages to high-resolution raster images.
- Store original file/page metadata.
- Produce normalized page records.
- Generate or reference tile pyramids.
- Create thumbnails.
- Extract basic import metadata.

The import layer must not create measurements, BOQ rows, or trade logic.

### Layer 2: Image Normalization Layer

Responsibilities:

- Normalize image orientation.
- Apply confirmed rotation to raster data or coordinate-safe page transforms.
- Store final image dimensions.
- Produce a stable measuring surface.
- Record orientation decisions and confidence.

The normalized raster image or tile pyramid is the measuring surface.

### Layer 3: Viewer Layer

Responsibilities:

- Display large raster/tiled plans.
- Provide smooth pan and zoom.
- Fit page.
- Support view presets.
- Route pointer and keyboard events to tools.
- Expose image-to-screen and screen-to-image transforms.
- Render overlays aligned with image coordinates.

The viewer layer must use a proven viewer foundation where possible.

### Layer 4: Coordinate Layer

Responsibilities:

- Define the authoritative image-coordinate model.
- Provide tested coordinate conversion APIs.
- Prevent screen-coordinate storage.
- Preserve geometry stability across zoom, pan, fit, rotate, save, and reload.

No component may implement private transform math outside this layer or the viewer adapter.

### Layer 5: Tool Layer

Responsibilities:

- Scale tool.
- Measurement tools.
- Area tools.
- Snapping tools.
- Editing tools.
- Selection tools.
- Undo/redo integration.

Tools operate only on image coordinates.

### Layer 6: Vision Layer

Responsibilities:

- OCR.
- Orientation analysis.
- Scale text detection.
- Drawing bounds detection.
- Border detection.
- Title block detection.
- Line/corner/intersection detection.
- Confidence scoring.

Vision outputs suggestions and evidence. It does not silently mutate confirmed user work.

### Layer 7: Persistence Layer

Responsibilities:

- Serialize takeoff state into the workbook.
- Hydrate engine state from workbook.
- Keep cache state aligned to workbook.
- Persist undo/redo history if required.
- Prevent stale cache restoration.

The workbook is the production source of truth.

### Layer 8: Integration Layer

Responsibilities:

- Expose selected measurements, areas, and classified objects to estimating modules.
- Provide read-only or explicit-promotion APIs for BOQ, PO, variations, and selection workflows.
- Prevent downstream modules from mutating engine geometry directly.

## Proven Foundations We Will Use

### Viewer Foundation

Preferred candidate: OpenSeadragon or an equivalent mature tiled-image viewer.

The chosen viewer must support:

- Large raster images.
- Tiled image pyramids.
- Smooth wheel zoom.
- Zoom toward cursor.
- Smooth pan.
- Fit/home view.
- Rotation support or clean integration with normalized raster rotation.
- Overlay coordinate conversion.
- Input event hooks.
- Stable viewport math.

Custom React pan/zoom must not be the hot path for a production viewer.

### Imaging Foundation

Use proven imaging libraries or platform APIs for:

- PDF rasterization.
- PNG/JPEG/WebP output.
- Image rotation.
- Thumbnail generation.
- Tiling.
- Image dimension inspection.
- Cache key generation.

The implementation may use browser APIs for development, but production must be able to move heavy raster/tiling work server-side if browser performance is insufficient.

### OCR Foundation

Use an OCR adapter boundary.

The provider can be changed without rewriting engine logic. OCR must return normalized output:

- Text.
- Bounding boxes in image coordinates.
- Confidence.
- Orientation where available.
- Provider metadata.

### Computer Vision Foundation

Use OpenCV.js or server-side OpenCV for CV primitives:

- Hough lines.
- Contours.
- Edge detection.
- Corner detection.
- Intersections.
- Thresholding.
- Morphology.
- Connected components.

Custom code may coordinate and score OpenCV outputs but must not reimplement these primitives.

## Viewer Strategy

The production viewer must be implemented as an adapter around a proven viewer.

### Viewer Adapter Responsibilities

The adapter exposes engine APIs:

- loadPage(page)
- unloadPage()
- fitPage()
- setZoom(percent)
- zoomToPoint(point, delta)
- panBy(delta)
- rotate(rotation)
- imageToScreen(point)
- screenToImage(point)
- getViewState()
- setViewState(viewState)
- registerTool(tool)
- renderOverlay(overlay)

The adapter translates between the viewer library and engine concepts.

### Viewer Interaction Requirements

Pan:

- Middle mouse drag pans.
- Space + left mouse drag pans.
- Pan must be instant.
- Pan must not change stored geometry.

Zoom:

- Mouse wheel zooms immediately.
- Zoom is toward cursor.
- Zoom must not jump.
- Zoom must not scroll the browser page while over the viewer.
- Zoom must not cancel active drawing operations.

Fit and presets:

- Fit page.
- 100%.
- 200%.
- 400%.
- Reset view.

Rotation:

- Rotate 90.
- Rotate 180.
- Rotate 270.
- Reset orientation.
- Fit should run after rotation unless restoring a confirmed saved view.

Keyboard:

- Space temporarily activates pan.
- Escape cancels current transient operation.
- Delete removes selected transient or editable object when appropriate.
- Ctrl/Cmd+Z undo.
- Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redo.

### Overlay Requirements

Overlays must:

- Be derived from image coordinates.
- Stay attached after zoom.
- Stay attached after pan.
- Stay attached after fit.
- Stay attached after rotation.
- Remain readable at usable zoom levels.
- Avoid blocking viewer pan/zoom unless an editing handle is active.

## Tile Generation Strategy

Large plans must be represented as tiled raster images for viewer performance.

### Import-To-Tile Pipeline

1. Upload PDF or image.
2. Read source metadata.
3. Rasterize PDF pages at target DPI.
4. Normalize orientation.
5. Generate canonical full-resolution raster image.
6. Generate tile pyramid.
7. Generate thumbnail.
8. Store page and tile metadata in workbook.
9. Cache image/tile assets.
10. Load tile source into viewer.

### Tile Requirements

Tile metadata must include:

- Tile source type.
- Tile URL or cache key.
- Full image width.
- Full image height.
- Tile size.
- Tile overlap.
- Pyramid levels.
- DPI.
- Render scale.
- Source file name.
- Source page number.
- Format.
- Cache version.

The tile pyramid should support deep zoom without loading the full image into the browser at once.

### DPI And Quality

Target rasterization:

- Minimum: 300 DPI equivalent.
- Preferred: 400 DPI where performance allows.
- Thumbnail: optimized separately.

The plan must remain sharp enough at 200% and 400% to identify wall center lines and dimension text.

## OCR Strategy

OCR is a Vision Layer service.

### OCR Use Cases

- Orientation detection.
- Scale text detection.
- Title block extraction.
- Drawing labels.
- Revision labels.
- Page names.
- Notes and callouts.

### OCR Adapter Contract

Each OCR result should include:

- id
- text
- confidence
- boundingBox
- rotation
- pageId
- provider
- rawProviderData

All bounding boxes must be in image coordinates.

### OCR Confidence Rules

High confidence:

- May produce suggested orientation or scale.
- May preselect a recommendation.

Medium confidence:

- May show a suggestion requiring confirmation.

Low confidence:

- Must not claim success.
- Must show a review prompt if used.

OCR must never silently set final scale without a confirmable workflow.

## OpenCV / Computer Vision Strategy

Computer vision operates on normalized raster image data.

### CV Pipeline

1. Preprocess image.
2. Detect drawing bounds.
3. Detect border.
4. Detect title block.
5. Detect text regions.
6. Detect line candidates.
7. Detect corners and intersections.
8. Score candidates.
9. Emit reviewable suggestions.
10. Cache analysis results by image hash/cache version.

### CV Result Contract

Each result must include:

- id
- pageId
- type
- geometry
- confidence
- sourceAlgorithm
- evidence
- status
- createdAt

Status values:

- suggested
- accepted
- rejected
- superseded

### CV Boundaries

CV may suggest:

- Orientation.
- Scale candidates.
- Snap points.
- Wall center lines.
- Corners.
- Intersections.
- Drawing bounds.
- Title block location.

CV must not directly create confirmed measurements or quantities without user acceptance or workflow rules.

## Coordinate System Rules

There is one authoritative geometry coordinate space:

Image pixel coordinates.

### Storage Rules

Store in image coordinates:

- Scale calibration points.
- Measurement points.
- Area vertices.
- Snap points.
- Vision geometry.
- Object geometry.
- Labels' anchor points.

Do not store:

- clientX/clientY.
- offsetX/offsetY.
- CSS pixels.
- Screen-space geometry.
- Viewer library private coordinates as persisted geometry.

### View State Rules

View state is separate from geometry:

- zoom
- pan/center
- rotation view state when applicable
- viewport bounds
- active page

Zoom and pan are view-only.

### Rotation Rules

Preferred:

- Normalize the raster image/tile source into correct orientation before measurement.

If user rotation changes the canonical image:

- Either migrate existing geometry exactly.
- Or clear affected scale/measurements/areas with a clear warning.

Never keep duplicated rotation systems that can fight each other.

### Coordinate API

The engine must expose tested functions:

- imageToScreen(point)
- screenToImage(point)
- imageDistance(pointA, pointB)
- imagePolygonArea(points)
- rotateImagePoint(point, rotation, dimensions)
- transformGeometryForRotation(geometry, rotation, dimensions)
- serializeViewState(viewState)
- hydrateViewState(serialized)

## Object Data Model

### Takeoff Project

Fields:

- id
- schemaVersion
- pages
- activePageId
- settings
- createdAt
- updatedAt
- revisionHistory

### Page

Fields:

- id
- sourceFileName
- sourceType
- sourcePageNumber
- originalWidth
- originalHeight
- imageWidth
- imageHeight
- dpi
- format
- imageCacheKey
- tileSource
- thumbnailKey
- orientation
- scale
- measurements
- areas
- objects
- overlays
- visionResults
- viewState
- importMetadata
- createdAt
- updatedAt

### Orientation

Fields:

- selectedRotation
- userRotation
- finalRotation
- confirmed
- confidence
- reason
- source
- analysis

### Scale

Fields:

- id
- type
- referenceDistanceMm
- pixelsPerMm
- mmPerPixel
- pointA
- pointB
- label
- confidence
- source
- confirmed
- createdAt
- updatedAt

### Measurement

Fields:

- id
- type
- name
- points
- lengthMm
- areaMm2
- perimeterMm
- volumeMm3
- displayText
- labelPoint
- style
- source
- status
- createdAt
- updatedAt

### Area

Fields:

- id
- type
- name
- points
- areaMm2
- perimeterMm
- displayText
- labelPoint
- style
- source
- status
- createdAt
- updatedAt

### Vision Result

Fields:

- id
- type
- pageId
- geometry
- confidence
- sourceAlgorithm
- evidence
- status
- createdAt
- updatedAt

## Measurement Object Lifecycle

Measurement lifecycle:

1. Tool selected.
2. User chooses start point.
3. Tool creates transient draft object.
4. User moves cursor.
5. Tool updates preview using image coordinates.
6. Snapping may alter the draft point.
7. User confirms endpoint or vertices.
8. Engine validates scale and geometry.
9. Engine creates committed measurement.
10. Measurement is added to undo history.
11. Workbook state is updated.
12. Caches are refreshed from workbook.

States:

- draft
- committed
- selected
- editing
- deleted

Rules:

- Draft objects are UI state only.
- Committed objects are workbook state.
- Every committed object must be undoable.
- Every edit must preserve image coordinates.
- Measurement display must be millimetres first.
- Measurement values must not change after zoom, pan, fit, save, or reload.

## Revision And Version Handling

The engine must support schema evolution and drawing revisions.

### Schema Version

Every Takeoff Engine project state must include:

- schemaVersion
- createdAt
- updatedAt

Hydration must:

- Validate schemaVersion.
- Migrate old state forward if supported.
- Refuse unsafe migration with a clear error.

### Drawing Revision Handling

Pages should track:

- source revision label where known.
- upload timestamp.
- source file hash where possible.
- page hash where possible.
- replacement history.

When a page is replaced:

- Preserve old page data unless user explicitly confirms migration.
- Offer migration if image dimensions and orientation allow safe mapping.
- Otherwise mark old measurements as tied to previous revision.

Revision objects should include:

- revisionId
- pageId
- sourceFileName
- imageHash
- uploadedAt
- replacedBy
- migrationStatus

## Workbook Persistence Rules

The workbook is the production source of truth.

The workbook owns:

- pages
- activePageId
- orientation
- confirmedOrientation
- scale
- measurements
- areas
- overlays
- viewState
- importMetadata
- tileMetadata
- imageMetadata
- visionResults
- settings

React state:

- Temporary UI state only.

Reducer state:

- Temporary editing state only.

LocalStorage:

- Cache only.

IndexedDB:

- Cache only.

Filesystem or remote storage:

- May store image/tile assets.
- Must not become an independent source of truth for project geometry.

### Save Rules

On save:

1. Validate reducer state.
2. Write workbook state.
3. Persist workbook.
4. Refresh caches from workbook.
5. Verify cache counts match workbook counts in development diagnostics.

### Load Rules

On load:

1. Load workbook.
2. Hydrate engine state from workbook.
3. Rebuild caches only from workbook.
4. Do not merge deleted cache data back into workbook.

### Delete Rules

On delete:

1. Delete from reducer.
2. Update workbook.
3. Save workbook.
4. Refresh cache from workbook.
5. Reload must show the deleted state.

If workbook has zero pages, all caches and UI must show zero pages.

## Integration Points

The engine exposes outputs to other modules. Other modules do not mutate engine internals directly.

### BOQ Integration

BOQ may consume:

- Confirmed measurements.
- Confirmed areas.
- Classified objects.
- Trade tags.
- Page references.

BOQ must not own measurement geometry.

### Purchase Order Integration

PO workflows may consume:

- Confirmed quantities.
- Trade classifications.
- Material mapping outputs.

PO must not mutate takeoff measurements.

### Variations Integration

Variations may consume:

- Difference between revisions.
- Added/removed measurements.
- Changed quantities.
- User-confirmed scope changes.

Variations must reference source takeoff objects by ID.

### Selections Integration

Selections may consume:

- Room/area objects.
- Trade tags.
- Material selections linked to takeoff quantities.

Selections must not rewrite source geometry.

### Integration Contract

Every exported object should include:

- objectId
- pageId
- type
- quantity
- unit
- source
- confidence
- revisionId
- updatedAt

## Performance Targets

Viewer:

- Wheel zoom response should feel immediate.
- Pan should track pointer movement without visible lag.
- Fit page should complete within 100 ms after image/tile source is available.
- Overlay alignment should update within the viewer animation frame.

Import:

- Show progress immediately after upload.
- Show large-plan notice after 3 seconds.
- Never leave a blank screen during import.
- Generate thumbnails quickly enough to show progress.

Large plans:

- Viewer must support high-resolution architectural plans through tiling.
- Browser must not load unnecessary full-resolution images for normal viewing.
- Memory usage must be bounded by tile loading where possible.

Measurement:

- Measurement result must appear immediately after confirmation.
- Measurement value must remain stable after zoom/pan.

Persistence:

- Save must not silently fail.
- Delete final page then save must succeed.
- Reload must not resurrect stale data.

## Development Diagnostics

Development-only diagnostics may show:

- Workbook pages count.
- Reducer pages count.
- Cache pages count.
- Active page ID.
- Image dimensions.
- Tile source.
- Current zoom.
- Current center/pan.
- Rotation.
- Scale.
- Selected tool.
- Selected object.
- Last pointer image coordinate.
- Last pointer screen coordinate.

Diagnostics must be hidden in normal user UI.

## Regression Testing Checklist

Every phase must maintain this checklist.

### Import Regression

- Upload PDF.
- Upload image.
- Generate raster page.
- Generate tile metadata.
- Generate thumbnail.
- Save.
- Reload.
- Delete.
- Delete final page.
- Save after delete.
- Reload after delete.

### Viewer Regression

- Fit page.
- 100%.
- 200%.
- 400%.
- Wheel zoom toward cursor.
- Pan.
- Rotate 90.
- Rotate 180.
- Rotate 270.
- Overlay alignment after zoom.
- Overlay alignment after pan.
- Overlay alignment after fit.
- Overlay alignment after rotate.
- Browser page does not scroll while over viewer.

### Persistence Regression

- Workbook owns pages.
- Cache cannot restore deleted pages.
- Active page persists.
- View state persists.
- Orientation confirmation persists.
- Scale persists.
- Measurements persist.
- Areas persist.

### Coordinate Regression

- Same image point converts to same screen position after view restoration.
- Same measurement remains identical at 50%, 100%, 200%, and 400%.
- Pan does not change measured values.
- Zoom does not change measured values.
- Save/reload does not change measured values.

### Tool Regression

- Set scale.
- Measure line.
- Measure polyline.
- Measure rectangle area.
- Measure polygon area.
- Select object.
- Edit vertex.
- Undo.
- Redo.
- Delete object.

### Vision Regression

- Orientation suggestion includes confidence.
- Scale text suggestion includes confidence.
- Drawing bounds suggestion includes confidence.
- Rejected suggestion does not return as accepted.
- Confirmed user geometry is not overwritten by AI/CV.

## Phased Delivery Roadmap

The phase order is fixed. Do not skip ahead.

### Phase 1: Image Import Engine

Goal:

Make PDF/image import stable, high-quality, raster-first, tile-ready, and workbook-owned.

Scope:

- PDF import.
- High-resolution raster generation.
- Image normalization.
- Tile generation strategy.
- Image cache.
- Thumbnail generation.
- Workbook persistence.

Exit criteria:

- Imported plans become normalized raster pages.
- Page metadata is complete.
- Tile metadata exists.
- Workbook owns page state.
- Upload/save/reload/delete passes regression.

### Phase 2: Viewer Engine

Goal:

Make the viewer feel like professional takeoff software.

Scope:

- Proven viewer foundation.
- Viewer adapter.
- Instant pan.
- Instant zoom.
- Zoom toward cursor.
- Fit page.
- 100%, 200%, 400%.
- Rotate.
- Keyboard shortcuts.
- Large plan support.
- Overlay coordinate alignment.

Exit criteria:

- Smooth pan/zoom under manual testing.
- Overlay points stay attached.
- Viewer handles large tiled plans.
- No custom React wheel/pan hot path remains.

### Phase 3: Vision Engine

Goal:

Build a raster-only image-analysis pipeline.

Scope:

- OCR adapter.
- Orientation analysis.
- Scale text detection.
- Title block detection.
- Drawing bounds.
- Border detection.
- Confidence scoring.
- Auto orientation suggestions.
- Auto scale suggestions.

Exit criteria:

- Vision outputs are confidence-scored.
- Low-confidence outputs require review.
- No PDF-only heuristic is treated as authoritative.

### Phase 4: Snapping Engine

Goal:

Deliver CAD-grade snapping.

Scope:

- Corners.
- Wall intersections.
- Wall center lines.
- Endpoints.
- Midpoints.
- Grid.
- Extension lines.
- Nearest edge.
- Snap tolerance.
- Snap guides.

Exit criteria:

- Snapping feels predictable.
- Snap targets are visible.
- Existing geometry can be reused accurately.

### Phase 5: Measurement Engine

Goal:

Deliver professional manual takeoff tools.

Scope:

- Line.
- Polyline.
- Rectangle.
- Circle.
- Polygon.
- Room.
- Area.
- Perimeter.
- Volume.
- Labels.
- Editing.

Exit criteria:

- Measurements are millimetres first.
- Geometry is image-coordinate based.
- Values survive zoom, pan, fit, rotate, save, and reload.

### Phase 6: AI Detection

Goal:

Add AI-assisted object detection after the foundation is trustworthy.

Scope:

- OpenCV-assisted detection.
- Walls.
- Rooms.
- Doors.
- Windows.
- Columns.
- Beams.
- Roofs.
- Objects.
- Human review workflow.

Exit criteria:

- AI results are reviewable.
- Confidence is visible.
- Manual correction is fast.
- AI never corrupts confirmed user geometry.

## Release Gate

No phase is complete until:

- Manual testing passes.
- Automated regression passes.
- Workbook save/reload passes.
- Delete/reload passes.
- Undo/redo passes where relevant.
- Performance target is met or documented as a blocker.
- User-facing behaviour matches professional takeoff expectations.

## Decision Rule

Before any engine work starts, ask:

1. Is this work in the current roadmap phase?
2. Does a proven foundation solve the low-level problem better?
3. Is geometry stored only in image coordinates?
4. Is view state separate from geometry?
5. Is workbook still the source of truth?
6. Is the change regression-testable?
7. Does it improve professional takeoff UX?

If the answer to any question is no, stop and fix the architecture first.
