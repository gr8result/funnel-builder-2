# Floorcoverings Catalogue

Created: 2026-09-07

Import file: `data/product-library/FLOORCOVERINGS_CATALOGUE_2026-09-07.csv`

## Scope

The catalogue covers the floorcovering groups requested for the Product Library:

- National Tiles 450 x 450 ceramic floor tiles
- National Tiles 600 x 600 porcelain floor tiles
- National Tiles 300 x 600 porcelain floor tiles
- engineered timber flooring
- laminate flooring
- hybrid flooring
- vinyl plank flooring

All catalogue prices are stored as AUD per square metre and GST inclusive. `rrp`, `builder_cost`, and `client_price` are deliberately set to the same current catalogue/allowance value so the existing Product Library UI displays a useful m2 rate without pretending that a trade discount has been verified.

## Pricing basis

Current National Tiles public category/product pricing was reviewed on 2026-09-07. Prices can change and should be refreshed before a final contract or supplier purchase order.

Representative public prices used in the catalogue include:

- 450 x 450 ceramic: Zetland approximately $39.95/m2; Cotto / Smart Stone / Spa approximately $49.95/m2.
- 600 x 600 porcelain: builder/standard polished products approximately $49.95/m2, upgraded matt/polished products approximately $64.95-$69.95/m2.
- 300 x 600 porcelain: $59.95/m2 builder allowance and $69.95/m2 premium allowance where an exact current public SKU could not be safely verified. These rows are intentionally labelled Builder Range / Premium Range rather than inventing a National Tiles product name.
- Rose Bay laminate: approximately $26.95/m2.
- Camino hybrid: approximately $34.95/m2.
- Classic Oak 7mm hybrid: approximately $54.95/m2.
- Karratha 4.5mm vinyl plank: approximately $54.95/m2.
- Nemora engineered timber: approximately $139.95-$149.95/m2 depending on species.

## Important data rule

Do not fabricate supplier SKUs, trade costs or product-specific prices. If an exact public product price is unavailable, use an explicitly labelled estimating allowance. Trade/builder pricing should replace the public price only when a supplier price list or account price is available.

## Product Library integration

The existing Product Library import schema already supports `product_family`, dimensions, image URL, official product URL, RRP, builder cost and client price. The catalogue therefore uses `product_family=flooring` and `linked_quote_item_code=approved-family:flooring` so it can be imported through the current Product Library importer without creating a second flooring database.

The existing application currently treats Flooring as one family (`flooring`, subcategory `Timber / Carpet / Tile`). The imported rows preserve their specific type in `subcategory` so the UI can filter/group Ceramic Floor Tile, Porcelain Floor Tile, Engineered Timber Flooring, Laminate Flooring, Hybrid Flooring and Vinyl Plank Flooring without losing the common quote linkage.

## Images

The import file currently uses the Product Library's existing generic flooring image as a safe fallback. Official product URLs are included wherever available. Product-specific supplier images should replace the fallback images as they are approved for use; the catalogue must not pretend a generic image is the exact product photograph.
