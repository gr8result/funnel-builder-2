import { scanActionText } from "./scanSummary.js";

export const DEFAULT_REPORT_SETTINGS = {
  tradingBalance: 5000,
  availableCash: 5000,
  accountCurrency: "AUD",
  maximumPlannedLossPerTrade: 75,
  maximumOpenPositions: 3,
  maximumSimultaneousOpenTrades: 3,
  maximumTotalMoneyCommitted: 2500,
  maximumTotalPlannedLoss: 150,
  maximumPositionValue: 1250,
  minimumRiskReward: 2,
  maximumTradePlanAgeHours: 96,
  takeSomeProfitPercent: 50,
  moveSafetyExitToEntryAfterTakeProfit: true,
  target1IsCompleteExit: false,
  allowDuplicateActiveSymbol: false,
  currencyConversionRates: { AUD: 1 },
};

export const MARKET_DATA_QUALITIES = ["live", "delayed", "cached", "stale", "unavailable"];
export const ASSISTANT_STATUSES = ["READY TO BUY", "WAIT", "HOLD", "TAKE SOME PROFIT", "FINAL EXIT", "SAFETY EXIT", "CANCEL ORDER", "NO ACTION", "DATA UNAVAILABLE"];

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function isoDate(now) {
  return now.toISOString().slice(0, 10);
}

function hoursSince(value, now = new Date()) {
  const timestamp = Date.parse(String(value || "").replace(" ", "T"));
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (now.getTime() - timestamp) / 3600000);
}

function timestampFor(row = {}) {
  return row.marketDataTimestamp || row.priceTimestamp || row.opportunity?.priceTimestamp || row.dataStatus?.latestTimestamp || row.source?.dataStatus?.latestTimestamp || row.priceData?.lastUpdated || row.priceData?.timestamp || null;
}

export function classifyMarketData(row = {}, now = new Date()) {
  if (row.status === "DATA UNAVAILABLE" || row.dataQuality === "unavailable" || row.dataStatus?.apiError || row.error) return "unavailable";
  const age = hoursSince(timestampFor(row), now);
  if (!Number.isFinite(age)) return row.dataStatus?.cacheStatus || row.priceData?.source === "local" ? "cached" : "unavailable";
  if (age > 96) return "stale";
  if (row.dataStatus?.cacheStatus || row.dataStatus?.cached || row.source?.dataStatus?.cacheStatus || row.priceData?.source === "local") return "cached";
  if (row.dataStatus?.delayed || row.priceData?.delayed || row.dataStatus?.source === "daily-fallback" || /daily|delayed/i.test(String(row.dataStatus?.status || row.dataStatus?.provider || ""))) return "delayed";
  return "live";
}

export function combineMarketDataQuality(items = [], now = new Date()) {
  const ranks = { live: 0, delayed: 1, cached: 2, stale: 3, unavailable: 4 };
  const qualities = items.map((item) => classifyMarketData(item, now));
  if (!qualities.length) return "unavailable";
  return qualities.reduce((worst, quality) => ranks[quality] > ranks[worst] ? quality : worst, "live");
}

export function formatMoney(value, code = "USD") {
  const amount = cleanNumber(value);
  if (!Number.isFinite(amount)) return "--";
  const locale = code === "AUD" ? "en-AU" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency: code || "USD", maximumFractionDigits: 2 }).format(amount);
}

function normalizeSettings(input = {}) {
  const settings = { ...DEFAULT_REPORT_SETTINGS, ...input };
  settings.availableCash = cleanNumber(input.availableCash) ?? cleanNumber(input.available_cash) ?? cleanNumber(input.account?.availableCash) ?? cleanNumber(input.account?.available_cash) ?? cleanNumber(settings.availableCash) ?? cleanNumber(settings.tradingBalance) ?? 0;
  settings.maximumOpenPositions = Math.max(0, Math.floor(cleanNumber(input.maximumOpenPositions ?? input.maximumSimultaneousOpenTrades ?? settings.maximumOpenPositions) || 0));
  settings.maximumSimultaneousOpenTrades = settings.maximumOpenPositions;
  settings.takeSomeProfitPercent = Math.max(0, Math.min(100, cleanNumber(settings.takeSomeProfitPercent) ?? 50));
  settings.currencyConversionRates = { ...(DEFAULT_REPORT_SETTINGS.currencyConversionRates || {}), ...(input.currencyConversionRates || {}) };
  return settings;
}

