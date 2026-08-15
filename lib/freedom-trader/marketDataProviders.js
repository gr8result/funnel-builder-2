import {
  fetchTwelveDataHistory,
  fetchTwelveDataQuoteBatch,
  fetchTwelveDataStocks,
} from "./twelveData.js";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const ALPACA_DATA_BASE_URL = "https://data.alpaca.markets/v2";
const ALPACA_TRADING_BASE_URL = process.env.ALPACA_TRADING_BASE_URL || "https://paper-api.alpaca.markets/v2";

const ALPACA_TIMEFRAMES = {
  "1min": "1Min",
  "5min": "5Min",
  "15min": "15Min",
  "30min": "30Min",
  "1h": "1Hour",
  "1day": "1Day",
  "1week": "1Week",
};

const RANGE_OUTPUT_SIZE = {
  "1d": 520,
  "5d": 520,
  "1mo": 780,
  "3mo": 390,
  "6mo": 390,
  "1y": 370,
  "3y": 780,
  "5y": 1300,
  "max": 5000,
};

function finnhubKey() {
  return process.env.FINNHUB_API_KEY?.trim() || "";
}

function alpacaKey() {
  return process.env.ALPACA_API_KEY?.trim() || process.env.APCA_API_KEY_ID?.trim() || "";
}

function alpacaSecret() {
  return process.env.ALPACA_API_SECRET?.trim() || process.env.APCA_API_SECRET_KEY?.trim() || "";
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = numberValue(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

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
    "max": "max",
  };
  return aliases[String(value || "1y").trim().toLowerCase()] || "1y";
}

function safeError(status, data, fallback) {
  if (data?.error) return String(data.error);
  if (data?.message) return String(data.message);
  if (data?.s && data.s !== "ok") return String(data.s);
  if (status) return `${fallback} failed with status ${status}.`;
  return fallback;
}

export function classifyProviderFailure(result = {}) {
  const status = Number(result.status || result.providerStatus);
  const text = String(result.error || result.message || "").toLowerCase();
  if (status === 429 || /rate|too many|limit/.test(text)) return "RATE_LIMITED";
  if (status === 401 || status === 403 || /not entitled|permission|subscription|access|unauthorized|forbidden/.test(text)) return "NOT_ENTITLED";
  if (status === 404 || /not found|symbol/.test(text)) return "SYMBOL_NOT_FOUND";
  if (/stale/.test(text)) return "STALE";
  return "DATA_UNAVAILABLE";
}

async function fetchFinnhub(path, params = {}, options = {}) {
  const key = finnhubKey();
  if (!key) return { ok: false, configured: false, status: 0, data: null, error: "FINNHUB_API_KEY is not configured." };
  const url = new URL(`${FINNHUB_BASE_URL}/${path}`);
  Object.entries({ ...params, token: key }).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  });
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Freedom Trader MarketDataProvider",
      },
    });
    const data = await response.json().catch(() => null);
    return {
      ok: response.ok,
      configured: true,
      status: response.status,
      data,
      error: response.ok ? null : safeError(response.status, data, "Finnhub request"),
      rateLimit: {
        limit: response.headers?.get?.("x-ratelimit-limit") || null,
        remaining: response.headers?.get?.("x-ratelimit-remaining") || null,
        reset: response.headers?.get?.("x-ratelimit-reset") || null,
        retryAfter: response.headers?.get?.("retry-after") || null,
      },
    };
  } catch (error) {
    return { ok: false, configured: true, status: 0, data: null, error: error?.message || "Finnhub request failed.", rateLimit: {} };
  }
}

async function fetchAlpaca(path, params = {}, options = {}) {
  const key = alpacaKey();
  const secret = alpacaSecret();
  if (!key || !secret) {
    return { ok: false, configured: false, status: 0, data: null, error: "ALPACA_API_KEY and ALPACA_API_SECRET are not configured.", statusCode: "DATA_UNAVAILABLE" };
  }
  const url = new URL(`${ALPACA_DATA_BASE_URL}/${path}`);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  });
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
        "User-Agent": "Freedom Trader MarketDataProvider",
      },
    });
    const data = await response.json().catch(() => null);
    const result = {
      ok: response.ok,
      configured: true,
      status: response.status,
      data,
      error: response.ok ? null : safeError(response.status, data, "Alpaca request"),
      rateLimit: {
        limit: response.headers?.get?.("x-ratelimit-limit") || null,
        remaining: response.headers?.get?.("x-ratelimit-remaining") || null,
        reset: response.headers?.get?.("x-ratelimit-reset") || null,
        retryAfter: response.headers?.get?.("retry-after") || null,
      },
    };
    return { ...result, statusCode: result.ok ? null : classifyProviderFailure(result) };
  } catch (error) {
    const result = { ok: false, configured: true, status: 0, data: null, error: error?.message || "Alpaca request failed.", rateLimit: {} };
    return { ...result, statusCode: classifyProviderFailure(result) };
  }
}

