/**
 * Thin wrapper over the hardened Freedom market data service, shaped for the rebuilt
 * pages. Never invents a price: an unusable snapshot returns a null quote so the caller
 * can render "market data unavailable" rather than a fabricated number.
 */

import { getMarketSnapshotBatch } from "../freedom-trader/marketDataService.js";
import { resolveFreedomTraderStock } from "../freedom-trader/marketUniverse.js";

const DEFAULT_QUOTE_TIMEOUT_MS = 8000;
const STALE_QUOTE_MS = Math.max(60_000, Number(process.env.FREEDOM_STALE_QUOTE_MS) || 15 * 60 * 1000);

/** Trim a candle series down to what a small chart needs. */
export function compactCandles(candles = [], limit = 90) {
  return candles.slice(-limit).map((candle) => ({
    date: candle.date,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: Number(candle.volume) || 0,
  }));
}

/**
 * Fetch quotes (and optionally candles) for a set of symbols.
 * Returns Map<symbol, { price, timestamp, currency, exchange, candles, error }>.
 */
export async function quotesForSymbols(symbols = [], options = {}) {
  const unique = Array.from(new Set(symbols.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean)));
  const output = new Map();
  if (!unique.length) return output;

  let snapshots = new Map();
  try {
    snapshots = await Promise.race([
      getMarketSnapshotBatch(unique.map(symbol => {
        const instrument = options.instruments?.find(row => row.symbol === symbol);
        if (!instrument) return symbol;
        return { symbol, exchange: instrument.exchange, currency: instrument.nativeCurrency || instrument.currency,
          providerSymbol: ["ASX", "XASX"].includes(instrument.exchange) ? `${symbol}:ASX` : symbol };
      }), { range: options.range || "1y", interval: "1day" }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("Market data timed out.")),
        options.timeoutMs || DEFAULT_QUOTE_TIMEOUT_MS,
      )),
    ]);
  } catch (error) {
    unique.forEach((symbol) => {
      output.set(symbol, { price: null, timestamp: null, error: error?.message || "Market data unavailable." });
    });
    return output;
  }

  unique.forEach((symbol) => {
    const snapshot = snapshots.get(symbol);
    const price = Number(snapshot?.quote?.price);
    const usable = snapshot && !snapshot.error && Number.isFinite(price);
    output.set(symbol, {
      price: usable ? price : null,
      bid: snapshot?.quote?.bid ?? snapshot?.latestQuote?.bid ?? null,
      ask: snapshot?.quote?.ask ?? snapshot?.latestQuote?.ask ?? null,
      previousClose: snapshot?.quote?.previousClose ?? null,
      changePercent: snapshot?.quote?.changePercent ?? null,
      timestamp: snapshot?.quote?.timestamp || snapshot?.latestTimestamp || null,
      currency: snapshot?.currency || null,
      exchange: snapshot?.exchange || null,
      provider: snapshot?.source || null,
      stale: isStaleTimestamp(snapshot?.quote?.timestamp || snapshot?.latestTimestamp || null, STALE_QUOTE_MS),
      marketStatus: marketStatusFromTimestamp(snapshot?.quote?.timestamp || snapshot?.latestTimestamp || null, STALE_QUOTE_MS),
      candles: options.withCandles ? compactCandles(snapshot?.candles?.daily || [], options.candleLimit || 90) : undefined,
      error: usable ? null : snapshot?.error || "Market data unavailable for this symbol.",
    });
  });
  return output;
}

export function exchangeMatches(expected, actual) {
  const left = String(expected || "").trim().toUpperCase();
  const right = String(actual || "").trim().toUpperCase();
  if (!left || !right) return true;
  const groups = [
    ["US", "USA", "NASDAQ", "NYSE", "AMEX", "ARCA"],
    ["ASX", "XASX", "AU", "AUS"],
  ];
  const leftGroup = groups.find((group) => group.includes(left));
  const rightGroup = groups.find((group) => group.includes(right));
  if (leftGroup || rightGroup) return Boolean(leftGroup && rightGroup && leftGroup === rightGroup);
  return left === right;
}

export function quoteMatchesOrder(order = {}, quote = {}) {
  if (!quote) return { ok: false, reason: "Market data unavailable." };
  const expectedCurrency = String(order.currency || "").trim().toUpperCase();
  const actualCurrency = String(quote.currency || "").trim().toUpperCase();
  if (expectedCurrency && actualCurrency && expectedCurrency !== actualCurrency) {
    return { ok: false, reason: `Quote rejected: ${order.symbol} currency was ${actualCurrency}, expected ${expectedCurrency}.` };
  }
  if (!exchangeMatches(order.exchange, quote.exchange)) {
    return { ok: false, reason: `Quote rejected: ${order.symbol} exchange was ${quote.exchange}, expected ${order.exchange}.` };
  }
  return { ok: true, reason: null };
}

function timestampMs(value) {
  if (!value) return null;
  if (Number.isFinite(Number(value))) {
    const number = Number(value);
    return number > 10_000_000_000 ? number : number * 1000;
  }
  const parsed = Date.parse(String(value).length <= 10 ? value + "T00:00:00Z" : value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isStaleTimestamp(value, staleMs = STALE_QUOTE_MS) {
  const ms = timestampMs(value);
  if (!ms) return true;
  return Date.now() - ms > staleMs;
}

export function marketStatusFromTimestamp(value, staleMs = STALE_QUOTE_MS) {
  if (!value) return "DATA UNAVAILABLE";
  return isStaleTimestamp(value, staleMs) ? "STALE OR MARKET CLOSED" : "OPEN / RECENT";
}

/**
 * Resolve a user-typed ticker to a real listing. Preserves the existing exchange-aware
 * resolution (e.g. CMG resolves to the single US listing, not the ASX one).
 */
export async function resolveTicker(query) {
  try {
    return await resolveFreedomTraderStock(query, { limit: 8 });
  } catch (error) {
    return { ok: false, query, matches: [], resolved: null, error: error?.message || "Ticker lookup failed." };
  }
}
