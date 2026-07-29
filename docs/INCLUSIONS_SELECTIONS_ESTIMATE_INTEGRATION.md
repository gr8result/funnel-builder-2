# Inclusions Selections Estimate Integration

Date: 2026-07-29

## Boundary

Estimate Builder is not changed in this phase. The new module only defines the future export contract.

## Draft Rule

Draft selections cannot alter an approved estimate. Estimate integration must consume locked snapshots only.

Stage 5 creates locked selection snapshots but does not export them to Estimate Builder. The `/inclusions-selections/documents-export` route remains a placeholder for the next stage.

## Export Contract

`createEstimateSelectionExport` converts a locked `SelectionSnapshot` into estimate lines.

Each export line contains:

- snapshot id,
- description,
- product and variant identifiers when present,
- supplier id when present,
- quantity and unit,
- cost,
- sell,
- tax.

## Aggregation

Snapshot lines can be grouped when product, variant, supplier, unit, category, and subtype are equivalent. This keeps estimate output concise while preserving the locked snapshot as the source of truth.

## Future Adapter Work

Future integration should add an adapter at the Estimate Builder boundary. It should map `EstimateSelectionExportLine` into the current estimate row format without importing Estimate Builder internals back into this module.
