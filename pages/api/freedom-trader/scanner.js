import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

﻿import { analyseSymbol } from "./analysis.js";
import { getMarketDataMetrics, getMarketSnapshotBatch, resetMarketDataMetrics } from "../../../lib/freedom-trader/marketDataService.js";
import { marketMeta } from "../../../lib/freedom-trader/marketData.js";
import { buildMarketDiscovery } from "../../../lib/freedom-trader/marketUniverse.js";
import { getTwelveDataRequestLog, resetTwelveDataRequestLog } from "../../../lib/freedom-trader/twelveData.js";
import { getYahooFinanceRequestLog, resetYahooFinanceRequestLog } from "../../../lib/freedom-trader/yahooFinance.js";
import { rankMarketOpportunities } from "../../../lib/freedom-trader/opportunityRanking.js";
import { computeCapitalFlow, capitalFlowSummary } from "../../../lib/freedom-trader/capitalFlow.js";
import { loadLocalCapitalFlowHistory, loadLocalLastGoodScan, saveLocalCapitalFlowSnapshot, saveLocalLastGoodScan } from "../../../lib/freedom-trader/localPaperStore.js";
import { sendFreedomNotification } from "../../../lib/freedom-trader/notifications.js";
import { defaultMarketSelection, marketSessionSnapshot, marketsForSelection, normalizeMarketSelection } from "../../../lib/freedom/marketSessions.js";
import { loadPaperAccount } from "./paper-account.js";

const DEFAULT_SETTINGS = {
  markets: null,
  universeSelection: null,
  minimumScore: 82,
  minimumDailyVolume: 1000000,
  minimumPrice: 2,
  minimumHistoryBars: 200,
  minimumRiskReward: 2,
  maximumVolatility: 9,
  excludedIndustries: [],
  scanFrequency: "during-session",
};

const DIAGNOSTIC_SECURITIES = [
  { symbol: "CBA", companyName: "Commonwealth Bank of Australia", exchange: "ASX", country: "Australia", currency: "AUD", market: "ASX", assetType: "common stock", providerSymbol: "CBA:ASX" },
  { symbol: "BHP", companyName: "BHP Group Limited", exchange: "ASX", country: "Australia", currency: "AUD", market: "ASX", assetType: "common stock", providerSymbol: "BHP:ASX" },
  { symbol: "CSL", companyName: "CSL Limited", exchange: "ASX", country: "Australia", currency: "AUD", market: "ASX", assetType: "common stock", providerSymbol: "CSL:ASX" },
];

const latestScanCache = globalThis.__freedomTraderLatestScanCache || { key: "", cachedAt: 0, payload: null };
const activeScans = globalThis.__freedomTraderActiveScans || new Map();
globalThis.__freedomTraderLatestScanCache = latestScanCache;
globalThis.__freedomTraderActiveScans = activeScans;

