# Product Library → Quotation → Procurement Integrity

**P0 release status: FAIL / BLOCKED.** A shared reconciliation audit now persists on job save, appears in Client Selections, Quotation Builder and Project Estimate, blocks customer PDF export when selected products are unresolved, and blocks PO issuance for the affected items until procurement is approved. The acceptance condition **ZERO silently omitted selected products is not met**: the isolated job has 52 selected canonical product identities, 17 with fully verified priced quote outcomes, and 35 blocked identities. Do not issue its customer quotation or affected purchase orders.

Test job only: `gr8-reconcile-test-47c50983a480`. No protected original, recovery backup, PO, variation, payment, deployment or commit was changed/created by this audit.

## Pipeline Result

| Stage | Result | Evidence |
| --- | --- | --- |
| CSV → Product Library → Client Selections → Quotation → Procurement | PASS in isolated database fixture; live private-catalogue journey remains BLOCKED | 16 isolated PGlite/UI tests: stable supplier/SKU identity, duplicate prevention, requirement review, tenant isolation, stale-preview protection, metadata round trip, and a newly imported canonical mixer carried at quantity 2 and ex-GST rate 132 into one quotation row and one procurement row. |
| Master catalogue | PARTIAL | 5,933 committed master records; 5,855 visible/selectable. 136 require classification review and 106 are unclassified. The signed-in builder-private live catalogue count was not available from this workspace session, so this is not a total of all tenant overrides. Full category counts are in [audit JSON](../artifacts/test-artifacts/product-selection-integrity/isolated-job-report.json). |
| Client Selections | FAIL | 52 product identities found in the isolated saved job; 35 unresolved. The same audit appears in the selection and quote UI. |
| Quotation | FAIL | 17 `PRICED_IN_QUOTE`; 16 missing verified price; 16 missing target; 3 ambiguous mapping. No silent omission is reported as success. |
| Commercial BOQ | BLOCKED | No commercial project/estimate snapshot is linked to this local isolated job. Quote-to-final-BOQ projection tests pass, but a synced commercial BOQ row count cannot be verified. |
| Procurement | FAIL | 37 of 52 selections have a procurement representation; 15 are missing. No duplicate PO requirement or duplicate quote claim was detected. PO issue is gated; draft remediation remains permitted. |
| Variations | BLOCKED | No approved job inclusion snapshot/baseline is attached. No replacement is marked verified and no upgrade variation is invented. |
| Save/reopen | PARTIAL | Save created isolated job revision 10 and persisted the integrity audit at 2026-10-14T04:56:55.055Z. Quote rows remained 3,538 and payment remained one $14,567.50 event. Hard refresh then stayed at “Preparing Estimate Builder…” for 90 seconds; the record is readable from IndexedDB, but refreshed UI acceptance remains blocked. |
| Tenant isolation | PASS for tested import and resolver contracts | 16 PGlite CSV import tests and resolver/selection tests reject cross-workspace products, mappings, stale previews and commits. Production migration approval was not requested or applied. |

## Isolated Job Counts

| Measure | Result |
| --- | ---: |
| Canonical master Product Library records | 5,933 |
| Visible/selectable master products | 5,855 |
| Selected canonical product identities | 52 |
| Fully verified priced quotation outcomes | 17 |
| Verified package inclusions | 0 |
| Verified replacements | 0 |
| Missing price/GST verification | 16 |
| Missing quotation target | 16 |
| Ambiguous mapping | 3 |
| Missing quantity | 0 |
| Unverified-baseline outcome | 0; no replacement was accepted as verified |
| Product-tagged quotation rows | 55 |
| Total quotation rows | 3,538 |
| Product-tagged procurement items | 59 |
| Selection identities represented in procurement | 37 |
| Missing procurement requirements | 15 |
| Duplicate procurement requirements | 0 |
| Duplicate quotation charge claims | 0 |
| Supported unresolved exposure | $5,561.64 ex GST |

