# Window Reconciliation Audit

Protected job: `recovered-03-09-123`. Source: `C:/Users/grant/Downloads/New Job 03 09.gr8job`.

**Financial acceptance remains BLOCKED.** The report and audit were extended, not rebuilt. The real quotation route now loads an isolated copy; reconciliation previews, procurement refresh, save, hard refresh and reopen passed. BOQ/procurement view verification remains incomplete. No protected job was opened in the application, mutated, reconciled in place or saved. No quotation calculator, connector, resolver, persistence or commercial BOQ source was edited for this work.

## Direct Answers

- The schedule contains **26 conventional windows and 4 glazed sliding/stacker doors**. The entry door and garage door are separate, giving 32 external openings overall. The takeoff labels three stacker doors as `Window`, so its raw `openingType === Window` count is 29, not the conventional-window count.
- **12 priced opening rows charge 28 openings**: 24 conventional windows and 4 glazed doors. Two fixed windows have no saved quotation target or rate; the calculator creates two unpriced placeholders. These are not persisted quote rows.
- **No duplicate charged opening key, multiplied window quantity or duplicate window charge was found.** Grouping identical types and dimensions aggregates distinct physical opening IDs, not repeated imports of the same opening.
- The saved WINDOWS section contains **596 rows: 592 catalogue alternatives, 3 headings and 1 imported header**. The resolver's prefix-based schedule evidence includes the alternatives and headings without testing selection/quantity. The old UI joined that entire `rowIds` collection into one field. These IDs are saved price-list rows, not 595 selected windows, not 595 charges and not newly generated duplicate rows.
- Window reconciliation changes the calculated WINDOWS subtotal by **$0.00**. No money was added to the protected file. The **$5,252.85** screen total has saved inclusion/specification support, but whether supplier window rates already include screens is **not verified**. False takeoff flags alone are not evidence to remove charges.
- **Correction to the earlier non-window conclusion:** the $28,988.88 proposal came from an audit invocation with no Product Library lookup. It is reproducible but not application-equivalent. Using the hook's `getMasterProducts()` lookup produces an isolated **$49,034.12** proposal. Neither proposal was applied.

## Actual Schedule And Quotation Ledger

Dimensions below are height x width in mm. Quantities and costs are resolved by the existing calculator from a clone of the **actual saved quotation and saved takeoff**, not from catalogue availability. Both saved quotation representations, in `estimate.json` and `quotation.json`, agree.

Saved catalogue quantities are blank; their `quantityKey` links resolve the quantities shown below. `Generated only` means no corresponding row exists in the saved quotation. Unit rates are existing calculated rates; no rate was invented or changed. Costs are base line costs before job-wide adjustments.

The saved `boq.json` has **zero items**. Thus every saved BOQ quantity is absent; the projection column is not evidence of a synced commercial BOQ.

