# Whirlpool and Euromaid HNC import and browser verification

Completed locally on 16 September 2026. The running Product Library shows **Bosch | Euromaid | Omega | Smeg | Westinghouse | Whirlpool** using the existing catalogue-driven brand cards. Whirlpool has its official Australian logo. No commit, push, merge or deployment was performed.

| Brand | Current products | Exact images | Published HNC prices | Client-selectable | Visible packages |
| --- | ---: | ---: | ---: | ---: | ---: |
| Whirlpool | 41 | 41 | 39 | 39 | 0 |
| Euromaid | 38 | 38 | 38 | 36 | 0 |

All four review-held models remain browsable, with their source discrepancy shown in details and selection disabled. Counts come from the actual catalogue and eligibility selectors.

## Source coverage and changes

[HNC Whirlpool](https://www.harveynormancommercial.com.au/brands/whirlpool) returned 41 products across pages of 25 and 16. The brand-page and unrestricted brand queries agreed. [HNC Euromaid](https://www.harveynormancommercial.com.au/brands/euromaid) returned 38 across pages of 28 and 10 without category restrictions. Each import reconciles returned models against the supplier's declared total and preserves pagination evidence.

| Family | Whirlpool | Euromaid |
| --- | ---: | ---: |
| Ovens | 12 | 7 |
| Cooktops | 10 | 8 |
| Rangehoods | 2 | 13 |
| Dishwashers | 10 | 3 |
| Freestanding cookers | 0 | 6 |
| Microwaves | 2 | 1 |
| Washing machines | 4 | 0 |
| Dryers | 1 | 0 |
| Fridges, freezers, washer dryers, other appliances/accessories | 0 | 0 |

Zeroes describe the complete current HNC brand results, not the brands' entire worldwide ranges. No products were invented to populate empty categories.

The canonical catalogue increased from **228 to 295 records**: 41 Whirlpool additions and 26 Euromaid additions. Twelve existing Euromaid models were updated from current exact-model sources. All 22 original Euromaid stable IDs and original cost/sell/tenant price fields remain intact. HNC public SRP including GST is stored and displayed separately; no trade cost or tenant price was inferred for new products.

Ten Euromaid historical models are absent from the complete current HNC result and are hidden from new selections: `ECCK900`, `GC90S`, `KCS4`, `WK60S`, `EDW14S`, `GG90S`, `CS60S`, `FS90S`, `RS6S`, `RS9S`. Their records remain addressable by historical ID. Exact manufacturer images were also obtained for RS6S and RS9S; archived official documents were recorded for EDW14S and GG90S. Absence from HNC is not presented as proof of manufacturer discontinuation. No replacement-model substitutions were made.

The package file is byte-for-byte unchanged. Existing Euromaid packages contain retired components and are therefore unavailable for new selection; their historical relationships still resolve. All other brands' canonical product data and existing brand metadata are unchanged from the safety copy.

Whirlpool images comprise **40 exact HNC photographs and one exact official Whirlpool Australia fallback** for manufacturer model `W4OMK581HU1BAUS` (HNC SKU `W4OMK581HU1BA`). Both identifiers are preserved. All 38 current Euromaid photographs came from their exact HNC SKU galleries. Images are local, decoded, hash-checked and attributed; no generated, generic or similar-model image was substituted.

## Outstanding source limitations

| Model | Verified limitation / treatment |
| --- | --- |
| Whirlpool FWEB9012IW | HNC says 10 kg; exact manufacturer source says 9 kg. Both retained; review hold. |
| Whirlpool W7MWBLAUS | HNC says 16 functions; manufacturer says 17. Both retained; review hold. |
| Euromaid ECE641T | HNC title says induction; exact manufacturer model is ceramic. Manufacturer display title used, raw HNC title retained; review hold. |
| Euromaid EC95GLB | HNC title says 600 mm; HNC dimensions are 880 mm wide and manufacturer title says 90 cm. Source values retained; review hold. |
| Whirlpool WIO3033PELAUS, W6OMPBSOC | HNC supplies no numeric public price; shown as quote required. |
| Whirlpool AKC640IXOC | Neither exact source publishes height; height remains null. |

Other unpublished fields also remain null/unsupplied. Whirlpool marks W7MWBLAUS and W6OMPBSOC as archived while HNC still lists them; this source distinction is retained. These are source limitations, not omitted import work.

The broader image-integrity scan identified one existing unrelated failure: Omega `ORC93XA` has non-WebP bytes under `orc93xa.webp`. Its file predates this task and was not changed. It does not affect the 79 Whirlpool/Euromaid image checks.

## Runtime and validation

Authenticated Chrome opened the actual local application, clicked both **Browse Brand** buttons, and verified all 79 product cards, model numbers, exact loaded images and selection-button states. It exercised model search, every populated category, return to All product types, active/selectable filters, 13 representative detail pages covering all populated families, source specifications, descriptions, verified HNC prices and provenance links. Refresh preserved each brand's products and the six-brand landing page.

Final full run: **PASS, no page/runtime errors**. An earlier attempt exposed a test synchronization issue when two categories each had ten cards; the harness now waits for the exact model IDs rather than only the count. Another attempt logged an isolated script parse error during navigation; the complete rerun with stack capture passed with no recurrence. Background account/usage authorization and favicon diagnostics remain recorded in the browser report and did not prevent catalogue operation.

The embedded route `/modules/estimate-builder?page=productLibrary&catalogue=appliances` also passed its authenticated six-card and refresh check. No job fixture or server-side catalogue write was needed for browser verification.

Evidence:

- [Final full browser report](../artifacts/test-artifacts/hnc-appliances-20260916/both-brands-browser-report.json)
- [Embedded route report](../artifacts/test-artifacts/hnc-appliances-20260916/smoke-browser-report.json)
- [Six brand cards](../artifacts/test-artifacts/hnc-appliances-20260916/01-six-brand-cards.png)
- [Whirlpool products](../artifacts/test-artifacts/hnc-appliances-20260916/whirlpool-products.png)
- [Euromaid products](../artifacts/test-artifacts/hnc-appliances-20260916/euromaid-products.png)
- [Whirlpool source/pagination report](../data/catalogue/reconciliation/WHIRLPOOL_HNC_RANGE_IMPORT_REPORT.json)
- [Euromaid source/pagination report](../data/product-library/source-evidence/euromaid/hnc-complete-range-2026-09-16/coverage-report.json)

Passed checks:

- `node scripts/test-whirlpool-hnc-range.mjs`
- `node scripts/test-euromaid-hnc-range.mjs`
- `node scripts/test-hnc-appliance-integration.mjs`
- `node scripts/test-appliance-expanded-brand-families.mjs`
- `node --import ./scripts/register-json-loader.mjs scripts/test-appliance-retirement-filtering.mjs`
- `node --import ./scripts/register-json-loader.mjs scripts/test-appliance-brand-removal.mjs`
- `node scripts/verify-hnc-appliance-library-live.mjs`
- Embedded route smoke check using `PRODUCT_LIBRARY_TEST_URL` and `--smoke`.
- Targeted ESLint: zero errors, 16 existing page warnings. JSX parsing and scoped `git diff --check` passed.

The whole-catalogue image-integrity command reported only the existing Omega issue described above. All 79 imported current product images pass source ownership, file hash, dimensions and browser-load checks. Catalogue JSON parses successfully: 295 unique IDs and brand/model identities, no missing historical IDs, no null bytes or pathological blank lines.

## Files changed by this task

| Files | Changes |
| --- | --- |
| `data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json` | Merge exact Whirlpool and Euromaid data, source provenance, review holds and historical retirement flags; retain existing IDs/prices. |
| `data/product-library/catalogues/appliances/AU-APPLIANCE-BRANDS.json` | Add official Whirlpool metadata/logo to the common brand architecture. |
| `data/product-library/catalogues/appliances/AU-WHIRLPOOL-HNC-RANGE.json`, `AU-EUROMAID-HNC-RANGE.json` | Complete reproducible source snapshots. |
| `data/catalogue/reconciliation/WHIRLPOOL_HNC_RANGE_IMPORT_REPORT.json`, `HNC_APPLIANCE_INTEGRATION_REPORT.json` | Source coverage, conflicts and integration validation. Integration report describes the latest merge invocation; task-wide additions are 41 Whirlpool and 26 Euromaid. |
| `data/product-library/source-evidence/euromaid/hnc-complete-range-2026-09-16/` | Pagination, exact product/manufacturer responses, price/image evidence and archived documents. |
| `public/images/catalogues/appliances/products/whirlpool/`, `.../euromaid/` | 41 Whirlpool images and 40 Euromaid images, including two historical exact-model images. |
| `public/images/catalogues/appliances/brands/whirlpool-official.png` | Official Whirlpool Australia logo. |
| `lib/product-library/applianceCatalogueSelectorsCore.js` | Additional appliance families; accurate selectable counts/eligibility; HNC reference-price fallback; SKU/specification search. |
| `lib/product-library/applianceCataloguePresentation.js` | HNC price labels, full specification rendering and shared family recognition. |
| `components/product-library/ApplianceCard.jsx` | Exact-image-only rendering, explicit missing-image text, HNC price labels and selection safeguards. |
| Appliance portions of `pages/modules/builders/product-library.js` | Correct category clearing, expanded details/provenance, source-review notices and consistent selection safeguards. |
| `scripts/product-library/import-whirlpool-hnc-range.mjs`, `import-euromaid-hnc-range.mjs`, `integrate-hnc-appliance-ranges.mjs` | Source-specific importers and validated merge preserving existing rows and prices. |
| `scripts/test-whirlpool-hnc-range.mjs`, `test-euromaid-hnc-range.mjs`, `test-hnc-appliance-integration.mjs`, `test-appliance-expanded-brand-families.mjs`, `verify-hnc-appliance-library-live.mjs` | Source/data integrity, regression and actual-browser checks. |
| `docs/euromaid-hnc-range-2026-09-16.md`, this report | Source findings, exact changes and acceptance results. |

Additional local evidence and safety copies are under `artifacts/catalogue/whirlpool-hnc-20260916/`, `artifacts/euromaid-hnc-20260916/`, `artifacts/recovery/hnc-appliances-20260916/`, and `artifacts/test-artifacts/hnc-appliances-20260916/`.

This task did not edit Takeoff, Job Setup, Freedom or Cabinetry modules. Pre-existing working-tree changes were preserved.
