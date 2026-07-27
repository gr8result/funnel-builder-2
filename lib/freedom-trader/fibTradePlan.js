// Pure, testable Fibonacci retracement -> trade-plan logic for Freedom
// Trader's company chart. Kept independent of React/ECharts so it can be
// unit tested directly (see test/freedom-trader-fib-trade-plan.test.js).
//
// Convention (matches how the chart already renders 0%/100%, and how a
// trader reads it): for a BULLISH setup, 0% = the swing low, 100% = the
// swing high -- you buy a pullback between them and target a continuation
// back to/through the high. For a BEARISH setup it is inverted: 0% = the
// swing high, 100% = the swing low. Extensions (>100%) continue past the
// 100% anchor in the direction of the trade.
export const FIB_RETRACEMENT_LEVELS = [
  { key: "0", ratio: 0, label: "0%", extension: false },
  { key: "236", ratio: 0.236, label: "23.6%", extension: false },
  { key: "382", ratio: 0.382, label: "38.2%", extension: false },
  { key: "500", ratio: 0.5, label: "50%", extension: false },
  { key: "618", ratio: 0.618, label: "61.8%", extension: false },
  { key: "786", ratio: 0.786, label: "78.6%", extension: false },
  { key: "1000", ratio: 1, label: "100%", extension: false },
];

export const FIB_EXTENSION_LEVELS = [
  { key: "1272", ratio: 1.272, label: "127.2%", extension: true },
  { key: "1382", ratio: 1.382, label: "138.2%", extension: true },
  { key: "1618", ratio: 1.618, label: "161.8%", extension: true },
  { key: "2000", ratio: 2, label: "200%", extension: true },
];

export const DEFAULT_SAFETY_BUFFER_PERCENT = 1;
export const DEFAULT_MINIMUM_RISK_REWARD = 2;

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

export function detectDirectionFromTrend(trend) {
  return /down/i.test(String(trend || "")) ? "bearish" : "bullish";
}

function swingRange(anchor1Price, anchor2Price) {
  const p1 = Number(anchor1Price);
  const p2 = Number(anchor2Price);
  if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 === p2) return null;
  return { low: Math.min(p1, p2), high: Math.max(p1, p2) };
}

// direction: "bullish" | "bearish". Bullish: 0%=low, 100%=high (and beyond).
// Bearish: 0%=high, 100%=low (and beyond).
export function fibPriceForRatio(anchor1Price, anchor2Price, ratio, direction = "bullish") {
  const range = swingRange(anchor1Price, anchor2Price);
  if (!range) return null;
  const { low, high } = range;
  const price = direction === "bearish" ? high - (high - low) * ratio : low + (high - low) * ratio;
  return round(price);
}

export function computeFibLevels({ anchor1Price, anchor2Price, direction = "bullish", includeExtensions = false }) {
  const levels = includeExtensions ? [...FIB_RETRACEMENT_LEVELS, ...FIB_EXTENSION_LEVELS] : FIB_RETRACEMENT_LEVELS;
  return levels
    .map((level) => ({ ...level, price: fibPriceForRatio(anchor1Price, anchor2Price, level.ratio, direction) }))
    .filter((level) => Number.isFinite(level.price));
}

// Bullish: stopLoss < entry < target1 <= target2 (target2 optional)
// Bearish: stopLoss > entry > target1 >= target2 (target2 optional)
export function validateLevelOrder(direction, { entry, stop, target, target2 } = {}) {
  if (![entry, stop, target].every(Number.isFinite)) {
    return { valid: false, reason: "Entry, stop-loss and target 1 must all be set." };
  }
  const bearish = direction === "bearish";
  if (bearish ? !(stop > entry) : !(stop < entry)) {
    return { valid: false, reason: `Stop-loss must be ${bearish ? "above" : "below"} entry for a ${bearish ? "bearish" : "bullish"} trade.` };
  }
  if (bearish ? !(entry > target) : !(entry < target)) {
    return { valid: false, reason: `Target 1 must be ${bearish ? "below" : "above"} entry for a ${bearish ? "bearish" : "bullish"} trade.` };
  }
  if (Number.isFinite(target2) && (bearish ? !(target >= target2) : !(target <= target2))) {
    return { valid: false, reason: `Target 2 must be ${bearish ? "at or below" : "at or above"} Target 1 for a ${bearish ? "bearish" : "bullish"} trade.` };
  }
  return { valid: true, reason: null };
}