| Type / dimensions | Schedule qty | Matched quotation row | Quote qty | Unit rate | Extended cost | Saved BOQ / projection qty | Duplicate rows | Missing |
| --- | ---: | --- | ---: | ---: | ---: | --- | ---: | --- |
| Sliding 900 x 600 | 2 | 0906 Sliding Window | 2 | $430.00 | $860.00 | Absent / 2 | 0 | None |
| Sliding 900 x 1200 | 2 | 0912 Sliding Window | 2 | $561.18 | $1,122.36 | Absent / 2 | 0 | None |
| Sliding 1200 x 1800 | 2 | 1218 Sliding Window | 2 | $1,002.36 | $2,004.72 | Absent / 2 | 0 | None |
| Sliding 1200 x 2400 | 1 | 1224 Sliding Window | 1 | $1,296.48 | $1,296.48 | Absent / 1 | 0 | None |
| Sliding 1800 x 1800 | 1 | 1818 Sliding Window | 1 | $1,443.54 | $1,443.54 | Absent / 1 | 0 | None |
| Double hung 1800 x 600 | 7 | 1806 Double Hung | 7 | $653.52 | $4,574.64 | Absent / 7 | 0 | None |
| Double hung 1800 x 900 | 6 | 1809 Double Hung | 6 | $920.28 | $5,521.68 | Absent / 6 | 0 | None |
| Awning 1200 x 900 | 2 | 1209 Awning | 2 | $633.00 | $1,266.00 | Absent / 2 | 0 | None |
| Awning 1500 x 600 | 1 | 1506 Awning | 1 | $519.00 | $519.00 | Absent / 1 | 0 | None |
| Fixed glass 650 x 1800 | 1 | Generated only: fixed-glass-650x1800 | 1 | Required | $0.00 unresolved | Absent / 1 | 0 | Saved target and price |
| Fixed glass 650 x 3000 | 1 | Generated only: fixed-glass-650x3000 | 1 | Required | $0.00 unresolved | Absent / 1 | 0 | Saved target and price |
| Single-panel glazed door 2100 x 1500 | 1 | 2115 Glass Sliding Door | 1 | $1,406.77 | $1,406.77 | Absent / 1 | 0 | None |
| Stacker door 2100 x 3000 | 1 | 2130 Glass Sliding Door - Stacker | 1 | $2,693.55 | $2,693.55 | Absent / 1 | 0 | None |
| Stacker door 2100 x 3600 | 2 | 2136 Glass Sliding Door - Stacker | 2 | $3,208.26 | $6,416.52 | Absent / 2 | 0 | None |

Priced opening subtotal: **$29,125.26**. Flyscreens: **12 priced rows, 28 screens, $5,252.85**. WINDOWS subtotal: **$34,378.11**. Screens are separate requirements, not additional windows. The saved procurement section contains 52 items, with no window-specific requirement found; procurement completeness is not accepted.

## Screen Inclusion And Supplier Price Trace

The existing calculator copies each non-fixed opening group's quantity onto its flyscreen key. Rates come from the saved `windows price list` rows, backed by [windowsQuotePriceList.json](../lib/construction-estimation/catalogues/data/windowsQuotePriceList.json), whose source is the imported price-list CSV. This is not evidence of a current Dowell supplier quote or of whether its opening rates are screen-inclusive.

| Matched opening group (H x W mm) | Screen qty | Screen rate | Screen cost |
| --- | ---: | ---: | ---: |
| Sliding 900 x 600 | 2 | $80.00 | $160.00 |
| Sliding 900 x 1200 | 2 | $101.01 | $202.02 |
| Sliding 1200 x 1800 | 2 | $180.42 | $360.84 |
| Sliding 1200 x 2400 | 1 | $233.37 | $233.37 |
| Sliding 1800 x 1800 | 1 | $259.84 | $259.84 |
| Double hung 1800 x 600 | 7 | $117.63 | $823.41 |
| Double hung 1800 x 900 | 6 | $165.65 | $993.90 |
| Awning 1200 x 900 | 2 | $113.94 | $227.88 |
| Awning 1500 x 600 | 1 | $98.55 | $98.55 |
| Glazed single-panel door 2100 x 1500 | 1 | $253.22 | $253.22 |
| Glazed stacker door 2100 x 3000 | 1 | $484.84 | $484.84 |
| Glazed stacker door 2100 x 3600 | 2 | $577.49 | $1,154.98 |
| **Total** | **28** | | **$5,252.85** |

Exact screen row IDs, paired opening quote IDs, physical opening IDs, source, quantity, rate and cost are in `flyscreenRows` in the [audit JSON](../artifacts/test-artifacts/window-reconciliation-audit/report.json).

Saved inclusion sources:

- Selected package `std-premier-range-inclusions`, document name `Premier Inclusions Schedule`, source `native-master-template`.
- `standardInclusions.documentBuilder.pages[4].objects[34].data.text`: "Flyscreens to all windows" and "Barrier screens to sliding doors".
- `standardInclusions.documentBuilder.pages[8].objects[8].data.text`: "Barrier screens to all sliding doors" and "Flyscreens to all windows".
- `estimateInclusions.sections[7].bullets[3]`: "Flyscreen allowance where applicable".
- The saved Dowell selection specifies `screens: Standard insect screen`; its supplier status is `ready_for_rfq`, not a verified priced supplier package. No approved job inclusion snapshot is attached.

