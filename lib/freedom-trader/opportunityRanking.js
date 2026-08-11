import { setupClassificationForRow } from "./pullbackReversal.js";

const READY_ENTRY_TOLERANCE_PERCENT = 0.75;
const CHASE_LIMIT_PERCENT = 10;
const STALE_DAILY_DATA_DAYS = 7;
const MINIMUM_HISTORY_CANDLES = 200;
const DEFAULT_MAX_CAPITAL_PER_TRADE = 5000;
const DEFAULT_MAX_ACCEPTABLE_LOSS = 500;

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = numberValue(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

function clamp(value, min = 0, max = 100) {
  const number = numberValue(value);
  if (number === null) return null;
  return Math.max(min, Math.min(max, number));
}

function percentDistance(currentPrice, entry) {
  const current = numberValue(currentPrice);
  const target = numberValue(entry);
  if (current === null || target === null || target <= 0) return null;
  return ((current - target) / target) * 100;
}

function dataQualityFor(row, reasons = []) {
  if (reasons.some((reason) => /unavailable|stale|history|invalid/i.test(reason))) return "unusable";
  if (row?.marketData?.validated === false || row?.dataStatus?.readyForScore === false) return "unusable";
  return "usable";
}

function validateLongPlan({ entry, stop, takeSomeProfit, finalExit, riskReward }) {
  const errors = [];
  if (![entry, stop, takeSomeProfit, finalExit].every((value) => Number.isFinite(value) && value > 0)) {
    errors.push("Trade plan prices must all be positive.");
  }
  if (Number.isFinite(stop) && Number.isFinite(entry) && stop >= entry) errors.push("Safety Exit must be below Buy Trigger.");
  if (Number.isFinite(entry) && Number.isFinite(takeSomeProfit) && takeSomeProfit <= entry) errors.push("Take Some Profit must be above Buy Trigger.");
  if (Number.isFinite(takeSomeProfit) && Number.isFinite(finalExit) && takeSomeProfit > finalExit) errors.push("Final Exit must be at or above Take Some Profit.");
  if (!Number.isFinite(riskReward) || riskReward < 2) errors.push("Reward-to-risk must be at least 2:1.");
  return errors;
}

export function calculateFreedomPositionSize(plan, account = {}, settings = {}) {
  const currency = String(plan?.currency || "USD").toUpperCase();
  const accountCurrency = String(account?.currency || settings.accountCurrency || currency).toUpperCase();
  const entry = numberValue(plan?.buyTrigger);
  const stop = numberValue(plan?.safetyExit);
  const riskPerShare = entry !== null && stop !== null ? entry - stop : null;
  const brokerage = numberValue(settings.brokerageFee) ?? 0;
  const maximumCapitalPerTrade = numberValue(settings.maximumCapitalPerTrade ?? settings.cmcMaximumCapitalPerTrade) ?? DEFAULT_MAX_CAPITAL_PER_TRADE;
  const maximumAcceptableLoss = numberValue(settings.maximumAcceptableLoss ?? settings.maximumPlannedLoss) ?? DEFAULT_MAX_ACCEPTABLE_LOSS;
  const availableCash = numberValue(settings.availableCash ?? settings.cmcAvailableCash ?? account?.availableCash ?? account?.available_cash);
  const quantityMode = settings.defaultQuantityMode || settings.quantityMode || "calculated";
  const errors = [];

  if (accountCurrency !== currency && availableCash !== null && !settings.fxRate) {
    errors.push(`Account cash is ${accountCurrency}, but this plan is ${currency}. No reliable FX rate is available.`);
  }
  if (!Number.isFinite(entry) || entry <= 0) errors.push("A valid Buy Trigger is required.");
  if (!Number.isFinite(riskPerShare) || riskPerShare <= 0) errors.push("Safety Exit must create positive planned risk.");

  const capitalLimit = availableCash !== null && accountCurrency === currency
    ? Math.min(maximumCapitalPerTrade, availableCash)
    : maximumCapitalPerTrade;
  const quantityByCapital = Number.isFinite(entry) && entry > 0 ? Math.floor((capitalLimit - brokerage) / entry) : 0;
  const quantityByRisk = Number.isFinite(riskPerShare) && riskPerShare > 0 ? Math.floor(maximumAcceptableLoss / riskPerShare) : 0;
  let quantity = Math.max(0, Math.min(quantityByCapital, quantityByRisk));
  if (quantityMode === "one-share") quantity = Math.min(quantity || 1, 1);
  if (quantityMode === "two-shares") quantity = Math.min(quantity || 2, 2);
  const capitalRequired = Number.isFinite(entry) ? round((entry * quantity) + brokerage) : null;
  const maximumPlannedLoss = Number.isFinite(riskPerShare) ? round(riskPerShare * quantity) : null;
  const takeSomeProfit = numberValue(plan?.takeSomeProfit);
  const finalExit = numberValue(plan?.finalExit);
  const potentialProfitAtTakeSomeProfit = takeSomeProfit !== null && entry !== null ? round((takeSomeProfit - entry) * quantity) : null;
  const potentialProfitAtFinalExit = finalExit !== null && entry !== null ? round((finalExit - entry) * quantity) : null;

  if (quantity < 1) errors.push("Position size is zero after applying cash and risk limits.");
  if (availableCash !== null && accountCurrency === currency && capitalRequired !== null && capitalRequired > availableCash) errors.push("Available cash is insufficient.");

  return {
    ok: errors.length === 0,
    errors,
    currency,
    accountCurrency,
    quantity,
    wholeShareQuantity: quantity,
    capitalRequired,
    maximumPlannedLoss,
    potentialProfitAtTakeSomeProfit,
    potentialProfitAtFinalExit,
    riskPerShare: round(riskPerShare),
    maximumCapitalPerTrade,
    maximumAcceptableLoss,
    availableCash: accountCurrency === currency ? availableCash : null,
    audEquivalentAvailable: accountCurrency === "AUD" && currency === "AUD",
    aud: accountCurrency === "AUD" && currency === "AUD" ? {
      capitalRequired,
      maximumPlannedLoss,
      potentialProfitAtTakeSomeProfit,
      potentialProfitAtFinalExit,
    } : null,
  };
}

export function buildFreedomTradePlan(opportunity, account = {}, settings = {}) {
  if (!opportunity || opportunity.status !== "READY") return null;
  const entry = numberValue(opportunity.recommendedEntry ?? opportunity.entry ?? opportunity.preferredBuy);
  const stop = numberValue(opportunity.safetyExit ?? opportunity.stopLoss);
  const takeSomeProfit = numberValue(opportunity.takeSomeProfit ?? opportunity.target);
  const finalExit = numberValue(opportunity.finalExit ?? opportunity.target);
  const riskReward = numberValue(opportunity.riskReward);
  const errors = validateLongPlan({ entry, stop, takeSomeProfit, finalExit, riskReward });
  const plan = {
    company: opportunity.companyName || opportunity.company,
    companyName: opportunity.companyName || opportunity.company,
    symbol: opportunity.symbol,
    exchange: opportunity.exchange || opportunity.marketData?.exchange || opportunity.source?.exchange || "NASDAQ",
    currency: opportunity.currency || opportunity.marketData?.currency || opportunity.source?.currency || "USD",
    currentPrice: round(opportunity.currentPrice),
    marketDataTimestamp: opportunity.marketData?.latestCandleDate || opportunity.dataStatus?.latestTimestamp || opportunity.source?.dataStatus?.latestTimestamp || null,
    dataQuality: dataQualityFor(opportunity.source || opportunity, opportunity.eligibilityReasons),
    buyTrigger: round(entry),
    safetyExit: round(stop),
    takeSomeProfit: round(takeSomeProfit),
    finalExit: round(finalExit),
    rewardToRisk: round(riskReward),
    reason: opportunity.reason,
    status: errors.length ? "DO NOT TRADE" : "READY",
    validationErrors: errors,
  };
  const positionSizing = calculateFreedomPositionSize(plan, account, settings);
  return {
    ...plan,
    positionSizing,
    cmcOrder: errors.length || !positionSizing.ok ? null : {
      broker: "CMC",
      symbol: plan.symbol,
      action: "BUY",
      orderType: "LIMIT",
      quantity: positionSizing.quantity,
      limitPrice: plan.buyTrigger,
      safetyExit: plan.safetyExit,
      takeSomeProfit: plan.takeSomeProfit,
      finalExit: plan.finalExit,
      disclaimer: "Freedom has not placed this trade. Review and enter the order manually in CMC.",
    },
  };
}

function latestDataAgeDays(row, now = new Date()) {
  const raw = row?.dataStatus?.latestTimestamp || row?.marketData?.latestCandleDate || row?.signalResult?.marketDataTimestamp;
  if (!raw) return null;
  const parsed = Date.parse(String(raw).length <= 10 ? `${raw}T21:00:00Z` : raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, (now.getTime() - parsed) / 86400000);
}

function plainTrend(row) {
  const price = numberValue(row.currentPrice);
  const ma20 = numberValue(row.indicators?.ma20);
  const ma50 = numberValue(row.indicators?.ma50);
  if (price !== null && ma20 !== null && ma50 !== null && price > ma20 && ma20 >= ma50) return "The share is trending higher.";
  if (price !== null && ma50 !== null && price < ma50) return "The share is not yet in a healthy short-term uptrend.";
  return "The trend is still developing.";
}

function plainMomentum(row) {
  const change = numberValue(row.changePercent);
  if (change !== null && change > 1.5) return "Buying momentum is strong today.";
  if (change !== null && change < -1.5) return "Price momentum is weak today.";
  return "Momentum is steady rather than stretched.";
}

function plainVolume(row) {
  const relativeVolume = numberValue(row.indicators?.relativeVolume);
  if (relativeVolume !== null && relativeVolume >= 1.2) return "Buying activity is above normal.";
  if (relativeVolume !== null && relativeVolume < 0.75) return "Trading activity is lighter than normal.";
  return "Trading activity is acceptable.";
}

function setupFreshness(row, distancePercent) {
  const expiry = Date.parse(row.setup?.setupExpiryDate || "");
  const expiryScore = Number.isFinite(expiry) ? clamp(((expiry - Date.now()) / 86400000 / 14) * 100) : 65;
  const distanceScore = distancePercent === null ? 35 : clamp(100 - Math.abs(distancePercent) * 9);
  return round((Number(expiryScore) * 0.45) + (Number(distanceScore) * 0.55));
}

function scoreComponents(row) {
  const classification = setupClassificationForRow(row);
  const current = numberValue(row.currentPrice);
  const entry = numberValue(row.setup?.plannedEntry);
  const stop = numberValue(row.setup?.stop);
  const target = numberValue(row.setup?.target);
  const risk = numberValue(row.setup?.riskPerShare) ?? (entry !== null && stop !== null ? entry - stop : null);
  const reward = numberValue(row.setup?.rewardPerShare) ?? (target !== null && entry !== null ? target - entry : null);
  const riskReward = numberValue(row.setup?.riskRewardRatio);
  const distance = percentDistance(current, entry);
  const trendScore = numberValue(row.scoreExplanation?.trendStrength?.score) ?? (String(row.trend || "").toLowerCase().includes("up") ? 78 : 45);
  const momentumScore = numberValue(row.scoreExplanation?.momentum?.score) ?? clamp(50 + (numberValue(row.changePercent) || 0) * 6);
  const volumeScore = numberValue(row.scoreExplanation?.volumeConfirmation?.score) ?? clamp(40 + (numberValue(row.indicators?.relativeVolume) || 0) * 25);
  const volatilityScore = numberValue(row.scoreExplanation?.volatilitySuitability?.score) ?? clamp(100 - Math.abs((numberValue(row.indicators?.volatility20) || 5) - 4) * 14);
  const entryQuality = distance === null ? 20 : distance > CHASE_LIMIT_PERCENT ? 20 : distance <= READY_ENTRY_TOLERANCE_PERCENT ? 100 : clamp(100 - distance * 7);
  const rewardScore = riskReward === null ? 0 : clamp((riskReward / 3) * 100);
  const riskScore = risk !== null && entry !== null && entry > 0 ? clamp(100 - (risk / entry) * 700) : 0;
  const reversalQuality = numberValue(classification?.qualityScore) ?? 0;
  const remainingUpside = numberValue(classification?.distanceFromRecentHigh) ?? 0;
  const dataConfidence = row.marketData?.validated === false || row.dataStatus?.readyForScore === false ? 0 : clamp(row.confidence ?? row.tradingScore ?? 70);
  const freshness = setupFreshness(row, distance);
  const opportunityQuality = round(
    Number(reversalQuality) * 0.26 +
    Number(entryQuality) * 0.18 +
    Number(riskScore) * 0.16 +
    Number(rewardScore) * 0.14 +
    Number(volumeScore) * 0.1 +
    Number(dataConfidence) * 0.08 +
    Number(volatilityScore) * 0.05 +
    clamp(remainingUpside * 7) * 0.03
  );
  const currentTradeRank = round(
    Number(opportunityQuality) * 0.58 +
    Number(reversalQuality) * 0.18 +
    Number(entryQuality) * 0.14 +
    Number(rewardScore) * 0.1
  );
  return {
    trendQuality: round(trendScore),
    momentum: round(momentumScore),
    volume: round(volumeScore),
    entryQuality: round(entryQuality),
    risk: round(riskScore),
    potentialReward: round(rewardScore),
    reversalQuality: round(reversalQuality),
    dataConfidence: round(dataConfidence),
    setupFreshness: freshness,
    opportunityQuality,
    currentTradeRank,
    entryDistancePercent: round(distance, 2),
    possibleLossPerShare: risk !== null ? round(risk) : null,
    possibleFinalProfitPerShare: reward !== null ? round(reward) : null,
  };
}

function eligibility(row, settings = {}, now = new Date()) {
  const reasons = [];
  const classification = setupClassificationForRow(row);
  const current = numberValue(row.currentPrice);
  const entry = numberValue(row.setup?.plannedEntry);
  const stop = numberValue(row.setup?.stop);
  const target = numberValue(row.setup?.target);
  const riskReward = numberValue(row.setup?.riskRewardRatio);
  const volume = numberValue(row.volume);
  const volatility = numberValue(row.indicators?.volatility20);
  const candleCount = numberValue(row.candleCount ?? row.dataStatus?.actualCandleCount);
  const ageDays = latestDataAgeDays(row, now);
  const minimumScore = numberValue(settings.minimumScore) ?? 82;
  const minimumVolume = numberValue(settings.minimumDailyVolume) ?? 1_000_000;
  const minimumRiskReward = numberValue(settings.minimumRiskReward) ?? 2;
  const maximumVolatility = numberValue(settings.maximumVolatility) ?? 9;

  if (!row.dataStatus?.readyForScore) reasons.push("Market data is unavailable.");
  if (ageDays !== null && ageDays > STALE_DAILY_DATA_DAYS) reasons.push("Market data is stale.");
  if (candleCount !== null && candleCount < MINIMUM_HISTORY_CANDLES) reasons.push("There is not enough price history.");
  if (!Number.isFinite(current) || current <= 0) reasons.push("The current price is invalid.");
  if (!["NASDAQ", "NYSE", "AMEX", "US"].includes(String(row.exchange || "NASDAQ").toUpperCase())) reasons.push("The exchange is not supported for this scan.");
  if (String(row.currency || "USD").toUpperCase() !== "USD") reasons.push("The currency is not supported for this scan.");
  if (!Number.isFinite(volume) || volume < minimumVolume) reasons.push("Trading activity is too low.");
  if (!Number.isFinite(volatility) || volatility > maximumVolatility) reasons.push("The price is too volatile for the current rules.");
  if (!Number.isFinite(row.tradingScore) || row.tradingScore < minimumScore) reasons.push("The setup is not strong enough yet.");
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) reasons.push("The trade plan is incomplete.");
  if (Number.isFinite(entry) && Number.isFinite(stop) && stop >= entry) reasons.push("The safety exit is not below the buy price.");
  if (Number.isFinite(entry) && Number.isFinite(target) && target <= entry) reasons.push("The profit target is not above the buy price.");
  if (!Number.isFinite(riskReward) || riskReward < minimumRiskReward) reasons.push(`The possible profit is below ${minimumRiskReward}:1 compared with the planned loss.`);
  const distance = percentDistance(current, entry);
  if (distance !== null && distance > CHASE_LIMIT_PERCENT) reasons.push("The price has already moved materially beyond the preferred buy price.");

  return {
    eligible: reasons.length === 0,
    reasons,
    classification,
  };
}