The $5,561.64 is only the portion for which the selected unit price, quantity and GST basis are all supported in browser-saved revision 10. It is **not** the total possible exposure; unresolved/unknown prices are not estimated.

### Read-Only Package Cross-Check

After the resolver was extended for legacy `selected_details` records, the checked-in isolated `.gr8job` was audited again without modifying its source bytes. Its results differ from the browser-saved revision-10 snapshot above, so these counts are reported separately and are not treated as a replacement for the saved browser evidence.

| Measure | `.gr8job` package audit |
| --- | ---: |
| Selected identities | 52 |
| Priced in quote | 12 |
| Missing verified price | 12 |
| Missing quotation target | 25 |
| Ambiguous mappings | 3 |
| Procurement representation gaps | 29 |
| Product-tagged quotation rows / total rows | 51 / 3,531 |
| Product-tagged procurement items / total items | 52 / 52 |
| Duplicate quotation/procurement claims | 0 / 0 |
| Supported unresolved exposure, ex GST | $10,297.10 |

The package audit output is [isolated-job JSON report](../artifacts/test-artifacts/product-selection-integrity/isolated-job-report.json). The source `.gr8job` byte-length integrity assertion passed. The live private catalogue remains unaudited because this run had no authenticated Product Library session.

### Selectable Master Products by Requirement

Counts are from the committed master catalogue in this worktree, excluding no builder-private database products because no live private-catalogue read was available.

| Requirement | Selectable | Requirement | Selectable |
| --- | ---: | --- | ---: |
| Air conditioning | 6 | Appliances packs | 12 |
| Balustrades | 16 | Basin mixers | 17 |
| Baths | 6 | Bath mixers | 8 |
| Bath spouts | 17 | Bathroom basins | 47 |
| Bricks | 147 | Cabinetry | 992 |
| Ceiling fans | 136 | Cladding | 10 |
| Cooktops | 72 | Dishwashers | 43 |
| Door hardware | 277 | Entry doors | 148 |
| Entry-door furniture | 302 | Exterior lighting | 204 |
| Exterior paint | 28 | Garage doors | 10 |
| Hot-water systems | 20 | Flooring | 83 |
| Interior lighting | 344 | Interior paint | 19 |
| Internal doors | 586 | Mirrors | 51 |
| Ovens | 72 | Rangehoods | 67 |
| Roofing | 197 | Shower fixtures | 39 |
| Shower screens | 50 | Sinks | 484 |
| Sink mixers | 53 | Stairs | 24 |
| Tiles & stone | 630 | Toilets | 95 |
| Windows | 9 | Towels/accessories combined | 121 |
| Review required | 136 | Unclassified | 106 |

The JSON audit has exact counts for every taxonomy key, including small categories such as driveway, decking, solar, EV charging, robe hooks, wastes and shelving.

## Unresolved Selected Products

Each row below is from persisted audit revision 10. “No exposure” means price, quantity or GST evidence was insufficient to safely calculate one.

