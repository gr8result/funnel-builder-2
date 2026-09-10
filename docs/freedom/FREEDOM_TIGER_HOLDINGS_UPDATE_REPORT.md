# Freedom portfolio update

The existing CMC reconciliation remains intact. Added the TJGC NASDAQ position from the supplied Tiger Brokers screenshot, using the existing local portfolio store at `tmp/freedom-trades.json`.

## Records

| Holding | Stable ID | Result |
| --- | --- | --- |
| CBA, 45 | `lt_CBA_159.174_45` | Existing CMC holding preserved |
| CLSK, 320 | `legacy_market_watch_watch_1787308148465_n9xq4o4c` | Active; original order and US$16 target preserved |
| IVV, 86 | `st_ivv_pb_mtjr2gyn` | Active long-term; prior pending order and confirmation history preserved |
| JBLU, 240 | `lt_JBLU_7.016_240` | Existing holding and US$6 sell order preserved |
| NWH, 1,436 | `lt_NWH_real_1436` | Existing holding and A$7.85 sell order preserved |
| WULF, 88 | `lt_WULF_21.619_88` | Archived; no sale price, sale date or realised P&L invented |
| TJGC, 4,096 | `broker_tiger-user-supplied-tjgc-2026-09-06` | Added once; default short-term classification, investment horizon not supplied |

TJGC was absent from the portfolio and legacy local storage files. XHLD appears only in the screenshot watchlist and was not added as an owned holding. All 11 pre-existing records are unchanged by this import. Repeating the import performs no write. Existing targets, original IDs, purchase information and history remain intact.

Backup immediately before adding TJGC: `tmp/freedom-reconciliation-backups/before-tiger-2026-09-05T23-23-05-892Z.json`.

## Valuation and provenance

CMC AUD totals independently verified through API responses and after browser reload: cost **A$31,017.64**, value **A$31,482.05**, P&L **+A$464.41**, return **+1.50%**, daily P&L **+A$60.27**.

TJGC is separate: native USD current price **10.42**, market value **42,680.32**, broker-reported position P&L **+1,503.22**, and displayed rounded FIFO **10.05**. USD is the native NASDAQ position currency; screenshot account aggregates explicitly labelled AUD are not assigned to TJGC. The exact cost and return percentage are absent and remain unknown. Rounded FIFO is labelled as such in the card, chart and Edit form; it is not stored as an execution price. Purchase/fill dates, quote timestamp and FX rate/timestamp remain null. The screenshot clock is stored separately from quote time.

My Trades and API AUD totals exclude positions without an AUD valuation. TJGC therefore does not change the requested CMC totals. Changing its quantity or FIFO invalidates the old broker P&L instead of manufacturing an exact cost basis.

## Verification

- 58 regression tests passed: reconciliation, duplicates, currency handling, unknown values, edit persistence in isolated storage, authorised/unauthorised access, independent collection failures, empty-state correctness and rendered page behaviour.
- 749 API security assertions passed. The route inventory test now checks every tracked route, accommodating the current 40 routes instead of stopping at an obsolete fixed count of 33.
- Live authenticated holdings, pending orders and long-term requests returned HTTP 200.
- Browser showed six active cards in three columns; all six Full Chart and Edit buttons opened, all six historical charts rendered, and IVV appeared in Long-Term Portfolio.
- Browser reload preserved the CMC totals, TJGC and archived WULF. No browser runtime errors occurred. Read-only browser verification made no portfolio writes.
- Final verification after the currency-label changes confirmed six cards, all CMC totals, explicit TJGC US$ value/P&L labels, and HTTP 200 for all three collections. Two preliminary automation attempts timed out; the final attempt completed with a longer wait. No server restart was used.
- Edit persistence was tested in isolated storage to avoid adding test targets to genuine holdings.

The previous `freedom` entitlement repair remains in place: authenticated, verified platform admins use the existing authorised admin mechanism; customer subscription checks remain protected.

## Files changed for this addition

- `lib/freedom/importNativeBrokerPosition.js`
- `lib/freedom/brokerHoldingsSnapshot.js`
- `data/freedom/tiger-tjgc-2026-09-06.json`
- `scripts/import-freedom-tiger-position.mjs`
- `pages/freedom/my-trades.js`
- `pages/freedom/long-term.js`
- `pages/api/freedom/trades.js`
- `pages/api/freedom/long-term.js`
- `components/freedom/FreedomTradeChart.js`
- `test/freedom-native-broker-position.test.mjs`
- `test/freedom-portfolio-page.test.mjs`
- `scripts/test-freedom-api-security.mjs`
- `tmp/freedom-trades.json` (local data, backed up before import)
- This report. Browser verification scripts and screenshot are in ignored `tmp/`.

Prior CMC changes are documented in `FREEDOM_CMC_HOLDINGS_UPDATE_REPORT.md`. Unrelated working-tree changes were preserved. No development server was started, stopped or restarted. Refresh the browser; no manual restart is required.
