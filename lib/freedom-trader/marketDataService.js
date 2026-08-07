// Single server-side Market Data Manager for Freedom Trader.
//
// Why this exists: the scanner, analysis engine, positions, alerts and the
// company chart used to each fetch quotes/candles independently (mostly via
// a mandatory, uncached Finnhub quote call with no fallback). That caused
// every ASX symbol to be rejected outright whenever Finnhub failed, and let
// two unrelated Twelve Data rate limiters (scanner.js and history.js) fight
// over the same per-minute budget. This module is the one place that talks
// to the providers, so there is exactly one cache, one dedup map and one
// provider budget for the whole app.
import { fetchTwelveDataHistory, fetchTwelveDataHistoryBatch, classifyTwelveDataError } from "./twelveData.js";
import { getMarketSessionState } from "./marketHours.js";

const TWELVE_DATA_CREDITS_PER_MINUTE = Math.max(
  1,
  Number(process.env.TWELVE_DATA_REQUESTS_PER_MINUTE || process.env.TWELVE_DATA_CREDITS_PER_MINUTE) || 7
);
const TWELVE_DATA_BATCH_SIZE = Math.max(1, Math.min(8, Number(process.env.TWELVE_DATA_BATCH_SIZE) || 8));
const HISTORY_CACHE_TTL_MS = Math.max(60_000, Number(process.env.FREEDOM_MARKET_HISTORY_CACHE_TTL_MS) || 15 * 60 * 1000);
const FINNHUB_QUOTE_CACHE_TTL_MS = Math.max(20_000, Number(process.env.FREEDOM_FINNHUB_QUOTE_CACHE_TTL_MS) || 60 * 1000);
const RETRY_BACKOFF_MS = [400, 1200];
const STALE_DAILY_HOURS = 96;

const snapshotCache = globalThis.__freedomMarketHistoryCache || new Map();
const inFlightHistory = globalThis.__freedomMarketHistoryInFlight || new Map();
const creditWindow = globalThis.__freedomMarketCreditWindow || { minute: "", credits: 0 };
const finnhubQuoteCache = globalThis.__freedomMarketFinnhubCache || new Map();
const inFlightQuotes = globalThis.__freedomMarketQuoteInFlight || new Map();
const marketDataMetrics = globalThis.__freedomMarketDataMetrics || {};
globalThis.__freedomMarketHistoryCache = snapshotCache;
globalThis.__freedomMarketHistoryInFlight = inFlightHistory;
globalThis.__freedomMarketCreditWindow = creditWindow;
globalThis.__freedomMarketFinnhubCache = finnhubQuoteCache;
globalThis.__freedomMarketQuoteInFlight = inFlightQuotes;
globalThis.__freedomMarketDataMetrics = marketDataMetrics;

export const MARKET_DATA_PROVIDERS = [
  {
    id: "twelve-data",
    label: "Twelve Data",
    role: "daily history",
    batchSize: effectiveTwelveDataBatchSize(),
    creditsPerMinute: TWELVE_DATA_CREDITS_PER_MINUTE,
    creditModel: "one credit per symbol",
  },
  {
    id: "finnhub",
    label: "Finnhub",
    role: "live US quote enhancement",
    cacheTtlMs: FINNHUB_QUOTE_CACHE_TTL_MS,
  },
];

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function isAsxSymbol(symbol) {
  return normalizeSymbol(symbol).endsWith(".AX");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyMetrics() {
  return {
    historyProviderCalls: 0,
    historySymbolsRequested: 0,
    historyCacheHits: 0,
    historyDeduped: 0,
    historyRetries: 0,
    providerRateLimitWaits: 0,
    providerRateLimitWaitMs: 0,
    quoteProviderCalls: 0,
    quoteCacheHits: 0,
    quoteDeduped: 0,
    quoteTimeouts: 0,
  };
}

export function resetMarketDataMetrics() {
  Object.assign(marketDataMetrics, emptyMetrics());
}

export function getMarketDataMetrics() {
  return { ...emptyMetrics(), ...marketDataMetrics };
}

function countMetric(name, amount = 1) {
  marketDataMetrics[name] = (Number(marketDataMetrics[name]) || 0) + amount;
}

export function twelveDataCreditCost(symbols = []) {
  return Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))).length;
}

export function effectiveTwelveDataBatchSize({
  configuredBatchSize = TWELVE_DATA_BATCH_SIZE,
  creditsPerMinute = TWELVE_DATA_CREDITS_PER_MINUTE,
} = {}) {
  return Math.max(1, Math.min(configuredBatchSize, creditsPerMinute));
}

