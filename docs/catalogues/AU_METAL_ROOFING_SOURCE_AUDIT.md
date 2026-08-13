# AU Metal Roofing Source Audit

Verified: 2026-08-13

## Official Sources

- COLORBOND colours: https://colorbond.com/colours
- COLORBOND roofing: https://colorbond.com/products/roofing
- LYSAGHT CUSTOM ORB: https://lysaght.com/profiles/custom-orb
- LYSAGHT TRIMDEK: https://lysaght.com/profiles/trimdek
- LYSAGHT KLIP-LOK: https://lysaght.com/profiles/klip-lok

## Catalogue Scope

- Client Selection family: `roofing`
- Roof types: `metal_roofing`, `roof_tiles`
- Metal roofing status: catalogue available.
- Roof tiles status: catalogue awaiting official supplier data. No tile products are seeded.
- Pricing status: `quote_required`; no `$0` price is represented as a real product price.

## Product Systems

- Material: COLORBOND steel.
- Material manufacturer: BlueScope.
- Profile supplier/manufacturer: LYSAGHT.
- COLORBOND Ultra steel is modelled as a separate material variant requiring quote review, not as a cosmetic finish.

## Profiles

- CUSTOM ORB: 762mm cover width, 16mm rib height, 5 degree minimum roof slope.
- TRIMDEK: 762mm cover width, 29mm rib height, 2 degree minimum roof slope.
- KLIP-LOK 700 CLASSIC: 700mm cover width, 40mm rib height, 1 or 2 degree minimum roof slope subject to BMT.

## Colours And Finishes

- Core colours: Dover White, Surfmist, Evening Haze, Classic Cream, Paperbark, Dune, Southerly, Shale Grey, Bluegum, Windspray, Gully, Jasper, Wallaby, Basalt, Woodland Grey, Monument, Night Sky, Ironstone, Deep Ocean, Cottage Green, Pale Eucalypt, Manor Red.
- Matt finish colours only: Surfmist, Dune, Shale Grey, Bluegum, Basalt, Monument.
- Colour swatch hex values were read from official COLORBOND/LYSAGHT page swatch markup and stored as visual variants.
- Colour records are reusable by later gutter, fascia and downpipe selection families but are not standalone Client Selection categories.

## Compatibility Rules

- Roofing is one family. Roof colour, profile and finish are variants inside the family.
- Metal roofing uses COLORBOND steel material with compatible LYSAGHT profile records.
- Matt finish is only selectable for the six official Matt colours.
- Roof tiles cannot show metal profiles, COLORBOND steel colours or metal roofing finishes until official tile supplier data is added.
- Unknown price is quote-required or allowance-only. It is never displayed as a real `$0` price.
