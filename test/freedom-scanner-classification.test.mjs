import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEntryPlan,
  classifyActionability,
  classifyMode,
  classifySetupType,
} from "../lib/freedom/scanner/classification.js";

// ---------------------------------------------------------------------------
// Engine 1 mode: MOMENTUM vs CRASH_REBOUND
// ---------------------------------------------------------------------------

test("classifyMode returns null (not a default) when no price performance is known", () => {
  assert.equal(classifyMode({}), null);
});

test("a large prior decline classifies as CRASH_REBOUND, not MOMENTUM", () => {
  assert.equal(classifyMode({ priceChange365dPercent: -75 }), "CRASH_REBOUND");
  assert.equal(classifyMode({ priceChange90dPercent: -60 }), "CRASH_REBOUND");
});

test("a stock down 90% is NOT automatically rejected by mode alone - it is simply labelled CRASH_REBOUND for further evidence gathering", () => {
  const mode = classifyMode({ priceChange365dPercent: -90 });
  assert.equal(mode, "CRASH_REBOUND");
});

test("no big decline classifies as MOMENTUM", () => {
  assert.equal(classifyMode({ priceChange90dPercent: 15, priceChange365dPercent: 40 }), "MOMENTUM");
});

// ---------------------------------------------------------------------------
// Engine 2 setup types
// ---------------------------------------------------------------------------

test("classifySetupType returns null when no evidence fits any of the 8 types", () => {
  assert.equal(classifySetupType({}), null);
});

test("EARNINGS takes priority over other evidence", () => {
  const type = classifySetupType({
    catalystInfo: { hasEarningsWithin14Days: true, hasMajorConfirmedCatalystWithin90Days: true },
    technical: { breakoutConfirmed: true },
  });
  assert.equal(type, "EARNINGS");
});

test("BREAKOUT requires an actually confirmed breakout, not just high relative volume", () => {
  assert.equal(classifySetupType({ technical: { relativeVolume: 3 } }), null);
  assert.equal(classifySetupType({ technical: { breakoutConfirmed: true } }), "BREAKOUT");
});

test("RECOVERY_TURNAROUND requires a big decline AND improving fundamentals AND non-extreme survival risk", () => {
  assert.equal(classifySetupType({ bigDecline: true, improvingFundamentals: false }), null);
  assert.equal(classifySetupType({ bigDecline: true, improvingFundamentals: true, survivalRiskLevel: "EXTREME" }), null);
  assert.equal(classifySetupType({ bigDecline: true, improvingFundamentals: true, survivalRiskLevel: "MEDIUM" }), "RECOVERY_TURNAROUND");
});

test("QUALITY_PULLBACK requires both a confirmed pullback and high company quality", () => {
  assert.equal(classifySetupType({ technical: { pullbackConfirmed: true }, companyQualityScore: 50 }), null);
  assert.equal(classifySetupType({ technical: { pullbackConfirmed: true }, companyQualityScore: 80 }), "QUALITY_PULLBACK");
});

test("VALUE_OVERSOLD fires on low RSI only when nothing more specific already matched", () => {
  assert.equal(classifySetupType({ technical: { rsi14: 25 } }), "VALUE_OVERSOLD");
  assert.equal(classifySetupType({ technical: { rsi14: 25, breakoutConfirmed: true } }), "BREAKOUT");
});

// ---------------------------------------------------------------------------
// buildEntryPlan - never fabricate levels
// ---------------------------------------------------------------------------

test("buildEntryPlan returns null when any required level is missing", () => {
  assert.equal(buildEntryPlan({ currentPrice: 10 }), null);
});

test("buildEntryPlan rejects an internally inconsistent ladder", () => {
  assert.equal(buildEntryPlan({ currentPrice: 10, entryZoneLow: 9, entryZoneHigh: 11, invalidationLevel: 9.5, initialTarget: 15 }), null, "invalidation above entry-zone low");
  assert.equal(buildEntryPlan({ currentPrice: 10, entryZoneLow: 9, entryZoneHigh: 11, invalidationLevel: 8, initialTarget: 10 }), null, "target inside entry zone");
});

test("buildEntryPlan computes a coherent plan and risk/reward for valid inputs", () => {
  const plan = buildEntryPlan({ currentPrice: 10, entryZoneLow: 9.5, entryZoneHigh: 10.5, invalidationLevel: 8.5, initialTarget: 13.5 });
  assert.ok(plan);
  assert.equal(plan.priceInsideEntryZone, true);
  assert.equal(plan.riskRewardRatio, 3); // reward 3 / risk 1
});

// ---------------------------------------------------------------------------
// Actionability state machine
// ---------------------------------------------------------------------------

const fullPlan = buildEntryPlan({ currentPrice: 10, entryZoneLow: 9.5, entryZoneHigh: 10.5, invalidationLevel: 8.5, initialTarget: 13.5 });

test("LOW confidence or sparse data always yields INSUFFICIENT EVIDENCE, regardless of the score", () => {
  const result = classifyActionability({ opportunityScore: 95, timingScore: 95, confidenceLevel: "LOW", componentsWithData: 8, entryPlan: fullPlan });
  assert.equal(result.state, "INSUFFICIENT EVIDENCE");

  const sparse = classifyActionability({ opportunityScore: 95, timingScore: 95, confidenceLevel: "HIGH", componentsWithData: 2, entryPlan: fullPlan });
  assert.equal(sparse.state, "INSUFFICIENT EVIDENCE");
});

test("a below-threshold score REJECTs even with perfect timing", () => {
  const result = classifyActionability({ opportunityScore: 40, timingScore: 95, confidenceLevel: "HIGH", componentsWithData: 8, entryPlan: fullPlan });
  assert.equal(result.state, "REJECT");
});

test("EXTREME survival risk REJECTs regardless of score", () => {
  const result = classifyActionability({ opportunityScore: 95, timingScore: 95, confidenceLevel: "HIGH", componentsWithData: 8, survivalRiskLevel: "EXTREME", entryPlan: fullPlan });
  assert.equal(result.state, "REJECT");
});

test("high opportunity + high timing + a valid entry plan is ACTIONABLE SETUP", () => {
  const result = classifyActionability({ opportunityScore: 80, timingScore: 80, confidenceLevel: "HIGH", componentsWithData: 8, entryPlan: fullPlan });
  assert.equal(result.state, "ACTIONABLE SETUP");
});

test("high opportunity + moderate timing is NEAR ENTRY, not ACTIONABLE", () => {
  const result = classifyActionability({ opportunityScore: 80, timingScore: 60, confidenceLevel: "HIGH", componentsWithData: 8, entryPlan: fullPlan });
  assert.equal(result.state, "NEAR ENTRY");
});

test("without an entry plan, a high-scoring candidate cannot be ACTIONABLE or NEAR ENTRY (never fabricate levels)", () => {
  const result = classifyActionability({ opportunityScore: 90, timingScore: 90, confidenceLevel: "HIGH", componentsWithData: 8, entryPlan: null });
  assert.ok(!["ACTIONABLE SETUP", "NEAR ENTRY"].includes(result.state));
});

test("good company, weak timing produces the explicit WATCH — GOOD COMPANY, WRONG ENTRY message", () => {
  const result = classifyActionability({ opportunityScore: 84, timingScore: 43, companyQualityScore: 91, confidenceLevel: "HIGH", componentsWithData: 8, entryPlan: null });
  assert.equal(result.state, "WATCH");
  assert.match(result.message, /GOOD COMPANY, WRONG ENTRY/);
});
