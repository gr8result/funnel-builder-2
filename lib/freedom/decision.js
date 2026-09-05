/**
 * Freedom decision vocabulary.
 *
 * The ranking engine in lib/freedom-trader/opportunityRanking.js produces detailed
 * internal statuses (READY, REVERSAL DEVELOPING, WAIT FOR PULLBACK, ...). The rebuilt
 * Freedom pages show one of five unmistakable actions instead. This module is the only
 * place that translation happens, so the pages and the API cannot drift apart.
 */

export const FREEDOM_ACTIONS = ["BUY", "WAIT", "WATCH", "AVOID", "UNAVAILABLE"];

export const FREEDOM_ACTION_COLOURS = {
  BUY: { tone: "green", hex: "#18a058", label: "BUY" },
  WAIT: { tone: "blue", hex: "#0057d9", label: "WAIT" },
  WATCH: { tone: "amber", hex: "#c77700", label: "WATCH" },
  AVOID: { tone: "red", hex: "#c62828", label: "AVOID" },
  UNAVAILABLE: { tone: "grey", hex: "#6b7780", label: "NO DATA" },
};

const MARKET_ORDER = { ASX: 0, US: 1 };

const STATUS_TO_ACTION = {
  READY: "BUY",
  "WAIT FOR PULLBACK": "WAIT",
  "REVERSAL DEVELOPING": "WATCH",
  "WAIT FOR REVERSAL": "WATCH",
  OVEREXTENDED: "AVOID",
  SKIP: "AVOID",
  "DATA UNAVAILABLE": "UNAVAILABLE",
};

const ACTION_RANK = { BUY: 0, WAIT: 1, WATCH: 2, AVOID: 3, UNAVAILABLE: 4 };

const ACTION_HEADLINE = {
  BUY: "Entry condition reached - review the chart before buying.",
  WAIT: "Wait - the setup is valid but the price is not at the buy trigger yet.",
  WATCH: "Watch - the setup needs more confirmation before it becomes a trade.",
  AVOID: "Avoid - this does not meet the trading rules right now.",
  UNAVAILABLE: "No reliable market data - Freedom will not guess.",
};

const OPPORTUNITY_SECTION_ORDER = {
  buyNow: 0,
  readyAtMarketOpen: 1,
  waitingForBuyTrigger: 2,
  closestOpportunities: 3,
};

