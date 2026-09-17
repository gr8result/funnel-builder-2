import assert from "node:assert/strict";
import test from "node:test";

import { assessDilutionRisk } from "../lib/freedom/scanner/dilution.js";
import { assessSurvivalRisk } from "../lib/freedom/scanner/survival.js";
import { buildCatalysts } from "../lib/freedom/scanner/catalysts.js";
import {
  classifyOpportunityScore,
  componentCatalyst,
  componentDilution,
  componentSurvival,
  computeCompanyQualityScore,
  computeOpportunityScore,
  computeRiskScore,
  computeTimingScore,
  OPPORTUNITY_SCORE_WEIGHTS,
} from "../lib/freedom/scanner/scoring.js";

test("component weights sum to 100", () => {
  const total = Object.values(OPPORTUNITY_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(total, 100);
});

test("a candidate with zero usable data scores 0, not an assumed middle value", () => {
  const { total, components } = computeOpportunityScore({});
  assert.equal(total, 0);
  assert.ok(components.every((c) => c.points === 0));
  assert.ok(components.every((c) => c.reasons[0].toLowerCase().includes("insufficient") || c.reasons[0].toLowerCase().includes("no identified")));
});

test("componentCatalyst rewards a near-term CONFIRMED catalyst more than a distant SPECULATIVE one", () => {
  const near = buildCatalysts([{ description: "PDUFA date", sourceType: "SEC_FILING", sourceDate: "2026-01-01", timing: { type: "DATE", date: new Date(Date.now() + 10 * 86400000).toISOString() } }]);
  const far = buildCatalysts([{ description: "Rumour", sourceType: "ESTIMATE", timing: { type: "DATE", date: new Date(Date.now() + 300 * 86400000).toISOString() } }]);
  assert.ok(componentCatalyst(near).points > componentCatalyst(far).points);
});

test("componentSurvival and componentDilution invert the risk fraction into points", () => {
  const lowRisk = assessSurvivalRisk({ runwayMonths: 48, cash: 10, debt: 0, goingConcernWarning: false });
  const highRisk = assessSurvivalRisk({ runwayMonths: 2, cash: 1, debt: 10, goingConcernWarning: true });
  assert.ok(componentSurvival(lowRisk).points > componentSurvival(highRisk).points);

  const cleanStructure = assessDilutionRisk({ shareCountGrowthPercent: 1, atmFacilityActive: false });
  const messyStructure = assessDilutionRisk({ shareCountGrowthPercent: 200, atmFacilityActive: true, atmFacilityUsd: 50_000_000, marketCap: 40_000_000 });
  assert.ok(componentDilution(cleanStructure).points > componentDilution(messyStructure).points);
});

test("classification bands match the spec boundaries exactly", () => {
  assert.equal(classifyOpportunityScore(85), "HIGH PRIORITY — INVESTIGATE");
  assert.equal(classifyOpportunityScore(84.99), "WATCH CLOSELY");
  assert.equal(classifyOpportunityScore(70), "WATCH CLOSELY");
  assert.equal(classifyOpportunityScore(69.99), "SPECULATIVE / DEFICIENCIES");
  assert.equal(classifyOpportunityScore(55), "SPECULATIVE / DEFICIENCIES");
  assert.equal(classifyOpportunityScore(54.99), "REJECT / LOW PRIORITY");
  assert.equal(classifyOpportunityScore(0), "REJECT / LOW PRIORITY");
});

test("LOW confidence caps the classification even at a 90+ total score (spec section 16)", () => {
  assert.equal(classifyOpportunityScore(92, "LOW"), "SPECULATIVE / DEFICIENCIES");
  assert.equal(classifyOpportunityScore(72, "LOW"), "SPECULATIVE / DEFICIENCIES");
  assert.equal(classifyOpportunityScore(50, "LOW"), "REJECT / LOW PRIORITY"); // already below the gated band
});

test("MEDIUM/HIGH confidence does not alter the band", () => {
  assert.equal(classifyOpportunityScore(92, "MEDIUM"), "HIGH PRIORITY — INVESTIGATE");
  assert.equal(classifyOpportunityScore(92, "HIGH"), "HIGH PRIORITY — INVESTIGATE");
});

test("computeCompanyQualityScore is fundamentals-only and ignores catalyst/valuation/liquidity inputs", () => {
  const { components: withCatalyst } = computeOpportunityScore({
    catalysts: buildCatalysts([{ description: "x", sourceType: "SEC_FILING", sourceDate: "2026-01-01", timing: { type: "DATE", date: new Date(Date.now() + 5 * 86400000).toISOString() } }]),
    valuation: { currentPrice: 1, week52High: 10 },
  });
  const { components: withoutCatalyst } = computeOpportunityScore({});
  assert.equal(computeCompanyQualityScore(withCatalyst), computeCompanyQualityScore(withoutCatalyst));
});

test("computeTimingScore is null with no technical evidence, and rewards breakout + volume confirmation", () => {
  assert.equal(computeTimingScore({}), null);
  const base = computeTimingScore({ breakoutConfirmed: true });
  const confirmed = computeTimingScore({ breakoutConfirmed: true, relativeVolume: 2.5, aboveKeyMovingAverage: true });
  assert.ok(confirmed > base);
});

test("computeRiskScore is null when no risk inputs are available, and rises with worse risk fractions", () => {
  assert.equal(computeRiskScore({}), null);
  const low = computeRiskScore({ survival: { dataAvailable: true, fraction: 0.1 } });
  const high = computeRiskScore({ survival: { dataAvailable: true, fraction: 0.9 } });
  assert.ok(high > low);
});
