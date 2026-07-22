const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";

const RANGE_TO_OUTPUT_SIZE = {
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

const RANGE_INTERVALS = {
  "1d": "1min",
  "5d": "5min",
  "1mo": "30min",
  "3mo": "1h",
  "6mo": "1h",
  "1y": "1day",
  "3y": "1week",
  "5y": "1week",
  "max": "1week",
};

const INTERVAL_MAP = {
  "1m": "1min",
  "1min": "1min",
  "5m": "5min",
  "5min": "5min",
  "15m": "15min",
  "15min": "15min",
  "30m": "30min",
  "30min": "30min",
  "1h": "1h",
  "60min": "1h",
  "4h": "4h",
  "1d": "1day",
  "1day": "1day",
  "1w": "1week",
  "1wk": "1week",
  "1week": "1week",
};

function apiKey() {
  return process.env.TWELVE_DATA_API_KEY?.trim() || process.env.TWELVEDATA_API_KEY?.trim() || "";
}

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
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

export function twelveDataIntervalForRange(range) {
  const normalizedRange = normalizeRange(range);
  return RANGE_INTERVALS[normalizedRange] || "1day";
}

export function normalizeTwelveDataInterval(value, range = "1y") {
  const requested = String(value || "").trim().toLowerCase();
  return INTERVAL_MAP[requested] || twelveDataIntervalForRange(range);
}

export function mapTwelveDataSymbol(symbol, exchange = "") {
  const cleanSymbol = String(symbol || "").trim().toUpperCase();
  const cleanExchange = String(exchange || "").trim().toUpperCase();
  if (!cleanSymbol) return "";
  if (cleanSymbol.includes(":")) return cleanSymbol;
  if (cleanSymbol.endsWith(".AX")) return `${cleanSymbol.replace(/\.AX$/, "")}:ASX`;
  if (cleanExchange === "ASX" || cleanExchange === "XASX") return `${cleanSymbol}:ASX`;
  return cleanSymbol;
}

function emptyTwelveDataHistory({ symbol, range, interval, error }) {
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
    meta: null,
    error,
  };
}

async function fetchTwelveData(path, params) {
  const key = apiKey();
  if (!key) {
    return {
      ok: false,
      status: 0,
      payload: null,
      error: "TWELVEDATA_API_KEY is missing on the server.",
    };
  }

  const url = new URL(`${TWELVE_DATA_BASE_URL}/${path}`);
  Object.entries({ ...params, apikey: key }).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  });

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 Freedom Trader",
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status === "error") {
      return {
        ok: false,
        status: response.status,
        payload,
        error: payload?.message || payload?.code || `Twelve Data request failed with status ${response.status}.`,
      };
    }
    return { ok: true, status: response.status, payload, error: null };
  } catch (error) {
    console.error("Freedom Trader Twelve Data request failed:", error);
    return {
      ok: false,
      status: 0,
      payload: null,
      error: error.message || "Twelve Data is unavailable right now.",
    };
  }
}

function classifyDataLabel(meta, latestTimestamp) {
  const exchangeTimezone = meta?.exchange_timezone || "";
  const interval = meta?.interval || "";
  if (interval === "1day") return "End-of-day";
  if (!latestTimestamp) return "Unavailable";

  const latestMs = Date.parse(`${latestTimestamp.replace(" ", "T")}${exchangeTimezone === "America/New_York" ? "-04:00" : ""}`);
  if (!Number.isFinite(latestMs)) return "Delayed 15 minutes";

  const ageMinutes = (Date.now() - latestMs) / 60000;
  if (ageMinutes <= 5) return "Live";
  if (ageMinutes <= 30) return "Delayed 15 minutes";
  return "Delayed 15 minutes";
}

