# Master Product Catalogue Research Import

This document defines how externally researched supplier/manufacturer product data should be supplied for the GR8 Result Master Product Catalogue.

Do not provide invented commercial products. Use researched manufacturer or supplier data only, with source provenance for every product. The production CSV template is:

`data/product-library/MASTER-PRODUCT-CATALOGUE-IMPORT-TEMPLATE.csv`

## Workflow

1. Collect researched product data from manufacturer/supplier sources.
2. Supply either CSV rows or JSON `products`.
3. Import Products in Product Library -> Master Catalogue.
4. Review the validation preview.
5. Commit only valid rows.

Imports never delete products that are absent from a file. Discontinuation must be explicit with `discontinued=true`.

## Price Rules

Allowed `price_status` values:

- `current`
- `allowance_only`
- `quote_required`
- `price_pending`
- `expired`
- `not_applicable`

Unknown prices must not be entered as `0`. Use `price_pending`, `quote_required`, or `allowance_only`.

## Image Rules

Allowed `image_status` values:

- `verified_exact`
- `verified_range`
- `family_fallback`
- `missing`
- `review_required`

A family fallback is not an exact product image. Keep `image_source_url`, `image_source_type`, and `image_verified_at` when an image is verified.

## Region Rules

Use `AU` for national availability or semicolon-separated region codes: `QLD;NSW`.

Allowed codes: `AU`, `QLD`, `NSW`, `VIC`, `SA`, `WA`, `TAS`, `NT`, `ACT`.

## JSON Envelope

```json
{
  "schema": "gr8-master-product-catalogue/v1",
  "products": [
    {
      "productCode": "DUMMY-BRICK-001",
      "familyKey": "bricks",
      "requirementKeys": ["bricks"],
      "manufacturer": "DUMMY Manufacturer",
      "brand": "DUMMY Brand",
      "supplier": "DUMMY Supplier",
      "range": "DUMMY Range",
      "productName": "DUMMY Product Name",
      "model": "DUMMY-MODEL",
      "sku": "DUMMY-SKU",
      "attributes": {},
      "media": {},
      "links": {},
      "pricing": { "priceStatus": "price_pending", "currency": "AUD", "gstIncluded": true },
      "availability": { "country": "AU", "regions": ["QLD"], "active": true },
      "source": {
        "sourceType": "manufacturer_website",
        "sourceName": "DUMMY Manufacturer",
        "sourceUrl": "https://example.com/dummy-source",
        "sourceRetrievedAt": "2026-08-13T00:00:00.000Z"
      }
    }
  ]
}
```

## Dummy Examples

Brick:

```json
{
  "productCode": "DUMMY-BRICK-001",
  "familyKey": "bricks",
  "manufacturer": "DUMMY Brick Manufacturer",
  "range": "DUMMY Range",
  "productName": "DUMMY Brick Colour",
  "attributes": { "colour": "DUMMY Colour", "texture": "DUMMY Texture", "finish": "DUMMY Finish", "dimensions": "DUMMY Dimensions" },
  "pricing": { "priceStatus": "quote_required", "currency": "AUD" },
  "availability": { "regions": ["QLD", "NSW"] }
}
```

Oven:

```json
{
  "productCode": "DUMMY-OVEN-001",
  "familyKey": "ovens",
  "manufacturer": "DUMMY Appliance Manufacturer",
  "productName": "DUMMY 600mm Oven",
  "model": "DUMMY-600",
  "attributes": { "size": "600mm", "finish": "DUMMY Finish", "configuration": "DUMMY Configuration" },
  "pricing": { "priceStatus": "price_pending", "currency": "AUD" }
}
```

Internal Door:

```json
{
  "productCode": "DUMMY-DOOR-001",
  "familyKey": "internal-doors",
  "manufacturer": "DUMMY Door Manufacturer",
  "range": "DUMMY Range",
  "productName": "DUMMY Internal Door",
  "attributes": { "design": "DUMMY Design", "size": "820mm", "finish": "DUMMY Finish" },
  "pricing": { "priceStatus": "quote_required", "currency": "AUD" }
}
```

Tapware:

```json
{
  "productCode": "DUMMY-TAP-001",
  "familyKey": "tapware",
  "manufacturer": "DUMMY Tapware Manufacturer",
  "range": "DUMMY Range",
  "productName": "DUMMY Mixer",
  "model": "DUMMY-MIXER",
  "attributes": { "finish": "DUMMY Finish", "configuration": "DUMMY Configuration", "material": "DUMMY Material" },
  "pricing": { "priceStatus": "price_pending", "currency": "AUD" }
}
```

Stone/Benchtop:

```json
{
  "productCode": "DUMMY-STONE-001",
  "familyKey": "stone-benchtops",
  "manufacturer": "DUMMY Stone Manufacturer",
  "range": "DUMMY Range",
  "productName": "DUMMY Stone Colour",
  "attributes": { "colour": "DUMMY Colour", "finish": "DUMMY Finish", "size": "20mm", "profile": "DUMMY Edge Profile", "material": "Engineered stone placeholder" },
  "pricing": { "priceStatus": "quote_required", "currency": "AUD" }
}
```

Future supplier datasets such as PGH, Austral, Hume, Westinghouse, Caroma, Phoenix, Caesarstone and other configured suppliers can use this same shape. Do not add supplier-specific hard-coded products to React components.