function currentMinuteKey() {
  return new Date().toISOString().slice(0, 16);
}

function resetCreditWindowIfNeeded() {
  const minute = currentMinuteKey();
  if (creditWindow.minute !== minute) {
    creditWindow.minute = minute;
    creditWindow.credits = 0;
  }
}

function msUntilNextMinute() {
  const now = new Date();
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 250;
}

export function creditCapacityRemaining() {
  resetCreditWindowIfNeeded();
  return Math.max(0, TWELVE_DATA_CREDITS_PER_MINUTE - creditWindow.credits);
}

function reserveCredits(count) {
  resetCreditWindowIfNeeded();
  creditWindow.credits += count;
  return creditWindow.credits;
}

function historyCacheKey(symbol, range, interval) {
  return `${normalizeSymbol(symbol)}:${range}:${interval}`;
}

function cachedHistory(symbol, range, interval) {
  const cached = snapshotCache.get(historyCacheKey(symbol, range, interval));
  if (!cached || Date.now() > cached.expiresAt) return null;
  return {
    ...cached.data,
    provider: cached.provider || cached.data?.provider,
    dataQuality: cached.dataQuality || cached.data?.dataQuality,
    cache: { hit: true, cachedAt: cached.cachedAt, fetchedAt: cached.fetchedAt, expiresAt: cached.expiresAt },
  };
}

function storeHistory(symbol, range, interval, data) {
  if (!data?.ok) return;
  const cachedAt = Date.now();
  snapshotCache.set(historyCacheKey(symbol, range, interval), {
    cachedAt,
    fetchedAt: data.fetchedAt || new Date(cachedAt).toISOString(),
    expiresAt: cachedAt + HISTORY_CACHE_TTL_MS,
    provider: data.provider || data.source || "Twelve Data",
    dataQuality: data.dataLabel || data.dataQuality || "delayed",
    data,
  });
}

async function waitForProviderSlot(cost = 1) {
  while (creditCapacityRemaining() < cost) {
    const waitMs = msUntilNextMinute();
    countMetric("providerRateLimitWaits");
    countMetric("providerRateLimitWaitMs", waitMs);
    await wait(waitMs);
  }
  reserveCredits(cost);
}

function retryableErrorCode(data) {
  const code = data?.errorCode || classifyTwelveDataError(data?.error, data?.providerStatus);
  return ["rate-limited", "timeout", "malformed-provider-response", "error"].includes(code) ? code : null;
}

function batchNeedsRetry(batchMap = new Map()) {
  return Array.from(batchMap.values()).some((item) => retryableErrorCode(item));
}

function emptyProviderFailure(symbol, error, errorCode = null) {
  return {
    ok: false,
    symbol,
    candles: [],
    candleCount: 0,
    provider: "Twelve Data",
    source: "Twelve Data",
    error: error instanceof Error ? error.message : String(error || "Market data provider failed."),
    errorCode: errorCode || classifyTwelveDataError(error instanceof Error ? error.message : error),
  };
}

// Fetches daily history for one symbol through the shared cache, in-flight
// dedup map and credit budget. This is the single choke point every caller
// (scanner, analysis, chart) should go through so nobody double-spends the
// provider's per-minute limit.
export async function fetchSharedHistory(symbol, range = "1y", interval = "1day") {
  const normalized = normalizeSymbol(symbol);
  const key = historyCacheKey(normalized, range, interval);

  const cached = cachedHistory(normalized, range, interval);
  if (cached) {
    countMetric("historyCacheHits");
    return cached;
  }

  if (inFlightHistory.has(key)) {
    countMetric("historyDeduped");
    const data = await inFlightHistory.get(key);
    return { ...data, cache: { hit: false, deduped: true } };
  }

  const request = (async () => {
    await waitForProviderSlot(1);
    countMetric("historyProviderCalls");
    countMetric("historySymbolsRequested");
    let result = await fetchTwelveDataHistory({ symbol: normalized, range, interval });
    for (let attempt = 0; !result.ok && classifyTwelveDataError(result.error) === "error" && attempt < RETRY_BACKOFF_MS.length; attempt += 1) {
      await wait(RETRY_BACKOFF_MS[attempt]);
      await waitForProviderSlot(1);
      countMetric("historyRetries");
      countMetric("historyProviderCalls");
      countMetric("historySymbolsRequested");
      result = await fetchTwelveDataHistory({ symbol: normalized, range, interval });
    }
    if (!result.ok && classifyTwelveDataError(result.error) === "rate-limited") {
      const retryWait = result.retryAfterMs || msUntilNextMinute();
      countMetric("providerRateLimitWaits");
      countMetric("providerRateLimitWaitMs", retryWait);
      await wait(retryWait);
      await waitForProviderSlot(1);
      countMetric("historyRetries");
      countMetric("historyProviderCalls");
      countMetric("historySymbolsRequested");
      result = await fetchTwelveDataHistory({ symbol: normalized, range, interval });
    }
    return result;
  })()
    .then((data) => {
      storeHistory(normalized, range, interval, data);
      return data;
    })
    .finally(() => inFlightHistory.delete(key));

  inFlightHistory.set(key, request);
  return request;
}

