/**
 * Mode/setup classification and the actionability state machine.
 *
 * Three separate jobs, deliberately kept apart so none of them can silently
 * stand in for another:
 *
 *   1. classifyMode()   - Engine 1 only: MOMENTUM vs CRASH_REBOUND.
 *   2. classifySetupType() - Engine 2 only: which of the 8 setup types fits,
 *      first-match-wins over an explicit priority list. Returns null
 *      ("NO_CLEAR_SETUP") rather than guessing when nothing fits - a stock
 *      does not get labelled MOMENTUM by default just because nothing else matched.
 *   3. classifyActionability() - both engines: the ACTIONABLE SETUP / NEAR ENTRY /
 *      WATCH / INSUFFICIENT EVIDENCE / REJECT state, from explicit numeric
 *      thresholds only. No branch here defaults to WATCH "because markets are
 *      uncertain" - every branch is a named, testable condition.
 */

const BIG_DECLINE_THRESHOLD = -50; // percent

export function classifyMode({ priceChange90dPercent, priceChange365dPercent } = {}) {
  const known = [priceChange90dPercent, priceChange365dPercent].filter(Number.isFinite);
  if (!known.length) return null; // INSUFFICIENT DATA - caller must not assume MOMENTUM
  const bigDecline = known.some((value) => value <= BIG_DECLINE_THRESHOLD);
  return bigDecline ? "CRASH_REBOUND" : "MOMENTUM";
}

/**
 * @param {Object} signals
 * @param {Object} [signals.technical]  { breakoutConfirmed, pullbackConfirmed, rsi14, relativeVolume }
 * @param {Object} [signals.catalystInfo]  { hasEarningsWithin14Days, hasMajorConfirmedCatalystWithin90Days }
 * @param {boolean} [signals.bigDecline]
 * @param {boolean} [signals.improvingFundamentals]
 * @param {string} [signals.survivalRiskLevel]
 * @param {number|null} [signals.companyQualityScore]
 * @param {boolean} [signals.valuationReasonableForGrowth]
 * @param {number} [signals.revenueGrowthPercent]
 * @returns {string|null}  one of the 8 setup types, or null when none fit
 */
export function classifySetupType(signals = {}) {
  const t = signals.technical || {};
  const c = signals.catalystInfo || {};

  if (c.hasEarningsWithin14Days) return "EARNINGS";
  if (c.hasMajorConfirmedCatalystWithin90Days) return "CATALYST";
  if (t.breakoutConfirmed === true) return "BREAKOUT";
  if (signals.bigDecline && signals.improvingFundamentals && signals.survivalRiskLevel !== "EXTREME") return "RECOVERY_TURNAROUND";
  if (t.pullbackConfirmed === true && Number.isFinite(signals.companyQualityScore) && signals.companyQualityScore >= 70) return "QUALITY_PULLBACK";
  if (Number.isFinite(t.rsi14) && t.rsi14 <= 30 && !t.breakoutConfirmed && !t.pullbackConfirmed) return "VALUE_OVERSOLD";
  if (Number.isFinite(signals.revenueGrowthPercent) && signals.revenueGrowthPercent >= 20 && signals.valuationReasonableForGrowth === true) return "GROWTH_AT_REASONABLE_VALUATION";
  if (Number.isFinite(t.relativeVolume) && t.relativeVolume >= 1.5 && Number.isFinite(signals.priceChange30dPercent) && signals.priceChange30dPercent > 0) return "MOMENTUM";
  return null;
}

export const SETUP_TYPE_LABELS = Object.freeze({
  VALUE_OVERSOLD: "VALUE / OVERSOLD",
  QUALITY_PULLBACK: "QUALITY PULLBACK",
  BREAKOUT: "BREAKOUT",
  CATALYST: "CATALYST",
  EARNINGS: "EARNINGS",
  RECOVERY_TURNAROUND: "RECOVERY / TURNAROUND",
  MOMENTUM: "MOMENTUM",
  GROWTH_AT_REASONABLE_VALUATION: "GROWTH AT REASONABLE VALUATION",
});

