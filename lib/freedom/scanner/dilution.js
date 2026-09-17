/**
 * Dilution / share-structure risk.
 *
 * Combines share-count growth, ATM facility size, warrant/option overhang,
 * convertible securities, and reverse-split history into a single
 * LOW / MEDIUM / HIGH / EXTREME rating.
 *
 * Each factor contributes points only when its input is actually known.
 * The rating is the fraction of the MAXIMUM POSSIBLE points among the factors
 * that were actually measurable, not among all factors - so a stock with only
 * share-count data available is rated on that alone, honestly, rather than
 * being scored as if the unmeasured factors were zero (which would fabricate a
 * clean bill of health) or unmeasured (which would make every partial-data
 * candidate unratable). When nothing at all is known, `level` is null.
 */

const LEVELS = ["LOW", "MEDIUM", "HIGH", "EXTREME"];

function shareGrowthPoints(percent) {
  if (percent < 5) return 0;
  if (percent < 15) return 1;
  if (percent < 30) return 2;
  if (percent < 60) return 3;
  return 4;
}

function atmPoints(active, atmUsd, marketCap) {
  if (!active) return 0;
  if (!Number.isFinite(atmUsd) || !Number.isFinite(marketCap) || marketCap <= 0) return 1.5; // active but unsized: assume moderate
  const ratio = atmUsd / marketCap;
  if (ratio < 0.1) return 1;
  if (ratio < 0.25) return 2;
  return 3;
}

function warrantPoints(ratio) {
  if (ratio < 0.05) return 0;
  if (ratio < 0.15) return 1;
  if (ratio < 0.3) return 2;
  return 3;
}

function convertiblePoints(ratio) {
  if (ratio < 0.1) return 0;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  return 3;
}

function reverseSplitPoints(dates) {
  if (!dates.length) return 0;
  const mostRecentMs = Math.max(...dates.map((d) => Date.parse(d)).filter(Number.isFinite));
  if (!Number.isFinite(mostRecentMs)) return 1;
  const yearsAgo = (Date.now() - mostRecentMs) / (365.25 * 86400000);
  return yearsAgo <= 3 ? 2 : 1;
}

/**
 * @param {Object} inputs
 * @param {number} [inputs.shareCountGrowthPercent]  YoY shares-outstanding growth, e.g. 12.5
 * @param {boolean} [inputs.atmFacilityActive]
 * @param {number} [inputs.atmFacilityUsd]
 * @param {number} [inputs.marketCap]
 * @param {number} [inputs.warrantsOutstandingRatio]  warrant shares / shares outstanding
 * @param {number} [inputs.convertibleSecuritiesRatio]  convertible face value / market cap
 * @param {string[]} [inputs.reverseSplitDates]  ISO dates of past reverse splits
 */
export function assessDilutionRisk(inputs = {}) {
  const factors = [];

  if (Number.isFinite(inputs.shareCountGrowthPercent)) {
    factors.push({ id: "shareCountGrowth", max: 4, points: shareGrowthPoints(inputs.shareCountGrowthPercent) });
  }
  if (typeof inputs.atmFacilityActive === "boolean") {
    factors.push({ id: "atmFacility", max: 3, points: atmPoints(inputs.atmFacilityActive, inputs.atmFacilityUsd, inputs.marketCap) });
  }
  if (Number.isFinite(inputs.warrantsOutstandingRatio)) {
    factors.push({ id: "warrants", max: 3, points: warrantPoints(inputs.warrantsOutstandingRatio) });
  }
  if (Number.isFinite(inputs.convertibleSecuritiesRatio)) {
    factors.push({ id: "convertibles", max: 3, points: convertiblePoints(inputs.convertibleSecuritiesRatio) });
  }
  if (Array.isArray(inputs.reverseSplitDates)) {
    factors.push({ id: "reverseSplits", max: 2, points: reverseSplitPoints(inputs.reverseSplitDates) });
  }

  if (!factors.length) {
    return { level: null, dataAvailable: false, fraction: null, factors: [], reason: "No dilution-related data available." };
  }

  const points = factors.reduce((sum, f) => sum + f.points, 0);
  const max = factors.reduce((sum, f) => sum + f.max, 0);
  const fraction = max > 0 ? points / max : 0;
  const level = fractionToLevel(fraction);

  return { level, dataAvailable: true, fraction: round(fraction), points: round(points), max, factors };
}

function fractionToLevel(fraction) {
  if (fraction < 0.2) return "LOW";
  if (fraction < 0.45) return "MEDIUM";
  if (fraction < 0.7) return "HIGH";
  return "EXTREME";
}

function round(value, decimals = 3) {
  return Number(Number(value).toFixed(decimals));
}

export { LEVELS as DILUTION_RISK_LEVELS };
