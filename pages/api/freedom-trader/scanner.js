import { analyseSymbol } from "./analysis.js";
import { getMarketSnapshotBatch } from "../../../lib/freedom-trader/marketDataService.js";
import { OPPORTUNITY_ENGINE_VERSION, runOpportunityEngine } from "../../../lib/freedom-trader/opportunityEngine.js";
import { buildFailedFreedomScanSummary, buildFreedomScanSummaryFromEngine } from "../../../lib/freedom-trader/scanSummary.js";

const DEFAULT_SETTINGS = {
  markets: ["US"],
  minimumScore: 82,
  minimumDailyVolume: 1000000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
  excludedIndustries: [],
  scanFrequency: "during-session",
  chunkSize: 30,
  maximumPlannedLossPerTrade: 75,
  maximumPositionValue: 1250,
  availableCash: 5000,
};

function cleanSettings(input = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    markets: Array.isArray(input.markets) && input.markets.length ? input.markets : DEFAULT_SETTINGS.markets,
    excludedIndustries: Array.isArray(input.excludedIndustries)
      ? input.excludedIndustries
      : String(input.excludedIndustries || "").split(",").map((item) => item.trim()).filter(Boolean),
    chunkSize: Math.max(1, Math.min(80, Number(input.chunkSize) || DEFAULT_SETTINGS.chunkSize)),
  };
}

function legacyScannerStatus(result) {
  return (result.decisions || []).map((item) => ({
    symbol: item.symbol,
    companyName: item.companyName,
    tradingScore: item.tradingScore,
    status: item.status,
    action: item.action,
    rejectionReason: item.status === "READY TO BUY" ? "approved" : item.couldNotAnalyseReason || item.reason,
    dataStatus: item.source?.dataStatus || null,
    error: item.couldNotAnalyseReason || null,
  }));
}

export function buildScanSummary(result) {
  const shared = buildFreedomScanSummaryFromEngine(result);
  const decisions = result.decisions || [];
  const couldAnalyse = decisions.filter((item) => item.couldAnalyse);
  const couldNotAnalyse = decisions.filter((item) => !item.couldAnalyse);
  const counts = result.summary?.counts || {};
  const rejectionCounts = decisions.reduce((output, item) => {
    if (item.status === "READY TO BUY") return output;
    const reason = item.couldNotAnalyseReason || item.reason || item.status;
    output[reason] = (output[reason] || 0) + 1;
    return output;
  }, {});

  return {
    ...shared,
    engineVersion: OPPORTUNITY_ENGINE_VERSION,
    marketLabels: result.settings.markets,
    supportedUniverseCount: result.supportedSymbols.length,
    supportedSymbols: result.supportedSymbols,
    scannedSymbols: result.scannedSymbols,
    universe: result.supportedSymbols.length,
    requested: result.scannedSymbols.length,
    successfullyAnalysed: couldAnalyse.length,
    couldNotAnalyse: couldNotAnalyse.length,
    dataUnavailable: counts["DATA UNAVAILABLE"] || 0,
    readyToBuy: counts["READY TO BUY"] || 0,
    developing: counts.DEVELOPING || 0,
    wait: counts.WAIT || 0,
    noAction: counts["NO ACTION"] || 0,
    qualified: counts["READY TO BUY"] || 0,
    notQualified: Math.max(0, couldAnalyse.length - (counts["READY TO BUY"] || 0)),
    scanCompletionStatus: shared.status === "partial" ? "incomplete-data" : shared.status,
    symbolsRequested: result.scannedSymbols.length,
    symbolsSuccessfullyLoaded: couldAnalyse.length,
    symbolsRejectedMissingData: couldNotAnalyse.length,
    symbolsAnalysed: couldAnalyse.length,
    approvedOpportunities: counts["READY TO BUY"] || 0,
    rejectionCounts,
    dataUnavailableReasons: Array.from(new Set(couldNotAnalyse.map((item) => item.couldNotAnalyseReason).filter(Boolean))),
    disabledSymbols: result.disabledSymbols,
    plainEnglish: shared.plainEnglish,
    opportunitySummary: result.summary?.plainEnglish || null,
    scanStartedAt: shared.startedAt,
    scanCompletedAt: shared.completedAt,
    remainingSymbols: result.nextOffset === 0 ? 0 : Math.max(0, result.supportedSymbols.length - result.nextOffset),
  };
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const body = req.method === "POST" ? req.body || {} : req.query || {};
    const offset = Math.max(0, Number(req.query.offset ?? body.offset) || 0);
    const engineResult = await runOpportunityEngine({
      settings: cleanSettings(body),
      offset,
      analyser: analyseSymbol,
      marketSnapshotBatch: getMarketSnapshotBatch,
    });
    const scanSummary = buildScanSummary(engineResult);

    return res.status(200).json({
      ok: true,
      engineVersion: engineResult.engineVersion,
      settings: engineResult.settings,
      universeCount: engineResult.supportedSymbols.length,
      scannedCount: engineResult.scannedSymbols.length,
      scannedSymbols: engineResult.scannedSymbols,
      supportedSymbols: engineResult.supportedSymbols,
      scanSummary,
      nextOffset: engineResult.nextOffset,
      results: engineResult.results,
      decisions: engineResult.decisions,
      topOpportunity: engineResult.topOpportunity,
      scannerStatus: legacyScannerStatus(engineResult),
      updatedAt: engineResult.scanCompletedAt,
      schedule: ["before market open", "during trading session", "after market close"],
      error: null,
    });
  } catch (error) {
    console.error("Freedom Trader Opportunity Engine scan failed:", error);
    const scanSummary = buildFailedFreedomScanSummary({ error: "Opportunity Engine could not complete the scan." });
    return res.status(500).json({
      ok: false,
      engineVersion: OPPORTUNITY_ENGINE_VERSION,
      scanSummary,
      results: [],
      decisions: [],
      error: "Opportunity Engine could not complete the scan.",
    });
  }
}
