# Inclusions Selections Stage 6 Documents and Estimate Export

Date: 2026-07-30

## Route

`/inclusions-selections/documents-export`

Stage 6 replaces the placeholder with the approved documents and Estimate Builder export workspace.

## Purpose

Stage 6 uses an immutable locked `LockedSelectionSnapshot` as the only source for final selection documents and estimate export lines.

Required flow:

Locked SelectionSnapshot -> SelectionSnapshotLine -> Document Projection -> EstimateExportLine -> EstimateExportAdapter -> Estimate Builder import boundary.

Editable Stage 3 or Stage 4 records cannot create approved documents or estimate exports.

## Document Projections

The document architecture separates projection types: client selection, builder internal, site supervisor, room, category, trade, supplier, variation summary and estimate export preview.

Client projections exclude builder cost, markup, margin, internal notes, estimate mapping IDs and procurement metadata. Builder/internal projections include snapshot-frozen internal values where available.

## Renderer Boundary

`SelectionDocumentRenderer` accepts a `DocumentProjection` and returns a render result. The development renderer is an HTML renderer that creates in-memory storage references. The projection is not coupled to a PDF library.

`GeneratedDocumentRecord` stores document type, audience, snapshot version, generated timestamp, document version, content hash, file name, MIME type, storage reference and failure/supersession metadata.

## Estimate Export

`validateEstimateMappings` validates locked snapshot lines for estimate stage, row mapping, cost code, quantity, unit, costs, prices, GST and duplicate export state.

Manual mapping overrides are stored separately as `EstimateMappingOverride` records with actor, timestamp and reason. Overrides never edit locked snapshot lines.

`buildEstimateExportPreview` transforms frozen snapshot lines into traceable `EstimateExportLine` records. `aggregateEstimateExportLines` aggregates only compatible lines and preserves sorted source snapshot-line IDs.

The adapter-facing `EstimateExportAdapter` provides validate, export batch and duplicate lookup behaviour. The included implementation is an in-memory test adapter and does not import Estimate Builder workbook internals.

## Idempotency, Retry And Reconciliation

Idempotency keys include organisation, project, snapshot, source snapshot-line IDs, export target and mapping version. Completed exports are blocked from duplication. Failed lines can be retried without duplicating completed lines.

`reconcileEstimateExport` compares snapshot totals against completed export lines for source-line count, quantities, allowance, client value, variation and GST. Failed reconciliation prevents a batch from being marked completed.

## Persistence

Persistence is currently in-memory through `DocumentsExportRepository`: generated documents, mapping overrides, export batches, export lines, reconciliations and audit events.

No production database migration is included.

## Responsive Behaviour

The route supports desktop tables, tablet stacking, mobile single-column cards and print preview styling.

## Procurement Placeholder

`/inclusions-selections/procurement` is a placeholder only and states:

Supplier ordering, procurement tracking and purchase schedules will be completed in a future stage.

Supplier ordering, procurement tracking, delivery scheduling, live supplier APIs, purchase orders and procurement status are not implemented in Stage 6.

## Tests

`src/modules/inclusions-selections/tests/selectionDocumentsExport.test.ts` covers locked snapshot loading, document projections, generated records, mapping overrides, export previews, aggregation, execution, duplicate prevention, retry, reconciliation, history and route isolation.
