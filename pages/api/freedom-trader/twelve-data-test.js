import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

import {
  fetchTwelveDataApiUsage,
  fetchTwelveDataHistory,
  fetchTwelveDataQuote,
  fetchTwelveDataSymbolSearch,
  hasTwelveDataApiKey,
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
    endpoint: result.endpoint || "https://api.twelvedata.com/time_series",
    httpStatus: result.providerStatus || null,
    providerCode: result.providerCode || null,
    keySupplied: result.keySupplied ?? hasTwelveDataApiKey(),
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

function summarizeQuote(result) {
  return {
    ok: result.ok,
    symbol: result.symbol,
    provider: result.provider || "Twelve Data",
    endpoint: result.endpoint || "https://api.twelvedata.com/quote",
    httpStatus: result.providerStatus || null,
    providerCode: result.providerCode || null,
    keySupplied: result.keySupplied ?? hasTwelveDataApiKey(),
    price: result.price ?? null,
    previousClose: result.previousClose ?? null,
    exchange: result.exchange || null,
    currency: result.currency || null,
    timestamp: result.timestamp || null,
    error: result.error || null,
  };
}

function parseSymbolList(raw, fallback = []) {
  if (raw === undefined || raw === null) return fallback;
  return String(raw)
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const usSymbols = parseSymbolList(req.query.us, US_TEST_SYMBOLS);
  const asxSymbols = parseSymbolList(req.query.asx, ASX_TEST_SYMBOLS);
  const runWebSocketTest = String(req.query.websocket || "").toLowerCase() === "1";
  const usage = await fetchTwelveDataApiUsage().catch((error) => ({ ok: false, error: error.message }));
  const usageDailyExhausted = !usage.ok && /out of api credits|daily/i.test(String(usage.error || ""));

  const oneMinute = await Promise.all(usSymbols.map(async (symbol) => {
    if (usageDailyExhausted) {
      return {
        symbol,
        oneMinuteOhlcv: {
          ok: false,
          symbol,
          provider: "Twelve Data",
          endpoint: "https://api.twelvedata.com/time_series",
          httpStatus: usage.status || null,
          providerCode: usage.providerCode || null,
          keySupplied: usage.keySupplied ?? hasTwelveDataApiKey(),
          interval: "1min",
          actualPriceReturned: null,
          candleCount: 0,
          error: usage.error,
        },
      };
    }
    const history = await fetchTwelveDataHistory({ symbol, range: "1d", interval: "1m" });
    return {
      symbol,
      oneMinuteOhlcv: summarizeHistory(history),
    };
  }));

  const asxMapping = await Promise.all(asxSymbols.map(async (symbol) => {
    if (usageDailyExhausted) {
      return {
        requestedSymbol: symbol,
        mappedSymbol: `${symbol}:ASX`,
        quote: {
          ok: false,
          symbol: `${symbol}:ASX`,
          provider: "Twelve Data",
          endpoint: "https://api.twelvedata.com/quote",
          httpStatus: usage.status || null,
          providerCode: usage.providerCode || null,
          keySupplied: usage.keySupplied ?? hasTwelveDataApiKey(),
          price: null,
          previousClose: null,
          exchange: null,
          currency: null,
          timestamp: null,
          error: usage.error,
        },
        dailyOhlcv: {
          ok: false,
          symbol: `${symbol}:ASX`,
          provider: "Twelve Data",
          endpoint: "https://api.twelvedata.com/time_series",
          httpStatus: usage.status || null,
          providerCode: usage.providerCode || null,
          keySupplied: usage.keySupplied ?? hasTwelveDataApiKey(),
          interval: "1day",
          actualPriceReturned: null,
          candleCount: 0,
          firstTimestamp: null,
          latestTimestamp: null,
          liveOrDelayedStatus: "Unavailable",
          exchange: null,
          currency: null,
          error: usage.error,
        },
        searchOk: false,
        matches: [],
        error: usage.error,
      };
    }
    const quote = await fetchTwelveDataQuote({ symbol, exchange: "ASX" });
    const history = await fetchTwelveDataHistory({ symbol, exchange: "ASX", range: "1y", interval: "1day" });
    const search = await fetchTwelveDataSymbolSearch({ symbol, exchange: "ASX" });
    return {
      requestedSymbol: symbol,
      mappedSymbol: history.symbol,
      quote: summarizeQuote(quote),
      dailyOhlcv: summarizeHistory(history),
      searchOk: search.ok,
      matches: search.matches.slice(0, 5).map((match) => ({
        symbol: match.symbol,
        instrumentName: match.instrument_name,
        exchange: match.exchange,
        currency: match.currency,
        country: match.country,
        type: match.type,
      })),
      error: quote.error || history.error || search.error || null,
    };
  }));

  const failures = [
    ...oneMinute.flatMap((item) => [
      item.oneMinuteOhlcv.ok ? null : `${item.symbol} 1-minute OHLCV failed: ${item.oneMinuteOhlcv.error}`,
    ]),
    ...asxMapping.map((item) => (item.quote.ok && item.dailyOhlcv.ok ? null : `${item.requestedSymbol}:ASX quote/history failed: ${item.error}`)),
  ].filter(Boolean);
  const websocketProbe = runWebSocketTest ? await testTwelveDataWebSocket(usSymbols[0] || "MSFT") : null;

  return res.status(200).json({
    ok: failures.length === 0,
    provider: "Twelve Data",
    apiUsage: {
      ok: usage.ok,
      endpoint: usage.endpoint || "https://api.twelvedata.com/api_usage",
      httpStatus: usage.status || null,
      providerCode: usage.providerCode || null,
      providerStatus: usage.providerStatus || null,
      keySupplied: usage.keySupplied ?? hasTwelveDataApiKey(),
      planCategory: usage.plan_category || null,
      planLimit: usage.plan_limit || null,
      planDailyLimit: usage.plan_daily_limit || null,
      creditsUsed: usage.headers?.creditsUsed || usage.creditsUsed || null,
      creditsLeft: usage.headers?.creditsLeft || usage.creditsLeft || null,
      error: usage.error || null,
    },
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

// M2.1: authentication + freedom entitlement enforced before this handler.
// External market-data proxy: no stored Freedom rows, so no owner-isolation gate.
export default withFreedomApi(handler, { touchesData: false });
