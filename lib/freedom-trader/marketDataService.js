import { AlpacaProvider, FinnhubProvider, TwelveDataProvider, selectMarketDataProvider } from "./marketDataProviders.js";
import { fetchTwelveDataHistory, fetchTwelveDataHistoryBatch } from "./twelveData.js";

const TWELVE_DATA_CREDITS_PER_MINUTE = Math.max(1, Number(process.env.TWELVE_DATA_CREDITS_PER_MINUTE || process.env.TWELVE_DATA_REQUESTS_PER_MINUTE) || 8);
const TWELVE_DATA_BATCH_SIZE = Math.max(1, Math.min(8, Number(process.env.TWELVE_DATA_BATCH_SIZE) || 8));
const DAILY_HISTORY_TTL_MS = Math.max(60_000, Number(process.env.FREEDOM_DAILY_HISTORY_CACHE_TTL_MS) || 6 * 60 * 60 * 1000);
const INTRADAY_HISTORY_TTL_MS = Math.max(20_000, Number(process.env.FREEDOM_INTRADAY_HISTORY_CACHE_TTL_MS) || 60_000);
const QUOTE_TTL_MS = Math.max(20_000, Number(process.env.FREEDOM_QUOTE_CACHE_TTL_MS) || 60 * 1000);

const historyCache = globalThis.__freedomMarketHistoryCache || new Map();
const quoteCache = globalThis.__freedomMarketQuoteCache || new Map();
const inFlightHistory = globalThis.__freedomMarketHistoryInFlight || new Map();
const inFlightQuotes = globalThis.__freedomMarketQuoteInFlight || new Map();
const creditWindow = globalThis.__freedomMarketCreditWindow || { minute: "", credits: 0 };
const metrics = globalThis.__freedomMarketDataMetrics || {};
globalThis.__freedomMarketHistoryCache = historyCache;
globalThis.__freedomMarketQuoteCache = quoteCache;
globalThis.__freedomMarketHistoryInFlight = inFlightHistory;
globalThis.__freedomMarketQuoteInFlight = inFlightQuotes;
globalThis.__freedomMarketCreditWindow = creditWindow;
globalThis.__freedomMarketDataMetrics = metrics;

export const MARKET_DATA_PROVIDERS = [
  { id: AlpacaProvider.id, label: AlpacaProvider.label, history: true, quotes: true, batchHistory: true, intraday: true, configured: AlpacaProvider.hasCredentials() },
  { id: TwelveDataProvider.id, label: TwelveDataProvider.label, history: true, quotes: true, batchHistory: true, creditsPerMinute: TWELVE_DATA_CREDITS_PER_MINUTE },
  { id: FinnhubProvider.id, label: FinnhubProvider.label, history: false, quotes: true, batchHistory: false, symbolUniverse: true, configured: FinnhubProvider.hasCredentials(), accountHistoricalOhlcvMayBeRestricted: true },
];

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function currentMinuteKey() {
  return new Date().toISOString().slice(0, 16);
}

function msUntilNextMinute() {
  const now = new Date();
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 250;
}

function emptyMetrics() {
  return {
    twelveDataCreditsPerMinute: TWELVE_DATA_CREDITS_PER_MINUTE,
    historyProviderCalls: 0,
    historySymbolsRequested: 0,
    historyCreditsEstimated: 0,
    historyCacheHits: 0,
    historyDeduped: 0,
    historyRetries: 0,
    quoteProviderCalls: 0,
    quoteCacheHits: 0,
    quoteDeduped: 0,
    metadataProviderCalls: 0,
    indicatorProviderCalls: 0,
    duplicateCallsSuppressed: 0,
    providerRateLimitWaits: 0,
    providerRateLimitWaitMs: 0,
    alpacaProviderCalls: 0,
    alpacaSymbolsRequested: 0,
    alpacaBarsReturned: 0,
    alpacaFailures: 0,
    fallbackProviderCalls: 0,
  };
}

export function resetMarketDataMetrics() {
  Object.assign(metrics, emptyMetrics());
}

export function getMarketDataMetrics() {
  return { ...emptyMetrics(), ...metrics };
}

function countMetric(name, amount = 1) {
  metrics[name] = (Number(metrics[name]) || 0) + amount;
}

