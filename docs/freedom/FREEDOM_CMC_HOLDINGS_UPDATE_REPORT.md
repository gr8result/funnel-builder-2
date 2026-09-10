# Freedom CMC holdings reconciliation ? 6 September 2026

Updated the original portfolio from the supplied CMC Invest screenshot. The snapshot values remain distinct from live historical-chart data. No development server was started, stopped or restarted.

## Records

| Record | Stable ID | Result |
| --- | --- | --- |
| CBA | `lt_CBA_159.174_45` | Active: 45, average A$159.174 |
| CLSK:US | `legacy_market_watch_watch_1787308148465_n9xq4o4c` | Existing pending order confirmed owned: 320, average cost A$15.326, short-term. US$16 target and recorded US$10.67 Safety Exit retained. |
| IVV | `st_ivv_pb_mtjr2gyn` | Existing pending order moved to active long-term holdings: 86, actual average A$71.738. |
| JBLU:US | `lt_JBLU_7.016_240` | Active: 240, average AUD cost A$7.016; US$6 sell target retained. |
| NWH | `lt_NWH_real_1436` | Active: 1,436, supplied average A$7.728; A$7.85 take profit retained. |
| WULF:US | `lt_WULF_21.619_88` | Moved to `archivedHoldings`, retaining original record and US$16.40 sell-order history. |

IVV and CLSK have `status:open` and `orderClassification:COMPLETED_PURCHASE`. Their original order records, limits, source IDs, timestamps, and order histories remain under `originalOrder` / existing provenance fields. Added dated confirmation events record when this screenshot was reconciled, not an invented execution time. IVV's old A$71.09 buy limit is preserved as original order history; its supplied average actual buy price is A$71.738. CLSK's old US$10.85 limit likewise remains historical, not an assumed execution price.

WULF's status text is: ?No longer shown in current broker holdings?sale details require confirmation.? Sale price, sale date, and realised P&L remain unknown. It is visible in Closed / Archived and excluded from all active totals.

Duplicate audit: **11 records before and 11 afterward, with exactly the same 11 unique stable IDs**. Unrelated pending records are byte-equivalent at the record level. No duplicate records or test fixtures were inserted.

## Currency and provenance

- Native currency/current price: CLSK USD 12.690, JBLU USD 4.630; Australian instruments remain AUD.
- Actual average costs, exact total costs, market values, and P&L are separately labelled/stored in AUD. Exact broker totals take precedence over multiplying rounded averages.
- `brokerHoldingSnapshot` stores native prices, AUD values, source, import time, `quoteTimestamp:null`, `fxTimestamp:null`, and `fxRate:null`. Unknown timestamps and exchange rates were not inferred from the screenshot's index clock or from ratios.
- Live provider history is requested with explicit exchange/native currency and used only for charts. It does not overwrite the screenshot valuations.
- Known AUD buy prices, current prices and recorded targets are marked on charts. CLSK/JBLU AUD average costs are visibly annotated beside their USD charts; no false USD execution-price line or zero-price marker is drawn. Their actual USD execution prices/FX rates were not supplied.
- All previous company names were retained. NWH's name, NRW Holdings, was verified against its [official investor centre](https://nrw.com.au/investor-centre/).
- Original full portfolio backup: `tmp/freedom-reconciliation-backups/before-2026-09-05T21-43-52-231Z.json`.
- The input JSON uses the receipt date for identification, not a claimed broker quote date: `data/freedom/cmc-holdings-2026-09-06.json`.

## Independently verified totals

| Metric | API sum and refreshed page |
| --- | --- |
| Cost | A$31,017.64 |
| Market value | A$31,482.05 |
| P&L | +A$464.41 |
| Return | +1.50% |
| Daily P&L | +A$60.27 |

Verified all five active cards, three computed desktop grid columns, historical charts, View Full Chart and Edit dialogs. IVV is present in Long-Term Portfolio; neither IVV nor CLSK remains in Pending Buy Orders. Browser reload preserves the totals. Runtime errors: **[]**. All collection requests returned **200** using the existing authorized platform-admin session. No entitlement changes were needed this turn. Independent failure handling remains intact.

The old sell-order snapshots remain historical evidence. Their displayed current price/distance now derives from the current holdings snapshot, so JBLU shows US$4.63 and NWH A$7.64 consistently across each card.

Screenshot: `tmp/freedom-cmc-reconciled.png`.

## Files changed

- `tmp/freedom-trades.json` ? original portfolio reconciled, backed up first.
- `data/freedom/cmc-holdings-2026-09-06.json` ? supplied snapshot and record-ID mapping.
- `scripts/reconcile-freedom-cmc-holdings.mjs` ? preview/apply reconciliation, backup, concurrent-change protection and atomic replacement; repeated application is a no-op.
- `lib/freedom/brokerHoldingsSnapshot.js` ? reconciliation, authoritative AUD valuation and provenance-preserving edits.
- `lib/freedom/tradeStore.js` ? snapshot-aware enrichment/edits and archive access.
- `lib/freedom/marketLookup.js` ? exchange/native-currency identity for history requests.
- `lib/freedom/portfolioClient.js` ? carry archived metadata alongside the existing independently loaded collections.
- `pages/api/freedom/long-term.js` ? expose archive metadata and history identity.
- `pages/api/freedom/trades.js` ? native-currency validation and history identity.
- `pages/freedom/my-trades.js` ? three-column cards, exact prices/currencies/totals, archive display and filled-short-term holding edit form.
- `pages/freedom/long-term.js` ? AUD cost/valuation and native quote separation; correct chart markers.
- `components/freedom/FreedomTradeChart.js` ? precise marker values, excluding unknown prices instead of treating them as zero.
- `test/freedom-broker-snapshot.test.mjs` and `test/freedom-chart-known-prices.test.mjs`.
- This report.

## Tests

**52 regression tests passed**, including reconciliation/idempotency, duplicate/missing-record rejection, exact totals, preserved histories/targets, unknown FX/execution data, WULF archiving, edit/reload persistence using isolated test storage, precise chart markers, partial-load handling and existing portfolio/store/admin coverage.

**735 Freedom API security assertions passed.**

Browser verification independently confirmed data and totals after reload. Testing performed no additional writes to genuine records after the reconciliation.

**Refresh the browser. No manual restart is required.**
