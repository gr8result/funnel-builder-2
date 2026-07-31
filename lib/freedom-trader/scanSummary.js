export const SCAN_STALE_MS = 15 * 60 * 1000;

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function statusFor({ analysedCount, unavailableCount, requestedCount }) {
  if (requestedCount <= 0 || analysedCount <= 0) return "failed";
  if (unavailableCount > 0 || analysedCount < requestedCount) return "partial";
  return "complete";
}

export function buildFreedomScanSummaryFromEngine(result = {}) {
  const decisions = Array.isArray(result.decisions) ? result.decisions : [];
  const requestedSymbols = Array.isArray(result.scannedSymbols) && result.scannedSymbols.length
    ? result.scannedSymbols
    : Array.isArray(result.requestedSymbols) ? result.requestedSymbols : [];
  const requestedSet = new Set(requestedSymbols);
  const considered = decisions.filter((item) => !requestedSet.size || requestedSet.has(item.symbol));
  const analysed = considered.filter((item) => item.couldAnalyse);
  const unavailable = considered.filter((item) => !item.couldAnalyse);
  const qualified = analysed.filter((item) => item.status === "READY TO BUY");
  const requestedCount = requestedSymbols.length || considered.length;
  const analysedCount = analysed.length;
  const unavailableCount = Math.max(0, requestedCount - analysedCount);
  const qualifiedCount = qualified.length;
  const notQualifiedCount = Math.max(0, analysedCount - qualifiedCount);
  const completedAt = result.scanCompletedAt || new Date().toISOString();

  return {
    startedAt: result.scanStartedAt || completedAt,
    completedAt,
    universeCount: cleanNumber(result.supportedSymbols?.length, requestedCount),
    requestedCount,
    analysedCount,
    unavailableCount,
    qualifiedCount,
    notQualifiedCount,
    status: statusFor({ analysedCount, unavailableCount, requestedCount }),
    dataLabel: "Delayed by 15 minutes",
    results: decisions,
    rankedResults: Array.isArray(result.results) ? result.results : [],
    unavailableReasons: Array.from(new Set(unavailable.map((item) => item.couldNotAnalyseReason || item.reason).filter(Boolean))),
  };
}

export function buildFailedFreedomScanSummary({ startedAt = new Date().toISOString(), requestedCount = 0, universeCount = 0, error = "" } = {}) {
  return {
    startedAt,
    completedAt: new Date().toISOString(),
    universeCount,
    requestedCount,
    analysedCount: 0,
    unavailableCount: requestedCount,
    qualifiedCount: 0,
    notQualifiedCount: 0,
    status: "failed",
    dataLabel: "Unavailable",
    results: [],
    rankedResults: [],
    unavailableReasons: error ? [error] : [],
  };
}

export function isFreedomScanSummaryCurrent(summary, now = new Date()) {
  const completed = Date.parse(summary?.completedAt || "");
  return Number.isFinite(completed) && now.getTime() - completed <= SCAN_STALE_MS;
}

export function scanActionText(summary = {}) {
  summary = summary || {};
  if (summary.status === "failed" || !summary.analysedCount) {
    return {
      heading: "Freedom could not analyse the market.",
      body: "Current market data is unavailable.\nDo not place a new trade from this report.",
      bestAction: "Do not place a new trade from this report.",
    };
  }
  if (summary.status === "partial") {
    return {
      heading: "Freedom could only analyse part of the market.",
      body: `Freedom could only analyse part of the market.\n${summary.analysedCount} companies were analysed.\n${summary.unavailableCount} could not be checked because market data was unavailable.\n\nNo reliable trade recommendation is available yet.`,
      bestAction: "Wait until market data is available.",
    };
  }
  if (!summary.qualifiedCount) {
    return {
      heading: "No suitable trade is ready now.",
      body: `Freedom successfully analysed ${summary.analysedCount} companies.\nNone currently meets the entry and risk rules.\n\nYour best action:\nDo nothing and wait.`,
      bestAction: "Do nothing and wait.",
    };
  }
  return {
    heading: `${summary.qualifiedCount} trade${summary.qualifiedCount === 1 ? " is" : "s are"} ready.`,
    body: `${summary.analysedCount} companies were analysed.\n${summary.qualifiedCount} trade${summary.qualifiedCount === 1 ? " is" : "s are"} ready now.`,
    bestAction: "Prepare the best qualified CMC order.",
  };
}