function conversionRate(fromCurrency, settings) {
  const from = String(fromCurrency || settings.accountCurrency || "AUD").toUpperCase();
  const to = String(settings.accountCurrency || "AUD").toUpperCase();
  if (from === to) return 1;
  const direct = cleanNumber(settings.currencyConversionRates?.[from]);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return null;
}

function tradeValues(row = {}, settings = DEFAULT_REPORT_SETTINGS) {
  const entry = cleanNumber(row.recommendedEntry ?? row.entry ?? row.entryPrice ?? row.opportunity?.proposedEntryLow ?? row.setup?.plannedEntry);
  const safetyExit = cleanNumber(row.safetyExit ?? row.stopLoss ?? row.stop ?? row.opportunity?.stopLoss ?? row.setup?.stop);
  const takeSomeProfit = cleanNumber(row.takeSomeProfit ?? row.target ?? row.target1 ?? row.opportunity?.target1 ?? row.setup?.target);
  const finalExit = cleanNumber(row.finalExit ?? row.target2 ?? row.opportunity?.target2 ?? (settings.target1IsCompleteExit ? takeSomeProfit : null));
  const currentPrice = cleanNumber(row.currentPrice ?? row.opportunity?.currentPrice);
  const riskReward = cleanNumber(row.riskReward ?? row.opportunity?.riskReward ?? row.setup?.riskRewardRatio);
  return { entry, safetyExit, takeSomeProfit, finalExit, currentPrice, riskReward };
}

function activeSymbolSet(positions = [], pendingOrders = []) {
  const set = new Set();
  positions.filter((position) => position.status !== "closed" && (cleanNumber(position.quantity) || 0) > 0).forEach((position) => {
    const symbol = String(position.symbol || position.ticker || "").toUpperCase();
    if (symbol) set.add(symbol);
  });
  pendingOrders.filter((order) => String(order.status || "").toLowerCase() === "pending").forEach((order) => {
    const symbol = String(order.symbol || order.ticker || "").toUpperCase();
    if (symbol) set.add(symbol);
  });
  return set;
}

function hasHistoricalData(row = {}) {
  if (row.status === "DATA UNAVAILABLE") return false;
  if (row.dataStatus?.readyForScore === false) return false;
  if (Number.isFinite(cleanNumber(row.dataStatus?.actualCandleCount)) && cleanNumber(row.dataStatus.actualCandleCount) < 200) return false;
  if (row.source?.dataStatus?.readyForScore === false) return false;
  return true;
}

function validatePriceOrdering({ entry, safetyExit, takeSomeProfit, finalExit }) {
  if (![entry, safetyExit, takeSomeProfit].every(Number.isFinite)) return false;
  if (!(safetyExit < entry && entry < takeSomeProfit)) return false;
  if (Number.isFinite(finalExit) && finalExit < takeSomeProfit) return false;
  return true;
}

function plainReason(kind, failure) {
  if (kind === "ready") return "The price has reached the preferred buying area and the possible profit is sufficiently greater than the planned loss.";
  if (/currency/i.test(failure || "")) return "Freedom cannot safely calculate the share quantity because currency conversion data is unavailable.";
  if (/quote|historical|stale|unavailable|missing/i.test(failure || "")) return "Freedom cannot assess this share reliably right now.";
  if (/duplicate/i.test(failure || "")) return "This share is already held or already has an active order.";
  if (/risk|reward/i.test(failure || "")) return "The possible profit is not large enough compared with the planned loss.";
  if (/ordering|exit|target|entry/i.test(failure || "")) return "The buy, Safety Exit and profit prices do not form a safe plan.";
  if (/cash|balance|committed|position value/i.test(failure || "")) return "The account limits would be exceeded.";
  if (/open positions/i.test(failure || "")) return "The maximum number of open positions has already been reached.";
  if (/quantity/i.test(failure || "")) return "The allowed risk is too small to buy at least one share.";
  return "The price is still too high. Wait.";
}

