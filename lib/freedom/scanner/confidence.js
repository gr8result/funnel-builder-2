/**
 * Data confidence for a scanner candidate.
 *
 * Confidence is derived purely from how much of the CRITICAL evidence set was
 * actually retrieved (AVAILABLE, not STALE) - never from the score itself. This
 * is what stops a thin-data stock from displaying a HIGH-confidence 90: if the
 * critical fields are not there, confidence cannot be HIGH, full stop, no matter
 * what the component scores computed to.
 */

// Fields without which the Opportunity Score components cannot be trusted.
// Missing any of these drops confidence at least one full level.
export const CRITICAL_FIELDS = Object.freeze([
  "price",
  "marketCap",
  "averageDollarVolume",
  "cash",
  "sharesOutstanding",
]);

// Fields that add trust but whose absence alone should not collapse confidence
// to LOW - real companies frequently have gaps here (e.g. no analyst revenue
// estimates for a pre-revenue biotech).
export const SUPPORTING_FIELDS = Object.freeze([
  "debt",
  "revenue",
  "revenueGrowthPercent",
  "operatingCashFlow",
  "insiderOwnershipPercent",
  "institutionalOwnershipPercent",
]);

export const CONFIDENCE_LEVELS = Object.freeze(["HIGH", "MEDIUM", "LOW"]);

/**
 * @param {Object} availability  field -> "AVAILABLE" | "UNAVAILABLE" | "STALE"
 * @returns {{ level: "HIGH"|"MEDIUM"|"LOW", criticalCoverage: number, supportingCoverage: number,
 *             missingCritical: string[], staleCritical: string[], missingSupporting: string[] }}
 */
export function assessDataConfidence(availability = {}) {
  const usable = (field) => availability[field] === "AVAILABLE";
  const stale = (field) => availability[field] === "STALE";

  const missingCritical = CRITICAL_FIELDS.filter((field) => !usable(field) && !stale(field));
  const staleCritical = CRITICAL_FIELDS.filter((field) => stale(field));
  const missingSupporting = SUPPORTING_FIELDS.filter((field) => !usable(field));

  const criticalCoverage = round((CRITICAL_FIELDS.length - missingCritical.length - staleCritical.length) / CRITICAL_FIELDS.length);
  const supportingCoverage = round((SUPPORTING_FIELDS.length - missingSupporting.length) / SUPPORTING_FIELDS.length);

  let level = "HIGH";
  if (missingCritical.length > 0 || staleCritical.length >= 2) {
    level = "LOW";
  } else if (staleCritical.length === 1 || supportingCoverage < 0.5) {
    level = "MEDIUM";
  } else if (supportingCoverage < 0.85) {
    level = "MEDIUM";
  }

  return {
    level,
    criticalCoverage,
    supportingCoverage,
    missingCritical,
    staleCritical,
    missingSupporting,
  };
}

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : 0;
}
