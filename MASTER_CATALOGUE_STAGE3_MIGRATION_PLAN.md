# Master Catalogue Stage 3 Migration Plan

Date: 2026-09-02

This plan intentionally divides later implementation into small, reversible slices. Stage 3A did not perform these migrations.

## Slice 1 - Product Library Canonical Source

Create canonical Product Library import rows only for reconciled physical products with high-confidence matches or approved missing-product candidates. Keep archived records resolvable and preserve current JSON catalogues until parity tests pass.

Rollback: disable the new canonical source flag and continue reading committed JSON catalogues.

## Slice 2 - Estimating Catalogue Canonical Source

Add explicit estimating item records for labour, plant, subcontract, fees, preliminaries, and construction materials currently derived from the workbook. Maintain a source row alias back to the workbook row.

Rollback: ignore explicit estimating records and continue deriving the runtime sheet from Quotation Builder rows.

## Slice 3 - Quotation Builder References And Snapshots

Add source reference fields to quotation rows: source type, source ID, source version, and frozen snapshot fields. Backfill references in batches by classification and leave row descriptions/prices unchanged.

Rollback: hide reference fields and keep existing quotation row payloads.

## Slice 4 - Client Selections Catalogue Selectors

Move selectors to family -> brand -> model Product Library queries one family at a time. Start with appliances and external lighting, then cabinetry once snapshot alias tests pass.

Rollback: switch the affected family back to current workflow/static source.

## Slice 5 - CSV Imports

Implement Product Library and Estimating Catalogue CSV imports using the Stage 2 templates. Validate duplicate keys by supplier plus product/model code for products and by trade/resource/code for estimating items.

Rollback: reject new imports and leave current committed catalogues intact.

## Slice 6 - Validation And Regression Tests

Add tests for source separation, classification, duplicate review, stable IDs, matching fallback fields, appliance hierarchy, cabinetry mapping completeness, and snapshot immutability. Keep the completed Cabinetry UI tests as a release gate.

Rollback: no data rollback required; tests only gate deployment.
