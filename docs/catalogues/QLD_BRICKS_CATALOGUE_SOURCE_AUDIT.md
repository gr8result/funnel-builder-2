# Queensland Bricks Master Catalogue Source Audit

Research date: 2026-08-13

Scope: Bricks only. Queensland/South Queensland selectable dataset for the first Gr8 Result Master Product Catalogue population pass.

## Sources Used

### PGH Bricks

- PGH Bricks range index: https://www.pghbricks.com.au/products/bricks/browse-bricks/range
- PGH Horizon range page: https://www.pghbricks.com.au/products/bricks/browse-bricks/range/horizon
- PGH Smooth range page: https://www.pghbricks.com.au/products/bricks/browse-bricks/range/smooth

PGH source notes:

- The Horizon page identifies the Horizon range and describes Rockhampton, Emerald, Mitchell, and St George as range colours. The page gallery also exposes Airlie, Emerald, and Rockhampton product-specific manufacturer imagery.
- The Smooth page identifies the Smooth range and exposes product-specific manufacturer imagery for Black and Tan, Brown, Cream, Mineral, Oat, Pearl Grey, Red, Sable Grey, and Volcanic.
- No public exact Queensland retail price was found on the official PGH range pages during this pass. PGH records are therefore `quote_required`.
- PGH pages provide a `Request Pricing` action and range-level resources. Individual product URLs were not exposed in the static page payload used for this import, so the official range URL is retained as the product URL for PGH rows.

### Austral Bricks

- Austral Bricks South Queensland home/catalogue context: https://australbricks.com.au/sqld
- Austral Bricks South Queensland range listing for La Paloma: https://australbricks.com.au/sqld/products/la-paloma-2
- Austral Bricks South Queensland product page for La Paloma Azul: https://australbricks.com.au/sqld/product/la-paloma?v=3690
- Austral Bricks South Queensland product page for La Paloma Castellana: https://australbricks.com.au/sqld/product/la-paloma?v=3684
- Austral Bricks South Queensland product page for La Paloma Miro: https://australbricks.com.au/sqld/product/la-paloma?v=3311
- Austral Bricks South Queensland product page for La Paloma Romero: https://australbricks.com.au/sqld/product/la-paloma?v=3303
- Austral Bricks South Queensland range listing for San Selmo Classico: https://australbricks.com.au/sqld/products/san-selmo-classico
- Austral Bricks South Queensland product page for San Selmo Classico Aged Red: https://australbricks.com.au/sqld/product/san-selmo-classico?v=3493
- Austral Bricks South Queensland product page for San Selmo Classico Limewash: https://australbricks.com.au/sqld/product/san-selmo-classico?v=3489
- Austral Bricks South Queensland product page for San Selmo Classico Original: https://australbricks.com.au/sqld/product/san-selmo-classico?v=3496
- Austral Bricks South Queensland retail price list page checked: https://australbricks.com.au/sqld/retail-price-lists
- Austral Bricks South Queensland technical information page: https://australbricks.com.au/sqld/technical-information
- Austral Bricks South Queensland brochures page: https://australbricks.com.au/sqld/brochures

Austral source notes:

- The South Queensland menu and range pages expose Queensland-specific catalogue navigation under `/sqld`.
- The South Queensland product pages expose individual product variant URLs, SKU values, swatch image URLs, and product gallery images.
- The retail price-list page was checked, but no downloadable public PDF price list link was exposed in the static response used for this pass.
- The South Queensland product responses did not expose a reliable exact current retail price during this pass. Austral records are therefore `quote_required`.

## Imported Catalogue Counts

- Total manufacturers: 2
- Total ranges: 4
- Total products: 14
- PGH ranges imported: 2
- PGH products imported: 7
- Austral ranges imported: 2
- Austral products imported: 7

## PGH Ranges Imported

- Horizon: Airlie, Emerald, Rockhampton
- Smooth: Black and Tan, Mineral, Oat, Pearl Grey

## Austral Ranges Imported

- La Paloma: Azul, Castellana, Miro, Romero
- San Selmo Classico: Aged Red, Limewash, Original

## Image Provenance

- Products with exact/product-specific images: 14
- Products using range-fallback images: 0
- Products missing images: 0
- Products flagged image review required: 0

Primary image rules applied:

- Austral primary images use exact manufacturer swatch URLs from the South Queensland product pages.
- PGH primary images use product-specific manufacturer gallery imagery from the official PGH range pages. These are retained as `verified_exact` because the image captions identify the exact brick colour and range.
- Gallery images may include facade/application images only after the exact/product-specific primary image.
- No random Google Images, Pinterest images, builder blog images, bedroom images, bathroom images, or AI-generated images were used.

## Pricing Provenance

- Products with current exact public price: 0
- Products requiring quote: 14
- Products with price pending: 0
- Products with `$0` price: 0

Pricing notes:

- PGH range pages expose request-pricing pathways rather than current exact public Queensland prices.
- Austral South Queensland product and retail-price-list pages were checked, but exact current public retail prices were not reliably available in the static source responses used for this pass.
- Unknown prices are stored as `priceStatus=quote_required` with blank `rrp`, blank `client_price`, and no `$0`.
- Austral rows retain `priceUnit=each` where the product catalogue context exposes product unit semantics. PGH rows leave `priceUnit` blank because no safe public unit was verified.

## Regional Availability

- Products explicitly included for Queensland: 14
- Products with `regions` containing `QLD`: 14
- Products with `regionReviewRequired=true`: 0
- Products excluded because they appeared NSW-only or not Queensland-selectable: Whitsunday Brampton and Urban One Pepper from indexed Austral search results were not included.

## Import Results

Preview result from `previewMasterProductImport`:

- Total products: 14
- New: 14
- Updates: 0
- Unchanged: 0
- Errors: 0
- Warnings: 0
- Missing images: 0
- Missing official URLs: 0
- Missing/quote-required prices: 14

Commit result from `commitMasterProductImport`:

- Created: 14
- Updated: 0
- Skipped unchanged: 0
- Invalid: 0

## Builder-Enabled Demo Subset

The test/demo organisation enablement subset is intentionally not global. It enables 8 products in `scripts/test-qld-bricks-master-catalogue.mjs`:

- PGH Horizon Airlie
- PGH Horizon Emerald
- PGH Smooth Black and Tan
- PGH Smooth Pearl Grey
- Austral La Paloma Azul
- Austral La Paloma Miro
- Austral San Selmo Classico Aged Red
- Austral San Selmo Classico Original

This subset demonstrates:

- 2 PGH ranges
- 2 Austral ranges
- Multiple actual brick products within each manufacturer
- Builder tiers separate from manufacturer ranges

## Mapping Warnings

- PGH product rows use the official range URL as `officialProductUrl` because individual product colour URLs were not exposed in the PGH static payload during this pass.
- PGH dimensional fields are blank because exact dimensions were not published in the inspected PGH source payload.
- Austral dimensions are stored as `230x110x76mm` for the imported La Paloma and San Selmo Classico variants based on official Austral product-page technical data exposed for those product families.
- No incomplete or uncertain regional rows were hidden; rows with uncertain Queensland availability were excluded rather than guessed.