function validateCandidate(row, settings, context, now) {
  const quality = classifyMarketData(row, now);
  const values = tradeValues(row, settings);
  const currencyCode = String(row.currency || row.opportunity?.currency || "USD").toUpperCase();
  const symbol = String(row.symbol || row.ticker || "").toUpperCase();
  const timestampAge = hoursSince(row.tradePlanUpdatedAt || row.updatedAt || timestampFor(row), now);
  const rate = conversionRate(currencyCode, settings);

  if (quality === "stale") return { ok: false, status: "DATA UNAVAILABLE", reason: "stale market data", quality };
  if (quality === "unavailable") return { ok: false, status: "DATA UNAVAILABLE", reason: "unavailable market data", quality };
  if (!Number.isFinite(values.currentPrice)) return { ok: false, status: "DATA UNAVAILABLE", reason: "missing quote data", quality };
  if (!hasHistoricalData(row)) return { ok: false, status: "DATA UNAVAILABLE", reason: "missing historical data", quality };
  if (!Number.isFinite(values.entry) || !Number.isFinite(values.safetyExit) || !Number.isFinite(values.takeSomeProfit)) return { ok: false, status: "DATA UNAVAILABLE", reason: "missing entry, Safety Exit or Take Some Profit", quality };
  if (!Number.isFinite(values.finalExit) && !settings.target1IsCompleteExit) return { ok: false, status: "DATA UNAVAILABLE", reason: "missing Final Exit", quality };
  if (!validatePriceOrdering(values)) return { ok: false, status: "WAIT", reason: "invalid entry/Safety Exit/profit ordering", quality };
  const actualRiskReward = Number.isFinite(values.riskReward) ? values.riskReward : (values.takeSomeProfit - values.entry) / (values.entry - values.safetyExit);
  if (!Number.isFinite(actualRiskReward) || actualRiskReward < settings.minimumRiskReward) return { ok: false, status: "WAIT", reason: "minimum reward-to-risk failure", quality };
  if (Number.isFinite(timestampAge) && timestampAge > settings.maximumTradePlanAgeHours) return { ok: false, status: "DATA UNAVAILABLE", reason: "trade plan is stale", quality };
  if (row.opportunity?.failedConditions?.length) return { ok: false, status: "WAIT", reason: row.opportunity.failedConditions[0], quality };
  if (row.invalidated || row.setupInvalidated) return { ok: false, status: "WAIT", reason: "setup is already invalidated", quality };
  if (!settings.allowDuplicateActiveSymbol && context.activeSymbols.has(symbol)) return { ok: false, status: "WAIT", reason: "duplicate active symbol", quality };
  if (!Number.isFinite(rate)) return { ok: false, status: "DATA UNAVAILABLE", reason: `missing ${currencyCode} to ${settings.accountCurrency} currency conversion`, quality };
  if (context.openPositionCount + context.approvedCount >= settings.maximumOpenPositions) return { ok: false, status: "WAIT", reason: "maximum open positions reached", quality };

  const riskPerShare = values.entry - values.safetyExit;
  const maxByRisk = Math.floor(settings.maximumPlannedLossPerTrade / riskPerShare);
  const remainingCash = Math.max(0, settings.availableCash - context.usedAccountCash);
  const remainingCommitted = Math.max(0, settings.maximumTotalMoneyCommitted - context.usedAccountCash);
  const maxPositionValue = Math.min(settings.maximumPositionValue, remainingCash, remainingCommitted);
  const maxByCash = Math.floor(maxPositionValue / (values.entry * rate));
  const quantity = Math.max(0, Math.min(maxByRisk, maxByCash));
  if (quantity < 1) return { ok: false, status: "WAIT", reason: "quantity below one or insufficient cash", quality };
  const plannedLoss = round(quantity * riskPerShare * rate);
  if (plannedLoss > settings.maximumPlannedLossPerTrade || context.usedPlannedLoss + plannedLoss > settings.maximumTotalPlannedLoss) return { ok: false, status: "WAIT", reason: "maximum planned loss exceeded", quality };
  const purchaseValue = round(quantity * values.entry);
  const accountPurchaseValue = round(purchaseValue * rate);
  if (accountPurchaseValue > remainingCash) return { ok: false, status: "WAIT", reason: "insufficient cash", quality };
  if (accountPurchaseValue > remainingCommitted) return { ok: false, status: "WAIT", reason: "maximum total money committed exceeded", quality };

  const ready = values.currentPrice <= values.entry;
  return {
    ok: ready,
    status: ready ? "READY TO BUY" : "WAIT",
    reason: ready ? null : "current price is above preferred buying range",
    quality,
    quantity,
    purchaseValue,
    accountPurchaseValue,
    plannedLoss,
    riskPerShare,
    currencyCode,
    conversionRate: rate,
    riskReward: round(actualRiskReward, 2),
  };
}

