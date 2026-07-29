export const DEFAULT_REPORT_SETTINGS = {
  tradingBalance: 5000,
  accountCurrency: "AUD",
  maximumPlannedLossPerTrade: 75,
  maximumSimultaneousOpenTrades: 3,
  maximumTotalMoneyCommitted: 2500,
  maximumTotalPlannedLoss: 150,
  minimumRiskReward: 2,
  maximumTradePlanAgeHours: 96,
};

export const MARKET_DATA_QUALITIES = ["live", "delayed", "cached", "stale", "unavailable"];

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function hoursSince(value, now = new Date()) {
  const timestamp = Date.parse(String(value || "").replace(" ", "T"));
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (now.getTime() - timestamp) / 3600000);
}

function timestampFor(row = {}) {
  return row.marketDataTimestamp || row.priceTimestamp || row.opportunity?.priceTimestamp || row.dataStatus?.latestTimestamp || row.source?.dataStatus?.latestTimestamp || null;
}

export function classifyMarketData(row = {}, now = new Date()) {
  if (row.status === "DATA UNAVAILABLE" || row.dataQuality === "unavailable" || row.dataStatus?.apiError || row.error) return "unavailable";
  const age = hoursSince(timestampFor(row), now);
  if (!Number.isFinite(age)) return row.dataStatus?.cacheStatus ? "cached" : "unavailable";
  if (age > 96) return "stale";
  if (row.dataStatus?.cacheStatus || row.dataStatus?.cached || row.source?.dataStatus?.cacheStatus) return "cached";
  if (row.dataStatus?.delayed || row.dataStatus?.source === "daily-fallback" || /daily|delayed/i.test(String(row.dataStatus?.status || row.dataStatus?.provider || ""))) return "delayed";
  return "live";
}

export function combineMarketDataQuality(items = [], now = new Date()) {
  const ranks = { live: 0, delayed: 1, cached: 2, stale: 3, unavailable: 4 };
  const qualities = items.map((item) => classifyMarketData(item, now));
  if (!qualities.length) return "unavailable";
  return qualities.reduce((worst, quality) => ranks[quality] > ranks[worst] ? quality : worst, "live");
}

function currency(value, code = "USD") {
  const amount = cleanNumber(value);
  if (!Number.isFinite(amount)) return "--";
  const locale = code === "AUD" ? "en-AU" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency: code || "USD", maximumFractionDigits: 2 }).format(amount);
}

function plainReason(kind, row, failure) {
  if (failure) {
    if (/stale|unavailable|missing|required/i.test(failure)) return "Freedom cannot assess this share reliably right now.";
    if (/risk\/reward|reward/i.test(failure)) return "The possible profit is not large enough compared with the planned loss.";
    if (/ordering|stop|target/i.test(failure)) return "The buy, stop-loss and profit prices do not form a safe plan.";
    if (/balance|committed|limit/i.test(failure)) return "The account limit would be exceeded.";
    if (/simultaneous/i.test(failure)) return "The maximum number of open trades has already been reached.";
    if (/quantity/i.test(failure)) return "The allowed risk is too small to buy at least one share.";
  }
  if (kind === "ready") return "The price and risk now meet the trading rules.";
  if (kind === "wait") return "The current price is above the preferred buying range.";
  return row.reason || row.opportunity?.reasonsFor?.[0] || "No immediate action is required.";
}

function tradeValues(row = {}) {
  const entry = cleanNumber(row.recommendedEntry ?? row.entry ?? row.opportunity?.proposedEntryLow ?? row.setup?.plannedEntry);
  const stop = cleanNumber(row.stopLoss ?? row.stop ?? row.opportunity?.stopLoss ?? row.setup?.stop);
  const target = cleanNumber(row.target ?? row.target1 ?? row.opportunity?.target1 ?? row.setup?.target);
  const target2 = cleanNumber(row.target2 ?? row.opportunity?.target2);
  const currentPrice = cleanNumber(row.currentPrice ?? row.opportunity?.currentPrice);
  const riskReward = cleanNumber(row.riskReward ?? row.opportunity?.riskReward ?? row.setup?.riskRewardRatio);
  return { entry, stop, target, target2, currentPrice, riskReward };
}

