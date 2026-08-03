import { cleanNumber } from "./paperTrading.js";

export const ASSISTANT_STATES = [
  "CHECKING MARKET",
  "MARKET UNAVAILABLE",
  "WAIT",
  "READY TO PREPARE",
  "MONITORING",
  "ACTION REQUIRED",
  "TRADE ACTIVE",
  "TAKE SOME PROFIT",
  "FINAL EXIT",
  "SAFETY EXIT",
  "NO ACTION",
];

export const DAILY_DASHBOARD_STATES = [
  "NOTHING",
  "PREPARE_ONE_TRADE",
  "BUY_NOW",
  "SELL_NOW",
];

const ACTIVE_WATCH_STATES = new Set(["WAITING_FOR_ENTRY", "ACTIVE", "PARTIAL_PROFIT"]);
const EXIT_ACTIONS = new Set(["TAKE SOME PROFIT", "FINAL EXIT", "SAFETY EXIT"]);

function text(value) {
  return String(value || "").trim();
}

function number(value) {
  if (value == null || value === "") return null;
  return cleanNumber(value);
}

function analysedCount(summary = {}) {
  return number(summary.analysedCount ?? summary.symbolsAnalysed ?? summary.symbolsSuccessfullyLoaded) || 0;
}

function qualifiedCount(summary = {}) {
  return number(summary.qualifiedCount ?? summary.qualifiedTrades ?? summary.readyCount) || 0;
}

function requestedCount(summary = {}) {
  return number(summary.requestedCount ?? summary.symbolsRequested ?? summary.checkedCount) || analysedCount(summary) || 0;
}

function scanCompleted(summary = {}) {
  return summary?.status === "complete" && analysedCount(summary) > 0;
}

function scanEnough(summary = {}) {
  return scanCompleted(summary) && analysedCount(summary) >= 1;
}

function activeAlerts(marketWatch = {}) {
  return (Array.isArray(marketWatch.alerts) ? marketWatch.alerts : [])
    .filter((alert) => !alert.acknowledgedAt && !alert.completedAt && !alert.dismissedAt);
}

function activePlans(marketWatch = {}) {
  return (Array.isArray(marketWatch.plans) ? marketWatch.plans : [])
    .filter((plan) => ACTIVE_WATCH_STATES.has(plan.state));
}

function matchingPlan(alert = {}, plans = []) {
  if (alert.planId) return plans.find((plan) => plan.id === alert.planId) || null;
  return plans.find((plan) => alert.symbol && plan.symbol === alert.symbol) || null;
}

function validPreparedTrade(recommendation = {}) {
  return Boolean(
    recommendation?.status === "READY TO BUY" &&
    text(recommendation.symbol) &&
    Number.isFinite(number(recommendation.entryBuyPrice ?? recommendation.buyPrice ?? recommendation.entryPrice)) &&
    Number.isFinite(number(recommendation.safetyExit)) &&
    Number.isFinite(number(recommendation.takeSomeProfit)) &&
    Math.floor(number(recommendation.suggestedQuantity ?? recommendation.quantity) || 0) >= 1
  );
}

function confidence(level, reasons = []) {
  return { level, reasons: reasons.filter(Boolean) };
}

function checkedSentence(summary = {}) {
  const checked = requestedCount(summary);
  const qualified = qualifiedCount(summary);
  if (checked > 0 && qualified === 1) return `I checked ${checked} companies. Only one currently meets your rules.`;
  if (checked > 0 && qualified > 1) return `I checked ${checked} companies. ${qualified} currently meet your rules, and this is the clearest one.`;
  if (checked > 0) return `I checked ${checked} companies. None currently meets your rules.`;
  return "I do not have a worthwhile trade to prepare right now.";
}

function invalidFallback(errors = []) {
  return {
    state: "WAIT",
    headline: "Waiting for market confirmation.",
    action: "WAIT",
    message: "No trade is currently ready.",
    confidence: confidence("LOW", ["Invalid action was rejected.", ...errors]),
    evidence: errors,
    rejected: true,
  };
}

