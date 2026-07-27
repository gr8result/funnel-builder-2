import { analyseSymbol } from "./analysis.js";
import { getMarketSnapshotBatch } from "../../../lib/freedom-trader/marketDataService.js";
import { OPPORTUNITY_ENGINE_VERSION, supportedUniverseForMarkets } from "../../../lib/freedom-trader/opportunityEngine.js";

const DEFAULT_SETTINGS = {
  markets: ["US"],
  minimumScore: 82,
  minimumDailyVolume: 1000000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
  excludedIndustries: [],
  scanFrequency: "during-session",
  chunkSize: 30,
};

const scannerCache = globalThis.__freedomTraderScannerCache || new Map();
globalThis.__freedomTraderScannerCache = scannerCache;
const SCANNER_CACHE_TTL_MS = 10 * 60 * 1000;

function scannerCacheKey(symbol) {
  return `${OPPORTUNITY_ENGINE_VERSION}:${symbol}:1y:1d`;
}

function cachedScannerResult(symbol) {
  const cached = scannerCache.get(scannerCacheKey(symbol));
  if (!cached || Date.now() - cached.cachedAt > SCANNER_CACHE_TTL_MS) return null;
  return {
    ...cached.row,
    dataStatus: {
      ...(cached.row.dataStatus || {}),
      cacheStatus: "scanner-cache-hit",
    },
  };
}