function strategyStatus(classification, baseEligible, components, reasons = []) {
  if (!classification) return "SKIP";
  if (reasons.some((reason) => /Market data|stale|history|invalid current price/i.test(reason))) return "DATA UNAVAILABLE";
  if (reasons.some((reason) => /Trading activity|volatile|trade plan|safety exit|profit target|possible profit|exchange|currency/i.test(reason))) return "SKIP";
  if (classification.setupType === "OVEREXTENDED" || classification.overextended || reasons.some((reason) => /already moved/i.test(reason))) return "OVEREXTENDED";
  if (classification.setupType === "MOMENTUM_CONTINUATION" || classification.setupType === "BREAKOUT" || classification.setupType === "NO_SETUP") return "WAIT FOR PULLBACK";
  if (classification.setupType === "FALLING_NO_REVERSAL" || classification.reversalState === "STILL_FALLING") return "WAIT FOR REVERSAL";
  if (classification.setupType !== "PULLBACK_REVERSAL") return "SKIP";
  if (classification.reversalState !== "REVERSAL_CONFIRMED") return "REVERSAL DEVELOPING";
  if (!baseEligible) return "SKIP";
  const distance = numberValue(components.entryDistancePercent);
  if (distance !== null && distance <= READY_ENTRY_TOLERANCE_PERCENT && distance >= -2.5) return "READY";
  if (distance !== null && distance > READY_ENTRY_TOLERANCE_PERCENT) return "OVEREXTENDED";
  return "WAIT FOR REVERSAL";
}

