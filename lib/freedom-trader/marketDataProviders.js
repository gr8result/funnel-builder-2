import {
  fetchTwelveDataHistory,
  fetchTwelveDataQuoteBatch,
  fetchTwelveDataStocks,
} from "./twelveData.js";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

function finnhubKey() {
  return process.env.FINNHUB_API_KEY?.trim() || "";
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

function safeError(status, data, fallback) {
  if (data?.error) return String(data.error);
  if (data?.s && data.s !== "ok") return String(data.s);
  if (status) return `${fallback} failed with status ${status}.`;
  return fallback;
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
  if (force === "finnhub") return FinnhubProvider;
  if (force === "twelve-data") return TwelveDataProvider;
  if (operation === "symbolUniverse") return FinnhubProvider.hasCredentials() ? FinnhubProvider : TwelveDataProvider;
  if (operation === "preScreenQuote") return FinnhubProvider.hasCredentials() ? FinnhubProvider : TwelveDataProvider;
  if (operation === "detailedHistory") return TwelveDataProvider;
  return TwelveDataProvider;
}

export function providerSummary() {
  return {
    providers: [
      { id: FinnhubProvider.id, envVarName: FinnhubProvider.envVarName, configured: FinnhubProvider.hasCredentials(), capabilities: FinnhubProvider.capabilities },
      { id: TwelveDataProvider.id, capabilities: TwelveDataProvider.capabilities },
    ],
    selection: {
      symbolUniverse: selectMarketDataProvider("symbolUniverse").id,
      preScreenQuote: selectMarketDataProvider("preScreenQuote").id,
      detailedHistory: selectMarketDataProvider("detailedHistory").id,
    },
  };
}
