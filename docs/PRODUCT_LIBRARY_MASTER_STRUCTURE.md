# Product Library Master Structure

The Product Library is an organisation-scoped catalogue built from the approved selections CSV. The platform-level template defines navigation and product family rules only; each builder organisation owns its suppliers, brands, ranges, products, prices, images and links.

## Top-Level Areas

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

## Family Navigation

The visible catalogue is category-first, not a flat quote-row table.

Examples:

- Exterior -> Bricks
- Exterior -> Roofing -> Metal Roof
- Exterior -> Garage Doors
- Kitchen -> Stone Benchtops
- Kitchen -> Ovens
- Interior -> Fix Out -> Internal Doors

CSV section headings are source metadata only. They are not exposed directly when they are not useful customer navigation.

## Source Linkage

Rows with real quote item codes keep `linkedQuoteItemCode`. The approved CSV currently has blank `CODE` values for usable rows, so those rows receive a stable `approvedSourceKey` such as `csv-row-42`. This avoids inventing quote codes while still preserving a durable source reference.
