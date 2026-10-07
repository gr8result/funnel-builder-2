# Freedom Trader Capital Flow Notes

Capital Flow is a Freedom Trader discovery layer. It does not replace the trade decision engine, position sizing, CMC order preparation, or Market Watch.

## Internal Components

- Relative activity versus normal volume.
- Price direction during the increased activity.
- Buying or selling pressure classification.
- Persistence across the latest available candles.
- Change from the previous stored Capital Flow score.
- Data quality and catalyst availability.

The user-facing explanation should stay plain English. Technical components are for diagnostics and tests.

## Current Data Limits

The current scanner uses the existing Twelve Data daily-history path and cached quote/reference flow. If intraday candles are present on a snapshot, Capital Flow will use them; otherwise it degrades to the latest daily/snapshot data and labels the quality accordingly.

There is no existing news/catalyst provider wired into Freedom Trader. Catalyst output must therefore remain "No obvious catalyst identified." unless reliable catalyst data is explicitly supplied by existing infrastructure.

## Later Freedom Investment Reuse

Freedom Investment should remain a separate strategy. A future long-term investment scanner could reuse these existing market/company fields without reusing Trader decisions:

- provider-supported symbol universe;
- company name, exchange, country, currency, and asset type;
- daily price history;
- latest price and volume;
- average volume and relative activity;
- trend and volatility diagnostics;
- data-quality metadata and provider timestamps.

Freedom Investment should not inherit Trader-only Capital Flow alerts, CMC order workflow, short-term exit logic, or paper-trading state.
