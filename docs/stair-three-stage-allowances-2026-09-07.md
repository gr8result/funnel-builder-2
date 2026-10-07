# Three-stage stairs and balustrade allowances

This update supersedes the six-stage workflow described in `stair-catalogue-workflow-2026-09-07.md`.

The shared Product Library wizard now has three stages:

1. Stair type, plan configuration, dimensions, quantity and supplier.
2. Timber species and finish.
3. Balustrade, length per staircase, compatible handrail, price breakdown and confirmation.

Eight complete construction types and five independent plans remain. Species is mandatory for polished closed-tread, open-timber, mono-stringer, twin-stringer, steel/timber and floating stairs. Carpet grade needs no decorative species. Paint grade permits an optional substrate choice. Construction changes retain compatible selections and geometry. Existing six-stage drafts migrate to the corresponding three-stage position.

Nine distinct local timber samples are available: Durian, Kwila (Merbau alias), Blackbutt, Spotted Gum, Tasmanian Oak, Victorian Ash, American Oak, Pine and Jarrah. Jarrah joins the hardwood compatibility subset. Victorian Ash and Tasmanian Oak retain separate identities and samples. Timber application fields identify treads, relevant timber risers/strings and timber handrails.

## Builder estimating allowances

These are the user's supplied Queensland builder allowances, **AUD excluding GST**, not supplier quotations or independently verified market prices.

| Balustrade | Allowance / lm |
| --- | ---: |
| Painted timber balusters + timber handrail | $325 |
| Hardwood timber balusters + hardwood handrail | $450 |
| Powder-coated aluminium vertical balusters | $350 |
| Powder-coated steel vertical balusters | $425 |
| Stainless steel horizontal wire | $400 |
| Semi-frameless glass | $525 |
| Frameless glass – spigot/pin fixed | $700 |
| Frameless glass – premium/channel fixed | $900 |
| Glass + timber handrail | $650 |
| Decorative wrought iron / steel | $550 |

Four previously available choices remain: horizontal stainless rails, glass with metal handrail, feature screen/battens and no balustrade. They retain quote-required pricing. The ten rated options include their standard handrail; a configured explicit handrail upgrade can add a separate cost.

All options originate in the imported Product Library schema. Balustrades carry the existing `balustrades` family, canonical option IDs, stair applicability and quotation item labels. Semi-frameless glass retains the source-sheet `SEMI FRAMELESS GLASS BALUSTRADE` label. Outdoor balustrade availability remains intact.

The quote receives one complete stair row. Its rate includes the known allowance per staircase, multiplied once by the stair quantity. Each upgrade retains its amount, rate, linear metres, unit, canonical option ID and source-sheet label. For example, 4 lm at $650/lm gives $2,600 per staircase; two staircases contribute $5,200 excluding GST. With no stair base price, this is explicitly a **partial allowance — stair quote required**. Unpriced timber/finish changes remain quote-required. Changed configurations clear stale manually overridden stair rates.

## Images and sources

The catalogue references 39 distinct local assets. New images are Jarrah, decorative steel and installed channel-fixed glass. The channel photo is a real installed terrace balustrade, used to illustrate the channel system; it is not represented as an installed stair photograph.

- Timber samples: [StairPro Timber Staircase Species](https://stairpro.com.au/node/25), plus the existing official Stairlock American Oak sample.
- Decorative steel: official StairPro staircase gallery photograph.
- Channel glass: [Metforce Channel](https://metforce.com.au/products/metforce-channel/), installed image `IMG_2320_800x600.jpg`.

Original vendor image bytes are stored locally. Image URLs, supplier source URLs and verification status are retained in `data/product-library/source-evidence/stair-workflow/image-sources.json`. Vendor copyright is retained; an open reuse licence is not asserted.

Validation scripts: `scripts/test-complete-stairs.mjs` and `scripts/verify-stair-workflow-live.mjs`. Browser evidence is written to `test-artifacts/stair-workflow-live/`.
