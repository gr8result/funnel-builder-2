# Master Catalogue Reconciliation Report

Date: 2026-09-02

Stage 3A is a read-only reconciliation. No live modules were connected, no saved jobs or selections were migrated, no prices were changed, and no quotation rows were deleted or merged.

## Zero Match Finding

Stage 2 reported 0 Product Library matches because matching only used direct stable IDs, product codes, and quote source keys. The active Quotation Builder workbook usually stores legacy descriptions, generic allowances, or old supplier/model text, not current Product Library stable IDs. After safe fallback matching, confirmed Product Library matches are 0.

Stage 2 reported 0 Estimating Catalogue matches because there is not yet an explicit Estimating Catalogue master source with stable `estimatingItemId` records. The active runtime Estimating Catalogue is derived from the Quotation Builder sheet in `EstimateBuilderWorkbook.js`, so derived-runtime matches are 566, while explicit estimating-master matches remain 0.

## Corrected Classification Totals

| Classification | Rows |
| --- | --- |
| informational | 141 |
| estimating-item | 432 |
| formula | 380 |
| assembly | 122 |
| allowance | 12 |
| heading | 16 |
| unresolved | 149 |
| product | 324 |
| custom | 2 |

## Migration Status Totals

| Status | Rows |
| --- | --- |
| not-a-catalogue-record | 537 |
| existing-derived-estimating-row | 432 |
| requires-assembly-model | 122 |
| requires-review | 163 |
| missing-product-library-candidate | 324 |

## Creation Candidates

| Candidate type | Count | Meaning |
| --- | --- | --- |
| Product Library | 324 | Product-like rows with no safe existing Product Library match. Many are generic material/range rows and still need human review before creation. |
| Estimating Catalogue | 411 | Unique estimating source IDs that need an explicit master item if the derived workbook row becomes canonical. These currently exist only as workbook-derived runtime rows. |
| Assembly templates | 122 | Rows that combine product and resource logic; do not create as single products. |

## Duplicate Review

Duplicate groups reviewed: 56

| Review type | Groups |
| --- | --- |
| true duplicate candidate | 42 |
| room/context variant | 14 |

Price/unit conflict groups: 4

## Unresolved Review

| Reason | Rows |
| --- | --- |
| ambiguous labour/material item | 94 |
| genuinely unresolved | 17 |
| legacy row | 34 |
| ambiguous product | 4 |

## Cabinetry Mapping Completeness

Mapped cabinetry records: 526

Original Stage 2 cabinetry workflow records revalidated: 372

Additional stone/specialty records included for Stage 3A completeness: 154

Completeness status: complete

| Supplier | Rows |
| --- | --- |
| Laminex | 54 |
| Polytec | 307 |
| Caesarstone | 12 |
| Neolith | 12 |
| Smartstone | 24 |
| Stone Ambassador | 100 |
| Handle House | 8 |
| Builder stone supplier | 3 |
| Blum | 1 |
| Cabinetmaker | 5 |

Coverage verified for Laminex, Polytec, Neolith, Caesarstone, Smartstone, Stone Ambassador, Handle House handles, Blum soft-close hardware, brushed aluminium kick panels, raw MDF bulkheads, cabinet shelving, and cleated shelving.

Every mapped cabinetry row includes stable product ID, category ID, family ID, supplier, brand, range, product/model name, description, unit, price or quote-required status, applicable rooms, and selectable status. Image references are present where the current source provides one.

## Appliance Structure

Required hierarchy: Appliance family -> Brand -> Range/model -> Product details.

| Family | Brand | Range | Models |
| --- | --- | --- | --- |
| cooktops | Westinghouse | Gas Cooktop | 2 |
| cooktops | Westinghouse | Induction Cooktop | 3 |
| dishwashers | Westinghouse | Freestanding Dishwasher | 2 |
| fridges | Westinghouse | Bottom Mount Fridge | 1 |
| microwaves | Westinghouse | Countertop Microwave | 1 |
| ovens | Westinghouse | AirFry Duo Oven | 1 |
| ovens | Westinghouse | AirFry Oven | 1 |
| ovens | Westinghouse | Duo Oven | 1 |
| ovens | Westinghouse | Multi-function Oven | 2 |
| rangehoods | Westinghouse | Canopy Rangehood | 1 |
| rangehoods | Westinghouse | Fixed Rangehood | 1 |
| rangehoods | Westinghouse | Slide Out Rangehood | 1 |

Current appliance master records are Westinghouse-only because that is what the active committed Kitchen catalogue contains. The import contract and mapping schema use family, brand, range, model, and product ID fields, so additional brands can be imported by CSV without code changes.