Window insect screens account for **$3,359.81**. Glazed-door screens account for **$1,893.04**. The latter need barrier-screen specification review; an insect screen and a barrier screen must not be assumed equivalent. No supplier package total, quote number or verified screen-inclusive opening rate was found to establish bundling. **Supplier-price inclusion remains UNKNOWN: do not remove or add charges without that evidence.**

## Fixed-Window Quotation Blockers

| Opening / location | Dimensions H x W | Qty | Selected supplier | Verified supplier rate | Status |
| --- | --- | ---: | --- | --- | --- |
| `1788819719715.5806`, Kitchen | 650 x 3000 mm | 1 | Dowell Windows | Missing | `WINDOW_PRICE_REQUIRED`; quotation blocked |
| `1788819730420.5293`, Pantry | 650 x 1800 mm | 1 | Dowell Windows | Missing | `WINDOW_PRICE_REQUIRED`; quotation blocked |

Both calculated unpriced placeholders retain their existing deterministic IDs. Neither has a saved quotation target or verified rate. The RFQ's generic `Current Price` label does not prove a rate. They are explicitly shown as quotation blockers in the report until verified prices are supplied; no estimated correction amount is invented.

## Thirty-Opening Downstream Mapping

The [thirty-opening mapping CSV](../artifacts/test-artifacts/window-reconciliation-audit/thirty-opening-mapping.csv) and `openingMappings` in the audit JSON map each physical opening exactly once to its size/type quotation group, BOQ projection and separate original-versus-isolated procurement evidence. The 26 windows and 4 glazed doors occupy mutually exclusive sets. Identical dimensions share one group; a shared group quantity must not be summed once per opening.

The original saved BOQ is empty and its saved procurement list has no window-linked requirements. The existing application procurement refresh was run **only on the isolated copy**: it created 14 opening groups covering all 30 openings, with exactly one requirement per quote-row ID and no duplicate door/window supply charge. The two unpriced groups retain missing-rate status. The isolated copy was saved as revision 2, and all mappings survived hard refresh; financial content also survived reopen. Its job ID is `gr8-window-report-audit-20261014`, not the protected job.

The Dowell selection's separate RFQ schedule has 28 entries. It omits current opening `1789845033591.3105` (Hallway/Passage double hung, 1800H x 600W) and `1789845050757.7505` (Laundry glazed door, 2100H x 1500W). Both are covered by the isolated quote-to-procurement mapping, but the supplier RFQ and live commercial snapshot have not been updated or accepted. Commercial BOQ persistence and issued procurement remain blocked, not silently claimed complete.

## Repeat Reconciliation And Financial Difference

The original no-lookup audit planner ran twice on separate in-memory copies of the protected workbook. It never persisted either result. Its missing Product Library argument is now recorded explicitly; it must not be confused with the application-backed proposal below.

| Measure | Saved-data calculation | First isolated reconciliation | Second isolated reconciliation |
| --- | ---: | ---: | ---: |
| Opening quantity represented | 30 | 30 | 30 |
| Priced opening rows | 12 | 12 | 12 |
| Opening base cost | $29,125.26 | $29,125.26 | $29,125.26 |
| Flyscreen base cost | $5,252.85 | $5,252.85 | $5,252.85 |
| WINDOWS base cost | $34,378.11 | $34,378.11 | $34,378.11 |
| Duplicate positive opening rows | 0 | 0 | 0 |
| Entire calculated quote total | $840,295.17 | $869,284.05 | $869,284.05 |

Window row IDs, quantities, rates, costs and BOQ projection are identical across all three stages. Window reconciliation therefore leaves the quotation unchanged: **$0.00 difference**. The first **whole-selection** reconciliation changes other categories and increases the calculated total by **$28,988.88**; the second run is idempotent and has zero changes. This is a proposed isolated result, not money added to the saved job, and it was not approved or applied.

The correct completed-window total is not established: two fixed-window prices are missing, and flyscreen supplier bundling and glazed-door screen specification need review. Do not label the entire customer quote correctly stated, overstated or understated by an invented net amount.

