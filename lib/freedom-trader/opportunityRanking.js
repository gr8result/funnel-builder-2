const READY_ENTRY_TOLERANCE_PERCENT = 0.75;
const CHASE_LIMIT_PERCENT = 10;
const STALE_DAILY_DATA_DAYS = 7;
const MINIMUM_HISTORY_CANDLES = 200;

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
  const dataConfidence = row.marketData?.validated === false || row.dataStatus?.readyForScore === false ? 0 : clamp(row.confidence ?? row.tradingScore ?? 70);
  const freshness = setupFreshness(row, distance);
  const opportunityQuality = round(
    Number(trendScore) * 0.22 +
    Number(momentumScore) * 0.18 +
    Number(volumeScore) * 0.14 +
    Number(entryQuality) * 0.16 +
    Number(riskScore) * 0.1 +
    Number(rewardScore) * 0.12 +
    Number(dataConfidence) * 0.08
  );
  const currentTradeRank = round(
    Number(opportunityQuality) * 0.52 +
    Number(entryQuality) * 0.2 +
    Number(rewardScore) * 0.16 +
    Number(freshness) * 0.12
  );
  return {
    trendQuality: round(trendScore),
    momentum: round(momentumScore),
    volume: round(volumeScore),
    entryQuality: round(entryQuality),
    risk: round(riskScore),
    potentialReward: round(rewardScore),
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
  };
}

function statusFor(row, eligible, components, reasons = []) {
  if (!row.dataStatus?.readyForScore) return "DATA UNAVAILABLE";
  if (reasons.some((reason) => /already moved/i.test(reason))) return "SKIP";
  if (!eligible) return Number(row.tradingScore) >= 70 ? "DEVELOPING" : "SKIP";
  const distance = numberValue(components.entryDistancePercent);
  if (distance !== null && distance <= READY_ENTRY_TOLERANCE_PERCENT) return "READY";
  return "WAIT";
}

function primaryReason(status, components) {
  const rr = numberValue(components.riskReward);
  if (status === "READY") return "All trading rules pass and the price is inside the permitted buy area.";
  if (status === "WAIT") return "Strong setup, but the price has not reached the preferred buy area.";
  if (status === "DEVELOPING") return "Some trading rules pass, but the setup is not ready for action.";
  if (status === "DATA UNAVAILABLE") return "Freedom cannot assess this share reliably right now.";
  if (rr !== null && rr < 2) return "The possible profit is not large enough compared with the planned loss.";
  return "This share fails one or more important trading requirements.";
}

function whyRankedFirst(row, runnerUp = null) {
  const reasons = [];
  if (!runnerUp || Number(row.components?.entryQuality) >= Number(runnerUp.components?.entryQuality)) reasons.push("Better entry position.");
  if (!runnerUp || Number(row.components?.volume) >= Number(runnerUp.components?.volume)) reasons.push("Higher trading activity.");
  if (!runnerUp || Number(row.components?.risk) >= Number(runnerUp.components?.risk)) reasons.push("Lower planned downside.");
  if (!runnerUp || Number(row.components?.momentum) >= Number(runnerUp.components?.momentum)) reasons.push("Stronger current momentum.");
  if (reasons.length < 2) reasons.push("Higher overall opportunity score.");
  return reasons.slice(0, 4);
}

export function rankMarketOpportunities(analysisRows = [], settings = {}, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const ranked = analysisRows.map((row) => {
    const components = scoreComponents(row);
    const check = eligibility(row, settings, now);
    const status = statusFor(row, check.eligible, components, check.reasons);
    const entry = numberValue(row.setup?.plannedEntry);
    const stop = numberValue(row.setup?.stop);
    const target = numberValue(row.setup?.target);
    const item = {
      symbol: row.symbol,
      ticker: row.symbol,
      companyName: row.companyName,
      company: row.companyName,
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
      takeSomeProfit: round(target),
      finalExit: round(target),
      riskReward: round(row.setup?.riskRewardRatio),
      possibleLossPerShare: components.possibleLossPerShare,
      possibleFinalProfitPerShare: components.possibleFinalProfitPerShare,
      entryDistancePercent: components.entryDistancePercent,
      status,
      qualified: check.eligible,
      eligible: check.eligible,
      eligibilityReasons: check.reasons,
      components,
      reason: primaryReason(status, { ...components, riskReward: row.setup?.riskRewardRatio }),
      plainEnglish: [plainTrend(row), plainMomentum(row), plainVolume(row), Number(row.setup?.riskRewardRatio) >= 2 ? `The possible profit is approximately ${round(row.setup.riskRewardRatio, 1)} times the planned loss.` : "The possible profit is not yet large enough compared with the planned loss."],
      setupType: String(row.setup?.setupReasoning || "").toLowerCase().includes("breakout") ? "Breakout" : "Pullback",
      dataStatus: row.dataStatus,
      marketData: row.marketData,
      source: row,
    };
    return item;
  });

  ranked.sort((a, b) => {
    const statusWeight = { READY: 300, WAIT: 200, DEVELOPING: 80, SKIP: 10, "DATA UNAVAILABLE": 0 };
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
  const bestSetupToWatch = ranked.find((row) => row.status === "WAIT") || null;
  const topOpportunity = bestCurrentTrade || bestSetupToWatch || null;
  if (topOpportunity) topOpportunity.whyRankedFirst = whyRankedFirst(topOpportunity, ranked.find((row) => row.symbol !== topOpportunity.symbol));

  return {
    ranked,
    eligible: eligibleRows,
    qualified: eligibleRows,
    topFive,
    bestCurrentTrade,
    bestSetupToWatch,
    topOpportunity,
    qualifiedCount: eligibleRows.length,
  };
}