function cleanSettings(input = {}) {
  const markets = Array.isArray(input.markets) && input.markets.length ? input.markets : DEFAULT_SETTINGS.markets;
  return {
    markets,
    minimumScore: Number(input.minimumScore) || DEFAULT_SETTINGS.minimumScore,
    minimumDailyVolume: Number(input.minimumDailyVolume) || DEFAULT_SETTINGS.minimumDailyVolume,
    minimumRiskReward: Number(input.minimumRiskReward) || DEFAULT_SETTINGS.minimumRiskReward,
    maximumVolatility: Number(input.maximumVolatility) || DEFAULT_SETTINGS.maximumVolatility,
    excludedIndustries: Array.isArray(input.excludedIndustries)
      ? input.excludedIndustries.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : String(input.excludedIndustries || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
    scanFrequency: input.scanFrequency || DEFAULT_SETTINGS.scanFrequency,
    chunkSize: Math.max(5, Math.min(80, Number(input.chunkSize) || DEFAULT_SETTINGS.chunkSize)),
  };
}

function requestedRows(settings) {
  const rows = supportedUniverseForMarkets(settings.markets);
  const seen = new Set();
  return rows.filter((item) => {
    if (seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    if (!settings.markets.includes(item.market === "ASX" ? "ASX" : "US")) return false;
    const sector = String(item.sector || "").toLowerCase();
    return !settings.excludedIndustries.some((industry) => sector.includes(industry));
  });
}

// Symbols configured but disabled (e.g. ASX, pending a data-plan upgrade)
// are reported honestly instead of silently vanishing from the universe.
async function getUniverse(settings) {
  return requestedRows(settings).filter((item) => item.enabled !== false);
}

function getDisabledRows(settings) {
  return requestedRows(settings).filter((item) => item.enabled === false);
}

function setupType(row) {
  const reasoning = String(row.setup?.setupReasoning || "").toLowerCase();
  if (reasoning.includes("breakout")) return "Breakout";
  if (reasoning.includes("pullback")) return "Pullback";
  return "Developing";
}

function displayStatus(row) {
  if (row.status === "DATA UNAVAILABLE") return "Data Unavailable";
  if (row.opportunity?.overallStatus) return row.opportunity.overallStatus;
  if (!Number.isFinite(row.tradingScore) || row.tradingScore < 70) return "No Trade";
  if (!Number.isFinite(row.setup?.riskRewardRatio) || row.setup.riskRewardRatio < 2) return "Watch";
  if (row.tradingScore >= 82 && Number.isFinite(row.currentPrice) && Number.isFinite(row.setup?.plannedEntry)) {
    return row.currentPrice <= row.setup.plannedEntry ? "Buy Now" : "Wait for Entry";
  }
  return row.tradingScore >= 70 ? "Watch" : "No Trade";
}

function detectionReason(row) {
  if (row.status === "DATA UNAVAILABLE") return row.error || "Market data could not be loaded for this symbol.";
  if (row.opportunity?.reasonsFor?.length) return row.opportunity.reasonsFor.slice(0, 3).join(", ");
  if (!row.dataStatus?.readyForScore) return row.dataStatus?.status || row.error || "Waiting for scanner";
  return `${setupType(row)} detected with score ${row.tradingScore}, relative volume ${row.indicators?.relativeVolume ?? "--"}x and risk/reward ${row.setup?.riskRewardRatio ?? "--"}.`;
}

function isDataUnavailable(row) {
  return row.status === "DATA UNAVAILABLE" || row.dataQuality === "unavailable";
}

function passesFilters(row, settings) {
  return !isDataUnavailable(row) &&
    row.opportunity &&
    ["STRONG BUY", "BUY"].includes(row.opportunity.overallStatus) &&
    !row.opportunity.failedConditions?.length &&
    Number(row.opportunity.score) >= settings.minimumScore &&
    Number(row.volume) >= settings.minimumDailyVolume &&
    Number(row.opportunity.riskReward) >= settings.minimumRiskReward;
}

function rejectionReason(row, settings) {
  if (isDataUnavailable(row)) return row.error || "data unavailable";
  if (row.opportunity?.failedConditions?.length) return row.opportunity.failedConditions[0];
  if (!row.dataStatus?.readyForScore) return row.dataStatus?.status || row.error || "price data missing";
  if (!Number.isFinite(Number(row.currentPrice))) return "price data missing";
  if (!Number.isFinite(Number(row.tradingScore)) || Number(row.tradingScore) < settings.minimumScore) return "score too low";
  if (!Number.isFinite(Number(row.volume)) || Number(row.volume) < settings.minimumDailyVolume) return "volume too low";
  if (!Number.isFinite(Number(row.setup?.riskRewardRatio)) || Number(row.setup.riskRewardRatio) < settings.minimumRiskReward) return "risk/reward too low";
  if (!Number.isFinite(Number(row.indicators?.volatility20)) || Number(row.indicators.volatility20) > settings.maximumVolatility) return "volatility outside limits";
  if (!["Buy Now", "Wait for Entry"].includes(displayStatus(row))) return "entry not confirmed";
  return "approved";
}

function countByReason(rows, settings) {
  return rows.reduce((counts, row) => {
    const reason = rejectionReason(row, settings);
    if (reason !== "approved") counts[reason] = (counts[reason] || 0) + 1;
    return counts;
  }, {});
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const settings = cleanSettings(req.method === "POST" ? req.body : req.query);
  const scanStartedAt = new Date().toISOString();
  const universe = await getUniverse(settings);
  const disabledRows = getDisabledRows(settings);
  const offset = Math.max(0, Number(req.query.offset ?? req.body?.offset) || 0);
  const chunk = universe.slice(offset, offset + settings.chunkSize);
  const nextOffset = offset + settings.chunkSize >= universe.length ? 0 : offset + settings.chunkSize;

  // Split the chunk into "already cached" (skip the network entirely) and
  // "need fresh data" (one batched Twelve Data call covers all of them,
  // instead of one HTTP request per symbol).
  const toFetch = [];
  const analysed = [];
  const analysedBySymbol = new Map();
  for (const item of chunk) {
    const cached = cachedScannerResult(item.symbol);
    if (cached) {
      analysedBySymbol.set(item.symbol, cached);
    } else {
      toFetch.push(item.symbol);
    }
  }

  if (toFetch.length) {
    const snapshots = await getMarketSnapshotBatch(toFetch, { range: "1y", interval: "1day" });
    for (const symbol of toFetch) {
      try {
        const row = await analyseSymbol(symbol, snapshots.get(symbol));
        scannerCache.set(scannerCacheKey(symbol), { cachedAt: Date.now(), row });
        analysedBySymbol.set(symbol, row);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Scanner analysis failed";
        const row = { symbol, companyName: symbol, status: "DATA UNAVAILABLE", dataQuality: "unavailable", error: reason, dataStatus: { readyForScore: false, status: reason } };
        scannerCache.set(scannerCacheKey(symbol), { cachedAt: Date.now(), row });
        analysedBySymbol.set(symbol, row);
      }
    }
  }

  chunk.forEach((item) => {
    const row = analysedBySymbol.get(item.symbol);
    if (row) analysed.push(row);
  });

  const results = analysed
    .filter((row) => passesFilters(row, settings))
    .map((row) => ({
      symbol: row.symbol,
      companyName: row.companyName,
      exchange: row.exchange || (String(row.symbol).endsWith(".AX") ? "ASX" : "US"),
      currency: row.dataStatus?.currency || (String(row.symbol).endsWith(".AX") ? "AUD" : "USD"),
      currentPrice: row.currentPrice,
      dataQuality: row.dataQuality,
      priceTimestamp: row.dataStatus?.latestTimestamp || null,
      tradingScore: row.opportunity?.score ?? row.tradingScore,
      scoreBreakdown: row.opportunity?.scoreBreakdown || row.scoreExplanation,
      setupType: setupType(row),
      recommendedEntry: row.opportunity?.proposedEntryLow ?? row.setup?.plannedEntry,
      entryZoneHigh: row.opportunity?.proposedEntryHigh ?? row.setup?.plannedEntry,
      target: row.opportunity?.target1 ?? row.setup?.target,
      target2: row.opportunity?.target2 ?? null,
      stopLoss: row.opportunity?.stopLoss ?? row.setup?.stop,
      riskReward: row.opportunity?.riskReward ?? row.setup?.riskRewardRatio,
      confidence: row.opportunity?.confidenceScore ?? row.confidence,
      status: displayStatus(row),
      reason: detectionReason(row),
      rejectionReason: "approved",
      opportunity: row.opportunity,
      dataStatus: row.dataStatus,
      fibonacci: row.fibonacci,
      source: row,
    }))
    .sort((a, b) => b.tradingScore - a.tradingScore || b.riskReward - a.riskReward);

  const rejectionCounts = countByReason(analysed, settings);
  const scannedSymbols = chunk.map((item) => item.symbol);
  const supportedSymbols = universe.map((item) => item.symbol);
  const dataUnavailableRows = analysed.filter(isDataUnavailable);
  const successfullyAnalysedRows = analysed.filter((row) => !isDataUnavailable(row) && row.dataStatus?.readyForScore);
  const scanCompletedAt = new Date().toISOString();

  // A scan is "complete" only when every requested symbol ended up either
  // successfully analysed or explicitly marked unavailable -- never silent.
  const accountedFor = successfullyAnalysedRows.length + dataUnavailableRows.length
    + analysed.filter((row) => !isDataUnavailable(row) && !row.dataStatus?.readyForScore).length;
  const scanCompletionStatus = dataUnavailableRows.length === 0 && accountedFor === scannedSymbols.length
    ? "complete"
    : "incomplete-data";

  return res.status(200).json({
    ok: true,
    settings,
    universeCount: universe.length,
    scannedCount: chunk.length,
    scannedSymbols,
    supportedSymbols,
    scanSummary: {
      marketLabels: settings.markets,
      supportedUniverseCount: universe.length,
      supportedSymbols,
      scannedSymbols,
      // Honest, unambiguous counters (Stage 2): every requested symbol is
      // either successfully analysed, explicitly unavailable, or both
      // buckets sum to the requested count -- there is no silent dropout.
      universe: universe.length,
      requested: scannedSymbols.length,
      successfullyAnalysed: successfullyAnalysedRows.length,
      dataUnavailable: dataUnavailableRows.length,
      qualified: results.length,
      notQualified: successfullyAnalysedRows.length - results.length,
      scanCompletionStatus,
      symbolsRequested: scannedSymbols.length,
      symbolsSuccessfullyLoaded: successfullyAnalysedRows.length,
      symbolsRejectedMissingData: dataUnavailableRows.length,
      symbolsAnalysed: successfullyAnalysedRows.length,
      approvedOpportunities: results.length,
      rejectionCounts,
      dataUnavailableReasons: Array.from(new Set(dataUnavailableRows.map((row) => row.error).filter(Boolean))),
      disabledSymbols: disabledRows.map((item) => ({ symbol: item.symbol, companyName: item.companyName, reason: item.disabledReason })),
      scanStartedAt,
      scanCompletedAt,
      remainingSymbols: nextOffset === 0 ? 0 : Math.max(0, universe.length - nextOffset),
    },
    nextOffset,
    results,
    scannerStatus: analysed.map((row) => ({
      symbol: row.symbol,
      companyName: row.companyName,
      tradingScore: row.tradingScore,
      status: row.status,
      rejectionReason: rejectionReason(row, settings),
      dataStatus: row.dataStatus,
      error: row.error,
    })),
    updatedAt: new Date().toISOString(),
    schedule: ["before market open", "during trading session", "after market close"],
    error: null,
  });
}
