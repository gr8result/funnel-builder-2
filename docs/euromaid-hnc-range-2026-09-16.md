# Euromaid HNC range verification — 16 September 2026

The staged [Euromaid range](../data/product-library/catalogues/appliances/AU-EUROMAID-HNC-RANGE.json) contains all **38 products** returned by Harvey Norman Commercial's public Euromaid brand query, without a category restriction. The query returned two pages: 28 and 10 unique SKUs, matching its `total_count` of 38. Captured queries, variables, responses and product pages are in [source evidence](../data/product-library/source-evidence/euromaid/hnc-complete-range-2026-09-16/coverage-report.json).

| Category | Products |
| --- | ---: |
| Ovens | 7 |
| Freestanding cookers | 6 |
| Cooktops | 8 |
| Rangehoods | 13 |
| Dishwashers | 3 |
| Microwaves | 1 |

The global HNC response contained no laundry or refrigeration products. Those categories were not excluded. The public source is [HNC Euromaid](https://www.harveynormancommercial.com.au/brands/euromaid), backed by its public Magento GraphQL endpoint. This is a complete snapshot of HNC's listed range, not a claim about every Euromaid product sold elsewhere.

All 38 products have exact-model matches on Euromaid Australia's official website, local HNC product photographs, full captured supplier descriptions, manufacturer specifications, dimensions, finish, and verified HNC public SRP including GST. Each price matches both HNC's `price_store` and displayed product-page SRP; zero platform/trade fields are not imported as prices. Unknown fields remain null. Adjustable dimensions retain their full raw value and a separate minimum/maximum range.

All 38 selected images belong to the corresponding exact HNC SKU's gallery. Their local bytes, SHA-256, dimensions, source URL and source organisation are recorded per product. The [contact sheet](../artifacts/euromaid-hnc-20260916/all38-contact-sheet.png) was visually reviewed: all depict the relevant appliance type, with no placeholders or technical drawings. Two additional exact manufacturer photographs were staged for historical RS6S and RS9S records. No generated images or similar-model substitutions were used.

Twelve of the previous 22 Euromaid models match current HNC models exactly; 26 current models are additions. Existing stable IDs and original price values are recorded for integration. Ten historical models are absent from the complete HNC result:

| Models | Evidence status |
| --- | --- |
| RS6S, RS9S | Exact manufacturer pages and photographs found; absent from HNC |
| EDW14S, GG90S | Exact archived manufacturer specification PDFs found; absent from HNC |
| ECCK900, GC90S, KCS4, WK60S, CS60S, FS90S | Exact current manufacturer product pages not established by this audit; absent from HNC |

The archived [EDW14S specification](https://www.euromaid.com/sites/g/files/emiian466/files/2021-03/EDW14S-Spec-Sheet-20200316.pdf) and [GG90S product card](https://www.euromaid.com/sites/g/files/emiian466/files/2021-04/GG90S_Product-Card.pdf) are retained locally with hashes. Archived documents and absent supplier listings do not establish manufacturer discontinuation. Historical IDs should remain available to existing selections; this staging importer does not change catalogue retirement settings.

Two source conflicts remain explicitly recorded for integration review. HNC calls ECE641T an induction cooktop, while the exact official model is a **60 cm ceramic cooktop**. HNC calls EC95GLB a 600 mm model, while its own dimensions are 880 mm wide and the exact official title identifies the **90 cm gas cooktop**. Staged display titles use those exact manufacturer titles, while preserving both raw HNC titles and discrepancy details. Neither record is replaced with another model.

The importer changes only the dedicated staging JSON, Euromaid evidence, and local Euromaid images. It does not write the shared appliance catalogue or brand definitions. Separate integration determines active selections and review holds.

Validation passed: `node scripts/test-euromaid-hnc-range.mjs`. It verifies complete source pagination, every exact source SKU, manufacturer matching, image ownership and file hashes/dimensions, displayed prices, adjustable dimensions, preservation of the 12 existing IDs/prices, all 10 absent historical models, archived document hashes, and both documented title conflicts. Reproduction command: `node scripts/product-library/import-euromaid-hnc-range.mjs`; same-date runs reuse the captured source evidence.
