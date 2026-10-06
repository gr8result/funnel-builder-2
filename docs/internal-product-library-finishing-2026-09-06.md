# Internal Product Library finishing

Product Library supplies the canonical records used by Client Selections and Quotation Builder. Builder edits remain organisation-specific overrides.

## Catalogue changes

| Catalogue | Result |
| --- | --- |
| Internal Doors card | User-supplied `internal door.jpg`, copied unchanged into permanent local assets; original aspect ratio and `object-fit: cover` |
| Corinthian | 246 records, 160 model names audited; exact official front images stored locally; no unresolved model matches |
| Hume | Existing 340 product images retained |
| Skirting & Architraves | 105 records before; 11 duplicates removed; 22 records merged in 11 groups; 94 canonical records after, including 92 active and two previously held edging items |
| Stairs & Stair Components | 13 new records, one in each requested section |
| Wardrobe Systems | 16 new records covering all 11 requested sections |

Trim identity is brand, product type, profile, width, thickness, material and finish. Supplied length is excluded. Every trim uses a builder standard stock length of 5.4 m; supplier availability still requires confirmation. Previous product codes, IDs and SKUs are retained as import aliases, together with original supplier variants.

There were no verified trim prices to convert. All 94 trim rates are explicitly labelled editable builder estimates in AUD including GST, not supplier quotations. `price_per_linear_metre`, `stock_length_m` and `price_per_stock_length` are stored in the canonical records and attributes. Editing either price recalculates the other. Stock prices round to cents; linear rates retain four decimal places for reverse calculations.

Stair entries are explicitly configurable builder catalogue references based on Stairlock and StairMaster offerings, with site-dependent dimensions and Quote required. Wardrobes comprise 13 Flexi Storage components/units, two configurable Flexi Storage bundles and one Liyana Cabinet double-hanging cabinet. The 700 mm Liyana variant has a verified published $381 price including GST. Other wardrobe entries require a quote.

## Images and sources

All product imagery is local. Manufacturer attribution and original URLs are recorded in:

- `data/product-library/source-evidence/internal-finishing/CORINTHIAN-IMAGE-AUDIT.json`
- `data/product-library/source-evidence/internal-finishing/INTERNAL-SYSTEMS-IMAGE-SOURCES.json`
- `data/product-library/source-evidence/internal-finishing/LOCAL-IMAGE-AUDIT.json`
- `public/images/product-library/internal-areas/category-internal-door.source.json`

The only different Corinthian model names sharing an image are PMDF and Premium PMDF, which have the same visible flat door design. Construction variants of one model also share its design image. All 838 distinct images used by 966 enabled internal catalogue records were checked for valid image dimensions.

Manufacturer sources: [Corinthian](https://www.corinthian.com.au/), [Stairlock custom stairs](https://stairlock.com.au/products/custom-staircases/), [StairMaster](https://stairmaster.com.au/), [Flexi Storage](https://flexistorage.com.au/wardrobe/walk-in-wardrobe/), [Liyana double-hanging cabinet](https://liyanacabinet.com.au/products/white-wardrobe-tall-cabinet-double-hanging-rod). Manufacturer copyright is retained; these are not described as Creative Commons images.

## Implementation files

- `pages/modules/builders/product-library.js`: shared view control, rendering order, category/brand-scoped ranges, section filtering, export controls and trim editing.
- `components/product-library/TrimCatalogueRate.jsx`: linked GST-inclusive trim price inputs and specification display.
- `lib/product-library/cataloguePresentation.js`: sorting, scoped filter values, trim identity/rates and internal subsection definitions.
- `lib/product-library/productLibraryExchange.js`: legacy trim alias matching and canonical import updates.
- `lib/product-library/productLibraryTaxonomy.js`: category names, local card images and quotation mapping.
- `lib/product-library/catalogueService.js` and `catalogueModel.js`: registration of the stairs/wardrobe canonical source and update timestamps for sorting builder edits.
- `pages/modules/builders/selections-book.js`: internal category links, supplied door image, and access to the stair/wardrobe pickers.
- `lib/product-library/internalSelection.js` and `lib/builders/clientSelectionWorkflow.js`: stairs/wardrobe selection requirements and quotation snapshots.
- `data/product-library/catalogues/internal/AU-INTERNAL-AREAS-CATALOGUE.json` and `AU-INTERNAL-SYSTEMS-CATALOGUE.json`: canonical products.
- `scripts/deduplicate-internal-trims.mjs`, `scripts/correct-corinthian-front-images.mjs`, `scripts/import-internal-systems.mjs`: repeatable data maintenance. The existing internal-areas importer reapplies trim normalisation and audited Corinthian imagery after refreshing suppliers.

## Verification

Passing automated checks:

- `scripts/test-internal-catalogue-finishing.mjs`: identity/counts, all six sort modes, category ranges, alias re-import in add/update modes, linked pricing and canonical selection/quotation fields.
- `scripts/test-internal-areas-catalogue.mjs`: all 968 internal records, 966 enabled records, CSV round trips, enablement and quotation contracts.
- `scripts/audit-internal-local-images.mjs`: all local product image files decode; unrelated Corinthian models do not share images.
- `scripts/test-exterior-catalogue-grouping.mjs`: existing Exterior parent grouping and downstream mappings remain valid.
- ESLint: changed application files have no errors.

Browser evidence is in `test-artifacts/internal-finishing-live/report.json` and the accompanying grid/list screenshots. It covers all five internal catalogues, all six sorts in both views, all stair/wardrobe section filters, image loading and view persistence after reload.

`test-artifacts/internal-finishing-sync-live/report.json` also passes. The browser verified:

- Brand changes clear an invalid selected Product range.
- $10/lm recalculates to $54/5.4 m; editing the stock price to $108 recalculates to $20/lm. Saving the edit moves that product to the top of Recently updated.
- Section CSVs contain 92 skirting records, 92 architrave records, one stair-tread record and one double-hanging wardrobe record, with the correct section attributes.
- Confirmed doors, hardware, skirting, architraves, stairs and wardrobes produce six persisted quotation rows with canonical IDs, descriptions, local images, units, quantities and pricing states. Quote-required products retain a blank rate rather than a fabricated zero price.
- The published $381 GST-inclusive wardrobe price transfers as a $346.3636 base rate, with Quotation Builder adding GST once. Door and hardware prices occupy separate rows.

`scripts/verify-shared-catalogue-controls-live.mjs` additionally tests all six sorts in both views for Westinghouse ovens. Its evidence is in `test-artifacts/internal-finishing-sync-live/shared-controls-report.json` and the appliance screenshots. Browser tests use isolated test job files and block external database writes.
