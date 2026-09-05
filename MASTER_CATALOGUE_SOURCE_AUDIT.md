# Master Catalogue Source Audit

Date: 2026-09-02

This is a generated read-only inventory. It does not migrate live data, change saved-job schemas, or alter Client Selections rendering.

## Active Data Sources

| Module | Active file | Export/symbol | Record count | Record type | Storage source | Runtime consumer |
| --- | --- | --- | --- | --- | --- | --- |
| Product Library | lib/product-library/catalogueService.js | getMasterProducts | 641 | product | committed JSON catalogues | Imported by pages/modules/builders/product-library.js and pages/modules/builders/selections-book.js |
| Product Library | lib/product-library/catalogueModel.js | PRODUCT_FAMILIES | 36 | taxonomy/product-family | static JS array | Imported by Product Library page, Client Selections workflow, and EstimateBuilderWorkbook |
| Product Library | data/product-library/PRODUCTS-LIBRARY.csv | buildApprovedClientSelectionsCatalogue | 613 | approved source rows | CSV | Product Library import/model tests and approved selections catalogue builder |
| Quotation Builder | lib/construction-estimation/importedExcelWorkbookTemplate.json | quotation.sections[].rows | 1578 | quotation row | imported Excel JSON template | Consumed by createEstimateWorksheetV4Defaults() and EstimateBuilderWorkbook Quote Sheet |
| Quotation Builder | lib/construction-estimation/estimateWorksheetV4Schema.js | V4_QUOTE_SECTIONS | 18 | quote taxonomy labels | static JS array | Estimate worksheet/schema |
| Estimating Catalogue | components/estimate-builder/EstimateBuilderWorkbook.js | EstimatingCatalogueSheet | 1 | runtime sheet | workbook state | Estimate Builder workbook page |
| Estimating Catalogue | components/estimate-builder/EstimateBuilderWorkbook.js | deriveProductLibraryFromQuoteSheet | 1 | derived estimating/product rows | quotation sheet state | Estimating Catalogue/Product Library screens |
| Client Selections | pages/modules/builders/selections-book.js | queryClientSelectableProducts + getMasterProducts | 1 | consumer selector | Product Library master records plus embedded fallbacks | Active route imports catalogueModel/catalogueService and cabinetry/stone workflows |
| Cabinetry | lib/builders/cabinetryWorkflow.js | LAMINEX_CABINETRY_CATALOGUE | 53 | product/cabinet-finish | committed JSON via workflow adapter | Client Selections Cabinetry |
| Cabinetry | lib/builders/cabinetryWorkflow.js | POLYTEC_CABINETRY_CATALOGUE | 306 | product/cabinet-finish | committed JSON via workflow adapter | Client Selections Cabinetry |
| Cabinetry | lib/builders/cabinetryWorkflow.js | HANDLE_HOUSE_BASE_CATALOGUE | 8 | product/handles | static JS array | Client Selections Cabinetry |
| Cabinetry | lib/builders/cabinetryWorkflow.js | CABINETRY_BENCHTOPS | 5 | product/benchtop placeholder | static JS array | Client Selections Cabinetry |
| Benchtops | lib/builders/stoneBenchtopWorkflow.js | STONE_BENCHTOP_SUPPLIERS | 4 | product/benchtop suppliers | committed JSON/workflow adapter | Client Selections Cabinetry/benchtops |
| Benchtops | lib/builders/stoneBenchtopWorkflow.js | STONE_BENCHTOP_CATALOGUE | 148 | product/benchtop surfaces | committed JS catalogue | Client Selections stone benchtop workflow |
| Appliances | lib/builders/clientSelectionWorkflow.js | APPLIANCE_REQUIREMENTS | 6 | selection requirement | static JS array | Client Selections Appliances |
| Plumbing Fixtures | lib/builders/clientSelectionWorkflow.js | PLUMBING_FIXTURE_REQUIREMENTS | 9 | selection requirement | static JS array | Client Selections Plumbing Fixtures |
| Product Library family | lib/product-library/catalogueService.js | balustrades | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | bricks | 147 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | cabinet-finish | 1 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | cabinetry | 1 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | cladding | 10 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | cooktops | 5 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | decking | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | dishwashers | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | driveway | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | entry-doors | 142 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | exterior-paint | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | external-lighting | 87 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | flooring | 1 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | fridges | 1 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | garage-doors | 5 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | handles | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | kitchen-sink-mixers | 1 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | kitchen-sinks | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | landscaping | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | lighting | 1 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | microwaves | 1 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | ovens | 5 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | paint | 1 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | pool | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | rangehoods | 3 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | retaining-walls | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | roofing | 197 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | splashback | 1 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | stone-benchtops | 2 | product | committed JSON catalogue aggregation | Product Library / Client Selections |
| Product Library family | lib/product-library/catalogueService.js | windows | 9 | product | committed JSON catalogue aggregation | Product Library / Client Selections |