function resetCreditWindowIfNeeded() {
  const minute = currentMinuteKey();
  if (creditWindow.minute !== minute) {
    creditWindow.minute = minute;
    creditWindow.credits = 0;
  }
}

function creditCapacityRemaining() {
  resetCreditWindowIfNeeded();
  return Math.max(0, TWELVE_DATA_CREDITS_PER_MINUTE - creditWindow.credits);
}

async function waitForCredits(cost) {
  while (creditCapacityRemaining() < cost) {
    const waitMs = msUntilNextMinute();
    countMetric("providerRateLimitWaits");
    countMetric("providerRateLimitWaitMs", waitMs);
    await wait(waitMs);
  }
  creditWindow.credits += cost;
}

function historyCacheKey(symbol, range, interval) {
  return `${normalizeSymbol(symbol)}:${range}:${interval}`;
}

function historyTtlMs(interval) {
  return /min|h$/i.test(String(interval || "")) ? INTRADAY_HISTORY_TTL_MS : DAILY_HISTORY_TTL_MS;
}

function cachedHistory(symbol, range, interval) {
  const cached = historyCache.get(historyCacheKey(symbol, range, interval));
  if (!cached || Date.now() > cached.expiresAt) return null;
  const fetchedAtMs = Date.parse(cached.fetchedAt);
  if (Number.isFinite(fetchedAtMs) && Date.now() - fetchedAtMs > historyTtlMs(interval)) return null;
  countMetric("historyCacheHits");
  return { ...cached.data, cache: { hit: true, fetchedAt: cached.fetchedAt, expiresAt: cached.expiresAt, quality: cached.quality } };
}

function storeHistory(symbol, range, interval, data) {
  if (!data?.ok) return;
  const fetchedAt = new Date().toISOString();
  const ttlMs = historyTtlMs(interval);
  historyCache.set(historyCacheKey(symbol, range, interval), {
    fetchedAt,
    expiresAt: Date.now() + ttlMs,
    quality: ttlMs === INTRADAY_HISTORY_TTL_MS ? "intraday-history" : "daily-history",
    data: { ...data, fetchedAt },
  });
}

function isRateLimit(result) {
  return Number(result?.providerStatus) === 429 || /credit|limit|rate|429/i.test(String(result?.error || ""));
}

function emptyFailure(symbol, error) {
  return { ok: false, symbol, provider: "Freedom Market Data", source: "Freedom Market Data", candles: [], candleCount: 0, error: error?.message || String(error || "Market data unavailable."), statusCode: "DATA_UNAVAILABLE" };
}

export function priceSanityFromHistory(history, trade = null) {
  const candles = Array.isArray(history?.candles) ? history.candles : [];
  if (!history?.ok || candles.length < 20) return { ok: false, statusCode: "DATA_UNAVAILABLE", reason: history?.error || "Insufficient history for price validation." };
  const latest = candles[candles.length - 1];
  const latestClose = Number(latest?.close);
  const tradePrice = Number(trade?.price);
  const currentPrice = Number.isFinite(tradePrice) && tradePrice > 0 ? tradePrice : latestClose;
  const closes = candles.map((candle) => Number(candle.close)).filter(Number.isFinite);
  const recent = closes.slice(-20).sort((a, b) => a - b);
  const median = recent[Math.floor(recent.length / 2)];
  const recentLow = Math.min(...recent);
  const recentHigh = Math.max(...recent);
  if (![currentPrice, latestClose, median, recentLow, recentHigh].every(Number.isFinite) || currentPrice <= 0 || latestClose <= 0) {
    return { ok: false, statusCode: "DATA_UNAVAILABLE", reason: "Invalid current price or historical close." };
  }
  const closeDifference = Math.abs(currentPrice - latestClose) / latestClose;
  const medianDifference = Math.abs(currentPrice - median) / median;
  const outsideRange = currentPrice > recentHigh * 1.75 || currentPrice < recentLow * 0.35;
  if (closeDifference > 0.35 || medianDifference > 1.5 || outsideRange) {
    return {
      ok: false,
      statusCode: "DATA_INVALID",
      reason: "SYMBOL DATA INVALID - ANALYSIS WITHHELD. Current price is discontinuous from validated OHLCV history.",
      currentPrice,
      latestClose,
      recentMedian: median,
      recentLow,
      recentHigh,
      tradePrice: Number.isFinite(tradePrice) ? tradePrice : null,
    };
  }
  return { ok: true, currentPrice, latestClose, recentMedian: median, recentLow, recentHigh, tradePrice: Number.isFinite(tradePrice) ? tradePrice : null };
}