export function calculatePartialExit({ quantity, percent = 50 } = {}) {
  const held = Math.max(0, Math.floor(cleanNumber(quantity) || 0));
  const pct = Math.max(0, Math.min(100, cleanNumber(percent) ?? 50));
  if (!held || pct <= 0) return { sellQuantity: 0, remainingQuantity: held, percent: pct, unevenSplit: false };
  if (pct >= 100) return { sellQuantity: held, remainingQuantity: 0, percent: pct, unevenSplit: false };
  const raw = held * (pct / 100);
  const sellQuantity = Math.max(1, Math.min(held - 1, Math.round(raw)));
  return { sellQuantity, remainingQuantity: held - sellQuantity, percent: pct, unevenSplit: raw % 1 !== 0 };
}

export function buildRecommendation(row, settings, context, now = new Date()) {
  const validation = validateCandidate(row, settings, context, now);
  const values = tradeValues(row, settings);
  const currencyCode = validation.currencyCode || String(row.currency || "USD").toUpperCase();
  const accountCurrency = String(settings.accountCurrency || "AUD").toUpperCase();
  const recommendation = {
    symbol: row.symbol || row.ticker,
    companyName: row.companyName || row.company || row.symbol || row.ticker,
    status: validation.status,
    currentPrice: values.currentPrice,
    buyPrice: values.entry,
    entryBuyPrice: values.entry,
    safetyExit: values.safetyExit,
    takeSomeProfit: values.takeSomeProfit,
    finalExit: values.finalExit,
    profitTakingPrice: values.takeSomeProfit,
    stopLossPrice: values.safetyExit,
    suggestedQuantity: validation.quantity || 0,
    estimatedPurchaseValue: validation.purchaseValue || null,
    estimatedAccountPurchaseValue: validation.accountPurchaseValue || null,
    maximumPlannedLoss: validation.plannedLoss || null,
    currency: currencyCode,
    accountCurrency,
    marketDataQuality: validation.quality,
    marketDataTimestamp: timestampFor(row),
    reason: validation.ok ? plainReason("ready") : validation.status === "WAIT" ? plainReason("wait", validation.reason) : plainReason("unavailable", validation.reason),
    cmcOrder: null,
    technicalDetails: {
      score: row.tradingScore ?? row.opportunity?.score ?? null,
      riskReward: validation.riskReward ?? row.riskReward ?? row.opportunity?.riskReward ?? null,
      dataTimestamp: timestampFor(row),
      failedReason: validation.reason || null,
      stopLoss: values.safetyExit,
      target1: values.takeSomeProfit,
      target2: values.finalExit,
      conversionRate: validation.conversionRate ?? null,
    },
  };
  if (validation.ok) {
    recommendation.cmcOrder = {
      symbol: recommendation.symbol,
      conditionalBuy: `${recommendation.suggestedQuantity} ${recommendation.symbol} shares at ${formatMoney(recommendation.buyPrice, currencyCode)}`,
      afterPurchase: [
        `Safety Exit at ${formatMoney(recommendation.safetyExit, currencyCode)}`,
        `Take Some Profit at ${formatMoney(recommendation.takeSomeProfit, currencyCode)}`,
        `Final Exit at ${formatMoney(recommendation.finalExit, currencyCode)}`,
      ],
      disclaimer: "Freedom has not placed this order. Enter and confirm it through CMC.",
    };
    context.approvedCount += 1;
    context.usedAccountCash = round(context.usedAccountCash + validation.accountPurchaseValue);
    context.usedPlannedLoss = round(context.usedPlannedLoss + validation.plannedLoss);
  }
  return recommendation;
}