## Quotation Classification Totals

| Classification | Rows |
| --- | --- |
| estimating-item | 270 |
| unresolved | 515 |
| formula | 377 |
| assembly | 11 |
| allowance | 12 |
| product | 393 |

## Migration Status Totals

| Status | Rows |
| --- | --- |
| missing-estimating-catalogue-candidate | 270 |
| requires-review | 527 |
| not-a-catalogue-record | 377 |
| requires-assembly-model | 11 |
| missing-product-library-candidate | 393 |

## Duplicate Groups

Duplicate group count: 53

| Duplicate group | Rows |
| --- | --- |
| product:category:flooring-tiling:subcategory:floor-tiles:floor-tiles | 5 |
| product:category:flooring-tiling:subcategory:wall-tiles:wall-tiles | 5 |
| product:category:flooring-tiling:subcategory:skirting-tiles:skirting-tiles | 4 |
| product:category:windows-doors:subcategory:framed-vinyl-sliding-robe-doors:framed-vinyl-sliding-robe-doors | 4 |
| product:category:windows-doors:subcategory:framed-vinyl-specialty-colours:framed-vinyl-specialty-colours | 4 |
| product:category:windows-doors:subcategory:frameless-mirror:frameless-mirror | 4 |
| product:category:windows-doors:subcategory:frameless-superwhite-glass:frameless-superwhite-glass | 4 |
| product:category:windows-doors:subcategory:gyprock-doors:gyprock-doors | 4 |
| product:category:windows-doors:subcategory:mirror-doors:mirror-doors | 4 |
| product:category:windows-doors:subcategory:superwhite-glass:superwhite-glass | 4 |
| estimating-item:category:slab:subcategory:additional-cost-per-hour:additional-cost-per-hour | 3 |
| estimating-item:category:slab:subcategory:concrete-pump-rate:concrete-pump-rate | 3 |
| estimating-item:category:slab:subcategory:travel-cost:travel-cost | 3 |
| product:category:cabinetry:subcategory:stone-surfaces:upgrade-to-stone-tops | 3 |
| product:category:cabinetry:subcategory:upgrade-to-2-pac-doors:upgrade-to-2-pac-doors | 3 |
| product:category:plumbing-fixtures:subcategory:baths:bath-hob | 3 |
| product:category:plumbing-fixtures:subcategory:baths:frame-base-support-decina-galv | 3 |
| product:category:plumbing-fixtures:subcategory:tapware:kohler-viteo-pin | 3 |
| product:category:plumbing-fixtures:subcategory:tapware:raymor-academy-pillar | 3 |
| product:category:plumbing-fixtures:subcategory:tapware:raymor-clermont | 3 |
| estimating-item:category:external-cladding:subcategory:labour:blocklayer-labour | 2 |
| estimating-item:category:external-cladding:subcategory:labour:concrete-pump | 2 |
| estimating-item:category:external-cladding:subcategory:labour:core-filling-blockwork | 2 |
| estimating-item:category:external-cladding:subcategory:labour:piers | 2 |
| estimating-item:category:frame:subcategory:labour:extra-cost-for-3-0m-walls | 2 |
| estimating-item:category:lock-up-stage-labour:subcategory:labour:labour-for-fa-ade-detail | 2 |
| estimating-item:category:preliminaries:subcategory:statutory-fees:drafting-fees | 2 |
| estimating-item:category:roofing:subcategory:item:item | 2 |
| estimating-item:category:roofing:subcategory:roof-trusses:roof-trusses | 2 |
| product:category:external-cladding:subcategory:200-series-blocks-3-4-blocks:200-series-blocks-3-4-blocks | 2 |
| product:category:external-cladding:subcategory:200-series-blocks-halve-blocks:200-series-blocks-halve-blocks | 2 |
| product:category:external-cladding:subcategory:200-series-blocks:200-series-blocks | 2 |
| product:category:external-cladding:subcategory:face-bricks-base-range:face-bricks-base-range | 2 |
| product:category:external-cladding:subcategory:face-bricks-mid-range:face-bricks-mid-range | 2 |
| product:category:external-cladding:subcategory:item:item | 2 |
| product:category:external-cladding:subcategory:m12-rod:m12-rod | 2 |
| product:category:external-cladding:subcategory:mortar-mix-sand-cement-etc:mortar-mix-sand-cement-etc | 2 |
| product:category:flooring-tiling:subcategory:feature-tiles:feature-tiles | 2 |
| product:category:flooring-tiling:subcategory:freeze-tiles-50-x-200:freeze-tiles-50-x-200 | 2 |
| product:category:plumbing-fixtures:subcategory:baths:bath | 2 |

