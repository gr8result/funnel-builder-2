import { analyseSymbol } from "./analysis.js";
import { getMarketDataMetrics, getMarketSnapshotBatch, resetMarketDataMetrics } from "../../../lib/freedom-trader/marketDataService.js";
import { buildMarketDiscovery } from "../../../lib/freedom-trader/marketUniverse.js";
import { rankMarketOpportunities } from "../../../lib/freedom-trader/opportunityRanking.js";

const DEFAULT_SETTINGS = {
  markets: ["US"],
  minimumScore: 82,
  minimumDailyVolume: 1000000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
  excludedIndustries: [],
  scanFrequency: "during-session",
};

const latestScanCache = globalThis.__freedomTraderLatestScanCache || { key: "", cachedAt: 0, payload: null };
const activeScans = globalThis.__freedomTraderActiveScans || new Map();
globalThis.__freedomTraderLatestScanCache = latestScanCache;
globalThis.__freedomTraderActiveScans = activeScans;

function cleanSettings(input = {}) {
  const markets = Array.isArray(input.markets) && input.markets.length ? input.markets : DEFAULT_SETTINGS.markets;
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    markets: markets.filter((market) => ["US", "ASX"].includes(String(market).toUpperCase())).map((market) => String(market).toUpperCase()),
    excludedIndustries: Array.isArray(input.excludedIndustries)
      ? input.excludedIndustries.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : String(input.excludedIndustries || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
  };
}

function scanCacheKey(settings) {
  return JSON.stringify({ markets: settings.markets, excludedIndustries: settings.excludedIndustries, minimumDailyVolume: settings.minimumDailyVolume });
}

function countStatus(rows, status) {
  return rows.filter((row) => row.status === status).length;
}

async function runCompleteScan(settings) {
  resetMarketDataMetrics();
  const startedAt = new Date().toISOString();
  const discovery = await buildMarketDiscovery(settings);
  const detailedUniverse = discovery.detailedCandidates;
  const requestedSymbols = detailedUniverse.map((item) => item.symbol);
  const snapshots = await getMarketSnapshotBatch(requestedSymbols, { range: "1y", interval: "1day" });
  const analysis = [];

  for (const item of detailedUniverse) {
    try {
      const row = await analyseSymbol(item.symbol, snapshots.get(item.symbol));
      analysis.push({
        ...row,
        companyName: item.companyName || row.companyName,
        sector: item.assetType || row.sector,
        exchange: item.exchange || row.exchange,
        country: item.country,
        currency: item.currency || row.currency || "USD",
        broadScreen: {
          score: item.broadScore,
          volume: item.volume,
          changePercent: item.changePercent,
        },
      });
    } catch (error) {
      analysis.push({
        symbol: item.symbol,
        companyName: item.companyName,
        exchange: item.exchange,
        country: item.country,
        currency: item.currency,
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

  const ranking = rankMarketOpportunities(analysis, settings, { includeDevelopingTopFive: true });
  const rows = ranking.ranked;
  const unavailableRows = rows.filter((row) => row.status === "DATA UNAVAILABLE");
  const analysedRows = rows.filter((row) => row.status !== "DATA UNAVAILABLE");
  const readyCount = countStatus(rows, "READY");
  const waitCount = countStatus(rows, "WAIT");
  const developingCount = countStatus(rows, "DEVELOPING");
  discovery.coverage.US.detailedAnalyses = detailedUniverse.filter((row) => row.market === "US").length;
  discovery.coverage.US.successfullyScreened = analysis.filter((row) => row.country === "United States" && row.dataStatus?.readyForScore).length;
  discovery.coverage.ASX.detailedAnalyses = detailedUniverse.filter((row) => row.market === "ASX").length;
  discovery.coverage.ASX.successfullyScreened = analysis.filter((row) => row.country === "Australia" && row.dataStatus?.readyForScore).length;

  const completedAt = new Date().toISOString();
  const marketDataMetrics = getMarketDataMetrics();
  const scanSummary = {
    status: unavailableRows.length ? "partial" : "complete",
    tradableUniverse: discovery.supportedUniverseCount,
    configuredUniverseCount: discovery.supportedUniverseCount,
    universe: discovery.supportedUniverseCount,
    candidateUniverse: discovery.candidateUniverseCount,
    requested: requestedSymbols.length,
    requestedCount: requestedSymbols.length,
    broadScreenRequested: discovery.broadScreen.requested,
    broadScreenEligible: discovery.broadScreen.eligible,
    successfullyAnalysed: analysedRows.length,
    analysedCount: analysedRows.length,
    unavailable: unavailableRows.length,
    dataUnavailable: unavailableRows.length,
    unavailableCount: unavailableRows.length,
    qualified: readyCount,
    qualifiedCount: readyCount,
    ready: readyCount,
    wait: waitCount,
    developing: developingCount,
    notQualified: Math.max(0, analysedRows.length - readyCount),
    totalsBalanced: requestedSymbols.length === analysedRows.length + unavailableRows.length,
    providerDiagnostics: {
      ...marketDataMetrics,
      broadQuoteProviderCalls: discovery.broadScreen.providerCalls,
      broadQuoteProviderWaits: discovery.broadScreen.providerWaits,
      broadQuoteProviderWaitMs: discovery.broadScreen.providerWaitMs,
      totalProviderCalls: marketDataMetrics.historyProviderCalls + discovery.broadScreen.providerCalls,
      totalCacheHits: marketDataMetrics.historyCacheHits,
    },
    coverage: discovery.coverage,
    dataSource: discovery.dataSource,
    oldestMarketDataAgeMs: discovery.oldestMarketDataAgeMs,
    newestMarketDataAgeMs: discovery.newestMarketDataAgeMs,
    lastProviderRefresh: discovery.lastProviderRefresh,
    broadScreenLimitReason: discovery.broadScreen.limitReason,
    scanStartedAt: startedAt,
    scanCompletedAt: completedAt,
    elapsedMs: Date.parse(completedAt) - Date.parse(startedAt),
    unavailableSymbols: unavailableRows.map((row) => ({ symbol: row.symbol, reason: row.reason })),
    marketScopeMessage: `Provider-supported universe: ${discovery.coverage.US.totalSupported} US common stocks and ${discovery.coverage.ASX.totalSupported} Australian common stocks.`,
  };

  const safeBestCurrentTrade = unavailableRows.length ? null : ranking.bestCurrentTrade;
  const safeTopOpportunity = safeBestCurrentTrade || ranking.bestSetupToWatch || ranking.topFive[0] || null;
  const payload = {
    ok: true,
    settings,
    universeCount: discovery.supportedUniverseCount,
    scannedCount: requestedSymbols.length,
    scannedSymbols: requestedSymbols,
    supportedSymbols: requestedSymbols,
    scanSummary,
    marketCoverage: discovery.coverage,
    results: rows.filter((row) => row.status === "READY"),
    topFive: ranking.topFive,
    topOpportunity: safeTopOpportunity,
    bestCurrentTrade: safeBestCurrentTrade,
    bestSetupToWatch: ranking.bestSetupToWatch || ranking.topFive[0] || null,
    opportunityRanking: {
      topSymbol: safeTopOpportunity?.symbol || null,
      bestCurrentTradeSymbol: safeBestCurrentTrade?.symbol || null,
      bestSetupToWatchSymbol: (ranking.bestSetupToWatch || ranking.topFive[0])?.symbol || null,
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
