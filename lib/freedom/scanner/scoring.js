/**
 * The explainable 0-100 Opportunity Score (spec section 8), plus the three
 * companion axes added later - Company Quality, Timing, Risk (spec: "do not
 * confuse quality with timing").
 *
 * Every component is a pure function of already-derived signals (catalysts.js,
 * dilution.js, survival.js output, plus flat fundamentals/technical inputs). No
 * component invents a value for a field it was not given - an unmeasured
 * component scores 0 and says so in its `reasons`, it never assumes an average
 * or a pass. This is what keeps "do not simply add points because a stock is
 * cheap" true structurally, not just as a comment.
 */

import { primaryCatalyst } from "./catalysts.js";

const WEIGHTS = Object.freeze({
  catalyst: 20,
  survival: 20,
  dilution: 15,
  business: 10,
  valuation: 10,
  revenueOps: 10,
  insiderInstitutional: 5,
  liquidity: 10,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : 0;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function componentCatalyst(catalysts = []) {
  const max = WEIGHTS.catalyst;
  const best = primaryCatalyst(catalysts);
  if (!best) return { id: "catalyst", label: "Catalyst strength", points: 0, max, reasons: ["No identified catalyst."] };

  const daysOut = timingDaysOut(best.timing);
  let points;
  let horizon;
  if (best.classification === "CONFIRMED") {
    if (daysOut !== null && daysOut <= 90) { points = 20; horizon = "within 90 days"; }
    else if (daysOut !== null && daysOut <= 180) { points = 16; horizon = "within 6 months"; }
    else { points = 12; horizon = daysOut === null ? "timing undisclosed" : "beyond 6 months"; }
  } else {
    if (daysOut !== null && daysOut <= 90) { points = 10; horizon = "within 90 days"; }
    else { points = 6; horizon = daysOut === null ? "timing undisclosed" : "beyond 90 days"; }
  }
  return {
    id: "catalyst",
    label: "Catalyst strength",
    points: clamp(points, 0, max),
    max,
    reasons: [`Primary catalyst "${best.catalyst}" is ${best.classification} (${horizon}), source: ${best.source || "unspecified"}.`],
  };
}

export function componentSurvival(survivalAssessment = {}) {
  const max = WEIGHTS.survival;
  if (!survivalAssessment.dataAvailable) {
    return { id: "survival", label: "Financial survival / cash runway", points: 0, max, reasons: ["Insufficient data to assess cash runway or debt load."] };
  }
  const points = round(max * (1 - survivalAssessment.fraction), 1);
  return {
    id: "survival",
    label: "Financial survival / cash runway",
    points: clamp(points, 0, max),
    max,
    reasons: [`Survival risk rated ${survivalAssessment.level} from ${survivalAssessment.factors.length} known factor(s).`],
  };
}

export function componentDilution(dilutionAssessment = {}) {
  const max = WEIGHTS.dilution;
  if (!dilutionAssessment.dataAvailable) {
    return { id: "dilution", label: "Dilution / share-structure quality", points: 0, max, reasons: ["Insufficient data to assess share-structure quality."] };
  }
  const points = round(max * (1 - dilutionAssessment.fraction), 1);
  return {
    id: "dilution",
    label: "Dilution / share-structure quality",
    points: clamp(points, 0, max),
    max,
    reasons: [`Dilution risk rated ${dilutionAssessment.level} from ${dilutionAssessment.factors.length} known factor(s).`],
  };
}

export function componentBusinessOpportunity({ catalystMateriality, sectorGrowthTag } = {}) {
  const max = WEIGHTS.business;
  if (!catalystMateriality && !sectorGrowthTag) {
    return { id: "business", label: "Business / market opportunity", points: 0, max, reasons: ["Insufficient data to assess the size of the opportunity."] };
  }
  const materialityPoints = { MAJOR: 6, MODERATE: 4, MINOR: 2 }[catalystMateriality] || 0;
  const sectorPoints = { HIGH: 4, AVERAGE: 2, LOW: 0 }[sectorGrowthTag] || 0;
  const points = clamp(materialityPoints + sectorPoints, 0, max);
  return {
    id: "business",
    label: "Business / market opportunity",
    points,
    max,
    reasons: [
      catalystMateriality ? `Catalyst materiality: ${catalystMateriality}.` : "Catalyst materiality unknown.",
      sectorGrowthTag ? `Sector growth profile: ${sectorGrowthTag}.` : "Sector growth profile unknown.",
    ],
  };
}

export function componentValuation({ currentPrice, week52High } = {}) {
  const max = WEIGHTS.valuation;
  if (!Number.isFinite(currentPrice) || !Number.isFinite(week52High) || week52High <= 0) {
    return { id: "valuation", label: "Valuation / upside setup", points: 0, max, reasons: ["Insufficient data (missing price or 52-week high) to assess valuation setup."] };
  }
  const percentBelowHigh = clamp(((week52High - currentPrice) / week52High) * 100, 0, 100);
  let points;
  if (percentBelowHigh < 20) points = 3;
  else if (percentBelowHigh < 50) points = 6;
  else if (percentBelowHigh < 80) points = 8;
  else points = 5; // extreme discount alone is not automatically "more attractive" - see spec section 5/CRASH engine
  return {
    id: "valuation",
    label: "Valuation / upside setup",
    points: clamp(points, 0, max),
    max,
    reasons: [`Trading ${round(percentBelowHigh)}% below its 52-week high of ${round(week52High)}.`],
  };
}

export function componentRevenueOperations({ revenueGrowthPercent, operatingCashFlow, operatingCashFlowPriorPeriod, netLossNarrowing } = {}) {
  const max = WEIGHTS.revenueOps;
  const reasons = [];
  let points = 0;
  let any = false;

  if (Number.isFinite(revenueGrowthPercent)) {
    any = true;
    if (revenueGrowthPercent >= 30) points += 5;
    else if (revenueGrowthPercent >= 10) points += 3;
    else if (revenueGrowthPercent >= 0) points += 1;
    reasons.push(`Revenue growth: ${round(revenueGrowthPercent)}%.`);
  }
  if (Number.isFinite(operatingCashFlow) && Number.isFinite(operatingCashFlowPriorPeriod)) {
    any = true;
    if (operatingCashFlow > operatingCashFlowPriorPeriod) points += 3;
    else if (operatingCashFlow === operatingCashFlowPriorPeriod) points += 1;
    reasons.push(`Operating cash flow trend: ${operatingCashFlow > operatingCashFlowPriorPeriod ? "improving" : operatingCashFlow === operatingCashFlowPriorPeriod ? "flat" : "worsening"}.`);
  }
  if (typeof netLossNarrowing === "boolean") {
    any = true;
    if (netLossNarrowing) points += 2;
    reasons.push(netLossNarrowing ? "Net loss is narrowing." : "Net loss is not narrowing.");
  }

  if (!any) return { id: "revenueOps", label: "Revenue / operational progress", points: 0, max, reasons: ["Insufficient data to assess operational progress."] };
  return { id: "revenueOps", label: "Revenue / operational progress", points: clamp(points, 0, max), max, reasons };
}

export function componentInsiderInstitutional({ insiderOwnershipPercent, recentInsiderNetBuying, institutionalOwnershipTrend } = {}) {
  const max = WEIGHTS.insiderInstitutional;
  const reasons = [];
  let points = 0;
  let any = false;

  if (Number.isFinite(insiderOwnershipPercent)) {
    any = true;
    if (insiderOwnershipPercent > 10) points += 2;
    else if (insiderOwnershipPercent >= 3) points += 1;
    reasons.push(`Insider ownership: ${round(insiderOwnershipPercent)}%.`);
  }
  if (typeof recentInsiderNetBuying === "boolean") {
    any = true;
    if (recentInsiderNetBuying) points += 2;
    reasons.push(recentInsiderNetBuying ? "Recent insider net buying." : "No recent insider net buying.");
  }
  if (institutionalOwnershipTrend) {
    any = true;
    if (institutionalOwnershipTrend === "INCREASING") points += 1;
    reasons.push(`Institutional ownership trend: ${institutionalOwnershipTrend}.`);
  }

  if (!any) return { id: "insiderInstitutional", label: "Insider / institutional evidence", points: 0, max, reasons: ["Insufficient data to assess insider/institutional activity."] };
  return { id: "insiderInstitutional", label: "Insider / institutional evidence", points: clamp(points, 0, max), max, reasons };
}

export function componentLiquidityMomentum({ averageDollarVolume, relativeVolume, priceChange30dPercent } = {}) {
  const max = WEIGHTS.liquidity;
  const reasons = [];
  let points = 0;
  let any = false;

  if (Number.isFinite(averageDollarVolume)) {
    any = true;
    if (averageDollarVolume >= 2_000_000) points += 4;
    else if (averageDollarVolume >= 500_000) points += 3;
    else if (averageDollarVolume >= 100_000) points += 1;
    reasons.push(`Average dollar volume: ${Math.round(averageDollarVolume).toLocaleString("en-US")}.`);
  }
  if (Number.isFinite(relativeVolume)) {
    any = true;
    if (relativeVolume >= 2) points += 3;
    else if (relativeVolume >= 1.3) points += 1.5;
    reasons.push(`Relative volume: ${round(relativeVolume)}x.`);
  }
  if (Number.isFinite(priceChange30dPercent)) {
    any = true;
    if (priceChange30dPercent >= 20) points += 3;
    else if (priceChange30dPercent > 0) points += 1.5;
    reasons.push(`30-day price change: ${round(priceChange30dPercent)}%.`);
  }

  if (!any) return { id: "liquidity", label: "Liquidity / momentum", points: 0, max, reasons: ["Insufficient data to assess liquidity or momentum."] };
  return { id: "liquidity", label: "Liquidity / momentum", points: clamp(round(points), 0, max), max, reasons };
}

// ---------------------------------------------------------------------------
// Opportunity Score assembly + classification bands (spec section 8)
// ---------------------------------------------------------------------------

export function computeOpportunityScore(signals = {}) {
  const components = [
    componentCatalyst(signals.catalysts),
    componentSurvival(signals.survival),
    componentDilution(signals.dilution),
    componentBusinessOpportunity(signals.business),
    componentValuation(signals.valuation),
    componentRevenueOperations(signals.revenueOps),
    componentInsiderInstitutional(signals.insiderInstitutional),
    componentLiquidityMomentum(signals.liquidity),
  ];
  const total = clamp(round(components.reduce((sum, c) => sum + c.points, 0)), 0, 100);
  return { total, components };
}

/**
 * Confidence gates the CLASSIFICATION LABEL, not the raw number: a LOW
 * confidence candidate can never be presented as HIGH PRIORITY or WATCH
 * CLOSELY, whatever its numeric total, because that pairing (spec section 16)
 * is exactly the thing that must never be shown.
 */
export function classifyOpportunityScore(total, confidenceLevel = "HIGH") {
  let band;
  if (total >= 85) band = "HIGH PRIORITY — INVESTIGATE";
  else if (total >= 70) band = "WATCH CLOSELY";
  else if (total >= 55) band = "SPECULATIVE / DEFICIENCIES";
  else band = "REJECT / LOW PRIORITY";

  if (confidenceLevel === "LOW" && (band === "HIGH PRIORITY — INVESTIGATE" || band === "WATCH CLOSELY")) {
    return "SPECULATIVE / DEFICIENCIES";
  }
  return band;
}

// ---------------------------------------------------------------------------
// Company Quality axis - fundamentals-only, deliberately excludes catalyst
// timing/valuation so it answers "is this a good business", not "is this a
// good trade today".
// ---------------------------------------------------------------------------

export function computeCompanyQualityScore(components = []) {
  const byId = Object.fromEntries(components.map((c) => [c.id, c]));
  const survival = byId.survival;
  const revenueOps = byId.revenueOps;
  const dilution = byId.dilution;
  const insider = byId.insiderInstitutional;
  if (!survival || !revenueOps || !dilution || !insider) return null;

  const score =
    (survival.points / survival.max) * 40 +
    (revenueOps.points / revenueOps.max) * 25 +
    (dilution.points / dilution.max) * 20 +
    (insider.points / insider.max) * 15;
  return clamp(round(score), 0, 100);
}

// ---------------------------------------------------------------------------
// Timing axis - is price/technical evidence supportive of acting NOW.
// Independent from Opportunity/Company Quality by design (spec: "a good
// company is not automatically a good trade today").
// ---------------------------------------------------------------------------

/**
 * @param {Object} technical
 * @param {boolean} [technical.breakoutConfirmed]
 * @param {boolean} [technical.pullbackConfirmed]  a quality pullback with a confirmed bounce
 * @param {number} [technical.rsi14]
 * @param {number} [technical.relativeVolume]
 * @param {boolean} [technical.aboveKeyMovingAverage]
 * @param {number} [technical.priceChange10dPercent]
 * @returns {number|null}
 */
export function computeTimingScore(technical = {}) {
  const hasAny = [
    technical.breakoutConfirmed, technical.pullbackConfirmed, technical.rsi14,
    technical.relativeVolume, technical.aboveKeyMovingAverage, technical.priceChange10dPercent,
  ].some((v) => v !== undefined && v !== null);
  if (!hasAny) return null;

  let base;
  if (technical.breakoutConfirmed) base = 40;
  else if (technical.pullbackConfirmed) base = 35;
  else if (Number.isFinite(technical.rsi14) && technical.rsi14 <= 35) base = 15;
  else if (Number.isFinite(technical.rsi14) && technical.rsi14 >= 65) base = 5;
  else base = 10;

  let bonus = 0;
  if (Number.isFinite(technical.relativeVolume)) {
    if (technical.relativeVolume >= 2) bonus += 25;
    else if (technical.relativeVolume >= 1.3) bonus += 12;
  }
  if (technical.aboveKeyMovingAverage === true) bonus += 15;
  if (Number.isFinite(technical.priceChange10dPercent)) {
    if (technical.priceChange10dPercent > 5) bonus += 20;
    else if (technical.priceChange10dPercent > 0) bonus += 10;
  }

  return clamp(round(base + bonus), 0, 100);
}

// ---------------------------------------------------------------------------
// Risk axis - 0-100, HIGHER = RISKIER. This is a single blended number for the
// 4-axis view only; the categorical Dilution Risk / Survival Risk badges stay
// separately displayed everywhere (spec section 9) and are never replaced by it.
// ---------------------------------------------------------------------------

export function computeRiskScore({ survival, dilution, liquidityComponent } = {}) {
  const parts = [];
  if (survival?.dataAvailable) parts.push({ weight: 0.4, fraction: survival.fraction });
  if (dilution?.dataAvailable) parts.push({ weight: 0.35, fraction: dilution.fraction });
  if (liquidityComponent && liquidityComponent.reasons[0] !== "Insufficient data to assess liquidity or momentum.") {
    parts.push({ weight: 0.25, fraction: 1 - liquidityComponent.points / liquidityComponent.max });
  }
  if (!parts.length) return null;
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const weighted = parts.reduce((sum, p) => sum + p.weight * p.fraction, 0) / totalWeight;
  return clamp(round(weighted * 100), 0, 100);
}

function timingDaysOut(timing = {}) {
  const date = timing.date || timing.windowStart;
  if (!date) return null;
  const ms = Date.parse(date);
  if (!Number.isFinite(ms)) return null;
  return Math.round((ms - Date.now()) / 86400000);
}

export { WEIGHTS as OPPORTUNITY_SCORE_WEIGHTS };