### Unapplied Non-Window Proposal Breakdown

The [original 115-row proposal ledger](../artifacts/test-artifacts/window-reconciliation-audit/non-window-proposed-changes.csv) records every substantive change behind the requested $28,988.88 figure, with product, row ID and occurrence, current and proposed quantity/rate/cost, current quotation representation and change reason. Pure section moves are not presented as new costs. Five extra floor-waste row occurrences share repeated IDs; the ledger preserves these occurrences rather than hiding $150 of existing charges. In the proposal they are consolidated into group quantities, not automatically approved for removal.

The [112-row application-equivalent ledger](../artifacts/test-artifacts/window-reconciliation-audit/non-window-application-equivalent-changes.csv) uses the same master Product Library lookup as the workbook hook. The no-lookup audit incorrectly reset known tile products to "tile to be selected" with zero rates; that input defect explains why the earlier proposal must not stand in for the application result. Both are isolated computations; no live private-catalogue overrides were fetched and neither proposal was applied.

| Adjustment component | Original no-lookup delta | Application-equivalent delta |
| --- | ---: | ---: |
| Base line items | $19,129.97 | $32,357.97 |
| Preliminaries | $0.00 | $0.00 |
| Overheads | $956.50 | $1,617.90 |
| Margin | $1,913.00 | $3,235.80 |
| Profit | $3,299.92 | $5,581.75 |
| GST | $2,529.94 | $4,279.34 |
| Fees | $0.00 | $0.00 |
| Sales commission | $1,159.55 | $1,961.36 |
| **Final total change, unapplied** | **$28,988.88** | **$49,034.12** |

The application-equivalent base delta comprises: flooring **+$20,981.79**, tiling **+$7,593.90**, appliances **+$4,545.00**, plumbing fixtures/hot water **+$3,124.55**, fix-out **-$87.27**, and underslab/drainage **-$3,800.00**. Removal of existing drainage value, product replacements, previously unpriced labour and all new supply charges need independent approval. The window/screen difference remains **$0.00** under both planner inputs.

## Other Visible Failures

Existing associated work is not necessarily the selected physical product, and alternative rows are not approved matches. No new row was proposed or applied by this audit.

| Requirement | Actual saved-quotation calculation evidence | Decision before any new row |
| --- | --- | --- |
| Garage door, 2400 x 4800 | Existing garage-door alternatives have no positive supply quantity. Jamb-install labour is already charged at 1 x $45; a garage-door electrical point also exists without a rate. | Do not duplicate jamb labour or the electrical point. Review the existing correctly sized supply alternative before adding anything. |
| Exposed aggregate driveway, 60 m2 | Existing exposed-aggregate row `quote-30061` is not quantified. CLEAN & SEAL DRIVEWAY already charges 60 m2 at $5 = $300 in landscaping. | Sealing is not concrete supply. Verify the existing concrete row mapping and area; do not charge the sealing twice. |
| External lighting | Selected external lighting schedule has 4 items; no dedicated positive external-lighting product row is found in the saved quote. Electrical installation is a separate scope. | Review product versus installation scope before adding material charges. |
| Oven, cooktop, rangehood, dishwasher | No positive dedicated appliance supply charge found. Oven/cooktop electrical points cost $130/$155; cabinet charges include $1,050 oven cabinet, $750 dishwasher cabinet and $1,050 rangehood cabinet. | Cabinets and points are not appliances. Preserve those charges; verify canonical appliance supply targets rather than adding a second appliance charge blindly. |
| Internal doors | Calculator generates 3 size-specific product rows: 8 x 720, 6 x 820, 2 x 1020 at 2040H; total 16 doors, $1,728. A generated jamb requirement has quantity 19 without a rate. | These calculated rows are not saved source rows. Reuse the dimensional takeoff ownership; do not add a generic second 16-door product row. |
| Skirting | `quote-159`: 314.28 at $17.50 = $5,499.90; `quote-1363`: 267.14 at $1.95 = $520.92. Separate installation labour: 314.28 at $3.50 = $1,099.98. | Multiple material charges require overlap/unit and 65/66/68 mm specification review. Do not assume they are missing or safe to duplicate. |
| Architraves | `quote-1356`: 216 at $12.15 = $2,624.40; internal-door archs `quote-1357`: 16 at $12.15 = $194.40. Exterior door/window installation labour also costs $348. | Verify measured units and whether generic and door-specific material scope overlap before any extra charge. |
| Stairs | STAIRS $6,360; STAIR/VOID BALUSTRADE $9,000; 16 dressed timber treads at $75 = $1,200. Separate selected balustrade charge $9,556.82 also exists. | Existing stair/tread/balustrade scope is already charged. Selected timber specification and balustrade overlap need review, not automatic additional rows. |