function statusFor(row, eligible, components, reasons = [], classification = null) {
  if (!row.dataStatus?.readyForScore) return "DATA UNAVAILABLE";
  return strategyStatus(classification, eligible, components, reasons);
}

function primaryReason(status, components, classification) {
  const rr = numberValue(components.riskReward);
  if (status === "READY") return "The share has pulled back, buyers have returned, and the price is still close enough to the preferred entry.";
  if (status === "WAIT FOR REVERSAL") return "The share has pulled back, but Freedom still needs stronger evidence that the fall has reversed.";
  if (status === "REVERSAL DEVELOPING") return "The pullback is stabilising and a reversal is beginning to form, but confirmation is not complete.";
  if (status === "WAIT FOR PULLBACK") return "This is not a primary pullback reversal setup yet. Wait for a better pullback entry.";
  if (status === "OVEREXTENDED") return "The reversal entry has probably been missed because price has already moved too far from the pullback low or preferred entry.";
  if (status === "DATA UNAVAILABLE") return "Freedom cannot assess this share reliably right now.";
  if (rr !== null && rr < 2) return "The possible profit is not large enough compared with the planned loss.";
  return "This share fails one or more important trading requirements.";
}

function plainSetup(classification, status) {
  if (!classification) return ["Freedom does not have enough structure to classify this setup."];
  const lines = [];
  if (Number.isFinite(Number(classification.pullbackPercent))) {
    lines.push(`The share has fallen ${round(classification.pullbackPercent, 1)}% from its recent high.`);
  }
  if (Number.isFinite(Number(classification.pullbackLow))) {
    lines.push(`The pullback low is around ${round(classification.pullbackLow)}.`);
  }
  if (classification.reversalState === "REVERSAL_CONFIRMED") lines.push("Buyers have returned and the short-term decline has reversed.");
  else if (classification.reversalState === "REVERSAL_DEVELOPING") lines.push("A reversal is beginning to form, but it is not confirmed yet.");
  else if (classification.reversalState === "STABILISING") lines.push("Selling pressure is slowing, but the reversal is not confirmed.");
  else lines.push("The share is still falling or has not shown enough reversal evidence.");
  if (status !== "READY" && Number.isFinite(Number(classification.reversalConfirmation))) {
    lines.push(`Do not buy yet. Freedom wants confirmation around ${round(classification.reversalConfirmation)}.`);
  }
  return lines;
}