export function cleanSettings(input = {}) {
  const requestedSelection = normalizeMarketSelection(input.marketSelection || input.market);
  const marketSelection = requestedSelection || defaultMarketSelection();
  const markets = Array.isArray(input.markets) && input.markets.length ? input.markets : marketsForSelection(marketSelection);
  const universeSelection = String(input.universeSelection || input.asxUniverse || "").trim().toUpperCase()
    || (markets.includes("ASX") && markets.length === 1 ? "ASX_LIQUID" : "PROVIDER_SUPPORTED");
  const cleaned = {
    ...DEFAULT_SETTINGS,
    ...input,
    marketSelection,
    universeSelection,
    markets: markets.filter((market) => ["US", "ASX"].includes(String(market).toUpperCase())).map((market) => String(market).toUpperCase()),
    excludedIndustries: Array.isArray(input.excludedIndustries)
      ? input.excludedIndustries.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : String(input.excludedIndustries || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
    symbols: Array.isArray(input.symbols)
      ? input.symbols.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
      : String(input.symbols || "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean),
    importedCandidates: Array.isArray(input.importedCandidates)
      ? input.importedCandidates.map((item) => ({
        ...item,
        symbol: String(item?.symbol || item?.ticker || "").trim().toUpperCase(),
        exchange: "ASX",
        currency: "AUD",
        market: "ASX",
      })).filter((item) => item.symbol)
      : [],
  };
  const developmentDiagnostic =
    process.env.NODE_ENV !== "production" &&
    input.allowFullUniverseScan !== true &&
    input.allowFullUniverseScan !== "true" &&
    !cleaned.symbols.length &&
    !cleaned.importedCandidates.length;
  if (developmentDiagnostic) {
    cleaned.marketSelection = "ASX";
    cleaned.markets = ["ASX"];
    cleaned.universeSelection = "DIAGNOSTIC";
    cleaned.symbols = DIAGNOSTIC_SECURITIES.map((item) => item.symbol);
    cleaned.diagnosticScan = true;
  }
  if (cleaned.universeSelection === "DIAGNOSTIC") {
    cleaned.marketSelection = "ASX";
    cleaned.markets = ["ASX"];
    cleaned.symbols = cleaned.symbols.length ? cleaned.symbols : DIAGNOSTIC_SECURITIES.map((item) => item.symbol);
    cleaned.diagnosticScan = true;
  }
  return cleaned;
}

function scanCacheKey(settings) {
  return JSON.stringify({
    markets: settings.markets,
    excludedIndustries: settings.excludedIndustries,
    minimumDailyVolume: settings.minimumDailyVolume,
    minimumPrice: settings.minimumPrice,
    minimumHistoryBars: settings.minimumHistoryBars,
    universeSelection: settings.universeSelection,
    broadScreenLimit: settings.broadScreenLimit || null,
    detailedAnalysisLimit: settings.detailedAnalysisLimit || null,
    symbols: settings.symbols || [],
    importedSymbols: (settings.importedCandidates || []).map((item) => item.symbol),
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

function providerSymbolForItem(item = {}) {
  const symbol = String(item.symbol || "").trim().toUpperCase();
  const exchange = String(item.exchange || "").trim().toUpperCase();
  if ((exchange === "ASX" || exchange === "XASX" || item.market === "ASX") && symbol && !symbol.includes(":")) return `${symbol}:ASX`;
  return item.providerSymbol || symbol;
}

function quoteModeFor(row = {}, session = {}) {
  const delayed = row.marketData?.quoteDelayed !== false;
  if (!session?.isOpen) return "previous close";
  return delayed ? "delayed" : "live";
}

function priceSessionFor(row = {}, session = {}) {
  if (!session?.isOpen) return "Last regular-session price";
  if (row.marketData?.quoteDelayed === false) return "Live regular-session price";
  return "Delayed regular-session price";
}

function scanProviderLabel(discovery = {}, settings = {}) {
  if (settings.markets?.length === 1 && settings.markets[0] === "ASX") return discovery.broadScreen?.provider || "Twelve Data";
  return discovery.broadScreen?.provider || "Alpaca";
}

function analysisProviderLabel(rows = [], discovery = {}, settings = {}) {
  const providers = Array.from(new Set(rows.map((row) => row.dataSource || row.marketData?.historySource || row.source?.provider).filter(Boolean)));
  if (providers.length === 1) return providers[0];
  if (providers.length > 1) return providers.join(" + ");
  return scanProviderLabel(discovery, settings);
}

function scanReliabilityStatus(requestedCount, analysedCount, unavailableCount, discovery = {}) {
  if (discovery.broadScreen?.budgetExhausted) return "blocked";
  if (Number(discovery.expectedUniverseSize || discovery.candidateUniverseCount) > Number(discovery.broadScreen?.requested || requestedCount)) return "partial";
  if (!requestedCount || analysedCount < Math.max(5, Math.ceil(requestedCount * 0.35))) return "failed";
  if (unavailableCount > Math.max(10, Math.floor(requestedCount * 0.25))) return "partial";
  if (unavailableCount > 0) return "partial";
  return "complete";
}

function providerFailureKind(discovery = {}) {
  const text = String(discovery.broadScreen?.budgetExhaustedReason || discovery.usage?.error || "").toLowerCase();
  if (/out of api credits|daily/.test(text)) return "DAILY_ALLOWANCE_EXHAUSTED";
  if (/per minute|minute|rate|too many|429/.test(text)) return "PER_MINUTE_RATE_LIMIT";
  if (/api key.*missing|missing.*api key/.test(text)) return "MISSING_API_KEY";
  if (/invalid api key|unauthorized|forbidden|permission|not entitled/.test(text)) return "INVALID_OR_NOT_ENTITLED_API_KEY";
  if (/unsupported exchange|not supported/.test(text)) return "UNSUPPORTED_ASX_OR_ENDPOINT";
  return discovery.broadScreen?.budgetExhausted ? "PROVIDER_BLOCKED" : null;
}

function scanReliabilityMessage(status, checkedCount, analysedCount, unavailableCount) {
  if (status === "blocked") return "SCAN INCOMPLETE—NO MARKET CONCLUSION AVAILABLE";
  if (status === "failed") return "Freedom could not obtain enough market data to produce reliable recommendations.";
  if (status === "partial") return `Checked ${checkedCount} companies. ${analysedCount} analysed successfully. ${unavailableCount} unavailable. Results are incomplete.`;
  return `Checked ${checkedCount} companies. ${analysedCount} analysed successfully. ${unavailableCount} unavailable.`;
}

function scanMessageFor(discovery, status, checkedCount, analysedCount, unavailableCount) {
  if (discovery.broadScreen?.budgetExhausted) {
    return `SCAN INCOMPLETE—NO MARKET CONCLUSION AVAILABLE. Freedom paused because the market-data provider limit was reached after ${checkedCount} attempted securities and ${analysedCount} analysed securities.`;
  }
  if (status === "partial" && Number(discovery.expectedUniverseSize || discovery.candidateUniverseCount) > checkedCount) {
    return `Partial scan only. Selected universe size is ${discovery.expectedUniverseSize || discovery.candidateUniverseCount}, but Freedom attempted ${checkedCount}. No whole-market conclusion is available.`;
  }
  return scanReliabilityMessage(status, checkedCount, analysedCount, unavailableCount);
}

function importedCandidateMap(settings = {}) {
  return new Map((settings.importedCandidates || []).map((item) => [item.symbol, item]));
}

function detailedItemFromSymbol(symbol, settings = {}) {
  const imported = importedCandidateMap(settings).get(symbol);
  if (imported) {
    return {
      symbol,
      companyName: imported.companyName || symbol,
      exchange: "ASX",
      country: "Australia",
      currency: "AUD",
      market: "ASX",
      assetType: "CMC imported candidate",
      cmcImport: imported,
      broadScore: null,
      volume: imported.volume || null,
      changePercent: imported.cmcMovePercent || null,
    };
  }
  const diagnostic = DIAGNOSTIC_SECURITIES.find((item) => item.symbol === symbol);
  if (diagnostic) return { ...diagnostic, broadScore: null, volume: null, changePercent: null };
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
}

function manualDiscovery(settings = {}, detailedUniverse = []) {
  const selectedUniverse = settings.diagnosticScan ? "Diagnostic scan: CBA, BHP, CSL" : settings.universeSelection === "CMC_IMPORTED" ? "CMC imported candidates" : "Custom watchlist";
  const coverage = {
    US: {
      totalSupported: detailedUniverse.filter((row) => row.market === "US").length,
      eligibleForScreening: detailedUniverse.filter((row) => row.market === "US").length,
      broadScreened: 0,
      detailedAnalyses: detailedUniverse.filter((row) => row.market === "US").length,
      successfullyScreened: 0,
      unavailableReason: null,
    },
    ASX: {
      totalSupported: detailedUniverse.filter((row) => row.market === "ASX").length,
      eligibleForScreening: detailedUniverse.filter((row) => row.market === "ASX").length,
      broadScreened: 0,
      detailedAnalyses: detailedUniverse.filter((row) => row.market === "ASX").length,
      successfullyScreened: 0,
      unavailableReason: null,
    },
  };
  return {
    ok: true,
    usage: null,
    reference: { cacheHit: true, fetchedAt: null, error: null },
    identity: { ok: true, cacheHit: true, valid: detailedUniverse.length, invalid: 0, error: null },
    coverage,
    supportedUniverseCount: detailedUniverse.length,
    candidateUniverseCount: detailedUniverse.length,
    expectedUniverseSize: detailedUniverse.length,
    validatedLiquidUniverseSize: 0,
    selectedUniverse,
    universeOptions: [],
    broadScreen: {
      requested: 0,
      eligible: 0,
      providerCalls: 0,
      providerWaits: 0,
      providerWaitMs: 0,
      referenceProviderWaits: 0,
      referenceProviderWaitMs: 0,
      retries: 0,
      quoteLimit: 0,
      unavailable: [],
      budgetExhausted: false,
      budgetExhaustedReason: null,
      pausedAtOffset: null,
      limitReason: settings.diagnosticScan ? "Development diagnostic mode disables full-universe pre-screening until CBA, BHP and CSL pass." : null,
      provider: "Twelve Data",
      symbolsRequested: 0,
      barsReturned: 0,
      cacheHits: 0,
      freshFetches: 0,
      batches: 0,
      symbolsPerBatch: null,
      missingSymbols: 0,
      elapsedMs: 0,
    },
    detailedCandidates: detailedUniverse,
    detailedAnalysisLimit: detailedUniverse.length,
    dataSource: "Sequential validated daily OHLCV",
    oldestMarketDataAgeMs: 0,
    newestMarketDataAgeMs: 0,
    lastProviderRefresh: new Date().toISOString(),
  };
}

function emptyOutcomeCounters(selected = 0) {
  return {
    selected,
    attempted: 0,
    resolved: 0,
    ohlcvLoaded: 0,
    fullyAnalysed: 0,
    rejected: 0,
    rateLimited: 0,
    failed: 0,
  };
}

function rowIsReadyForScore(row = {}) {
  return row.dataStatus?.readyForScore === true && Number(row.candleCount ?? row.dataStatus?.actualCandleCount) >= 200;
}

function rateLimited(value = {}) {
  return Number(value.providerStatus) === 429 || /credit|limit|rate|429/i.test(String(value.error || value.status || ""));
}

function updateOutcomeCounters(counters, item, snapshot, row) {
  counters.attempted += 1;
  if (item.providerSymbol && item.exchange && item.currency) counters.resolved += 1;
  if (Number(snapshot?.candleCount) > 0 || Number(snapshot?.candles?.daily?.length) > 0) counters.ohlcvLoaded += 1;
  if (rowIsReadyForScore(row)) counters.fullyAnalysed += 1;
  else if (rateLimited(snapshot) || rateLimited(row)) counters.rateLimited += 1;
  else if (row?.error || snapshot?.error) counters.failed += 1;
  else counters.rejected += 1;
}

function diagnosticFailureMessage(symbolDiagnostics = []) {
  const failures = symbolDiagnostics
    .filter((item) => item.error)
    .map((item) => `${item.symbol}: ${item.error}`);
  if (!failures.length) return null;
  return `${symbolDiagnostics.map((item) => item.symbol).join(", ")} could not be loaded because ${failures.join("; ")}.`;
}

export async function runCompleteScan(settings, account = null) {
  resetMarketDataMetrics();
  resetTwelveDataRequestLog();
  resetYahooFinanceRequestLog();
  const startedAt = new Date().toISOString();
  const sessions = marketSessionSnapshot();
  const manualSymbols = Array.isArray(settings.symbols) && settings.symbols.length;
  const seedUniverse = manualSymbols ? settings.symbols.map((symbol) => detailedItemFromSymbol(symbol, settings)) : null;
  const discovery = manualSymbols ? manualDiscovery(settings, seedUniverse) : await buildMarketDiscovery(settings);
  const detailedUniverse = manualSymbols ? seedUniverse : discovery.detailedCandidates;
  const requestedSymbols = detailedUniverse.map((item) => item.symbol);
  const terminalCounters = emptyOutcomeCounters(detailedUniverse.length);
  const perSymbolDiagnostics = [];
  let detailedProviderWaitMs = 0;
  if (requestedSymbols.length && discovery.broadScreen.providerCalls > 0 && discovery.broadScreen.provider !== "Alpaca") {
    detailedProviderWaitMs = msUntilNextMinute();
    await wait(detailedProviderWaitMs);
  }
  const analysis = [];
  const previousCapitalFlow = await loadLocalCapitalFlowHistory();

  for (const item of detailedUniverse) {
    let snapshot = null;
    const beforeTwelveRequestCount = getTwelveDataRequestLog().length;
    const beforeYahooRequestCount = getYahooFinanceRequestLog().length;
    try {
      const providerSymbol = providerSymbolForItem(item);
      const snapshots = await getMarketSnapshotBatch([{
        symbol: item.symbol,
        providerSymbol,
        exchange: item.exchange,
        currency: item.currency,
      }], { range: "1y", interval: "1day" });
      snapshot = snapshots.get(item.symbol);
      const row = await analyseSymbol(item.symbol, snapshot, item);
      const analysed = {
        ...row,
        companyName: item.companyName || row.companyName,
        sector: item.assetType || row.sector,
        exchange: item.exchange || row.exchange,
        country: item.country,
        currency: item.currency || row.currency || "USD",
        market: item.market || (item.currency === "AUD" ? "ASX" : "US"),
        providerSymbol: providerSymbolForItem(item),
        marketStatus: sessions[item.market || (item.currency === "AUD" ? "ASX" : "US")]?.status || "CLOSED",
        marketLocalTime: sessions[item.market || (item.currency === "AUD" ? "ASX" : "US")]?.localTime || null,
        userLocalTime: sessions.userTime,
        priceSession: priceSessionFor(row, sessions[item.market || (item.currency === "AUD" ? "ASX" : "US")]),
        quoteMode: quoteModeFor(row, sessions[item.market || (item.currency === "AUD" ? "ASX" : "US")]),
        dataSource: snapshot?.source || snapshot?.provider || item.provider || null,
        cmcImport: item.cmcImport || null,
        importedRating: item.cmcImport?.importedRating || null,
        importedValuation: item.cmcImport?.importedValuation || null,
        cmcComparison: item.cmcImport ? {
          cmcPrice: item.cmcImport.cmcPrice ?? null,
          cmcTimestamp: item.cmcImport.sourceTimestamp || null,
          freedomPrice: row.currentPrice ?? null,
          freedomTimestamp: row.marketData?.latestCandleDate || row.dataStatus?.latestTimestamp || null,
          discrepancyPercent: Number.isFinite(Number(item.cmcImport.cmcPrice)) && Number.isFinite(Number(row.currentPrice)) && Number(item.cmcImport.cmcPrice) > 0
            ? Number((((Number(row.currentPrice) - Number(item.cmcImport.cmcPrice)) / Number(item.cmcImport.cmcPrice)) * 100).toFixed(2))
            : null,
          material: Number.isFinite(Number(item.cmcImport.cmcPrice)) && Number.isFinite(Number(row.currentPrice)) && Math.abs(((Number(row.currentPrice) - Number(item.cmcImport.cmcPrice)) / Number(item.cmcImport.cmcPrice)) * 100) > 1,
        } : null,
        broadScreen: {
          score: item.broadScore,
          volume: item.volume,
          changePercent: item.changePercent,
        },
      };
      analysed.previousCapitalFlow = previousCapitalFlow[analysed.symbol] || null;
      analysed.capitalFlow = computeCapitalFlow(analysed, analysed.previousCapitalFlow);
      analysis.push(analysed);
      updateOutcomeCounters(terminalCounters, { ...item, providerSymbol }, snapshot, analysed);
      perSymbolDiagnostics.push({
        symbol: item.symbol,
        companyName: item.companyName || analysed.companyName,
        requestedProviderSymbol: providerSymbol,
        confirmedExchange: snapshot?.exchange || analysed.exchange || null,
        confirmedCurrency: snapshot?.currency || analysed.currency || null,
        candleCount: snapshot?.candleCount || analysed.candleCount || 0,
        latestCandleTimestamp: snapshot?.latestTimestamp || analysed.dataStatus?.latestTimestamp || null,
        readyForScore: Boolean(analysed.dataStatus?.readyForScore),
        classification: analysed.status,
        buyTrigger: analysed.setup?.plannedEntry ?? null,
        safetyExit: analysed.setup?.stop ?? null,
        targets: [analysed.setup?.takeSomeProfit ?? analysed.setup?.target, analysed.setup?.finalExit ?? analysed.setup?.target].filter((value) => Number.isFinite(Number(value))),
        error: analysed.error || snapshot?.error || null,
        providerRequests: [
          ...getTwelveDataRequestLog().slice(beforeTwelveRequestCount),
          ...getYahooFinanceRequestLog().slice(beforeYahooRequestCount),
        ],
      });
    } catch (error) {
      const failed = {
        symbol: item.symbol,
        companyName: item.companyName,
        exchange: item.exchange,
        country: item.country,
        currency: item.currency,
        market: item.market || (item.currency === "AUD" ? "ASX" : "US"),
        providerSymbol: providerSymbolForItem(item),
        marketStatus: sessions[item.market || (item.currency === "AUD" ? "ASX" : "US")]?.status || "CLOSED",
        marketLocalTime: sessions[item.market || (item.currency === "AUD" ? "ASX" : "US")]?.localTime || null,
        userLocalTime: sessions.userTime,
        priceSession: sessions[item.market || (item.currency === "AUD" ? "ASX" : "US")]?.priceSession || "Last regular-session price",
        quoteMode: "previous close",
        currentPrice: null,
        tradingScore: null,
        confidence: null,
        setup: { valid: false, setupReasoning: "Analysis failed." },
        indicators: {},
        dataStatus: { readyForScore: false, status: error?.message || "Analysis failed.", actualCandleCount: 0 },
        error: error?.message || "Analysis failed.",
        cmcImport: item.cmcImport || null,
      };
      analysis.push(failed);
      updateOutcomeCounters(terminalCounters, item, snapshot, failed);
      perSymbolDiagnostics.push({
        symbol: item.symbol,
        companyName: item.companyName,
        requestedProviderSymbol: providerSymbolForItem(item),
        confirmedExchange: snapshot?.exchange || null,
        confirmedCurrency: snapshot?.currency || null,
        candleCount: snapshot?.candleCount || 0,
        latestCandleTimestamp: snapshot?.latestTimestamp || null,
        readyForScore: false,
        classification: "DATA UNAVAILABLE",
        buyTrigger: null,
        safetyExit: null,
        targets: [],
        error: error?.message || snapshot?.error || "Analysis failed.",
        providerRequests: [
          ...getTwelveDataRequestLog().slice(beforeTwelveRequestCount),
          ...getYahooFinanceRequestLog().slice(beforeYahooRequestCount),
        ],
      });
    }
  }

  const ranking = rankMarketOpportunities(analysis, settings, { includeDevelopingTopFive: true, account });
  const rows = ranking.ranked;
  const rankedBySymbol = new Map(rows.map((row) => [row.symbol, row]));
  perSymbolDiagnostics.forEach((diagnostic) => {
    const ranked = rankedBySymbol.get(diagnostic.symbol);
    if (!ranked) return;
    diagnostic.classification = ranked.status;
    diagnostic.buyTrigger = ranked.recommendedEntry ?? diagnostic.buyTrigger;
    diagnostic.safetyExit = ranked.safetyExit ?? diagnostic.safetyExit;
    diagnostic.targets = [ranked.takeSomeProfit, ranked.finalExit].filter((value) => Number.isFinite(Number(value)));
    diagnostic.exactUnavailableReason = ranked.status === "DATA UNAVAILABLE" ? buildUnavailableReason(ranked) : null;
  });
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
  const noSetupCount = Math.max(0, rows.length - unavailableRows.length - readyCount - waitCount - developingCount);
  const reliabilityStatus = manualSymbols
    ? terminalCounters.rateLimited > 0
      ? "blocked"
      : terminalCounters.fullyAnalysed > 0
      ? "complete"
      : "failed"
    : requestedSymbols.length ? scanReliabilityStatus(requestedSymbols.length, analysedRows.length, unavailableRows.length, discovery) : "failed";
  discovery.coverage.US.detailedAnalyses = detailedUniverse.filter((row) => row.market === "US").length;
  discovery.coverage.US.successfullyScreened = analysis.filter((row) => row.country === "United States" && row.dataStatus?.readyForScore).length;
  discovery.coverage.ASX.detailedAnalyses = detailedUniverse.filter((row) => row.market === "ASX").length;
  discovery.coverage.ASX.successfullyScreened = analysis.filter((row) => row.country === "Australia" && row.dataStatus?.readyForScore).length;

  const marketDataMetrics = getMarketDataMetrics();
  const twelveDataRequests = getTwelveDataRequestLog();
  const yahooFinanceRequests = getYahooFinanceRequestLog();
  const broadRejected = Array.isArray(discovery.broadScreen?.unavailable) ? discovery.broadScreen.unavailable.length : 0;
  const broadProviderFailures = (discovery.broadScreen?.unavailable || []).filter((item) => /DATA_UNAVAILABLE|SYMBOL_NOT_FOUND|RATE_LIMITED|STALE/i.test(String(item.statusCode || ""))).length;
  const expectedUniverseSize = settings.symbols?.length || discovery.expectedUniverseSize || discovery.candidateUniverseCount || terminalCounters.selected;
  const universeProcessed = manualSymbols ? terminalCounters.attempted : Math.max(discovery.broadScreen?.requested || 0, terminalCounters.attempted);
  const totalRejected = terminalCounters.rejected + Math.max(0, broadRejected - broadProviderFailures);
  const totalProviderFailures = terminalCounters.failed + broadProviderFailures;
  const completedOutcomes = terminalCounters.fullyAnalysed + totalRejected + totalProviderFailures + terminalCounters.rateLimited;
  const completedPercentage = expectedUniverseSize ? Math.min(100, Math.round((completedOutcomes / expectedUniverseSize) * 100)) : 0;
  const failureMessage = manualSymbols && terminalCounters.fullyAnalysed === 0
    ? diagnosticFailureMessage(perSymbolDiagnostics)
    : null;
  const scanSummary = {
    status: reliabilityStatus,
    message: failureMessage || scanMessageFor(discovery, reliabilityStatus, universeProcessed, terminalCounters.fullyAnalysed, unavailableRows.length + broadProviderFailures),
    tradableUniverse: discovery.supportedUniverseCount,
    configuredUniverseCount: discovery.supportedUniverseCount,
    expectedUniverseSize,
    universeSize: expectedUniverseSize,
    validatedLiquidUniverseSize: manualSymbols ? terminalCounters.ohlcvLoaded : discovery.validatedLiquidUniverseSize ?? discovery.broadScreen.eligible,
    universe: discovery.supportedUniverseCount,
    selectedUniverse: discovery.selectedUniverse || settings.universeSelection,
    universeDefinition: settings.universeSelection === "CMC_IMPORTED"
      ? "User-reviewed CMC imported ASX candidates. CMC rows are candidate inputs only; Freedom retrieves independent OHLCV before classification."
      : settings.markets?.includes("ASX")
      ? "Exchange-qualified ASX common-stock reference symbols filtered by price, average volume, volatility and sufficient daily OHLCV history. ASX symbols require AUD currency and ASX/XASX provider exchange match."
      : "Finnhub US common-stock symbols cross-checked against active/tradable Alpaca US equity assets, then filtered by validated Alpaca OHLCV.",
    liquidityCriteria: {
      minimumPrice: Number(settings.minimumPrice) || 2,
      minimumAverageDailyVolume: Number(settings.minimumDailyVolume) || 1_000_000,
      minimumHistoryBars: Math.max(20, Number(settings.minimumHistoryBars) || 200),
      maximumVolatilityPercent: Number(settings.maximumVolatility) || 9,
    },
    identityValid: discovery.identity?.valid ?? null,
    identityInvalid: discovery.identity?.invalid ?? null,
    candidateUniverse: discovery.candidateUniverseCount,
    selected: terminalCounters.selected,
    attempted: universeProcessed,
    detailedAttempted: terminalCounters.attempted,
    resolved: terminalCounters.resolved,
    ohlcvLoaded: terminalCounters.ohlcvLoaded,
    successfullyLoaded: terminalCounters.ohlcvLoaded,
    fullyAnalysed: terminalCounters.fullyAnalysed,
    rejected: totalRejected,
    rateLimited: terminalCounters.rateLimited,
    failed: totalProviderFailures,
    providerFailures: totalProviderFailures,
    completedPercentage,
    requested: universeProcessed,
    requestedCount: universeProcessed,
    companiesChecked: universeProcessed,
    broadScreenRequested: discovery.broadScreen.requested,
    broadScreenEligible: discovery.broadScreen.eligible,
    successfullyAnalysed: terminalCounters.fullyAnalysed,
    analysedCount: terminalCounters.fullyAnalysed,
    unavailable: unavailableRows.length + broadProviderFailures,
    dataUnavailable: unavailableRows.length + broadProviderFailures,
    unavailableCount: unavailableRows.length + broadProviderFailures,
    qualified: readyCount,
    qualifiedCount: readyCount,
    ready: readyCount,
    wait: waitCount,
    developing: developingCount,
    noSetup: noSetupCount,
    capitalFlow: flowSummary,
    notQualified: Math.max(0, terminalCounters.fullyAnalysed - readyCount),
    totalsBalanced: completedOutcomes <= expectedUniverseSize,
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
      broadDailyCacheHits: discovery.broadScreen.cacheHits || 0,
      broadDailyFreshFetches: discovery.broadScreen.freshFetches || 0,
      broadDailyBatches: discovery.broadScreen.batches || 0,
      broadDailySymbolsPerBatch: discovery.broadScreen.symbolsPerBatch || null,
      broadDailyMissingSymbols: discovery.broadScreen.missingSymbols || 0,
      totalProviderCalls: marketDataMetrics.historyProviderCalls + discovery.broadScreen.providerCalls,
      totalCacheHits: marketDataMetrics.historyCacheHits + (discovery.broadScreen.cacheHits || 0),
      twelveDataRequests,
      yahooFinanceRequests,
      twelveDataEstimatedCredits: twelveDataRequests.reduce((total, item) => total + (Number(item.estimatedCredits) || 0), 0),
      twelveDataReportedCreditsUsed: twelveDataRequests.map((item) => item.creditsUsed).filter((value) => value !== null),
    },
    coverage: discovery.coverage,
    dataSource: discovery.dataSource,
    oldestMarketDataAgeMs: discovery.oldestMarketDataAgeMs,
    newestMarketDataAgeMs: discovery.newestMarketDataAgeMs,
    lastProviderRefresh: discovery.lastProviderRefresh,
    broadScreenLimitReason: discovery.broadScreen.limitReason,
    market: settings.marketSelection || settings.markets?.join(",") || "US",
    dataProvider: analysisProviderLabel(rows, discovery, settings),
    feed: settings.markets?.includes("US") ? "IEX" : null,
    coverageDisclosure: settings.markets?.includes("US") ? "Limited exchange feed" : "ASX exchange-qualified data required",
    providerBudgetExhausted: discovery.broadScreen.budgetExhausted,
    providerBudgetExhaustedReason: discovery.broadScreen.budgetExhaustedReason,
    providerFailureKind: providerFailureKind(discovery),
    firstProviderFailure: discovery.broadScreen.budgetExhausted ? {
      provider: "Twelve Data",
      endpoint: discovery.usage?.endpoint || discovery.broadScreen?.unavailable?.[0]?.endpoint || "https://api.twelvedata.com/api_usage",
      httpStatus: discovery.usage?.status || discovery.broadScreen?.unavailable?.[0]?.providerStatus || null,
      providerCode: discovery.usage?.providerCode || discovery.broadScreen?.unavailable?.[0]?.providerCode || null,
      providerStatus: discovery.usage?.providerStatus || "error",
      message: discovery.broadScreen.budgetExhaustedReason,
      keySupplied: discovery.usage?.keySupplied ?? true,
      creditsUsed: discovery.usage?.creditsUsed || null,
      creditsLeft: discovery.usage?.creditsLeft || null,
    } : null,
    pausedAtOffset: discovery.broadScreen.pausedAtOffset,
    scanStartedAt: startedAt,
    scanCompletedAt: completedAt,
    elapsedMs: Date.parse(completedAt) - Date.parse(startedAt),
    unavailableSymbols: unavailableRows.map((row) => ({ symbol: row.symbol, reason: buildUnavailableReason(row) })),
    marketScopeMessage: `Provider-supported universe: ${discovery.coverage.US.totalSupported} US common stocks and ${discovery.coverage.ASX.totalSupported} Australian common stocks.`,
    marketSelection: settings.marketSelection || null,
    requestedMarkets: settings.markets,
    sessions,
    rejectedSecurities: discovery.broadScreen.unavailable || [],
    terminalOutcomes: terminalCounters,
    perSymbolDiagnostics,
  };

  const blockedOrFailed = reliabilityStatus === "failed" || reliabilityStatus === "blocked";
  const safeBestCurrentTrade = blockedOrFailed || unavailableRows.length ? null : ranking.bestCurrentTrade;
  const safeBestTradePlan = blockedOrFailed || unavailableRows.length ? null : ranking.bestTradePlan;
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
    reliable: !blockedOrFailed,
    results: blockedOrFailed ? [] : rows.filter((row) => row.status === "READY"),
    topFive: blockedOrFailed ? [] : ranking.topFive,
    topOpportunity: blockedOrFailed ? null : safeTopOpportunity,
    bestCurrentTrade: safeBestCurrentTrade,
    bestTradePlan: safeBestTradePlan,
    bestSetupToWatch: blockedOrFailed ? null : ranking.bestSetupToWatch || ranking.topFive[0] || null,
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
      stoppedAt: row.status === "DATA UNAVAILABLE" ? "analysis validation" : "ranking",
      stopReason: row.status === "DATA UNAVAILABLE" ? buildUnavailableReason(row) : row.reason,
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

async function handler(req, res) {
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

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
