# Exterior door furniture selections

Client Selections renders the shared catalogue picker internally at `page=clientSelections&room=exterior&roomCategory=door-furniture`. It supplies explicit selection mode as a component property and retains the active project and door ID. Links also carry `mode=client-selection&returnPage=clientSelections`. Normal catalogue administration has no selection controls.

The picker saves the active job's selection book through `updateClientSelectionsBook`, with one hardware selection per scheduled door. Finish, published size/function options, quantity, product snapshot, door identity/location, status and timestamp are retained. Apply-all creates separate associations; changing or removing hardware updates only the generated quotation/procurement lines. Other job items and the catalogue are preserved. Missing rates remain null and display Rate required.

Takeoff import is optional. Manual doors have persistent identities, location, level and quantity. Compact imported schedules enrich those locations; this workflow does not load Takeoff plan data. Exact identity or unique level/location matches retain the manual identity and chosen products. Unmatched imports remain separate and cannot replace existing choices automatically. The saved job includes the hardware schedule, quotation rows, procurement items and supplier purchase-order schedule. Final Inclusions expands the same saved per-door selections.

## Catalogue

| Brand | Records | Missing images | Missing individual SKUs | Missing rates |
|---|---:|---:|---:|---:|
| Lockwood | 25 | 0 | 25 | 25 |
| Gainsborough | 121 | 0 | 0 | 121 |
| Lemaar | 58 | 0 | 0 | 58 |
| Zanda | 88 | 0 | 0 | 88 |

All 292 records have manufacturer model identifiers and local product images. Source URLs and evidence are recorded by the importer. Lockwood model identifiers are retained where an individual SKU is not published. Two Gainsborough URLs returned 404 and were skipped; details are in the import report. Existing catalogue records were preserved.

## Verification

Run `node --import ./scripts/register-json-loader.mjs scripts/test-entry-door-furniture.mjs` for catalogue, per-door association, apply-all, change/remove, generated schedule cleanup, final inclusions and navigation assertions.

Run `node --import ./scripts/register-json-loader.mjs scripts/verify-entry-door-furniture-live.mjs` for Chrome verification with a separate synthetic job containing ED1 (Ground / Entry) and ED2 (Upper / Terrace). It selects an entry door, follows the real furniture navigation, confirms a Lockwood Paradigm in Matt Black with quantity 2, checks Review Schedule, refreshes, exports/reopens the saved job, and checks the same options. It also checks normal administration has no Select controls. The runtime report and screenshots are in `test-artifacts/entry-door-furniture-live/`.

Additional checks: typecheck, lint, quotation save/reopen regression, exterior doors regression, navigation guard tests and Takeoff recovery contracts. No catalogue reset or deletion is used by these checks.

The separate evidence run (`scripts/verify-entry-door-furniture-evidence.mjs`) reopened the saved job and verified the readable Review Schedule summary and procurement display in Chrome. Both runtime reports passed with zero page errors. Screenshots `04-selected.png`, `08-reopened-options.png`, `09-readable-review-schedule.png` and `10-procurement-schedule.png` capture the result. The Review Schedule summary is outside the existing paginated document preview so its row remains visible.
