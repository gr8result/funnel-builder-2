import { fetchTwelveDataHistory, normalizeTwelveDataInterval } from "../../../lib/freedom-trader/twelveData.js";

const CACHE_TTL_MS = 60 * 1000;
const MAX_TWELVE_DATA_CREDITS_PER_MINUTE = 7;
const historyCache = globalThis.__freedomTraderHistoryCache || new Map();
const inFlightRequests = globalThis.__freedomTraderHistoryInFlight || new Map();
const creditWindow = globalThis.__freedomTraderTwelveDataCreditWindow || { minute: "", credits: 0 };

globalThis.__freedomTraderHistoryCache = historyCache;
globalThis.__freedomTraderHistoryInFlight = inFlightRequests;
globalThis.__freedomTraderTwelveDataCreditWindow = creditWindow;

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeRange(value) {
  const aliases = {
    "1d": "1d",
    "5d": "5d",
    "1m": "1mo",
    "1mo": "1mo",
    "3m": "3mo",
    "3mo": "3mo",
    "6m": "6mo",
    "6mo": "6mo",
    "1y": "1y",
    "3y": "3y",
    "5y": "5y",
  };
  return aliases[String(value || "1y").trim().toLowerCase()] || "1y";
}

function rangeInterval(range) {
  return {
    "1d": "1min",
    "5d": "5min",
    "1mo": "30min",
    "3mo": "1h",
    "6mo": "1h",
    "1y": "1day",
    "3y": "1day",
    "5y": "1day",
  }[range] || "1day";
}

function cacheKey(symbol, range, interval) {
  return `${symbol}:${range}:${interval}`;
}

function currentMinuteKey() {
  return new Date().toISOString().slice(0, 16);
}

function msUntilNextMinute() {
  const now = new Date();
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 250;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetCreditWindowIfNeeded() {
  const minute = currentMinuteKey();
  if (creditWindow.minute !== minute) {
    creditWindow.minute = minute;
    creditWindow.credits = 0;
  }
}

function canSpendCredits(credits = 1) {
  resetCreditWindowIfNeeded();
  return creditWindow.credits + credits <= MAX_TWELVE_DATA_CREDITS_PER_MINUTE;
}

function spendCredits(credits = 1) {
  resetCreditWindowIfNeeded();
  creditWindow.credits += credits;
  return creditWindow.credits;
}

function isMinuteLimitError(error) {
  return String(error || "").toLowerCase().includes("current limit being 8")
    || String(error || "").toLowerCase().includes("api credits for the current minute")
    || String(error || "").toLowerCase().includes("per-minute");
}

function limitErrorResult(symbol, range, interval) {
  return {
    ok: false,
    symbol,
    range,
    interval,
    provider: "Twelve Data",
    source: "Twelve Data",
    dataLabel: "Unavailable",
    exchange: null,
    currency: null,
    candleCount: 0,
    candles: [],
    error: "Twelve Data's per-minute request limit has been reached. The chart will retry shortly.",
  };
}

function logHistoryRequest({ symbol, range, interval, endpoint, cacheStatus, estimatedCredits }) {
  console.log("Freedom Trader Twelve Data request", {
    timestamp: new Date().toISOString(),
    ticker: symbol,
    endpoint,
    range,
    interval,
    cache: cacheStatus,
    creditsEstimated: estimatedCredits,
    creditsUsedThisMinute: creditWindow.credits,
  });
}

async function fetchWithMinuteRetry(symbol, range, interval) {
  const endpoint = "time_series";
  const estimatedCredits = 1;

  if (!canSpendCredits(estimatedCredits)) {
    logHistoryRequest({ symbol, range, interval, endpoint, cacheStatus: "rate-limited-before-request", estimatedCredits });
    return limitErrorResult(symbol, range, interval);
  }

  spendCredits(estimatedCredits);
  logHistoryRequest({ symbol, range, interval, endpoint, cacheStatus: "miss", estimatedCredits });
  let result = await fetchTwelveDataHistory({ symbol, range, interval });

  if (!result.ok && isMinuteLimitError(result.error)) {
    await wait(msUntilNextMinute());
    if (!canSpendCredits(estimatedCredits)) {
      return limitErrorResult(symbol, range, interval);
    }
    spendCredits(estimatedCredits);
    logHistoryRequest({ symbol, range, interval, endpoint, cacheStatus: "retry-after-minute-limit", estimatedCredits });
    result = await fetchTwelveDataHistory({ symbol, range, interval });
    if (!result.ok && isMinuteLimitError(result.error)) {
      return limitErrorResult(symbol, range, interval);
    }
  }

  return result;
}

export async function fetchTraderHistory(symbol, range = "1y", requestedInterval = null) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedRange = normalizeRange(range);
  const interval = normalizeTwelveDataInterval(requestedInterval, normalizedRange) || rangeInterval(normalizedRange);
  const key = cacheKey(normalizedSymbol, normalizedRange, interval);
  const cached = historyCache.get(key);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    logHistoryRequest({
      symbol: normalizedSymbol,
      range: normalizedRange,
      interval,
      endpoint: "time_series",
      cacheStatus: "hit",
      estimatedCredits: 0,
    });
    return { ...cached.data, cache: { hit: true, cachedAt: cached.cachedAt, ttlMs: CACHE_TTL_MS } };
  }

  if (inFlightRequests.has(key)) {
    logHistoryRequest({
      symbol: normalizedSymbol,
      range: normalizedRange,
      interval,
      endpoint: "time_series",
      cacheStatus: "deduped-in-flight",
      estimatedCredits: 0,
    });
    const data = await inFlightRequests.get(key);
    return { ...data, cache: { hit: false, deduped: true, ttlMs: CACHE_TTL_MS } };
  }

  const request = fetchWithMinuteRetry(normalizedSymbol, normalizedRange, interval)
    .then((data) => {
      if (data?.ok) {
        historyCache.set(key, { cachedAt: Date.now(), data });
      }
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, request);
  return request;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const symbol = normalizeSymbol(Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol || "NVDA");
  const range = normalizeRange(Array.isArray(req.query.range) ? req.query.range[0] : req.query.range);
  const interval = Array.isArray(req.query.interval) ? req.query.interval[0] : req.query.interval;

  if (!/^[A-Z.]{1,12}$/.test(symbol)) {
    return res.status(200).json({ ok: false, symbol, range, error: "Provide a valid symbol, such as NVDA." });
  }

  const result = await fetchTraderHistory(symbol, range, interval);
  return res.status(200).json({ ...result, updatedAt: new Date().toISOString() });
}