// Fetches daily history for many symbols with as few Twelve Data round trips
// as the plan allows, instead of one HTTP call per symbol. Symbols already
// cached or in flight are served from there; the remainder is chunked into
// batches of TWELVE_DATA_BATCH_SIZE. A provider limit is handled as back
// pressure: Freedom waits and retries the batch instead of marking the
// symbols unavailable in the current scan.
export async function fetchSharedHistoryBatch(symbols, range = "1y", interval = "1day") {
  const normalizedSymbols = Array.from(new Set(symbols.map(normalizeSymbol)));
  const results = new Map();
  const remaining = [];
  const batchSize = effectiveTwelveDataBatchSize();

  for (const symbol of normalizedSymbols) {
    const cached = cachedHistory(symbol, range, interval);
    if (cached) {
      countMetric("historyCacheHits");
      results.set(symbol, cached);
      continue;
    }
    if (inFlightHistory.has(historyCacheKey(symbol, range, interval))) {
      countMetric("historyDeduped");
      remaining.push(symbol);
      continue;
    }
    remaining.push(symbol);
  }

  for (let offset = 0; offset < remaining.length; offset += batchSize) {
    const chunk = remaining.slice(offset, offset + batchSize);
    const alreadyInFlight = chunk.filter((symbol) => inFlightHistory.has(historyCacheKey(symbol, range, interval)));
    const toFetch = chunk.filter((symbol) => !inFlightHistory.has(historyCacheKey(symbol, range, interval)));

    if (toFetch.length) {
      await waitForProviderSlot(twelveDataCreditCost(toFetch));
      countMetric("historyProviderCalls");
      countMetric("historySymbolsRequested", twelveDataCreditCost(toFetch));
      const requestPromise = (async () => {
        let batchMap;
        try {
          batchMap = await fetchTwelveDataHistoryBatch({ symbols: toFetch, range, interval });
          if (batchNeedsRetry(batchMap)) {
            const rateLimited = Array.from(batchMap.values()).some((item) => retryableErrorCode(item) === "rate-limited");
            const retryAfter = Array.from(batchMap.values()).find((item) => Number.isFinite(Number(item?.retryAfterMs)))?.retryAfterMs;
            const retryWait = rateLimited ? retryAfter || msUntilNextMinute() : RETRY_BACKOFF_MS[0];
            if (rateLimited) {
              countMetric("providerRateLimitWaits");
              countMetric("providerRateLimitWaitMs", retryWait);
            }
            await wait(retryWait);
            await waitForProviderSlot(twelveDataCreditCost(toFetch));
            countMetric("historyRetries");
            countMetric("historyProviderCalls");
            countMetric("historySymbolsRequested", twelveDataCreditCost(toFetch));
            batchMap = await fetchTwelveDataHistoryBatch({ symbols: toFetch, range, interval });
          }
        } catch (error) {
          batchMap = new Map(toFetch.map((symbol) => [symbol, emptyProviderFailure(symbol, error)]));
        }
        toFetch.forEach((symbol) => {
          const data = batchMap.get(symbol) || batchMap.get(symbol.replace(/\.AX$/, "")) || null;
          if (data) storeHistory(symbol, range, interval, data);
        });
        return batchMap;
      })();
      toFetch.forEach((symbol) => {
        inFlightHistory.set(
          historyCacheKey(symbol, range, interval),
          requestPromise.then((batchMap) => batchMap.get(symbol) || emptyProviderFailure(symbol, "Twelve Data did not return this symbol in the batch."))
        );
      });
      const batchMap = await requestPromise;
      toFetch.forEach((symbol) => {
        inFlightHistory.delete(historyCacheKey(symbol, range, interval));
        results.set(symbol, batchMap.get(symbol) || emptyProviderFailure(symbol, "Twelve Data did not return this symbol in the batch."));
      });
    }

    for (const symbol of alreadyInFlight) {
      try {
        const data = await inFlightHistory.get(historyCacheKey(symbol, range, interval));
        results.set(symbol, data);
      } catch (error) {
        results.set(symbol, emptyProviderFailure(symbol, error));
      }
    }
  }

  return results;
}