/**
 * A concrete entry/invalidation/target plan, or null when the inputs cannot
 * support one honestly. Never invents a level - see spec section "do not
 * manufacture entry/exit levels when market data does not support them".
 */
export function buildEntryPlan({ currentPrice, entryZoneLow, entryZoneHigh, invalidationLevel, initialTarget, secondaryTarget } = {}) {
  const required = [currentPrice, entryZoneLow, entryZoneHigh, invalidationLevel, initialTarget];
  if (!required.every(Number.isFinite)) return null;
  if (invalidationLevel >= entryZoneLow) return null; // invalidation must sit below the entry zone
  if (initialTarget <= entryZoneHigh) return null; // target must sit above the entry zone
  const risk = entryZoneLow - invalidationLevel;
  const reward = initialTarget - entryZoneHigh;
  return {
    currentPrice,
    entryZoneLow,
    entryZoneHigh,
    invalidationLevel,
    initialTarget,
    secondaryTarget: Number.isFinite(secondaryTarget) && secondaryTarget > initialTarget ? secondaryTarget : null,
    riskRewardRatio: risk > 0 ? Number((reward / risk).toFixed(2)) : null,
    priceInsideEntryZone: currentPrice >= entryZoneLow && currentPrice <= entryZoneHigh,
  };
}

export const ACTIONABILITY_STATES = Object.freeze([
  "ACTIONABLE SETUP",
  "NEAR ENTRY",
  "WATCH",
  "INSUFFICIENT EVIDENCE",
  "REJECT",
]);

/**
 * @param {Object} evidence
 * @param {number} evidence.opportunityScore
 * @param {number|null} evidence.timingScore
 * @param {number|null} evidence.companyQualityScore
 * @param {string} evidence.confidenceLevel  HIGH|MEDIUM|LOW
 * @param {number} evidence.componentsWithData  how many of the 8 opportunity components had any data (0-8)
 * @param {string|null} evidence.survivalRiskLevel
 * @param {boolean} [evidence.disqualifyingRedFlag]
 * @param {Object|null} evidence.entryPlan  result of buildEntryPlan(), or null
 * @returns {{ state: string, message: string }}
 */
export function classifyActionability(evidence = {}) {
  const {
    opportunityScore, timingScore = null, companyQualityScore = null, confidenceLevel,
    componentsWithData = 0, survivalRiskLevel = null, disqualifyingRedFlag = false, entryPlan = null,
  } = evidence;

  if (confidenceLevel === "LOW" || componentsWithData < 3) {
    return { state: "INSUFFICIENT EVIDENCE", message: "Not enough verifiable data to reach a conclusion. Freedom will not guess." };
  }

  if (opportunityScore < 55 || survivalRiskLevel === "EXTREME" || disqualifyingRedFlag) {
    return { state: "REJECT", message: opportunityScore < 55 ? "Opportunity Score is below the evidence threshold." : "A disqualifying survival or red-flag risk was found." };
  }

  const goodOpportunity = opportunityScore >= 70;
  const goodTiming = timingScore !== null && timingScore >= 70;
  const nearTiming = timingScore !== null && timingScore >= 50 && timingScore < 70;
  const hasEntryPlan = Boolean(entryPlan);

  if (goodOpportunity && goodTiming && hasEntryPlan) {
    return { state: "ACTIONABLE SETUP", message: "Quantitative, fundamental and timing conditions are all satisfied." };
  }
  if (goodOpportunity && nearTiming && hasEntryPlan) {
    return { state: "NEAR ENTRY", message: "The opportunity qualifies, but price has not reached the entry zone yet." };
  }
  if (Number.isFinite(companyQualityScore) && companyQualityScore >= 70 && timingScore !== null && timingScore < 50) {
    return { state: "WATCH", message: "WATCH — GOOD COMPANY, WRONG ENTRY. Fundamentals are strong but timing evidence is weak." };
  }
  return { state: "WATCH", message: "Interesting but conditions are not yet fully confirmed." };
}
