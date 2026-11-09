# Client Selections — financial reconciliation, job "New Job 03/09" (2026-10-31)

Nothing here has been applied. The live job and the approved quotation are unchanged.

Sources:
- the reconciled copy of the live job, `artifacts/reconciled/live-rev14-reconciled.gr8job`;
- the integrated candidate `E:\dev\cs-main-candidate-20261031` (main HEAD 22d7b65 + integration patch + today's fixes);
- the app's own calculation (`calculateEstimateBuilderWorkbook`).

The line-by-line tables are in:
- `client-selections-quotation-audit-before-fixes.md`: the original 108-line proposal;
- `client-selections-quotation-audit-after-fixes.md`: 107 lines after the fixes.

## Contract price

| | Contract price | Change | Base cost |
|---|---:|---:|---:|
| Approved quotation now | $836,551.76 | — | $552,046.53 |
| Proposed by the old code (do NOT apply) | $880,957.07 | +$44,405.31 | $581,349.91 |
| **Correct proposed revised contract price** (all selection effects + tiling labour pricing) | **$887,949.03** | **+$51,397.27** | $585,963.96 |
| of which tiling labour newly priced (needs builder confirmation) | | +$11,507.52 | +$7,593.90 |
| Client selections only, without the tiling labour pricing | $876,441.51 | +$39,889.75 | +$26,323.53 |

Markup applied to base cost, as configured on the job: overheads 5%, margin 10%, profit 15%, sales commission 4%, then GST. Overall factor ≈ 1.5154. All selection rates are ex GST (supplier GST-inclusive prices ÷ 1.1). GST is applied once, in the summary.

## Why the old $44,405.31 was wrong (fixed in the candidate)

| Line | Old proposal | Cause | Fix |
|---|---:|---|---|
| Underslab & Drainage `quote-30075` — "Plumbers costs for under slab and drainage", manual $3,800 | −$3,800 cost (−$5,758 contract) | A Quotation Builder migration (Underslab becomes a 25% progress claim of the plumbing contract) ran inside the Client Selections save. Not a client selection. | The Client Selections save no longer runs builder-row migrations (`migrateDerivedRows: false`). Whether Underslab should be a progress claim stays a Quotation Builder decision. |
| Architraves `quote-1356` — 42 × 11 FJ Pine, 67 lm × $12.15 | −$814.05 cost (−$1,234 contract) | The Porta architrave selection retains the builder's manual rate, but `"$12.15"` was read as not-a-number, so the line was priced at $0. | `selectionProductMath.js` reads entered currency text. The line stays $814.05 until the selection is priced. |

After the fixes, **no line outside client selections changes** ($0.00).

## What the +$51,397.27 is made of (base cost, before markup)

| Kind | Lines | Cost change | Nature |
|---|---:|---:|---|
| Floor coverings: engineered timber 144.55 m² × $127.23 = $18,391.29; carpet 86.35 m² × $30 = $2,590.50 | 2 | +$20,981.79 | Standard inclusion **missing from the approved quote**. Timber is $4,439.15 under its $175/m² allowance (downgrade). Carpet is an estimating allowance until the retailer quote. |
| Tiling labour lines (rate $0 → $50/m², waste $45, skirting $40) | 19 | +$7,593.90 | **Quotation correction** (labour was unpriced), not a client upgrade. Needs builder confirmation. |
| Appliances: Bosch cooktop $1,907.27, dishwasher $1,134.55, rangehood $1,090 | 3 | +$4,131.82 | Not in the approved quote. Over allowance by $957.27 / $134.55 / $440.00 (upgrades). **Bosch oven: supplier quote required, priced $0** (allowance $1,200). |
| Hot water: Rinnai Infinity 32 LPG | 1 | +$3,124.55 | Unit not in the approved quote (plumbing labour "GAS HWS" already is). No allowance recorded. |
| External lighting: Sentinel ×3, Wanaka ×1 | 2 | +$313.55 | Client selection, new. |
| Butler's Pantry powerpoints (Pantry merged) | 4 | +$300 / −$300 | Room correction, net $0. |
| Origin toilets ×4 removed | 1 | −$1,858.18 | Confirmed correction 2026-10-25. |
| Chios bath removed | 1 | −$370.00 | Confirmed correction 2026-10-25. |
| Floor-waste duplicates (4 rooms) | 10 | $0.00 | Duplicate charges consolidated onto one waste line per room. |
| Fixtures (toilets, basins, mixers, screens, mirrors, accessories, balustrade) | 23 | $0.00 | Already in the approved quote at actual product cost; no duplicate cost. |

The 36 repeated appliance-package row ids are in the Quotation Builder template's brand sections (Ariston / Omega / Blanco / Westinghouse / Smeg / Euromaid). All have zero quantity. They are not created by Client Selections.

## Builder inputs still needed before the price is final

1. Bosch oven price (supplier quote): currently $0; allowance $1,200.
2. Carpet retailer quote (currently $30/m² estimating allowance).
3. Interior lighting and fan upgrades are not priced yet: "Original installation rate required" on SUPPLY AND INSTALL DOWNLIGHTS (55 × $85) and CEILING FAN AND INSTALL (8 × $55). The installation/material split is needed before the Eclipse ×53, Campari ×3 and SPYDA ×2 upgrades can be priced.
4. Quantity check: the quote installs 8 ceiling fans and 55 downlights; confirmed selections are 2 SPYDA fans and 53 downlights.
5. Tiling labour rates ($50/m², $45 per waste, $40/lm skirting): confirm or change.
6. Standard Inclusions baseline: most allowance variations show "pending" because the job has no verified inclusion baseline. Establish the approved baseline so upgrade/downgrade amounts are verified.
7. O.Novo mixer: see the integration report. Quantities kept as entered (Shower Rail/Rose ×5 at $304.55, Bath & Shower Mixer ×4 at $304.55). If the Shower Rail/Rose line is a duplicate, the base cost falls by $1,522.73 (≈ $2,308 contract).