async function fetchAlpacaTrading(path, params = {}, options = {}) {
  const key = alpacaKey();
  const secret = alpacaSecret();
  if (!key || !secret) {
    return { ok: false, configured: false, status: 0, data: null, error: "ALPACA_API_KEY and ALPACA_API_SECRET are not configured.", statusCode: "DATA_UNAVAILABLE" };
  }
  const url = new URL(`${ALPACA_TRADING_BASE_URL}/${path}`);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  });
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
        "User-Agent": "Freedom Trader MarketDataProvider",
      },
    });
    const data = await response.json().catch(() => null);
    const result = {
      ok: response.ok,
      configured: true,
      status: response.status,
      data,
      error: response.ok ? null : safeError(response.status, data, "Alpaca trading request"),
      rateLimit: {
        limit: response.headers?.get?.("x-ratelimit-limit") || null,
        remaining: response.headers?.get?.("x-ratelimit-remaining") || null,
        reset: response.headers?.get?.("x-ratelimit-reset") || null,
        retryAfter: response.headers?.get?.("retry-after") || null,
      },
    };
    return { ...result, statusCode: result.ok ? null : classifyProviderFailure(result) };
  } catch (error) {
    const result = { ok: false, configured: true, status: 0, data: null, error: error?.message || "Alpaca trading request failed.", rateLimit: {} };
    return { ...result, statusCode: classifyProviderFailure(result) };
  }
}

function normalizeFinnhubQuote(symbol, result) {
  const data = result?.data || {};
  const price = round(data.c);
  const previousClose = round(data.pc);
  return {
    ok: Boolean(result?.ok && Number.isFinite(price)),
    symbol: normalizeSymbol(symbol),
    provider: "Finnhub",
    price,
    previousClose,
    change: round(data.d ?? (Number.isFinite(price) && Number.isFinite(previousClose) ? price - previousClose : null)),
    percentChange: round(data.dp),
    open: round(data.o),
    high: round(data.h),
    low: round(data.l),
    volume: null,
    timestamp: Number.isFinite(Number(data.t)) ? Number(data.t) : null,
    delayed: true,
    error: result?.ok ? null : result?.error || "Finnhub quote unavailable.",
    rateLimit: result?.rateLimit || {},
  };
}

function normalizeFinnhubCandles(symbol, result, range, interval) {
  const data = result?.data || {};
  const count = Array.isArray(data.c) ? data.c.length : 0;
  const candles = count
    ? data.c.map((close, index) => {
      const open = numberValue(data.o?.[index]);
      const high = numberValue(data.h?.[index]);
      const low = numberValue(data.l?.[index]);
      const normalizedClose = numberValue(close);
      const timestamp = Number(data.t?.[index]);
      if (![open, high, low, normalizedClose, timestamp].every(Number.isFinite)) return null;
      return {
        timestamp,
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close: normalizedClose,
        volume: Number.isFinite(Number(data.v?.[index])) ? Number(data.v[index]) : 0,
        provider: "Finnhub",
        delayed: true,
        freshness: "Delayed",
      };
    }).filter(Boolean)
    : [];
  return {
    ok: Boolean(result?.ok && data.s === "ok" && candles.length),
    symbol: normalizeSymbol(symbol),
    range,
    interval,
    provider: "Finnhub",
    candleCount: candles.length,
    candles,
    firstTimestamp: candles[0]?.date || null,
    latestTimestamp: candles[candles.length - 1]?.date || null,
    currentPrice: candles[candles.length - 1]?.close ?? null,
    error: result?.ok ? (data.s === "ok" ? null : data.s || "Finnhub returned no candle data.") : result?.error || "Finnhub candles unavailable.",
  };
}