async function fetchFinnhubQuoteCached(symbol) {
  const normalized = normalizeSymbol(symbol);
  const cached = finnhubQuoteCache.get(normalized);
  if (cached && Date.now() - cached.cachedAt < FINNHUB_QUOTE_CACHE_TTL_MS) {
    countMetric("quoteCacheHits");
    return cached.data;
  }
  if (inFlightQuotes.has(normalized)) {
    countMetric("quoteDeduped");
    return inFlightQuotes.get(normalized);
  }

  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey || isAsxSymbol(normalized)) return null;

  const request = (async () => {
    try {
      countMetric("quoteProviderCalls");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(normalized)}&token=${encodeURIComponent(apiKey)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json().catch(() => null);
      const price = round(data?.c);
      if (!response.ok || !Number.isFinite(price) || price <= 0) return null;
      const result = { price, timestamp: Number.isFinite(Number(data?.t)) ? Number(data.t) * 1000 : null };
      finnhubQuoteCache.set(normalized, { cachedAt: Date.now(), data: result });
      return result;
    } catch (error) {
      if (error?.name === "AbortError") countMetric("quoteTimeouts");
      console.error("Freedom Trader Finnhub enhancement failed:", error);
      return null;
    } finally {
      inFlightQuotes.delete(normalized);
    }
  })();
  inFlightQuotes.set(normalized, request);
  return request;
}

function averageVolume(candles, period = 20) {
  const clean = candles.slice(-period).map((candle) => candle.volume).filter(Number.isFinite);
  if (!clean.length) return null;
  return Math.round(clean.reduce((total, value) => total + value, 0) / clean.length);
}

function classifyDataQuality({ historyOk, cacheHit, liveQuote, latestCandleDate }) {
  if (!historyOk) return "unavailable";
  const ageHours = latestCandleDate ? (Date.now() - Date.parse(latestCandleDate)) / 3600000 : null;
  if (Number.isFinite(ageHours) && ageHours > STALE_DAILY_HOURS) return "stale";
  if (cacheHit) return "cached";
  if (liveQuote) return "live";
  return "daily-only";
}

function unavailableReason(historyResult, symbol) {
  const classification = historyResult?.errorCode || classifyTwelveDataError(historyResult?.error, historyResult?.providerStatus);
  if (classification === "auth-required") return "Twelve Data authentication failed. Check the server API key.";
  if (classification === "permission-denied") return "Twelve Data denied access to this market data on the current plan.";
  if (classification === "plan-restricted") {
    return isAsxSymbol(symbol)
      ? "ASX market data requires a Twelve Data Pro/Venture plan (or an alternative ASX-capable provider). Currently on the Basic plan."
      : historyResult?.error || "This symbol requires a higher Twelve Data plan.";
  }
  if (classification === "rate-limited") return "Twelve Data was still rate limiting after Freedom waited and retried. Try again shortly.";
  if (classification === "timeout") return "Twelve Data timed out before returning usable market data.";
  if (classification === "malformed-provider-response") return "Twelve Data returned a response Freedom could not read safely.";
  return historyResult?.error || "Market data provider did not return usable data.";
}

function providerStatusFromHistory(historyResult, dataQuality) {
  const code = historyResult?.errorCode || classifyTwelveDataError(historyResult?.error, historyResult?.providerStatus);
  if (code === "auth-required" || code === "permission-denied" || code === "plan-restricted") return "permission-denied";
  if (code === "rate-limited") return "rate-limited";
  if (!historyResult?.ok) return "unavailable";
  if (dataQuality === "stale") return "stale";
  if (historyResult?.cache?.hit) return "cached";
  return "available";
}