function isAlpacaPrimary() {
  return selectMarketDataProvider("usOhlcv").id === AlpacaProvider.id;
}

async function fetchTwelveHistoryWithRetry(symbol, range, interval) {
  await waitForCredits(1);
  countMetric("historyProviderCalls");
  countMetric("historySymbolsRequested");
  countMetric("historyCreditsEstimated");
  let result = await fetchTwelveDataHistory({ symbol, range, interval });
  if (!result.ok && isRateLimit(result)) {
    const waitMs = Number.isFinite(Number(result.retryAfterMs)) ? Number(result.retryAfterMs) : msUntilNextMinute();
    countMetric("providerRateLimitWaits");
    countMetric("providerRateLimitWaitMs", waitMs);
    await wait(waitMs);
    await waitForCredits(1);
    countMetric("historyRetries");
    countMetric("historyProviderCalls");
    countMetric("historySymbolsRequested");
    countMetric("historyCreditsEstimated");
    result = await fetchTwelveDataHistory({ symbol, range, interval });
  }
  return result;
}

export async function fetchSharedHistory(symbol, range = "1y", interval = "1day") {
  const normalized = normalizeSymbol(symbol);
  const key = historyCacheKey(normalized, range, interval);
  const cached = cachedHistory(normalized, range, interval);
  if (cached) return cached;
  if (inFlightHistory.has(key)) {
    countMetric("historyDeduped");
    countMetric("duplicateCallsSuppressed");
    return { ...(await inFlightHistory.get(key)), cache: { deduped: true } };
  }

  const request = (async () => {
    let result = null;
    if (isAlpacaPrimary()) {
      const batch = await AlpacaProvider.historyBatch([normalized], { range, interval });
      const diagnostics = batch.diagnostics || {};
      countMetric("historyProviderCalls", diagnostics.apiCalls || 1);
      countMetric("historySymbolsRequested");
      countMetric("alpacaProviderCalls", diagnostics.apiCalls || 1);
      countMetric("alpacaSymbolsRequested");
      countMetric("alpacaBarsReturned", diagnostics.barsReturned || 0);
      countMetric("alpacaFailures", diagnostics.failures || 0);
      result = batch.get(normalized);
    }
    if (!result?.ok) {
      if (result) countMetric("fallbackProviderCalls");
      result = await fetchTwelveHistoryWithRetry(normalized, range, interval);
    }
    storeHistory(normalized, range, interval, result);
    return result;
  })().finally(() => inFlightHistory.delete(key));
  inFlightHistory.set(key, request);
  return request;
}