export function buildPositionAction(position = {}, settings = DEFAULT_REPORT_SETTINGS, now = new Date()) {
  const symbol = position.symbol || position.ticker;
  const quantity = Math.max(0, Math.floor(cleanNumber(position.quantity) || 0));
  const entryPrice = cleanNumber(position.entryPrice ?? position.averageEntry ?? position.actualFillPrice);
  const currentPrice = cleanNumber(position.currentPrice ?? position.closingPrice);
  const takeSomeProfit = cleanNumber(position.takeSomeProfit ?? position.targetPrice ?? position.target);
  const finalExit = cleanNumber(position.finalExit ?? position.target2Price ?? position.target2 ?? position.targetPrice ?? position.target);
  const safetyExit = cleanNumber(position.safetyExit ?? position.stopPrice ?? position.stopLoss);
  const result = cleanNumber(position.unrealisedProfit ?? position.unrealisedProfitLoss ?? position.realisedProfitLoss);
  const quality = classifyMarketData(position.priceData || position, now);
  const partial = calculatePartialExit({ quantity, percent: settings.takeSomeProfitPercent });
  let action = "DATA UNAVAILABLE";
  let instruction = "Freedom cannot assess this open position reliably right now. Confirm the position manually in CMC.";
  let triggerPrice = null;

  if (Number.isFinite(currentPrice) && Number.isFinite(safetyExit) && currentPrice <= safetyExit) {
    action = "SAFETY EXIT";
    instruction = "The trade is moving against the original plan. Exit at the Safety Exit in CMC.";
    triggerPrice = safetyExit;
  } else if (Number.isFinite(currentPrice) && Number.isFinite(finalExit) && currentPrice >= finalExit) {
    action = "FINAL EXIT";
    instruction = "The final profit level has been reached. Sell the remaining position in CMC.";
    triggerPrice = finalExit;
  } else if (Number.isFinite(currentPrice) && Number.isFinite(takeSomeProfit) && currentPrice >= takeSomeProfit) {
    action = "TAKE SOME PROFIT";
    instruction = `Sell ${partial.sellQuantity} share${partial.sellQuantity === 1 ? "" : "s"} now and keep ${partial.remainingQuantity} open for the Final Exit.${settings.moveSafetyExitToEntryAfterTakeProfit && Number.isFinite(entryPrice) ? " Move the Safety Exit on the remaining shares to the original buy price." : ""}`;
    triggerPrice = takeSomeProfit;
  } else if (position.status === "open" || quantity > 0) {
    action = "HOLD";
    instruction = "Leave the position open. No action is needed now.";
  }

  return {
    symbol,
    companyName: position.companyName || position.company || symbol,
    actualEntryPrice: entryPrice,
    currentPrice,
    marketDataQuality: quality,
    marketDataTimestamp: timestampFor(position.priceData || position),
    estimatedProfitLoss: result,
    safetyExit,
    stopLoss: safetyExit,
    takeSomeProfit,
    finalExit,
    target: takeSomeProfit,
    quantity,
    currency: position.currency || "USD",
    action,
    triggerPrice,
    partialExit: partial,
    moveSafetyExitTo: action === "TAKE SOME PROFIT" && settings.moveSafetyExitToEntryAfterTakeProfit ? entryPrice : null,
    instruction,
  };
}

