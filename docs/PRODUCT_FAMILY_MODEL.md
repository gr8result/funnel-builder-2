# Product Family Model

A Product Family is the reusable requirement definition that sits between an approved quote row and actual supplier products.

Required fields:

- `familyKey`
- `displayName`
- `topLevelArea`
- `category`
- `subcategory`
- `linkedQuoteItemCode`
- `approvedSourceKey`
- `unit`
- `quantityRule`
- `requiredAttributes`
- `optionalAttributes`
- `supportedVariantTypes`
- `imageRequirement`
- `pricingMode`

## Proof Families

- Stone Benchtops: supplier, brand, range, colour, pattern, finish, thickness, edge profile and slab size.
- Metal Roofing: supplier, brand, material, profile, range, colour, finish and gauge/thickness.
- Bricks: supplier, brand, range, brick name, colour, texture and format.
- Internal Doors: Interior -> Fix Out -> Internal Doors, with supplier, brand, range, design, construction, size, finish, glazing, fire and acoustic attributes.

The model deliberately treats rows like `20mm Stone Tops`, `Garage Door`, `Colorbond / Metal Roofing`, `Face Bricks`, `Internal Doors` and `Oven` as families unless a builder imports a real supplier product beneath them.
