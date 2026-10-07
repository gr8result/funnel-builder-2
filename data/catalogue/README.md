# Catalogue working data

These files were at the repository root until 2026-09-07. They are data, not documentation —
the reports that read alongside them live in [`docs/catalogue/`](../../docs/catalogue/), and the
full relocation map is in [`docs/README.md`](../../docs/README.md).

## `reconciliation/` — generated, do not hand-edit

Every file here is rewritten by a script. Re-run the script rather than editing the CSV.

| Script | Writes |
|---|---|
| `scripts/generate-appliance-canonical-catalogue.mjs` | `APPLIANCE_IMAGE_AND_SOURCE_AUDIT.csv`, `APPLIANCE_MANUAL_REVIEW_QUEUE.csv`, `APPLIANCE_IDENTITY_VARIATION_RESOLUTION.csv`, `APPLIANCE_PRODUCT_RESEARCH_LOG.csv`, `APPLIANCE_FIELD_SOURCE_AUDIT.csv`, `APPLIANCE_IMAGE_LICENSING_REVIEW.csv` (plus two reports into `docs/catalogue/`) |
| `scripts/generate-appliance-checkpoint-a-product-library.mjs` | `APPLIANCE_PRODUCT_IMAGE_AUDIT.csv`, `APPLIANCE_PRODUCT_SOURCE_AUDIT.csv`, `APPLIANCE_MISSING_IMAGE_REVIEW.csv`, `APPLIANCE_BRAND_COVERAGE.csv`, `APPLIANCE_WORKBOOK_RECONCILIATION.csv` |
| `scripts/generate-appliance-stage3b-checkpoint1.mjs` | `APPLIANCE_PRODUCT_DEDUPLICATION.csv`, `APPLIANCE_PACK_COMPONENT_MAPPING.csv`, `APPLIANCE_UNRESOLVED_ROWS.csv`, `APPLIANCE_CHECKPOINT1_RESULT_COMPARISON.csv`, `APPLIANCE_PRICE_CONFLICT_REVIEW.csv` |
| `scripts/generate-master-catalogue-stage2-reports.mjs` | `MASTER_CATALOGUE_QUOTATION_MAPPING.csv` |
| `scripts/generate-master-catalogue-stage3a-reconciliation.mjs` | `MASTER_CATALOGUE_RECONCILED_MAPPING.csv`, `MASTER_CATALOGUE_DUPLICATE_REVIEW.csv`, `MASTER_CATALOGUE_UNRESOLVED_REVIEW.csv` |
| `scripts/generate-product-library-taxonomy-mapping.mjs` | `PRODUCT_LIBRARY_QUOTATION_PRODUCT_MAPPING.csv` |

Read back by `scripts/apply-appliance-official-image-audit.mjs`,
`scripts/enrich-appliance-imagery-from-sources.mjs`,
`scripts/test-master-catalogue-stage3a-reconciliation.mjs` and
`scripts/test-product-library-checkpoint-a-correction.mjs`.

## `imports/` — hand-maintained templates

`PRODUCT_LIBRARY_IMPORT_TEMPLATE.csv` and `ESTIMATING_CATALOGUE_IMPORT_TEMPLATE.csv` are the
column contracts for catalogue imports. Documented in
[`docs/catalogue/PRODUCT_LIBRARY_CSV_IMPORT_GUIDE.md`](../../docs/catalogue/PRODUCT_LIBRARY_CSV_IMPORT_GUIDE.md);
`scripts/generate-master-catalogue-stage2-reports.mjs` reads their headers.

## `raw/` — scraped supplier pages

Stone benchtop supplier pages captured on 2026-08-31 while building the stone catalogue
(`tmp-caesarstone.html`, `tmp-neolith.html`, `tmp-smartstone.html`, `tmp-stoneambassador.html`,
and the extracted `tmp-neolith-state.js`). Kept as provenance for the prices and product names in
the stone catalogue. No code reads them; they are safe to delete once the catalogue is
independently sourced. The `tmp-` prefix is the original filename, retained so the files stay
traceable to the scrape that produced them.

## Not here

The curated, authoritative product data is `data/product-library/` — unchanged by this move.
