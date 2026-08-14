import { analyseSymbol } from "./analysis.js";
import { getMarketDataMetrics, getMarketSnapshotBatch, resetMarketDataMetrics } from "../../../lib/freedom-trader/marketDataService.js";
import { marketMeta } from "../../../lib/freedom-trader/marketData.js";
import { buildMarketDiscovery } from "../../../lib/freedom-trader/marketUniverse.js";
import { rankMarketOpportunities } from "../../../lib/freedom-trader/opportunityRanking.js";
import { computeCapitalFlow, capitalFlowSummary } from "../../../lib/freedom-trader/capitalFlow.js";
import { loadLocalCapitalFlowHistory, loadLocalLastGoodScan, saveLocalCapitalFlowSnapshot, saveLocalLastGoodScan } from "../../../lib/freedom-trader/localPaperStore.js";
import { sendFreedomNotification } from "../../../lib/freedom-trader/notifications.js";
import { loadPaperAccount } from "./paper-account.js";

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
    symbols: Array.isArray(input.symbols)
      ? input.symbols.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
      : String(input.symbols || "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean),
  };
}

function scanCacheKey(settings) {
  return JSON.stringify({
    markets: settings.markets,
    excludedIndustries: settings.excludedIndustries,
    minimumDailyVolume: settings.minimumDailyVolume,
    broadScreenLimit: settings.broadScreenLimit || null,
    detailedAnalysisLimit: settings.detailedAnalysisLimit || null,
    symbols: settings.symbols || [],
  });
}