function numberValue(value) {
  // Number(null) and Number("") are 0; treating those as real prices would let an
  // incomplete plan look priced. Reject them before the finite check.
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = numberValue(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

function uniquePrices(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    const number = numberValue(value);
    if (number === null || number <= 0) return false;
    const key = number.toFixed(4);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Map an internal ranking status onto the five-action vocabulary. */
export function actionForStatus(status) {
  const key = String(status || "").trim().toUpperCase();
  return STATUS_TO_ACTION[key] || "UNAVAILABLE";
}

/**
 * The buy trigger band a user should buy inside. Freedom's plan carries a single preferred
 * trigger; the band is that trigger plus the tolerance the ranking engine already allows
 * before it calls a setup OVEREXTENDED.
 */
export function entryRangeFor(row = {}, tolerancePercent = 0.75) {
  const entry = numberValue(row.recommendedEntry ?? row.entry ?? row.preferredBuy);
  if (entry === null || entry <= 0) return null;
  const low = round(entry * (1 - 2.5 / 100));
  const high = round(entry * (1 + tolerancePercent / 100));
  return { low, high, preferred: round(entry) };
}

export function triggerDistanceFor(currentPrice, entryRange) {
  const current = numberValue(currentPrice);
  const low = numberValue(entryRange?.low);
  const high = numberValue(entryRange?.high);
  if (current === null || low === null || high === null || current <= 0) {
    return { state: "unknown", dollars: null, percent: null, boundary: null };
  }
  if (current < low) {
    const dollars = round(low - current);
    return { state: "below", dollars, percent: round((dollars / current) * 100, 2), boundary: low };
  }
  if (current <= high) {
    return { state: "inside", dollars: 0, percent: 0, boundary: null };
  }
  const dollars = round(current - high);
  return { state: "above", dollars, percent: round((dollars / current) * 100, 2), boundary: high };
}

function setupExpired(row = {}) {
  const expiry = Date.parse(row.setup?.setupExpiryDate || row.setupExpiryDate || row.source?.setup?.setupExpiryDate || "");
  return Number.isFinite(expiry) && expiry < Date.now();
}

export function triggerStatusFor(row = {}, action = null, entryRange = null, currentPrice = null) {
  const status = String(row.status || row.detail?.internalStatus || "").toUpperCase();
  const distance = triggerDistanceFor(currentPrice ?? row.currentPrice, entryRange ?? row.entryRange);
  if (distance.state === "below") {
    return {
      state: "WAITING",
      label: "Currently waiting",
      howToRead: "Wait for the price to rise to the buy trigger.",
      tradeButton: "Add to Watchlist",
      canConfirmPurchase: false,
      distance,
    };
  }
  if (distance.state === "inside") {
    const ready = action === "BUY" || status === "READY";
    return {
      state: ready ? "TRIGGERED" : "REVIEW",
      label: ready ? "Triggered" : "Entry condition reached",
      howToRead: "Entry condition reachedâ€”review the chart before buying.",
      tradeButton: ready ? "Confirm Purchase" : "Add to Watchlist",
      canConfirmPurchase: ready,
      distance,
    };
  }
  if (distance.state === "above") {
    if (setupExpired(row)) {
      return {
        state: "EXPIRED",
        label: "Setup expired",
        howToRead: "Setup expired",
        tradeButton: "Add to Watchlist",
        canConfirmPurchase: false,
        distance,
      };
    }
    if (status === "READY" || action === "BUY") {
      return {
        state: "TRIGGERED",
        label: "Triggered",
        howToRead: "Triggered",
        tradeButton: "Confirm Purchase",
        canConfirmPurchase: true,
        distance,
      };
    }
    return {
      state: "MISSED",
      label: "Entry missed",
      howToRead: "Entry missedâ€”do not chase",
      tradeButton: "Add to Watchlist",
      canConfirmPurchase: false,
      distance,
    };
  }
  return {
    state: "UNKNOWN",
    label: "No validated trigger status",
    howToRead: "No reliable market dataâ€”do not buy from this setup.",
    tradeButton: "Add to Watchlist",
    canConfirmPurchase: false,
    distance,
  };
}

function chartIsValidated(row = {}) {
  if (row.marketData?.validated === false || row.dataStatus?.readyForScore === false) return false;
  const candles = numberValue(row.candleCount ?? row.dataStatus?.actualCandleCount);
  return candles === null || candles >= 20;
}

function calculationLines(row = {}, entryRange = null, targets = []) {
  const entry = numberValue(row.recommendedEntry ?? row.entry ?? row.preferredBuy);
  const current = numberValue(row.currentPrice);
  const safety = numberValue(row.safetyExit ?? row.stopLoss);
  const pullbackLow = numberValue(row.pullbackLow ?? row.setupClassification?.pullbackLow);
  const risk = entry !== null && safety !== null ? round(entry - safety) : null;
  const triggerDistance = triggerDistanceFor(current, entryRange);
  return [
    entryRange ? `Buy Trigger = preferred reversal confirmation ${round(entry)} with allowed range ${round(entryRange.low)} to ${round(entryRange.high)}.` : null,
    triggerDistance.state === "below" ? `Distance to trigger = ${round(entryRange.low)} - ${round(current)} = ${triggerDistance.dollars} (${triggerDistance.percent}%).` : null,
    triggerDistance.state === "inside" ? "Distance to trigger = current price is inside the buy trigger range." : null,
    triggerDistance.state === "above" ? `Distance above trigger = ${round(current)} - ${round(entryRange.high)} = ${triggerDistance.dollars} (${triggerDistance.percent}%).` : null,
    safety !== null && risk !== null ? `Safety Exit = ${round(safety)}, creating planned risk of ${risk} per share from the preferred trigger.` : null,
    targets[0] !== undefined && entry !== null ? `Target 1 = ${round(targets[0])}, potential move of ${round(targets[0] - entry)} per share from the preferred trigger.` : null,
    targets[1] !== undefined && entry !== null ? `Final target = ${round(targets[1])}, potential move of ${round(targets[1] - entry)} per share from the preferred trigger.` : null,
    targets.length === 1 && pullbackLow !== null ? "Only one distinct target is available from the strategy output, so Freedom shows one target instead of duplicating it." : null,
  ].filter(Boolean);
}

/**
 * Reject anything the ranking engine could not price properly. A row without a complete,
 * internally consistent plan is never shown as a tradable opportunity.
 */
export function planIsComplete(row = {}) {
  const entry = numberValue(row.recommendedEntry ?? row.entry);
  const safetyExit = numberValue(row.safetyExit ?? row.stopLoss);
  const takeSome = numberValue(row.takeSomeProfit ?? row.target);
  const finalExit = numberValue(row.finalExit ?? row.target);
  if ([entry, safetyExit, takeSome, finalExit].some((value) => value === null || value <= 0)) return false;
  if (safetyExit >= entry) return false;
  if (takeSome <= entry) return false;
  if (finalExit < takeSome) return false;
  return true;
}

function timestampFor(row = {}) {
  return (
    row.marketData?.latestCandleDate ||
    row.dataStatus?.latestTimestamp ||
    row.source?.marketData?.latestCandleDate ||
    row.source?.dataStatus?.latestTimestamp ||
    null
  );
}

function priceSessionFor(row = {}) {
  if (row.priceSession) return row.priceSession;
  if (row.marketStatus && row.marketStatus !== "OPEN") return "Last regular-session price";
  if (row.marketData?.quoteDelayed === false) return "Live regular-session price";
  return "Delayed regular-session price";
}

function quoteModeFor(row = {}) {
  if (row.quoteMode) return row.quoteMode;
  if (row.marketStatus && row.marketStatus !== "OPEN") return "previous close";
  if (row.marketData?.quoteDelayed === false) return "live";
  return "delayed";
}

/**
 * Convert one ranked row into the flat shape the Today's Opportunities page renders.
 * Everything the page needs is computed here; the page performs no trading maths.
 */
export function toOpportunity(row = {}) {
  const status = String(row.status || "").toUpperCase();
  let action = actionForStatus(status);
  const complete = planIsComplete(row);
  // A BUY or WAIT must always carry a complete, valid plan. Anything else is downgraded
  // rather than shown with missing numbers.
  if (!complete && action !== "UNAVAILABLE") action = status === "DATA UNAVAILABLE" ? "UNAVAILABLE" : "AVOID";

  const entryRange = entryRangeFor(row);
  const currentPrice = round(row.currentPrice);
  const safetyExit = round(row.safetyExit ?? row.stopLoss);
  const takeSomeProfit = round(row.takeSomeProfit ?? row.target);
  const finalExit = round(row.finalExit ?? null);
  const riskReward = round(row.riskReward);
  const targets = uniquePrices([takeSomeProfit, finalExit]);
  const triggerStatus = triggerStatusFor(row, action, entryRange, currentPrice);
  const chartValidated = chartIsValidated(row);
  if (!chartValidated && action === "BUY") action = "UNAVAILABLE";
  const calculations = calculationLines(row, entryRange, targets);
  const preferredEntry = round(entryRange?.preferred);
  const bestTarget = targets.length ? targets[targets.length - 1] : null;
  const potentialProfitPercent = preferredEntry && bestTarget ? round(((bestTarget - preferredEntry) / preferredEntry) * 100, 2) : null;
  const maximumPlannedLossPercent = preferredEntry && safetyExit ? round(((preferredEntry - safetyExit) / preferredEntry) * 100, 2) : null;
  const isMarketOpen = String(row.marketStatus || "").toUpperCase() === "OPEN";
  const opportunityType = action === "BUY"
    ? (isMarketOpen ? "BUY NOW" : "READY AT MARKET OPEN")
    : ["WAIT", "WATCH"].includes(action)
    ? "WAITING FOR BUY TRIGGER"
    : "CLOSEST OPPORTUNITY";
  const primaryInstruction = action === "BUY"
    ? isMarketOpen
      ? "BUY NOW within the displayed range"
      : "READY AT MARKET OPEN after price revalidation"
    : entryRange
    ? "DO NOT BUY YET - wait for the displayed trigger"
    : "DO NOT BUY YET";

  return {
    symbol: row.symbol || null,
    companyName: row.companyName || row.company || null,
    exchange: row.exchange || null,
    currency: row.currency || "USD",
    market: row.market || (row.currency === "AUD" ? "ASX" : "US"),
    marketStatus: row.marketStatus || null,
    marketLocalTime: row.marketLocalTime || null,
    userLocalTime: row.userLocalTime || null,
    priceSession: priceSessionFor(row),
    quoteMode: quoteModeFor(row),
    dataSource: row.dataSource || row.provider || row.marketData?.historySource || row.source?.provider || null,
    action,
    opportunityType,
    primaryInstruction,
    actionHeadline: ACTION_HEADLINE[action],
    colour: FREEDOM_ACTION_COLOURS[action].tone,
    currentPrice,
    entryRange,
    safetyExit,
    takeSomeProfit,
    finalExit,
    targets,
    triggerStatus: {
      ...triggerStatus,
      canConfirmPurchase: triggerStatus.canConfirmPurchase && chartValidated,
      tradeButton: triggerStatus.canConfirmPurchase && chartValidated ? "Confirm Purchase" : "Add to Watchlist",
    },
    chartValidated,
    riskReward,
    riskRewardLabel: riskReward === null ? null : riskReward + ":1",
    potentialProfitPercent,
    maximumPlannedLossPercent,
    timeframe: row.timeframe || "Short term (days to weeks)",
    dataTimestamp: timestampFor(row),
    volatility: row.volatility || null,
    importedRating: row.importedRating || row.cmcImport?.importedRating || null,
    importedValuation: row.importedValuation || row.cmcImport?.importedValuation || null,
    cmcComparison: row.cmcComparison || null,
    reason: row.reason || "Freedom has no plain-English reason for this result.",
    // Everything below sits behind "Why this result?" on the page.
    detail: {
      internalStatus: status,
      setupType: row.setupType || row.primarySetupType || null,
      reversalState: row.reversalState || null,
      tradingScore: row.tradingScore ?? null,
      opportunityScore: row.opportunityScore ?? null,
      confidence: row.confidence ?? null,
      capitalFlowScore: row.capitalFlowScore ?? null,
      capitalFlowState: row.capitalFlowState ?? null,
      buyingSellingPressure: row.buyingSellingPressure ?? null,
      relativeVolume: row.relativeVolume ?? null,
      volatility: row.volatility || null,
      pullbackPercent: row.pullbackPercent ?? null,
      pullbackLow: row.pullbackLow ?? null,
      recentHigh: row.recentHigh ?? null,
      entryDistancePercent: row.entryDistancePercent ?? null,
      plainEnglish: Array.isArray(row.plainEnglish) ? row.plainEnglish.filter(Boolean) : [],
      eligibilityReasons: Array.isArray(row.eligibilityReasons) ? row.eligibilityReasons : [],
      whyRankedFirst: Array.isArray(row.whyRankedFirst) ? row.whyRankedFirst : [],
      calculations,
      setupExpiryDate: row.setup?.setupExpiryDate || row.setupExpiryDate || row.source?.setup?.setupExpiryDate || null,
      planComplete: complete,
    },
  };
}

function closestMissingCondition(item = {}) {
  const reasons = Array.isArray(item.detail?.eligibilityReasons) ? item.detail.eligibilityReasons.filter(Boolean) : [];
  if (reasons.length === 1) return reasons[0];
  if (reasons.length > 1) return reasons[0];
  if (item.triggerStatus?.distance?.state === "below") return "Price has not reached the buy trigger.";
  return "Final entry confirmation is not complete.";
}

function sectionedOpportunities(mapped = [], limit = 12) {
  const actionable = mapped.filter((item) => ["BUY", "WAIT", "WATCH"].includes(item.action) && item.detail?.planComplete);
  const buyNow = actionable.filter((item) => item.action === "BUY" && String(item.marketStatus || "").toUpperCase() === "OPEN");
  const readyAtMarketOpen = actionable.filter((item) => item.action === "BUY" && String(item.marketStatus || "").toUpperCase() !== "OPEN");
  const waitingForBuyTrigger = actionable.filter((item) => ["WAIT", "WATCH"].includes(item.action) && item.triggerStatus?.distance?.state === "below");
  const used = new Set([...buyNow, ...readyAtMarketOpen, ...waitingForBuyTrigger].map((item) => `${item.market}:${item.symbol}`));
  const closestOpportunities = mapped
    .filter((item) => !used.has(`${item.market}:${item.symbol}`))
    .filter((item) => item.action !== "UNAVAILABLE" && item.detail?.planComplete)
    .map((item) => ({ ...item, action: "WATCH", opportunityType: "CLOSEST OPPORTUNITY", missingCondition: closestMissingCondition(item) }))
    .sort((a, b) => (Number(b.detail?.opportunityScore) || 0) - (Number(a.detail?.opportunityScore) || 0))
    .slice(0, 10);

  const sections = {
    buyNow: buyNow.slice(0, limit),
    readyAtMarketOpen: readyAtMarketOpen.slice(0, limit),
    waitingForBuyTrigger: waitingForBuyTrigger.slice(0, limit),
    closestOpportunities,
  };

  const flat = Object.entries(sections)
    .sort(([a], [b]) => OPPORTUNITY_SECTION_ORDER[a] - OPPORTUNITY_SECTION_ORDER[b])
    .flatMap(([, rows]) => rows)
    .slice(0, Math.max(limit, 10));

  return { sections, flat };
}

function summaryFor(summary = {}, scan = {}) {
  return {
    status: summary.status || null,
    universeCount: summary.configuredUniverseCount ?? scan.universeCount ?? null,
    universeSize: summary.universeSize ?? summary.expectedUniverseSize ?? null,
    expectedUniverseSize: summary.expectedUniverseSize ?? summary.candidateUniverse ?? null,
    selectedUniverse: summary.selectedUniverse || null,
    universeDefinition: summary.universeDefinition || null,
    liquidityCriteria: summary.liquidityCriteria || null,
    companiesChecked: summary.companiesChecked ?? null,
    selected: summary.selected ?? null,
    attempted: summary.attempted ?? summary.requestedCount ?? summary.requested ?? null,
    detailedAttempted: summary.detailedAttempted ?? null,
    resolved: summary.resolved ?? null,
    marketDataLoaded: summary.ohlcvLoaded ?? summary.broadScreenEligible ?? null,
    ohlcvLoaded: summary.ohlcvLoaded ?? null,
    successfullyLoaded: summary.successfullyLoaded ?? summary.ohlcvLoaded ?? null,
    fullyAnalysed: summary.fullyAnalysed ?? summary.successfullyAnalysed ?? null,
    rejected: summary.rejected ?? null,
    failed: summary.failed ?? null,
    successfullyAnalysed: summary.successfullyAnalysed ?? null,
    rejectedByStrategy: summary.rejected ?? summary.notQualified ?? null,
    invalidTicker: summary.invalidTicker ?? 0,
    providerFailures: summary.providerFailures ?? null,
    rateLimited: summary.rateLimited ?? (summary.providerBudgetExhausted ? 1 : 0),
    completedPercentage: summary.completedPercentage ?? null,
    unavailable: summary.unavailable ?? null,
    dataProvider: summary.dataProvider || "Alpaca",
    feed: summary.feed || null,
    market: summary.market || "US",
    scanStartedAt: summary.scanStartedAt || null,
    scanCompletedAt: summary.scanCompletedAt || scan.updatedAt || null,
    restoredFromLastGoodScan: Boolean(scan.fromLastGoodScan),
    fromScanCache: Boolean(scan.fromScanCache),
    marketSelection: summary.marketSelection || scan.settings?.marketSelection || null,
    requestedMarkets: summary.requestedMarkets || scan.settings?.markets || null,
    sessions: summary.sessions || null,
    rejectedSecurities: summary.rejectedSecurities || [],
    unavailableSymbols: summary.unavailableSymbols || [],
    providerBudgetExhausted: Boolean(summary.providerBudgetExhausted),
    providerBudgetExhaustedReason: summary.providerBudgetExhaustedReason || null,
    providerDiagnostics: summary.providerDiagnostics || null,
    terminalOutcomes: summary.terminalOutcomes || null,
    perSymbolDiagnostics: summary.perSymbolDiagnostics || [],
  };
}

function groupByMarket(opportunities = []) {
  return {
    ASX: opportunities.filter((item) => item.market === "ASX"),
    US: opportunities.filter((item) => item.market === "US"),
  };
}

/**
 * Build the payload for Today's Opportunities.
 *
 * Distinguishes the two outcomes the user must never confuse:
 *   outcome "market-data-failure" - Freedom could not read the market.
 *   outcome "no-qualifying-trades" - Freedom read the market fine and found nothing.
 */
export function buildOpportunitiesPayload(scan = {}, options = {}) {
  const limit = Math.max(1, Number(options.limit) || 12);
  const summary = scan.scanSummary || {};
  const rows = Array.isArray(scan.decisions) ? scan.decisions : [];

  if (scan.ok === false || summary.status === "failed" || summary.status === "blocked") {
    return {
      ok: false,
      outcome: summary.status === "blocked" ? "scan-incomplete" : "market-data-failure",
      headline: summary.status === "blocked" ? "SCAN INCOMPLETE—NO MARKET CONCLUSION AVAILABLE" : "Market data failure",
      message: summary.message || scan.error || "Freedom could not obtain reliable market data. No results are shown.",
      opportunities: [],
      counts: { buy: 0, wait: 0, watch: 0, avoid: 0, unavailable: 0 },
      scan: summaryFor(summary, scan),
    };
  }

  const mapped = rows.map(toOpportunity);
  const counts = {
    buy: mapped.filter((item) => item.action === "BUY").length,
    wait: mapped.filter((item) => item.action === "WAIT").length,
    watch: mapped.filter((item) => item.action === "WATCH").length,
    avoid: mapped.filter((item) => item.action === "AVOID").length,
    unavailable: mapped.filter((item) => item.action === "UNAVAILABLE").length,
  };

  const sorted = mapped.sort((a, b) => {
    const marketDelta = (MARKET_ORDER[a.market] ?? 99) - (MARKET_ORDER[b.market] ?? 99);
    if (marketDelta) return marketDelta;
    const delta = ACTION_RANK[a.action] - ACTION_RANK[b.action];
    if (delta) return delta;
    return (Number(b.detail.tradingScore) || 0) - (Number(a.detail.tradingScore) || 0);
  });
  const { sections, flat: shown } = sectionedOpportunities(sorted, limit);
  const diagnostics = {
    rejected: sorted.filter((item) => ["AVOID", "UNAVAILABLE"].includes(item.action)).map((item) => ({
      symbol: item.symbol,
      companyName: item.companyName,
      market: item.market,
      internalStatus: item.detail?.internalStatus || null,
      reason: closestMissingCondition(item),
    })),
    counts,
  };

  if (!shown.length && summary.status !== "complete") {
    return {
      ok: false,
      outcome: "scan-incomplete",
      headline: "SCAN INCOMPLETE—NO MARKET CONCLUSION AVAILABLE",
      message: summary.message || "Freedom did not complete the selected universe, so it cannot conclude that no qualifying trades exist.",
      opportunities: [],
      sections,
      opportunitiesByMarket: { ASX: [], US: [] },
      counts,
      diagnostics,
      scan: summaryFor(summary, scan),
    };
  }

  if (!shown.length) {
    const tail = summary.message ? " " + summary.message : "";
    return {
      ok: true,
      outcome: "no-qualifying-trades",
      headline: "No qualifying trades today",
      message: "Freedom checked the market successfully and found no setup that meets the rules." + tail,
      opportunities: [],
      sections,
      opportunitiesByMarket: { ASX: [], US: [] },
      counts,
      diagnostics,
      scan: summaryFor(summary, scan),
    };
  }

  return {
    ok: true,
    outcome: "opportunities",
    headline: shown.length + " opportunit" + (shown.length === 1 ? "y" : "ies") + " found",
    message: summary.message || "",
    opportunities: shown,
    sections,
    opportunitiesByMarket: groupByMarket(shown),
    counts,
    diagnostics,
    scan: summaryFor(summary, scan),
  };
}
