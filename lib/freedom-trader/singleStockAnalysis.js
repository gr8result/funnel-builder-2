import { calculateFreedomPositionSize, rankMarketOpportunities } from "./opportunityRanking.js";
import { resolveStockQueryFromRows } from "./marketUniverse.js";

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = numberValue(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

function plainDate(value) {
  if (!value) return null;
  const parsed = Date.parse(String(value).length <= 10 ? `${value}T21:00:00Z` : value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function marketDataStatusForAnalysis(analysis = {}) {
  const lastUpdated = plainDate(analysis?.dataStatus?.latestTimestamp || analysis?.marketData?.latestCandleDate || analysis?.signalResult?.marketDataTimestamp);
  if (analysis?.marketData?.validated === false || analysis?.dataStatus?.readyForScore === false || analysis?.error) {
    return { state: "unavailable", label: "Market data unavailable", lastUpdated, provider: analysis?.marketData?.historySource || analysis?.marketData?.quoteSource || "Twelve Data" };
  }
  if (
    analysis?.marketData?.delayed === true ||
    /delayed/i.test(`${analysis?.marketData?.status || ""} ${analysis?.marketData?.warnings?.join(" ") || ""}`) ||
    /twelve data/i.test(`${analysis?.marketData?.quoteSource || ""} ${analysis?.marketData?.historySource || ""}`)
  ) {
    return { state: "delayed", label: "Delayed 15 minutes", lastUpdated, provider: analysis?.marketData?.historySource || analysis?.marketData?.quoteSource || "Twelve Data" };
  }
  return { state: "current", label: "Current", lastUpdated, provider: analysis?.marketData?.historySource || analysis?.marketData?.quoteSource || "Twelve Data" };
}

function buildMonitorablePlan(source = {}, sizing = null) {
  const buyTrigger = round(source.recommendedEntry ?? source.entry ?? source.preferredBuy ?? source.setup?.plannedEntry);
  const safetyExit = round(source.safetyExit ?? source.stopLoss ?? source.stop ?? source.setup?.stop);
  const takeSomeProfit = round(source.takeSomeProfit ?? source.target ?? source.setup?.target);
  const finalExit = round(source.finalExit ?? source.target ?? source.setup?.target);
  const rewardToRisk = round(source.riskReward ?? source.riskRewardRatio ?? source.setup?.riskRewardRatio);
  return {
    company: source.companyName || source.company,
    companyName: source.companyName || source.company,
    symbol: source.symbol,
    exchange: source.exchange || source.marketData?.exchange || "NASDAQ",
    currency: source.currency || source.marketData?.currency || "USD",
    currentPrice: round(source.currentPrice),
    buyTrigger,
    safetyExit,
    takeSomeProfit,
    finalExit,
    rewardToRisk,
    status: "WATCH",
    reason: source.reason || source.setup?.setupReasoning || "Freedom is monitoring this setup.",
    marketDataTimestamp: source.marketData?.latestCandleDate || source.dataStatus?.latestTimestamp || null,
    positionSizing: sizing,
  };
}

export function buildSingleStockDecision({ analysis, ranking = null, account = {}, settings = {} } = {}) {
  const ranked = ranking?.bestCurrentTrade || ranking?.bestSetupToWatch || ranking?.results?.[0] || analysis || null;
  const readyPlan = ranking?.bestTradePlan || null;
  const basePlan = readyPlan || buildMonitorablePlan(ranked || analysis);
  const sizing = readyPlan?.positionSizing || calculateFreedomPositionSize(basePlan, account, settings);
  const tradePlan = readyPlan || { ...basePlan, positionSizing: sizing };
  const status = String(ranked?.status || analysis?.status || "").toUpperCase();
  const dataStatus = marketDataStatusForAnalysis(analysis);
  const hasValidPrices = [tradePlan.buyTrigger, tradePlan.safetyExit, tradePlan.takeSomeProfit, tradePlan.finalExit].every((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  const hasValidPlan = hasValidPrices && !tradePlan.validationErrors?.length && tradePlan.positionSizing?.errors?.length !== undefined;
  let action = "MONITOR";
  if (readyPlan?.cmcOrder && status === "READY" && dataStatus.state !== "unavailable") action = "BUY NOW";
  else if (dataStatus.state === "unavailable" || /SKIP|UNAVAILABLE|INFO|NO TRADE/.test(status) || !hasValidPrices) action = "AVOID";
  else if (/WAIT FOR PULLBACK|OVEREXTENDED|WAIT\b/.test(status)) action = "WAIT";
  else if (/REVERSAL DEVELOPING|WAIT FOR REVERSAL|DEVELOPING|WATCH/.test(status)) action = "MONITOR";

  const summary = action === "BUY NOW"
    ? "Freedom has a complete setup and the existing trade rules allow a manual buy order to be prepared."
    : action === "WAIT"
    ? "Freedom can analyse this stock, but the price is not in the preferred buying area right now."
    : action === "MONITOR"
    ? "Freedom can analyse this stock, but the setup needs more confirmation before buying."
    : "Freedom does not have enough valid setup data to suggest a trade.";
  const instruction = action === "BUY NOW"
    ? "BUY NOW - Review the manual order details before placing anything with your broker."
    : action === "WAIT"
    ? "WAIT - Do not place an order yet."
    : action === "MONITOR"
    ? "MONITOR - Watch for the entry trigger instead of buying now."
    : "AVOID - Do not trade this stock from the current setup.";
  const why = [
    ranked?.reason,
    analysis?.setup?.setupReasoning,
    dataStatus.label === "Current" ? "Market data is available for scoring." : `Market data status is ${dataStatus.label.toLowerCase()}.`,
  ].filter(Boolean);
  return {
    action,
    summary,
    instruction,
    why: Array.from(new Set(why)).slice(0, 5),
    status,
    canMonitor: ["WAIT", "MONITOR"].includes(action) && hasValidPrices && dataStatus.state !== "unavailable",
    canAddToWatchlist: Boolean(analysis?.symbol && analysis?.companyName && dataStatus.state !== "unavailable"),
    tradePlan: hasValidPrices ? tradePlan : null,
    marketDataStatus: dataStatus,
    sourceStatus: status,
    ranking: ranked,
  };
}

export { resolveStockQueryFromRows };
