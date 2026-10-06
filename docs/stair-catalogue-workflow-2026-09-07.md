# Complete stairs and timber species — 7 September 2026

This initial report is superseded by [the three-stage workflow and allowance update](stair-three-stage-allowances-2026-09-07.md).

Product Library supplies the complete stair catalogue and every wizard option. Client Selections reads those canonical records; it does not contain a separate hard-coded stair catalogue.

## Available choices

**Eight construction cards:** closed tread carpet grade; closed tread paint grade; closed tread polished timber grade; open tread timber; mono-stringer; twin-stringer; steel-stringer with timber treads; floating/cantilevered.

**Five separate visual plan configurations:** straight flight, L-shaped with landing, U-shaped with landing, winder and curved. Construction and layout are stored independently, allowing combinations such as a polished closed-tread L-shaped stair.

**Eight visual timber species:** Durian, Kwila, Blackbutt, Spotted Gum, Tasmanian Oak, Victorian Ash, American Oak and Pine. Each has its own genuine local sample image, colour/grain description, typical use, finish suitability, availability status, quote-required adjustment, source URL and image verification status.

Durian and Kwila use the samples explicitly labelled with their names on [StairPro's Timber Staircase Species page](https://stairpro.com.au/node/25). That page also supplies Blackbutt, Spotted Gum, Tasmanian Oak, Victorian Ash and Radiata Pine (shown as Pine). American oak uses the distinctly labelled sample on [Stairlock's custom staircase page](https://stairlock.com.au/products/custom-staircases/).

**Twelve balustrade cards:** timber balusters with timber handrail; painted timber balusters; stainless-steel wire; stainless-steel horizontal rails; frameless glass; semi-frameless glass; glass with timber handrail; glass with metal handrail; vertical steel balusters; powder-coated aluminium; feature screen/battens; no balustrade required. Compatible handrail materials, profiles and finishes follow this choice.

## Images and compatibility

There are **36 distinct referenced images**, comprising **35 new local assets and one retained carpet-grade construction image**. All eight construction cards and five plan cards have different images. All eight timber samples are distinct. Manufacturer images were copied unchanged; the no-balustrade option uses an identified, locally authored SVG. Original URLs and verification status are retained in `data/product-library/source-evidence/stair-workflow/image-sources.json`. Manufacturer copyright is retained; no open licence is asserted.

- Carpet grade requires no decorative species and offers the carpet-grade treatment.
- Paint grade offers Pine, Durian, Tasmanian Oak and Victorian Ash, with paint-grade or raw finish.
- Polished closed-tread and open-timber options offer all eight species with clear, stained or raw finishes.
- Mono-stringer, twin-stringer, steel-supported and cantilever options use the configured hardwood subset: Kwila, Blackbutt, Spotted Gum, Tasmanian Oak, Victorian Ash and American Oak. Cantilever configuration is limited to straight or L-shaped plans in this catalogue.
- Finish options must match both the construction and chosen species. Handrail choices must match the balustrade.
- These are builder quote-preparation compatibility rules, not supplier certification of every dimensional combination. Availability is explicitly marked for supplier confirmation; no fixed supplier price or structural approval is invented.

## Workflow and persistence

`Stair Type → Configuration → Timber Species/Finish → Balustrade → Handrail → Review & Confirm`

Back and Continue preserve the draft. Changing construction clears only incompatible options. Partial drafts are stored per job in the browser, including the current step. Confirmation persists the complete selection into the job's Client Selections data.

The stored configuration includes construction, plan, flights, risers, width, floor-to-floor height, tread/riser treatment, species and sample image/source, finish, balustrade, handrail material/profile/finish, supplier, construction image, quantity and pricing breakdown.

Quotation Builder receives **one stair selection** with the canonical product ID and full configuration. It displays the stair image and selected timber sample. Timber, finish, balustrade and handrail upgrades remain separately identifiable within that selection. Published defaults are `Quote required`; the pricing model also accepts builder allowances, starting prices and builder-defined option adjustments without inventing supplier prices.

The category is renamed **Stairs**. The 13 previous component/legacy-system records remain available as estimating references, but category and client-workflow filters exclude them from primary stair choices.

## Verification

- `scripts/test-complete-stairs.mjs` passed: 8 construction records, 5 plans, 8 species, 12 balustrades, unique images, compatible options, rejection of invalid configuration, preserved valid choices and one-row quotation transfer. A defined allowance plus four upgrades was checked independently.
- `scripts/verify-stair-workflow-live.mjs` passed in the browser: complete-stair catalogue only; all eight samples loaded; Durian selected; carpet-grade change cleared decorative species while retaining dimensions; Kwila selected with an L-shaped plan, 17 risers, 1000 mm width, 3000 mm height, stained finish and timber-handrail glass balustrade.
- The browser draft survived reload at Review & Confirm. Confirmation saved quantity 2 and transferred the same canonical stair, Kwila sample and four upgrade entries into Quotation Builder. No component-only cards appeared.
- Existing internal catalogue and Lockwood regression checks passed.

Browser report and screenshots: `test-artifacts/stair-workflow-live/`. Canonical catalogue: `data/product-library/catalogues/internal/AU-INTERNAL-SYSTEMS-CATALOGUE.json`. Refresh script: `scripts/import-complete-stairs.mjs`.