function mapTimeSeriesPayload({ symbol, range, interval, payload }) {
  const values = Array.isArray(payload?.values) ? payload.values : [];
  if (!values.length) {
    return emptyTwelveDataHistory({
      symbol,
      range,
      interval,
      error: payload?.message || "Twelve Data did not return candle data.",
    });
  }

  const candles = values
    .map((item) => {
      const open = round(item.open);
      const high = round(item.high);
      const low = round(item.low);
      const close = round(item.close);
      const volume = Number(item.volume);
      if (![open, high, low, close].every(Number.isFinite)) return null;
      if (high < low) return null;
      return {
        timestamp: Math.floor(Date.parse(String(item.datetime).replace(" ", "T")) / 1000),
        date: item.datetime,
        open,
        high,
        low,
        close,
        adjClose: null,
        volume: Number.isFinite(volume) ? volume : 0,
        adjusted: false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!candles.length) {
    return emptyTwelveDataHistory({
      symbol,
      range,
      interval,
      error: "Twelve Data returned candles, but none had complete OHLC values.",
    });
  }

  const latest = candles[candles.length - 1];
  const meta = payload.meta || {};

  return {
    ok: true,
    symbol,
    range,
    interval,
    provider: "Twelve Data",
    source: "Twelve Data",
    dataLabel: classifyDataLabel(meta, latest?.date),
    exchange: meta.exchange || null,
    currency: meta.currency || null,
    exchangeTimezone: meta.exchange_timezone || null,
    micCode: meta.mic_code || null,
    type: meta.type || null,
    adjusted: false,
    candleCount: candles.length,
    candles,
    meta,
    firstTimestamp: candles[0]?.date || null,
    latestTimestamp: latest?.date || null,
    currentPrice: latest?.close ?? null,
    error: null,
  };
}

function rangeCutoffSeconds(range, latestTimestamp) {
  if (!Number.isFinite(latestTimestamp) || range === "max") return null;
  const days = {
    "1d": 1,
    "5d": 5,
    "1mo": 31,
    "3mo": 92,
    "6mo": 183,
    "1y": 370,
    "3y": 365 * 3 + 10,
    "5y": 365 * 5 + 15,
  }[range];
  return days ? latestTimestamp - days * 24 * 60 * 60 : null;
}

function trimHistoryToRange(history, range) {
  if (!history?.ok || !Array.isArray(history.candles) || range === "max") return history;
  const latest = history.candles[history.candles.length - 1]?.timestamp;
  if (range === "1d" && String(history.interval || "").includes("min")) {
    const latestSession = String(history.candles[history.candles.length - 1]?.date || "").slice(0, 10);
    const sessionCandles = latestSession
      ? history.candles.filter((candle) => String(candle.date || "").slice(0, 10) === latestSession)
      : [];
    if (sessionCandles.length) {
      return {
        ...history,
        candleCount: sessionCandles.length,
        candles: sessionCandles,
        firstTimestamp: sessionCandles[0]?.date || null,
        latestTimestamp: sessionCandles[sessionCandles.length - 1]?.date || null,
        currentPrice: sessionCandles[sessionCandles.length - 1]?.close ?? history.currentPrice,
      };
    }
  }
  const cutoff = rangeCutoffSeconds(range, latest);
  if (!Number.isFinite(cutoff)) return history;
  const candles = history.candles.filter((candle) => Number.isFinite(candle.timestamp) && candle.timestamp >= cutoff);
  const trimmed = candles.length ? candles : history.candles.slice(-1);
  return {
    ...history,
    candleCount: trimmed.length,
    candles: trimmed,
    firstTimestamp: trimmed[0]?.date || null,
    latestTimestamp: trimmed[trimmed.length - 1]?.date || null,
    currentPrice: trimmed[trimmed.length - 1]?.close ?? history.currentPrice,
  };
}

export async function fetchTwelveDataHistory({ symbol, range = "1y", interval = null, exchange = "" }) {
  const normalizedRange = normalizeRange(range);
  const normalizedInterval = normalizeTwelveDataInterval(interval, normalizedRange);
  const mappedSymbol = mapTwelveDataSymbol(symbol, exchange);
  if (!mappedSymbol) {
    return emptyTwelveDataHistory({
      symbol,
      range: normalizedRange,
      interval: normalizedInterval,
      error: "Provide a valid symbol.",
    });
  }

  const result = await fetchTwelveData("time_series", {
    symbol: mappedSymbol,
    interval: normalizedInterval,
    outputsize: RANGE_TO_OUTPUT_SIZE[normalizedRange] || 370,
    order: "DESC",
  });

  if (!result.ok) {
    return emptyTwelveDataHistory({
      symbol: mappedSymbol,
      range: normalizedRange,
      interval: normalizedInterval,
      error: result.error,
    });
  }

  return trimHistoryToRange(mapTimeSeriesPayload({
    symbol: mappedSymbol,
    range: normalizedRange,
    interval: normalizedInterval,
    payload: result.payload,
  }), normalizedRange);
}

export async function fetchTwelveDataQuote({ symbol, exchange = "" }) {
  const mappedSymbol = mapTwelveDataSymbol(symbol, exchange);
  const result = await fetchTwelveData("quote", { symbol: mappedSymbol });
  if (!result.ok) {
    return {
      ok: false,
      symbol: mappedSymbol,
      provider: "Twelve Data",
      error: result.error,
    };
  }
  const payload = result.payload || {};
  return {
    ok: true,
    symbol: mappedSymbol,
    provider: "Twelve Data",
    price: round(payload.close ?? payload.price),
    exchange: payload.exchange || null,
    currency: payload.currency || null,
    timestamp: payload.datetime || payload.timestamp || null,
    raw: payload,
    error: null,
  };
}

export async function fetchTwelveDataSymbolSearch({ symbol, exchange = "" }) {
  const mappedSymbol = mapTwelveDataSymbol(symbol, exchange);
  const result = await fetchTwelveData("symbol_search", { symbol: mappedSymbol });
  if (!result.ok) {
    return {
      ok: false,
      symbol: mappedSymbol,
      provider: "Twelve Data",
      matches: [],
      error: result.error,
    };
  }
  return {
    ok: true,
    symbol: mappedSymbol,
    provider: "Twelve Data",
    matches: Array.isArray(result.payload?.data) ? result.payload.data : [],
    error: null,
  };
}

export function twelveDataWebSocketStatus() {
  return {
    provider: "Twelve Data",
    configured: Boolean(apiKey()),
    endpoint: "wss://ws.twelvedata.com/v1/quotes/price",
    supportedByAdapter: true,
  };
}

export async function testTwelveDataWebSocket(symbol = "MSFT", timeoutMs = 8000) {
  const key = apiKey();
  if (!key) {
    return {
      ok: false,
      provider: "Twelve Data",
      endpoint: "wss://ws.twelvedata.com/v1/quotes/price",
      symbol,
      error: "TWELVEDATA_API_KEY is missing on the server.",
    };
  }

  if (typeof WebSocket !== "function") {
    return {
      ok: false,
      provider: "Twelve Data",
      endpoint: "wss://ws.twelvedata.com/v1/quotes/price",
      symbol,
      error: "Server runtime does not provide WebSocket.",
    };
  }

  return new Promise((resolve) => {
    const endpoint = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(key)}`;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {}
      resolve({
        ok: false,
        provider: "Twelve Data",
        endpoint: "wss://ws.twelvedata.com/v1/quotes/price",
        symbol,
        error: "WebSocket test timed out before a price or error message was received.",
      });
    }, timeoutMs);

    const socket = new WebSocket(endpoint);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ action: "subscribe", params: { symbols: symbol } }));
    });

    socket.addEventListener("message", (event) => {
      if (settled) return;
      let payload = event.data;
      try {
        payload = JSON.parse(event.data);
      } catch {}
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      const error = payload?.event === "error" || payload?.status === "error" ? payload?.message || JSON.stringify(payload) : null;
      resolve({
        ok: !error,
        provider: "Twelve Data",
        endpoint: "wss://ws.twelvedata.com/v1/quotes/price",
        symbol,
        firstMessage: payload,
        error,
      });
    });

    socket.addEventListener("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      resolve({
        ok: false,
        provider: "Twelve Data",
        endpoint: "wss://ws.twelvedata.com/v1/quotes/price",
        symbol,
        error: "WebSocket connection failed.",
      });
    });
  });
}