## Report UI And Verification

- The summary uses actual saved requirements and schedule identities/dimensions. It separates selected quantity, matched saved targets, missing targets, duplicates and financial review status.
- Unused catalogue alternatives are excluded from window matches. Two generated unpriced rows are labeled as not saved. Unknown duplicate/missing status outside verified matches is not reported as a successful zero.
- Type/dimension ledger and technical matches are expandable; technical diagnostics are capped at 8 relevant matches. No hundreds-of-IDs summary field remains.
- Protected-data audit PASS: actual 30-opening ledger, 28 saved-target matches, 2 unsaved placeholders, 12 priced opening rows, two-run parity and read-only source checks. A synthetic duplicate row is detected independently of stable row ID.
- Real quotation-route preview PASS: the fixture now uses a valid workspace response and the application's explicit-key IndexedDB schema. Two real previews preserve quotation/order/PO/payment/baseline fields; no non-window proposal is applied.
- Existing procurement refresh PASS on the isolated copy: 14 opening groups, all 30 quantities, one local requirement per quote group. Save PASS, revision 2 at `2026-10-14T07:20:29.979Z`, checksum `05e93b9c1e40fcb5a8fb118e3c5b283c29c5a4f4040d35ed60ddab24afd34c13`, 3,469 saved quotation rows. Hard refresh PASS, including all mappings; reopen PASS, including unchanged financial content.
- Full BOQ/procurement view verification remains INCOMPLETE: automation timed out waiting for its quotation-sheet test helper after navigating to BOQ. No JavaScript runtime error was recorded in that run. This is not proof the BOQ page is broken, nor a claim that the live commercial snapshot was synced. The complete browser suite remains failing; its last successful phases are recorded separately. Further browser harness repair is needed before acceptance.
- All external writes were intercepted in the disposable browser; no production database write occurred. The recovered job was never loaded or saved in that profile.
- Scoped ESLint and editor diagnostics PASS for the report-owned source and test files.

Evidence: [data audit JSON](../artifacts/test-artifacts/window-reconciliation-audit/report.json), [browser report](../artifacts/test-artifacts/window-reconciliation-audit/browser-report.json), [thirty-opening mapping](../artifacts/test-artifacts/window-reconciliation-audit/thirty-opening-mapping.csv), [original proposal ledger](../artifacts/test-artifacts/window-reconciliation-audit/non-window-proposed-changes.csv), [application-equivalent ledger](../artifacts/test-artifacts/window-reconciliation-audit/non-window-application-equivalent-changes.csv), [first browser screenshot](../artifacts/test-artifacts/window-reconciliation-audit/browser-preview-1.png).

Protected file SHA-256 before and after: `72bdbb4bbee9ffe20dd9c9d2d4d55018c2e49e66efcc3215a07059f73f6c1088`. Every protected quantity, rate, override, section order, variation baseline, PO and payment remains untouched in that file. No commit, reset, clean, revert, push or deployment was performed.

Protected quotation hash: `59dcf9b553e0dcfcd415d6f8fff217847a3d89ca4806956b9a9e2a73211cb113`; payment-history hash: `802898bddae57c5ec46517423e8aff12e58d99377e98d509deb2c7fc1a9dbe41`. The unchanged protected saved-data calculation remains **$840,295.17**. No saved supplier prices or manual overrides were replaced.