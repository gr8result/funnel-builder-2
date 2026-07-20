import { fetchTraderHistory } from "../freedom-trader/history.js";

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeRange(value) {
  const aliases = {
    "1d": "1d",
    "5d": "5d",
    "1w": "5d",
    "1wk": "5d",
    "1week": "5d",
    "1m": "1mo",
    "1mo": "1mo",
    "3m": "3mo",
    "3mo": "3mo",
    "6m": "6mo",
    "6mo": "6mo",
    "1y": "1y",
    "3y": "3y",
    "5y": "5y",
    "10y": "10y",
    max: "max",
  };
  const range = String(value || "1y").trim().toLowerCase();
  return aliases[range] || "1y";
}

function normalizeInterval(value) {
  const interval = String(value || "1d").trim().toLowerCase();
  return interval === "1d" ? "1d" : "1d";
}

function historyWithYearRange(result) {
  const candles = Array.isArray(result?.candles) ? result.candles : [];
  const newest = candles[candles.length - 1]?.timestamp
    || (candles[candles.length - 1]?.date ? Date.parse(candles[candles.length - 1].date) / 1000 : null);
  const oneYearCutoff = newest ? newest - 370 * 24 * 60 * 60 : null;
  const yearCandles = oneYearCutoff
    ? candles.filter((candle) => {
        const timestamp = candle.timestamp || (candle.date ? Date.parse(candle.date) / 1000 : null);
        return Number.isFinite(timestamp) && timestamp >= oneYearCutoff;
      })
    : candles;
  const highs = yearCandles.map((candle) => candle.high).filter(Number.isFinite);
  const lows = yearCandles.map((candle) => candle.low).filter(Number.isFinite);
  return {
    ...result,
    candles,
    prices: candles,
    candleCount: result?.candleCount ?? candles.length,
    yearHigh: highs.length ? round(Math.max(...highs)) : null,
    yearLow: lows.length ? round(Math.min(...lows)) : null,
  };
}

function emptyHistory({ symbol, range, interval, error }) {
  return {
    ok: false,
    symbol,
    range,
    interval,
    source: "Yahoo Finance",
    candleCount: 0,
    candles: [],
    prices: [],
    yearHigh: null,
    yearLow: null,
    error,
  };
}

function mapYahooCandles({ symbol, range, interval, payload }) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];

  if (!Array.isArray(timestamps) || !quote) {
    return emptyHistory({
      symbol,
      range,
      interval,
      error: "Yahoo Finance did not return historical candle data for this symbol.",
    });
  }

  const candles = timestamps
    .map((timestamp, index) => {
      const open = round(quote.open?.[index]);
      const high = round(quote.high?.[index]);
      const low = round(quote.low?.[index]);
      const close = round(quote.close?.[index]);
      const volume = Number(quote.volume?.[index]);

      if (![timestamp, open, high, low, close, volume].every(Number.isFinite)) return null;
      if (high < low) return null;

      return {
        timestamp,
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!candles.length) {
    return emptyHistory({
      symbol,
      range,
      interval,
      error: "Historical candlestick data unavailable.",
    });
  }

  const newest = candles[candles.length - 1]?.timestamp;
  const oneYearCutoff = newest ? newest - 370 * 24 * 60 * 60 : null;
  const yearCandles = oneYearCutoff ? candles.filter((candle) => candle.timestamp >= oneYearCutoff) : candles;
  const highs = yearCandles.map((candle) => candle.high).filter(Number.isFinite);
  const lows = yearCandles.map((candle) => candle.low).filter(Number.isFinite);

  return {
    ok: true,
    symbol,
    range,
    interval,
    source: "Yahoo Finance",
    candleCount: candles.length,
    candles,
    prices: candles,
    yearHigh: highs.length ? round(Math.max(...highs)) : null,
    yearLow: lows.length ? round(Math.min(...lows)) : null,
    error: null,
  };
}

async function fetchYahooHistory(symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=history&includePrePost=false`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 Freedom Terminal",
      },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return emptyHistory({
        symbol,
        range,
        interval,
        error: `Yahoo Finance history request failed with status ${response.status}.`,
      });
    }

    return mapYahooCandles({ symbol, range, interval, payload });
  } catch (error) {
    return emptyHistory({
      symbol,
      range,
      interval,
      error: error.message || "Yahoo Finance historical data is unavailable right now.",
    });
  }
}

export async function getDailyHistory(symbol) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const result = historyWithYearRange(await fetchTraderHistory(normalizedSymbol, "1y", "1d"));
  return result.ok ? result.candles : [];
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json(emptyHistory({
      symbol: null,
      range: "1y",
      interval: "1d",
      error: "Method not allowed.",
    }));
  }

  const symbol = normalizeSymbol(Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol || "MSFT");
  const range = normalizeRange(Array.isArray(req.query.range) ? req.query.range[0] : req.query.range);
  const interval = normalizeInterval(Array.isArray(req.query.interval) ? req.query.interval[0] : req.query.interval);

  if (!/^[A-Z.]{1,12}$/.test(symbol)) {
    return res.status(200).json(emptyHistory({
      symbol,
      range,
      interval,
      error: "Provide a valid symbol query, such as MSFT.",
    }));
  }

  const result = historyWithYearRange(await fetchTraderHistory(symbol, range, interval));

  return res.status(200).json({
    ...result,
    updatedAt: new Date().toISOString(),
  });
}
