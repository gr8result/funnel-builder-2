# Godfrey Hirst Australian carpet catalogue

Imported 3 October 2026 from the manufacturer's public Australian residential catalogue at https://www.godfreyhirst.com/au/product-search/carpet. Godfrey Hirst and Hycraft are brands; the legal manufacturer is stored separately. Retailer is blank until an actual retailer quote is recorded.

| Fibre | Ranges | Colours |
| --- | ---: | ---: |
| Solution Dyed Nylon | 22 | 217 |
| Triexta | 10 | 181 |
| DuraTuft | 5 | 55 |
| Wool | 17 | 137 |
| Polyester | 3 | 38 |
| Polypropylene | 8 | 56 |
| Total | 65 | 684 |

683 exact colour swatches are stored locally. Monte Bello / Dock / colour 780 / manufacturer variant 0241360780 has a broken manufacturer image: both its published swatch and flood asset return HTTP 404. Its colour record remains selectable with an explicit missing-image state. No substitute swatch is assigned.

All ranges have fibre, yarn, style, roll width, total thickness, pile height, gauge, pattern repeat, warranty and specification-sheet links. The source leaves the separate construction field empty in all 65 ranges and residential/commercial rating fields empty in 14. These remain missing rather than inferred from style or another range. No range-page imports failed. The generated `.report.json` lists every missing field and failed image.

## Refresh

```
node scripts/product-library/import-flooring.mjs --supplier=godfrey-hirst --refresh-pages
```

Omit `--refresh-pages` to rebuild from locally retained evidence and reuse downloaded images. `scripts/product-library/flooring-suppliers/godfrey-hirst.mjs` discovers the entire paginated AU catalogue through the website's public gateway, then validates each residential carpet range against its manufacturer product page. An incomplete range crawl aborts before replacing the catalogue; missing image assets are reported individually. No product-name allowlist is used.

Stable product codes use manufacturer product codes; variant IDs use genuine manufacturer global item IDs. Refresh updates those records, retains first-import dates and price/quote history, and keeps no-longer-listed records as discontinued. Shared specifications are stored once per range in `attributes.carpetSpecs`; colours keep their own identifiers, swatches and colour metadata. Local raw source evidence is ignored by Git.

## Data flow and costs

The flooring importer writes `AU-GODFREY-HIRST-FLOORING-CATALOGUE.json`. `catalogueService` includes this source in the same Product Library used by Client Selections. Both flooring browsers share the range/colour browser and dynamically read fibre, brand, range, colour/code, style, budget, rating, pet and Australian-made facets. Hard flooring retains its own taxonomy and pack calculations.

`flooringTakeoffData` reads project rooms, Job Setup room records, accepted AI room data, named Takeoff measurements and calibrated room polygons. Saved manual area edits remain authoritative. Category containers are excluded. Room measurements are not supplemented by the carpet aggregate a second time.

Carpet selections keep net area, roll width and a separately entered estimated order area. There is no automatic 10% carpet purchasing quantity and no pack calculation. Changing the selected net area invalidates an earlier cutting estimate. Cutting direction, seam/cutting notes and available room dimensions are retained for a future optimiser; this change does not implement an optimiser.

Actual retailer quotes are recorded per colour with supplier, date, reference and explicit ex-GST material/underlay/installation/other rates. Price history travels with the job and is also stored in the organisation's Product Library override layer. Manufacturer refresh cannot overwrite it. Manufacturer prices remain quote-required even when a builder has a private retailer quote.

Internal estimating components are separate from supplier quotes. Existing square-metre estimating rates may prefill an allowance; lump-sum quote rows are never interpreted as a square-metre rate. Unset components remain unset. Selected cost uses material on estimated order area, underlay/install on net area, and other quoted costs once per selected colour. Variation stays pending without the necessary quote, quantity or allowance.

Saving uses the existing flooring connector: stable quotation rows per colour, room breakdown and costing snapshots, and matching procurement items. Existing carpet allowance quantities are reduced by the selected net area to prevent double charging; clearing selections restores them. Project Estimate and commercial BOQ snapshots use the calculated quotation. The live BOQ, Procurement and Variations views also show the saved project's carpet schedule and pending comparisons; this does not approve a contractual variation or place an order.

## Verification

```
node scripts/test-flooring-selection.mjs
node --import ./scripts/register-json-loader.mjs --import ./scripts/register-extensionless-loader.mjs scripts/test-carpet-selection.mjs
```

Browser checks: `scripts/test-client-selections-carpet-browser.mjs` and `scripts/test-client-selections-flooring-browser.mjs`, against `CLIENT_SELECTIONS_BASE_URL`. They use disposable local jobs and block cloud database writes. Reports/screenshots are saved under `artifacts/test-artifacts/client-selections-carpet` and `client-selections-flooring`.