export function buildOrderInstructions(recommendations = [], pendingOrders = [], positionActions = []) {
  const approved = recommendations.filter((item) => item.status === "READY TO BUY");
  const ordersToPrepare = approved.map((item) => item.cmcOrder).filter(Boolean);
  const ordersToLeaveActive = pendingOrders
    .filter((order) => String(order.status || "").toLowerCase() === "pending")
    .map((order) => ({ symbol: order.ticker || order.symbol, instruction: `Leave the existing ${order.side || "conditional"} order active at ${formatMoney(order.requested_price ?? order.requestedPrice, order.currency || "USD")}.` }));
  const ordersToCancel = [
    ...recommendations.filter((item) => item.status === "DATA UNAVAILABLE").map((item) => ({ symbol: item.symbol, instruction: "Cancel any fresh buy order for this share until Freedom can assess the data again." })),
    ...positionActions.filter((item) => item.action === "SAFETY EXIT").map((item) => ({ symbol: item.symbol, instruction: "Cancel profit-taking orders after the Safety Exit is completed in CMC." })),
  ];
  return { approvedTrades: ordersToPrepare, ordersToPrepare, ordersToLeaveActive, ordersToCancel };
}

function realisedToday(trades = [], now = new Date()) {
  const today = isoDate(now);
  return round(trades
    .filter((trade) => String(trade.closingDate || trade.traded_at || trade.tradeDateTime || "").slice(0, 10) === today)
    .reduce((total, trade) => total + (cleanNumber(trade.realisedProfitLoss ?? trade.realised_profit_loss ?? trade.netProfit) || 0), 0));
}

function finalInstruction(reportType, recommendations, positionActions, orderInstructions, scanSummary = null) {
  const safety = positionActions.find((item) => item.action === "SAFETY EXIT");
  if (safety) return `Exit ${safety.symbol} at the Safety Exit in CMC before preparing any new trade.`;
  const final = positionActions.find((item) => item.action === "FINAL EXIT");
  if (final) return `Sell the remaining ${final.symbol} position in CMC at the Final Exit.`;
  const partial = positionActions.find((item) => item.action === "TAKE SOME PROFIT");
  if (partial) return `Take some profit on ${partial.symbol} in CMC and move the Safety Exit as shown.`;
  const ready = recommendations.find((item) => item.status === "READY TO BUY");
  if (ready) return reportType === "morning"
    ? `Prepare one conditional ${ready.symbol} order in CMC. Do not buy the other shares yet.`
    : `Prepare one conditional ${ready.symbol} order in CMC. Do not buy the other shares yet.`;
  if (reportType === "evening" && orderInstructions.ordersToCancel.length) return "Cancel the stale or unsafe orders before the next session.";
  const scanText = scanActionText(scanSummary);
  return scanText.bestAction || "Do not place a new trade from this report.";
}

function marketWatchReportSummary(marketWatch = {}) {
  const alerts = Array.isArray(marketWatch.alerts) ? marketWatch.alerts : [];
  const plans = Array.isArray(marketWatch.plans) ? marketWatch.plans : [];
  return {
    alerts: alerts.filter((alert) => !alert.dismissedAt),
    completedTrades: plans.filter((plan) => plan.state === "COMPLETED"),
    cancelledSetups: plans.filter((plan) => plan.state === "CANCELLED" || plan.state === "EXPIRED"),
    remainingMonitoredTrades: plans.filter((plan) => ["WAITING_FOR_ENTRY", "ACTIVE", "PARTIAL_PROFIT"].includes(plan.state)),
  };
}

