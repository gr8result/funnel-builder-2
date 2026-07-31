# Product Library Selections Classification

Selections compatibility is based on explicit visibility, stable tags and product metadata, not broad category labels or product names alone.

## Required Product Fields

- Identity: product code, name, brand, range, model, description, images, supplier product URL and technical documents
- Classification: `selection_visibility`, category, subcategory, product type, requirement tags, compatible room/area types, internal/external suitability, wet-area suitability, mounting type, installation type, size, width, configuration, fuel type, finish, colour, material
- Commercial: supplier, supplier SKU, builder cost, client price, RRP, allowance, currency, GST treatment, active/discontinued/availability status
- Tier: Classic, Premier, Premium, Optional Upgrade, Custom Only

## Tag Taxonomy

The central taxonomy lives in:

- `src/modules/inclusions-selections/products/productTagTaxonomy.ts`
- `lib/product-library/selectionsClassification.js`

Examples:

- Ovens: `appliance`, `oven`, `built-in-oven`, `600mm`, `900mm`
- Basin mixers: `tapware`, `basin-mixer`, `bench-mounted`, `wet-area`
- Shower mixers: `tapware`, `shower-mixer`, `wall-mounted`, `wet-area`
- Doors: `internal-door`, `entry-door`, `garage-door`, `passage-hardware`, `privacy-hardware`
- Finishes: `floor-tile`, `wall-tile`, `carpet`, `hybrid-flooring`, `cabinetry`, `benchtop`, `splashback`

## Matching

`requirementProductMatching.ts` maps selection items to required tags and returns compatibility reasons, tier match, price status and matching variants. A Kitchen Oven requires `appliance` and `oven`; an Ensuite Basin Mixer requires `tapware` and `basin-mixer`.

Default matching excludes `estimating_only`, `hidden`, `archived`, inactive and discontinued products. Estimate Builder/rate rows are retained in the Product Library but are not selections catalogue candidates.
