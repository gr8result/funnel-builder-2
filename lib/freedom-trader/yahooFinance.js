import { validateOhlcvCandle } from "./chartSeriesIntegrity.js";

const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

const RANGE_TO_YAHOO = {
  "1d": "5d",
  "5d": "5d",
  "1mo": "1mo",
  "3mo": "3mo",
  "6mo": "6mo",
  "1y": "1y",
  "3y": "3y",
  "5y": "5y",
  max: "max",
};

const requestLog = globalThis.__freedomYahooFinanceRequestLog || [];
globalThis.__freedomYahooFinanceRequestLog = requestLog;

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function yahooRange(range = "1y") {
  return RANGE_TO_YAHOO[String(range || "1y").toLowerCase()] || "1y";
}

export function mapYahooAsxSymbol(symbol) {
  const clean = normalizeSymbol(symbol).replace(/:ASX$/, "").replace(/\.AX$/, "");
  return clean ? `${clean}.AX` : "";
}

function safeEndpoint(url) {
  return new URL(url).toString();
}

function emptyHistory({ symbol, providerSymbol, range, interval, error, status = 0, statusCode = null, payload = null }) {
  return {
    ok: false,
    symbol: providerSymbol || symbol,
    displaySymbol: symbol,
    providerSymbol: providerSymbol || null,
    range,
    interval,
    provider: "Yahoo Finance",
    source: "Yahoo Finance",
    dataLabel: "Unavailable",
    exchange: "ASX",
    currency: "AUD",
    candleCount: 0,
    candles: [],
    meta: null,
    error,
    providerStatus: status,
    statusCode: statusCode || (status === 429 ? "RATE_LIMITED" : status === 404 ? "SYMBOL_NOT_FOUND" : "DATA_UNAVAILABLE"),
    rawShape: payload && typeof payload === "object" ? Object.keys(payload) : [],
  };
}

function mapChartPayload({ symbol, providerSymbol, range, interval, payload }) {
  const result = payload?.chart?.result?.[0];
  const error = payload?.chart?.error;
  if (!result || error) {
    return emptyHistory({
      symbol,
      providerSymbol,
      range,
      interval,
      error: error?.description || error?.code || "Yahoo Finance did not return chart data.",
      payload,
    });
  }

  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const candles = timestamps.map((timestamp, index) => {
    const candle = {
      timestamp: Number(timestamp),
      date: new Date(Number(timestamp) * 1000).toISOString().slice(0, 10),
      open: numberValue(quote.open?.[index]),
      high: numberValue(quote.high?.[index]),
      low: numberValue(quote.low?.[index]),
      close: numberValue(quote.close?.[index]),
      adjClose: numberValue(result.indicators?.adjclose?.[0]?.adjclose?.[index]),
      volume: Number.isFinite(Number(quote.volume?.[index])) ? Number(quote.volume[index]) : 0,
      adjusted: false,
      provider: "Yahoo Finance",
      delayed: true,
      freshness: "Delayed",
    };
    return validateOhlcvCandle(candle).ok ? candle : null;
  }).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);

  if (String(meta.exchangeName || meta.fullExchangeName || "").toUpperCase() !== "ASX" || String(meta.currency || "").toUpperCase() !== "AUD") {
    return emptyHistory({
      symbol,
      providerSymbol,
      range,
      interval,
      error: `Yahoo Finance returned ${meta.exchangeName || "unknown exchange"} ${meta.currency || "unknown currency"}, expected ASX AUD.`,
      statusCode: "DATA_INVALID",
      payload,
    });
  }

  if (!candles.length) {
    return emptyHistory({ symbol, providerSymbol, range, interval, error: "Yahoo Finance returned no usable OHLCV candles.", payload });
  }

  const latest = candles[candles.length - 1];
  return {
    ok: true,
    symbol: providerSymbol,
    displaySymbol: symbol,
    providerSymbol,
    range,
    interval,
    provider: "Yahoo Finance",
    source: "Yahoo Finance",
    dataLabel: "ASX CLOSED - using latest completed session",
    exchange: "ASX",
    currency: "AUD",
    exchangeTimezone: meta.timezone || meta.exchangeTimezoneName || null,
    micCode: "XASX",
    type: meta.instrumentType || "EQUITY",
    adjusted: false,
    candleCount: candles.length,
    candles,
    meta,
    firstTimestamp: candles[0]?.date || null,
    latestTimestamp: latest?.date || null,
    currentPrice: latest?.close ?? numberValue(meta.regularMarketPrice),
    previousClose: numberValue(meta.chartPreviousClose) ?? candles[candles.length - 2]?.close ?? null,
    regularMarketPrice: numberValue(meta.regularMarketPrice),
    regularMarketTime: Number.isFinite(Number(meta.regularMarketTime)) ? Number(meta.regularMarketTime) : null,
    rawShape: {
      top: Object.keys(payload || {}),
      chart: Object.keys(payload?.chart || {}),
      result: Object.keys(result || {}),
      meta: Object.keys(meta || {}),
      quote: Object.keys(quote || {}),
    },
    error: null,
  };
}

export async function fetchYahooFinanceAsxHistory({ symbol, range = "1y", interval = "1day" } = {}) {
  const displaySymbol = normalizeSymbol(symbol).replace(/:ASX$/, "").replace(/\.AX$/, "");
  const providerSymbol = mapYahooAsxSymbol(displaySymbol);
  if (!providerSymbol) return emptyHistory({ symbol: displaySymbol, providerSymbol, range, interval, error: "Provide a valid ASX symbol." });

  const url = new URL(`${YAHOO_CHART_BASE_URL}/${encodeURIComponent(providerSymbol)}`);
  url.searchParams.set("range", yahooRange(range));
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "history");

  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 Freedom Trader",
      },
    });
    const payload = await response.json().catch(() => null);
    const history = response.ok
      ? mapChartPayload({ symbol: displaySymbol, providerSymbol, range, interval, payload })
      : emptyHistory({
        symbol: displaySymbol,
        providerSymbol,
        range,
        interval,
        error: payload?.chart?.error?.description || payload?.message || `Yahoo Finance request failed with status ${response.status}.`,
        status: response.status,
        payload,
      });
    requestLog.push({
      provider: "Yahoo Finance",
      path: "chart",
      endpoint: safeEndpoint(url),
      symbols: [providerSymbol],
      estimatedCredits: 0,
      httpStatus: response.status,
      providerStatus: history.ok ? "ok" : "error",
      providerCode: history.statusCode || null,
      providerMessage: history.error || null,
      responseBodyStructure: history.rawShape || (payload && typeof payload === "object" ? Object.keys(payload) : []),
      startedAt,
      completedAt: new Date().toISOString(),
    });
    return history;
  } catch (error) {
    const history = emptyHistory({ symbol: displaySymbol, providerSymbol, range, interval, error: error?.message || "Yahoo Finance request failed." });
    requestLog.push({
      provider: "Yahoo Finance",
      path: "chart",
      endpoint: safeEndpoint(url),
      symbols: [providerSymbol],
      estimatedCredits: 0,
      httpStatus: 0,
      providerStatus: "error",
      providerCode: history.statusCode,
      providerMessage: history.error,
      responseBodyStructure: [],
      startedAt,
      completedAt: new Date().toISOString(),
    });
    return history;
  }
}

export function resetYahooFinanceRequestLog() {
  requestLog.length = 0;
}

export function getYahooFinanceRequestLog() {
  return requestLog.map((item) => ({ ...item }));
}
