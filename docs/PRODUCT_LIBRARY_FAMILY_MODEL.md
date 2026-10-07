# Product Library Family Model

Product Families define reusable selection buckets built from the approved selections CSV:

`data/product-library/PRODUCTS-LIBRARY.csv`

They are not supplier catalogues. Supplier, brand, pricing, image, and URL values are organisation data that can be imported later.

## Family Schema

Every Product Family defines:

- `familyKey`
- `displayName`
- `topLevelArea`
- `category`
- `subcategory`
- `linkedQuoteItemCode`
- `unit`
- `quantityRule`
- `requiredAttributes`
- `optionalAttributes`
- `supportedVariantTypes`

`linkedQuoteItemCode` is preserved when the approved CSV provides a quote item code. Where the approved row has a blank code, the model keeps the field empty and uses the source row audit fields for traceability.

## Required Family Definitions

20mm Stone Tops:

- Top-level area: Kitchen
- Category: Benchtops
- Subcategory: Stone Tops
- Required attributes: supplier, brand, range, colour, finish, thickness
- Optional attributes: edge profile, image, price, supplier URL
- Variant types: range, colour, finish, thickness, edge profile

40mm Stone Tops:

- Top-level area: Kitchen
- Category: Benchtops
- Subcategory: Stone Tops
- Required attributes: supplier, brand, range, colour, finish, thickness
- Optional attributes: edge profile, image, price, supplier URL
- Variant types: range, colour, finish, thickness, edge profile

Bricks:

- Top-level area: Exterior
- Category: Bricks
- Subcategory: Face Bricks
- Required attributes: supplier, brand, range, brick name, colour
- Optional attributes: texture, format, image, price, supplier URL
- Variant types: range, brick name, colour, texture, format

Metal Roofing:

- Top-level area: Exterior
- Category: Roofing
- Subcategory: Metal Roofing
- Required attributes: supplier, brand, profile, range, colour
- Optional attributes: finish, gauge, image, price, supplier URL
- Variant types: profile, range, colour, finish, gauge

Garage Doors:

- Top-level area: Exterior
- Category: Garage Doors
- Subcategory: Sectional / Roller Doors
- Required attributes: supplier, brand, range, design, size, finish
- Optional attributes: colour, operation, motor, image, price, supplier URL
- Variant types: range, design, size, colour, finish, operation

Internal Doors:

- Top-level area: Interior
- Category: Fix Out
- Subcategory: Internal Doors
- Required attributes: supplier, brand, range, design, construction, size, finish
- Optional attributes: glazing, image, price, supplier URL
- Variant types: range, design, construction, size, finish, glazing

Ovens:

- Top-level area: Kitchen
- Category: Oven
- Subcategory: Built-in Oven
- Required attributes: supplier, brand, range, model, size
- Optional attributes: finish, capacity, fuel type, image, price, supplier URL
- Variant types: brand, range, model, size, finish, fuel type

Tapware:

- Top-level area: Bathroom & Ensuite
- Category: Tapware
- Subcategory: Mixers and Outlets
- Required attributes: supplier, brand, range, model, finish
- Optional attributes: colour, efficiency rating, image, price, supplier URL
- Variant types: range, model, finish, colour, efficiency rating

Tiles:

- Top-level area: Bathroom & Ensuite
- Category: Tiles
- Subcategory: Floor / Wall / Feature Tiles
- Required attributes: supplier, brand, range, tile name, colour, finish, format
- Optional attributes: texture, slip rating, image, price, supplier URL
- Variant types: range, tile name, colour, finish, format, texture

Flooring:

- Top-level area: Interior
- Category: Flooring
- Subcategory: Timber / Carpet / Tile
- Required attributes: supplier, brand, range, product name, colour, finish
- Optional attributes: material, format, thickness, image, price, supplier URL
- Variant types: range, product name, material, colour, finish, format, thickness

## Supplier Boundary

Supplier-specific catalogues are organisation data. The reusable Product Library and Selections template must not permanently bind a family to any one supplier, manufacturer, range, or brand.

The generic platform structure defines what kind of product can be selected. Organisation imports define which supplier products are available.
