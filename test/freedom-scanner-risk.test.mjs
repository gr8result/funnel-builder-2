import assert from "node:assert/strict";
import test from "node:test";

import { assessDilutionRisk } from "../lib/freedom/scanner/dilution.js";
import { assessSurvivalRisk, estimateRunwayMonths } from "../lib/freedom/scanner/survival.js";

// ---------------------------------------------------------------------------
// Dilution risk
// ---------------------------------------------------------------------------

test("dilution risk is null (not a guessed LOW) when nothing is known", () => {
  const result = assessDilutionRisk({});
  assert.equal(result.level, null);
  assert.equal(result.dataAvailable, false);
});

test("dilution risk LOW for a clean share structure", () => {
  const result = assessDilutionRisk({ shareCountGrowthPercent: 1, atmFacilityActive: false, warrantsOutstandingRatio: 0.01, reverseSplitDates: [] });
  assert.equal(result.level, "LOW");
});

test("dilution risk EXTREME for heavy share growth + large ATM + heavy warrants + recent reverse split", () => {
  const result = assessDilutionRisk({
    shareCountGrowthPercent: 250,
    atmFacilityActive: true,
    atmFacilityUsd: 40_000_000,
    marketCap: 50_000_000,
    warrantsOutstandingRatio: 0.6,
    convertibleSecuritiesRatio: 0.8,
    reverseSplitDates: [new Date().toISOString()],
  });
  assert.equal(result.level, "EXTREME");
});

test("a recent reverse split scores worse than an old one", () => {
  const recent = assessDilutionRisk({ reverseSplitDates: [new Date().toISOString()] });
  const old = assessDilutionRisk({ reverseSplitDates: ["2015-01-01T00:00:00Z"] });
  assert.ok(recent.points > old.points);
});

test("share-count growth alone is scored on that factor only, not defaulted against unmeasured factors", () => {
  const result = assessDilutionRisk({ shareCountGrowthPercent: 65 });
  assert.equal(result.factors.length, 1);
  assert.equal(result.level, "EXTREME"); // 65% growth alone maxes that single factor
});

// ---------------------------------------------------------------------------
// Survival risk
// ---------------------------------------------------------------------------

test("survival risk is null when nothing is known", () => {
  const result = assessSurvivalRisk({});
  assert.equal(result.level, null);
});

test("survival risk EXTREME for short runway + heavy debt + going concern", () => {
  const result = assessSurvivalRisk({ runwayMonths: 3, cash: 1_000_000, debt: 10_000_000, goingConcernWarning: true, operatingCashFlow: -500_000 });
  assert.equal(result.level, "EXTREME");
});

test("survival risk LOW for long runway, no debt problem, no going concern", () => {
  const result = assessSurvivalRisk({ runwayMonths: 48, cash: 20_000_000, debt: 1_000_000, goingConcernWarning: false, operatingCashFlow: 500_000 });
  assert.equal(result.level, "LOW");
});

// estimateRunwayMonths

test("runway is null (not zero) when cash is flat or growing", () => {
  assert.equal(estimateRunwayMonths({ cash: 10, cashPriorPeriod: 10, periodMonths: 3 }), null);
  assert.equal(estimateRunwayMonths({ cash: 12, cashPriorPeriod: 10, periodMonths: 3 }), null);
});

test("runway is computed correctly for a burning company", () => {
  // burned 3m over 3 months => 1m/month burn; 9m cash / 1m per month = 9 months
  const months = estimateRunwayMonths({ cash: 9, cashPriorPeriod: 12, periodMonths: 3 });
  assert.equal(months, 9);
});

test("runway is 0, not negative or null, once cash is already exhausted", () => {
  const months = estimateRunwayMonths({ cash: -1, cashPriorPeriod: 5, periodMonths: 3 });
  assert.equal(months, 0);
});

test("runway is null when any required input is missing", () => {
  assert.equal(estimateRunwayMonths({ cash: 9, cashPriorPeriod: 12 }), null);
  assert.equal(estimateRunwayMonths({}), null);
});
