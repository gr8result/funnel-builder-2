# Internal Door Furniture — 6 September 2026

Product Library now supplies 33 additional Lockwood canonical designs with 228 controlled orderable variants. All new designs have local, individually mapped manufacturer images, descriptions, model codes, furniture types, styles, functions, finishes, compatibility information, official URLs, active/image statuses and `Quote required` pricing.

## Catalogue and imagery

| Range | Canonical designs |
| --- | ---: |
| Velocity 55 mm round rose | 9 |
| Velocity 63 mm round rose | 6 |
| Velocity roses, escutcheons and turnknobs | 12 |
| Stainless steel sliding-door flush pulls | 4 |
| 1360 Series Knob 20 | 1 |
| 5260 tubular latch | 1 |

Passage, privacy, dummy, mortice furniture, half sets, door pulls, roses, escutcheons and compatible latches are covered. Manufacturer ordering tables determine the valid combinations. Square-rose conversion trims are separate accessories; no unsupported square-rose sets were invented. Unspecified powdercoat colours were not imported as named finishes.

- **33 images verified:** each imported design has a local manufacturer image; all loaded in the browser and were visually reviewed. Images show the correct design. They are labelled `verified_range` because a selected finish or function may differ from the photograph.
- **0 unresolved images among new imports.**
- **5 unresolved legacy Symmetry design images**, affecting 15 existing passage/privacy/dummy records: District, Element, Imperial, Manor and Vicinity. Their official gallery photographs depict keyed entrance locks. Those internal records retain their IDs but are inactive, unavailable for client selection and marked for image review. Their original image references remain in audit metadata. The five existing entrance-function records remain available under Exterior.
- **36 packaging-only duplicates prevented:** display/trade packaging codes are aliases of controlled variants rather than additional products. Re-running the importer replaces the same 33 design IDs and does not add another catalogue copy. Existing 20 Symmetry product IDs were preserved; none were deleted.

Images were downloaded unchanged from Lockwood's ASSA ABLOY asset host. The 5260 image is the original embedded JPEG extracted from page 34 of its official catalogue. Manufacturer copyright remains with ASSA ABLOY/Lockwood; no Creative Commons licence is asserted. Each record and the source manifest record the official URL and local file.

Primary sources:

- [Lockwood Velocity 63 mm Saltbush — specifications and ordering](https://www.lockweb.com.au/au/en/products/door-handles-levers-and-knobs/rose-door-furniture/63mm-velocity-series-door-handles/saltbush-door-handle-lever-34)
- [Velocity small-rose accessories](https://www.lockweb.com.au/au/en/products/door-handles-levers-and-knobs/lockwood-turn-and-cylinder-accessories/lockwood-velocity-small-rose-turn-and-cylinder-accessories)
- [1360 Series Knob 20](https://www.lockweb.com.au/au/en/products/door-handles-levers-and-knobs/rose-door-furniture/1360-series-brass-door-handles/1360-series-brass-door-handles-knob-20)
- [Stainless steel flush pulls](https://www.lockweb.com.au/au/en/products/general-hardware/lockwood-stainless-steel-flush-pulls)
- [General Hardware catalogue, page 34](https://www.lockweb.com.au/au/en/documents/catalogues/general-hardware/Lockwood%20General%20Hardware%20Catalogue.pdf)

Full evidence: `data/product-library/source-evidence/lockwood-internal/product-details.json` and `import-report.json`. Canonical records remain in `data/product-library/catalogues/internal/AU-INTERNAL-AREAS-CATALOGUE.json`.

## Filters and downstream behaviour

Internal Door Furniture has Colour/Finish A–Z and Z–A sorting, a separate multi-select finish filter and a Function filter. These combine with Brand, Product Range and search in grid and list views. Options come from this category's products. The Brand filter contains Gainsborough and Lockwood.

Finish normalization preserves manufacturer labels in audit attributes. Matte Black becomes Matt black and Chrome Plate becomes Bright chrome. Satin chrome, brushed satin chrome, satin chrome pearl, stainless steel, brass, graphite and gunmetal remain distinct. A finish is offered only where the catalogue actually supplies it.

Filtering controlled designs restricts their displayed/exported variants to the matching function/finish combinations. Client Selections offers explicit published variant codes and validates choices against the canonical design. Quotation Builder stores the canonical design ID plus variant code, function, finish, image, quantity and pricing state. Inactive internal products are excluded from selection. CSV re-import retains the full canonical variant catalogue and cannot turn a filtered export or known order-code alias into a duplicate master product.

## Verification

- `scripts/test-lockwood-internal.mjs`: all 228 variants validate and transfer into quotation payloads; invalid combinations rejected; normalization distinctions, finish ordering, filtered CSV and duplicate prevention pass.
- `scripts/test-internal-areas-catalogue.mjs` and `scripts/test-internal-catalogue-finishing.mjs`: existing internal catalogue, canonical identities, pricing and selection checks pass.
- `scripts/test-exterior-catalogue-grouping.mjs`: Exterior grouping regression checks pass.
- `scripts/verify-lockwood-live.mjs`: browser checks for brand/range isolation, both finish sorts in both views, combined filters/search, filtered CSV and local images.
- `scripts/verify-lockwood-sync-live.mjs`: a Lockwood selection is confirmed in Client Selections, saved into a synthetic local job and displayed in Quotation Builder with its canonical ID, variant code and separate pricing state. Test requests do not write to the external database.

Browser evidence is stored under `test-artifacts/lockwood-live/` and `test-artifacts/lockwood-sync-live/`. Existing user dev servers were left running.