| Canonical product ID | Category / product | Blocker | Quantity / known price | Supported exposure ex GST |
| --- | --- | --- | --- | ---: |
| `master-ENTRY-CORINTHIAN-SUNBURST-SUN-GL` | Entry door — Corinthian Sunburst SUN GL | Price required | 1; no verified rate | No exposure |
| `master-CLADDING-JAMES-HARDIE-LINEA-180` | Cladding — James Hardie Linea 180mm | Ambiguous mapping | 1; no verified price basis | No exposure |
| `fascia-gutter-package` | Roofing — fascia/gutter/downpipe package | Ambiguous mapping and quantity | Missing | No exposure |
| `dowell` | Windows — Dowell project schedule | Schedule target not verified | Schedule quantity missing | No exposure |
| `master-GARAGE-SDG-COLORBOND-SECTIONAL` | Garage door — COLORBOND sectional | Required size / target | 1; price missing | No exposure |
| `external-lighting-schedule` | External lighting schedule | Schedule target not verified | 3; GST basis unknown | No exposure |
| `exterior-colour-schedule` | Exterior paint colour schedule | Painter target not verified | 11; price missing | No exposure |
| `master-DRIVEWAY-GENERIC-EXPOSED-AGGREGATE` | Driveway — exposed aggregate | Mapping not confirmed | 60; price missing | No exposure |
| `product:ovens:bosch:vbc5540s0` | Bosch Series 4 900mm oven | Price/GST unverified | 1; $3,298, GST basis unknown | No exposure |
| `product:cooktops:bosch:pcr9a5i90a` | Bosch Series 6 900mm gas cooktop | Price/GST unverified | 1; $2,098, GST basis unknown | No exposure |
| `product:rangehoods:bosch:dbb93bc60a` | Bosch Series 2 900mm integrated rangehood | Price/GST unverified | 1; $1,199, GST basis unknown | No exposure |
| `product:dishwashers:bosch:sms2iti02a` | Bosch Series 2 dishwasher | Price/GST unverified | 1; $1,248, GST basis unknown | No exposure |
| `master-INT-CORINTHIAN-DOORS-PMDF-HONEYCOMB-PRIMED-NONE` | Internal doors — Flush Interior PMDF | No option row | 1; $108.90 inc GST | $99.00 |
| `master-INT-GAINSBOROUGH-105BAISC` | Internal door hardware — Choice Bailey passage lever | Trade section missing | 1; rate missing | No exposure |
| `master-INT-PORTA-200083` | Skirting — bevelled primed FJ pine | No option row | 1 length; $27.22 inc GST | $24.75 |
| `master-INT-PORTA-200082` | Architraves — bevelled primed FJ pine | Ambiguous mapping | 1 length; $17.33 inc GST | $15.75 |
| `master-INT-STAIR-COMPLETE-CLOSED-POLISHED` | Stairs — closed polished timber tread | Target missing | 1 set; rate missing | No exposure |
| `master-INT-SYS-FLEXI-STORAGE-WARDROBE-400MM-3-SHELF-4-DRAWER-UNIT-WHITE-MATTE` | Wardrobe 400mm drawer unit | No option row | 5; price missing | No exposure |
| `internal-paint-colours` | Interior paint colours | Paint schedule target missing | Quantity unspecified; no product rate | No exposure |
| `master-EDF-GAINSBOROUGH-8951CONSC` | Entry furniture — Gainsborough Trilock Contour | Price required | 1; Product Library rate unavailable | No exposure |
| `master-PLB-HNC-300521150` | HNC 1000 Series sink | Price/GST basis unverified | 1; $547, basis unknown | No exposure |
| `master-PLB-HNC-520016C56AF` | HNC Riviere sink mixer | Price/GST basis unverified | 2; $509, basis unknown | No exposure |
| `master-PLB-HNC-4700300W` | HNC Riviere basin | Price/GST basis unverified | 5; $619, basis unknown | No exposure |
| `master-PLB-HNC-VV770-00-1` | HNC Vivid basin mixer | Price/GST basis unverified | 5; $392, basis unknown | No exposure |
| `master-PLB-HNC-191526` | HNC Chios inset bath | Price/GST basis unverified | 1; $407, basis unknown | No exposure |
| `master-PLB-HNC-EN7WFWOF` | HNC Riviere back-to-wall bath | Price/GST basis unverified | 1; $3,150, basis unknown | No exposure |
| `master-PLB-HNC-T165661` | HNC O.Novo shower/bath mixer | Price/GST basis unverified | 5; $335, basis unknown | No exposure |
| `master-PLB-HNC-75C0015A` | HNC ICON toilet suite | Price/GST basis unverified | 4; $299, basis unknown | No exposure |
| `master-PLB-HNC-71245` | HNC ICON laundry tub | Price/GST basis unverified | 1; $225, basis unknown | No exposure |
| `master-PLB-HNC-V780-00-1` | HNC Vivid shower/bath mixer | Price required | 1; selected rate missing | No exposure |
| `master-BEACON-LIGHTING-170065` | Beacon Eclipse Maxi downlight | Requirement target missing | 53; $12.95 inc GST | $623.95 |
| `master-BEACON-LIGHTING-018386` | Beacon Campari pendant | Requirement target missing | 3; $349 inc GST | $951.82 |
| `master-PLB-HNC-42222W` | HNC AeroFlow Winglide fan | Requirement target missing | 7; $219 inc GST | $1,393.64 |
| `master-PLB-HNC-SPY1423NBL` | Ventair SPYDA fan | Requirement target missing | 2; $368 inc GST | $669.09 |
| `master-PLB-HNC-STA1203WH` | Ventair STANZA fan | Requirement target missing | 9; $218 inc GST | $1,783.64 |