// Builds one normalised MarketSnapshot from an already-fetched Twelve Data
// history result, optionally enhanced with a live Finnhub quote for US
// symbols. Never fabricates a price: if history failed, quote.price is null
// and dataQuality is "unavailable".
async function buildSnapshot(symbol, historyResult, { allowFinnhubEnhancement = true } = {}) {
  const normalized = normalizeSymbol(symbol);
  const candles = Array.isArray(historyResult?.candles)
    ? historyResult.candles.filter((candle) => ["open", "high", "low", "close"].every((key) => Number.isFinite(candle[key])))
    : [];
  const latest = candles[candles.length - 1] || null;
  const previous = candles[candles.length - 2] || null;

  const finnhub = allowFinnhubEnhancement && historyResult?.ok ? await fetchFinnhubQuoteCached(normalized) : null;
  const finnhubFresh = finnhub && Number.isFinite(finnhub.timestamp) && Date.now() - finnhub.timestamp < 20 * 60 * 1000;

  const price = finnhubFresh ? finnhub.price : latest?.close ?? null;
  const previousClose = latest?.close != null && finnhubFresh ? latest.close : previous?.close ?? null;
  const dataQuality = classifyDataQuality({
    historyOk: Boolean(historyResult?.ok) && candles.length > 0,
    cacheHit: Boolean(historyResult?.cache?.hit),
    liveQuote: Boolean(finnhubFresh),
    latestCandleDate: latest?.date || null,
  });
  const historyStatus = providerStatusFromHistory(historyResult, dataQuality);
  const quoteStatus = historyStatus === "permission-denied" || historyStatus === "rate-limited"
    ? historyStatus
    : dataQuality === "live"
      ? "live"
      : historyResult?.cache?.hit
        ? "cached"
        : dataQuality === "stale"
          ? "stale"
          : dataQuality === "unavailable"
            ? "unavailable"
            : "delayed";

  return {
    symbol: normalized,
    exchange: historyResult?.exchange || (isAsxSymbol(normalized) ? "ASX" : "NASDAQ"),
    currency: historyResult?.currency || (isAsxSymbol(normalized) ? "AUD" : "USD"),
    quote: {
      price: dataQuality === "unavailable" ? null : round(price),
      previousClose: round(previousClose),
      change: Number.isFinite(price) && Number.isFinite(previousClose) ? round(price - previousClose) : null,
      changePercent: Number.isFinite(price) && Number.isFinite(previousClose) && previousClose ? round(((price - previousClose) / previousClose) * 100) : null,
      timestamp: finnhubFresh ? new Date(finnhub.timestamp).toISOString() : latest?.date || null,
      delayed: dataQuality !== "live",
    },
    candles: { daily: candles, intraday: null },
    averageVolume: averageVolume(candles),
    source: historyResult?.provider || historyResult?.source || "Twelve Data",
    fetchedAt: new Date().toISOString(),
    marketState: getMarketSessionState(isAsxSymbol(normalized) ? "ASX" : "US"),
    dataQuality,
    quoteStatus,
    historyStatus,
    candleCount: candles.length,
    errorCode: dataQuality === "unavailable" || dataQuality === "stale" ? historyResult?.errorCode || null : null,
    error: dataQuality === "unavailable" || dataQuality === "stale" ? unavailableReason(historyResult, normalized) : null,
  };
}

export async function getMarketSnapshot(symbol, { range = "1y", interval = "1day", allowFinnhubEnhancement = true } = {}) {
  const historyResult = await fetchSharedHistory(symbol, range, interval);
  return buildSnapshot(symbol, historyResult, { allowFinnhubEnhancement });
}

export async function getMarketSnapshotBatch(symbols, { range = "1y", interval = "1day", allowFinnhubEnhancement = true } = {}) {
  const historyMap = await fetchSharedHistoryBatch(symbols, range, interval);
  const output = new Map();
  for (const symbol of Array.from(new Set(symbols.map(normalizeSymbol)))) {
    output.set(symbol, await buildSnapshot(symbol, historyMap.get(symbol), { allowFinnhubEnhancement }));
  }
  return output;
}

// Convenience for callers (open positions, alerts) that only need a current
// price for P/L or trigger checks, not the full snapshot. Falls back to the
// latest daily close when no live quote is available -- returns null (never
// a fabricated number) when there is truly no usable data.
export async function getCurrentPrice(symbol) {
  const snapshot = await getMarketSnapshot(symbol);
  return {
    price: snapshot.quote.price,
    delayed: snapshot.quote.delayed,
    dataQuality: snapshot.dataQuality,
    timestamp: snapshot.quote.timestamp,
    error: snapshot.error,
  };
}