export function validateAssistantRecommendation(decision = {}, context = {}) {
  const errors = [];
  const state = text(decision.state);
  if (!ASSISTANT_STATES.includes(state)) errors.push("Assistant state is not allowed.");
  const summary = context.scanSummary || context.report?.scanSummary || {};
  const marketWatch = context.marketWatch || {};
  const plans = activePlans(marketWatch);
  const monitoringRunning = marketWatch.service?.enabled === true;
  const alert = decision.alert || null;
  const action = text(decision.action);

  if (action === "BUY NOW") {
    const plan = matchingPlan(alert, plans);
    const entryPrice = number(plan?.entryPrice);
    const safetyExit = number(plan?.safetyExit);
    const takeSomeProfit = number(plan?.takeSomeProfit);
    const quantity = Math.floor(number(plan?.quantity) || 0);
    const currentPrice = number(alert?.currentPrice);
    if (!scanCompleted(summary)) errors.push("Market scan has not completed.");
    if (!scanEnough(summary)) errors.push("Not enough companies were analysed.");
    if (!text(alert?.symbol)) errors.push("BUY NOW requires a symbol.");
    if (!Number.isFinite(entryPrice)) errors.push("BUY NOW requires an entry price.");
    if (!Number.isFinite(safetyExit)) errors.push("BUY NOW requires a Safety Exit.");
    if (!Number.isFinite(takeSomeProfit)) errors.push("BUY NOW requires a Take Some Profit price.");
    if (quantity < 1) errors.push("BUY NOW requires at least one suggested share.");
    if (!monitoringRunning) errors.push("Monitoring is not running.");
    if (!plans.length) errors.push("No active watch plans exist.");
    if (!plan) errors.push("No active watch plan matches the BUY alert.");
    if (!Number.isFinite(currentPrice)) errors.push("BUY NOW requires a current price.");
    if (Number.isFinite(currentPrice) && Number.isFinite(entryPrice) && currentPrice > entryPrice) errors.push("Entry condition has not been reached.");
  }

  if (EXIT_ACTIONS.has(action)) {
    if (!text(alert?.symbol)) errors.push(`${action} requires a symbol.`);
    if (!Number.isFinite(number(alert?.currentPrice))) errors.push(`${action} requires a current price.`);
    if (!Number.isFinite(number(alert?.triggerPrice))) errors.push(`${action} requires a trigger price.`);
  }

  if (state === "ACTION REQUIRED" && action !== "BUY NOW" && !EXIT_ACTIONS.has(action)) {
    errors.push("ACTION REQUIRED must be tied to a supported trade action.");
  }

  return {
    valid: errors.length === 0,
    errors,
    confidence: errors.length ? confidence("LOW", errors) : decision.confidence || confidence("HIGH", decision.evidence || []),
  };
}

export function buildAssistantDecision({
  report = null,
  scanSummary = null,
  marketWatch = {},
  loading = false,
  scanMessage = "",
} = {}) {
  const summary = report?.scanSummary || scanSummary || {};
  const recommendations = Array.isArray(report?.recommendations) ? report.recommendations : [];
  const readyTrade = recommendations.find(validPreparedTrade);
  const alerts = activeAlerts(marketWatch);
  const plans = activePlans(marketWatch);
  const monitoringRunning = marketWatch.service?.enabled === true;
  const analysed = analysedCount(summary);
  const qualified = qualifiedCount(summary);

  if (loading) {
    return {
      state: "CHECKING MARKET",
      headline: "Checking Market",
      action: "WAIT",
      message: scanMessage || "Freedom is checking the market.",
      confidence: confidence("LOW", ["Market scan is still running."]),
      evidence: ["Market scan is still running."],
    };
  }

  if (summary.status === "partial") {
    return {
      state: "WAIT",
      headline: "Wait",
      action: "WAIT",
      message: "Freedom could only analyse part of the market. Do not recommend trades.",
      confidence: confidence("LOW", [`${analysed} companies analysed.`, "Scan was not complete."]),
      evidence: [`${analysed} companies analysed.`, "Scan was not complete."],
    };
  }

  if (!scanCompleted(summary)) {
    return {
      state: "MARKET UNAVAILABLE",
      headline: "Market Unavailable",
      action: "WAIT",
      message: "Waiting for market confirmation. No trade is currently ready.",
      confidence: confidence("LOW", ["Market scan has not completed."]),
      evidence: ["Market scan has not completed."],
    };
  }

  if (!scanEnough(summary)) {
    return {
      state: "WAIT",
      headline: "Wait",
      action: "WAIT",
      message: "Freedom could only analyse part of the market. Do not recommend trades.",
      confidence: confidence("LOW", [`${analysed} companies analysed.`, "Scan was not complete."]),
      evidence: [`${analysed} companies analysed.`, "Scan was not complete."],
    };
  }

  const validAlert = alerts.find((alert) => {
    const action = text(alert.action);
    if (action !== "BUY NOW" && !EXIT_ACTIONS.has(action)) return false;
    const decision = { state: action === "BUY NOW" ? "ACTION REQUIRED" : action, action, alert };
    return validateAssistantRecommendation(decision, { report, scanSummary: summary, marketWatch }).valid;
  });

  if (validAlert) {
    const action = text(validAlert.action);
    const isBuy = action === "BUY NOW";
    const state = isBuy ? "ACTION REQUIRED" : action;
    const evidence = [
      "Market scan complete.",
      `${analysed} analysed.`,
      `${qualified} qualified.`,
      `${action === "BUY NOW" ? "Entry reached." : `${action} trigger reached.`}`,
      `Current price ${validAlert.currentPrice}.`,
      `Triggered ${validAlert.createdAt || "now"}.`,
    ];
    const decision = {
      state,
      headline: isBuy ? "Action Required" : action,
      action,
      alert: validAlert,
      symbol: validAlert.symbol,
      companyName: validAlert.companyName || validAlert.symbol,
      currentPrice: number(validAlert.currentPrice),
      triggerPrice: number(validAlert.triggerPrice),
      message: validAlert.message || "Freedom has a validated trade action.",
      confidence: confidence("HIGH", ["Market scanned.", "Current price available.", "Trade validated.", "Entry or exit trigger reached."]),
      evidence,
    };
    const validation = validateAssistantRecommendation(decision, { report, scanSummary: summary, marketWatch });
    return validation.valid ? decision : invalidFallback(validation.errors);
  }

  if (readyTrade && !monitoringRunning) {
    return {
      state: "READY TO PREPARE",
      headline: "Prepare Trade",
      action: "READY TO PREPARE",
      recommendation: readyTrade,
      message: "Prepare the trade in CMC. Do not say BUY NOW until monitoring confirms entry.",
      confidence: confidence("HIGH", ["Market scanned.", "Trade validated.", "Risk acceptable.", "Monitoring is not running."]),
      evidence: ["Market scan complete.", `${analysed} analysed.`, `${qualified} qualified.`, "Valid trade plan exists.", "Monitoring is not running."],
    };
  }

  if (plans.length && monitoringRunning) {
    return {
      state: "MONITORING",
      headline: "Monitoring",
      action: "WAIT",
      message: "Monitoring active. No action required right now.",
      confidence: confidence("HIGH", ["Market scanned.", "Watch plans active.", "No trigger reached."]),
      evidence: ["Market scan complete.", `${plans.length} active watch plan${plans.length === 1 ? "" : "s"}.`, "No trigger reached."],
    };
  }

  if (readyTrade) {
    return {
      state: "READY TO PREPARE",
      headline: "Prepare Trade",
      action: "READY TO PREPARE",
      recommendation: readyTrade,
      message: "Prepare the trade in CMC. Start monitoring to receive trade alerts.",
      confidence: confidence("HIGH", ["Market scanned.", "Trade validated.", "Risk acceptable."]),
      evidence: ["Market scan complete.", `${analysed} analysed.`, "Valid trade plan exists."],
    };
  }

  return {
    state: "NO ACTION",
    headline: "No Action",
    action: "WAIT",
    message: "No qualified trade plans exist.",
    confidence: confidence("HIGH", ["Market scanned.", `${analysed} analysed.`, "No qualified trade plans exist."]),
    evidence: ["Market scan complete.", `${analysed} analysed.`, "No qualified trade plans exist."],
  };
}