export function riskRewardFor(direction, { entry, stop, target } = {}) {
  if (![entry, stop, target].every(Number.isFinite)) return null;
  const risk = direction === "bearish" ? stop - entry : entry - stop;
  const reward = direction === "bearish" ? entry - target : target - entry;
  if (!(risk > 0)) return null;
  return round(reward / risk, 3);
}

// Picks the retracement level (38.2/50/61.8%) nearest the analysed entry
// zone when one is available, otherwise defaults to 50%.
function pickEntryLevel(levels, analysisEntry) {
  const candidates = ["382", "500", "618"].map((key) => levels.find((level) => level.key === key)).filter((level) => level && Number.isFinite(level.price));
  if (!candidates.length) return null;
  // Absent an analysed entry zone, default to the shallowest pullback
  // (38.2%) -- it keeps risk smallest relative to a target back at the
  // 100% level, per the stated preference order (38.2%, 50%, 61.8%).
  if (!Number.isFinite(analysisEntry)) return candidates.find((level) => level.key === "382") || candidates[0];
  return candidates.reduce((best, level) => (Math.abs(level.price - analysisEntry) < Math.abs(best.price - analysisEntry) ? level : best));
}

// Generates a full Entry/Stop/Target1/Target2 plan from a drawn Fib range.
// Never returns a plan below the minimum risk/reward -- callers must check
// `valid` before applying the result.
export function generateFibTradePlan({
  anchor1Price,
  anchor2Price,
  direction = "bullish",
  analysisEntry = null,
  analysisTarget = null,
  analysisSupport = null,
  analysisResistance = null,
  safetyBufferPercent = DEFAULT_SAFETY_BUFFER_PERCENT,
  minimumRiskReward = DEFAULT_MINIMUM_RISK_REWARD,
} = {}) {
  const range = swingRange(anchor1Price, anchor2Price);
  if (!range) return { valid: false, reason: "Draw a Fibonacci range with two distinct price anchors first." };

  const levels = computeFibLevels({ anchor1Price, anchor2Price, direction, includeExtensions: true });
  const findLevel = (key) => levels.find((level) => level.key === key)?.price ?? null;
  const zeroLevel = findLevel("0");
  const hundredLevel = findLevel("1000");
  const bearish = direction === "bearish";

  const entryLevel = pickEntryLevel(levels, analysisEntry);
  const entry = entryLevel?.price ?? null;
  if (!Number.isFinite(entry)) return { valid: false, reason: "Unable to determine a retracement entry level." };

  const buffer = Math.max(0, Number(safetyBufferPercent) || 0) / 100;
  const bufferedZeroStop = Number.isFinite(zeroLevel) ? round(bearish ? zeroLevel * (1 + buffer) : zeroLevel * (1 - buffer)) : null;
  const structuralStop = bearish
    ? (Number.isFinite(analysisResistance) ? round(analysisResistance * (1 + buffer)) : null)
    : (Number.isFinite(analysisSupport) ? round(analysisSupport * (1 - buffer)) : null);
  // The "safer" stop is the one further from entry (less likely to be
  // stopped out by ordinary noise), i.e. lower for bullish, higher for
  // bearish.
  const stopCandidates = [bufferedZeroStop, structuralStop].filter(Number.isFinite);
  const stop = stopCandidates.length ? (bearish ? Math.max(...stopCandidates) : Math.min(...stopCandidates)) : null;
  if (!Number.isFinite(stop)) return { valid: false, reason: "Unable to determine a stop-loss level." };

  // Target 1: prefer the analysed resistance/support-based target when it's
  // more conservative (closer, so more achievable) than the raw 100% level;
  // otherwise use the 100% level.
  const target1Candidates = [hundredLevel, analysisTarget].filter((value) => Number.isFinite(value) && (bearish ? value < entry : value > entry));
  const target = target1Candidates.length
    ? (bearish ? Math.max(...target1Candidates) : Math.min(...target1Candidates))
    : hundredLevel;
  if (!Number.isFinite(target)) return { valid: false, reason: "Unable to determine a Target 1 level." };

  const extensionKey = bearish ? "1618" : "1272";
  const fallbackExtensionKey = bearish ? "1272" : "1618";
  const target2 = findLevel(extensionKey) ?? findLevel(fallbackExtensionKey) ?? null;

  const order = validateLevelOrder(direction, { entry, stop, target, target2 });
  if (!order.valid) return { valid: false, reason: order.reason };

  const riskReward = riskRewardFor(direction, { entry, stop, target });
  if (!Number.isFinite(riskReward) || riskReward < minimumRiskReward) {
    return { valid: false, reason: `Risk/reward from this Fib range is ${Number.isFinite(riskReward) ? riskReward.toFixed(2) : "undefined"}:1, below the required ${minimumRiskReward}:1 minimum.` };
  }

  return {
    valid: true,
    reason: null,
    direction,
    entry: round(entry),
    stop: round(stop),
    target: round(target),
    target2: Number.isFinite(target2) ? round(target2) : null,
    riskReward,
    entryFibLabel: entryLevel?.label || null,
  };
}