function validateCandidate(row, settings, context, now) {
  const quality = classifyMarketData(row, now);
  const { entry, stop, target, currentPrice, riskReward } = tradeValues(row);
  const currencyCode = row.currency || row.opportunity?.currency || "USD";
  const timestampAge = hoursSince(row.tradePlanUpdatedAt || row.updatedAt || timestampFor(row), now);
  if (quality === "stale") return { ok: false, status: "DATA UNAVAILABLE", reason: "stale market data", quality };
  if (quality === "unavailable") return { ok: false, status: "DATA UNAVAILABLE", reason: "unavailable market data", quality };
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) return { ok: false, status: "DATA UNAVAILABLE", reason: "missing entry, stop or target", quality };
  if (!(stop < entry && entry < target)) return { ok: false, status: "WAIT", reason: "invalid price ordering", quality };
  const actualRiskReward = Number.isFinite(riskReward) ? riskReward : (target - entry) / (entry - stop);
  if (!Number.isFinite(actualRiskReward) || actualRiskReward < settings.minimumRiskReward) return { ok: false, status: "WAIT", reason: "minimum reward-to-risk failure", quality };
  if (Number.isFinite(timestampAge) && timestampAge > settings.maximumTradePlanAgeHours) return { ok: false, status: "DATA UNAVAILABLE", reason: "trade plan is stale", quality };
  if (row.opportunity?.failedConditions?.length) return { ok: false, status: "WAIT", reason: row.opportunity.failedConditions[0], quality };
  if (row.invalidated || row.setupInvalidated) return { ok: false, status: "WAIT", reason: "setup is already invalidated", quality };

  const riskPerShare = entry - stop;
  const maxByRisk = Math.floor(settings.maximumPlannedLossPerTrade / riskPerShare);
  const maxByBalance = Math.floor((settings.tradingBalance - context.usedPurchaseValue) / entry);
  const maxByCommitted = Math.floor((settings.maximumTotalMoneyCommitted - context.usedPurchaseValue) / entry);
  const quantity = Math.max(0, Math.min(maxByRisk, maxByBalance, maxByCommitted));
  if (context.openTradeCount + context.approvedCount >= settings.maximumSimultaneousOpenTrades) return { ok: false, status: "WAIT", reason: "maximum simultaneous trades reached", quality };
  if (quantity < 1) return { ok: false, status: "WAIT", reason: "quantity below one", quality };
  const plannedLoss = round(quantity * riskPerShare);
  if (plannedLoss > settings.maximumPlannedLossPerTrade || context.usedPlannedLoss + plannedLoss > settings.maximumTotalPlannedLoss) {
    return { ok: false, status: "WAIT", reason: "maximum planned loss exceeded", quality };
  }
  const purchaseValue = round(quantity * entry);
  if (purchaseValue > settings.tradingBalance - context.usedPurchaseValue || purchaseValue > settings.maximumTotalMoneyCommitted - context.usedPurchaseValue) {
    return { ok: false, status: "WAIT", reason: "account balance exceeded", quality };
  }
  const ready = Number.isFinite(currentPrice) && currentPrice <= entry;
  return { ok: ready, status: ready ? "READY TO BUY" : "WAIT", reason: ready ? null : "current price is above preferred buying range", quality, quantity, purchaseValue, plannedLoss, riskPerShare, currencyCode, riskReward: round(actualRiskReward, 2) };
}

export function buildRecommendation(row, settings, context, now = new Date()) {
  const validation = validateCandidate(row, settings, context, now);
  const { entry, stop, target, currentPrice } = tradeValues(row);
  const currencyCode = validation.currencyCode || row.currency || "USD";
  const base = {
    symbol: row.symbol || row.ticker,
    companyName: row.companyName || row.company || row.symbol || row.ticker,
    status: validation.status,
    currentPrice,
    buyPrice: entry,
    profitTakingPrice: target,
    stopLossPrice: stop,
    suggestedQuantity: validation.quantity || 0,
    estimatedPurchaseValue: validation.purchaseValue || null,
    maximumPlannedLoss: validation.plannedLoss || null,
    currency: currencyCode,
    marketDataQuality: validation.quality,
    reason: validation.ok ? plainReason("ready", row) : validation.status === "WAIT" ? plainReason("wait", row, validation.reason) : plainReason("unavailable", row, validation.reason),
    technicalDetails: {
      score: row.tradingScore ?? row.opportunity?.score ?? null,
      riskReward: validation.riskReward ?? row.riskReward ?? row.opportunity?.riskReward ?? null,
      dataTimestamp: timestampFor(row),
      failedReason: validation.reason || null,
    },
  };
  if (validation.ok) {
    context.approvedCount += 1;
    context.usedPurchaseValue = round(context.usedPurchaseValue + validation.purchaseValue);
    context.usedPlannedLoss = round(context.usedPlannedLoss + validation.plannedLoss);
  }
  return base;
}

