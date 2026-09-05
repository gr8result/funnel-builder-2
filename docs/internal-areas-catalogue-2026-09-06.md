# Internal Areas catalogue

The existing Product Library master/override service owns the imported records. Client Selections reads enabled canonical products; confirmed choices feed the workbook's Quotation Builder as selected product snapshots. Existing catalogue products and saved customer jobs were not reset or migrated.

## Catalogue and images

| Brand | Category | Enabled records |
| --- | --- | ---: |
| Hume Doors | Internal Doors | 340 |
| Corinthian Doors | Internal Doors | 246 |
| Gainsborough | Internal Door Furniture | 239 |
| Lockwood | Internal Door Furniture | 20 |
| Porta | Skirting & Architraves | 103 |
| **Total** | **586 doors, 259 hardware, 103 trim** | **948** |

There are 950 retained records, including two disabled records awaiting review. All 948 enabled records have local product images. The audit decoded 750 distinct product image files, plus three category images, with zero image failures and zero duplicate canonical IDs. Corinthian photographs represent the published model; Lockwood photographs represent the handle range. Cards label cases where the pictured construction, glazing, function or finish can differ.

Official sources: [Hume internal door finder](https://www.humedoors.com.au/door-finder?type=internal), [Corinthian internal doors](https://www.corinthian.com.au/doors/category/internal/), [Gainsborough](https://www.gainsboroughhardware.com.au/), [Lockwood locksets](https://www.lockweb.com.au/au/en/products/door-locks/locksets), and [Porta](https://www.porta.com.au/). Every record retains its specific official product/range URL, source image URL, downloaded local path and image verification status. Lockwood function codes and finishes are sourced from its official Key in Knob & Key in Lever catalogue, pages 11–15.

The application product code/ID is distinct from a manufacturer SKU. All enabled records have manufacturer model identifiers; 606 do not publish a single size/finish-specific order SKU and that SKU field remains blank. No manufacturer codes were invented.

Corinthian's 246 variations retain published QLD size prices and show the applicable GST-inclusive price after size selection. Quotation Builder receives an ex-GST base rate, retaining the published inclusive amount in the selection snapshot, so GST is not added twice. The other 702 enabled records require a verified quote. Hume's indicative state prices are retained as source information, not presented as a verified order price.

## Records held or excluded

- Porta `200081`: manufacturer listing is bullnose edging, not an architrave/skirting profile; retained disabled.
- Porta `601560`: no manufacturer product image was published; retained disabled with “Image awaiting verification.”
- Gainsborough official pages `715ALBLR.html`, `110LIA.html` and `715RIVLR.html` returned 404 and were excluded from the import.

See [machine-readable quality report](../data/product-library/catalogues/internal/INTERNAL-AREAS-QUALITY-REPORT.json) for record IDs, source URLs and counts.

## Behaviour

- Product Library displays one **Skirting & Architraves** card, with **Skirting** and **Architraves** subsections.
- Porta dual-use profiles have one canonical SKU. Separate requirement IDs preserve independently chosen skirting and architraves, quantities and quotation rows.
- The existing CSV/package exchange preserves canonical IDs, product codes, options, local image references and verification metadata. Combined and subsection exports are Excel-compatible CSVs; matching re-imports update records without duplicates.
- Client Selections exposes internal doors, hardware, skirting and architraves. Its shared picker offers brand/range/search, product photographs, details, Select, published finish/size/glazing/function/length options and quantity.
- Internal category routes use the existing sorted-query navigation guard and primitive effect dependencies. New selection rows retain the chosen snapshot without embedding the entire category catalogue in the job.
- Confirmed choices create/update `INTERNAL PRODUCTS - CLIENT SELECTIONS` quotation rows with canonical IDs, descriptions, images, options, quantities, units and the applicable price/quote-required state.
- Product and category image errors retain the layout and show a labelled verification fallback.

## Files changed for this task

| Area | Files |
| --- | --- |
| Canonical import and audit | `data/product-library/catalogues/internal/AU-INTERNAL-AREAS-CATALOGUE.json`, `INTERNAL-AREAS-IMPORT-REPORT.json`, `INTERNAL-AREAS-QUALITY-REPORT.json`; `scripts/import-internal-areas-catalogue.mjs`, `inspect-internal-catalogue-sources.mjs`, `audit-internal-areas-catalogue.mjs` |
| Existing catalogue service/schema/mapping | `lib/product-library/catalogueService.js`, `catalogueModel.js`, `productLibraryTaxonomy.js`, `exteriorCatalogueSections.js` |
| Existing import/export service | `lib/product-library/productLibraryExchange.js` |
| Product Library UI | `pages/modules/builders/product-library.js`; `components/product-library/VerifiedProductImage.jsx` |
| Client selection UI and requirements | `pages/modules/builders/selections-book.js`; `lib/builders/clientSelectionWorkflow.js`; `components/product-library/InternalCataloguePicker.jsx` |
| Selection/quotation projection | `lib/product-library/internalSelection.js`; `hooks/estimate-builder/useEstimateBuilderWorkbook.js`; `components/estimate-builder/EstimateBuilderWorkbook.js` |
| Media/source evidence | `public/images/product-library/internal-areas/`; official source captures in the existing `data/product-library/source-evidence/entry-door-furniture/` cache |
| Regression/live verification | `scripts/test-internal-areas-catalogue.mjs`, `test-selection-navigation.mjs`, `verify-internal-areas-live.mjs`, `verify-internal-quotation-live.mjs`; `test-artifacts/internal-areas-live/` |

## Verification

Canonical identity, official-source metadata, image decoding, enable/disable propagation, all four requirement selectors, CSV round trips, separate trim matching, quotation projection, quantity validation and GST handling pass regression tests. Existing package exchange, exterior furniture, manual exterior-door recovery and navigation guard tests also pass.

Targeted ESLint, including both new JSX components, passes with warnings (zero errors). Repository typecheck reports the existing backup-file error `test-results/job-persistence-repair-before/useJobFile.ts:13` (`../lib/jobFile` cannot be resolved). No clean full-repository typecheck is claimed.

Live test result is recorded in [runtime report](../test-artifacts/internal-areas-live/report.json). The test uses isolated Chrome and a synthetic saved job, blocks remote job mutations, and never opens the normal Takeoff route or the user's saved Takeoff payload.

The browser verified local category/product images for all four door/handle brands, the combined trim card and subsections, three real CSV downloads (103 unique IDs per scope), and the labelled image-error fallback. It selected and saved four products, refreshed, reopened the saved job file and confirmed all four selections remained visible. Back/Forward returned to the intended Client Selections route with zero page runtime errors.

The saved test job contains:

| Requirement | Selected model | Options/quantity | Quotation rate |
| --- | --- | --- | --- |
| Internal Doors | Corinthian ADECO 04S | White Oak Veneer, up to 2340 × 1020 × 35, 3 EACH | $835 ex GST; published $918.50 incl GST |
| Internal Door Furniture | Gainsborough 100OMIBC | Bright Chrome, Passage, 4 EACH | Quote required |
| Skirting | Porta 200067 | Bullnose 41 × 18 mm Meranti, 2.1 m, 10 LENGTH | Quote required |
| Architraves | Porta 200067 | Same canonical profile, independently saved, 6 LENGTH | Quote required |

Evidence: [category cards](../test-artifacts/internal-areas-live/01-internal-category-cards.png), [Corinthian products](../test-artifacts/internal-areas-live/02-Corinthian-Doors.png), [Gainsborough products](../test-artifacts/internal-areas-live/02-Gainsborough.png), [reopened handle selection](../test-artifacts/internal-areas-live/07-reopened-Internal-Door-Furniture.png), [reopened skirting](../test-artifacts/internal-areas-live/07-reopened-Skirting.png), and [reopened architraves](../test-artifacts/internal-areas-live/07-reopened-Architraves.png).

The separate [quotation runtime report](../test-artifacts/internal-areas-live/quotation-runtime-report.json) verifies the actual left-navigation transition from the reopened test job, four rendered product rows, retained quantities and Quote-required labels. Its [quotation screenshot](../test-artifacts/internal-areas-live/08-quotation-saved-products.png) is the quotation visual evidence; the earlier `06` capture used a direct URL navigation and is superseded.
