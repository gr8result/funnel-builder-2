# Product Library Taxonomy

The standard selections taxonomy is derived only from:

`data/product-library/PRODUCTS-LIBRARY.csv`

That CSV is the approved, manually curated selections source. It contains quotation-style rows and repeated section headings. Parser output preserves the source lineage for every usable row:

- `sourceRow`
- `originalQuoteItemCode`
- `section`
- `category`
- `subcategory`
- `itemDescription`
- `unit`
- `quantity`
- `rate`
- `total`

Repeated heading rows such as `CODE,...,ITEM,UNIT,QTY,RATE,TOTAL` are ignored as products. Blank rows and heading-only rows are retained in audit metadata, not converted into selectable items.

## Approved Top-Level Areas

The reusable selections template exposes these top-level areas:

- Exterior
- Interior
- Kitchen
- Bathroom & Ensuite
- Laundry
- Bedrooms
- Living Areas
- Garage
- Outdoor Areas
- Pool

## Standard Category Hierarchy

Exterior:

- Bricks
- Feature Bricks
- Cladding
- Render
- Roofing
- Gutters
- Fascia
- Windows
- Entry Doors
- External Doors
- Garage Doors
- Balustrades
- Handrails
- Exterior Paint
- External Lighting
- Driveway Finishes
- Decking

Roof colour is managed as a Roofing variant, not as a standalone Exterior category.

Interior:

- Internal Doors
- Door Hardware
- Skirting
- Architraves
- Paint
- Flooring
- Robes
- Window Furnishings

Internal Doors belong under `Interior` with the family category `Fix Out` and subcategory `Internal Doors`.

Kitchen:

- Cabinetry
- Cabinet Finish
- Handles
- Benchtops
- Splashback
- Sink
- Sink Mixer
- Oven
- Cooktop
- Rangehood
- Dishwasher
- Microwave
- Flooring
- Lighting
- Paint

Bathroom & Ensuite:

- Vanity
- Basin
- Basin Mixer
- Shower Mixer
- Shower Outlet
- Shower Screen
- Bath
- Toilet
- Mirror
- Accessories
- Floor Tiles
- Wall Tiles
- Feature Tiles

Laundry, Bedrooms, Living Areas, Garage, Outdoor Areas, and Pool remain standard top-level areas even when the approved CSV has fewer matching rows for those areas.

## Source Rules

- The taxonomy must be generated from the approved CSV only.
- Old demo fixtures and retired selections data must not seed the standard template.
- Quotation Builder data and behavior are unchanged by this taxonomy.
- Supplier-specific data is organisation-specific import data and must not become platform structure.
- Estimating rows that are unrelated to product selections must not be pulled into the reusable Product Library.