function countStatus(rows, status) {
  return rows.filter((row) => row.status === status).length;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function msUntilNextMinute() {
  const now = new Date();
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 250;
}

function buildUnavailableReason(row) {
  return row.reason || row.error || row.dataStatus?.status || row.marketData?.issues?.join(" ") || "Market data unavailable.";
}

function scanReliabilityStatus(requestedCount, analysedCount, unavailableCount) {
  if (!requestedCount || analysedCount < Math.max(5, Math.ceil(requestedCount * 0.35))) return "failed";
  if (unavailableCount > Math.max(10, Math.floor(requestedCount * 0.25))) return "partial";
  if (unavailableCount > 0) return "partial";
  return "complete";
}

function scanReliabilityMessage(status, checkedCount, analysedCount, unavailableCount) {
  if (status === "failed") return "Freedom could not obtain enough market data to produce reliable recommendations.";
  if (status === "partial") return `Checked ${checkedCount} companies. ${analysedCount} analysed successfully. ${unavailableCount} unavailable. Results are incomplete.`;
  return `Checked ${checkedCount} companies. ${analysedCount} analysed successfully. ${unavailableCount} unavailable.`;
}

function scanMessageFor(discovery, status, checkedCount, analysedCount, unavailableCount) {
  if (discovery.broadScreen?.budgetExhausted) {
    return `Freedom paused the market check because the market-data provider limit was reached. Checked ${checkedCount} companies before pausing. Results are incomplete.`;
  }
  return scanReliabilityMessage(status, checkedCount, analysedCount, unavailableCount);
}

async function runCompleteScan(settings, account = null) {
  resetMarketDataMetrics();
  const startedAt = new Date().toISOString();
  const discovery = await buildMarketDiscovery(settings);
  const detailedUniverse = settings.symbols?.length
    ? settings.symbols.map((symbol) => {
      const meta = marketMeta(symbol);
      return {
        symbol: meta.symbol,
        companyName: meta.companyName,
        exchange: meta.exchange,
        country: meta.currency === "AUD" ? "Australia" : "United States",
        currency: meta.currency,
        market: meta.currency === "AUD" ? "ASX" : "US",
        assetType: "common stock",
        broadScore: null,
        volume: null,
        changePercent: null,
      };
    })
    : discovery.detailedCandidates;
  const requestedSymbols = detailedUniverse.map((item) => item.symbol);
  let detailedProviderWaitMs = 0;
  if (requestedSymbols.length && discovery.broadScreen.providerCalls > 0 && discovery.broadScreen.provider !== "Alpaca") {
    detailedProviderWaitMs = msUntilNextMinute();
    await wait(detailedProviderWaitMs);
  }
  const snapshots = await getMarketSnapshotBatch(requestedSymbols, { range: "1y", interval: "1day" });
  const analysis = [];
  const previousCapitalFlow = await loadLocalCapitalFlowHistory();

  for (const item of detailedUniverse) {
    try {
      const row = await analyseSymbol(item.symbol, snapshots.get(item.symbol));
      const analysed = {
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
      };
      analysed.previousCapitalFlow = previousCapitalFlow[analysed.symbol] || null;
      analysed.capitalFlow = computeCapitalFlow(analysed, analysed.previousCapitalFlow);
      analysis.push(analysed);
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

  const ranking = rankMarketOpportunities(analysis, settings, { includeDevelopingTopFive: true, account });
  const rows = ranking.ranked;
  const completedAt = new Date().toISOString();
  await saveLocalCapitalFlowSnapshot(rows, completedAt);
  const flowSummary = capitalFlowSummary(rows);
  const exceptional = rows.find((row) => ["REVIEW NOW", "TRADE READY"].includes(row.capitalFlowState) && row.buyingSellingPressure === "STRONG BUYING PRESSURE");
  if (exceptional) {
    await sendFreedomNotification({
      symbol: exceptional.symbol,
      alertType: exceptional.capitalFlowState === "TRADE READY" ? "TRADE_READY" : "REVIEW_NOW",
      triggerState: exceptional.capitalFlowState,
      message: exceptional.capitalFlow?.explanation || "Unusual buying activity detected.",
      capitalFlowScore: exceptional.capitalFlowScore,
      currentPrice: exceptional.currentPrice,
      entry: exceptional.recommendedEntry,
      safetyExit: exceptional.safetyExit,
      target: exceptional.finalExit,
      sms: true,
    }).catch((error) => console.error("Freedom Capital Flow notification failed:", error));
  }
  const unavailableRows = rows.filter((row) => row.status === "DATA UNAVAILABLE");
  const analysedRows = rows.filter((row) => row.status !== "DATA UNAVAILABLE");
  const readyCount = countStatus(rows, "READY");
  const waitCount = rows.filter((row) => ["WAIT FOR REVERSAL", "WAIT FOR PULLBACK"].includes(row.status)).length;
  const developingCount = countStatus(rows, "REVERSAL DEVELOPING");
  const noSetupCount = Math.max(0, discovery.broadScreen.requested - unavailableRows.length - readyCount - waitCount - developingCount);
  const reliabilityStatus = scanReliabilityStatus(requestedSymbols.length, analysedRows.length, unavailableRows.length);
  discovery.coverage.US.detailedAnalyses = detailedUniverse.filter((row) => row.market === "US").length;
  discovery.coverage.US.successfullyScreened = analysis.filter((row) => row.country === "United States" && row.dataStatus?.readyForScore).length;
  discovery.coverage.ASX.detailedAnalyses = detailedUniverse.filter((row) => row.market === "ASX").length;
  discovery.coverage.ASX.successfullyScreened = analysis.filter((row) => row.country === "Australia" && row.dataStatus?.readyForScore).length;

  const marketDataMetrics = getMarketDataMetrics();
  const scanSummary = {
    status: reliabilityStatus,
    message: scanMessageFor(discovery, reliabilityStatus, discovery.broadScreen.requested, analysedRows.length, unavailableRows.length),
    tradableUniverse: discovery.supportedUniverseCount,
    configuredUniverseCount: discovery.supportedUniverseCount,
    universe: discovery.supportedUniverseCount,
    universeDefinition: "Twelve Data reference symbols filtered to active common stocks on supported exchanges/currencies.",
    candidateUniverse: discovery.candidateUniverseCount,
    requested: requestedSymbols.length,
    requestedCount: requestedSymbols.length,
    companiesChecked: discovery.broadScreen.requested,
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
    noSetup: noSetupCount,
    capitalFlow: flowSummary,
    notQualified: Math.max(0, analysedRows.length - readyCount),
    totalsBalanced: requestedSymbols.length === analysedRows.length + unavailableRows.length,
    providerDiagnostics: {
      ...marketDataMetrics,
      broadQuoteProviderCalls: discovery.broadScreen.providerCalls,
      broadQuoteProviderWaits: discovery.broadScreen.providerWaits,
      broadQuoteProviderWaitMs: discovery.broadScreen.providerWaitMs,
      referenceProviderWaits: discovery.broadScreen.referenceProviderWaits,
      referenceProviderWaitMs: discovery.broadScreen.referenceProviderWaitMs,
      detailedProviderWaits: detailedProviderWaitMs ? 1 : 0,
      detailedProviderWaitMs,
      broadQuoteRetries: discovery.broadScreen.retries,
      totalProviderCalls: marketDataMetrics.historyProviderCalls + discovery.broadScreen.providerCalls,
      totalCacheHits: marketDataMetrics.historyCacheHits,
    },
    coverage: discovery.coverage,
    dataSource: discovery.dataSource,
    oldestMarketDataAgeMs: discovery.oldestMarketDataAgeMs,
    newestMarketDataAgeMs: discovery.newestMarketDataAgeMs,
    lastProviderRefresh: discovery.lastProviderRefresh,
    broadScreenLimitReason: discovery.broadScreen.limitReason,
    providerBudgetExhausted: discovery.broadScreen.budgetExhausted,
    providerBudgetExhaustedReason: discovery.broadScreen.budgetExhaustedReason,
    pausedAtOffset: discovery.broadScreen.pausedAtOffset,
    scanStartedAt: startedAt,
    scanCompletedAt: completedAt,
    elapsedMs: Date.parse(completedAt) - Date.parse(startedAt),
    unavailableSymbols: unavailableRows.map((row) => ({ symbol: row.symbol, reason: buildUnavailableReason(row) })),
    marketScopeMessage: `Provider-supported universe: ${discovery.coverage.US.totalSupported} US common stocks and ${discovery.coverage.ASX.totalSupported} Australian common stocks.`,
  };

  const safeBestCurrentTrade = reliabilityStatus === "failed" || unavailableRows.length ? null : ranking.bestCurrentTrade;
  const safeBestTradePlan = reliabilityStatus === "failed" || unavailableRows.length ? null : ranking.bestTradePlan;
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
    reliable: reliabilityStatus !== "failed",
    results: reliabilityStatus === "failed" ? [] : rows.filter((row) => row.status === "READY"),
    topFive: reliabilityStatus === "failed" ? [] : ranking.topFive,
    topOpportunity: reliabilityStatus === "failed" ? null : safeTopOpportunity,
    bestCurrentTrade: safeBestCurrentTrade,
    bestTradePlan: safeBestTradePlan,
    bestSetupToWatch: reliabilityStatus === "failed" ? null : ranking.bestSetupToWatch || ranking.topFive[0] || null,
    opportunityRanking: {
      topSymbol: safeTopOpportunity?.symbol || null,
      bestCurrentTradeSymbol: safeBestCurrentTrade?.symbol || null,
      bestTradePlanSymbol: safeBestTradePlan?.symbol || null,
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
  await saveLocalLastGoodScan(payload);
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
    const accountSnapshot = await loadPaperAccount(req).catch(() => null);
    const promise = runCompleteScan(settings, accountSnapshot?.account || null).finally(() => activeScans.delete(key));
    activeScans.set(key, promise);
    return res.status(200).json(await promise);
  } catch (error) {
    console.error("Freedom Trader scanner failed:", error);
    const lastGoodScan = await loadLocalLastGoodScan().catch(() => null);
    if (lastGoodScan?.ok) {
      return res.status(200).json({
        ...lastGoodScan,
        fromLastGoodScan: true,
        scanSummary: {
          ...(lastGoodScan.scanSummary || {}),
          status: "partial",
          message: `Live market scan failed: ${error?.message || "Market scanner could not complete."} Freedom restored the last valid scan.`,
          restoredBecause: error?.message || "Market scanner could not complete.",
        },
        error: null,
      });
    }
    return res.status(500).json({ ok: false, results: [], topFive: [], error: "Market scanner could not complete." });
  }
}