function whyRankedFirst(row, runnerUp = null) {
  const reasons = [];
  if (!runnerUp || Number(row.components?.entryQuality) >= Number(runnerUp.components?.entryQuality)) reasons.push("Better entry position.");
  if (!runnerUp || Number(row.components?.volume) >= Number(runnerUp.components?.volume)) reasons.push("Higher trading activity.");
  if (!runnerUp || Number(row.components?.risk) >= Number(runnerUp.components?.risk)) reasons.push("Lower planned downside.");
  if (!runnerUp || Number(row.components?.reversalQuality) >= Number(runnerUp.components?.reversalQuality)) reasons.push("Stronger pullback reversal evidence.");
  if (reasons.length < 2) reasons.push("Higher overall opportunity score.");
  return reasons.slice(0, 4);
}

export function rankMarketOpportunities(analysisRows = [], settings = {}, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const ranked = analysisRows.map((row) => {
    const components = scoreComponents(row);
    const check = eligibility(row, settings, now);
    const classification = check.classification;
    const status = statusFor(row, check.eligible, components, check.reasons, classification);
    const entry = numberValue(row.setup?.plannedEntry);
    const stop = numberValue(row.setup?.stop);
    const target = numberValue(row.setup?.target);
    const ready = status === "READY";
    const item = {
      symbol: row.symbol,
      ticker: row.symbol,
      companyName: row.companyName,
      company: row.companyName,
      exchange: row.exchange,
      currency: row.currency || row.marketData?.currency || "USD",
      currentPrice: round(row.currentPrice),
      tradingScore: round(components.currentTradeRank),
      opportunityScore: round(components.opportunityQuality),
      confidence: round(row.confidence),
      recommendedEntry: round(entry),
      entry: round(entry),
      preferredBuy: round(entry),
      stopLoss: round(stop),
      safetyExit: round(stop),
      target: round(target),
      takeSomeProfit: round(row.setup?.takeSomeProfit ?? target),
      finalExit: round(row.setup?.finalExit ?? target),
      riskReward: round(row.setup?.riskRewardRatio),
      possibleLossPerShare: components.possibleLossPerShare,
      possibleFinalProfitPerShare: components.possibleFinalProfitPerShare,
      entryDistancePercent: components.entryDistancePercent,
      setupClassification: classification,
      primarySetupType: classification?.setupType || "NO_SETUP",
      recentHigh: round(classification?.recentHigh),
      pullbackLow: round(classification?.pullbackLow),
      pullbackPercent: round(classification?.pullbackPercent),
      pullbackDuration: classification?.pullbackDuration ?? null,
      riseFromPullbackLow: round(classification?.riseFromPullbackLow),
      distanceFromRecentHigh: round(classification?.distanceFromRecentHigh),
      reversalState: classification?.reversalState || "STILL_FALLING",
      reversalConfirmation: round(classification?.reversalConfirmation),
      distanceFromPreferredEntry: round(classification?.distanceFromPreferredEntry),
      status,
      qualified: ready,
      eligible: ready,
      eligibilityReasons: check.reasons,
      components,
      reason: primaryReason(status, { ...components, riskReward: row.setup?.riskRewardRatio }, classification),
      plainEnglish: [...plainSetup(classification, status), plainVolume(row), Number(row.setup?.riskRewardRatio) >= 2 ? `The possible profit is approximately ${round(row.setup.riskRewardRatio, 1)} times the planned loss.` : "The possible profit is not yet large enough compared with the planned loss."],
      setupType: classification?.setupType || "NO_SETUP",
      dataStatus: row.dataStatus,
      marketData: row.marketData,
      source: row,
    };
    return item;
  });

  ranked.sort((a, b) => {
    const statusWeight = { READY: 400, "REVERSAL DEVELOPING": 260, "WAIT FOR REVERSAL": 220, "WAIT FOR PULLBACK": 120, OVEREXTENDED: 80, SKIP: 10, "DATA UNAVAILABLE": 0 };
    const delta = (statusWeight[b.status] || 0) - (statusWeight[a.status] || 0);
    if (delta) return delta;
    const scoreDelta = Number(b.tradingScore || 0) - Number(a.tradingScore || 0);
    if (scoreDelta) return scoreDelta;
    return String(a.symbol).localeCompare(String(b.symbol));
  });

  const eligibleRows = ranked.filter((row) => row.eligible);
  const displayableRows = options.includeDevelopingTopFive
    ? ranked.filter((row) => !["SKIP", "DATA UNAVAILABLE"].includes(row.status))
    : eligibleRows;
  const topFive = displayableRows.slice(0, 5);
  const bestCurrentTrade = ranked.find((row) => row.status === "READY") || null;
  const bestSetupToWatch = ranked.find((row) => ["REVERSAL DEVELOPING", "WAIT FOR REVERSAL", "WAIT FOR PULLBACK", "OVEREXTENDED"].includes(row.status)) || null;
  const topOpportunity = bestCurrentTrade || bestSetupToWatch || null;
  if (topOpportunity) topOpportunity.whyRankedFirst = whyRankedFirst(topOpportunity, ranked.find((row) => row.symbol !== topOpportunity.symbol));
  const bestTradePlan = buildFreedomTradePlan(bestCurrentTrade, options.account || {}, options.positionSettings || settings);

  return {
    ranked,
    eligible: eligibleRows,
    qualified: eligibleRows,
    topFive,
    bestCurrentTrade,
    bestSetupToWatch,
    topOpportunity,
    bestTradePlan,
    qualifiedCount: eligibleRows.length,
  };
}
