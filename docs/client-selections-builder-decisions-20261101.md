# Client Selections — builder decisions still open, job "New Job 03/09" (2026-11-01)

Evidence from the reconciled job (`live-rev14-reconciled.gr8job`), its quotation and the app's own
Reconcile Selections preview. Nothing is priced, removed or approved here. In the app, every item below is
either TBC in the schedule (and in its "Outstanding decisions" page) or listed in Reconcile Selections, where
Apply stays disabled until it is mapped, approved or explicitly kept pending. Lines kept pending are marked
**provisional** in the quotation and the Quotation page shows a standing notice with their value.

Contract effects use the job's markup: overheads 5%, margin 10%, profit 15%, GST 10%, sales commission 4%
(factor 1.5154 on base cost). Independently recomputed: base $552,046.53 → $836,551.76 (matches the app).

## Pricing

| # | Item | Evidence | Decision needed | Effect |
|---|---|---|---|---|
| 1 | Bosch Series 4 900mm Electric Built-In Oven VBC5540S0 | Selection records price $3,298 but status `price_pending`; allowance $1,200. The quote line is added at qty 1 with **no rate** (PRICE MISSING; GST basis unconfirmed). The quotation's brand template rows (Ariston/Omega/…) are all qty 0. | Confirm the supplier price and whether $3,298 includes GST. | If $3,298 inc GST: $2,998.18 ex GST cost, about $4,543 contract; $1,798.18 over the allowance (ex GST). |
| 2 | Carpet — Godfrey Hirst Highland Park Twilight 0558710160 | 86.35 m² × $30.00/m² = $2,590.50 cost; Product Library status "Supplier quote required"; allowance $2,590.50 (the $30 is the estimating allowance). Carpet was not in the approved quote. | Retailer quote for 86.35 m² (carpet areas in the schedule), underlay, gripper and installation, stating GST. | Replaces the $2,590.50 allowance cost. |
| 3 | Lighting and fan installation rates | Quote: SUPPLY AND INSTALL DOWNLIGHTS 55 × $85 (manual qty), CEILING FAN AND INSTALL 8 × $55. Selected: Eclipse Maxi downlight ×53 (23 rooms), Campari pendant ×3 (Kitchen), SPYDA fan ×2. The app offers SUPPLY AND INSTALL DOWNLIGHTS or MISC LIGHT FITTINGS as targets; none is chosen. | Installation-only rates (or the supply/installation split of $85 and $55) and the target row for each fitting. | Until then the upgrades are unpriced and listed as pending. |
| 4 | Ceiling fans: quote 8, selected 2 | Only 2 external SPYDA fans are selected; the electrical schedule has no ceiling-fan points; no interior fan is selected. | Are 6 interior fans still to be chosen, or does the quote reduce to 2? | 6 × $55 = $330 cost install, plus fan supply if retained. |
| 5 | Downlights: quote 55, selected 53 (+3 pendants) | 53 Eclipse downlights + 3 Campari pendants = 56 light points. | Confirm the light-point count (55, 53 or 56). | ±$85 per point at the current rate. |
| 6 | O.Novo Style Shower/Bath Mixer (T165661) | Same product twice per room: "Shower Rail / Rose" ×5 (Main Bathroom 2, Ensuite 2, B2 Ensuite 1) and "Bath & Shower Mixer" ×4 (Main Bathroom 2, Ensuite 1, B2 Ensuite 1), both at $304.55 ex GST. Main Bathroom also has a Vivid Shower/Bath Mixer ×1; each room also has Vivid Slimline Single Shower on Rail. Catalogue: one combined shower/bath mixer. | How many mixers each room has (one per shower + one per bath is typical). Quantities are kept as entered until then. | If the Shower Rail/Rose line is a duplicate: −$1,522.73 cost, about −$2,308 contract. |
| 7 | Tiling labour (+$7,593.90 cost, +$11,507.52 contract) | Rates are the builder's own TILE LAYER (115) tariff in this quote: LAY NORMAL TILES $50/m² (13 lines, 132.27 m², $6,613.50), FLOOR WASTES $45 (4 lines, 10, $450), MITRE CUTS $40/lm for skirting (2 lines, 13.26 lm, $530.40). No tiling labour is charged anywhere else in the approved quote. Tiles were classed ceramic; porcelain uses LAY PORCELAIN TILES $70/m². | Confirm the labour is to be added (it was missing, not a client upgrade), the tile material, and skirting at the mitre-cut rate. | Porcelain throughout would add $20/m² × 132.27 m² = $2,645.40 cost. |
| 8 | Standard Inclusions baseline | The job has no verified inclusion snapshot: replacements show NO_BASELINE / "baseline unverified". | Approve the inclusion baseline for this job (Standard Inclusions module). | Until then upgrade/downgrade amounts are shown, not stored as variations. |

## Quotation mapping held for the builder (Reconcile Selections → "Held for approval")

- More than one existing row could carry the product: entry door, balustrade, sink, sink mixer, basin, basin mixer, bath, shower fixtures, toilet suite, laundry tub, bath mixer. Choose the row (or keep pending).
- Garage door: no size on the selection; the measured size chooses the option row.
- Internal doors, door hardware: schedule not synced to the quote.
- Skirting, robes: no option row in the quote.

## Client decisions (schedule shows TBC; Outstanding decisions page lists them)

| Area | Open |
|---|---|
| Cabinetry — Kitchen | Kickboards; cabinet carcasses; hinges/runners/hardware; splashback |
| Cabinetry — Main Bathroom | Bulkheads; kickboards; end panels; base cabinets; carcasses; handles; hardware; splashback |
| Cabinetry — Ensuite | Carcasses; benchtops; handles; hardware; splashback |
| Cabinetry — Powder Room | Carcasses; benchtops; handles; hardware; splashback |
| Cabinetry — Laundry | Kickboards; carcasses; benchtops; hardware; splashback |
| Cabinetry — Butler's Pantry | Kickboards; end panels; carcasses; benchtops; hardware; splashback |
| Electrical | Main Bathroom and Powder Room still "in progress" (26 of 28 rooms complete) |
| Internal paint | House scheme (walls/trims/doors/skirting Dulux Hog Bristle, ceilings Ceiling White) chosen but **not confirmed** (`confirmed: false`); the schedule now prints these TBC with "house scheme not yet confirmed" |

## Data to check in the schedule

- Exterior painting — "Painted wall cladding": colour **Colorbond Monument** is listed with brand **Dulux** and code
  **C29**. Monument is a COLORBOND colour name; confirm the paint product and code the painter will use.

## Builder profile

The schedule cover prints builder phone, email, licence and ABN only from the builder's profile. The profile for
this workspace has none, so the cover shows none. Enter them in the builder profile (they are never invented).