export function buildPositionAction(position = {}) {
  const symbol = position.symbol || position.ticker;
  const quantity = cleanNumber(position.quantity) || 0;
  const entryPrice = cleanNumber(position.entryPrice ?? position.averageEntry ?? position.actualFillPrice);
  const currentPrice = cleanNumber(position.currentPrice ?? position.closingPrice);
  const target = cleanNumber(position.targetPrice ?? position.target);
  const stop = cleanNumber(position.stopPrice ?? position.stopLoss);
  const result = cleanNumber(position.unrealisedProfit ?? position.unrealisedProfitLoss ?? position.realisedProfitLoss);
  let action = "REVIEW";
  if (Number.isFinite(currentPrice) && Number.isFinite(stop) && currentPrice <= stop) action = "EXIT NOW";
  else if (Number.isFinite(currentPrice) && Number.isFinite(target) && currentPrice >= target) action = "SELL AT TARGET";
  else if (position.status === "open" || quantity > 0) action = "HOLD";
  return {
    symbol,
    companyName: position.companyName || position.company || symbol,
    actualEntryPrice: entryPrice,
    currentPrice,
    estimatedProfitLoss: result,
    stopLoss: stop,
    target,
    quantity,
    currency: position.currency || "USD",
    action,
    instruction: action === "HOLD" ? "Leave the position open. No action is needed now." : action === "SELL AT TARGET" ? "The profit price has been reached. Review CMC and take profit." : action === "EXIT NOW" ? "The stop-loss has been reached. Exit the position in CMC." : "Check this position before making a new decision.",
  };
}

export function buildOrderInstructions(recommendations = [], pendingOrders = [], positionActions = []) {
  const approved = recommendations.filter((item) => item.status === "READY TO BUY");
  const ordersToLeaveActive = pendingOrders
    .filter((order) => String(order.status || "").toLowerCase() === "pending")
    .map((order) => ({ symbol: order.ticker || order.symbol, instruction: `Leave the existing ${order.side || "conditional"} order active at ${currency(order.requested_price ?? order.requestedPrice, order.currency || "USD")}.` }));
  const ordersToCancel = [
    ...recommendations.filter((item) => item.status === "DATA UNAVAILABLE").map((item) => ({ symbol: item.symbol, instruction: "Cancel any fresh buy order for this share until Freedom can assess the data again." })),
    ...positionActions.filter((item) => item.action === "EXIT NOW").map((item) => ({ symbol: item.symbol, instruction: "Cancel profit-taking orders after the exit is completed." })),
  ];
  return {
    approvedTrades: approved.map((item) => ({
      symbol: item.symbol,
      conditionalBuy: `${item.suggestedQuantity} shares at ${currency(item.buyPrice, item.currency)}`,
      stopLossAfterPurchase: currency(item.stopLossPrice, item.currency),
      profitTakingOrder: currency(item.profitTakingPrice, item.currency),
      disclaimer: "Freedom has not placed this order.",
    })),
    ordersToLeaveActive,
    ordersToCancel,
  };
}

function finalInstruction(reportType, recommendations, positionActions, orderInstructions) {
  const exits = positionActions.filter((item) => item.action === "EXIT NOW");
  if (exits.length) return `Exit ${exits[0].symbol} in CMC before preparing any new trade.`;
  const ready = recommendations.filter((item) => item.status === "READY TO BUY");
  if (ready.length) return `Prepare one conditional ${ready[0].symbol} order in CMC. Do not buy the other shares yet.`;
  const sell = positionActions.find((item) => item.action === "SELL AT TARGET");
  if (sell) return `Take profit on ${sell.symbol} in CMC, then leave the other positions alone.`;
  if (reportType === "evening" && orderInstructions.ordersToCancel.length) return `Cancel the stale or unsafe orders before the next session.`;
  return "Do nothing. No trade currently meets the required rules.";
}