function alpacaTimeframe(interval = "1day") {
  return ALPACA_TIMEFRAMES[String(interval || "1day").toLowerCase()] || "1Day";
}

function alpacaStart(range = "1y", interval = "1day") {
  const normalizedRange = normalizeRange(range);
  const now = Date.now();
  const isIntraday = alpacaTimeframe(interval) !== "1Day" && alpacaTimeframe(interval) !== "1Week";
  const days = {
    "1d": 3,
    "5d": 8,
    "1mo": 35,
    "3mo": 95,
    "6mo": 190,
    "1y": 380,
    "3y": 365 * 3 + 20,
    "5y": 365 * 5 + 30,
    "max": 365 * 10,
  }[normalizedRange] || 380;
  const cappedDays = isIntraday ? Math.min(days, normalizedRange === "1d" ? 3 : 8) : days;
  return new Date(now - cappedDays * 24 * 60 * 60 * 1000).toISOString();
}

function alpacaDate(value, timeframe) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const iso = new Date(parsed).toISOString();
  return timeframe === "1Day" || timeframe === "1Week" ? iso.slice(0, 10) : iso;
}

function normalizeAlpacaBars(symbol, bars = [], { range = "1y", interval = "1day" } = {}) {
  const timeframe = alpacaTimeframe(interval);
  const candles = bars
    .map((bar) => {
      const open = numberValue(bar.o);
      const high = numberValue(bar.h);
      const low = numberValue(bar.l);
      const close = numberValue(bar.c);
      const volume = Number(bar.v);
      const timestampMs = Date.parse(bar.t);
      if (![open, high, low, close].every(Number.isFinite) || !Number.isFinite(timestampMs)) return null;
      return {
        timestamp: Math.floor(timestampMs / 1000),
        date: alpacaDate(bar.t, timeframe),
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
        provider: "Alpaca",
        delayed: true,
        freshness: timeframe === "1Day" ? "End-of-day" : "Delayed",
        tradeCount: Number.isFinite(Number(bar.n)) ? Number(bar.n) : null,
        vwap: numberValue(bar.vw),
        adjusted: false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-(RANGE_OUTPUT_SIZE[normalizeRange(range)] || 370));
  return candles;
}

function emptyAlpacaHistory({ symbol, range, interval, error, status = 0, statusCode = "DATA_UNAVAILABLE" }) {
  return {
    ok: false,
    symbol: normalizeSymbol(symbol),
    range: normalizeRange(range),
    interval,
    provider: "Alpaca",
    source: "Alpaca",
    dataLabel: "Unavailable",
    exchange: "US",
    currency: "USD",
    candleCount: 0,
    candles: [],
    error,
    providerStatus: status,
    statusCode,
  };
}

function alpacaHistoryFromBars(symbol, bars, options = {}) {
  const range = normalizeRange(options.range);
  const interval = options.interval || "1day";
  const candles = normalizeAlpacaBars(symbol, bars, { range, interval });
  if (!candles.length) {
    return emptyAlpacaHistory({ symbol, range, interval, error: "Alpaca returned no usable OHLCV bars.", statusCode: "SYMBOL_NOT_FOUND" });
  }
  const latest = candles[candles.length - 1];
  return {
    ok: true,
    symbol: normalizeSymbol(symbol),
    range,
    interval,
    provider: "Alpaca",
    source: "Alpaca",
    dataLabel: latest.freshness,
    exchange: "US",
    currency: "USD",
    adjusted: false,
    candleCount: candles.length,
    candles,
    firstTimestamp: candles[0]?.date || null,
    latestTimestamp: latest?.date || null,
    currentPrice: latest?.close ?? null,
    error: null,
  };
}

function normalizeAlpacaQuote(symbol, quote, result = {}) {
  const bid = numberValue(quote?.bp);
  const ask = numberValue(quote?.ap);
  const price = numberValue(quote?.p) ?? (Number.isFinite(bid) && bid > 0 && Number.isFinite(ask) && ask > 0 ? round((bid + ask) / 2, 4) : null);
  const timestampMs = Date.parse(quote?.t);
  return {
    ok: Boolean(result?.ok && Number.isFinite(price)),
    symbol: normalizeSymbol(symbol),
    provider: "Alpaca",
    price,
    bid,
    ask,
    bidSize: numberValue(quote?.bs),
    askSize: numberValue(quote?.as),
    previousClose: null,
    change: null,
    percentChange: null,
    open: null,
    high: null,
    low: null,
    volume: null,
    timestamp: Number.isFinite(timestampMs) ? Math.floor(timestampMs / 1000) : null,
    delayed: true,
    freshness: "Delayed",
    error: result?.ok ? null : result?.error || "Alpaca quote unavailable.",
    statusCode: result?.ok ? null : result?.statusCode || classifyProviderFailure(result),
    rateLimit: result?.rateLimit || {},
  };
}

function normalizeAlpacaTrade(symbol, trade, result = {}) {
  const price = numberValue(trade?.p);
  const timestampMs = Date.parse(trade?.t);
  return {
    ok: Boolean(result?.ok && Number.isFinite(price)),
    symbol: normalizeSymbol(symbol),
    provider: "Alpaca",
    price,
    size: numberValue(trade?.s),
    exchange: trade?.x || null,
    timestamp: Number.isFinite(timestampMs) ? Math.floor(timestampMs / 1000) : null,
    delayed: true,
    freshness: "Delayed",
    error: result?.ok ? null : result?.error || "Alpaca trade unavailable.",
    statusCode: result?.ok ? null : result?.statusCode || classifyProviderFailure(result),
    rateLimit: result?.rateLimit || {},
  };
}

function normalizeAlpacaAsset(asset = {}) {
  return {
    id: asset.id || null,
    symbol: normalizeSymbol(asset.symbol),
    providerSymbol: normalizeSymbol(asset.symbol),
    name: asset.name || null,
    exchange: asset.exchange || null,
    assetClass: asset.class || asset.asset_class || null,
    assetType: asset.class || asset.asset_class || "us_equity",
    active: String(asset.status || "").toLowerCase() === "active",
    tradable: asset.tradable === true,
    marginable: asset.marginable === true,
    shortable: asset.shortable === true,
    fractionable: asset.fractionable === true,
    status: asset.status || null,
    rawAttributes: asset.attributes || [],
  };
}

function finnhubResolution(interval = "1day") {
  const value = String(interval || "").toLowerCase();
  if (value.includes("1min") || value === "1m") return "1";
  if (value.includes("5min") || value === "5m") return "5";
  if (value.includes("15min") || value === "15m") return "15";
  if (value.includes("30min") || value === "30m") return "30";
  if (value.includes("60") || value.includes("1h")) return "60";
  if (value.includes("week")) return "W";
  if (value.includes("month")) return "M";
  return "D";
}

function rangeSeconds(range = "1y") {
  const days = {
    "1d": 1,
    "5d": 5,
    "1mo": 31,
    "3mo": 92,
    "6mo": 183,
    "1y": 370,
  }[String(range).toLowerCase()] || 370;
  return days * 86400;
}

export const FinnhubProvider = {
  id: "finnhub",
  label: "Finnhub",
  envVarName: "FINNHUB_API_KEY",
  capabilities: {
    authentication: true,
    symbolSearch: true,
    companyProfile: true,
    symbolUniverse: true,
    quote: true,
    batchQuotes: false,
    historicalOhlcv: true,
    accountHistoricalOhlcvMayBeRestricted: true,
  },
  hasCredentials() {
    return Boolean(finnhubKey());
  },
  async authenticate(options = {}) {
    const result = await fetchFinnhub("quote", { symbol: options.symbol || "MSFT" }, options);
    const quote = normalizeFinnhubQuote(options.symbol || "MSFT", result);
    return {
      configured: Boolean(finnhubKey()),
      ok: quote.ok,
      status: result.status,
      provider: "Finnhub",
      rateLimit: result.rateLimit || {},
      error: quote.ok ? null : result.error || quote.error,
    };
  },
  async searchSymbols(query, options = {}) {
    const result = await fetchFinnhub("search", { q: query }, options);
    const matches = Array.isArray(result.data?.result) ? result.data.result : [];
    return {
      ok: result.ok,
      provider: "Finnhub",
      matches: matches.map((item) => ({
        symbol: normalizeSymbol(item.symbol),
        displaySymbol: item.displaySymbol || item.symbol,
        description: item.description || item.displaySymbol || item.symbol,
        type: item.type || null,
      })),
      error: result.error,
    };
  },
  async companyProfile(symbol, options = {}) {
    const result = await fetchFinnhub("stock/profile2", { symbol: normalizeSymbol(symbol) }, options);
    const data = result.data || {};
    return {
      ok: Boolean(result.ok && data.name),
      provider: "Finnhub",
      symbol: normalizeSymbol(data.ticker || symbol),
      companyName: data.name || null,
      exchange: data.exchange || null,
      country: data.country || null,
      currency: data.currency || null,
      industry: data.finnhubIndustry || null,
      ipo: data.ipo || null,
      marketCapitalization: data.marketCapitalization ?? null,
      error: result.ok ? null : result.error,
    };
  },
  async quote(symbol, options = {}) {
    return normalizeFinnhubQuote(symbol, await fetchFinnhub("quote", { symbol: normalizeSymbol(symbol) }, options));
  },
  async quoteBatch(symbols = [], options = {}) {
    const unique = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
    const output = new Map();
    for (const symbol of unique) output.set(symbol, await this.quote(symbol, options));
    return output;
  },
  async history(symbol, { range = "1y", interval = "1day" } = {}, options = {}) {
    const to = Math.floor(Date.now() / 1000);
    const from = to - rangeSeconds(range);
    const result = await fetchFinnhub("stock/candle", {
      symbol: normalizeSymbol(symbol),
      resolution: finnhubResolution(interval),
      from,
      to,
    }, options);
    return normalizeFinnhubCandles(symbol, result, range, interval);
  },
  async symbolUniverse({ exchange = "US" } = {}, options = {}) {
    const result = await fetchFinnhub("stock/symbol", { exchange }, options);
    const rows = Array.isArray(result.data) ? result.data : [];
    return {
      ok: result.ok,
      provider: "Finnhub",
      exchange,
      symbols: rows.map((row) => ({
        symbol: normalizeSymbol(row.symbol),
        displaySymbol: row.displaySymbol || row.symbol,
        description: row.description || row.displaySymbol || row.symbol,
        currency: row.currency || null,
        type: row.type || null,
      })).filter((row) => row.symbol),
      error: result.error,
    };
  },
};

export const AlpacaProvider = {
  id: "alpaca",
  label: "Alpaca",
  envVarNames: ["ALPACA_API_KEY", "ALPACA_API_SECRET"],
  supportedEnvVarNames: ["ALPACA_API_KEY", "ALPACA_API_SECRET", "APCA_API_KEY_ID", "APCA_API_SECRET_KEY"],
  capabilities: {
    authentication: true,
    quote: true,
    batchQuotes: true,
    historicalOhlcv: true,
    intradayOhlcv: true,
    batchHistoricalOhlcv: true,
    assetMetadata: true,
  },
  hasCredentials() {
    return Boolean(alpacaKey() && alpacaSecret());
  },
  async authenticate(options = {}) {
    const result = await fetchAlpaca("stocks/bars", {
      symbols: options.symbol || "MSFT",
      timeframe: "1Day",
      start: alpacaStart("5d", "1day"),
      adjustment: "raw",
      feed: options.feed || process.env.ALPACA_DATA_FEED || "iex",
      limit: 5,
    }, options);
    return {
      configured: this.hasCredentials(),
      ok: Boolean(result.ok),
      status: result.status,
      provider: "Alpaca",
      statusCode: result.ok ? null : result.statusCode,
      rateLimit: result.rateLimit || {},
      error: result.ok ? null : result.error,
    };
  },
  async quote(symbol, options = {}) {
    const normalized = normalizeSymbol(symbol);
    const result = await fetchAlpaca("stocks/quotes/latest", {
      symbols: normalized,
      feed: options.feed || process.env.ALPACA_DATA_FEED || "iex",
    }, options);
    const quote = result.data?.quotes?.[normalized] || result.data?.quote || null;
    return normalizeAlpacaQuote(normalized, quote, result);
  },
  async latestTrade(symbol, options = {}) {
    const normalized = normalizeSymbol(symbol);
    const result = await fetchAlpaca("stocks/trades/latest", {
      symbols: normalized,
      feed: options.feed || process.env.ALPACA_DATA_FEED || "iex",
    }, options);
    const trade = result.data?.trades?.[normalized] || result.data?.trade || null;
    return normalizeAlpacaTrade(normalized, trade, result);
  },
  async latestTradeBatch(symbols = [], options = {}) {
    const unique = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
    const output = new Map();
    if (!unique.length) return output;
    const result = await fetchAlpaca("stocks/trades/latest", {
      symbols: unique.join(","),
      feed: options.feed || process.env.ALPACA_DATA_FEED || "iex",
    }, options);
    unique.forEach((symbol) => {
      const trade = result.data?.trades?.[symbol] || null;
      output.set(symbol, normalizeAlpacaTrade(symbol, trade, result));
    });
    output.diagnostics = { provider: "Alpaca", symbolsRequested: unique.length, apiCalls: 1, failures: Array.from(output.values()).filter((item) => !item?.ok).length };
    return output;
  },
  async quoteBatch(symbols = [], options = {}) {
    const unique = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
    const output = new Map();
    if (!unique.length) return output;
    const result = await fetchAlpaca("stocks/quotes/latest", {
      symbols: unique.join(","),
      feed: options.feed || process.env.ALPACA_DATA_FEED || "iex",
    }, options);
    unique.forEach((symbol) => {
      const quote = result.data?.quotes?.[symbol] || null;
      output.set(symbol, normalizeAlpacaQuote(symbol, quote, result));
    });
    return output;
  },
  async history(symbol, { range = "1y", interval = "1day" } = {}, options = {}) {
    const batch = await this.historyBatch([symbol], { range, interval }, options);
    return batch.get(normalizeSymbol(symbol)) || emptyAlpacaHistory({ symbol, range, interval, error: "Alpaca did not return this symbol.", statusCode: "SYMBOL_NOT_FOUND" });
  },
  async historyBatch(symbols = [], { range = "1y", interval = "1day", limit = null } = {}, options = {}) {
    const unique = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
    const output = new Map();
    if (!unique.length) return output;
    const normalizedRange = normalizeRange(range);
    const timeframe = alpacaTimeframe(interval);
    const maxPerSymbol = Math.max(1, Number(limit) || RANGE_OUTPUT_SIZE[normalizedRange] || 370);
    const chunkSize = Math.max(1, Math.min(200, Number(options.chunkSize || process.env.ALPACA_SYMBOL_BATCH_SIZE) || 200));
    let apiCalls = 0;
    const failures = [];

    for (let offset = 0; offset < unique.length; offset += chunkSize) {
      const chunk = unique.slice(offset, offset + chunkSize);
      let pageToken = null;
      let guard = 0;
      const barsBySymbol = new Map(chunk.map((symbol) => [symbol, []]));
      do {
        const result = await fetchAlpaca("stocks/bars", {
          symbols: chunk.join(","),
          timeframe,
          start: alpacaStart(normalizedRange, interval),
          adjustment: "raw",
          feed: options.feed || process.env.ALPACA_DATA_FEED || "iex",
          limit: Math.min(10000, Math.max(chunk.length * maxPerSymbol, maxPerSymbol)),
          page_token: pageToken,
        }, options);
        apiCalls += 1;
        if (!result.ok) {
          chunk.forEach((symbol) => {
            output.set(symbol, emptyAlpacaHistory({ symbol, range: normalizedRange, interval, error: result.error, status: result.status, statusCode: result.statusCode }));
            failures.push(symbol);
          });
          break;
        }
        const payloadBars = result.data?.bars || {};
        chunk.forEach((symbol) => {
          const rows = Array.isArray(payloadBars[symbol]) ? payloadBars[symbol] : [];
          if (rows.length) barsBySymbol.get(symbol).push(...rows);
        });
        pageToken = result.data?.next_page_token || null;
        guard += 1;
      } while (pageToken && guard < 20 && Array.from(barsBySymbol.values()).some((bars) => bars.length < maxPerSymbol));

      chunk.forEach((symbol) => {
        if (output.has(symbol)) return;
        const bars = barsBySymbol.get(symbol) || [];
        output.set(symbol, alpacaHistoryFromBars(symbol, bars, { range: normalizedRange, interval }));
      });
    }
    output.diagnostics = {
      provider: "Alpaca",
      symbolsRequested: unique.length,
      barsReturned: Array.from(output.values()).reduce((total, item) => total + (Number(item?.candleCount) || 0), 0),
      apiCalls,
      failures: failures.length + Array.from(output.values()).filter((item) => !item?.ok).length,
    };
    return output;
  },
  async assetUniverse(options = {}) {
    const result = await fetchAlpacaTrading("assets", {
      status: "active",
      asset_class: "us_equity",
    }, options);
    const assets = Array.isArray(result.data) ? result.data.map(normalizeAlpacaAsset).filter((asset) => asset.symbol) : [];
    return {
      ok: result.ok,
      provider: "Alpaca",
      assets,
      assetsBySymbol: new Map(assets.map((asset) => [asset.symbol, asset])),
      status: result.status,
      statusCode: result.statusCode || null,
      error: result.error || null,
      rateLimit: result.rateLimit || {},
    };
  },
  async asset(symbol, options = {}) {
    const normalized = normalizeSymbol(symbol);
    const result = await fetchAlpacaTrading(`assets/${encodeURIComponent(normalized)}`, {}, options);
    return {
      ok: Boolean(result.ok && result.data?.symbol),
      provider: "Alpaca",
      asset: result.data?.symbol ? normalizeAlpacaAsset(result.data) : null,
      status: result.status,
      statusCode: result.statusCode || null,
      error: result.error || null,
    };
  },
};

export const TwelveDataProvider = {
  id: "twelve-data",
  label: "Twelve Data",
  capabilities: {
    symbolUniverse: true,
    quote: true,
    batchQuotes: true,
    historicalOhlcv: true,
  },
  async quoteBatch(symbols = [], options = {}) {
    return fetchTwelveDataQuoteBatch({ symbols, ...(options || {}) });
  },
  async history(symbol, options = {}) {
    return fetchTwelveDataHistory({ symbol, ...options });
  },
  async symbolUniverse({ exchange = "NASDAQ", country = "United States", type = "Common Stock" } = {}) {
    const result = await fetchTwelveDataStocks({ exchange, country, type });
    return {
      ok: result.ok,
      provider: "Twelve Data",
      exchange,
      symbols: result.symbols.map((row) => ({
        symbol: normalizeSymbol(row.symbol),
        displaySymbol: row.symbol,
        description: row.name || row.symbol,
        currency: row.currency || null,
        type: row.type || null,
      })),
      error: result.error,
    };
  },
};

export function selectMarketDataProvider(operation, options = {}) {
  const force = options.forceProvider || process.env.FREEDOM_MARKET_DATA_PROVIDER;
  if (force === "alpaca") return AlpacaProvider;
  if (force === "finnhub") return FinnhubProvider;
  if (force === "twelve-data") return TwelveDataProvider;
  if (operation === "symbolUniverse") return FinnhubProvider.hasCredentials() ? FinnhubProvider : TwelveDataProvider;
  if (operation === "preScreenQuote") return AlpacaProvider.hasCredentials() ? AlpacaProvider : FinnhubProvider.hasCredentials() ? FinnhubProvider : TwelveDataProvider;
  if (operation === "detailedHistory" || operation === "historyBatch" || operation === "usOhlcv") return AlpacaProvider.hasCredentials() ? AlpacaProvider : TwelveDataProvider;
  return TwelveDataProvider;
}

export function providerSummary() {
  return {
    providers: [
      { id: AlpacaProvider.id, envVarNames: AlpacaProvider.envVarNames, supportedEnvVarNames: AlpacaProvider.supportedEnvVarNames, configured: AlpacaProvider.hasCredentials(), capabilities: AlpacaProvider.capabilities },
      { id: FinnhubProvider.id, envVarName: FinnhubProvider.envVarName, configured: FinnhubProvider.hasCredentials(), capabilities: FinnhubProvider.capabilities },
      { id: TwelveDataProvider.id, capabilities: TwelveDataProvider.capabilities },
    ],
    selection: {
      symbolUniverse: selectMarketDataProvider("symbolUniverse").id,
      preScreenQuote: selectMarketDataProvider("preScreenQuote").id,
      detailedHistory: selectMarketDataProvider("detailedHistory").id,
      usOhlcv: selectMarketDataProvider("usOhlcv").id,
    },
  };
}