These 35 blockers sum to the reported $5,561.64 known exposure. Unknown prices/GST bases are intentionally excluded.

## Work Completed

- Added shared pure audit `lib/builders/productSelectionIntegrity.js`. It classifies saved canonical identities and nested plumbing/entry-door products; checks actual quote-row product IDs, price/GST, quantity, baselines, procurement representations and duplicate claims.
- Added visible audit panel on Client Selections, Quotation Builder and Project Estimate.
- Persisted audit snapshot in job save (`productSelectionIntegrity`, versioned and checked timestamp).
- Client Selections explicit save now runs the common `planSelectionReconciliation` after canonical selection writes; only verified outcomes apply, proposed/ambiguous mappings remain unapplied.
- The shared target planner is used by both explicit reconciliation preview/apply and Client Selections save. A single quantified service row now resolves automatically; multiple candidates stay for review.
- Customer Project Estimate PDF export requires a complete, matching job/workspace audit and rejects blocked or unrepresented selections.
- Commercial PO issue checks the affected selected product/quote rows. Draft PO creation remains allowed for remediation; an unapproved or missing procurement requirement cannot be issued.
- Procurement snapshots distinguish `REQUIRED_BUT_UNPRICED`, `PRICED_NOT_APPROVED`, `APPROVED_FOR_ORDERING`, `ORDERED`, `DELIVERED` and explicit existing-subcontract inclusion.
- Builder CSV import now maps/persists optional `gstIncluded`, `priceStatus`, `availability` and `supplierProductRef`, and displays these fields in review/library tables. Blank optional update fields preserve existing product metadata.
- Export validation verifies job/workspace binding, complete selection identity count, the evidence behind priced/included/replacement outcomes, procurement representation and duplicate quote claims.
- Service selection now binds automatically to a single quantified quotation row; multiple quantified options remain for builder review.

## Verification And Remaining Acceptance