export async function fetchSharedHistoryBatch(symbols = [], range = "1y", interval = "1day") {
  const unique = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
  const results = new Map();
  const remaining = [];
  for (const symbol of unique) {
    const cached = cachedHistory(symbol, range, interval);
    if (cached) {
      results.set(symbol, cached);
    } else if (inFlightHistory.has(historyCacheKey(symbol, range, interval))) {
      countMetric("historyDeduped");
      countMetric("duplicateCallsSuppressed");
      remaining.push(symbol);
    } else {
      remaining.push(symbol);
    }
  }

  if (remaining.length && isAlpacaPrimary()) {
    const toFetch = remaining.filter((symbol) => !inFlightHistory.has(historyCacheKey(symbol, range, interval)));
    const alreadyInFlight = remaining.filter((symbol) => inFlightHistory.has(historyCacheKey(symbol, range, interval)));
    if (toFetch.length) {
      const request = AlpacaProvider.historyBatch(toFetch, { range, interval });
      toFetch.forEach((symbol) => {
        inFlightHistory.set(historyCacheKey(symbol, range, interval), request.then((batch) => batch.get(symbol) || emptyFailure(symbol, "Alpaca did not return this symbol.")));
      });
      const batch = await request;
      const diagnostics = batch.diagnostics || {};
      countMetric("historyProviderCalls", diagnostics.apiCalls || 1);
      countMetric("historySymbolsRequested", toFetch.length);
      countMetric("alpacaProviderCalls", diagnostics.apiCalls || 1);
      countMetric("alpacaSymbolsRequested", toFetch.length);
      countMetric("alpacaBarsReturned", diagnostics.barsReturned || 0);
      countMetric("alpacaFailures", diagnostics.failures || 0);
      const fallbackSymbols = [];
      toFetch.forEach((symbol) => {
        const item = batch.get(symbol) || emptyFailure(symbol, "Alpaca did not return this symbol.");
        if (item?.ok) {
          storeHistory(symbol, range, interval, item);
          results.set(symbol, item);
        } else {
          fallbackSymbols.push(symbol);
        }
      });
      if (fallbackSymbols.length) {
        countMetric("fallbackProviderCalls");
        const fallback = await fetchTwelveDataHistoryBatch({ symbols: fallbackSymbols, range, interval });
        fallbackSymbols.forEach((symbol) => {
          const item = fallback.get(symbol) || batch.get(symbol) || emptyFailure(symbol, "Market data unavailable.");
          storeHistory(symbol, range, interval, item);
          results.set(symbol, item);
        });
      }
      toFetch.forEach((symbol) => inFlightHistory.delete(historyCacheKey(symbol, range, interval)));
    }
    for (const symbol of alreadyInFlight) {
      results.set(symbol, await inFlightHistory.get(historyCacheKey(symbol, range, interval)));
    }
    return results;
  }

  for (let offset = 0; offset < remaining.length; offset += Math.min(TWELVE_DATA_BATCH_SIZE, TWELVE_DATA_CREDITS_PER_MINUTE)) {
    const chunk = remaining.slice(offset, offset + Math.min(TWELVE_DATA_BATCH_SIZE, TWELVE_DATA_CREDITS_PER_MINUTE));
    const toFetch = chunk.filter((symbol) => !inFlightHistory.has(historyCacheKey(symbol, range, interval)));
    const alreadyInFlight = chunk.filter((symbol) => inFlightHistory.has(historyCacheKey(symbol, range, interval)));
    if (toFetch.length) {
      const request = (async () => {
        await waitForCredits(toFetch.length);
        countMetric("historyProviderCalls");
        countMetric("historySymbolsRequested", toFetch.length);
        countMetric("historyCreditsEstimated", toFetch.length);
        let batch = await fetchTwelveDataHistoryBatch({ symbols: toFetch, range, interval });
        if (Array.from(batch.values()).some(isRateLimit)) {
          const retryAfter = Array.from(batch.values()).find((item) => Number.isFinite(Number(item?.retryAfterMs)))?.retryAfterMs;
          const waitMs = Number.isFinite(Number(retryAfter)) ? Number(retryAfter) : msUntilNextMinute();
          countMetric("providerRateLimitWaits");
          countMetric("providerRateLimitWaitMs", waitMs);
          await wait(waitMs);
          await waitForCredits(toFetch.length);
          countMetric("historyRetries");
          countMetric("historyProviderCalls");
          countMetric("historySymbolsRequested", toFetch.length);
          countMetric("historyCreditsEstimated", toFetch.length);
          batch = await fetchTwelveDataHistoryBatch({ symbols: toFetch, range, interval });
        }
        toFetch.forEach((symbol) => storeHistory(symbol, range, interval, batch.get(symbol)));
        return batch;
      })();
      toFetch.forEach((symbol) => {
        inFlightHistory.set(historyCacheKey(symbol, range, interval), request.then((batch) => batch.get(symbol) || emptyFailure(symbol, "Twelve Data did not return this symbol.")));
      });
      const batch = await request;
      toFetch.forEach((symbol) => {
        inFlightHistory.delete(historyCacheKey(symbol, range, interval));
        results.set(symbol, batch.get(symbol) || emptyFailure(symbol, "Twelve Data did not return this symbol."));
      });
    }
    for (const symbol of alreadyInFlight) {
      results.set(symbol, await inFlightHistory.get(historyCacheKey(symbol, range, interval)));
    }
  }
  return results;
}

