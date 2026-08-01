import { cleanNumber, roundMoney } from "./paperTrading.js";

export const WATCH_ACTIONS = ["WAIT", "BUY NOW", "TAKE SOME PROFIT", "FINAL EXIT", "SAFETY EXIT", "CANCEL SETUP"];
export const WATCH_STATES = ["WAITING_FOR_ENTRY", "ACTIVE", "PARTIAL_PROFIT", "COMPLETED", "STOPPED", "CANCELLED", "EXPIRED"];

export const DEFAULT_MARKET_WATCH_SETTINGS = {
  intervalSeconds: 60,
  maximumAlerts: 50,
  enableBuyAlerts: true,
  enableSellAlerts: true,
  enableStopAlerts: true,
  enableCancelAlerts: true,
  takeSomeProfitPercent: 50,
  minimumConfidence: 55,
  setupExpiryHours: 96,
};

export const MARKET_WATCH_INTERVAL_OPTIONS = [30, 60, 120, 300, 600];

function id(prefix, now = new Date()) {
  return `${prefix}_${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`;
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function text(value) {
  return String(value || "").trim();
}

function dateMs(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value) {
  return roundMoney(value);
}

function actionEnabled(action, settings = DEFAULT_MARKET_WATCH_SETTINGS) {
  if (action === "BUY NOW") return settings.enableBuyAlerts !== false;
  if (action === "TAKE SOME PROFIT" || action === "FINAL EXIT") return settings.enableSellAlerts !== false;
  if (action === "SAFETY EXIT") return settings.enableStopAlerts !== false;
  if (action === "CANCEL SETUP") return settings.enableCancelAlerts !== false;
  return false;
}

export function normalizeMarketWatchSettings(input = {}) {
  const rawInterval = Math.floor(cleanNumber(input.intervalSeconds ?? input.monitoringIntervalSeconds) || DEFAULT_MARKET_WATCH_SETTINGS.intervalSeconds);
  const intervalSeconds = MARKET_WATCH_INTERVAL_OPTIONS.includes(rawInterval) ? rawInterval : DEFAULT_MARKET_WATCH_SETTINGS.intervalSeconds;
  const maximumAlerts = Math.max(1, Math.min(250, Math.floor(cleanNumber(input.maximumAlerts) || DEFAULT_MARKET_WATCH_SETTINGS.maximumAlerts)));
  const takeSomeProfitPercent = Math.max(0, Math.min(100, cleanNumber(input.takeSomeProfitPercent) ?? DEFAULT_MARKET_WATCH_SETTINGS.takeSomeProfitPercent));
  return {
    ...DEFAULT_MARKET_WATCH_SETTINGS,
    ...input,
    intervalSeconds,
    maximumAlerts,
    takeSomeProfitPercent,
    minimumConfidence: cleanNumber(input.minimumConfidence) ?? DEFAULT_MARKET_WATCH_SETTINGS.minimumConfidence,
    setupExpiryHours: cleanNumber(input.setupExpiryHours) ?? DEFAULT_MARKET_WATCH_SETTINGS.setupExpiryHours,
    enableBuyAlerts: input.enableBuyAlerts !== false,
    enableSellAlerts: input.enableSellAlerts !== false,
    enableStopAlerts: input.enableStopAlerts !== false,
    enableCancelAlerts: input.enableCancelAlerts !== false,
  };
}

export function normalizeTradePlan(input = {}, settings = DEFAULT_MARKET_WATCH_SETTINGS, now = new Date()) {
  const symbol = upper(input.symbol || input.ticker);
  const createdAt = input.createdAt || input.created_at || now.toISOString();
  const expiryMs = cleanNumber(input.expiryMs);
  const expiresAt = input.expiresAt || input.expires_at || (Number.isFinite(expiryMs)
    ? new Date(now.getTime() + expiryMs).toISOString()
    : new Date(dateMs(createdAt) + (settings.setupExpiryHours * 3600000)).toISOString());
  return {
    id: input.id || id("watch", now),
    userId: input.userId || input.user_id || "freedom-development-user",
    symbol,
    companyName: text(input.companyName || input.company || input.name || symbol),
    currency: upper(input.currency) || "USD",
    state: WATCH_STATES.includes(input.state) ? input.state : "WAITING_FOR_ENTRY",
    entryPrice: cleanNumber(input.entryPrice ?? input.entryBuyPrice ?? input.buyPrice ?? input.recommendedEntry),
    safetyExit: cleanNumber(input.safetyExit ?? input.stopLoss ?? input.stop),
    takeSomeProfit: cleanNumber(input.takeSomeProfit ?? input.target ?? input.target1),
    finalExit: cleanNumber(input.finalExit ?? input.target2),
    quantity: Math.max(0, Math.floor(cleanNumber(input.quantity ?? input.suggestedQuantity) || 0)),
    maximumPlannedLoss: cleanNumber(input.maximumPlannedLoss ?? input.maximumLoss),
    reason: text(input.reason),
    confidence: cleanNumber(input.confidence ?? input.tradingScore ?? input.technicalDetails?.score),
    currentPrice: cleanNumber(input.currentPrice),
    entryFilledAt: input.entryFilledAt || null,
    partialProfitAt: input.partialProfitAt || null,
    completedAt: input.completedAt || null,
    cancelledAt: input.cancelledAt || null,
    stoppedAt: input.stoppedAt || null,
    expiredAt: input.expiredAt || null,
    createdAt,
    updatedAt: input.updatedAt || input.updated_at || now.toISOString(),
    expiresAt,
    source: input.source || "morning-report",
    invalidated: Boolean(input.invalidated || input.setupInvalidated),
  };
}

export function upsertMonitoredPlans(existingPlans = [], incomingPlans = [], settings = DEFAULT_MARKET_WATCH_SETTINGS, now = new Date()) {
  const activeStates = new Set(["WAITING_FOR_ENTRY", "ACTIVE", "PARTIAL_PROFIT"]);
  const bySymbol = new Map(existingPlans.map((plan) => [upper(plan.symbol), plan]));
  const next = [...existingPlans];
  const created = [];
  for (const input of incomingPlans) {
    const plan = normalizeTradePlan(input, settings, now);
    if (!plan.symbol || !Number.isFinite(plan.entryPrice) || !Number.isFinite(plan.safetyExit)) continue;
    const existing = bySymbol.get(plan.symbol);
    if (existing && activeStates.has(existing.state)) continue;
    next.unshift(plan);
    bySymbol.set(plan.symbol, plan);
    created.push(plan);
  }
  return { plans: next, created };
}

function hasAlert(alerts = [], planId, action) {
  return alerts.some((alert) => alert.planId === planId && alert.action === action && !alert.dismissedAt);
}

function plainAlertMessage(action, plan, currentPrice, settings) {
  if (action === "BUY NOW") {
    return `ACTION REQUIRED\n\nBuy ${plan.quantity} ${plan.companyName} share${plan.quantity === 1 ? "" : "s"} now.\n\nCurrent price: ${formatMoney(currentPrice, plan.currency)}\nSafety Exit: ${formatMoney(plan.safetyExit, plan.currency)}\nTake Some Profit: ${formatMoney(plan.takeSomeProfit, plan.currency)}\nFinal Exit: ${formatMoney(plan.finalExit, plan.currency)}\n\nOpen CMC and enter the trade.`;
  }
  if (action === "TAKE SOME PROFIT") {
    return `ACTION REQUIRED\n\nTake Some Profit.\n\nSell ${settings.takeSomeProfitPercent}%.\n\nMove Safety Exit to your original entry.\n\nContinue holding remaining shares.`;
  }
  if (action === "FINAL EXIT") return `ACTION REQUIRED\n\nSell remaining shares.`;
  if (action === "SAFETY EXIT") return `ACTION REQUIRED\n\nExit immediately.\n\nSafety Exit reached.`;
  if (action === "CANCEL SETUP") return `ACTION REQUIRED\n\nCancel pending CMC order.\n\nSetup invalid.`;
  return `${plan.companyName}\n\nNo action required right now.`;
}

export function formatMoney(value, currency = "USD") {
  const amount = cleanNumber(value);
  if (!Number.isFinite(amount)) return "--";
  return new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function createAlert(plan, action, currentPrice, triggerPrice, settings, now) {
  return {
    id: id("alert", now),
    planId: plan.id,
    symbol: plan.symbol,
    companyName: plan.companyName,
    currency: plan.currency,
    action,
    currentPrice: round(currentPrice),
    triggerPrice: round(triggerPrice),
    message: plainAlertMessage(action, plan, currentPrice, settings),
    confidence: "HIGH",
    confidenceReasons: confidenceReasons(action),
    evidence: [
      "Market watch evaluated the active plan.",
      `${action === "BUY NOW" ? "Entry reached" : `${action} trigger reached`}.`,
      `Current price: ${formatMoney(currentPrice, plan.currency)}.`,
      `Trigger price: ${formatMoney(triggerPrice, plan.currency)}.`,
      `Triggered: ${now.toISOString()}.`,
    ],
    notificationTitle: "ACTION REQUIRED",
    notificationBody: notificationBody(action, plan),
    notificationAction: action === "BUY NOW" ? "BUY" : action === "CANCEL SETUP" ? "CANCEL ORDER" : action,
    createdAt: now.toISOString(),
    acknowledgedAt: null,
    completedAt: null,
    dismissedAt: null,
    cmcUrl: "https://www.cmcmarketsstockbroking.com.au/",
    companyUrl: `/freedom-trader/company/${encodeURIComponent(plan.symbol)}`,
  };
}

function confidenceReasons(action) {
  if (action === "BUY NOW") return ["Market scanned.", "Current price available.", "Trade validated.", "Risk acceptable.", "Entry reached."];
  return ["Current price available.", "Watch plan active.", `${action} trigger reached.`];
}

function notificationBody(action, plan) {
  if (action === "BUY NOW") return `Buy ${plan.companyName} now.`;
  if (action === "TAKE SOME PROFIT") return "Take Some Profit.";
  if (action === "FINAL EXIT") return "Sell remaining shares.";
  if (action === "SAFETY EXIT") return "Exit immediately. Safety Exit reached.";
  if (action === "CANCEL SETUP") return "Cancel pending CMC order. Setup invalid.";
  return "Review Freedom Trader.";
}

function setupInvalid(plan, quote, settings, now) {
  if (plan.invalidated || quote?.invalidated || quote?.setupInvalidated) return "Setup invalidated.";
  const confidence = cleanNumber(quote?.confidence ?? quote?.tradingScore ?? plan.confidence);
  if (Number.isFinite(confidence) && confidence < settings.minimumConfidence) return "Scanner confidence has collapsed.";
  const expiry = dateMs(plan.expiresAt);
  if (Number.isFinite(expiry) && now.getTime() >= expiry) return "Setup expired.";
  return "";
}

export function evaluateWatchPlan(planInput = {}, quote = {}, settingsInput = {}, now = new Date()) {
  const settings = normalizeMarketWatchSettings(settingsInput);
  const plan = normalizeTradePlan(planInput, settings, now);
  const currentPrice = quote?.error
    ? cleanNumber(quote.price ?? quote.currentPrice)
    : cleanNumber(quote.price ?? quote.currentPrice ?? plan.currentPrice);
  const invalidReason = setupInvalid(plan, quote, settings, now);
  if (plan.state === "COMPLETED" || plan.state === "STOPPED" || plan.state === "CANCELLED" || plan.state === "EXPIRED") {
    return { plan, action: "WAIT", currentPrice, triggerPrice: null, nextState: plan.state, reason: "Plan is already closed." };
  }
  if (invalidReason) {
    return {
      plan,
      action: invalidReason === "Setup expired." ? "CANCEL SETUP" : "CANCEL SETUP",
      currentPrice,
      triggerPrice: null,
      nextState: invalidReason === "Setup expired." ? "EXPIRED" : "CANCELLED",
      reason: invalidReason,
    };
  }
  if (!Number.isFinite(currentPrice)) return { plan, action: "WAIT", currentPrice: null, triggerPrice: null, nextState: plan.state, reason: "Current price unavailable." };

  if ((plan.state === "ACTIVE" || plan.state === "PARTIAL_PROFIT") && Number.isFinite(plan.safetyExit) && currentPrice <= plan.safetyExit) {
    return { plan, action: "SAFETY EXIT", currentPrice, triggerPrice: plan.safetyExit, nextState: "STOPPED", reason: "Safety Exit reached." };
  }
  if ((plan.state === "ACTIVE" || plan.state === "PARTIAL_PROFIT") && Number.isFinite(plan.finalExit) && currentPrice >= plan.finalExit) {
    return { plan, action: "FINAL EXIT", currentPrice, triggerPrice: plan.finalExit, nextState: "COMPLETED", reason: "Final Exit reached." };
  }
  if (plan.state === "ACTIVE" && Number.isFinite(plan.takeSomeProfit) && currentPrice >= plan.takeSomeProfit) {
    return { plan, action: "TAKE SOME PROFIT", currentPrice, triggerPrice: plan.takeSomeProfit, nextState: "PARTIAL_PROFIT", reason: "Take Some Profit reached." };
  }
  if (plan.state === "WAITING_FOR_ENTRY" && Number.isFinite(plan.entryPrice) && currentPrice <= plan.entryPrice) {
    return { plan, action: "BUY NOW", currentPrice, triggerPrice: plan.entryPrice, nextState: "ACTIVE", reason: "Entry reached." };
  }
  return { plan, action: "WAIT", currentPrice, triggerPrice: null, nextState: plan.state, reason: "No action required right now." };
}

export async function runMarketWatchCycle({ plans = [], alerts = [], settings = {}, fetchQuote, now = new Date() } = {}) {
  const cleanSettings = normalizeMarketWatchSettings(settings);
  const nextPlans = [];
  const newAlerts = [];
  const evaluations = [];
  const errors = [];
  const marketDataQualities = [];
  for (const rawPlan of plans) {
    const plan = normalizeTradePlan(rawPlan, cleanSettings, now);
    let quote = { price: plan.currentPrice };
    try {
      quote = typeof fetchQuote === "function" ? await fetchQuote(plan.symbol) : quote;
      if (quote?.dataQuality) marketDataQualities.push(quote.dataQuality);
      if (quote?.error) errors.push({ symbol: plan.symbol, error: quote.error });
    } catch (error) {
      quote = { price: null, error: error.message || "Market data failed." };
      errors.push({ symbol: plan.symbol, error: quote.error });
    }
    const evaluation = evaluateWatchPlan(plan, quote, cleanSettings, now);
    const updatedPlan = {
      ...plan,
      currentPrice: evaluation.currentPrice,
      state: evaluation.nextState,
      updatedAt: now.toISOString(),
      lastEvaluation: { action: evaluation.action, reason: evaluation.reason, checkedAt: now.toISOString() },
      lastPrice: evaluation.currentPrice,
      lastMarketDataQuality: quote?.dataQuality || null,
      entryFilledAt: evaluation.action === "BUY NOW" ? now.toISOString() : plan.entryFilledAt,
      partialProfitAt: evaluation.action === "TAKE SOME PROFIT" ? now.toISOString() : plan.partialProfitAt,
      completedAt: evaluation.action === "FINAL EXIT" ? now.toISOString() : plan.completedAt,
      stoppedAt: evaluation.action === "SAFETY EXIT" ? now.toISOString() : plan.stoppedAt,
      cancelledAt: evaluation.nextState === "CANCELLED" ? now.toISOString() : plan.cancelledAt,
      expiredAt: evaluation.nextState === "EXPIRED" ? now.toISOString() : plan.expiredAt,
    };
    if (evaluation.action !== "WAIT" && actionEnabled(evaluation.action, cleanSettings) && !hasAlert(alerts, plan.id, evaluation.action) && !hasAlert(newAlerts, plan.id, evaluation.action)) {
      newAlerts.push(createAlert(updatedPlan, evaluation.action, evaluation.currentPrice, evaluation.triggerPrice, cleanSettings, now));
    }
    nextPlans.push(updatedPlan);
    evaluations.push({ ...evaluation, plan: updatedPlan });
  }
  const allAlerts = [...newAlerts, ...alerts].slice(0, cleanSettings.maximumAlerts);
  return {
    plans: nextPlans,
    alerts: allAlerts,
    newAlerts,
    evaluations,
    errors,
    marketDataQuality: combineMarketDataQuality(marketDataQualities),
    settings: cleanSettings,
    checkedAt: now.toISOString(),
    answer: buildMarketWatchAnswer(nextPlans, allAlerts),
  };
}

function combineMarketDataQuality(qualities = []) {
  const rank = { live: 0, delayed: 1, "daily-only": 2, cached: 3, stale: 4, unavailable: 5 };
  if (!qualities.length) return "unavailable";
  return qualities.reduce((worst, item) => (rank[item] ?? 5) > (rank[worst] ?? 5) ? item : worst, qualities[0]);
}

export function buildMarketWatchAnswer(plans = [], alerts = []) {
  const activeAlert = alerts.find((alert) => {
    if (alert.acknowledgedAt || alert.completedAt || alert.dismissedAt) return false;
    if (!alert.symbol || alert.currentPrice == null || alert.triggerPrice == null) return false;
    if (!Number.isFinite(cleanNumber(alert.currentPrice)) || !Number.isFinite(cleanNumber(alert.triggerPrice))) return false;
    return true;
  });
  if (activeAlert) {
    return {
      heading: "ACTION REQUIRED",
      action: activeAlert.action,
      symbol: activeAlert.symbol,
      companyName: activeAlert.companyName,
      message: activeAlert.message,
    };
  }
  const count = plans.filter((plan) => ["WAITING_FOR_ENTRY", "ACTIVE", "PARTIAL_PROFIT"].includes(plan.state)).length;
  return {
    heading: `Monitoring ${count} active setup${count === 1 ? "" : "s"}.`,
    action: "WAIT",
    message: "No action required right now.",
  };
}

export function updateAlertState(alerts = [], idValue, patch = {}) {
  return alerts.map((alert) => alert.id === idValue ? { ...alert, ...patch } : alert);
}
