import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

/**
 * Historical chart data for one symbol.
 *
 * Uses the same hardened market-data service, and therefore the same validated OHLCV,
 * ticker, exchange and currency, as the scanner that produced the opportunity. Candles
 * pass through filterValidOhlcvCandles inside snapshotFromHistory before they reach here,
 * so malformed bars are rejected upstream rather than drawn.
 *
 * Never fabricates candles: insufficient or stale history returns ok:false with a reason.
 */

import { getMarketSnapshotBatch } from "../../../lib/freedom-trader/marketDataService.js";
import {
  DEFAULT_CHART_RANGE,
  assessHistoryFreshness,
  findSupportResistance,
  isValidRange,
} from "../../../lib/freedom/chartAnalysis.js";
import { calculateVolatility } from "../../../lib/freedom-trader/volatility.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function exchangeMatches(expected, actual) {
  const left = normalizeText(expected).toUpperCase();
  const right = normalizeText(actual).toUpperCase();
  if (!left || !right) return true;
  const groups = [
    ["US", "USA", "NASDAQ", "NYSE", "AMEX", "ARCA", "BATS"],
    ["ASX", "XASX", "AU", "AUS"],
  ];
  const leftGroup = groups.find((group) => group.includes(left));
  const rightGroup = groups.find((group) => group.includes(right));
  if (leftGroup || rightGroup) return Boolean(leftGroup && rightGroup && leftGroup === rightGroup);
  return left === right;
}

export function chartMatchesRequest(req, snapshot) {
  const expectedExchange = normalizeText(req.query?.exchange).toUpperCase();
  const expectedCurrency = normalizeText(req.query?.currency).toUpperCase();
  const actualExchange = normalizeText(snapshot?.exchange).toUpperCase();
  const actualCurrency = normalizeText(snapshot?.currency).toUpperCase();
  if (expectedCurrency && actualCurrency && expectedCurrency !== actualCurrency) {
    return { ok: false, reason: `Historical data rejected: currency was ${actualCurrency}, expected ${expectedCurrency}.` };
  }
  if (!exchangeMatches(expectedExchange, actualExchange)) {
    return { ok: false, reason: `Historical data rejected: exchange was ${actualExchange || "unknown"}, expected ${expectedExchange}.` };
  }
  return { ok: true, reason: null };
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const symbol = String(req.query?.symbol || "").trim().toUpperCase();
  const requestedRange = String(req.query?.range || DEFAULT_CHART_RANGE).toLowerCase();

  if (!symbol) return res.status(400).json({ ok: false, error: "A symbol is required." });
  if (!isValidRange(requestedRange)) {
    return res.status(400).json({ ok: false, error: "Unsupported range: " + requestedRange });
  }

  try {
    const exchange = String(req.query?.exchange || "").trim().toUpperCase();
    const currency = String(req.query?.currency || "").trim().toUpperCase();
    const snapshots = await getMarketSnapshotBatch([{
      symbol,
      providerSymbol: ["ASX", "XASX"].includes(exchange) ? `${symbol}:ASX` : symbol,
      exchange,
      currency,
    }], { range: requestedRange, interval: "1day" });
    const snapshot = snapshots.get(symbol);

    if (!snapshot || snapshot.error) {
      return res.status(200).json({
        ok: false,
        symbol,
        range: requestedRange,
        error: snapshot?.error || "Market data is unavailable for this symbol.",
        candles: [],
      });
    }

    const match = chartMatchesRequest(req, snapshot);
    if (!match.ok) {
      return res.status(200).json({
        ok: false,
        symbol,
        range: requestedRange,
        exchange: snapshot.exchange || null,
        currency: snapshot.currency || null,
        error: match.reason,
        candles: [],
      });
    }

    const candles = (snapshot.candles?.daily || []).map((candle) => ({
      date: candle.date,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume) || 0,
    }));

    const freshness = assessHistoryFreshness(candles);
    if (!freshness.ok) {
      return res.status(200).json({
        ok: false,
        symbol,
        range: requestedRange,
        exchange: snapshot.exchange || null,
        currency: snapshot.currency || null,
        error: freshness.reason,
        stale: freshness.stale,
        latestDate: freshness.latestDate,
        candles: [],
      });
    }

    const currentPrice = Number(snapshot.quote?.price);
    const levels = findSupportResistance(candles, Number.isFinite(currentPrice) ? currentPrice : null);
    const volatility = calculateVolatility(candles);

    return res.status(200).json({
      ok: true,
      symbol,
      range: requestedRange,
      exchange: snapshot.exchange || null,
      currency: snapshot.currency || null,
      provider: snapshot.source || null,
      currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
      dataTimestamp: snapshot.quote?.timestamp || snapshot.latestTimestamp || freshness.latestDate,
      latestCandleDate: freshness.latestDate,
      ageDays: freshness.ageDays,
      support: levels.support,
      resistance: levels.resistance,
      volatility,
      candleCount: candles.length,
      candles,
      error: null,
    });
  } catch (error) {
    console.error("Freedom chart route failed for " + symbol + ":", error);
    return res.status(200).json({
      ok: false,
      symbol,
      range: requestedRange,
      error: "Historical data could not be loaded: " + (error?.message || "unknown error"),
      candles: [],
    });
  }
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
