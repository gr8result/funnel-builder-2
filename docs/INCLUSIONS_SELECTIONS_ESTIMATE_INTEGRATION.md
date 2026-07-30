# Inclusions Selections Estimate Integration

Date: 2026-07-29

## Boundary

Estimate Builder is not changed in this phase. The new module only defines the future export contract.

## Draft Rule

Draft selections cannot alter an approved estimate. Estimate integration must consume locked snapshots only.

Stage 5 creates locked selection snapshots but does not export them to Estimate Builder. Stage 6 exports only from locked snapshot lines through an adapter boundary.

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

Stage 6 introduces the adapter-facing export service and an in-memory adapter for tests and development. A future real receiver should map `EstimateExportLine` into the current estimate row format without importing Estimate Builder internals back into this module.

The selections module must not import `EstimateBuilderWorkbook`, workbook React components or Estimate Builder local UI stores.
