import { analyseSymbol } from "./analysis.js";
import { getMarketDataMetrics, getMarketSnapshotBatch, resetMarketDataMetrics } from "../../../lib/freedom-trader/marketDataService.js";
import { rankMarketOpportunities } from "../../../lib/freedom-trader/opportunityRanking.js";

const CONFIGURED_UNIVERSE = [
  ["AAPL", "Apple", "Technology", "US"], ["MSFT", "Microsoft", "Software", "US"], ["NVDA", "NVIDIA", "Semiconductors", "US"],
  ["AMZN", "Amazon", "Cloud & E-commerce", "US"], ["META", "Meta Platforms", "Digital Advertising & AI", "US"], ["GOOGL", "Alphabet", "Digital Advertising & AI", "US"],
  ["AVGO", "Broadcom", "Semiconductors", "US"], ["AMD", "Advanced Micro Devices", "Semiconductors", "US"], ["TSLA", "Tesla", "EV & Energy", "US"],
  ["PLTR", "Palantir", "AI Software", "US"], ["COST", "Costco", "Consumer Defensive", "US"], ["V", "Visa", "Payments", "US"],
  ["MA", "Mastercard", "Payments", "US"], ["NFLX", "Netflix", "Streaming", "US"], ["ADBE", "Adobe", "Software", "US"],
  ["CRM", "Salesforce", "Software", "US"], ["ORCL", "Oracle", "Software", "US"], ["NOW", "ServiceNow", "Software", "US"],
  ["INTC", "Intel", "Semiconductors", "US"], ["QCOM", "Qualcomm", "Semiconductors", "US"], ["MU", "Micron", "Semiconductors", "US"],
  ["AMAT", "Applied Materials", "Semiconductor Equipment", "US"], ["LRCX", "Lam Research", "Semiconductor Equipment", "US"], ["ASML", "ASML", "Semiconductor Equipment", "US"],
  ["TSM", "Taiwan Semiconductor", "Semiconductors", "US"], ["JPM", "JPMorgan Chase", "Financials", "US"], ["BAC", "Bank of America", "Financials", "US"],
  ["GS", "Goldman Sachs", "Financials", "US"], ["MS", "Morgan Stanley", "Financials", "US"], ["UNH", "UnitedHealth", "Healthcare", "US"],
  ["LLY", "Eli Lilly", "Healthcare", "US"], ["MRK", "Merck", "Healthcare", "US"], ["ABBV", "AbbVie", "Healthcare", "US"],
  ["XOM", "Exxon Mobil", "Energy", "US"], ["CVX", "Chevron", "Energy", "US"], ["CAT", "Caterpillar", "Industrials", "US"],
  ["GE", "GE Aerospace", "Industrials", "US"], ["BA", "Boeing", "Industrials", "US"], ["DE", "Deere", "Industrials", "US"],
  ["WMT", "Walmart", "Consumer Defensive", "US"], ["HD", "Home Depot", "Retail", "US"], ["LOW", "Lowe's", "Retail", "US"],
  ["NKE", "Nike", "Consumer", "US"], ["MCD", "McDonald's", "Restaurants", "US"], ["SBUX", "Starbucks", "Restaurants", "US"],
  ["COIN", "Coinbase", "Crypto Infrastructure", "US"], ["MSTR", "MicroStrategy", "Bitcoin Treasury", "US"], ["SMCI", "Super Micro Computer", "AI Infrastructure", "US"],
].map(([symbol, companyName, sector, market]) => ({ symbol, companyName, sector, market }));

const DEFAULT_SETTINGS = {
  markets: ["US"],
  minimumScore: 82,
  minimumDailyVolume: 1000000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
  excludedIndustries: [],
  scanFrequency: "during-session",
  chunkSize: 48,
};

const latestScanCache = globalThis.__freedomTraderLatestScanCache || { key: "", cachedAt: 0, payload: null };
const activeScans = globalThis.__freedomTraderActiveScans || new Map();
globalThis.__freedomTraderLatestScanCache = latestScanCache;
globalThis.__freedomTraderActiveScans = activeScans;

function cleanSettings(input = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    markets: ["US"],
    excludedIndustries: Array.isArray(input.excludedIndustries)
      ? input.excludedIndustries.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : String(input.excludedIndustries || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
    chunkSize: 48,
  };
}

