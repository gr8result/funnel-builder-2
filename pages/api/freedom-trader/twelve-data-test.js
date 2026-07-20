import {
  fetchTwelveDataHistory,
  fetchTwelveDataSymbolSearch,
  testTwelveDataWebSocket,
  twelveDataWebSocketStatus,
} from "../../../lib/freedom-trader/twelveData";

const US_TEST_SYMBOLS = ["MSFT", "AVGO", "META", "GOOGL", "NVDA", "AMZN"];
const ASX_TEST_SYMBOLS = [];

function summarizeHistory(result) {
  return {
    ok: result.ok,
    symbol: result.symbol,
    provider: result.provider || "Twelve Data",
    interval: result.interval,
    actualPriceReturned: result.currentPrice ?? null,
    candleCount: result.candleCount || 0,
    firstTimestamp: result.firstTimestamp || result.candles?.[0]?.date || null,
    latestTimestamp: result.latestTimestamp || result.candles?.[result.candles.length - 1]?.date || null,
    liveOrDelayedStatus: result.dataLabel || "Unavailable",
    exchange: result.exchange || null,
    currency: result.currency || null,
    error: result.error || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const usSymbols = String(req.query.us || US_TEST_SYMBOLS.join(","))
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  const asxSymbols = String(req.query.asx ?? ASX_TEST_SYMBOLS.join(","))
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  const runWebSocketTest = String(req.query.websocket || "").toLowerCase() === "1";

  const oneMinute = await Promise.all(usSymbols.map(async (symbol) => {
    const history = await fetchTwelveDataHistory({ symbol, range: "1d", interval: "1m" });
    return {
      symbol,
      oneMinuteOhlcv: summarizeHistory(history),
    };
  }));

  const asxMapping = await Promise.all(asxSymbols.map(async (symbol) => {
    const history = await fetchTwelveDataHistory({ symbol, exchange: "ASX", range: "1d", interval: "1m" });
    const search = await fetchTwelveDataSymbolSearch({ symbol, exchange: "ASX" });
    return {
      requestedSymbol: symbol,
      mappedSymbol: history.symbol,
      oneMinuteOhlcv: summarizeHistory(history),
      searchOk: search.ok,
      matches: search.matches.slice(0, 5).map((match) => ({
        symbol: match.symbol,
        instrumentName: match.instrument_name,
        exchange: match.exchange,
        currency: match.currency,
        country: match.country,
        type: match.type,
      })),
      error: history.error || search.error || null,
    };
  }));

  const failures = [
    ...oneMinute.flatMap((item) => [
      item.oneMinuteOhlcv.ok ? null : `${item.symbol} 1-minute OHLCV failed: ${item.oneMinuteOhlcv.error}`,
    ]),
    ...asxMapping.map((item) => (item.oneMinuteOhlcv.ok || item.searchOk ? null : `${item.requestedSymbol}:ASX mapping failed: ${item.error}`)),
  ].filter(Boolean);
  const websocketProbe = runWebSocketTest ? await testTwelveDataWebSocket(usSymbols[0] || "MSFT") : null;

  return res.status(200).json({
    ok: failures.length === 0,
    provider: "Twelve Data",
    freeTrialSupportsRequiredData: failures.length === 0 ? "yes" : "not confirmed",
    note: failures.length
      ? "Provider test did not pass. Freedom Trader chart routing should not be changed until these failures are resolved."
      : "Provider test passed for the requested checks.",
    websocketOrRealtimePriceUpdates: twelveDataWebSocketStatus(),
    websocketProbe,
    cmcComparison: {
      ok: false,
      error: "No connected CMC Invest or broker market-data endpoint exists in the Freedom Trader code path, so Twelve Data prices have not been verified against CMC.",
    },
    tests: {
      usOneMinuteOhlcv: oneMinute,
      asxTickerMapping: asxMapping,
    },
    failures,
    testedAt: new Date().toISOString(),
  });
}