export function buildDailyAssistantAnswer(decision = {}, context = {}) {
  const summary = context.scanSummary || context.report?.scanSummary || {};
  const state = text(decision.state);
  const action = text(decision.action);

  if (state === "ACTION REQUIRED" && action === "BUY NOW") {
    const company = decision.companyName || decision.symbol || "this trade";
    return {
      state: "BUY_NOW",
      label: "ACTION REQUIRED",
      headline: `Buy ${company} now.`,
      why: "The entry condition has been reached.",
      primaryInstruction: "Open CMC and enter the trade now.",
      symbol: decision.symbol,
      companyName: decision.companyName,
      currentPrice: decision.currentPrice,
      triggerPrice: decision.triggerPrice,
      currency: decision.alert?.currency || "USD",
    };
  }

  if (EXIT_ACTIONS.has(action)) {
    const takeProfit = action === "TAKE SOME PROFIT";
    const finalExit = action === "FINAL EXIT";
    return {
      state: "SELL_NOW",
      label: "ACTION REQUIRED",
      headline: takeProfit ? "Take Some Profit." : finalExit ? "Exit now." : "Safety Exit.",
      why: takeProfit ? "The first profit target has been reached." : finalExit ? "The final target has been reached." : "The Safety Exit has been reached.",
      primaryInstruction: takeProfit ? "Sell 50%. Move your Safety Exit." : "Sell the remaining shares.",
      symbol: decision.symbol,
      companyName: decision.companyName,
      currentPrice: decision.currentPrice,
      triggerPrice: decision.triggerPrice,
      currency: decision.alert?.currency || "USD",
    };
  }

  if (state === "READY TO PREPARE" && decision.recommendation) {
    const ready = decision.recommendation;
    return {
      state: "PREPARE_ONE_TRADE",
      label: "Prepare ONE trade.",
      headline: "Prepare ONE trade.",
      why: checkedSentence(summary),
      primaryInstruction: "Enter these orders into CMC.",
      recommendation: ready,
      symbol: ready.symbol,
      companyName: ready.companyName,
    };
  }

  return {
    state: "NOTHING",
    label: "Nothing today.",
    headline: "Nothing today.",
    why: checkedSentence(summary),
    primaryInstruction: "No worthwhile trades exist today. Enjoy your day. I'll keep watching.",
  };
}
