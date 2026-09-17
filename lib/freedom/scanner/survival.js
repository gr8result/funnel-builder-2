/**
 * Financial survival risk: cash runway, debt load, going-concern language.
 *
 * Same "score only what is known, rate as a fraction of the known maximum"
 * approach as dilution.js - see that file's header for why.
 */

function runwayPoints(months) {
  if (months < 6) return 4;
  if (months < 12) return 3;
  if (months < 24) return 2;
  if (months < 36) return 1;
  return 0;
}

function debtToCashPoints(debt, cash) {
  if (cash <= 0) return debt > 0 ? 4 : 2; // no cash cushion at all
  const ratio = debt / cash;
  if (ratio < 0.5) return 0;
  if (ratio < 1.5) return 1;
  if (ratio < 3) return 2;
  return 3;
}

/**
 * Cash runway in months from two cash snapshots. Returns null (not zero) when
 * cash is flat or growing - "burning cash" and "not burning cash" are different
 * facts and must not collapse to the same number.
 */
export function estimateRunwayMonths({ cash, cashPriorPeriod, periodMonths } = {}) {
  if (![cash, cashPriorPeriod, periodMonths].every(Number.isFinite) || periodMonths <= 0) return null;
  const burnPerMonth = (cashPriorPeriod - cash) / periodMonths;
  if (burnPerMonth <= 0) return null; // flat or growing cash balance
  if (cash <= 0) return 0;
  return round(cash / burnPerMonth, 1);
}

/**
 * @param {Object} inputs
 * @param {number} [inputs.cash]
 * @param {number} [inputs.debt]
 * @param {number} [inputs.runwayMonths]  precomputed via estimateRunwayMonths, or supplied directly
 * @param {boolean} [inputs.goingConcernWarning]
 * @param {number} [inputs.operatingCashFlow]  trailing period, negative = cash-consuming
 */
export function assessSurvivalRisk(inputs = {}) {
  const factors = [];

  if (Number.isFinite(inputs.runwayMonths)) {
    factors.push({ id: "runway", max: 4, points: runwayPoints(inputs.runwayMonths) });
  }
  if (Number.isFinite(inputs.debt) && Number.isFinite(inputs.cash)) {
    factors.push({ id: "debtToCash", max: 4, points: debtToCashPoints(inputs.debt, inputs.cash) });
  }
  if (typeof inputs.goingConcernWarning === "boolean") {
    factors.push({ id: "goingConcern", max: 3, points: inputs.goingConcernWarning ? 3 : 0 });
  }
  if (Number.isFinite(inputs.operatingCashFlow)) {
    factors.push({ id: "operatingCashFlow", max: 1, points: inputs.operatingCashFlow < 0 ? 1 : 0 });
  }

  if (!factors.length) {
    return { level: null, dataAvailable: false, fraction: null, factors: [], reason: "No survival-related data available." };
  }

  const points = factors.reduce((sum, f) => sum + f.points, 0);
  const max = factors.reduce((sum, f) => sum + f.max, 0);
  const fraction = max > 0 ? points / max : 0;

  return { level: fractionToLevel(fraction), dataAvailable: true, fraction: round(fraction, 3), points: round(points, 3), max, factors };
}

function fractionToLevel(fraction) {
  if (fraction < 0.2) return "LOW";
  if (fraction < 0.45) return "MEDIUM";
  if (fraction < 0.7) return "HIGH";
  return "EXTREME";
}

function round(value, decimals = 2) {
  return Number(Number(value).toFixed(decimals));
}

export const SURVIVAL_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "EXTREME"];