function getUniverse(settings) {
  const seen = new Set();
  return CONFIGURED_UNIVERSE.filter((item) => {
    if (seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    const sector = String(item.sector || "").toLowerCase();
    return !settings.excludedIndustries.some((industry) => sector.includes(industry));
  });
}

function scanCacheKey(settings) {
  return JSON.stringify({ markets: settings.markets, excludedIndustries: settings.excludedIndustries });
}

async function runCompleteScan(settings) {
  const universe = getUniverse(settings);
  const requestedSymbols = universe.map((item) => item.symbol);
  resetMarketDataMetrics();
  const startedAt = new Date().toISOString();
  const snapshots = await getMarketSnapshotBatch(requestedSymbols, { range: "1y", interval: "1day" });
  const analysis = [];
  for (const item of universe) {
    try {
      const row = await analyseSymbol(item.symbol, snapshots.get(item.symbol));
      analysis.push({ ...row, companyName: item.companyName || row.companyName, sector: item.sector || row.sector, exchange: item.market || row.exchange, currency: row.currency || "USD" });
    } catch (error) {
      analysis.push({
        symbol: item.symbol,
        companyName: item.companyName,
        exchange: item.market,
        sector: item.sector,
        currentPrice: null,
        tradingScore: null,
        confidence: null,
        setup: { valid: false, setupReasoning: "Analysis failed." },
        indicators: {},
        dataStatus: { readyForScore: false, status: error?.message || "Analysis failed.", actualCandleCount: 0 },
        error: error?.message || "Analysis failed.",
      });
    }
  }
  const ranking = rankMarketOpportunities(analysis, settings);
  const rows = ranking.ranked;
  const unavailableRows = rows.filter((row) => row.status === "DATA UNAVAILABLE");
  const analysedRows = rows.filter((row) => row.status !== "DATA UNAVAILABLE");
  const completedAt = new Date().toISOString();
  const scanSummary = {
    status: unavailableRows.length ? "partial" : "complete",
    tradableUniverse: universe.length,
    configuredUniverseCount: universe.length,
    universe: universe.length,
    requested: requestedSymbols.length,
    requestedCount: requestedSymbols.length,
    successfullyAnalysed: analysedRows.length,
    analysedCount: analysedRows.length,
    unavailable: unavailableRows.length,
    dataUnavailable: unavailableRows.length,
    unavailableCount: unavailableRows.length,
    qualified: ranking.qualifiedCount,
    qualifiedCount: ranking.qualifiedCount,
    notQualified: Math.max(0, analysedRows.length - ranking.qualifiedCount),
    totalsBalanced: requestedSymbols.length === analysedRows.length + unavailableRows.length,
    providerDiagnostics: getMarketDataMetrics(),
    scanStartedAt: startedAt,
    scanCompletedAt: completedAt,
    elapsedMs: Date.parse(completedAt) - Date.parse(startedAt),
    unavailableSymbols: unavailableRows.map((row) => ({ symbol: row.symbol, reason: row.reason })),
    marketScopeMessage: `Configured trading universe: ${universe.length} US companies.`,
  };
  const safeBestCurrentTrade = unavailableRows.length ? null : ranking.bestCurrentTrade;
  const safeTopOpportunity = safeBestCurrentTrade || ranking.bestSetupToWatch || null;
  const payload = {
    ok: true,
    settings,
    universeCount: universe.length,
    scannedCount: requestedSymbols.length,
    scannedSymbols: requestedSymbols,
    supportedSymbols: requestedSymbols,
    scanSummary,
    results: ranking.eligible,
    topFive: ranking.topFive,
    topOpportunity: safeTopOpportunity,
    bestCurrentTrade: safeBestCurrentTrade,
    bestSetupToWatch: ranking.bestSetupToWatch,
    opportunityRanking: {
      topSymbol: safeTopOpportunity?.symbol || null,
      bestCurrentTradeSymbol: safeBestCurrentTrade?.symbol || null,
      bestSetupToWatchSymbol: ranking.bestSetupToWatch?.symbol || null,
      whyRankedFirst: safeTopOpportunity?.whyRankedFirst || [],
    },
    scannerStatus: rows.map((row) => ({
      symbol: row.symbol,
      companyName: row.companyName,
      tradingScore: row.tradingScore,
      status: row.status,
      dataStatus: row.source?.dataStatus,
      error: row.source?.error || null,
    })),
    decisions: rows,
    nextOffset: 0,
    updatedAt: completedAt,
    error: null,
  };
  latestScanCache.key = scanCacheKey(settings);
  latestScanCache.cachedAt = Date.now();
  latestScanCache.payload = payload;
  return payload;
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const body = req.method === "POST" ? req.body || {} : req.query || {};
  const settings = cleanSettings(body);
  const key = scanCacheKey(settings);
  const force = body.force === true || body.force === "true";
  if (!force && latestScanCache.payload && latestScanCache.key === key && Date.now() - latestScanCache.cachedAt < 15 * 60 * 1000) {
    return res.status(200).json({ ...latestScanCache.payload, fromScanCache: true });
  }
  if (activeScans.has(key)) {
    const payload = await activeScans.get(key);
    return res.status(200).json({ ...payload, alreadyRunning: true, message: "Market check already running." });
  }
  try {
    const promise = runCompleteScan(settings).finally(() => activeScans.delete(key));
    activeScans.set(key, promise);
    return res.status(200).json(await promise);
  } catch (error) {
    console.error("Freedom Trader scanner failed:", error);
    return res.status(500).json({ ok: false, results: [], topFive: [], error: "Market scanner could not complete." });
  }
}
