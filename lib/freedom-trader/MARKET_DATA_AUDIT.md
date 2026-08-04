# Freedom Trader Market Data Audit

Milestone 1 scope: Freedom Trader V1.0 analyses US markets only. ASX support remains disabled until an ASX-capable data plan/provider is available.

## Connected Providers

- Twelve Data: daily OHLCV history through `time_series`; batch history uses comma-separated symbols.
- Finnhub: live US quote enhancement only, after Twelve Data history has produced a usable snapshot.

## Central Entry Points

- Scanner: `pages/api/freedom-trader/scanner.js` calls `getMarketSnapshotBatch`.
- Company history: `pages/api/freedom-trader/history.js` calls `fetchSharedHistory`.
- Company analysis: `pages/api/freedom-trader/analysis.js` calls `getMarketSnapshot`.
- Positions, alerts, market watch, and paper quote helpers use `getCurrentPrice` or `fetchTradeQuote`, which now route through the shared market-data service.

## Root Cause Found

The previous scanner was not failing because the opportunity rules were contradictory. It was marking predictable Twelve Data capacity limits as current-scan data failures.

Specifically, `fetchSharedHistoryBatch` split a requested scan into batches, then returned the remaining symbols as unavailable when the per-minute budget was exceeded. That produced honest-looking but incomplete numbers such as 12 analysed and 6 unavailable out of 18 requested, even though those symbols should have waited for the next provider slot.

## Fix Applied

- The shared service now waits for Twelve Data provider slots instead of marking overflow symbols unavailable.
- Batch requests consume one provider request slot per Twelve Data batch, not one failed row per queued symbol.
- Rate-limited batches are retried after the provider window resets.
- Successful history is cached for 15 minutes with `fetchedAt`, `expiresAt`, `provider`, and `dataQuality` metadata.
- The scanner API keeps a short-lived latest-scan cache so dashboard and scanner refreshes reuse the same result instead of launching duplicate provider work.
- The supported US universe is ordered by priority tier before scanning.

## Known Provider Limits

- Twelve Data plan limits can still return 429 or plan-restriction errors.
- If a provider still refuses data after Freedom waits and retries, the symbol remains unavailable and is not scored.
- No new provider was added in this milestone. The implementation prepares the provider boundary but does not build Finnhub/Yahoo/Polygon/AlphaVantage fallback feeds.

## Verification Target

A complete V1 scan should honestly report:

- supported universe count;
- requested count;
- successfully analysed count;
- data unavailable count;
- qualified count;
- not qualified count;
- provider status;
- last market-data timestamp;
- elapsed time.

The balancing rules remain:

- analysed + unavailable = requested;
- qualified + not qualified = analysed.