function reportSummary(reportType, recommendations, positionActions, orderInstructions, trades = [], settings = DEFAULT_REPORT_SETTINGS, accountSummary = {}, now = new Date(), marketWatch = null) {
  const totalProposedPurchaseValue = round(recommendations.reduce((total, item) => total + (item.status === "READY TO BUY" ? item.estimatedAccountPurchaseValue || 0 : 0), 0));
  const totalMaximumPlannedLoss = round(recommendations.reduce((total, item) => total + (item.status === "READY TO BUY" ? item.maximumPlannedLoss || 0 : 0), 0));
  if (reportType === "morning") {
    return {
      question: "What do I need to do before the trading session?",
      bestNewTradeOpportunities: recommendations.filter((item) => ["READY TO BUY", "WAIT"].includes(item.status)).slice(0, 5),
      exactCmcConditionalOrdersToPrepare: orderInstructions.ordersToPrepare,
      existingPositionsRequiringAction: positionActions.filter((item) => item.action !== "HOLD"),
      pendingOrdersToLeaveActive: orderInstructions.ordersToLeaveActive,
      pendingOrdersToCancel: orderInstructions.ordersToCancel,
      dataProblemsThatPreventRecommendations: recommendations.filter((item) => item.status === "DATA UNAVAILABLE"),
      proposedTotalPurchaseValue: totalProposedPurchaseValue,
      totalMaximumPlannedLoss,
      availableAccountBalance: accountSummary.availableCash ?? settings.availableCash,
      managementRule: managementRuleText(settings),
    };
  }
  if (reportType === "evening") {
    return {
      question: "What happened and what must I do next?",
      ordersThatTriggered: trades.filter((trade) => String(trade.tradeDateTime || trade.traded_at || "").slice(0, 10) === isoDate(now)),
      ordersThatDidNotTrigger: recommendations.filter((item) => item.status === "WAIT"),
      ordersThatShouldNowBeCancelled: orderInstructions.ordersToCancel,
      openPositions: positionActions,
      estimatedUnrealisedProfitOrLoss: round(positionActions.reduce((total, item) => total + (cleanNumber(item.estimatedProfitLoss) || 0), 0)),
      realisedProfitOrLossRecordedToday: realisedToday(trades, now),
      positionsThatCanRemainOpen: positionActions.filter((item) => item.action === "HOLD"),
      positionsThatReachedTakeSomeProfit: positionActions.filter((item) => item.action === "TAKE SOME PROFIT"),
      positionsThatReachedFinalExit: positionActions.filter((item) => item.action === "FINAL EXIT"),
      positionsThatReachedSafetyExit: positionActions.filter((item) => item.action === "SAFETY EXIT"),
      marketWatch: marketWatchReportSummary(marketWatch),
      staleOrUnavailableMarketData: recommendations.filter((item) => item.status === "DATA UNAVAILABLE"),
      managementRule: managementRuleText(settings),
    };
  }
  return {
    question: "What should I do now?",
    readyToBuy: recommendations.filter((item) => item.status === "READY TO BUY"),
    wait: recommendations.filter((item) => item.status === "WAIT"),
    positionActions,
    managementRule: managementRuleText(settings),
  };
}

export function managementRuleText(settings = DEFAULT_REPORT_SETTINGS) {
  const pct = cleanNumber(settings.takeSomeProfitPercent) ?? 50;
  if (pct >= 100) return "At Take Some Profit: sell 100%. At Final Exit: no remaining shares should be open.";
  return `At Take Some Profit: sell ${pct}%. After Take Some Profit: ${settings.moveSafetyExitToEntryAfterTakeProfit ? "move Safety Exit to the original entry price" : "leave the Safety Exit unchanged"}. At Final Exit: sell the remaining position.`;
}

function reportGreeting(reportType) {
  if (reportType === "morning") return "Good morning Grant.\nHere is your trading plan.";
  if (reportType === "evening") return "Good evening Grant.\nHere is your trading summary.";
  return "Hi Grant — here are your best options right now.";
}

