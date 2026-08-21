import { buildFreedomChartInput, summarizeOhlc } from "../../../lib/freedom-trader/chartSeriesIntegrity.js";
import { getMarketSnapshot } from "../../../lib/freedom-trader/marketDataService.js";
import { resolveFreedomTraderStock } from "../../../lib/freedom-trader/marketUniverse.js";
import { analyseSymbol } from "./analysis.js";

const MAX_SYMBOLS = 12;

function normalizeSymbols(input) {
  const value = Array.isArray(input) ? input.join(",") : String(input || "");
  return Array.from(new Set(value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^[A-Z.]{1,12}$/.test(item))))
    .slice(0, MAX_SYMBOLS);
}

function latestCandle(candles = []) {
  const candle = Array.isArray(candles) ? candles[candles.length - 1] : null;
  if (!candle) return null;
  return {
    date: candle.date || null,
    timestamp: candle.timestamp || null,
    open: candle.open ?? null,
    high: candle.high ?? null,
    low: candle.low ?? null,
    close: candle.close ?? null,
    volume: candle.volume ?? null,
    provider: candle.provider || null,
  };
}

function compactAnalysis(analysis) {
  if (!analysis) return null;
  return {
    status: analysis.status || null,
    currentPrice: analysis.currentPrice ?? null,
    tradingScore: analysis.tradingScore ?? null,
    confidence: analysis.confidence ?? null,
    recommendedEntry: analysis.recommendedEntry ?? null,
    safetyExit: analysis.safetyExit ?? null,
    finalExit: analysis.finalExit ?? null,
    setupValid: analysis.setup?.valid ?? null,
    dataReady: analysis.dataStatus?.readyForScore ?? null,
    dataStatus: analysis.dataStatus?.status || null,
    error: analysis.error || null,
  };
}

async function auditSymbol(symbol) {
  const lookup = await resolveFreedomTraderStock(symbol).catch((error) => ({ ok: false, error: error.message }));
  const resolved = lookup?.resolved || lookup?.matches?.find((item) => item.symbol === symbol) || null;
  const snapshot = await getMarketSnapshot(symbol, { range: "1y", interval: "1day" });
  const candles = snapshot?.candles?.daily || [];
  const chart = buildFreedomChartInput(candles, { chartType: "candles" });
  const analysis = await analyseSymbol(symbol, snapshot, resolved).catch((error) => ({ error: error.message }));
  return {
    symbol,
    resolved: resolved ? {
      symbol: resolved.symbol,
      name: resolved.name || resolved.companyName || null,
      exchange: resolved.exchange || null,
      currency: resolved.currency || null,
      provider: resolved.provider || null,
    } : null,
    lookup: {
      ok: lookup?.ok ?? false,
      ambiguous: lookup?.ambiguous ?? false,
      matchCount: Array.isArray(lookup?.matches) ? lookup.matches.length : 0,
      error: lookup?.error || null,
    },
    snapshot: {
      ok: snapshot?.dataQuality !== "unavailable",
      provider: snapshot?.provider || snapshot?.source || null,
      source: snapshot?.source || null,
      dataQuality: snapshot?.dataQuality || null,
      statusCode: snapshot?.statusCode || null,
      error: snapshot?.error || null,
      candleCount: snapshot?.candleCount ?? candles.length,
      latestCandle: latestCandle(candles),
      quote: {
        price: snapshot?.quote?.price ?? null,
        previousClose: snapshot?.quote?.previousClose ?? null,
        changePercent: snapshot?.quote?.changePercent ?? null,
        timestamp: snapshot?.quote?.timestamp || null,
        delayed: snapshot?.quote?.delayed ?? null,
      },
      cache: snapshot?.cache ? {
        hit: snapshot.cache.hit ?? null,
        fetchedAt: snapshot.cache.fetchedAt || null,
        quality: snapshot.cache.quality || null,
        ageMs: snapshot.cache.ageMs ?? null,
      } : null,
      priceSanity: snapshot?.priceSanity ? {
        ok: snapshot.priceSanity.ok,
        latestClose: snapshot.priceSanity.latestClose ?? null,
        recentMedian: snapshot.priceSanity.recentMedian ?? null,
        reason: snapshot.priceSanity.reason || null,
      } : null,
      rejectedCandles: snapshot?.rejectedCandles || [],
    },
    chart: {
      realCount: chart.realCount,
      futureCount: chart.futureCount,
      latestPrice: chart.chartPrice[chart.realCount - 1] ?? null,
      latestVolume: chart.volume[chart.realCount - 1] ?? null,
      ohlcSummary: summarizeOhlc(candles),
    },
    analysis: compactAnalysis(analysis),
  };
}

export default async function handler(req, res) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ ok: false, error: "Development-only route." });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }
  const symbols = normalizeSymbols(req.query.symbols || req.query.symbol || "TJGC,CMG,SNDK,AAPL");
  if (!symbols.length) return res.status(400).json({ ok: false, error: "Provide one or more valid symbols." });
  try {
    const audits = await Promise.all(symbols.map((symbol) => auditSymbol(symbol)));
    return res.status(200).json({ ok: true, symbols, audits, updatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Market data audit failed." });
  }
}