function snapshotFromHistory(symbol, history, trade = null) {
  const candles = Array.isArray(history?.candles) ? history.candles.filter((candle) => ["open", "high", "low", "close"].every((key) => Number.isFinite(candle[key]) && candle[key] > 0)) : [];
  const latest = candles[candles.length - 1] || null;
  const previous = candles[candles.length - 2] || null;
  const sanity = priceSanityFromHistory({ ...history, candles }, trade);
  const quality = history?.cache?.hit || history?.cache?.preScreenHit ? "cached" : history?.ok && latest ? "daily-only" : "unavailable";
  const usable = history?.ok && latest && sanity.ok;
  const currentPrice = sanity.ok ? sanity.currentPrice : latest?.close ?? null;
  return {
    symbol: normalizeSymbol(symbol),
    exchange: history?.exchange || "NASDAQ",
    currency: history?.currency || "USD",
    quote: {
      price: usable ? currentPrice : null,
      previousClose: previous?.close ?? null,
      change: Number.isFinite(currentPrice) && Number.isFinite(previous?.close) ? round(currentPrice - previous.close) : null,
      changePercent: Number.isFinite(currentPrice) && Number.isFinite(previous?.close) && previous.close ? round(((currentPrice - previous.close) / previous.close) * 100) : null,
      timestamp: trade?.timestamp || latest?.date || null,
      delayed: true,
    },
    candles: { daily: candles, intraday: null },
    averageVolume: candles.length ? Math.round(candles.slice(-20).reduce((total, candle) => total + (Number(candle.volume) || 0), 0) / Math.min(20, candles.length)) : null,
    source: history?.provider || history?.source || "Twelve Data",
    fetchedAt: new Date().toISOString(),
    dataQuality: usable ? quality : "unavailable",
    candleCount: candles.length,
    error: usable ? null : sanity.reason || history?.error || "Market data unavailable.",
    statusCode: usable ? null : sanity.statusCode || history?.statusCode || "DATA_UNAVAILABLE",
    priceSanity: sanity,
    latestTrade: trade?.ok ? trade : null,
    cache: history?.cache || null,
  };
}

export async function getMarketSnapshot(symbol, options = {}) {
  const history = await fetchSharedHistory(symbol, options.range || "1y", options.interval || "1day");
  const trade = isAlpacaPrimary() ? await AlpacaProvider.latestTrade(symbol).catch(() => null) : null;
  if (trade?.ok) countMetric("quoteProviderCalls");
  return snapshotFromHistory(symbol, history, trade);
}

export async function getMarketSnapshotBatch(symbols, options = {}) {
  const history = await fetchSharedHistoryBatch(symbols, options.range || "1y", options.interval || "1day");
  const unique = Array.from(new Set(symbols.map(normalizeSymbol)));
  const trades = isAlpacaPrimary() && unique.length
    ? await AlpacaProvider.latestTradeBatch(unique).catch(() => new Map())
    : new Map();
  if (trades?.diagnostics) countMetric("quoteProviderCalls", trades.diagnostics.apiCalls || 1);
  const output = new Map();
  unique.forEach((symbol) => output.set(symbol, snapshotFromHistory(symbol, history.get(symbol), trades.get?.(symbol))));
  return output;
}

export async function getCurrentPrice(symbol) {
  const normalized = normalizeSymbol(symbol);
  const cached = quoteCache.get(normalized);
  if (cached && Date.now() < cached.expiresAt) {
    countMetric("quoteCacheHits");
    return cached.data;
  }
  if (inFlightQuotes.has(normalized)) {
    countMetric("quoteDeduped");
    countMetric("duplicateCallsSuppressed");
    return inFlightQuotes.get(normalized);
  }
  const request = getMarketSnapshot(normalized).then((snapshot) => {
    countMetric("quoteProviderCalls", 0);
    const data = { price: snapshot.quote.price, delayed: true, dataQuality: snapshot.dataQuality, timestamp: snapshot.quote.timestamp, error: snapshot.error };
    quoteCache.set(normalized, { expiresAt: Date.now() + QUOTE_TTL_MS, data });
    return data;
  }).finally(() => inFlightQuotes.delete(normalized));
  inFlightQuotes.set(normalized, request);
  return request;
}