function buildAlerts(userId, generatedAt, recommendations, positionActions) {
  return [
    ...recommendations.filter((item) => item.status === "READY TO BUY").map((item) => ({
      userId,
      symbol: item.symbol,
      action: "BUY",
      message: `Prepare a conditional buy order for ${item.symbol} in CMC at ${formatMoney(item.buyPrice, item.currency)}.`,
      triggerPrice: item.buyPrice,
      marketDataTimestamp: item.marketDataTimestamp,
      createdAt: generatedAt,
      acknowledgedAt: null,
    })),
    ...positionActions.filter((item) => ["TAKE SOME PROFIT", "FINAL EXIT", "SAFETY EXIT"].includes(item.action)).map((item) => ({
      userId,
      symbol: item.symbol,
      action: item.action === "TAKE SOME PROFIT" ? "TAKE_SOME_PROFIT" : item.action === "FINAL EXIT" ? "FINAL_EXIT" : "SAFETY_EXIT",
      message: item.instruction,
      triggerPrice: item.triggerPrice,
      marketDataTimestamp: item.marketDataTimestamp,
      createdAt: generatedAt,
      acknowledgedAt: null,
    })),
  ];
}

export function generateFreedomTraderReport({
  reportType = "now",
  scannerRows = [],
  positions = [],
  pendingOrders = [],
  trades = [],
  account = null,
  settings = {},
  scanSummary = null,
  marketWatch = null,
  userId = "freedom-development-user",
  now = new Date(),
} = {}) {
  const cleanSettings = normalizeSettings({ ...settings, account });
  const openPositions = positions.filter((position) => position.status !== "closed" && (cleanNumber(position.quantity) || 0) > 0);
  const pendingCommitted = pendingOrders
    .filter((order) => String(order.status || "").toLowerCase() === "pending")
    .reduce((total, order) => total + ((cleanNumber(order.requested_price ?? order.requestedPrice) || 0) * (cleanNumber(order.quantity) || 0)), 0);
  const context = {
    openPositionCount: openPositions.length,
    approvedCount: 0,
    usedAccountCash: round(pendingCommitted),
    usedPlannedLoss: 0,
    activeSymbols: activeSymbolSet(openPositions, pendingOrders),
  };
  const sorted = [...scannerRows].sort((a, b) => (Number(b.tradingScore ?? b.opportunity?.score) || 0) - (Number(a.tradingScore ?? a.opportunity?.score) || 0));
  const recommendations = sorted.map((row) => buildRecommendation(row, cleanSettings, context, now)).slice(0, 5);
  const scanText = scanActionText(scanSummary);
  const finalRecommendations = recommendations.length ? recommendations : [{
    symbol: null,
    companyName: scanText.heading,
    status: scanSummary?.status === "failed" || !scanSummary?.analysedCount ? "DATA UNAVAILABLE" : "NO ACTION",
    reason: scanText.body,
    marketDataQuality: scanSummary?.status === "complete" ? "delayed" : "unavailable",
  }];
  const positionActions = openPositions.map((position) => buildPositionAction(position, cleanSettings, now));
  const orderInstructions = buildOrderInstructions(finalRecommendations, pendingOrders, positionActions);
  const overallInstruction = finalInstruction(reportType, finalRecommendations, positionActions, orderInstructions, scanSummary);
  const generatedAt = now.toISOString();
  const marketRows = [...scannerRows, ...openPositions.map((position) => position.priceData || position)];
  const accountSummary = {
    tradingBalance: cleanSettings.tradingBalance,
    availableCash: cleanSettings.availableCash,
    accountCurrency: cleanSettings.accountCurrency,
    currentInvestedValue: account?.currentInvestedValue ?? null,
    openProfitLoss: account?.openProfitLoss ?? null,
    pendingCommittedValue: round(pendingCommitted),
  };
  return {
    userId,
    reportType,
    generatedAt,
    marketDataTimestamp: marketRows.map(timestampFor).filter(Boolean).sort().at(-1),
    marketDataQuality: marketRows.length ? combineMarketDataQuality(marketRows, now) : "unavailable",
    greeting: reportGreeting(reportType),
    recommendations: finalRecommendations,
    positionActions,
    orderInstructions,
    accountSummary,
    settings: cleanSettings,
    scanSummary,
    managementRule: managementRuleText(cleanSettings),
    summary: reportSummary(reportType, finalRecommendations, positionActions, orderInstructions, trades, cleanSettings, accountSummary, now, marketWatch),
    overallInstruction,
    actionAlerts: buildAlerts(userId, generatedAt, finalRecommendations, positionActions),
  };
}
