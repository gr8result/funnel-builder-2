# Quotation Builder V1 hotfix – 7 November 2026

Base: deployed release `93f3d5f`. Branch: `hotfix/quotation-v1-defects-20261107`.
Status: **not deployed**. Deployment needs the owner's visual acceptance of the corrected quotation.

## Defects and causes

| Defect | Cause | Fix |
|---|---|---|
| Quotation appeared to stop at section 64, APPLIANCES & WHITE GOODS | No data was lost: the saved job still holds all 169 sections and 3,471 rows. Two ordering faults moved sections out of place. (1) The empty APPLIANCES & WHITE GOODS group heading was saved last, while its six brand sections sat after CABINETRY. The screen nests brand sections under their heading, so all appliance content showed at the end in a $0.00 heading. The existing rule only moved the heading after a section called "cabinet maker", and this job calls it "CABINETRY". (2) The selection sync appends each Client Selections section (tiling rooms, electrical, plumbing fit-off, entry door furniture, door jambs, stairs, bathroom accessories, shower screens) to the end of the order instead of beside its trade. | `lib/construction-estimation/quotationSectionPlacement.js`, called at the end of `normalizeQuoteSectionOrder`. It moves a group heading saved after all its sub-sections back in front of them. It moves Client Selections sections that are still in the automatically appended tail beside their trade heading. A section the builder placed with Manage Section Order is not moved. Nothing is added or removed. |
| Tiling labour rows with quantities but no rate | `tilingQuotationEntries` created every "Labour –" row with `rate: ""`. | Labour rows carry the template rate below. |
| Duplicate floor-waste charges | The old floor-waste editor appended identical entries. Five clones were still charged at $30.00 ex GST each (Laundry 1, Main Bathroom 2, 2nd Bedroom Ensuite 1, Ensuite 1). They also inflated the floor-waste labour counts. | The generator collapses exact clones (`collapseDuplicateFloorWastes`) before building rows. Saved selections are not changed. |
| Electrical Client Selections points without rates | A room point copied its rate only from a uniquely matching estimate row. Fridge, dishwasher, microwave, rangehood, washing machine, dryer, garage door and data points had no unique match, so they stayed blank. | The estimate's own rate still wins. With no unique estimate rate, the point takes the template rate below, labelled as such. |
| BOQ $8,150.00 short of the quote (found in the audit) | The BOQ treated any row whose name contains "overhead" as a fee/summary line unless its line type was "Standard rate item". Final cabinetry product rows carry no line type, so five "Overhead cabinet" lines were charged in the quote but left out of the BOQ. | `finalQuotationBoq.js`: structured cabinetry product rows (`cabinetryRowType: "product"`) are never fee lines. |
| Jobs saved before the fix | Client Selections rows are only regenerated when selections are saved. | `applyGeneratedRowSafeguards` runs on every job load (`normalizeWorkbook`) and in `normalizeQuotationStructure`. It acts on generated rows only: it drops exact-clone floor-waste rows, recounts floor-waste labour and fills blank generated rates. It is idempotent. Builder-typed `manualRate` values and existing rates are never changed. |

## Template rate schedule

`lib/construction-estimation/quotationTemplateRates.js` holds the schedule: `gr8-template-rates-2026-11-07`.

- **Date:** 7 November 2026.
- **GST:** excluded. The Quote Sheet adds 10%.
- **Basis:** new single-dwelling residential work, South-East Queensland, standard access.
- **Status:** estimating defaults, not supplier quotations. Each row is labelled "Template estimate rate (7 Nov 2026, ex GST) - edit to confirm".
- **Editing:** a rate typed on the row replaces the template rate.

**Tiling labour (installation only; tile and floor-waste materials are priced from the selected products)**

| Item | Unit | Rate ex GST |
|---|---|---|
| Floor tiling (up to 600x600) | m² | $65 |
| Wall tiling | m² | $75 |
| Feature / patterned tiling | m² | $95 |
| Mosaic | m² | $130 |
| Splashback | m² | $90 |
| Skirting tiles | LM | $28 |
| Floor-waste installation | each | $45 (same as the template TILE LAYER floor-waste rate) |
| Linear drain installation | each | $140 |

Waterproofing is not generated per room. It stays in the job's WATERPROOFING section (the affected job has a $3,750 lump sum), so it cannot be charged twice.

**Electrical Client Selections points (supply and install: rough-in, cable, standard white plate, fit-off)**

| Point | Rate ex GST | | Point | Rate ex GST |
|---|---|---|---|---|
| Double power point | $110 | | Microwave point | $110 |
| Single power point | $95 | | Rangehood point (hood installation priced separately) | $95 |
| USB power point | $145 | | Oven circuit and isolator | $180 |
| TV point (coax to roof space) | $120 | | Cooktop 32 A circuit and isolator | $240 |
| Data point (Cat6, terminated) | $145 | | Washing machine point | $110 |
| Phone point | $95 | | Dryer point | $110 |
| Dedicated 20 A appliance circuit | $185 | | Garage door motor point | $120 |
| Fridge point | $110 | | Weatherproof double power point | $140 |
| Dishwasher point (own circuit) | $125 | | | |

The job's own ELECTRICAL rows already had rates and are unchanged. Room points take those rates where a unique match exists. For example, the double power point uses the builder's $150.00.

## Evidence (isolated copy of job `recovered-03-09-123`, revision 27, 169 sections / 3,471 rows)

The copy was loaded into a headless browser on ports 3121/3122. Every non-local request and port 3000 were blocked. The live job and production were not touched. AI takeoff drawing images were left out of the copy because they are stored separately and are not part of the quote.

| | Deployed `93f3d5f` | Hotfix |
|---|---|---|
| Top-level headings / last heading | 64 / APPLIANCES & WHITE GOODS (empty, $0.00, numbered 163) | 64 / PERIOD MAINTENANCE (152), numbered 169. Appliances (#103) follows CABINETRY with its brand sections; each Client Selections section sits beside its trade. |
| Sections saved | 169 | 169 after save and after reopen |
| Rows saved | 3,471 | 3,466 (the 5 duplicate floor wastes removed) |
| Base line-item subtotal | $555,062.67 | $567,290.95 |
| GST 10% | $73,407.04 | $75,024.23 (10% of $750,242.29) |
| Final quote total | $841,122.31 | $859,652.63 (same after save and reopen) |
| BOQ = quote base subtotal | No: $8,150.00 short | Yes, every section |
| Charged rows with no price (issue gate) | 45 | 4: two products without a supplier price and two rows marked "quote required" |
| Page errors | 0 | 0 |

## Open items for the owner

- **Possible electrical double counts**, left unchanged. TV points: 4 whole-house at $50 plus 7 room-by-room points ($200 ex GST). Weatherproof power point: 1 whole-house at $85 plus 1 in Alfresco ($85 ex GST). Decide which count stands.
- **Charged rows still without a price.** None of these prices is invented here, and the issue gate keeps blocking all four:
  - Gainsborough Trilock entry lever set (Entry Door Furniture): product with no supplier price.
  - Phoenix Vivid bath mixer (Plumbing Fit Off): product with no supplier price.
  - Bailey passage lever set (FIX OUT): marked "quote required".
  - 90x19 door jamb, 5.4 m (Door Jamb Materials): marked "quote required".
- **Port 3000 is not the deployed code.** It runs the uncommitted `E:\dev\funnel-builder-clean` working tree, which numbers only top-level headings (Appliances = "64"). This hotfix does not change that tree.