function reportSummary(reportType, recommendations, positionActions, orderInstructions, trades = []) {
  if (reportType === "morning") {
    return {
      bestNewSetups: recommendations.filter((item) => ["READY TO BUY", "WAIT"].includes(item.status)).slice(0, 5),
      conditionalOrdersToPrepare: orderInstructions.approvedTrades,
      existingPositionsNeedingAction: positionActions.filter((item) => item.action !== "HOLD"),
      ordersThatShouldRemainActive: orderInstructions.ordersToLeaveActive,
      unavailableOrStaleData: recommendations.filter((item) => item.status === "DATA UNAVAILABLE"),
      totalProposedPurchaseValue: round(orderInstructions.approvedTrades.reduce((total, order) => total + (recommendations.find((item) => item.symbol === order.symbol)?.estimatedPurchaseValue || 0), 0)),
      totalMaximumPlannedLoss: round(recommendations.reduce((total, item) => total + (item.status === "READY TO BUY" ? item.maximumPlannedLoss || 0 : 0), 0)),
    };
  }
  if (reportType === "evening") {
    return {
      tradesTriggeredDuringSession: trades.filter((trade) => String(trade.tradeDateTime || trade.traded_at || "").slice(0, 10) === new Date().toISOString().slice(0, 10)),
      tradesNotTriggered: recommendations.filter((item) => item.status === "WAIT"),
      openPositionPerformance: positionActions,
      realisedResults: trades.filter((trade) => trade.status === "closed"),
      unrealisedResults: positionActions.filter((item) => Number.isFinite(item.estimatedProfitLoss)),
      ordersToCancelBeforeNextSession: orderInstructions.ordersToCancel,
      positionsThatMayRemainOpen: positionActions.filter((item) => item.action === "HOLD"),
      positionsRequiringReviewOrExit: positionActions.filter((item) => item.action !== "HOLD"),
    };
  }
  return null;
}

export function generateFreedomTraderReport({
  reportType = "now",
  scannerRows = [],
  positions = [],
  pendingOrders = [],
  trades = [],
  settings = {},
  userId = "freedom-development-user",
  now = new Date(),
} = {}) {
  const cleanSettings = { ...DEFAULT_REPORT_SETTINGS, ...settings };
  const openTradeCount = positions.filter((position) => position.status === "open" || Number(position.quantity) > 0).length;
  const context = { openTradeCount, approvedCount: 0, usedPurchaseValue: 0, usedPlannedLoss: 0 };
  const sorted = [...scannerRows].sort((a, b) => (Number(b.tradingScore ?? b.opportunity?.score) || 0) - (Number(a.tradingScore ?? a.opportunity?.score) || 0));
  const recommendations = sorted.map((row) => buildRecommendation(row, cleanSettings, context, now)).slice(0, 5);
  const finalRecommendations = recommendations.length ? recommendations : [{
    symbol: null,
    companyName: "No suitable trade is ready now.",
    status: "NO ACTION",
    reason: "The best action is to wait rather than force a trade.",
    marketDataQuality: "unavailable",
  }];
  const positionActions = positions.filter((position) => position.status !== "closed").map(buildPositionAction);
  const orderInstructions = buildOrderInstructions(finalRecommendations, pendingOrders, positionActions);
  const overallInstruction = finalInstruction(reportType, finalRecommendations, positionActions, orderInstructions);
  const generatedAt = now.toISOString();
  const marketRows = [...scannerRows, ...positions.map((position) => position.priceData || position)];
  const marketDataQuality = marketRows.length ? combineMarketDataQuality(marketRows, now) : "unavailable";
  return {
    userId,
    reportType,
    generatedAt,
    marketDataTimestamp: marketRows.map(timestampFor).filter(Boolean).sort().at(-1),
    marketDataQuality,
    greeting: "Hi Grant — here are your best options right now.",
    recommendations: finalRecommendations,
    positionActions,
    orderInstructions,
    settings: cleanSettings,
    summary: reportSummary(reportType, finalRecommendations, positionActions, orderInstructions, trades),
    overallInstruction,
    actionAlerts: [
      ...finalRecommendations.filter((item) => item.status === "READY TO BUY").map((item) => ({
        userId,
        symbol: item.symbol,
        action: "BUY",
        message: `Prepare a conditional buy order for ${item.symbol} in CMC at ${currency(item.buyPrice, item.currency)}.`,
        triggerPrice: item.buyPrice,
        createdAt: generatedAt,
      })),
      ...positionActions.filter((item) => ["SELL AT TARGET", "EXIT NOW"].includes(item.action)).map((item) => ({
        userId,
        symbol: item.symbol,
        action: item.action === "EXIT NOW" ? "EXIT" : "SELL",
        message: item.instruction,
        triggerPrice: item.action === "EXIT NOW" ? item.stopLoss : item.target,
        createdAt: generatedAt,
      })),
      ...orderInstructions.ordersToCancel.map((item) => ({ userId, symbol: item.symbol, action: "CANCEL_ORDER", message: item.instruction, createdAt: generatedAt })),
    ],
  };
}
