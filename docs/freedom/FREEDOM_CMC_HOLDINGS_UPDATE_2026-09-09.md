# Freedom CMC update — 9 September 2026

Updated the existing My Trades portfolio from the supplied CMC Stock Holdings screenshot.

| Holding | Shares | Native quote | CMC Value AUD | Open sells | Conditional orders | Available |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CBA | 45 | A$155.160 | A$6,982.20 | 0 | 0 | 45 |
| CLSK | 320 | US$13.480 | A$5,934.36 | 0 | -320 | 320 |
| IVV | 86 | A$70.800 | A$6,088.80 | 0 | 0 | 86 |
| JBLU | 240 | US$4.520 | A$0.00 | 240 | 0 | 0 |

The account header reports holdings A$19,152.07, cash A$13,256.45, portfolio A$32,408.52, total P&L +A$576.26 (+2.89%) and daily P&L +A$134.56. The holdings table separately totals A$19,005.36. Both are stored and displayed as supplied. Displayed FX rates are 1.000 for AUD and 0.727 for USD; quote and FX timestamps remain unknown.

JBLU remains owned with an open sell order. Its zero table value is retained without inventing a completed sale or a loss. The screenshot does not supply current per-holding P&L, return, daily P&L or purchase costs; P&L remains unknown and prior purchase costs are labelled as retained from the earlier snapshot.

NWH's existing holding is archived because it is absent from this CMC table. Its sale price, sale date and realised P&L remain unconfirmed. Its pending buy order remains separate. The Tiger Brokers TJGC position, previously archived WULF and all other unrelated records remain intact.

All 12 stable record IDs were preserved. Historical costs, original orders, targets, attached sell orders and prior snapshots are retained. The seven records outside this update are unchanged. Reapplying the same snapshot performs no write.

Snapshot: `data/freedom/cmc-holdings-2026-09-09.json`.

Portfolio store: `tmp/freedom-trades.json`.

Backup: `tmp/freedom-reconciliation-backups/before-2026-09-09T03-14-33-442Z.json`.

Validation: 65 relevant regression tests across snapshot, native broker, storage, loading and rendered page coverage, plus 770 API security assertions. Authenticated API responses and the refreshed desktop page matched all supplied values; browser verification caused no portfolio writes and reported no runtime errors. Desktop screenshot: `tmp/freedom-cmc-2026-09-09-desktop.png`. Mobile runtime checks passed, but the existing global sidebar leaves insufficient content width at 390px; its layout is outside this data update.

No server restart was required. Refresh My Trades to load the update.