| Area | Result | Evidence / blocker |
| --- | --- | --- |
| Shared selection integrity audit | PASS, 30 focused checks | Covers canonical and legacy selected-product identities, status classification, export evidence/identity guards, procurement issue approval, duplicate claims, packages, replacements, quantity/rate, tenant identity and read-only behavior. |
| CSV identity/import | PASS, isolated DB | 16 PGlite/UI checks, stable supplier/SKU ID, idempotent update, tenant separation, stale preview rejected, GST/price/availability metadata round trip, and canonical product-to-quote/procurement round trip. |
| Product Library counts | PARTIAL | 5,933 static master, 5,855 selectable; 136 review-classified and 106 unclassified. Workspace-private Product Library totals were not fetched in this unauthenticated run. |
| Category connectors | PASS, unit/integration | Appliance, flooring, tiling, bathroom packs, service rows and entry-door furniture connector suites pass. |
| Isolated selections | FAIL, explicitly blocked | 52 selected IDs; 17 priced; 16 missing verified price; 16 target missing; 3 ambiguous. |
| Existing-package verification | BLOCKED | 0 documented included-in-package outcomes; no approved inclusion snapshot attached. |
| BOQ | BLOCKED | No linked commercial Project/Snapshot for this isolated local job. Product-tagged quote projection exists and BOQ filter tests pass; commercial snapshot line count is unavailable. |
| Procurement | FAIL | 37/52 represented, 15 missing; 0 duplicate requirement/charge claims; issue gate added. |
| Variations | BLOCKED | No production inclusion baseline; no verified replacement/upgrade can be approved from this job record. |
| Save + audit snapshot | PASS | Revision 10, 3,538 quotation rows; saved audit has 52 identities and all outcome counts above. |
| Hard refresh/reopen | BLOCKED | After save, hard refresh remained at “Preparing Estimate Builder…” over 90 seconds. IndexedDB still has revision 10 and the audit snapshot; route responds HTTP 200. No second save/retry was made. |
| Quote/payment integrity | PASS | Quotation SHA-256 `46bdf33df2ef9ae1f7a5cf01f1952dec29a252c381306120879ecd834dc2d5f1`; payment hash `6fb3163dd3ae635e115a8d37b9d5bb8050aa70f7e6ab5d37167653048c4280ca`; 3,538 rows, one $14,567.50 payment event. |
| Tenant isolation | PASS, isolated DB | 16 CSV PGlite/UI tests, plus resolver/selection same-workspace checks. No production migration needed/applied for this work. |
| New CSV item end-to-end through selection→quote→procurement | PASS in isolated database fixture; saved-job/BOQ/PO issue BLOCKED | A newly imported builder-private kitchen mixer retains its canonical UUID, quantity 2, GST-exclusive rate 132, one quote row and one procurement requirement on repeated sync. It was not added to the recovered job. The job lacks a linked commercial snapshot, and a live issued PO was correctly not attempted. |
| Zero silent omissions | FAIL / NOT ACCEPTED | 35 of 52 selected items are visibly blocked; PDF/PO issue paths refuse them rather than silently omit them. |

Full static master category counts and the package cross-check: [isolated-job JSON report](../artifacts/test-artifacts/product-selection-integrity/isolated-job-report.json). Revision-10 figures above come from the saved browser workbook itself; the two evidence sources differ in quotation hydration and must not be conflated.

## Changed Files In This P0 Continuation

- `lib/builders/productSelectionIntegrity.js`
- `lib/builders/allocatedSelectionQuotation.js`
- `lib/builders/plumbingFixtureAllocation.js`
- `lib/builders/residentialServices.js`
- `components/estimate-builder/ProductSelectionIntegrityPanel.jsx`
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js`
- `components/estimate-builder/EstimateBuilderWorkbook.js`
- `pages/modules/builders/purchase-orders.js`
- `pages/api/builders/proposal-document-export.js`
- `lib/builders/allocatedSelectionQuotation.js`
- `lib/builders/plumbingFixtureAllocation.js`
- `lib/builders/residentialServices.js`
- `lib/product-library/builderCsvImport.js`
- `lib/product-library/productLibraryDbMapper.js`
- `components/product-library/BuilderCsvImport.jsx`
- `scripts/audit-product-selection-integrity.mjs`
- `scripts/test-product-selection-integrity.mjs`
- `scripts/test-builder-product-csv-import.mjs`
- `scripts/test-quotation-builder-save-reopen-regression.mjs`
- `scripts/test-service-selection-quote-link.mjs`

The protected New Job 03/09 package still has SHA-256 `72bdbb4bbee9ffe20dd9c9d2d4d55018c2e49e66efcc3215a07059f73f6c1088`. The isolated revision saved only its audit metadata; quotation rows, section IDs/order, totals and payment history are unchanged. No PO, variation, commit, push, merge or deployment was created.