// Position sizing / P&L, shared by both the fib-generated plan and any
// manually assigned levels. Mirrors the required formulas exactly:
//   riskPerShare = |entry - stopLoss|
//   maximumRiskAmount = accountBalance * riskPercent
//   quantity = floor(maximumRiskAmount / riskPerShare)
//   positionValue = quantity * entryPrice
export function calculatePositionMetrics({
  direction = "bullish",
  entry,
  stop,
  target,
  target2 = null,
  portfolioValue = 0,
  maxRiskPercent = 1,
  tradingCapital = 0,
  maxPositionValue = null,
} = {}) {
  if (![entry, stop, target].every(Number.isFinite)) {
    return { riskReward: null, riskRewardTarget2: null, percentageReturn: null, expectedProfit: null, expectedProfitTarget2: null, maximumLoss: null, capitalRequired: null, positionSize: 0, riskLimit: null };
  }
  const bearish = direction === "bearish";
  const riskPerShare = bearish ? stop - entry : entry - stop;
  const rewardPerShare = bearish ? entry - target : target - entry;
  const rewardPerShareTarget2 = Number.isFinite(target2) ? (bearish ? entry - target2 : target2 - entry) : null;
  const riskLimit = round((Number(portfolioValue) || 0) * ((Number(maxRiskPercent) || 0) / 100));
  const riskSizedShares = riskPerShare > 0 ? Math.max(0, Math.floor(riskLimit / riskPerShare)) : 0;
  const capitalSizedShares = entry > 0 ? Math.max(0, Math.floor((Number(tradingCapital) || 0) / entry)) : 0;
  let positionSize = Math.min(riskSizedShares, capitalSizedShares);
  if (Number.isFinite(maxPositionValue) && maxPositionValue > 0 && entry > 0) {
    positionSize = Math.min(positionSize, Math.floor(maxPositionValue / entry));
  }
  return {
    riskReward: riskPerShare > 0 ? round(rewardPerShare / riskPerShare, 3) : null,
    riskRewardTarget2: riskPerShare > 0 && Number.isFinite(rewardPerShareTarget2) ? round(rewardPerShareTarget2 / riskPerShare, 3) : null,
    percentageReturn: entry > 0 ? round((rewardPerShare / entry) * 100) : null,
    expectedProfit: round(positionSize * rewardPerShare),
    expectedProfitTarget2: Number.isFinite(rewardPerShareTarget2) ? round(positionSize * rewardPerShareTarget2) : null,
    maximumLoss: round(positionSize * riskPerShare),
    capitalRequired: round(positionSize * entry),
    positionSize,
    riskLimit,
  };
}