## Appliance Model Counts By Family And Brand

| Family | Brand | Selectable models |
| --- | --- | --- |
| cooktops | Westinghouse | 5 |
| dishwashers | Westinghouse | 2 |
| fridges | Westinghouse | 1 |
| microwaves | Westinghouse | 1 |
| ovens | Westinghouse | 5 |
| rangehoods | Westinghouse | 3 |

## Runtime Import Evidence

| Area | Runtime evidence |
| --- | --- |
| Product Library | `pages/modules/builders/product-library.js` imports `PRODUCT_FAMILIES`, `queryClientSelectableProducts`, and `getMasterProducts`; `lib/product-library/catalogueService.js` rebuilds master records from committed JSON catalogues. |
| Estimating Catalogue | `components/estimate-builder/EstimateBuilderWorkbook.js` renders `EstimatingCatalogueSheet` and derives current QS/rate rows from the quote sheet via `deriveProductLibraryFromQuoteSheet`. |
| Quotation Builder | `lib/construction-estimation/estimateWorksheetV4Defaults.js` consumes `importedExcelWorkbookTemplate.json` and builds active quote sections/rows. |
| Client Selections | `pages/modules/builders/selections-book.js` imports Product Library, appliance/plumbing requirements, cabinetry workflow catalogues, stone benchtop workflow, and reads/writes selection snapshots. |
| Cabinetry | `pages/modules/builders/selections-book.js` imports `LAMINEX_CABINETRY_CATALOGUE`, `POLYTEC_CABINETRY_CATALOGUE`, `HANDLE_HOUSE_BASE_CATALOGUE`, and `CABINETRY_BENCHTOPS` from `lib/builders/cabinetryWorkflow.js`. |
| Appliances | Appliance requirements live in `lib/builders/clientSelectionWorkflow.js`; actual models currently resolve from `getMasterProducts()` using appliance family keys. |
| Plumbing fixtures | Plumbing fixture requirements live in `lib/builders/clientSelectionWorkflow.js`; selectable fixture records are Product Library candidates, not estimating catalogue rows. |
| Benchtops | Cabinetry workflow uses placeholder benchtop choices; stone surface suppliers are exposed through `lib/builders/stoneBenchtopWorkflow.js` and master products are in the benchtop JSON catalogue. |
| Handles | Current Handle House handle records are embedded in `lib/builders/cabinetryWorkflow.js` and consumed by the active Client Selections route. |

## Duplicated Embedded Data

| Module | Duplicate/embedded source | Notes |
| --- | --- | --- |
| Client Selections | `pages/modules/builders/selections-book.js` static arrays | Entry door furniture, product option library, wet-area cabinetry config, window defaults, and image URL fallbacks remain embedded. |
| Product Library | `lib/product-library/catalogueModel.js` family taxonomy | Active taxonomy owner, but some family labels still need canonical category IDs rather than display names. |
| Quotation Builder | Imported Excel workbook template | Complete quote row list; should remain taxonomy source until stable IDs are formalized. |
| Estimating Catalogue | Workbook-derived QS/rate rows | Needs explicit estimating item master records before migration. |

## Source Safety Notes

- Product Library master records are currently rebuilt from committed JSON catalogues through `getMasterProducts()`.
- Quotation Builder rows are currently generated from `importedExcelWorkbookTemplate.json` by `createEstimateWorksheetV4Defaults()`.
- Client Selections active route is still `pages/modules/builders/selections-book.js`, but it was not modified by this generated audit.
- Existing archived or discontinued product records should remain resolvable for saved-job snapshots.
- Quotation rows should carry `sourceType/sourceId/sourceVersion` plus frozen description, image, unit, cost, sell price, GST treatment, and selected options.
