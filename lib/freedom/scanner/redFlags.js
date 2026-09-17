/**
 * The fixed red-flag checklist (spec section 10).
 *
 * Each flag is a pure predicate over already-derived candidate signals (never
 * does its own network/text parsing - dilution.js, survival.js and edgar.js are
 * responsible for turning filings into the booleans/numbers checked here). A
 * flag firing is never an automatic rejection: every flag carries a plain-English
 * consequence so the candidate page can explain the risk instead of hiding it.
 *
 * `inputs.<field> === undefined` means "unknown", which never counts as
 * "detected" - an unmeasured red flag is reported as UNAVAILABLE, not silently
 * treated as absent or present.
 */

const FLAG_DEFINITIONS = [
  {
    id: "short_cash_runway",
    label: "Very short cash runway",
    detect: (i) => Number.isFinite(i.runwayMonths) && i.runwayMonths < 6,
    consequence: "Cash could run out inside two quarters, forcing an emergency raise or wind-down before the thesis plays out.",
  },
  {
    id: "going_concern",
    label: "Going-concern warning",
    detect: (i) => i.goingConcernWarning === true,
    consequence: "The company's own auditor has flagged substantial doubt it can continue operating without new financing.",
  },
  {
    id: "repeated_capital_raises",
    label: "Repeated capital raises",
    detect: (i) => Number.isFinite(i.capitalRaiseCount12m) && i.capitalRaiseCount12m >= 3,
    consequence: "A pattern of frequent raises signals the business cannot fund itself from operations, and further dilution is likely.",
  },
  {
    id: "large_atm_facility",
    label: "Large ATM facility",
    detect: (i) => i.atmFacilityActive === true && Number.isFinite(i.atmFacilityUsd) && Number.isFinite(i.marketCap) && i.marketCap > 0 && i.atmFacilityUsd / i.marketCap > 0.2,
    consequence: "The company can sell new shares into the market at any time, which caps upside and can pressure the price continuously.",
  },
  {
    id: "heavy_warrants",
    label: "Heavy warrants/options overhang",
    detect: (i) => Number.isFinite(i.warrantsOutstandingRatio) && i.warrantsOutstandingRatio > 0.25,
    consequence: "A large warrant/option overhang means a meaningful share-count increase is already scheduled if they are exercised.",
  },
  {
    id: "rapid_share_count_growth",
    label: "Rapid share-count expansion",
    detect: (i) => Number.isFinite(i.shareCountGrowthPercent) && i.shareCountGrowthPercent > 30,
    consequence: "Existing holders have already been diluted materially over the past year, and the trend may continue.",
  },
  {
    id: "reverse_split_history",
    label: "Reverse-split history",
    detect: (i) => Array.isArray(i.reverseSplitDates) && i.reverseSplitDates.length > 0,
    consequence: "A prior reverse split is often a symptom of chronic dilution or an exchange-compliance struggle, not a one-off event.",
  },
  {
    id: "exchange_compliance",
    label: "Exchange compliance problems",
    detect: (i) => i.exchangeComplianceIssue === true,
    consequence: "A compliance deficiency (e.g. minimum price/equity) can lead to forced remedial dilution or delisting.",
  },
  {
    id: "delisting_risk",
    label: "Delisting risk",
    detect: (i) => i.delistingRisk === true,
    consequence: "Delisting would force the stock onto less liquid venues and could trigger forced selling by funds that cannot hold it.",
  },
  {
    id: "very_low_liquidity",
    label: "Very low liquidity",
    detect: (i) => Number.isFinite(i.averageDollarVolume) && i.averageDollarVolume < 100_000,
    consequence: "Thin trading means wide spreads and difficulty exiting a position without moving the price against you.",
  },
  {
    id: "promotional_activity",
    label: "Unexplained promotional activity",
    detect: (i) => i.promotionalActivityFlag === true,
    consequence: "Coordinated promotion without a matching fundamental catalyst is a classic precursor to a sharp reversal.",
  },
  {
    id: "material_debt_problems",
    label: "Material debt problems",
    detect: (i) => i.materialDebtProblem === true,
    consequence: "Debt covenants or near-term maturities can force asset sales, refinancing at punitive terms, or bankruptcy.",
  },
  {
    id: "failed_clinical_regulatory",
    label: "Failed clinical/regulatory outcome",
    detect: (i) => i.failedClinicalOrRegulatory === true,
    consequence: "A failed trial or rejected application typically removes the primary catalyst the thesis depended on.",
  },
  {
    id: "loss_of_major_customer",
    label: "Loss of a major customer",
    detect: (i) => i.lossOfMajorCustomer === true,
    consequence: "Revenue concentration risk has crystallised - near-term revenue is likely to fall materially.",
  },
  {
    id: "auditor_problems",
    label: "Auditor problems",
    detect: (i) => i.auditorProblem === true,
    consequence: "An auditor resignation, adverse opinion, or material weakness undermines trust in the reported financials themselves.",
  },
];

/**
 * @param {Object} inputs  derived signals (see each flag's detect() for the field it reads)
 * @returns {Array<{id, label, status: "DETECTED"|"CLEAR"|"UNAVAILABLE", consequence: string}>}
 */
export function detectRedFlags(inputs = {}) {
  return FLAG_DEFINITIONS.map((flag) => {
    const relevantFields = flagFields(flag.id);
    const anyKnown = relevantFields.some((field) => inputs[field] !== undefined && inputs[field] !== null);
    if (!anyKnown) {
      return { id: flag.id, label: flag.label, status: "UNAVAILABLE", consequence: flag.consequence };
    }
    const detected = Boolean(flag.detect(inputs));
    return { id: flag.id, label: flag.label, status: detected ? "DETECTED" : "CLEAR", consequence: flag.consequence };
  });
}

function flagFields(id) {
  const map = {
    short_cash_runway: ["runwayMonths"],
    going_concern: ["goingConcernWarning"],
    repeated_capital_raises: ["capitalRaiseCount12m"],
    large_atm_facility: ["atmFacilityActive", "atmFacilityUsd", "marketCap"],
    heavy_warrants: ["warrantsOutstandingRatio"],
    rapid_share_count_growth: ["shareCountGrowthPercent"],
    reverse_split_history: ["reverseSplitDates"],
    exchange_compliance: ["exchangeComplianceIssue"],
    delisting_risk: ["delistingRisk"],
    very_low_liquidity: ["averageDollarVolume"],
    promotional_activity: ["promotionalActivityFlag"],
    material_debt_problems: ["materialDebtProblem"],
    failed_clinical_regulatory: ["failedClinicalOrRegulatory"],
    loss_of_major_customer: ["lossOfMajorCustomer"],
    auditor_problems: ["auditorProblem"],
  };
  return map[id] || [];
}

export function redFlagSummary(flags = []) {
  const detected = flags.filter((flag) => flag.status === "DETECTED");
  return {
    detectedCount: detected.length,
    detected: detected.map((flag) => flag.id),
    unavailableCount: flags.filter((flag) => flag.status === "UNAVAILABLE").length,
  };
}
