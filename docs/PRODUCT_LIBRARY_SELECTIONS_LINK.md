# Product Library Selections Link

Selections must query the Product Library with exact context.

Examples:

- Kitchen -> Stone Benchtops: `area = kitchen`, `familyKey = stone-benchtops`, `linkedQuoteItemCode = approved-family:stone-benchtops` when the source quote code is blank.
- Exterior -> Metal Roof: `area = exterior`, `familyKey = metal-roofing`.
- Exterior -> Bricks: `area = exterior`, `familyKey = bricks`.
- Interior -> Internal Doors: `area = interior`, `familyKey = internal-doors`.

If no organisation products exist for the exact family, the UI shows:

`No products have been added for this category yet.`

Buttons:

- Add Product
- Import Products
- Back

The selection query must not fall back to another room, category or demo fixture. Generic demonstration products are shown only as clearly labelled examples where no organisation data has been imported.
