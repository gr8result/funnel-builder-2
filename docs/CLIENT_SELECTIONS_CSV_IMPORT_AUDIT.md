# Client Selections CSV Import Audit

Source of truth: `data/product-library/PRODUCTS-LIBRARY.csv`

The approved CSV is treated as the source for which requirements belong in the visible Client Selections workflow. It is parsed into a deterministic import model, then mapped into catalogue entities for product/image/price enrichment.

## Row Counts

| Metric | Count |
| --- | ---: |
| Total physical rows | 746 |
| Usable item rows | 614 |
| Rows with identifiable commercial models/products | 249 |
| Generic/specification rows | 365 |
| Rows already priced or allowance-priced | 196 |
| Rows missing price | 418 |
| Duplicate description groups | 96 |
| Rows requiring manual mapping | 170 |

## Import Model

Each usable row is preserved with:

- `sourceRow`
- `sourceSection`
- `sourceDescription`
- `quoteItemCode`
- `requirementKey`
- `familyKey`
- `categoryKey`
- `topLevelArea`
- `unit`
- `quantity`
- `allowance`
- `rate`
- `productSpecific`
- `identifiableBrand`
- `identifiableModel`
- `imageRequired`
- `priceRequired`
- `priceStatus`

Repeated `CODE` headers, blank rows, and repeated section headings are excluded from usable products but retained in audit counts.

## Classification

Specific commercial products are detected when the row contains an identifiable brand/model signal such as Hume, Colorbond, Westinghouse, Smeg, Bosch, Caroma, Phoenix, Oliveri, Franke, Dulux, Monier, Austral, Brickworks, National Tiles, Godfrey Hirst, or Timberline.

Generic rows remain generic. They are not assigned invented brands, model names, supplier URLs, product URLs, exact images, or prices.

## Price Rules

Unknown price is never converted into a current `$0` price.

- Identifiable product with price: `current`
- Generic row with allowance/rate: `allowance_only`
- Identifiable product missing price: `price_pending`
- Generic row missing price: `quote_required`

## Image Rules

Identifiable products are marked `imageReviewRequired = true` until exact product imagery is enriched.

Generic rows use family-matched generic imagery only, such as oven, cooktop, garage door, brick, internal door, tapware, basin, bath, flooring, paint, or retaining-wall imagery where mapped.

## Requirement Hierarchy

Top level:

- Exterior
- Interior

Generated hierarchy summary:

- Exterior: 14 categories, 15 mapped requirements
- Interior: 4 categories, 63 mapped requirements

Priority visible proof families:

- Kitchen: Oven, Cooktop, Rangehood, Dishwasher, Microwave, Sink, Sink Mixer, Benchtop
- Exterior: Bricks, Roof, Garage Door, Entry Door
- Interior: Internal Doors

## Manual Mapping

Rows requiring manual mapping are preserved in the import preview and catalogue output with `manualMappingRequired = true`. They are not silently discarded.
